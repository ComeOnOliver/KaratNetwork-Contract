import { Wallet, utils, Provider } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import moment from 'moment-timezone';
import * as fs from "fs";

import * as CALIMER_ARTIFACTV2 from "../artifacts-zk/contracts/test/ClaimerV2.sol/ClaimerNFTV2.json";
import * as CAPTAIN_ABI from "../artifacts-zk/contracts/test/CaptainPass.sol/CaptainPass.json";
import * as STAKING_ARTIFACT from "../artifacts-zk/contracts/KaratStakingv2.sol/StakedKaratPoolToken.json";


// load env file
import dotenv from "dotenv";
dotenv.config();

// load wallet private key from env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const CAPTAIN_ADDRESS = process.env.CAPTAIN_CONTRACT || "";
const STAKING_CONTRACT = process.env.STAKING_CONTRACT || "";
const REWARD_CONTRACT = process.env.REWARD_CONTRACT || "";

let KAT: string;
let CLAIMER: string;
let VALIDATOR: string;
let RELAYER: string;
let old_CLAIMRELAYER: any;

if (process.env.NODE_ENV === 'test') {
    KAT = '0x047A34D736dfe20adb09Ea96a63b342B7e99108B';
    RELAYER = '0x5c82eb01153e4173dc889ec3fb6df8694427b8c9';

    CLAIMER = '0xaFAEd50654E6692fc457fcD9FC5a83Ad66f0A531';
    old_CLAIMRELAYER = '0x2DB2D010230605Ad4Db011A54a8aAc205e43779E';

  } else if (process.env.NODE_ENV === 'mainnet') {
    RELAYER = '0x6fe9e5384eccc78ccb30649e29f391a6b64fd681';

    KAT = '0xCDb7D260c107499C80B4b748e8331c64595972a1';
    CLAIMER = '0x112E5059a4742ad8b2baF9C453fDA8695c200454';
    old_CLAIMRELAYER = '0x2DB2D010230605Ad4Db011A54a8aAc205e43779E';
  } else {
    // Handle other environments or set defaults
  }

if (!PRIVATE_KEY)
throw "⛔️ Private key not detected! Add it to the .env file!";
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

console.log("Deploy Network: ", process.env.NODE_ENV);
console.log("CAPTAIN ADDRESS:", CAPTAIN_ADDRESS);

async function updateEnvVariable(variableName : string, variableValue : string) {
    const envFileContent = fs.readFileSync(".env", {encoding: "utf8"});
  
    const variableRegex = new RegExp(`^${variableName}=`, "m");
    const variableEntry = `${variableName}=${variableValue}`;
  
    const updatedContent = variableRegex.test(envFileContent) ? envFileContent.replace(variableRegex, variableEntry) : envFileContent + `\n${variableEntry}`;
  
    fs.writeFileSync(".env", updatedContent, {encoding: "utf8"});
  
    console.log(`Updated .env file with the new variable: ${variableName} with Value: `, variableValue);
  }

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {

    console.log(`1. Running deploy script for the staking contract`);
    const provider = new Provider(hre.userConfig.networks?.zkSyncTestnet?.url);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    // Initialize the wallet.
    const wallet = new Wallet(PRIVATE_KEY);
     // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);
    const staking = new ethers.Contract(STAKING_CONTRACT, STAKING_ARTIFACT.abi, signer);

    const StakingV2 = await deployer.loadArtifact("StakedKaratPoolToken");
    const AUTHORIZEDCALLER1 = await staking.AUTHORIZED_CALLER();

    const stakingV2Impl = await deployer.deploy(StakingV2);
    await staking.connect(signer).upgradeTo(stakingV2Impl.address);
    console.log("Upgrade Contract Success. ");


  console.log("------------------------------------------------------------");

  console.log(`2. Verifying the contracts`);
  const contractFullyQualifedName = "contracts/KaratStakingv2.sol:StakedKaratPoolToken";

  const verificationId = await hre.run("verify:verify", {
    address: STAKING_CONTRACT,
    contract: contractFullyQualifedName,
    constructorArguments: [],
    bytecode: STAKING_ARTIFACT.bytecode
});
const stakingV2 = new ethers.Contract(STAKING_CONTRACT, STAKING_ARTIFACT.abi, signer);

console.log("------------------------------------------------------------");
console.log("3. setDaysNumToUnstake");
await stakingV2.connect(signer).setMinDaysToUnstake(2);
console.log("Update Successfully");

console.log("------------------------------------------------------------");
console.log("4. Staking Revoke Claimer Relayer");

await stakingV2.connect(signer).revokeRole(AUTHORIZEDCALLER1, old_CLAIMRELAYER);
await delay(5000);
console.log(`staking - Role of Authorized Caller Revoked From`, old_CLAIMRELAYER, `, result: `, await stakingV2.hasRole(AUTHORIZEDCALLER1, old_CLAIMRELAYER));
console.log("Revoke Successfully");


console.log("------------------------------------------------------------");
console.log("5. claimer revoke Original Relayer Address");
const claimer = new ethers.Contract(CLAIMER, CALIMER_ARTIFACTV2.abi, signer);
const MINTER_ROLE = await claimer.MINTER_ROLE();

await claimer.connect(signer).revokeRole(MINTER_ROLE, old_CLAIMRELAYER);
await delay(5000);
console.log(`claimer - Role of Minter ROle Roveked to Address `, old_CLAIMRELAYER, `, result: `, await claimer.hasRole(MINTER_ROLE, old_CLAIMRELAYER));

console.log("Revoke Successfully");


}
