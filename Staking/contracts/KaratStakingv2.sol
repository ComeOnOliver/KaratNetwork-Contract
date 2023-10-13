// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

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
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @custom:security-contact haorans@karatdao.com
contract StakedKaratPoolToken is
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
        address indexed staker,
        uint256 valiadtorId,
        uint256 stakerTokenId,
        uint256 indexed amount,
        uint256 indexed currentEpoch
    );
    event TokenUnstaked(
        address indexed staker,
        uint256 valiadtorId,
        uint256 stakerTokenId,
        uint256 indexed amount,
        uint256 indexed currentEpoch
    );
    event SnapShotTaken(uint256 epoch);
    event MinimumTokenToStakeUpdated(uint256 indexed amount);
    event ClaimerMinted(
        address indexed claimer,
        uint256 validatorId,
        address lieutenantAddr,
        uint256 currentEpoch,
        uint256 claimerKaratScore,
        uint256 lieutenantKaratScore
    );
    event poolRewardUpdate(
        uint256 validatorId,
        uint256 epoch,
        uint256 indexed reward,
        uint256 poolBalance
    );
    event MinDaysToUnstakeUpdated(uint256 minDaysToUnstake);

    uint256 public currentEpoch;
    uint256 public firstDAYUnix;
    uint256 public minimumToStake;
    uint256 public dayLength;
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
    mapping(uint256 => uint256) public rewardIndex;
    //ValidatorId -> tokenId -> rewardIndex
    mapping(uint256 => mapping(uint256 => uint256)) public rewardIndexOf;
    //ValidatorId -> tokenId -> earned
    mapping(uint256 => mapping(uint256 => uint256)) public earned;

    mapping(uint256 => address) public ifEverydayRewardClaimed;
    mapping(uint256 => mapping(uint256 => bool)) public isValidatorClaimed;
    mapping(uint256 => uint256) validatorEarns;

    mapping(uint256 => uint256) public poolSize;
    mapping(uint256 => uint256) public stakedTime;
    mapping(uint256 => uint256) public validatorIdMapping;

    bytes32 public constant AUTHORIZED_CALLER = keccak256("AUTHORIZED_CALLER");
    uint256 private constant INDEX_MULTIPLIER = 1e18;

    IERC20 public asset;
    CountersUpgradeable.Counter public tokenIdCounter;

    uint256 private constant COEF_MULTIPLIER = 1e10;
    uint256 private constant COEF_TRIPLE_MULTIPLIER = 1e30;

    uint256 public minDaysToUnstake;

    //0911 update: T+2 stake reward calculation
    mapping(uint256 => uint256) public latestStakerRewardIndex;
    mapping(uint256 => mapping(uint256 => uint256))
        public newPoolBalanceAtEpoch;
    mapping(uint256 => mapping(uint256 => uint256)) public rewardIndexAtEpoch;

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
        minimumToStake = 1;
        minDaysToUnstake = 2;
        asset = asset_;
        firstDAYUnix = firstdayUnixTime;
        dayLength = 86400;
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

    function updateDayLength(
        uint256 newLength
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        dayLength = newLength;
    }

    function getCurrentSnapshotId() public view virtual returns (uint256) {
        return currentEpoch;
    }

    function tryUpdateSnapshot(
        address claimer
    ) external onlyRole(AUTHORIZED_CALLER) returns (bool) {
        require(claimer != address(0), "Not Valid Address");

        uint256 startEpochTime = (currentEpoch + 1) * dayLength + firstDAYUnix;
        if (
            block.timestamp >= startEpochTime &&
            ifEverydayRewardClaimed[currentEpoch + 1] == address(0)
        ) {
            uint256 days_gapped = (block.timestamp - startEpochTime) /
                dayLength +
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

    function tryUpdatePool(uint256 validatorId) public {
        _updatePool(validatorId);
    }

    function getEpochByTimestamp(
        uint256 blockTime
    ) public view returns (uint256) {
        require(blockTime > firstDAYUnix, "invalid block time");
        return (blockTime - firstDAYUnix) / 86400;
    }

    function safeMint(
        address to,
        uint256 validatorId,
        uint256 amount
    ) internal {
        uint256 tokenId = tokenIdCounter.current();
        require(!_exists(tokenId), "Error!");
        //TODO: Evaluate if we can remove this
        _updateRewards(tokenId, validatorId);

        uint256 realEpoch = getEpochByTimestamp(block.timestamp);
        validatorIdMapping[tokenId] = validatorId;
        poolSize[validatorId] = poolSize[validatorId] + 1;
        stakedTime[tokenId] = block.timestamp;
        tokenBalance[tokenId] = amount;
        poolBalance[validatorId] = poolBalance[validatorId] + amount;
        newPoolBalanceAtEpoch[validatorId][realEpoch] =
            newPoolBalanceAtEpoch[validatorId][realEpoch] +
            amount;
        totalKAT = totalKAT + amount;
        tokenIdCounter.increment();

        latestStakerRewardIndex[tokenId] = realEpoch;
        _safeMint(to, tokenId);
        emit TokenStaked(to, validatorId, tokenId, amount, realEpoch);
    }

    function getCurrentKATReward(uint256 epoch) public pure returns (uint256) {
        return 750000 * INDEX_MULTIPLIER;
    }

    function stake(
        uint256 amount,
        uint256 validatorId
    ) public nonReentrant whenNotPaused {
        require(amount >= minimumToStake, "Stake Amount Must Exceed Minimum");
        _updatePool(validatorId);
        SafeERC20.safeTransferFrom(asset, msg.sender, address(this), amount);
        safeMint(msg.sender, validatorId, amount);
    }

    function stakeTo(
        address recipient,
        uint256 amount,
        uint256 validatorId
    ) public nonReentrant whenNotPaused {
        require(recipient != address(0), "Not Valid Address");
        require(amount >= minimumToStake, "Stake Amount Must Exceed Minimum");
        _updatePool(validatorId);
        SafeERC20.safeTransferFrom(asset, msg.sender, address(this), amount);
        safeMint(recipient, validatorId, amount);
    }

    function unstake(uint256 tokenId) public whenNotPaused {
        uint256 validatorId = validatorIdMapping[tokenId];
        require(ownerOf(tokenId) == msg.sender, "not the owner");
        require(
            stakedTime[tokenId] + dayLength * minDaysToUnstake <=
                block.timestamp,
            "Staking Duration Too Short"
        );
        _updatePool(validatorId);
        require(
            _calculateRewards(
                tokenId,
                validatorId,
                getT2RewardIndex(tokenId),
                rewardIndex[validatorId]
            ) == 0,
            "Please Claim Reward First!"
        );
        _updateRewards(tokenId, validatorId);
        uint256 amount = tokenBalance[tokenId];

        _burn(tokenId);
        delete validatorIdMapping[tokenId];
        poolSize[validatorId] = poolSize[validatorId] - 1;
        tokenBalance[tokenId] = 0;
        totalKAT = totalKAT - amount;
        poolBalance[validatorId] = poolBalance[validatorId] - amount;
        uint256 burnedAmount = (amount * 5) / 100;
        ERC20Burnable(address(asset)).burn(burnedAmount);
        SafeERC20.safeTransfer(asset, msg.sender, amount - burnedAmount);
        emit TokenUnstaked(
            msg.sender,
            validatorId,
            tokenId,
            amount,
            currentEpoch
        );
    }

    function unstakeBatch(uint256[] calldata tokenIds) public {
        require(tokenIds.length <= 10, "Exceed Max Length Requirement");
        for (uint i = 0; i < tokenIds.length; i++) {
            unstake(tokenIds[i]);
        }
    }

    function _verifyUpdatePool(
        uint256 validatorId,
        uint256 epoch
    ) internal view {
        require(epoch < currentEpoch, "This Epoch is not Valid");
        require(currentEpoch >= 1, "Must Calculate After first Day");
        require(!isValidatorClaimed[validatorId][epoch], "Rewards Calculated");
    }

    function _updatePool(uint256 validatorId) internal {
        uint256 lastUpdate = lastPoolUpdated[validatorId];
        for (uint epoch = lastUpdate; epoch < currentEpoch; epoch++) {
            _verifyUpdatePool(validatorId, epoch);
            require(epoch == lastPoolUpdated[validatorId], "invalid epoch");

            if (validatorReward[validatorId][epoch] != 0) {
                (
                    uint256 validatorEarnsToUpdate,
                    uint256 stakerRewardToUpdate,
                    uint256 stakerIndexToUpdate
                ) = _getUpdatePoolInfo(validatorId, epoch);

                _executeUpdatePool(
                    validatorId,
                    epoch,
                    validatorEarnsToUpdate,
                    stakerRewardToUpdate,
                    stakerIndexToUpdate
                );
            }

            rewardIndexAtEpoch[validatorId][epoch + 1] = rewardIndex[
                validatorId
            ];
            lastPoolUpdated[validatorId] = epoch + 1;
        }
    }

    function setPoolRewardIndex(
        uint256 validatorId,
        uint256 epoch
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        rewardIndexAtEpoch[validatorId][epoch] = rewardIndex[validatorId];
    }

    function _updatePoolReadOnly(
        uint256 validatorId
    ) internal view returns (uint256, uint256) {
        uint256 lastUpdate = lastPoolUpdated[validatorId];
        uint256 updatedValidatorEarns = validatorEarns[validatorId];
        uint256 updatedRewardIndex = rewardIndex[validatorId];
        for (uint epoch = lastUpdate; epoch < currentEpoch; epoch++) {
            _verifyUpdatePool(validatorId, epoch);

            if (validatorReward[validatorId][epoch] != 0) {
                (
                    uint256 validatorEarnsToUpdate,
                    ,
                    uint256 stakerIndexToUpdate
                ) = _getUpdatePoolInfo(validatorId, epoch);
                updatedValidatorEarns += validatorEarnsToUpdate;
                updatedRewardIndex += stakerIndexToUpdate;
            }
        }
        return (updatedValidatorEarns, updatedRewardIndex);
    }

    function _getUpdatePoolInfo(
        uint256 validatorId,
        uint256 epoch
    ) internal view returns (uint256, uint256, uint256) {
        uint256 validatorEarnsToUpdate = (validatorReward[validatorId][epoch] *
            getCurrentKATReward(epoch)) / totalKaratReward[epoch];

        if (getBalanceDelta(validatorId, epoch) == 0)
            return (validatorEarnsToUpdate, 0, 0);

        uint256 stakerRewardToUpdate = ((stakerReward[validatorId][epoch] *
            getCurrentKATReward(epoch)) / totalKaratReward[epoch]);

        uint256 stakerIndexToUpdate = (stakerRewardToUpdate *
            INDEX_MULTIPLIER) / getBalanceDelta(validatorId, epoch);

        return (
            validatorEarnsToUpdate,
            stakerRewardToUpdate,
            stakerIndexToUpdate
        );
    }

    function _executeUpdatePool(
        uint256 validatorId,
        uint256 epoch,
        uint256 validatorEarnsToUpdate,
        uint256 stakerRewardToUpdate,
        uint256 stakerIndexToUpdate
    ) internal {
        validatorEarns[validatorId] =
            validatorEarns[validatorId] +
            validatorEarnsToUpdate;

        rewardIndex[validatorId] =
            rewardIndex[validatorId] +
            stakerIndexToUpdate;

        isValidatorClaimed[validatorId][epoch] = true;
        emit poolRewardUpdate(
            validatorId,
            epoch,
            stakerRewardToUpdate,
            getBalanceDelta(validatorId, epoch)
        );
    }

    function getBalanceDelta(
        uint256 validatorId,
        uint256 epoch
    ) public view returns (uint256) {
        return
            poolBalance[validatorId] -
            newPoolBalanceAtEpoch[validatorId][epoch];
    }

    function getT2RewardIndex(
        uint256 stakerTokenId
    ) public view returns (uint256) {
        uint256 validatorId = validatorIdMapping[stakerTokenId];
        uint256 stakeEpoch = latestStakerRewardIndex[stakerTokenId];
        require(lastPoolUpdated[validatorId] >= stakeEpoch, "Not Valid Time");
        //Stakers who join the staking before, return the previous reward info
        if (stakeEpoch == 0) {
            return rewardIndexOf[validatorId][stakerTokenId];
        }

        if (lastPoolUpdated[validatorId] == stakeEpoch) {
            return rewardIndex[validatorId];
        } else {
            return rewardIndexAtEpoch[validatorId][stakeEpoch + 1];
        }
    }

    function calAndClearStaker(
        uint256 stakerTokenId
    ) external onlyRole(AUTHORIZED_CALLER) returns (uint256) {
        uint256 validatorId = validatorIdMapping[stakerTokenId];
        _updatePool(validatorId);
        _updateRewards(stakerTokenId, validatorId);
        uint256 reward = earned[validatorId][stakerTokenId] / INDEX_MULTIPLIER;
        if (reward > 0) {
            earned[validatorId][stakerTokenId] = 0;
        }
        return reward;
    }

    function _updateRewards(
        uint256 stakerTokenId,
        uint256 validatorId
    ) private {
        earned[validatorId][stakerTokenId] = _calculateRewards(
            stakerTokenId,
            validatorId,
            getT2RewardIndex(stakerTokenId),
            rewardIndex[validatorId]
        );
        //Previous staker will still able to have update of rewards
        rewardIndexOf[validatorId][stakerTokenId] = rewardIndex[validatorId];
        if (currentEpoch > 0) {
            latestStakerRewardIndex[stakerTokenId] = currentEpoch - 1;
        }
    }

    function _calculateRewards(
        uint256 stakerTokenId,
        uint256 validatorId,
        uint256 preIndex,
        uint256 curIndex
    ) private view returns (uint256) {
        uint shares = tokenBalance[stakerTokenId];
        return
            earned[validatorId][stakerTokenId] + shares * (curIndex - preIndex);
    }

    function calculateRewardsEarned(
        uint256 stakerTokenId
    ) public view returns (uint256) {
        require(_exists(stakerTokenId), "TokenId Not Exist");

        uint256 validatorId = validatorIdMapping[stakerTokenId];
        uint256 stakeEpochIndex = latestStakerRewardIndex[stakerTokenId];
        if (lastPoolUpdated[validatorId] <= stakeEpochIndex) {
            return 0;
        }

        (, uint256 updatedRewardIndex) = _updatePoolReadOnly(validatorId);
        return
            _calculateRewards(
                stakerTokenId,
                validatorId,
                getT2RewardIndex(stakerTokenId),
                updatedRewardIndex
            ) / INDEX_MULTIPLIER;
    }

    function calculateRewardsEarnedBatch(
        uint256[] calldata stakerTokenIds
    ) public view returns (uint256[] memory) {
        require(stakerTokenIds.length <= 10, "Exceed Max Length Requirement");
        uint256[] memory rewards = new uint256[](stakerTokenIds.length);
        for (uint i = 0; i < stakerTokenIds.length; i++) {
            rewards[i] = calculateRewardsEarned(stakerTokenIds[i]);
        }
        return rewards;
    }

    //Core Function of Updating Rewards when a claimer enter this system
    function updateClaimerReward(
        uint256 validatorId,
        address claimerAddress,
        address lieutenantAddr,
        uint256 karatScore
    ) public onlyRole(AUTHORIZED_CALLER) {
        require(claimerAddress != address(0), "Not Valid Address");
        uint256 claimerR = (karatScore * 2) / 3;
        //Round up reward for 1 score claimer
        if (claimerR == 0) {
            claimerR = 1;
        }
        claimerReward[claimerAddress][currentEpoch] = claimerR;

        uint256 poolReward = karatScore - claimerR;
        if (totalKAT != 0) {
            uint256 baseCoef = COEF_MULTIPLIER +
                (getBalanceDelta(validatorId, currentEpoch) * COEF_MULTIPLIER) /
                totalKAT;
            uint256 coef = baseCoef * baseCoef * baseCoef;

            poolReward = (poolReward * coef) / COEF_TRIPLE_MULTIPLIER;
        }

        totalKaratReward[currentEpoch] =
            totalKaratReward[currentEpoch] +
            claimerR +
            poolReward;

        uint256 tovalidatorReward;
        uint256 toStakerReward;
        uint256 toLieutenReward = 0;

        if (getBalanceDelta(validatorId, currentEpoch) != 0) {
            tovalidatorReward = (poolReward * 2) / 10;
            toStakerReward = poolReward - tovalidatorReward;
        } else {
            tovalidatorReward = poolReward;
            toStakerReward = 0;
        }

        stakerReward[validatorId][currentEpoch] += toStakerReward;
        if (lieutenantAddr != address(0)) {
            toLieutenReward = (tovalidatorReward * 20) / 100;
            tovalidatorReward = tovalidatorReward - toLieutenReward;
            lieutenantReward[lieutenantAddr][currentEpoch] =
                lieutenantReward[lieutenantAddr][currentEpoch] +
                toLieutenReward;
        }
        validatorReward[validatorId][currentEpoch] += tovalidatorReward;
        emit ClaimerMinted(
            claimerAddress,
            validatorId,
            lieutenantAddr,
            currentEpoch,
            karatScore,
            toLieutenReward
        );
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

    function getClaimValidatorReward(
        uint256 validatorId
    ) public view returns (uint256) {
        (uint256 updatedValidatorEarns, ) = _updatePoolReadOnly(validatorId);
        return updatedValidatorEarns;
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

    function setMinimumToStake(
        uint256 minimumToStake_
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        minimumToStake = minimumToStake_;
    }

    function setMinDaysToUnstake(
        uint256 minDaysToUnstake_
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        minDaysToUnstake = minDaysToUnstake_;
        emit MinDaysToUnstakeUpdated(minDaysToUnstake);
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

    //Deprecated
    function _updateRewardIndexDeprecated(
        uint256 validatorId,
        uint256 reward
    ) internal {
        if (getBalanceDelta(validatorId, currentEpoch) != 0) {
            rewardIndex[validatorId] +=
                (reward * INDEX_MULTIPLIER) /
                getBalanceDelta(validatorId, currentEpoch);
        }
    }

    //Deprecated
    function calculateRewardsEarnedDeprecated(
        uint256 stakerTokenId
    ) public view returns (uint256) {
        require(_exists(stakerTokenId), "TokenId Not Exist");
        uint256 validatorId = validatorIdMapping[stakerTokenId];
        return
            earned[validatorId][stakerTokenId] +
            _calculateRewardsDeprecated(stakerTokenId, validatorId);
    }

    //Deprecated
    function _calculateRewardsDeprecated(
        uint256 stakerTokenId,
        uint256 validatorId
    ) private view returns (uint256) {
        uint shares = tokenBalance[stakerTokenId];
        return
            shares *
            (rewardIndex[validatorId] -
                rewardIndexOf[validatorId][stakerTokenId]);
    }

    //Deprecated
    function calculateRewardsEarnedBatchDeprecated(
        uint256[] calldata stakerTokenIds
    ) public view returns (uint256[] memory) {
        require(stakerTokenIds.length <= 10, "Exceed Max Length Requirement");

        uint256[] memory foo = new uint256[](stakerTokenIds.length);
        for (uint i = 0; i < stakerTokenIds.length; i++) {
            foo[i] = calculateRewardsEarnedDeprecated(stakerTokenIds[i]);
        }
        return foo;
    }

    //Deprecated
    function getClaimValidatorRewardDeprecated(
        uint256 validatorId
    ) public view returns (uint256) {
        return validatorEarns[validatorId];
    }
}
