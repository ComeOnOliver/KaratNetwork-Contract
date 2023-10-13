import {Wallet, utils, Provider} from "zksync-web3";
import * as ethers from "ethers";
import {HardhatRuntimeEnvironment} from "hardhat/types";
import {Deployer} from "@matterlabs/hardhat-zksync-deploy";
import moment from 'moment-timezone';
import * as fs from "fs";
// load env file
import dotenv from "dotenv";
dotenv.config();

import * as STAKING_ARTIFACT from "../artifacts-zk/contracts/KaratStakingv2.sol/StakedKaratPoolToken.json";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
if (!PRIVATE_KEY) throw "⛔️ Private key not detected! Add it to the .env file!";

console.log("Deploy Network: ", process.env.NODE_ENV);


const STAKING = process.env.STAKING_CONTRACT || "";
if (!STAKING) throw "⛔️ STAKING Contract address not provided";

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}


//Change here first;


let recipient_list = ['0x31C5bd64D62cca56aA3A5e8486c7d9103EfFb5Fc'];
let amount = 1000;
let validatorId = 1;
let decimals = 18;









export default async function (hre : HardhatRuntimeEnvironment) {


    const provider = new Provider(hre.userConfig.networks?.zkSyncTestnet?.url);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const staking = new ethers.Contract(STAKING, STAKING_ARTIFACT.abi, signer);
    let amountBigInt = BigInt(amount) * BigInt(10 ** decimals);

    for (const recipient of recipient_list) {
        await staking.connect(signer).stakeTo(recipient, amountBigInt, validatorId);
        await delay(5000);
        console.log(`\nStaked To `, recipient, `amount: `, amount);
    }
}