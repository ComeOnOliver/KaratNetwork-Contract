import {Wallet, utils, Provider} from "zksync-web3";
import * as ethers from "ethers";
import {HardhatRuntimeEnvironment} from "hardhat/types";
import {Deployer} from "@matterlabs/hardhat-zksync-deploy";
import moment from 'moment-timezone';
import * as fs from "fs";

// load env file
import dotenv from "dotenv";
dotenv.config();

// load contract artifact. Make sure to compile first!
import * as VALIDATOR_ARTIFACT from "../artifacts-zk/contracts/test/Validator.sol/ValidatorNFT.json";
import * as CALIMER_ARTIFACT from "../artifacts-zk/contracts/test/Claimer.sol/ClaimerNFT.json";
import * as CALIMERRELAYER_ARTIFACT from "../artifacts-zk/contracts/ClaimerRelayer.sol/ClaimerRelayer.json";
import * as STAKING_ARTIFACT from "../artifacts-zk/contracts/KaratStakingv2.sol/StakedKaratPoolToken.json";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

if (!PRIVATE_KEY) throw "⛔️ Private key not detected! Add it to the .env file!";

// Address of the contract on zksync testnet

let CLAIMER: string;
let RELAYER: string;

if (process.env.NODE_ENV === 'test') {
    RELAYER = '0x5c82eb01153e4173dc889ec3fb6df8694427b8c9';
  CLAIMER = '0xaFAEd50654E6692fc457fcD9FC5a83Ad66f0A531';
} else if (process.env.NODE_ENV === 'mainnet') {
    RELAYER = '0x6fe9e5384eccc78ccb30649e29f391a6b64fd681';
  CLAIMER = '0x112E5059a4742ad8b2baF9C453fDA8695c200454';
} else {
  // Handle other environments or set defaults
}

if (!CLAIMER)
  throw "⛔️ KAT not detected! Add it to the .env file!";
console.log("Deploy Network: ", process.env.NODE_ENV);

console.log("CLAIMER:", CLAIMER);


const STAKING = process.env.STAKING_CONTRACT || "";
const REWARD = process.env.REWARD_CONTRACT || "";
const CLAIMERRELAYER = process.env.CLAIMERRELAYER_CONTRACT || "";

if (!STAKING) throw "⛔️ STAKING Contract address not provided";
if (!REWARD) throw "⛔️ REWARD Contract address not provided";
if (!CLAIMERRELAYER) throw "⛔️ CLAIMERRELAYER Contract address not provided";

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function (hre : HardhatRuntimeEnvironment) {
    console.log(`1. Reading the Claimer Relayer contract`);

    const provider = new Provider(hre.userConfig.networks?.zkSyncTestnet?.url);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    const contract = new ethers.Contract(CLAIMERRELAYER, CALIMERRELAYER_ARTIFACT.abi, signer);

    // Read message from contract
    console.log(`CLAIMERRELAYER Contract ${await contract.AUTHORIZED_CALLER()}, Contract Loaded`);
    const AUTHORIZEDCALLER = await contract.AUTHORIZED_CALLER();

    console.log(`Authorzied CAller Code: `, AUTHORIZEDCALLER);
    await contract.connect(signer).grantRole(AUTHORIZEDCALLER, RELAYER);

    await delay(5000);
    console.log(`CLAIMERRELAYER - Role of Authorized Caller Granted to Address `, RELAYER, `, result: `, await contract.hasRole(AUTHORIZEDCALLER, RELAYER));
    console.log(`2. Reading the Claimer contract`);
    console.log("------------------------------------------------------------");

    const claimer = new ethers.Contract(CLAIMER, CALIMER_ARTIFACT.abi, signer);
    const MINTER_ROLE = await claimer.MINTER_ROLE();

    await claimer.connect(signer).grantRole(MINTER_ROLE, CLAIMERRELAYER);
    await delay(5000);
    console.log(`claimer - Role of Authorized Caller Granted to Address `, CLAIMERRELAYER, `, result: `, await claimer.hasRole(MINTER_ROLE, CLAIMERRELAYER));

    console.log("------------------------------------------------------------");
    console.log("3. Reading Staking Contract");

    const staking = new ethers.Contract(STAKING, STAKING_ARTIFACT.abi, signer);
    const AUTHORIZEDCALLER1 = await staking.AUTHORIZED_CALLER();

    await staking.connect(signer).grantRole(AUTHORIZEDCALLER1, CLAIMERRELAYER);
    await delay(5000);
    console.log(`staking - Role of Authorized Caller Granted to Address `, CLAIMERRELAYER, `, result: `, await staking.hasRole(AUTHORIZEDCALLER1, CLAIMERRELAYER));

    console.log("------------------------------------------------------------");
    await staking.connect(signer).grantRole(AUTHORIZEDCALLER1, REWARD);
    await delay(5000);
    console.log(`staking - Role of Authorized Caller Granted to Address `, REWARD, `, result: `, await staking.hasRole(AUTHORIZEDCALLER1, REWARD));

}
