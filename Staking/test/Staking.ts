import {upgrades} from "hardhat";
import {expect} from "chai";
import {ethers} from "hardhat";
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

describe("Test Stake", function () {
    let kat: any;
    let owner: any;
    let validator1: any;
    let user1: any;
    beforeEach(async function () {
    
            const TESTTOKEN = await ethers.getContractFactory("KaratTestToken");
            kat = await upgrades.deploy(TESTTOKEN, []);
            [owner] = await ethers.getSigners();
            validator1 = ethers.Wallet.createRandom();
            const users = [validator1.address, "0x2C4C74339AdA433159965E2881Bd16349bb092B2", "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", "0x4c79B28335723E158b8F02b7E3191Aa570B2ED91", owner.address];

            const merkleTree = generateMerkleTree(users, [
                1, 1, 1, 1, 1
            ], [ethers.utils.parseEther("0.15"), ethers.utils.parseEther("0.15"), ethers.utils.parseEther("0.15"), ethers.utils.parseEther("0.15"), ethers.utils.parseEther("0.15")]);
            const merkleRoot = merkleTree.getHexRoot();

            const ValidatorNFT = await ethers.getContractFactory("ValidatorNFT");
            const validatorContract = await upgrades.deployProxy(ValidatorNFT, [
                "ValidatorNFT",
                "VNFT",
                "https://karatdao.com/validator/",
                merkleRoot,
                30,
                300
            ], {initializer: "initialize"});
            
            const baseURI = "https://karatdao.com/claimer/";
            const maxKaratScore = 1500;
            const Claimer = await ethers.getContractFactory("ClaimerNFT");
            const claimerContract = await upgrades.deployProxy(Claimer, [
                'Claimer NFT',
                'KAC',
                validatorContract.address,
                baseURI,
                maxKaratScore
            ], {initializer: "initialize"});

            await validatorContract.connect(owner).setAuthorizedCaller(claimerContract.address, true);
            await validatorContract.connect(owner).reserveValidator(validator1.address, 10, 1);
            user1 = ethers.Wallet.createRandom();
            await claimerContract.connect(owner).mintClaimer(user1.address, 1, 100, ethers.constants.AddressZero, 2);
            
        });

    describe("Deployment", function () {
        it("Should set the right TestToken", async function () {

        await expect(kat.balanceOf(owner.address)).to.equal(ethers.utils.parseEther("1000000"));
        });
    });
});