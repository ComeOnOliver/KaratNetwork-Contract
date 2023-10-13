import { Wallet, utils } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import moment from 'moment-timezone';
import * as fs from "fs";

// load env file
import dotenv from "dotenv";
dotenv.config();

// load wallet private key from env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

let KAT: string;

if (process.env.NODE_ENV === 'test') {
  KAT = '0x047A34D736dfe20adb09Ea96a63b342B7e99108B';
} else if (process.env.NODE_ENV === 'mainnet') {
  KAT = '0xCDb7D260c107499C80B4b748e8331c64595972a1';
} else {
  // Handle other environments or set defaults
}

if (!KAT)
  throw "⛔️ KAT not detected! Add it to the .env file!";
console.log("Deploy Network: ", process.env.NODE_ENV);
console.log("KAT:", KAT);

const STAKING = process.env.STAKING_CONTRACT || "";
const CAPTAIN_CONTRACT = process.env.CAPTAIN_CONTRACT || "";

if (!STAKING) 
    throw "⛔️ Staking Contract not detected! Add it to the .env file!";


async function updateEnvVariable(variableName : string, variableValue : string) {
  const envFileContent = fs.readFileSync(".env", {encoding: "utf8"});

  const variableRegex = new RegExp(`^${variableName}=`, "m");
  const variableEntry = `${variableName}=${variableValue}`;

  const updatedContent = variableRegex.test(envFileContent) ? envFileContent.replace(variableRegex, variableEntry) : envFileContent + `\n${variableEntry}`;

  fs.writeFileSync(".env", updatedContent, {encoding: "utf8"});

  console.log(`Updated .env file with the new variable: ${variableName} with Value: `, variableValue);
}

if (!PRIVATE_KEY)
  throw "⛔️ Private key not detected! Add it to the .env file!";

// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(`Running deploy script for the Reward contract`);

  // Initialize the wallet.
  const wallet = new Wallet(PRIVATE_KEY);

  // Create deployer object and load the artifact of the contract you want to deploy.
  const deployer = new Deployer(hre, wallet);
  const reward = await deployer.loadArtifact("RewardDistributor");

  const totalGasEstimation = await hre.zkUpgrades.estimation.estimateGasProxy(deployer, reward, [], { kind: "uups" });

  const rewardContract = await hre.zkUpgrades.deployProxy(deployer.zkWallet, reward, [KAT, STAKING, CAPTAIN_CONTRACT], { initializer: "initialize" });

  // Show the contract info.
  const contractAddress = rewardContract.address;
  console.log(`${reward.contractName} was deployed to ${contractAddress}`);
  console.log("------------------------------------------------------------");

  // verify contract for tesnet & mainnet

    // Contract MUST be fully qualified name (e.g. path/sourceName:contractName)
    const contractFullyQualifedName = "contracts/KaratRewardv2.sol:RewardDistributor";

    // Verify contract programmatically
    console.log("Now Verifying Both Contracts of Staking");
    const verificationId = await hre.run("verify:verify", {
      address: contractAddress,
      contract: contractFullyQualifedName,
      constructorArguments: [],
      bytecode: reward.bytecode,
    });

    updateEnvVariable("REWARD_CONTRACT", contractAddress);
}
