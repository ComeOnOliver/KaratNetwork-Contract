import {Provider, Wallet} from "zksync-web3";
import * as ethers from "ethers";
import {HardhatRuntimeEnvironment} from "hardhat/types";
import dotenv from "dotenv";

const Web3 = require("web3");
dotenv.config();

import * as ContractArtifact from "../../artifacts-zk/contracts/Validator.sol/ValidatorNFT.json";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const ValiCONTRACT_ADDRESS = process.env.VALIDATOR_PROXY || "";

async function waitForTransaction(tx : any) {
    const receipt = await tx.wait();
    if (receipt.status !== 1) {
        throw new Error("Transaction failed");
    }
}

if (! PRIVATE_KEY) 
    throw "⛔️ Private key not detected! Add it to the .env file!";


if (! ValiCONTRACT_ADDRESS) 
    throw "⛔️ No Validator Proxy Address! Add it to the .env file!";


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

    const validator = new ethers.Contract(ValiCONTRACT_ADDRESS, ContractArtifact.abi, signer1);
    console.log("Contract Loaded");
    console.log("Now Check Initialization");
    console.log("Current Stage is: ", await validator.currentStage());
    console.log("Current Merkle Root is: ", await validator.whitelistMerkleRoot());
    console.log("Current BaseURI is: ", await validator.baseURI());
    console.log("Current Price of Tier1 is: eth ", ethers.utils.formatUnits(await validator.price(1), 18));
    console.log("Current Price of Tier2 is: eth ", ethers.utils.formatUnits(await validator.price(2), 18));
    console.log("Current Batch of Tier1 is: ", (await validator.mintBatch(1)).toString());
    console.log("Current Batch of Tier2 is: ", (await validator.mintBatch(2)).toString());

    // Reserve 30 tier1 to signer1

    const ToAddress = signer1.address; // Change if needed
    const reserveTx = await validator.connect(signer1).reserveValidator(ToAddress, 30, 1, {gasLimit: 3600000000});
    await waitForTransaction(reserveTx);
    console.log("30 Tier1 has minted to ", ToAddress);
    const tier1Bal = await validator.balanceOf(ToAddress);
    console.log("If ", ToAddress, " has 30 tier1 Validators? ", tier1Bal == 30);

}
