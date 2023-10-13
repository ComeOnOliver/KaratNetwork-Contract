// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Importing required OpenZeppelin contracts for creating an upgradeable ERC721 NFT contract
// and maintaining a whitelist using Merkle Tree
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IValidatorContract {
    function ownerOf(uint256 tokenId) external returns (address);

    function validatorMap(
        uint256 validatorTokenId,
        address lieutenantAddr
    ) external returns (bool);
}

interface IStakingContract {
    function stakeTo(
        address recipient,
        uint256 amount,
        uint256 validatorId
    ) external;
}

contract CaptainPass is
    OwnableUpgradeable,
    ERC721EnumerableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    // Events to notify front-end or off-chain services about changes or actions in the contract
    event BaseURIUpdated(string baseURI);
    event ValidatorMinted(address indexed to, uint256 tokenId);
    event AuthorizedCallerSet(address indexed caller, bool status);
    event ReferralSet(
        uint256 indexed validatorTokenId,
        address indexed claimerAddr,
        address indexed lieutenantAddr,
        uint256 claimerKaratScore
    );

    // State variables
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter public tokenIdCounter;
    string public baseURI;

    IValidatorContract public validatorV1Contract;
    IERC20 public asset;
    IStakingContract public staking;

    uint256 public fixedStakeAmount;

    mapping(uint256 => address) public claimedValidator;

    //Validator, ValidatorMap[tokenId][Claimer] = Boolean
    mapping(uint256 => mapping(address => bool)) public validatorMap;
    mapping(uint256 => uint256) public validatorRefereeCounter;
    mapping(uint256 => uint256) public validatorKaratScore;

    //lieutenant, lieutenantMap[lieutenantAddr][Claimer] = Boolean
    mapping(address => mapping(address => bool)) public lieutenantMap;
    mapping(address => uint256) public lieutenantRefereeCounter;
    mapping(address => uint256) public lieutenantKaratScore;
    mapping(address => bool) public authorizedCallers;

    uint256 private constant MULTIPLIER = 1e18;

    // Initialization function that sets up the contract on deployment
    function initialize(
        string memory name,
        string memory symbol,
        string memory _baseURI,
        IERC20 katToken,
        IValidatorContract validatorAddress,
        IStakingContract stakingContract
    ) public initializer {
        __ERC721_init(name, symbol);
        __ERC721Enumerable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Ownable_init();

        baseURI = _baseURI;
        asset = katToken;
        validatorV1Contract = validatorAddress;
        staking = stakingContract;
        fixedStakeAmount = 35000 * MULTIPLIER;
        tokenIdCounter._value = 330;
    }

    function updateBaseURI(string memory _baseURI) public onlyOwner {
        baseURI = _baseURI;

        emit BaseURIUpdated(_baseURI);
    }

    function updateStakingConrtact(
        IStakingContract newStaking
    ) public onlyOwner {
        staking = newStaking;
    }

    function updateStakeToken(uint256 newAmount) public onlyOwner {
        fixedStakeAmount = newAmount;
    }

    function claimPass(uint256 validatorTokenId) public {
        require(
            validatorV1Contract.ownerOf(validatorTokenId) == msg.sender,
            "Not Owner of Validator Contract"
        );
        require(
            claimedValidator[validatorTokenId] == address(0),
            "Already Claimed"
        );

        claimedValidator[validatorTokenId] = msg.sender;
        _mintValidator(msg.sender, validatorTokenId);
    }

    //TODO： research retrant attack between conrtacts
    function stakeToMint(uint256 amount) public nonReentrant {
        require(amount >= fixedStakeAmount, "Amount not Correct");

        SafeERC20.safeTransferFrom(asset, msg.sender, address(this), amount);
        uint256 tokenId = tokenIdCounter.current();

        _mintValidator(msg.sender, tokenId);
        tokenIdCounter.increment();

        SafeERC20.safeIncreaseAllowance(asset, address(staking), amount);
        staking.stakeTo(msg.sender, amount, tokenId);
    }

    //Admin can Withdraw unexpected Token from This Address
    function withdraw(uint256 amount) public onlyOwner {
        require(
            amount > 0 && amount <= asset.balanceOf(address(this)),
            "Invalid Amount to Withdraw"
        );

        SafeERC20.safeTransfer(asset, msg.sender, amount);
    }

    //mintValidator NFT in Private Sale with White List or Public Sale
    function _mintValidator(address to, uint256 tokenId) internal {
        _safeMint(to, tokenId);
        emit ValidatorMinted(to, tokenId);
    }

    function setAuthorizedCaller(
        address newCallerAddress,
        bool isAuthorized
    ) public onlyOwner {
        authorizedCallers[newCallerAddress] = isAuthorized;

        emit AuthorizedCallerSet(newCallerAddress, isAuthorized);
    }

    function setReferral(
        uint256 validatorTokenId,
        address claimerAddr,
        address lieutenantAddr,
        uint256 claimerKaratScore
    ) external {
        require(authorizedCallers[msg.sender] == true, "Not Authorized Caller");
        require(_exists(validatorTokenId), "Not A Valid Referral");

        validatorMap[validatorTokenId][claimerAddr] = true;
        validatorRefereeCounter[validatorTokenId]++;
        validatorKaratScore[validatorTokenId] += claimerKaratScore;
        if (lieutenantAddr != address(0)) {
            require(
                lieutenantAddr != claimerAddr,
                "Claimer Cannot set himself as Lieutenant"
            );
            require(
                validatorMap[validatorTokenId][lieutenantAddr] ||
                    validatorV1Contract.validatorMap(
                        validatorTokenId,
                        lieutenantAddr
                    ),
                "Lieutenant is not associated"
            );
            lieutenantMap[lieutenantAddr][claimerAddr] = true;
            lieutenantRefereeCounter[lieutenantAddr]++;
            lieutenantKaratScore[lieutenantAddr] += claimerKaratScore;
        }

        emit ReferralSet(
            validatorTokenId,
            claimerAddr,
            lieutenantAddr,
            claimerKaratScore
        );
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");

        // Construct the token URI using string concatenation
        string memory json = string(
            abi.encodePacked(StringsUpgradeable.toString(tokenId), ".json")
        );
        string memory uri = string(abi.encodePacked(baseURI, json));

        return uri;
    }

    // Function to authorize an upgrade of the contract. It's restricted to the owner.
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
