// SPDX-License-Identifier: MIT

// Importing required libraries
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

// Contract starts
contract Escrow is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    // Events for deposit received and funds withdrawn
    event DepositReceived(
        address indexed depositor,
        uint256 indexed amount,
        address indexed token
    );
    event FundsWithdrawn(
        address indexed recipient,
        uint256 indexed amount,
        address indexed token
    );

    // Mappings to hold token balances and authorized tokens
    mapping(address => bool) public authorizedTokens;
    mapping(address => mapping(address => uint256)) public claimerBalance;
    mapping(address => uint256) public claimerNativeBalance;
    mapping(address => mapping(address => uint256)) public validatorBalance;
    mapping(address => uint256) public validatorNativeBalance;
    mapping(address => uint256) public treasury;

    // Using SafeERC20 for IERC20Upgradeable;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // Initialization function
    function initialize() public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        authorizedTokens[address(0)] = true;
    }

    // Function to set whether a token is authorized or not
    function setToken(address token, bool isAuthorized) public onlyOwner {
        authorizedTokens[token] = isAuthorized;
    }

    // Function to deposit ERC20 tokens
    function depositERC20(address token, uint256 amount) external {
        require(isAuthorizedToken(token), "Invalid token");
        require(amount > 0, "Invalid amount");

        IERC20Upgradeable(token).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );
        claimerBalance[msg.sender][token] += amount;
        treasury[token] += amount;
        emit DepositReceived(msg.sender, amount, token);
    }

    // Function to deposit native (ETH) tokens
    function depositNativeToken() external payable {
        require(msg.value > 0, "Invalid amount");

        claimerNativeBalance[msg.sender] += msg.value;
        treasury[address(0)] += msg.value;
        emit DepositReceived(msg.sender, msg.value, address(0));
    }

    // Function to deposit validator ERC20 tokens
    function depositValidatorERC20(address token, uint256 amount) external {
        require(isAuthorizedToken(token), "Invalid token");
        require(amount > 0, "Invalid amount");

        IERC20Upgradeable(token).safeTransferFrom(
            msg.sender,
            address(this),
            amount
        );
        validatorBalance[msg.sender][token] += amount;
        treasury[token] += amount;
        emit DepositReceived(msg.sender, amount, token);
    }

    // Function to deposit validator native (ETH) tokens
    function depositValidatorNativeToken() external payable {
        require(msg.value > 0, "Invalid amount");

        validatorNativeBalance[msg.sender] += msg.value;
        treasury[address(0)] += msg.value;
        emit DepositReceived(msg.sender, msg.value, address(0));
    }

    // Function to withdraw funds by owner
    function withdraw(address token, uint256 amount) external onlyOwner {
        require(isAuthorizedToken(token), "Invalid token");
        require(amount > 0, "Invalid amount");
        require(treasury[token] >= amount, "Insufficient balance");

        treasury[token] -= amount;
        if (token != address(0)) {
            // For ERC20 tokens
            IERC20Upgradeable(token).safeTransfer(msg.sender, amount);
        } else {
            // For native (ETH) tokens
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            require(success, "Transfer failed");
        }
        emit FundsWithdrawn(msg.sender, amount, token);
    }

    // Function to check if a token is authorized or not
    function isAuthorizedToken(address token) public view returns (bool) {
        return (authorizedTokens[token]);
    }

    // Function to authorize an upgrade
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
