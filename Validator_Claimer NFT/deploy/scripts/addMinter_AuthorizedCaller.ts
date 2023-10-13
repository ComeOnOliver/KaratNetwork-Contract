import {Provider} from "zksync-web3";
import * as ethers from "ethers";
import {HardhatRuntimeEnvironment} from "hardhat/types";

// load env file
import dotenv from "dotenv";
dotenv.config();


// load contract artifact. Make sure to compile first!
import * as ContractArtifact from "../../artifacts-zk/contracts/Validator.sol/ValidatorNFT.json";
import * as UserArtifact from "../../artifacts-zk/contracts/Claimer.sol/ClaimerNFT.json";


const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

if (! PRIVATE_KEY) 
    throw "⛔️ Private key not detected! Add it to the .env file!";


// Address of the contract on zksync testnet
// Replace this with the address of the deployed ValidatorNFT proxy contract
const ValiCONTRACT_ADDRESS = '0xE366368B66aE4818847d5D97F13BB1FeEaE372DD';
const userNFTProxyAddress = '0xEAa94ACf3334C318484A2C1C26a05F7f6f2A204E';


if (! ValiCONTRACT_ADDRESS) 
    throw "⛔️ Contract address not provided";


// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre : HardhatRuntimeEnvironment) {


    const urls = {
        zkSyncTestnet: 'https://testnet.era.zksync.dev',
        zkMain: 'https://mainnet.era.zksync.io'
    };

    const network = hre.network.name;
    const url = urls[network as keyof typeof urls];
    console.log("URL: ", url);

    const provider = new Provider(url);

    console.log(`Running script to interact with contract ${UserArtifact}`);

    // Initialize the provider.
    // @ts-ignore

    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    // Initialise contract instance
    const contract = new ethers.Contract(userNFTProxyAddress, UserArtifact.abi, signer);

    const newMinterAddress = "0xE366368B66aE4818847d5D97F13BB1FeEaE372DD";
    const Minter_ROLE = ethers.utils.id("Minter_ROLE");

    console.log(`Adding address ${newMinterAddress} as a new minter...`);
    const tx = await contract.grantRole(Minter_ROLE, newMinterAddress);
    await tx.wait();
    console.log(`Address ${newMinterAddress} successfully added as a new minter.`);

    // Verify if the new address has the Minter_ROLE
    const isMinter = await contract.hasRole(Minter_ROLE, newMinterAddress);
    console.log(`Is ${newMinterAddress} a minter?`, isMinter);

    // Read message after transaction
    console.log(`The message now is ${
        await contract.hasRole(Minter_ROLE, newMinterAddress)
    }`);

    const Validatorcontract = new ethers.Contract(ValiCONTRACT_ADDRESS, ContractArtifact.abi, signer);

    // send transaction to update the message
    const tx1 = await Validatorcontract.setAuthorizedCaller(userNFTProxyAddress, true);

    console.log(`Transaction to change the message is ${
        tx1.hash
    }`);
    await tx1.wait();

    // Read message after transaction
    console.log(`The message now is ${
        await Validatorcontract.authorizedCallers(userNFTProxyAddress)
    }`);

}
