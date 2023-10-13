import {Provider, Wallet} from "zksync-web3";
import * as ethers from "ethers";
import {HardhatRuntimeEnvironment} from "hardhat/types";
import {Deployer} from '@matterlabs/hardhat-zksync-deploy';
const {DefenderRelayProvider, DefenderRelaySigner} = require('defender-relay-client/lib/ethers');


const Web3 = require("web3");
// load env file
import dotenv from "dotenv";
dotenv.config();

import * as ContractArtifact from "../../artifacts-zk/contracts/Validator.sol/ValidatorNFT.json";
import * as UserArtifact from "../../artifacts-zk/contracts/Claimer.sol/ClaimerNFT.json";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const NewOwner_KEY = process.env.PRIVATE_KEY1 || "";

async function waitForTransaction(tx) {
    const receipt = await tx.wait();
    if (receipt.status !== 1) {
        throw new Error("Transaction failed");
    }
}

if (! PRIVATE_KEY) 
    throw "⛔️ Private key not detected! Add it to the .env file!";


const ValiCONTRACT_ADDRESS = '0x206fb07F615F70316BfC140b842913692AFDf4b3';
const userNFTProxyAddress = '0x26809F51a86062ba629c89C9a7eE0dcC8000c17C';

export default async function (hre : HardhatRuntimeEnvironment) {

    const urls = {
        zkSyncTestnet: 'https://testnet.era.zksync.dev',
        zkMain: 'https://mainnet.era.zksync.io'
    };

    const network = hre.network.name;
    const url = urls[network as keyof typeof urls];
    console.log("URL: ", url);

    const provider = new Provider(url);

    const signer1 = new ethers.Wallet(PRIVATE_KEY, provider);
    const signer2 = new ethers.Wallet(NewOwner_KEY, provider);

    const validator = new ethers.Contract(ValiCONTRACT_ADDRESS, ContractArtifact.abi, signer1);

    const claimer = new ethers.Contract(userNFTProxyAddress, UserArtifact.abi, signer1);

    // //------------------------------------------------------------------------------------------------
    // //Validator - Direct Test
    // //------------------------------------------------------------------------------------------------

    // //------------------------------------------------------------------------------------------------
    // //DirectTest1 Transfer Ownership: Passed

    // ------------------------------------------------------------------------------------------------
    // Validator - Direct Test
    // ------------------------------------------------------------------------------------------------

    console.log("This should transfer the ownership", changedOwner)
    console.log("The Owner transfer is: ", changedOwner == signer2.address);

    const transferOwnerTx1 = await validator.connect(signer2).transferOwnership(signer1.address);
    await waitForTransaction(transferOwnerTx1);
    console.log("Transfer Back: ", await validator.owner() == signer1.address);

    // //------------------------------------------------------------------------------------------------
    // //DirectTest2 Reserve 30 tier1 and 10 tier 2
    console.log("This should reserve the Validator")
    const reserveTx1 = await validator.connect(signer1).reserveValidator(signer2.address, 30, 1, {gasLimit: 3600000000});
    await waitForTransaction(reserveTx1);
    console.log("T1 - 30 has minted");
    const ValiBalance = await validator.balanceOf(signer2.address);
    console.log("Sigenr2 should have 30", ValiBalance == 30);

    const reserveTx2 = await validator.connect(signer1).reserveValidator(signer1.address, 20, 2, {gasLimit: 3600000000});
    await waitForTransaction(reserveTx2);
    console.log("T2 - 20 has minted");
    const ValiBalance1 = await validator.balanceOf(signer1.address);
    console.log("Sigenr1 should have 20", ValiBalance1 == 20);

    // ------------------------------------------------------------------------------------------------
    // DirectTest3 Should update root and mintPreSale
    console.log("This should update the merkleRoot and start private key")
    const root = "0xa1a2bc231d908c60601a7f4811f017a9f539035ba625ca572b7b7467f0f30705";

    const updateWhitelistTx = await validator.connect(signer1).updateWhitelistMerkleRoot(root);
    await waitForTransaction(updateWhitelistTx);
    console.log("updated")

    // const startPreSaleTx = await validator.connect(signer1).startPreSale();
    // await waitForTransaction(startPreSaleTx);
    // console.log("Private Started")

    const proof = [
        '0x8d18520b98a4e125d510231e6a95a56bb2f02cc039b2ed9c0946f5cf237915c4',
        '0x77e9260413b4c8cc34653626188eb89520425bfd3058841321d9eed884f5035d',
        '0x93f54c8787a9c3b4acfa98acc0c3e6ec0db83ac90fa3ada0c79943cc417c9a1e',
        '0xd0e9275cecd17834f87e96ef83218a82edadad518d625fcafc87f7457fb77275',
        '0xf9776310e1b23380f3003dce6c902846039656ef6721cd7c4d84cec35aa9897d',
        '0x1d4c1b5f2eca67c9090a263d79176bf873c33c69464e0e6a8f52c6f3da722f73'
    ];

    const mintTx = await validator.connect(signer1).mintValidatorPrivate('0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2', 2, ethers.utils.parseEther("0.15"), proof, {value: ethers.utils.parseEther("0.15")});
    await waitForTransaction(mintTx);

    console.log("This should update Merkle Tree Root", validator.whitelistMerkleRoot() == root);
    console.log("The Owner transfer is: ", validator.balanceOf(0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2) == 1);

    // //------------------------------------------------------------------------------------------------
    // //DirectTest4 Should public sale
    const startPubSaleTx = await validator.connect(signer1).startPublicSale();
    await waitForTransaction(startPubSaleTx);
    console.log("Public Started")

    const mintTx = await validator.connect(signer1).mintValidatorPublic('0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2', 2, {value: ethers.utils.parseEther("0.2")});
    await waitForTransaction(mintTx);

    console.log("The Public Mint is: ", await validator.balanceOf('0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2') == 2);


    // //------------------------------------------------------------------------------------------------
    // //DirectTest5 create new batch and reserve and mint

    const createTx = await validator.connect(signer1).createNewBatch(10, 20);
    await waitForTransaction(createTx);
    console.log("New Batch Created: ", await validator.mintBatch(1), "and ", await validator.mintBatch(2));

    const reserveTx = await validator.connect(signer1).reserveValidator(signer1.address, 10, 1, {gasLimit: 3600000000});
    await waitForTransaction(reserveTx);
    console.log("Reserved 10 tier 1 to ", signer1.address);

    const mintTx = await validator.connect(signer1).mintValidatorPublic('0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2', 2, {value: ethers.utils.parseEther("0.2")});
    await waitForTransaction(mintTx);
    console.log("Minted");
    console.log("The Public Mint is: ", await validator.balanceOf('0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2') == 3);

    // //------------------------------------------------------------------------------------------------
    // //DirectTest6 upgrade and mint
    const wallet = new Wallet(PRIVATE_KEY);

    // Create deployer object and load the artifact of the contracts you want to deploy.
    const deployer = new Deployer(hre, wallet);
    const ValidatorNFTV2 = await deployer.loadArtifact('ValidatorNFTV2');

    const validatorNFTImpl = await deployer.deploy(ValidatorNFTV2);
    const upgradeTx = await validator.connect(signer1).upgradeTo(validatorNFTImpl.address);
    await waitForTransaction(upgradeTx);
    console.log("Upgraded to V2, implemented address: ", validatorNFTImpl.address);

    const result = await validatorNFTImpl.connect(signer1).testV2();
    console.log("If upgraded successfully? ", result);

    const mintTx = await validator.connect(signer1).mintValidatorPublic('0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2', 2, {value: ethers.utils.parseEther("0.2")});
    await waitForTransaction(mintTx);
    console.log("Minted");
    console.log("The Public Mint is: ", await validator.balanceOf('0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2') == 4);

    // //------------------------------------------------------------------------------------------------
    // //DirectTest7 withdraw
    const withdrawTx = await validator.connect(signer1).withdraw(ethers.utils.parseEther("0.75"));
    await waitForTransaction(withdrawTx);
    console.log("Withdraw Successfully");

    // //------------------------------------------------------------------------------------------------
    // //Claimer - Direct Test
    // //------------------------------------------------------------------------------------------------
    // //DirectTest1 Grant Mint Role and mint
    const AddtoValTx = await validator.connect(signer1).setAuthorizedCaller(userNFTProxyAddress, true);
    await waitForTransaction(AddtoValTx);
    console.log("Granted Authorized Call");

    const MINTER_ROLE = ethers.utils.solidityKeccak256(["string"], ["MINTER_ROLE"]);
    const grantTx = await claimer.connect(signer1).grantRole(MINTER_ROLE, '0xf689c767168f9d434aa62fa15c1ed1bad41ef255');
    await waitForTransaction(grantTx);
    console.log("Granted");

    const mintUserTx = await claimer.connect(signer2).mintClaimer(signer2.address, 0, 1500, ethers.constants.AddressZero, 1);
    await waitForTransaction(mintUserTx);
    console.log("Minted to User");
    console.log("The Public Mint is: ", await claimer.balanceOf(signer2.address) == 1);

    console.log("The Balance of Claimer: ", await claimer.balanceOf(signer2.address));

    // //------------------------------------------------------------------------------------------------
    // //DirectTest2 invalida paras
    const mintUserTx = await claimer.connect(signer2).mintClaimer(signer2.address, 0, 1500, ethers.constants.AddressZero, 1);
    await waitForTransaction(mintUserTx);
    console.log("Minted");
    // Result Passed: "message":"Failed to submit transaction: cannot estimate gas: Already Have Token"

    const mintUserTx1 = await claimer.connect(signer2).mintClaimer('0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2', 0, 155500, ethers.constants.AddressZero, 1);
    await waitForTransaction(mintUserTx1);
    console.log("Minted");
    // Result Passed: Failed to submit transaction: cannot estimate gas: Illegal Score

    const transferUserTx = await claimer.connect(signer2).transferFrom(signer2.address, signer1.address, 0);
    await waitForTransaction(transferUserTx);
    console.log("Cannot Transfer");
    // //Result Passed: Failed to submit transaction: cannot estimate gas: Illegal Score

    // //------------------------------------------------------------------------------------------------
    // //DirectTest3 Mint with Sig

    const web3 = new Web3(url);

    const to = '0x5c82eb01153e4173dc889ec3fb6df8694427b8c9';
    const validatorTokenId = 0;
    const karatScore = 1500;
    const lieutenantAddr = ethers.constants.AddressZero;
    const role = 1;


    const message = ethers.utils.defaultAbiCoder.encode([
        "address", "bytes32", "bytes32", "bytes32"
    ], [
        to, ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256"], [karatScore])),
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint8"], [role])),
        ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint"], [await signer1.getChainId()])),
    ]);
    const messageHash = ethers.utils.keccak256(message);

    // ··········································
    // Method1. SignMessage wth arrayify

    const credentials = {
        apiKey: 'AVMo1nH4u993zTQRBsQR4ZuctXyeBQNV',
        apiSecret: '4Y53JDZrRVQ5u15i8M7ug8ravZLSHgHGnEj5wiiZkJfX9x1s2PqhL1HcLsmad8fi'
    };
    const providerRelayer = new DefenderRelayProvider(credentials);
    const signerRelayer = new DefenderRelaySigner(credentials, providerRelayer, {speed: 'fast'});

    const signature111 = await signerRelayer.signMessage(ethers.utils.arrayify(messageHash));
    console.log("NEW SIG: ", signature111)
    // Same Signature
    // ··········································

    console.log("Chinid: ", await signer1.getChainId());
    // Method2. Sign the message with web3.eth.accounts.sign
    const {signature} = web3.eth.accounts.sign(messageHash, PRIVATE_KEY);
    console.log("SIGNATURE:", signature);

    const prefixedMessage = ethers.utils.solidityKeccak256([
        "string", "bytes32"
    ], ["\x19Ethereum Signed Message:\n32", messageHash]);
    const signingKey = ethers.utils.recoverPublicKey(prefixedMessage, signature111);
    console.log("\nSigning Key:", signingKey);
    const signerAddress = ethers.utils.computeAddress(signingKey);

    console.log("Recovered signer address:", signerAddress);
    console.log("Signer address:", signer1.address);

    const mintClaimerTx = await claimer.connect(signer1).mintClaimerwithSig(to, validatorTokenId, karatScore, lieutenantAddr, role, signature);
    await waitForTransaction(mintClaimerTx);
    console.log("MintwithSig is: ", await claimer.balanceOf(to) == 1);

    // //------------------------------------------------------------------------------------------------
    // //DirectTest4 Upgrade Claimer v2
    const wallet = new Wallet(PRIVATE_KEY);

    // Create deployer object and load the artifact of the contracts you want to deploy.
    const deployer = new Deployer(hre, wallet);
    const ClaimerNFTV2 = await deployer.loadArtifact('ClaimerNFTV2');

    const ClaimerNFTImpl = await deployer.deploy(ClaimerNFTV2);
    const upgradeTx = await claimer.connect(signer1).upgradeTo(ClaimerNFTImpl.address);
    await waitForTransaction(upgradeTx);
    console.log("Claimer Upgraded to V2, implemented address: ", ClaimerNFTImpl.address);

    const result = await claimer.testV2();
    console.log("If upgraded successfully? ", result);

    const mintTx = await claimer.connect(signer2).mintClaimer('0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2', 0, 1500, ethers.constants.AddressZero, 1);
    await waitForTransaction(mintTx);
    console.log("Minted");
    console.log("The Public Mint is: ", await validator.balanceOf('0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2') == 1);
}
