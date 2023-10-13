// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

// import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
// import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
// import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
// import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
// import "@openzeppelin/contracts/access/AccessControl.sol";
// import "@openzeppelin/contracts/utils/Counters.sol";
// import "@openzeppelin/contracts/utils/Arrays.sol";
// import "@openzeppelin/contracts/utils/math/Math.sol";
// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ArraysUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol"; // UUPS upgradable contract
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol"; // Functionality for initialization in place of constructors
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol"; // Utility to allow pausing of certain functionality
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol"; // Utility to convert to string types

import {IERC20, IERC20Metadata, ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @custom:security-contact haorans@karatdao.com
contract StakedKaratPoolTokenv2 is
    Initializable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    ERC721BurnableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using MathUpgradeable for uint256;
    using ArraysUpgradeable for uint256[];

    event TokenStaked(
        address staker,
        uint256 valiadtorId,
        uint256 stakerTokenId,
        uint256 amount
    );
    event TokenUnstaked(
        address staker,
        uint256 valiadtorId,
        uint256 stakerTokenId,
        uint256 amount
    );
    event SnapShotTaken(uint256 epoch);

    uint256 public currentEpoch;
    uint256 public firstDAYUnix;

    //Stake Management
    uint256 public totalKAT;

    //tokenId -> Account Karat Token Balance
    mapping(uint256 => uint256) public tokenBalance;

    //ValidatorId -> Pool Karat Token Balance
    mapping(uint256 => uint256) public poolBalance;

    //Reward Management
    //currentEpoch -> Total Karat Reward
    mapping(uint256 => uint256) public totalKaratReward;

    //Claimer -> epoch -> Reward
    mapping(address => mapping(uint256 => uint256)) public claimerReward;
    //validatorId -> epoch -> Karat Reward
    mapping(uint256 => mapping(uint256 => uint256)) public validatorReward;
    //lieutenantAddr => epoch => Reward
    mapping(address => mapping(uint256 => uint256)) public lieutenantReward;
    //Stakers Reward: ValidatorId => Epoch => Rewards
    mapping(uint256 => mapping(uint256 => uint256)) public stakerReward;

    mapping(uint256 => uint256) public lastPoolUpdated;

    //Staking Reward Calculation
    //ValidatorId -> pool reward index
    mapping(uint256 => uint256) private rewardIndex;
    //ValidatorId -> tokenId -> rewardIndex
    mapping(uint256 => mapping(uint256 => uint256)) public rewardIndexOf;
    //ValidatorId -> tokenId -> earned
    mapping(uint256 => mapping(uint256 => uint256)) public earned;

    mapping(uint256 => address) ifEverydayRewardClaimed;
    mapping(uint256 => mapping(uint256 => bool)) isValidatorClaimed;
    mapping(uint256 => uint256) validatorEarns;

    mapping(uint256 => uint256) public poolSize;
    mapping(uint256 => uint256) public stakedTime;
    mapping(uint256 => uint256) public validatorIdMapping;

    bytes32 public constant AUTHORIZED_CALLER = keccak256("AUTHORIZED_CALLER");
    uint256 private constant MULTIPLIER = 1e18;
    uint256 public constant startingReward = 5000000 * MULTIPLIER;

    IERC20 public _asset;
    CountersUpgradeable.Counter public tokenIdCounter;

    function initialize(
        IERC20 asset_,
        uint256 firstdayUnixTime
    ) public initializer {
        __ERC721_init("Staked Karat Pool Token", "stKAT");
        __AccessControl_init();
        __ReentrancyGuard_init();
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __UUPSUpgradeable_init();
        __ERC721Burnable_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());

        currentEpoch = 0;
        _asset = asset_;
        firstDAYUnix = firstdayUnixTime;
    }

    //Functions of TokenURI
    function _baseURI() internal pure override returns (string memory) {
        return "https://api.karatdao.com/nft/staking/";
    }

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return string(abi.encodePacked(super.tokenURI(tokenId), ".json"));
    }

    //APY calculation: stakeReward at i / stake Amount avg ~ 7 / 365
    //Functions of Taking a Snapshot, Can be Called by Eurger Authorized Caller Or System Maintainer
    function _snapshot() internal virtual returns (uint256) {
        //New Epoch is created
        currentEpoch += 1;
        //Each increased 1 day

        emit SnapShotTaken(currentEpoch);
        return currentEpoch;
    }

    function snapshot() public onlyRole(AUTHORIZED_CALLER) returns (uint256) {
        return _snapshot();
    }

    function getCurrentSnapshotId() public view virtual returns (uint256) {
        return currentEpoch;
    }

    function tryUpdateSnapshot(
        address claimer
    ) public onlyRole(AUTHORIZED_CALLER) returns (bool) {
        uint256 startEpochTime = (currentEpoch + 1) * 86400 + firstDAYUnix;
        if (
            block.timestamp >= startEpochTime &&
            ifEverydayRewardClaimed[currentEpoch + 1] == address(0)
        ) {
            uint256 days_gapped = (block.timestamp - startEpochTime) /
                86400 +
                1;
            for (uint i = 0; i < days_gapped; i++) {
                ifEverydayRewardClaimed[currentEpoch + 1] = claimer;
                _snapshot();
            }
            return true;
        } else {
            return false;
        }
    }

    function tryUpdatePool(
        uint256 validatorId
    ) public onlyRole(AUTHORIZED_CALLER) {
        uint256 lastUpdate = lastPoolUpdated[validatorId];

        if (currentEpoch > 0 && lastUpdate <= currentEpoch - 1) {
            for (uint i = lastUpdate; i < currentEpoch; i++) {
                updatePool(validatorId, i);
            }
        }
    }

    function safeMint(
        address to,
        uint256 validatorId,
        uint256 amount
    ) internal {
        uint256 tokenId = tokenIdCounter.current();
        require(!_exists(tokenId), "Error!");
        _updateRewards(tokenId, validatorId);

        validatorIdMapping[tokenId] = validatorId;
        poolSize[validatorId] += 1;
        stakedTime[tokenId] = block.timestamp;
        tokenBalance[tokenId] = amount;
        poolBalance[validatorId] += amount;
        totalKAT += amount;
        tokenIdCounter.increment();

        _safeMint(to, tokenId);
        emit TokenStaked(to, validatorId, tokenId, amount);
    }

    function getCurrentKATReward(uint256 epoch) public pure returns (uint256) {
        return ((1000 - 2 * epoch) * startingReward) / 1000;
    }

    function stake(
        uint256 amount,
        uint256 validatorId
    ) public nonReentrant whenNotPaused {
        require(validatorId != 0, "Pool 0 is open for staking");
        require(amount > 0, "Stake Amount Must Exceed 0");
        SafeERC20.safeTransferFrom(_asset, msg.sender, address(this), amount);
        safeMint(msg.sender, validatorId, amount);
    }

    function unstake(
        uint256 tokenId,
        uint256 validatorId
    ) public whenNotPaused {
        require(ownerOf(tokenId) == msg.sender, "not the owner");
        require(
            stakedTime[tokenId] + 86400 <= block.timestamp,
            "You need to Stake At Least 24 hours"
        );
        _updateRewards(tokenId, validatorId);
        uint256 amount = tokenBalance[tokenId];

        _burn(tokenId);
        delete validatorIdMapping[tokenId];
        poolSize[validatorId] -= 1;
        tokenBalance[tokenId] = 0;
        totalKAT -= amount;
        poolBalance[validatorId] -= amount;
        SafeERC20.safeTransfer(_asset, msg.sender, amount);

        emit TokenUnstaked(msg.sender, validatorId, tokenId, amount);
    }

    //Functions of Rewards
    function getClaimerRewardbyEpoch(
        address claimer,
        uint256 epoch
    ) public view returns (uint256) {
        require(epoch < currentEpoch, "Not Valid Date");
        require(totalKaratReward[epoch] != 0, "Not Valid");

        return
            (claimerReward[claimer][epoch] * getCurrentKATReward(epoch)) /
            totalKaratReward[epoch];
    }

    function updatePool(
        uint256 validatorId,
        uint256 epoch
    ) public onlyRole(AUTHORIZED_CALLER) {
        require(epoch < currentEpoch, "This Epoch is not Valid");
        require(currentEpoch >= 1, "Must Calculate After first Day");
        require(!isValidatorClaimed[validatorId][epoch], "Rewards Calculated");

        if (validatorReward[validatorId][epoch] != 0) {
            isValidatorClaimed[validatorId][epoch] = true;
            validatorEarns[validatorId] +=
                (validatorReward[validatorId][epoch] *
                    getCurrentKATReward(epoch)) /
                totalKaratReward[epoch];

            //Update Pool Reward For Stakers
            _updateRewardIndex(
                validatorId,
                ((stakerReward[validatorId][epoch] *
                    getCurrentKATReward(epoch)) / totalKaratReward[epoch])
            );
        }

        require(
            epoch >= lastPoolUpdated[validatorId],
            "Cannot Update Before Days"
        );
        lastPoolUpdated[validatorId] = epoch + 1;
    }

    function getClaimValidatorReward(
        uint256 validatorId
    ) public view onlyRole(AUTHORIZED_CALLER) returns (uint256) {
        return validatorEarns[validatorId];
    }

    function getLieutenantRewardbyEpoch(
        address lieutenantAddr,
        uint256 epoch
    ) public view returns (uint256) {
        require(epoch < currentEpoch, "Not Valid Date");

        if (totalKaratReward[epoch] != 0) {
            return
                (lieutenantReward[lieutenantAddr][epoch] *
                    getCurrentKATReward(epoch)) / totalKaratReward[epoch];
        } else {
            return 0;
        }
    }

    function _updateRewardIndex(uint256 validatorId, uint256 reward) internal {
        if (poolBalance[validatorId] != 0) {
            rewardIndex[validatorId] += reward / poolBalance[validatorId];
        }
    }

    function _calculateRewards(
        uint256 stakerTokenId,
        uint256 validatorId
    ) private view returns (uint256) {
        uint shares = tokenBalance[stakerTokenId];
        return
            (shares *
                (rewardIndex[validatorId] -
                    rewardIndexOf[validatorId][stakerTokenId])) / MULTIPLIER;
    }

    function calculateRewardsEarned(
        uint256 stakerTokenId,
        uint256 validatorId
    ) external view returns (uint256) {
        return
            earned[validatorId][stakerTokenId] +
            _calculateRewards(stakerTokenId, validatorId);
    }

    function _updateRewards(
        uint256 stakerTokenId,
        uint256 validatorId
    ) private {
        earned[validatorId][stakerTokenId] += _calculateRewards(
            stakerTokenId,
            validatorId
        );
        rewardIndexOf[validatorId][stakerTokenId] = rewardIndex[validatorId];
    }

    function calStaker(
        uint256 stakerTokenId,
        uint256 validatorId
    ) public returns (uint256) {
        _updateRewards(stakerTokenId, validatorId);
        uint256 reward = earned[validatorId][stakerTokenId];
        if (reward > 0) {
            earned[validatorId][stakerTokenId] = 0;
        }
        return reward;
    }

    //Core Function of Updating Rewards when a claimer enter this system
    function updateClaimerReward(
        uint256 validatorId,
        address claimerAddress,
        address lieutenantAddr,
        uint256 karatScore
    ) public onlyRole(AUTHORIZED_CALLER) {
        uint256 claimerR = (karatScore * 2) / 3;
        claimerReward[claimerAddress][currentEpoch] = claimerR;

        uint256 poolWeightReward = 0;
        if (totalKAT != 0) {
            poolWeightReward =
                ((karatScore / 3) * poolBalance[validatorId]) /
                totalKAT;
        }
        uint256 poolReward = poolWeightReward + karatScore / 3;

        totalKaratReward[currentEpoch] =
            totalKaratReward[currentEpoch] +
            poolWeightReward +
            karatScore;
        uint256 tovalidatorReward;
        uint256 toStakerReward;
        uint256 toLieutenReward = 0;

        if (poolSize[validatorId] != 0) {
            tovalidatorReward = poolReward / 2;
            toStakerReward = poolReward / 2;
        } else {
            tovalidatorReward = poolReward;
            toStakerReward = 0;
        }

        stakerReward[validatorId][currentEpoch] += toStakerReward;
        if (lieutenantAddr != address(0)) {
            toLieutenReward = (tovalidatorReward * 20) / 100;
            tovalidatorReward -= toLieutenReward;
            lieutenantReward[lieutenantAddr][currentEpoch] += toLieutenReward;
        }
        validatorReward[validatorId][currentEpoch] += tovalidatorReward;
    }

    // Function to pause all token minting, accessible only by admin
    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    // Function to unpause all token minting, accessible only by admin
    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(
            ERC721Upgradeable,
            ERC721EnumerableUpgradeable,
            ERC721URIStorageUpgradeable,
            AccessControlUpgradeable
        )
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function testv2() public pure returns (bool) {
        return true;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _burn(
        uint256 tokenId
    ) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {
        super._burn(tokenId);
    }

    function _authorizeUpgrade(
        address
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
