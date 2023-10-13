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


if (process.env.NODE_ENV === 'test') {
    KAT = '0x047A34D736dfe20adb09Ea96a63b342B7e99108B';
    RELAYER = '0x5c82eb01153e4173dc889ec3fb6df8694427b8c9';

    CLAIMER = '0xaFAEd50654E6692fc457fcD9FC5a83Ad66f0A531';
  } else if (process.env.NODE_ENV === 'mainnet') {
    RELAYER = '0x6fe9e5384eccc78ccb30649e29f391a6b64fd681';

    KAT = '0xCDb7D260c107499C80B4b748e8331c64595972a1';
    CLAIMER = '0x112E5059a4742ad8b2baF9C453fDA8695c200454';
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

    console.log(`1. Running deploy script for the claimer relayer contract`);
    const provider = new Provider(hre.userConfig.networks?.zkSyncTestnet?.url);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  // Initialize the wallet.
  const wallet = new Wallet(PRIVATE_KEY);
  // Create deployer object and load the artifact of the contract you want to deploy.
  const deployer = new Deployer(hre, wallet);
  const relayer = await deployer.loadArtifact("ClaimerRelayer");

  const totalGasEstimation = await hre.zkUpgrades.estimation.estimateGasProxy(deployer, relayer, [], { kind: "uups" });
  const relayerContract = await hre.zkUpgrades.deployProxy(deployer.zkWallet, relayer, [KAT, STAKING_CONTRACT, CLAIMER, REWARD_CONTRACT], { initializer: "initialize" });
  // Show the contract info.
  const contractAddress = relayerContract.address;
  console.log(`${relayer.contractName} was deployed to ${contractAddress}`);
  console.log("------------------------------------------------------------");

  console.log(`2. Verifying the contracts`);
  const contractFullyQualifedName = "contracts/ClaimerRelayer.sol:ClaimerRelayer";

  const verificationId = await hre.run("verify:verify", {
    address: contractAddress,
    contract: contractFullyQualifedName,
    constructorArguments: [],
    bytecode: relayerContract.bytecode
});

updateEnvVariable("CLAIMERRELAYER_CONTRACT", contractAddress);
console.log("------------------------------------------------------------");
console.log(`3. Add Company Relayer as Authorzied Caller`);
const AUTHORIZEDCALLER = await relayerContract.AUTHORIZED_CALLER();

console.log(`Authorzied CAller Code: `, AUTHORIZEDCALLER);
await relayerContract.connect(signer).grantRole(AUTHORIZEDCALLER, RELAYER);
await delay(5000);
console.log(`CLAIMERRELAYER - Role of Authorized Caller Granted to Address `, RELAYER, `, result: `, await relayerContract.hasRole(AUTHORIZEDCALLER, RELAYER));


console.log(`4. Reading the Claimer contract and Grant MinterRole to Claimer Relayer`);
console.log("------------------------------------------------------------");

const claimer = new ethers.Contract(CLAIMER, CALIMER_ARTIFACTV2.abi, signer);
const MINTER_ROLE = await claimer.MINTER_ROLE();

await claimer.connect(signer).grantRole(MINTER_ROLE, contractAddress);
await delay(5000);
console.log(`claimer - Role of Authorized Caller Granted to Address `, contractAddress, `, result: `, await claimer.hasRole(MINTER_ROLE, contractAddress));

console.log("------------------------------------------------------------");
console.log("5. Reading Staking Contract and Grant Authorized Caller to Claimer Relayer");

const staking = new ethers.Contract(STAKING_CONTRACT, STAKING_ARTIFACT.abi, signer);

const AUTHORIZEDCALLER1 = await staking.AUTHORIZED_CALLER();

await staking.connect(signer).grantRole(AUTHORIZEDCALLER1, contractAddress);
await delay(5000);
console.log(`staking - Role of Authorized Caller Granted to Address `, contractAddress, `, result: `, await staking.hasRole(AUTHORIZEDCALLER1, contractAddress));

// console.log("------------------------------------------------------------");
// console.log("5. Upgrade Staking");

// console.log(`Tring to Upgrade Staker`);
// const staking = new ethers.Contract(STAKING_CONTRACT, STAKING_ARTIFACT.abi, signer);

// const StakingV2 = await deployer.loadArtifact("StakedKaratPoolToken");
  
// const stakingV2Impl = await deployer.deploy(StakingV2);
// await staking.connect(signer).upgradeTo(stakingV2Impl.address);
// console.log("Upgrade Contract Success. ");



// console.log("------------------------------------------------------------");
// console.log("7. setDaysNumToUnstake");
// await stakingV2.connect(signer).setDaysNumToUnstake(2);
// console.log("Update Successfully");

}
