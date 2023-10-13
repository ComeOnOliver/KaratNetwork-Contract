// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

// import "@openzeppelin/contracts/access/AccessControl.sol";
// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol"; // UUPS upgradable contract
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol"; // Functionality for initialization in place of constructors
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol"; // Utility to allow pausing of certain functionality

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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

    function calStaker(
        uint256 stakerTokenId,
        uint256 validatorId
    ) external returns (uint256);

    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IValidatorContract {
    function ownerOf(uint256 validatorId) external view returns (address);
}

/// @custom:security-contact haorans@karatdao.com
contract RewardDistributorv2 is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable
{
    event RewardClaimerClaimed(address claimer, uint256 amount, uint256 epoch);
    event RewardValidatorClaimed(uint256 validatorId, uint256 amount);
    event RewardLieutenantClaimed(address lieutenantAddr, uint256 amount);
    event RewardStakerClaimed(address staker, uint256 amount);

    IERC20 private _asset;
    IStakingContract private _staking;
    IValidatorContract private _validator;
    bytes32 public constant REWARD_DISTRIBUTOR_ROLE =
        keccak256("REWARD_DISTRIBUTOR");

    mapping(address => mapping(uint256 => bool)) isClaimerClaimed;
    mapping(address => mapping(uint256 => bool)) isLieutenantClaimed;
    mapping(uint256 => uint256) validatorRewardsClaimed;

    //Starting with 5M KAT Token
    uint256 private constant MULTIPLIER = 1e18;
    uint256 public constant startingReward = 5000000 * MULTIPLIER;

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

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(REWARD_DISTRIBUTOR_ROLE, _msgSender());
    }

    // constructor(
    //     IERC20 katToken_,
    //     IStakingContract staking_,
    //     IValidatorContract validator_
    // ) {
    //     _asset = katToken_;
    //     _staking = staking_;
    //     _validator = validator_;
    //     _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

    //     _grantRole(REWARD_DISTRIBUTOR_ROLE, msg.sender);
    // }

    function getCurrentKATReward(uint256 epoch) public pure returns (uint256) {
        return ((1000 - 2 * epoch) * startingReward) / 1000;
    }

    function claimClaimer(uint256 epoch) public whenNotPaused {
        isClaimerClaimed[msg.sender][epoch] = true;
        uint256 reward = _staking.getClaimerRewardbyEpoch(msg.sender, epoch);

        SafeERC20.safeTransfer(_asset, msg.sender, reward);

        emit RewardClaimerClaimed(msg.sender, reward, epoch);
    }

    function claimValidator(uint256 validatorId) public whenNotPaused {
        require(
            _validator.ownerOf(validatorId) == msg.sender,
            "Not the Token Owner"
        );

        uint256 totalReward = _staking.getClaimValidatorReward(validatorId);
        uint256 unclaimed = totalReward - validatorRewardsClaimed[validatorId];
        validatorRewardsClaimed[validatorId] = totalReward;

        SafeERC20.safeTransfer(_asset, msg.sender, unclaimed);
        emit RewardValidatorClaimed(validatorId, unclaimed);
    }

    function getValidatorUnclaimed(
        uint256 validatorId
    ) public view returns (uint256) {
        uint256 totalReward = _staking.getClaimValidatorReward(validatorId);
        uint256 unclaimed = totalReward - validatorRewardsClaimed[validatorId];

        return unclaimed;
    }

    function claimLieutenant(
        uint256[] calldata epochs,
        uint256 from,
        uint256 to
    ) public whenNotPaused {
        uint256 totalRewards;
        if (from == to && from == 0) {
            for (uint i = 0; i < epochs.length; i++) {
                require(
                    !isLieutenantClaimed[msg.sender][epochs[i]],
                    "Rewards Calculated"
                );

                isLieutenantClaimed[msg.sender][epochs[i]] = true;
                totalRewards += _staking.getLieutenantRewardbyEpoch(
                    msg.sender,
                    epochs[i]
                );
            }
        } else {
            require(from < to, "NOT Valid");
            for (uint i = from; i < to; i++) {
                require(
                    !isLieutenantClaimed[msg.sender][i],
                    "Rewards Calculated"
                );

                isLieutenantClaimed[msg.sender][i] = true;
                totalRewards += _staking.getLieutenantRewardbyEpoch(
                    msg.sender,
                    i
                );
            }
        }
        SafeERC20.safeTransfer(_asset, msg.sender, totalRewards);
        emit RewardLieutenantClaimed(msg.sender, totalRewards);
    }

    function claimStaker(
        uint256 stakerTokenId,
        uint256 validatorId
    ) public whenNotPaused {
        require(
            _staking.ownerOf(stakerTokenId) == msg.sender,
            "Not Owner of this Token"
        );
        uint256 reward = _staking.calStaker(stakerTokenId, validatorId) *
            MULTIPLIER;
        require(reward > 0, "No Reward to Claim");
        SafeERC20.safeTransfer(_asset, msg.sender, reward);
        emit RewardStakerClaimed(msg.sender, reward);
    }

    // Function to pause all token minting, accessible only by admin
    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    // Function to unpause all token minting, accessible only by admin
    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function testv2() public pure returns (bool) {
        return true;
    }

    function _authorizeUpgrade(
        address
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
