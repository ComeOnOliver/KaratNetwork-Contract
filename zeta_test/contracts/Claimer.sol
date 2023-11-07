// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// OpenZeppelin upgradable contracts used for secure smart contract development
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol"; // Access control for admin functionality
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol"; // Utility to allow pausing of certain functionality
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IValidator is IERC165 {

    function setReferral(uint256 referralTokenId, address claimerAddr, address managerAddr, uint256 _karatScore) external;

}

// Contract definition
contract ClaimerNFT is
    ERC721EnumerableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    // Events emitted in functions
    event BaseURIUpdated(string newBaseURI);
    event ClaimerMinted(
        address indexed claimer,
        uint256 tokenId,
        uint256 indexed validatorTokenId,
        uint256 karatScore,
        address indexed lieutenantAddr,
        Role role
    );
    event UpdateMaxScore(uint256 maxScore);

    // Use of Counter to generate unique token IDs
    uint256 public tokenIdCounter;

    // Enum definition for role assignment
    enum Role {
        Scientist,
        Engineer,
        Doctor,
        Security,
        Artist
    }

    // Mapping of addresses to karatScores and roles
    mapping(address => uint256) public karatScoresList;
    mapping(address => Role) public claimerRoles;

    // Instance of IValidator contract
    IValidator validatorNFT;

    // Base URI for token metadata
    string public baseURI;

    // Max initial score allowed
    uint256 public maxInitialKaratScore;

    // Role identifier for minters
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Initialize function to setup the contract during deployment
    function initialize(
        string memory name,
        string memory symbol,
        address validatorContractAddress,
        string memory _baseURI,
        uint256 maxKaratScore
    ) public initializer {
        // Validates input parameters
        require(
            validatorContractAddress != address(0),
            "Validator Contract Address should not be zero"
        );
        require(maxKaratScore > 0, "Max KaratScore should greater than zero");

        // Calls the initialization functions of the used OpenZeppelin contracts
        __ERC721_init(name, symbol);
        __ERC721Enumerable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        __Pausable_init();

        // Grants admin and minter roles to the contract deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        // Sets validatorNFT, baseURI, and maxInitialKaratScore
        validatorNFT = IValidator(validatorContractAddress);
        baseURI = _baseURI;
        maxInitialKaratScore = maxKaratScore;
    }

    // Function to update max score, accessible only by admin
    function updateMaxScore(
        uint256 maxScore
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(maxScore > 0, "Illegal Score");

        maxInitialKaratScore = maxScore;
        emit UpdateMaxScore(maxScore);
    }

    // Function to update base URI, accessible only by admin
    function updateBaseURI(
        string memory _baseURI
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        baseURI = _baseURI;

        emit BaseURIUpdated(_baseURI);
    }

    // Overridden function to return a custom token URI
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(tokenId < tokenIdCounter, "Not Exist");

        // Construct the token URI using string concatenation
        string memory json = string(
            abi.encodePacked(Strings.toString(tokenId), ".json")
        );
        string memory uri = string(abi.encodePacked(baseURI, json));

        return uri;
    }

    // Internal function to mint new claimer
    function _mintClaimer(
        address to,
        uint256 validatorTokenId,
        uint256 karatScore,
        address lieutenantAddr,
        Role role
    ) private {
        uint256 tokenId = tokenIdCounter;

        _setKaratScore(to, karatScore);
        claimerRoles[to] = role;
        _safeMint(to, tokenId);
        validatorNFT.setReferral(
            validatorTokenId,
            to,
            lieutenantAddr,
            karatScore
        );
        tokenIdCounter += 1;

        emit ClaimerMinted(
            to,
            tokenId,
            validatorTokenId,
            karatScore,
            lieutenantAddr,
            role
        );
    }

    // Function to mint new claimer, accessible only by minter
    function mintClaimer(
        address to,
        uint256 validatorTokenId,
        uint256 karatScore,
        address lieutenantAddr,
        Role role
    ) public onlyRole(MINTER_ROLE) nonReentrant whenNotPaused {
        require(balanceOf(to) < 1, "Already Have Token");
        _mintClaimer(to, validatorTokenId, karatScore, lieutenantAddr, role);
    }

    // Function to mint batch of claimers, accessible only by minter
    function mintClaimerBatch(
        address[] memory to_s,
        uint256[] memory validatorTokenIds,
        uint256[] memory karatScores,
        address[] memory lieutenantAddrs,
        Role[] memory roles
    ) public onlyRole(MINTER_ROLE) whenNotPaused {
        require(
            to_s.length == validatorTokenIds.length &&
                to_s.length == karatScores.length &&
                to_s.length == lieutenantAddrs.length &&
                to_s.length == roles.length,
            "Input arrays must have the same length"
        );

        for (uint i = 0; i < to_s.length; i++) {
            mintClaimer(
                to_s[i],
                validatorTokenIds[i],
                karatScores[i],
                lieutenantAddrs[i],
                roles[i]
            );
        }
    }

    // signer from signature
    function recoverSigner(
        bytes32 message,
        bytes memory signature
    ) private pure returns (address) {
        return ECDSA.recover(message, signature);
    }

    // Function to mint a new claimer with a signature, to prevent transaction replays
    function mintClaimerwithSig(
        address to,
        uint256 validatorTokenId,
        uint256 karatScore,
        address lieutenantAddr,
        Role role,
        bytes memory signature
    ) public nonReentrant whenNotPaused {
        require(balanceOf(to) < 1, "Already Have Token");
        bytes32 newHashedMessage = keccak256(
            abi.encode(
                to,
                keccak256(abi.encode(karatScore)),
                keccak256(abi.encode(role)),
                keccak256(abi.encode(block.chainid))
            )
        );
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHashMessage = keccak256(
            abi.encodePacked(prefix, newHashedMessage)
        );
        address signer = recoverSigner(prefixedHashMessage, signature);

        require(hasRole(MINTER_ROLE, signer), "Not Authorized Signer");
        _mintClaimer(to, validatorTokenId, karatScore, lieutenantAddr, role);
    }

    // Internal function to set the karatScore of a claimer
    function _setKaratScore(address claimerAddr, uint256 karatScore) private {
        require(
            karatScore > 0 && karatScore <= maxInitialKaratScore,
            "Illegal Score"
        );
        karatScoresList[claimerAddr] = karatScore;
    }

    // Function to check if the contract supports a specific interface
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(AccessControlUpgradeable, ERC721EnumerableUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function transferFrom(address from, address to, uint256 tokenId) public virtual override(ERC721Upgradeable, IERC721) {
        if (from != address(0)) {
            revert ERC721InvalidReceiver(to);
        }
        // Setting an "auth" arguments enables the `_isAuthorized` check which verifies that the token exists
        // (from != 0). Therefore, it is not needed to verify that the return value is not 0 here.
        address previousOwner = _update(to, tokenId, _msgSender());
        if (previousOwner != from) {
            revert ERC721IncorrectOwner(from, tokenId, previousOwner);
        }
    }

    // Function to pause all token minting, accessible only by admin
    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    // Function to unpause all token minting, accessible only by admin
    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // Authorization function for upgrading the contract, accessible only by admin
    function _authorizeUpgrade(
        address
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
