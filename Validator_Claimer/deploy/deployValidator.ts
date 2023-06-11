import {Provider, Wallet} from "zksync-web3";
import {HardhatRuntimeEnvironment} from "hardhat/types";
import dotenv from "dotenv";
import {Deployer} from '@matterlabs/hardhat-zksync-deploy';
import {ethers, upgrades} from "hardhat";
import * as fs from "fs";

const Web3 = require("web3");
dotenv.config();
let merkleRoot: string;

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";


async function waitForTransaction(tx : any) {
    const receipt = await tx.wait();
    if (receipt.status !== 1) {
        throw new Error("Transaction failed");
    }
}

async function updateEnvVariable(variableName : string, variableValue : string) {
    const envFileContent = fs.readFileSync(".env", {encoding: "utf8"});

    const variableRegex = new RegExp(`^${variableName}=`, "m");
    const variableEntry = `${variableName}=${variableValue}`;

    const updatedContent = variableRegex.test(envFileContent) ? envFileContent.replace(variableRegex, variableEntry) : envFileContent + `\n${variableEntry}`;

    fs.writeFileSync(".env", updatedContent, {encoding: "utf8"});

    console.log(`Updated .env file with the new variable: ${variableName} with Value: `, variableValue);
}

if (! PRIVATE_KEY) 
    throw "⛔️ Private key not detected! Add it to the .env file!";


export default async function (hre : HardhatRuntimeEnvironment) {


    const wallet = new Wallet(PRIVATE_KEY);
    const deployer = new Deployer(hre, wallet);
    const ValidatorNFT = await deployer.loadArtifact('ValidatorNFT');

    console.log(`ValidatorNFT Artifact loaded`);

    // Create ERC1967Proxy contracts for both ValidatorNFT and UserNFT
    const MyERC1967Proxy = await deployer.loadArtifact('MyERC1967Proxy');
    console.log(`ValidatorNFT Proxy Artifact Loaded`);

    // Initialization Paras
    const validatorNFTParams = [
        'Karat Validator',
        'KAV',
        'https://api.karatdao.com/nft/validator/',
        '0x1311cd1e3f1c0557dfb74dd5b266d3519d5049a6fe0724c53d42f6c089b53bb7',
        30,
        300,
    ];

    // Deploy the ValidatorNFT implementation contract
    const validatorNFTImpl = await deployer.deploy(ValidatorNFT);
    console.log(`ValidatorNFT Implementation Contract Deployed`);
    await validatorNFTImpl.initialize(validatorNFTParams[0], validatorNFTParams[1], validatorNFTParams[2], validatorNFTParams[3], validatorNFTParams[4], validatorNFTParams[5]);
    console.log(`ValidatorNFT Implementation Initialized`);

    // Deploy the ERC1967Proxy for ValidatorNFT
    const validatorNFTInitData = validatorNFTImpl.interface.encodeFunctionData('initialize', validatorNFTParams);

    const validatorNFTProxy = await deployer.deploy(MyERC1967Proxy, [validatorNFTImpl.address, validatorNFTInitData]);

    console.log(`ValidatorNFT Proxy deployed at: ${
        validatorNFTProxy.address
    }`);
    console.log(`ValidatorNFT Implementation deployed at: ${
        validatorNFTImpl.address
    }`);
    console.log(`ValidatorNFT Initialization data: ${validatorNFTInitData}`);

    updateEnvVariable("VALIDATOR_PROXY", validatorNFTProxy.address);
}
