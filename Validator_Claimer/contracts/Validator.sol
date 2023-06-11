// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Importing required OpenZeppelin contracts for creating an upgradeable ERC721 NFT contract
// and maintaining a whitelist using Merkle Tree
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

// A Validator interface is being imported
import "./IValidator.sol";

contract ValidatorNFT is
    OwnableUpgradeable,
    ERC721EnumerableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    // Events to notify front-end or off-chain services about changes or actions in the contract
    event NewBatchCreated(uint256 tier1Batch, uint256 tier2Batch);
    event BaseURIUpdated(string baseURI);
    event StageChanged(Stage stage);
    event PriceChanged(uint256 tier1Price, uint256 tier2Price);
    event WhitelistMerkleRootUpdated(bytes32 merkleRoot);
    event ValidatorMinted(address indexed to, uint256 tokenId, uint256 tier);
    event AuthorizedCallerSet(address indexed caller, bool status);
    event ReferralSet(
        uint256 indexed validatorTokenId,
        address indexed claimerAddr,
        address indexed lieutenantAddr,
        uint256 claimerKaratScore
    );

    // Enum for maintaining the sale stage of the NFTs
    enum Stage {
        Closed,
        PreSale,
        PublicSale
    }

    // State variables
    Stage public currentStage;
    bytes32 public whitelistMerkleRoot;
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter public tokenIdCounter;
    string public baseURI;

    // A variety of mappings to keep track of the state and data associated with each token
    mapping(uint256 => uint256) public validatorMintLevel;

    //Validator, ValidatorMap[tokenId][Claimer] = Boolean
    mapping(uint256 => mapping(address => bool)) public validatorMap;
    mapping(uint256 => uint256) public validatorRefereeCounter;
    mapping(uint256 => uint256) public validatorKaratScore;

    //lieutenant, lieutenantMap[lieutenantAddr][Claimer] = Boolean
    mapping(address => mapping(address => bool)) public lieutenantMap;
    mapping(address => uint256) public lieutenantRefereeCounter;
    mapping(address => uint256) public lieutenantKaratScore;

    mapping(uint256 => uint256) public mintBatch;
    mapping(uint256 => CountersUpgradeable.Counter) public validatorCounter;
    mapping(address => bool) public privateValidatorMint;
    mapping(uint256 => uint256) public price;
    mapping(address => bool) public authorizedCallers;
    uint256 public constant validatorMaxSupply = 10000;

    // Initialization function that sets up the contract on deployment
    function initialize(
        string memory name,
        string memory symbol,
        string memory _baseURI,
        bytes32 _merkleRoot,
        uint256 tier1Batch,
        uint256 tier2Batch
    ) public initializer {
        __ERC721_init(name, symbol);
        __ERC721Enumerable_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Ownable_init();

        currentStage = Stage.Closed;
        whitelistMerkleRoot = _merkleRoot;
        baseURI = _baseURI;
        price[1] = 1 ether;
        price[2] = 0.2 ether;
        createNewBatch(tier1Batch, tier2Batch);
    }

    function createNewBatch(
        uint256 tier1Batch,
        uint256 tier2Batch
    ) public onlyOwner {
        require(
            tokenIdCounter.current() + tier1Batch + tier2Batch <=
                validatorMaxSupply,
            "exceed Max Total Supply"
        );
        mintBatch[1] = tier1Batch;
        mintBatch[2] = tier2Batch;
        validatorCounter[1].reset();
        validatorCounter[2].reset();

        emit NewBatchCreated(tier1Batch, tier2Batch);
    }

    function updateBaseURI(string memory _baseURI) public onlyOwner {
        baseURI = _baseURI;

        emit BaseURIUpdated(_baseURI);
    }

    function setPrice(uint256 tier1Price, uint256 tier2Price) public onlyOwner {
        price[1] = tier1Price;
        price[2] = tier2Price;

        emit PriceChanged(tier1Price, tier2Price);
    }

    //This Part is about Sales Stages
    function startPreSale() public onlyOwner {
        require(currentStage == Stage.Closed, "Sale Not Closed");
        currentStage = Stage.PreSale;

        emit StageChanged(Stage.PreSale);
    }

    function startPublicSale() public onlyOwner {
        require(
            currentStage == Stage.Closed || currentStage == Stage.PreSale,
            "Sale Already Public"
        );
        currentStage = Stage.PublicSale;

        emit StageChanged(Stage.PublicSale);
    }

    function endSale() public onlyOwner {
        require(
            currentStage == Stage.PublicSale || currentStage == Stage.PreSale,
            "Sale Already Ended"
        );
        currentStage = Stage.Closed;

        emit StageChanged(Stage.Closed);
    }

    function isWhiteList(
        address to,
        uint256 tier,
        uint256 mintPrice,
        bytes32[] memory _proof
    ) public view returns (bool, uint256) {
        bytes32 node = keccak256(abi.encodePacked(to, tier, mintPrice));
        bool status = MerkleProofUpgradeable.verify(
            _proof,
            whitelistMerkleRoot,
            node
        );
        return (status, mintPrice);
    }

    function updateWhitelistMerkleRoot(bytes32 _merkleRoot) public onlyOwner {
        whitelistMerkleRoot = _merkleRoot;

        emit WhitelistMerkleRootUpdated(_merkleRoot);
    }

    //Admin can Withdraw ETH from This Address
    function withdraw(uint256 amount) public onlyOwner {
        require(address(this).balance > 0, "No Fund");
        require(amount <= address(this).balance, "Insufficient balance");

        // Using call to transfer money
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    //mintValidator NFT in Private Sale with White List or Public Sale
    function _mintValidator(address to, uint256 tier) internal {
        require(
            validatorCounter[tier].current() < mintBatch[tier],
            "Exceed batch amount"
        );
        uint256 tokenId = tokenIdCounter.current();

        validatorMintLevel[tokenId] = tier;
        validatorCounter[tier].increment();
        tokenIdCounter.increment();
        _safeMint(to, tokenId);

        emit ValidatorMinted(to, tokenId, tier);
    }

    function mintValidatorPrivate(
        address to,
        uint256 tier,
        uint256 mintPrice,
        bytes32[] memory _proof
    ) public payable nonReentrant {
        require(tier == 1 || tier == 2, "Invalid level");
        require(!privateValidatorMint[to], "Already minted");
        require(currentStage == Stage.PreSale, "Sale not Open");
        (bool whitelisted, uint256 priceToPay) = isWhiteList(
            to,
            tier,
            mintPrice,
            _proof
        );

        require(whitelisted, "Not Whitelist");
        require(msg.value == priceToPay, "Amount Not Correct");

        privateValidatorMint[to] = true;
        _mintValidator(to, tier);
    }

    function mintValidatorPublic(
        address to,
        uint256 tier
    ) public payable nonReentrant {
        require(tier == 1 || tier == 2, "Invalid Tier");
        require(currentStage == Stage.PublicSale, "Sale not Open");
        require(msg.value == price[tier], "Amount Not Correct");

        _mintValidator(to, tier);
    }

    function mintValidatorPublicBatch(
        address to,
        uint256 amount,
        uint256 tier
    ) public payable nonReentrant {
        require(tier == 1 || tier == 2, "Invalid Tier");
        require(currentStage == Stage.PublicSale, "Sale not Open");
        require(msg.value == price[tier] * amount, "Amount Not Correct");
        for (uint256 i = 0; i < amount; i++) {
            _mintValidator(to, tier);
        }
    }

    function reserveValidator(
        address to,
        uint amount,
        uint256 tier
    ) public onlyOwner {
        uint i;
        require(tier == 1 || tier == 2, "Invalid Tier");

        for (i = 0; i < amount; i++) {
            _mintValidator(to, tier);
        }
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
                validatorMap[validatorTokenId][lieutenantAddr],
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
