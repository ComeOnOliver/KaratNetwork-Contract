import {Provider, Wallet} from "zksync-web3";
import {HardhatRuntimeEnvironment} from "hardhat/types";
import dotenv from "dotenv";
import {Deployer} from '@matterlabs/hardhat-zksync-deploy';
import * as fs from "fs";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
let merkleRoot: string;

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


const validator_address = '0x50ef67d65DD2e0f8F335Bfd1eb283E7e64dC8d94';

export default async function (hre : HardhatRuntimeEnvironment) {

    console.log(`Running deploy script for the ValidatorNFT.\n`);

    const wallet = new Wallet(PRIVATE_KEY);
    const deployer = new Deployer(hre, wallet);
    const ClaimerNFT = await deployer.loadArtifact('ClaimerNFT');
    const MyERC1967Proxy = await deployer.loadArtifact('MyERC1967Proxy');

    // Parameters for the UserNFT contract constructor
    const userNFTParams = [
        'Karat Claimer',
        'KAC',
        validator_address, // ValidatorNFT proxy contract address
        'https://api.karatdao.com/nft/claimer/',
        1500, // maxInitialKaratScore
    ];

    // Deploy the UserNFT implementation contract
    const userNFTImpl = await deployer.deploy(ClaimerNFT);

    await userNFTImpl.initialize(userNFTParams[0], userNFTParams[1], userNFTParams[2], userNFTParams[3], userNFTParams[4]);
    console.log(`Claimer Implementation Initialized`);

    // Deploy the ERC1967Proxy for ValidatorNFT
    const userNFTInitData = userNFTImpl.interface.encodeFunctionData('initialize', userNFTParams);

    const claimerProxy = await deployer.deploy(MyERC1967Proxy, [userNFTImpl.address, userNFTInitData]);
    console.log(`Claimer deployed at: ${
        claimerProxy.address
    }`);
    console.log(`Claimer Implementation deployed at: ${
        userNFTImpl.address
    }`);
    console.log(`Claimer Initialization data: ${userNFTInitData}`);

    updateEnvVariable("CLAIMER_PROXY", claimerProxy.address);

}
