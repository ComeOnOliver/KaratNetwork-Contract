// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

import "./IClaimer.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol"; // Access control for admin functionality

contract VCRegistry is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ERC721EnumerableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;
    // CountersUpgradeable.Counter public vcIdCounter;
    event BaseURIUpdated(string newBaseURI);

    struct Issuer {
        string id;
        address ethereumAddress;
    }
    struct CredentialSubject {
        //VC Data
        //string id;
        address ethereumAddress;
        string _type;
        //string typeSchema;
        string url; //ceramic://url
        //string encrypted;
        //TODO: check with Zado if not encrypted
    }

    struct VerifiableCredential {
        //VC W3C Standard
        //string _context;
        //string _type;
        //string id;
        Issuer issuer;
        CredentialSubject credentialSubject;
        //CredentialSchema credentialSchema;
        uint issuanTime;
        //string expirationDate;
    }

    mapping(address => mapping(uint256 => VerifiableCredential))
        public VCRegistryTable;
    mapping(uint256 => bool) public ifRegisteredVC;
    mapping(address => bool) public authorizedIssuers;

    IClaimer ClaimerNFT;
    string public baseURI;

    function initialize(
        string memory name,
        string memory symbol,
        string memory _baseURI,
        address claimerContractAddress
    ) public virtual initializer {
        __ERC721_init(name, symbol);
        __ERC721Enumerable_init();

        __Pausable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        ClaimerNFT = IClaimer(claimerContractAddress);

        baseURI = _baseURI;
        authorizedIssuers[msg.sender] = true;
    }

    function updateBaseURI(
        string memory _baseURI
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        baseURI = _baseURI;

        emit BaseURIUpdated(_baseURI);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        require(_exists(tokenId), "Not Exist");

        // Construct the token URI using string concatenation
        string memory json = string(
            abi.encodePacked(StringsUpgradeable.toString(tokenId), ".json")
        );
        string memory uri = string(abi.encodePacked(baseURI, json));

        return uri;
    }

    function setAuthorizedSigner(
        address newSignerAddress,
        bool isAuthorized
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        authorizedIssuers[newSignerAddress] = isAuthorized;
    }

    function isValidVC(
        address to,
        VerifiableCredential memory vc,
        bytes memory signature
    ) internal view returns (bool) {
        bytes32 newHashedMessage = keccak256(
            abi.encode(
                vc.issuer.id,
                vc.issuer.ethereumAddress,
                to,
                vc.credentialSubject._type,
                vc.credentialSubject.url,
                vc.issuanTime
            )
        );
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHashMessage = keccak256(
            abi.encodePacked(prefix, newHashedMessage)
        );
        address signer = ECDSAUpgradeable.recover(
            prefixedHashMessage,
            signature
        );
        return (authorizedIssuers[signer] == true);
    }

    //UUID is generated based on user address, VC type and url
    //One-to-Many: One Claimer is able to have many VCs of same type

    function generateUUID(
        address to,
        string memory _type,
        string memory url
    ) public pure returns (uint) {
        bytes32 uuidBytes = keccak256(abi.encode(to, _type, url));

        return uint256(uuidBytes);
    }

    function registerVC(
        address to,
        VerifiableCredential memory vc,
        bytes memory signature
    ) public nonReentrant{
        //Either Claimer or Signer can call this Function
        require(to == vc.credentialSubject.ethereumAddress, "Address Not Match");
        //Check if signed by authorized Signer
        require(isValidVC(to, vc, signature) == true, "Not Valid VC");

        uint256 uuid = generateUUID(
            to,
            vc.credentialSubject._type,
            vc.credentialSubject.url
        );

        //Check if this VC has registered
        require(!ifRegisteredVC[uuid], "This VC has been registered");
        //check if Claimer Holder

        require(
            ClaimerNFT.balanceOf(to) == 1,
            "Not Registered with the Karat Network"
        );

        ifRegisteredVC[uuid] = true;

        VCRegistryTable[to][uuid] = vc;
        _safeMint(to, uuid);
    }

    function registerVCBatch(
        address[] memory to_s,
        VerifiableCredential[] memory vcs,
        bytes[] memory signatures
    ) external {
        require(
            vcs.length == signatures.length && to_s.length == vcs.length,
            "No Matched Data Length"
        );
        for (uint i = 0; i < vcs.length; i++) {
            registerVC(to_s[i], vcs[i], signatures[i]);
        }
    }

    function getVC(
        address user,
        uint256 uuid
    ) public view returns (VerifiableCredential memory) {
        return VCRegistryTable[user][uuid];
    }

    function uuidsOfOwner(address _owner) external view returns(uint256[] memory) {
        uint256 tokenCount = balanceOf(_owner);

        if (tokenCount == 0) {
            // Return an empty array
            return new uint256[](0);
        } else {
            uint256[] memory result = new uint256[](tokenCount);
            for (uint256 index = 0; index < tokenCount; index++) {
                result[index] = tokenOfOwnerByIndex(_owner, index);
            }
            return result;
        }
    }

    function revokeVC(address user, uint256 uuid) public {
        require(
            authorizedIssuers[msg.sender] == true || user == msg.sender,
            "No Access to Delete"
        );
        require(
            VCRegistryTable[user][uuid].credentialSubject.ethereumAddress !=
                address(0),
            "VC NOT Exist"
        );
        _burn(uuid);
        delete VCRegistryTable[user][uuid];
    }

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

    //This token is set to be not Transferable but burnable

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override(ERC721EnumerableUpgradeable) {
        require(
            from == address(0) || to == address(0),
            "Transfer are not allowed"
        );
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _authorizeUpgrade(
        address
    ) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
