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
const ValiCONTRACT_ADDRESS = '';
const userNFTProxyAddress = '';


if (! ValiCONTRACT_ADDRESS) 
    throw "⛔️ Contract address not provided";


// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre : HardhatRuntimeEnvironment) {
    console.log(`Running script to interact with contract ${UserArtifact}`);

    // Initialize the provider.
    // @ts-ignore

    const urls = {
        zkSyncTestnet: 'https://testnet.era.zksync.dev',
        zkMain: 'https://mainnet.era.zksync.io'
    };

    const network = hre.network.name;
    const url = urls[network as keyof typeof urls];
    console.log("URL: ", url);

    const provider = new Provider(url);

    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    // Initialise contract instance
    const contract = new ethers.Contract(userNFTProxyAddress, UserArtifact.abi, signer);

    // get implementation address
    const slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const implementationAddress = await provider.getStorageAt(userNFTProxyAddress, slot);
    const implementationAddress1 = ethers.utils.getAddress(ethers.BigNumber.from(implementationAddress).toHexString());
    console.log(`Address ${implementationAddress1} is the implementation for validator`);


    const newMinterAddress = "";
    const Owner_ROLE = ethers.utils.id("DEFAULT_ADMIN_ROLE");

    console.log(`Adding address ${newMinterAddress} as a new owner...`);
    const tx = await contract.grantRole(Owner_ROLE, newMinterAddress);
    await tx.wait();
    console.log(`Address ${newMinterAddress} successfully added as a new minter.`);

    // Verify if the new address has the Minter_ROLE
    const isMinter = await contract.hasRole(Owner_ROLE, newMinterAddress);
    console.log(`Is ${newMinterAddress} a minter?`, isMinter);

    const Validatorcontract = new ethers.Contract(ValiCONTRACT_ADDRESS, ContractArtifact.abi, signer);

    // send transaction to update the message
    const tx1 = await Validatorcontract.startPreSale();

    console.log(`Transaction to change the message is ${
        tx1.hash
    }`);
    await tx1.wait();

    // Read message after transaction
    console.log(`The message now is ${
        await Validatorcontract.currentStage()
    }`);

}
