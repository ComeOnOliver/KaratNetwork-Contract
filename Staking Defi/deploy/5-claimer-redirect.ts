import { Wallet, utils, Provider } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import moment from 'moment-timezone';
import * as fs from "fs";

import * as CALIMER_ARTIFACTV2 from "../artifacts-zk/contracts/test/ClaimerV2.sol/ClaimerNFTV2.json";
import * as CAPTAIN_ABI from "../artifacts-zk/contracts/test/CaptainPass.sol/CaptainPass.json";


// load env file
import dotenv from "dotenv";
dotenv.config();

// load wallet private key from env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const CAPTAIN_ADDRESS = process.env.CAPTAIN_CONTRACT || "";
const STAKING_CONTRACT = process.env.STAKING_CONTRACT || "";


let KAT: string;
let CLAIMER: string;
let VALIDATOR: string;

if (process.env.NODE_ENV === 'test') {
  CLAIMER = '0xaFAEd50654E6692fc457fcD9FC5a83Ad66f0A531';
} else if (process.env.NODE_ENV === 'mainnet') {
  CLAIMER = '0x112E5059a4742ad8b2baF9C453fDA8695c200454';
} else {
  // Handle other environments or set defaults
}



if (!CAPTAIN_ADDRESS)
  throw "⛔️ KAT not detected! Add it to the .env file!";
if (!PRIVATE_KEY)
throw "⛔️ Private key not detected! Add it to the .env file!";

console.log("Deploy Network: ", process.env.NODE_ENV);
console.log("CAPTAIN ADDRESS:", CAPTAIN_ADDRESS);


// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {

  console.log(`Running deploy script for the Staking contract`);

  // Initialize the wallet.
  const provider = new Provider(hre.userConfig.networks?.zkSyncTestnet?.url);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  const captain = new ethers.Contract(CAPTAIN_ADDRESS, CAPTAIN_ABI.abi, signer);
  await captain.connect(signer).updateStakingConrtact(STAKING_CONTRACT);

  console.log("Update captain's staking Address");

    const claimerv2 = new ethers.Contract(CLAIMER, CALIMER_ARTIFACTV2.abi, signer);
    await claimerv2.connect(signer).updateValidatorAddress(CAPTAIN_ADDRESS);

    console.log("Update Claimer V2 Contract to redirect captain success");
}
