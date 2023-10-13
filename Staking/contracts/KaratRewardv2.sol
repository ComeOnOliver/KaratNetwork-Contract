// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol"; // UUPS upgradable contract
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol"; // Functionality for initialization in place of constructors
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol"; // Utility to allow pausing of certain functionality

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";


interface IStakingContract {
    function getClaimerRewardbyEpoch(
        address claimer,
        uint256 epoch
    ) external view returns (uint256);

    function getClaimValidatorReward(
        uint256 validatorId
    ) external view returns (uint256);

    function getLieutenantRewardbyEpoch(
        address lieutenantAddr,
        uint256 epoch
    ) external view returns (uint256);

    function calAndClearStaker(
        uint256 stakerTokenId
    ) external returns (uint256);

    function tryUpdatePool(uint256 validatorId) external;

    function ownerOf(uint256 tokenId) external returns (address);
}

interface IValidatorContract {
    function ownerOf(uint256 validatorId) external view returns (address);
}

/// @custom:security-contact haorans@karatdao.com
contract RewardDistributor is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable
{
    event RewardClaimerClaimed(address indexed claimer, uint256 indexed amount, uint256 epoch);
    event RewardValidatorClaimed(uint256 validatorId, uint256 indexed amount);
    event RewardLieutenantClaimed(address indexed lieutenantAddr, uint256 indexed amount);
    event RewardStakerClaimed(address indexed staker, uint256 indexed amount);
    event LockUpdate(bool newState);
    event LockValidatorUpdate(bool newState);
    event LieutenantRewardUpdate(address indexed lieutenant, uint256 epoch, uint256 amount);
    event TokenWithdrawnByAdmin(address indexed to, uint256 amount);

    IERC20 public _asset;
    IStakingContract public _staking;
    IValidatorContract public _validator;

    mapping(address => uint256) public claimerClaimedAmount;
    mapping(address => mapping(uint256 => bool)) public isLieutenantClaimed;
    mapping(uint256 => uint256) public validatorRewardsClaimed;

    //Starting with 5M KAT Token
    uint256 public constant MULTIPLIER = 1e18;
    bool public ifLocked;
    bool public ifLockedValidator;


    function initialize(
        IERC20 katToken_,
        IStakingContract staking_,
        IValidatorContract validator_
    ) public initializer {
        __AccessControl_init();
        __Pausable_init();

        _asset = katToken_;
        _staking = staking_;
        _validator = validator_;
        ifLocked = true;
        ifLockedValidator = true;
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function updateIfLocked(bool newState) public onlyRole(DEFAULT_ADMIN_ROLE) {
        ifLocked = newState;
        emit LockUpdate(newState);
    }

    function updateIfLockedValidator(bool newState) public onlyRole(DEFAULT_ADMIN_ROLE) {
        ifLockedValidator = newState;
        emit LockValidatorUpdate(newState);
    }

    function _claimAndBurn(address to, uint256 amount) internal {
        uint256 burnAmount = (amount * 5) / 100;
        uint256 realAmount = amount - burnAmount;

        ERC20Burnable(address(_asset)).burn(burnAmount);
        SafeERC20.safeTransfer(_asset, to, realAmount);
    }

    function claimClaimer(uint256 epoch) external whenNotPaused {

        uint256 totalClaimableAmount = _staking.getClaimerRewardbyEpoch(msg.sender, epoch);
        uint256 firstClaimableAmount = totalClaimableAmount * 5 / 100;

        require(
            totalClaimableAmount > 0 && firstClaimableAmount > 0,
            "No Reward to Claim"
        );
        require(
            claimerClaimedAmount[msg.sender] < totalClaimableAmount,
            "Already Claimed"
        );

        uint256 reward = 0;
        if (ifLocked) {
            require(claimerClaimedAmount[msg.sender] < firstClaimableAmount, "Already Claimed First Stage");
            reward = firstClaimableAmount;
        } else {
            reward = totalClaimableAmount - claimerClaimedAmount[msg.sender];
        }
        claimerClaimedAmount[msg.sender] = claimerClaimedAmount[msg.sender] + reward;

        _claimAndBurn(msg.sender, reward);
        emit RewardClaimerClaimed(msg.sender, reward, epoch);
    }

    function claimValidator(uint256 validatorId) public whenNotPaused {
        require(
            _validator.ownerOf(validatorId) == msg.sender,
            "Not the Token Owner"
        );
        _staking.tryUpdatePool(validatorId);
        uint256 totalReward = _staking.getClaimValidatorReward(validatorId);

        uint256 LockPortion = 1;
        if(ifLockedValidator) {
            LockPortion = 2;
        }
        uint256 availableToClaim = totalReward / LockPortion;
        require(validatorRewardsClaimed[validatorId] <= availableToClaim, "The Rest is not Available");
        uint256 unclaimed = availableToClaim - validatorRewardsClaimed[validatorId];
        require(unclaimed>0,"Unclaimed amount is 0");

        validatorRewardsClaimed[validatorId] = validatorRewardsClaimed[validatorId] + unclaimed;
        _claimAndBurn(msg.sender, unclaimed);

        emit RewardValidatorClaimed(validatorId, unclaimed);
    }

    function claimValidatorBatch(uint256[] calldata validatorIds) public {
        require(validatorIds.length <= 10, "Exceed Max Length Requirement");
        for (uint i = 0; i < validatorIds.length; i++) {
            claimValidator(validatorIds[i]);
        }
    }

    function getValidatorUnclaimed(
        uint256 validatorId
    ) public view returns (uint256) {
        uint256 totalReward = _staking.getClaimValidatorReward(validatorId);
        uint256 unclaimed = totalReward - validatorRewardsClaimed[validatorId];

        return unclaimed;
    }

    function getClaimableValidatorReward(
        uint256 validatorId
    ) public view returns (uint256) {
        uint256 availableToClaim = _staking.getClaimValidatorReward(validatorId);
        if (ifLockedValidator) {
            availableToClaim = availableToClaim / 2;
        }
        return availableToClaim - validatorRewardsClaimed[validatorId];
    }

    //Pull Over Push Strategy to send out Lieutenant Reward
    function claimLieutenant(
        uint256[] calldata epochs,
        uint256 from,
        uint256 to
    ) external whenNotPaused {

        uint256 startIdx;
        uint256 endIdx;

        if (from == to && from == 0) {
            require(epochs.length <= 10, "10 Epochs MAX");
            startIdx = 0;
            endIdx = epochs.length;
        } else {
            require(from < to && to - from <= 10, "NOT Valid");
            startIdx = from;
            endIdx = to;
        }

        uint256 totalRewards = 0;
        for (uint i = startIdx; i < endIdx; i++) {
            uint256 epoch = (from == to && from == 0) ? epochs[i] : i;

            require(
                !isLieutenantClaimed[msg.sender][epoch],
                "Rewards Calculated"
            );

            isLieutenantClaimed[msg.sender][epoch] = true;
            uint256 lieutenantRewardbyEpoch = _staking.getLieutenantRewardbyEpoch(
                msg.sender,
                epoch
            );
            totalRewards = totalRewards + lieutenantRewardbyEpoch;

            emit LieutenantRewardUpdate(msg.sender, epoch, lieutenantRewardbyEpoch);
        }
        require(totalRewards > 0, "Nothing to Claim");

        _claimAndBurn(msg.sender, totalRewards);
        emit RewardLieutenantClaimed(msg.sender, totalRewards);
    }

    function claimStaker(
        uint256 stakerTokenId
    ) public whenNotPaused {
        require(
            _staking.ownerOf(stakerTokenId) == msg.sender,
            "Not Owner of this Token"
        );
        uint256 reward = _staking.calAndClearStaker(stakerTokenId);
        require(reward > 0, "No Reward to Claim");

        _claimAndBurn(msg.sender, reward);

        emit RewardStakerClaimed(msg.sender, reward);
    }

    function claimStakerBatch(uint256[] calldata stakerTokenIds) public {
        require(stakerTokenIds.length <= 10, "Exceed Max Length Requirement");
        for (uint i = 0; i < stakerTokenIds.length; i++) {
            claimStaker(stakerTokenIds[i]);
        }
    }

    function withdrawToken(
        address to,
        uint256 amount
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        SafeERC20.safeTransfer(_asset, to, amount);

        emit TokenWithdrawnByAdmin(to, amount);
    }

    // Function to pause all token minting, accessible only by admin
    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    // Function to unpause all token minting, accessible only by admin
    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(
        address
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
