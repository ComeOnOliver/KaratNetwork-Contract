// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol"; // Functionality for initialization in place of constructors
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol"; // UUPS upgradable contract

import {IERC20, IERC20Metadata, ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IStakingContract {
    function getCurrentSnapshotId() external returns (uint256);

    function snapshot() external returns (uint256);

    function getlastPoolUpdate(uint256 validatorId) external returns (uint256);

    function tryUpdatePool(uint256 validatorId) external;

    function updateClaimerReward(
        uint256 validatorId,
        address claimerAddress,
        address lieutenantAddr,
        uint256 karatScore
    ) external;

    function tryUpdateSnapshot(address claimer) external returns (bool);
}

enum Role {
    Scientist,
    Engineer,
    Doctor,
    Security,
    Artist
}

interface IClaimerContract {
    function mintClaimer(
        address to,
        uint256 validatorTokenId,
        uint256 karatScore,
        address lieutenantAddr,
        Role role
    ) external;

    function mintClaimerwithSig(
        address to,
        uint256 validatorTokenId,
        uint256 karatScore,
        address lieutenantAddr,
        Role role,
        bytes calldata signature
    ) external;
}

interface IReward {
    function updateValidatorReward(
        uint256 validatorTokenId,
        uint256 epoch
    ) external;
}

contract ClaimerRelayer is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable
{
    event DailyRewardUpdated(uint256 indexed newAmount);
    event TokenWithdrawn(address indexed to, uint256 indexed amount);
    event DailyRewardDistributed(address indexed to, uint256 amount);

    IStakingContract private _staking;
    IClaimerContract private _claimer;
    IReward private _reward;

    uint256 public rewardAmount; // Assuming KAT has 18 decimals
    uint256 public costToMintETH;
    bytes32 public constant AUTHORIZED_CALLER = keccak256("AUTHORIZED_CALLER");

    mapping(uint256 => address) public ifEverydayRewardClaimed;
    mapping(uint256 => uint256) public costToMint; // 0 = KAT
    mapping(uint256 => IERC20) public supportedTokens; //0 = KAT

    function initialize(
        IERC20 _katTokenAddr,
        IStakingContract _stakingContractAddr,
        IClaimerContract _claimerAddr,
        IReward _rewardAddr
    ) public initializer {
        supportedTokens[0] = _katTokenAddr;
        _staking = _stakingContractAddr;
        _claimer = _claimerAddr;
        _reward = _rewardAddr;

        rewardAmount = 300 * 10 ** 18;
        costToMint[0] = 200 * 10 ** 18; //KAT: 18 Decimals
        costToMintETH = 33 * 10 ** 14; //Eth: Start with 0.0033 Eth, 5$
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function changeReward(
        uint256 newReward
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        rewardAmount = newReward;

        emit DailyRewardUpdated(newReward);
    }

    function withdrawERC20Token(
        uint256 tokenNumber,
        address to,
        uint256 amount
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            supportedTokens[tokenNumber] != IERC20(address(0)),
            "Invalid Token"
        );
        SafeERC20.safeTransfer(supportedTokens[tokenNumber], to, amount);
        emit TokenWithdrawn(to, amount);
    }

    function withdrawEther(
        address payable to,
        uint256 amount
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(amount > 0, "Cannot withdraw 0 amount");
        require(address(this).balance >= amount, "Insufficient balance");

        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");

        emit TokenWithdrawn(to, amount);
    }

    //0 = KAT
    function setSupportedTokenAndCostToMint(
        uint256 tokenNumber,
        uint256 feeAmount,
        address tokenAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tokenAddress != address(0), "Invalid Address");
        require(feeAmount > 0, "Invalid Fee");
        supportedTokens[tokenNumber] = IERC20(tokenAddress);
        costToMint[tokenNumber] = feeAmount;
    }

    function setEtherAndCostToMint(
        uint256 ethCost
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        costToMintETH = ethCost;
    }

    function mintClaimer(
        address to,
        uint256 validatorTokenId,
        uint256 karatScore,
        address lieutenantAddr,
        Role role
    ) external onlyRole(AUTHORIZED_CALLER) {
        require(to != address(0), "Not Valid Address");

        _claimer.mintClaimer(
            to,
            validatorTokenId,
            karatScore,
            lieutenantAddr,
            role
        );

        bool result = _staking.tryUpdateSnapshot(to);
        if (result) {
            //Transfer 300 KAT as Reward
            SafeERC20.safeTransfer(supportedTokens[0], to, rewardAmount);
            emit DailyRewardDistributed(to, rewardAmount);
        }
        _staking.tryUpdatePool(validatorTokenId);
        _staking.updateClaimerReward(
            validatorTokenId,
            to,
            lieutenantAddr,
            karatScore
        );
    }

    function mintClaimerWithSig(
        address to,
        uint256 validatorTokenId,
        uint256 karatScore,
        address lieutenantAddr,
        Role role,
        bytes calldata signature,
        uint256 erc20TokenId // 0 = KAT
    ) external payable {
        require(to != address(0), "Not Valid Address");

        if (msg.value == 0) {
            require(
                supportedTokens[erc20TokenId] != IERC20(address(0)),
                "Invalid Token"
            );
            require(costToMint[erc20TokenId] > 0, "Invalid Fee");

            SafeERC20.safeTransferFrom(
                supportedTokens[erc20TokenId],
                msg.sender,
                address(this),
                costToMint[erc20TokenId]
            );
        } else if (msg.value != 0) {
            require(msg.value == costToMintETH, "Incorrect ETH amount sent");
        }

        _mintClaimerWithSig(
            to,
            validatorTokenId,
            karatScore,
            lieutenantAddr,
            role,
            signature
        );
    }

    function _mintClaimerWithSig(
        address to,
        uint256 validatorTokenId,
        uint256 karatScore,
        address lieutenantAddr,
        Role role,
        bytes calldata signature
    ) private {
        _claimer.mintClaimerwithSig(
            to,
            validatorTokenId,
            karatScore,
            lieutenantAddr,
            role,
            signature
        );

        bool result = _staking.tryUpdateSnapshot(to);
        if (result) {
            //300 KAT Sent as Reward
            SafeERC20.safeTransfer(supportedTokens[0], to, rewardAmount);
            emit DailyRewardDistributed(to, rewardAmount);
        }
        _staking.tryUpdatePool(validatorTokenId);
        _staking.updateClaimerReward(
            validatorTokenId,
            to,
            lieutenantAddr,
            karatScore
        );
    }

    function _authorizeUpgrade(
        address
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
