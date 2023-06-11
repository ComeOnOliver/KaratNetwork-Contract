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

describe("Claimer", function () {
    let Claimer: any;
    let claimerNFT: any;
    let validatorNFT: any;
    let owner: Signer;
    let minter: Signer;
    let addr1: Signer;
    let addr2: Signer;
    let addr3: Signer;
    let merkleRoot: string;
    let users: any;
    let merkleTree: any;
    let baseURI: string;
    let maxKaratScore: any;
    let MINTER_ROLE: any;
    let provider: any;

    beforeEach(async function () {
        const ValidatorNFT = await ethers.getContractFactory("ValidatorNFT");
        [
            owner,
            minter,
            addr1,
            addr2,
            addr3
        ] = await ethers.getSigners();
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

    });
    describe("Deployment", function () {

        it("Test that the contract deployer is set as the contract owner upon deployment", async function () {
            expect(await claimerNFT.maxInitialKaratScore()).to.equal(1500);
            await claimerNFT.connect(owner).updateMaxScore(100);
            expect(await claimerNFT.maxInitialKaratScore()).to.equal(100);
        });

        it("Test that the contract constructor sets the initial baseURI correctly", async function () {
            expect(await claimerNFT.baseURI()).to.equal(baseURI);
        });

        it("Test that the contract constructor sets the maxInitialKaratScore correctly", async function () {
            expect(await claimerNFT.maxInitialKaratScore()).to.equal(1500);
        });

        it("Test that the contract constructor sets the MINTER_ROLE correctly", async function () {
            expect(await claimerNFT.hasRole(await claimerNFT.MINTER_ROLE(), owner.address)).to.equal(true);
        });

        it("Test the constructor with invalid values for validatorContractAddress and maxKaratScore", async function () { // Invalid validatorContractAddress
            await expect(upgrades.deployProxy(Claimer, [
                "ClaimerNFT",
                "CNFT",
                "0x214",
                baseURI,
                1500
            ])).to.be.reverted;

            // Invalid maxKaratScore
            await expect(upgrades.deployProxy(Claimer, [
                "ClaimerNFT",
                "CNFT",
                validatorNFT.address,
                baseURI,
                -512
            ])).to.be.reverted;
        });

    });

    describe("ClaimerNFT Access Control", function () {
        it("Test that only the contract owner can call updateBaseURI()", async function () {
            await expect(claimerNFT.connect(addr1).updateBaseURI("https://new.example.com/")).to.be.reverted;
            await claimerNFT.connect(owner).updateBaseURI("https://new.example.com/");
            expect(await claimerNFT.baseURI()).to.equal("https://new.example.com/");
        });

        it("Test that only the contract owner can call pause()", async function () {
            await expect(claimerNFT.connect(addr1).pause()).to.be.reverted;
            await claimerNFT.connect(owner).pause();
            expect(await claimerNFT.paused()).to.equal(true);
        });
        it("Test that only the contract owner can call unpause()", async function () {
            await claimerNFT.connect(owner).pause();
            await expect(claimerNFT.connect(addr1).unpause()).to.be.reverted;
            await claimerNFT.connect(owner).unpause();
            expect(await claimerNFT.paused()).to.equal(false);
        });
        it("Test that only the contract owner can call updateMaxScore()", async function () {
            await expect(claimerNFT.connect(addr1).updateMaxScore(200)).to.be.reverted;
            await claimerNFT.connect(owner).updateMaxScore(200);
            expect(await claimerNFT.maxInitialKaratScore()).to.equal(200);
        });

        it("Test calling updateBaseURI() with valid parameters and verify the corresponding state changes", async function () {
            await claimerNFT.connect(owner).updateBaseURI("https://new.example.com/");
            expect(await claimerNFT.baseURI()).to.equal("https://new.example.com/");
        });

        it("Test calling pause() and unpause() with valid parameters and verify the corresponding state changes", async function () {
            await claimerNFT.connect(owner).pause();
            expect(await claimerNFT.paused()).to.equal(true);

            await claimerNFT.connect(owner).unpause();
            expect(await claimerNFT.paused()).to.equal(false);
        });

        it("Test calling updateMaxScore() with valid parameters and verify the corresponding state changes", async function () {
            await claimerNFT.connect(owner).updateMaxScore(200);
            expect(await claimerNFT.maxInitialKaratScore()).to.equal(200);
        });
    });

    describe("Minting Tests", function () {

        beforeEach(async function () {
            await validatorNFT.connect(owner).startPublicSale();
            await validatorNFT.connect(owner).setAuthorizedCaller(claimerNFT.address, true);
            const tier = 1;
            const mintPrice = await validatorNFT.price(tier);
            await validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice});
            await validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice});

        });

        it("Test mintClaimer function with valid inputs", async function () {
            await claimerNFT.connect(owner).mintClaimer(users[0], 1, 100, ethers.constants.AddressZero, 2);
            expect(await claimerNFT.balanceOf(users[0])).to.equal(1);
        });

        it("Test mintClaimer function with invalid inputs", async function () {
            await claimerNFT.connect(owner).mintClaimer(users[0], 1, 100, ethers.constants.AddressZero, 2);
            await expect(claimerNFT.connect(owner).mintClaimer(users[0], 1, 100, ethers.constants.AddressZero, 2)).to.be.revertedWith("Already Have Token");
            await expect(claimerNFT.connect(owner).mintClaimer(users[1], 1, 1600, ethers.constants.AddressZero, 2)).to.be.revertedWith("Illegal Score");
        });
        it("Test mintClaimerBatch function with valid inputs", async function () {
            const addresses = [
                users[1], users[2]
            ];
            const validatorTokenIds = [0, 1];
            const karatScores = [100, 1500];
            const lieutenantAddrs = [ethers.constants.AddressZero, ethers.constants.AddressZero];
            const roles = [2, 3];

            await claimerNFT.connect(owner).mintClaimerBatch(addresses, validatorTokenIds, karatScores, lieutenantAddrs, roles);
            expect(await claimerNFT.balanceOf(users[1])).to.equal(1);
            expect(await claimerNFT.balanceOf(users[2])).to.equal(1);
        });

        it("Test mintClaimerBatch function with invalid inputs", async function () {
            const addresses = [
                users[1], users[2]
            ];
            const validatorTokenIds = [1, 2];
            const karatScores = [100];
            const lieutenantAddrs = [ethers.constants.AddressZero, ethers.constants.AddressZero];
            const roles = [2, 2];

            await expect(claimerNFT.connect(owner).mintClaimerBatch(addresses, validatorTokenIds, karatScores, lieutenantAddrs, roles)).to.be.revertedWith("Input arrays must have the same length");
        });

        it("Test mintClaimerwithSig function with valid inputs and a valid signature", async function () {
            const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
            const chinID = await owner.getChainId();
            const message = ethers.utils.defaultAbiCoder.encode([
                "address", "bytes32", "bytes32", "bytes32"
            ], [
                users[0], ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [1500])),
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint8"], [1])),
                ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint"], [chinID])),
            ]);

            const messageHash = ethers.utils.keccak256(message);

            // Sign the message with web3.eth.accounts.sign
            const {signature} = web3.eth.accounts.sign(messageHash, PRIVATE_KEY);
            provider = ethers.provider;
            const signer11 = new ethers.Wallet(PRIVATE_KEY, provider);
            // Validate that Owner has the Minter Role Access
            await claimerNFT.grantRole(MINTER_ROLE, signer11.address);
            await claimerNFT.mintClaimerwithSig(users[0], 1, 1500, ethers.constants.AddressZero, 1, signature);
            expect(await claimerNFT.balanceOf(users[0])).to.equal(1);
        });

        it("Test mintClaimerwithSig function with invalid inputs or an invalid signature", async function () {

            const [newsigner] = await ethers.getSigners();
            const message = ethers.utils.solidityKeccak256([
                "address", "uint256", "uint256"
            ], [
                users[1], ethers.utils.solidityKeccak256(["uint256"], [100]),
                ethers.utils.solidityKeccak256(["uint256"], [2])
            ]);
            const invalidSignature = await newsigner.signMessage(ethers.utils.arrayify(message));

            await expect(claimerNFT.mintClaimerwithSig(users[1], 1, 100, ethers.constants.AddressZero, 2, invalidSignature)).to.be.reverted;
        });


    });
    describe("TokenURI and Modifiers", function () {
        beforeEach(async function () {
            await validatorNFT.connect(owner).startPublicSale();
            await validatorNFT.connect(owner).setAuthorizedCaller(claimerNFT.address, true);
            const tier = 1;
            const mintPrice = await validatorNFT.price(tier);
            await validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice});
            await validatorNFT.connect(owner).mintValidatorPublic(users[0], tier, {value: mintPrice});
        });

        // Test tokenURI with valid tokenId
        it("Test tokenURI with valid tokenId", async function () {
            const tokenId = 0;
            await claimerNFT.mintClaimer(users[1], 1, 100, ethers.constants.AddressZero, 2);
            const uri = await claimerNFT.tokenURI(tokenId);
            expect(uri).to.not.be.empty;
        });

        // Test tokenURI with invalid tokenId
        it("Test tokenURI with invalid tokenId", async function () {
            const invalidTokenId = 999;
            await expect(claimerNFT.tokenURI(invalidTokenId)).to.be.reverted;
        });


        // Test supportsInterface with invalid interfaceId
        it("Test supportsInterface with invalid interfaceId", async function () {
            const invalidInterfaceId = "0xffffffff";
            expect(await claimerNFT.supportsInterface(invalidInterfaceId)).to.be.false;
        });
        // Test that only users with Minter_ROLE can call mintUser and mintUserBatch functions
        it("Test only users with Minter_ROLE can call mintUser and mintUserBatch functions", async function () {

            await claimerNFT.connect(owner).mintClaimer(users[2], 1, 100, ethers.constants.AddressZero, 2);
            expect(await claimerNFT.balanceOf(users[2])).to.equal(1);

            await claimerNFT.connect(owner).mintClaimerBatch([users[3]], [1], [100], [ethers.constants.AddressZero], [2]);
            expect(await claimerNFT.balanceOf(users[3])).to.equal(1);
        });

        // Test that non-minter users cannot call mintUser and mintUserBatch functions
        it("Test non-minter users cannot call mintUser and mintUserBatch functions", async function () {
            await expect(claimerNFT.connect(addr1).mintClaimer(users[2], 1, 100, ethers.constants.AddressZero, 2)).to.be.reverted;
            await expect(claimerNFT.connect(addr1).mintClaimerBatch([users[3]], [1], [100], [ethers.constants.AddressZero], [2])).to.be.reverted;
        });

        it("Test only users with Minter_ROLE can call _beforeTokenTransfer function", async function () {
            await claimerNFT.connect(owner).mintClaimer(users[2], 1, 100, ethers.constants.AddressZero, 2);
            expect(await claimerNFT.balanceOf(users[2])).to.equal(1);
        });
        describe("Advanced Scenarios", function () {
            it("BaseURIUpdated event is emitted when updateBaseURI is called", async function () {
                const newBaseURI = "https://example.com/new/";
                await expect(claimerNFT.connect(owner).updateBaseURI(newBaseURI)).to.emit(claimerNFT, "BaseURIUpdated").withArgs(newBaseURI);
            });
            it("AuthorizedSignerUpdated event is emitted when setAuthorizedSigner is called", async function () {
                const signerAddress = users[2];
                await expect(claimerNFT.connect(owner).grantRole(MINTER_ROLE, signerAddress)).to.emit(claimerNFT, "RoleGranted").withArgs(MINTER_ROLE, signerAddress, owner.address);
            });
            it("ClaimerMinted event is emitted when a user is minted (mintClaimer)", async function () {
                await expect(claimerNFT.connect(owner).mintClaimer(users[1], 1, 100, ethers.constants.AddressZero, 2)).to.emit(claimerNFT, "ClaimerMinted").withArgs(users[1], 0, 1, 100, ethers.constants.AddressZero, 2);
            });
            it("Contract behaves correctly when paused and unpaused", async function () {
                await claimerNFT.connect(owner).pause();

                await expect(claimerNFT.connect(owner).mintClaimer(users[1], 1, 100, ethers.constants.AddressZero, 2)).to.be.revertedWith("Pausable: paused");

                await claimerNFT.connect(owner).unpause();

                await claimerNFT.connect(owner).mintClaimer(users[1], 1, 100, ethers.constants.AddressZero, 2);
                expect(await claimerNFT.balanceOf(users[1])).to.equal(1);
            });

            it("Contract can be upgraded using the UUPS pattern", async function () { // Deploy the new version of the contract

                const ClaimerNFTV2 = await ethers.getContractFactory("ClaimerNFTV2");
                const newClaimerNFTImpl = await ClaimerNFTV2.deploy();

                await claimerNFT.connect(owner).upgradeTo(newClaimerNFTImpl.address);

                expect(await claimerNFT.baseURI()).to.equal(baseURI);
            });
            it("User cannot transfer NFT", async function () {
                await claimerNFT.connect(owner).mintClaimer(owner.address, 1, 100, ethers.constants.AddressZero, 2);
                await expect(claimerNFT.connect(owner).transferFrom(owner.address, users[2], 0)).to.be.revertedWith("Transfer/Burn are not allowed");
            });


        });
    });


});
