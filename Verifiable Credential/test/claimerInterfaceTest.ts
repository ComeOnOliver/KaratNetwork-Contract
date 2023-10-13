import {ethers, upgrades} from "hardhat";
import {expect} from "chai";
import {MerkleTree} from "merkletreejs";
import {keccak256, solidityKeccak256} from "ethers/lib/utils";
import {Signer} from "ethers";
const Web3 = require("web3");
const web3 = new Web3("https://testnet.era.zksync.dev");

import dotenv from "dotenv";
dotenv.config();

function generateMerkleTree(usersss, levels, mintPrices) {
    const elements = [];
    usersss.forEach(user => {
        levels.forEach(level => {
            mintPrices.forEach(mintprice => {
                const hash = ethers.utils.solidityKeccak256([
                    "address", "uint256", "uint256"
                ], [user, level, mintprice]);
                elements.push(hash);
            });
        });
    });

    const merkleTree = new MerkleTree(elements, keccak256, {sort: true});

    return merkleTree;
}
class Issuer {
    
    constructor(id, ethereumAddress) {
        this.id = id;
        this.ethereumAddress = ethereumAddress;
    }
}

// JavaScript equivalent of CredentialSubject struct in Solidity
class CredentialSubject {
    constructor(ethereumAddress, _type, url) {
        this.ethereumAddress = ethereumAddress;
        this._type = _type;
        this.url = url;
    }
}

// JavaScript equivalent of VerifiableCredential struct in Solidity
class VerifiableCredential {
    constructor(issuer, credentialSubject, issuanTime) {
        this.issuer = issuer;
        this.credentialSubject = credentialSubject;
        this.issuanTime = issuanTime;
    }
}

describe("Test Claimer Interface", function () {
    let Claimer: any;
    let claimerNFT: any;
    let validatorNFT: any;
    let owner: Signer;
    let minter: Signer;
    let addr1: Signer;
    let addr2: Signer;
    let addr3, other: Signer;
    let merkleRoot: string;
    let users: any;
    let merkleTree: any;
    let baseURI: string;
    let maxKaratScore: any;
    let MINTER_ROLE: any;
    let provider: any;
    let KaratVC, karatVC: any

    beforeEach(async function () {
        const ValidatorNFT = await ethers.getContractFactory("ValidatorNFT");
        [owner, addr1, addr2, addr3, minter, other] = await ethers.getSigners();

        users = ["0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2", "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", "0x4c79B28335723E158b8F02b7E3191Aa570B2ED91", owner.address];

        merkleTree = generateMerkleTree(users, [
            1, 1, 1, 1
        ], [ethers.utils.parseEther("0.15"), ethers.utils.parseEther("0.15"), ethers.utils.parseEther("0.15"), ethers.utils.parseEther("0.15")]);
        merkleRoot = merkleTree.getHexRoot();

        validatorNFT = await upgrades.deployProxy(ValidatorNFT, [
            "ValidatorNFT",
            "VNFT",
            "https://karatdao.com/validator/",
            merkleRoot,
            30,
            300
        ], {initializer: "initialize"});

        baseURI = "https://karatdao.com/claimer/";
        maxKaratScore = 1500;
        MINTER_ROLE = ethers.utils.solidityKeccak256(['string'], ["MINTER_ROLE"]);
        Claimer = await ethers.getContractFactory("ClaimerNFT");
        claimerNFT = await upgrades.deployProxy(Claimer, [
            'Claimer NFT',
            'KAC',
            validatorNFT.address,
            baseURI,
            maxKaratScore
        ], {initializer: "initialize"});

        await validatorNFT.connect(owner).setAuthorizedCaller(claimerNFT.address, true);
        await validatorNFT.connect(owner).reserveValidator(owner.address, 10, 1);

        KaratVC = await ethers.getContractFactory('VCRegistry');
        karatVC = await upgrades.deployProxy(KaratVC, ["KaratVC", "KVC", "aaa", claimerNFT.address], { initializer: 'initialize' });
        await karatVC.deployed();
    });
    describe("Claimer Deploy Success!", function () {

        it("Test that the contract deployer is set as the contract owner upon deployment", async function () {
            expect(await claimerNFT.maxInitialKaratScore()).to.equal(1500);
            await claimerNFT.connect(owner).updateMaxScore(100);
            expect(await claimerNFT.maxInitialKaratScore()).to.equal(100);
        });

    });

    describe("Claimer Deploy Success!", function () {
        it("VC Should set the right owner", async function () {
            await karatVC.connect(owner).pause();
            expect(await karatVC.paused()).to.equal(true);
        });
    
        it("VC Should assign the authorized Issuer role to the owner", async function () {
          expect(await karatVC.authorizedIssuers(owner.address)).to.be.true;
        });
    });

    describe("Connect with Claimer Contract and Mint VC correctly", function () {


        it("Test mint function with valid inputs and a valid signature", async function () {
            
            //mint claimer
            await claimerNFT.connect(owner).mintClaimer(users[0], 1, 100, ethers.constants.AddressZero, 2);
            expect(await claimerNFT.balanceOf(users[0])).to.equal(1);
                                    
            const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
            const chainId = await owner.getChainId();

            // Create JavaScript objects equivalent to Solidity structs
            const issuer = {
                id: "issuer1",
                ethereumAddress: owner.address
            };

            const credentialSubject = {
                ethereumAddress: users[0],
                _type: "type1",
                url: "ceramic://url"
            };

            const vc = {
                issuer: issuer,
                credentialSubject: credentialSubject,
                issuanTime: 1685990276
            };

            const credentialSubjectType = "type1";

            // Hash the VC struct
            const vcHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode([
                "string",
                "address",
                "address",
                "string",
                "string",
                "uint"
            ], [
                vc.issuer.id,
                vc.issuer.ethereumAddress,
                vc.credentialSubject.ethereumAddress,
                vc.credentialSubject._type,
                vc.credentialSubject.url,
                vc.issuanTime
            ]));

            const provider = ethers.provider;
            const signer11 = new ethers.Wallet(PRIVATE_KEY, provider);

            // Sign the hashed VC
            // const signature = await signer11.signMessage(ethers.utils.arrayify(vcHash));
            const {signature} = web3.eth.accounts.sign(vcHash, PRIVATE_KEY);
            console.log("Sig: ", signature);
            // Validate that Owner has the Minter Role Access
            await karatVC.setAuthorizedSigner(signer11.address, true);

            // Assuming the mint function accepts VerifiableCredential type objects
            await karatVC.connect(signer11).registerVC(users[0], vc, signature);
            expect(await karatVC.balanceOf(users[0])).to.equal(1);
        });
    });

});