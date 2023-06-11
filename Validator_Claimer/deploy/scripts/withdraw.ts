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
    console.log("Validator Contract Loaded");

    // Get contract balance
    const balance = await provider.getBalance(ValiCONTRACT_ADDRESS);
    console.log(`Contract balance: ${
        balance.toString()
    }`);

    if (balance.gt(0)) {
        const tx = await validator.connect(signer1).withdraw(balance);
        await waitForTransaction(tx);
        console.log(`Withdrawn ${
            balance.toString()
        } from the contract to the address ${
            signer1.address
        }`);
    } else {
        console.log("No balance in the contract to withdraw");
    }
}
