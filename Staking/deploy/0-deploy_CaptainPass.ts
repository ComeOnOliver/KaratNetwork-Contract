import { Wallet, utils, Provider } from "zksync-web3";
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
let CLAIMER: string;
let VALIDATOR: string;

if (process.env.NODE_ENV === 'test') {
  KAT = '0x047A34D736dfe20adb09Ea96a63b342B7e99108B';
  CLAIMER = '0xaFAEd50654E6692fc457fcD9FC5a83Ad66f0A531';
  VALIDATOR = '0xe5E254b980b2bAB8a715EBCA93d25387ea8a868B';
} else if (process.env.NODE_ENV === 'mainnet') {
  KAT = '0xCDb7D260c107499C80B4b748e8331c64595972a1';
  CLAIMER = '0x112E5059a4742ad8b2baF9C453fDA8695c200454';
  VALIDATOR = '0xbC27A252E879939B56aAeec8430B44b6721FC06E';
} else {
  // Handle other environments or set defaults
}


if (!KAT)
  throw "⛔️ KAT not detected! Add it to the .env file!";
console.log("Deploy Network: ", process.env.NODE_ENV);
console.log("KAT:", KAT);
console.log("CLAIMER:", CLAIMER);
console.log("VALIDATOR:", VALIDATOR);



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
  console.log(`Running deploy script for the Staking contract`);

  // Initialize the wallet.
  const provider = new Provider(hre.userConfig.networks?.zkSyncTestnet?.url);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  const zkWallet = new Wallet(PRIVATE_KEY);
  const deployer = new Deployer(hre, zkWallet);

  console.log("------------------------------------------------------------");

  const Captain = await deployer.loadArtifact("CaptainPass");
  const captain = await hre.zkUpgrades.deployProxy(deployer.zkWallet, Captain, ["Karat Captain Pass", "KCP", "https://api.karatdao.com/nft/captain/", KAT, VALIDATOR, ethers.constants.AddressZero], { initializer: "initialize" });

  await captain.connect(signer).setAuthorizedCaller(CLAIMER, true);
  console.log(`Captain set Claimer as Authorized Caller`);

  const contractFullyQualifedName1 = "contracts/test/CaptainPass.sol:CaptainPass";
  // Verify contract programmatically
  console.log("Now Verifying Both Contracts of Staking");
  const verificationId1 = await hre.run("verify:verify", {
    address: captain.address,
    contract: contractFullyQualifedName1,
    constructorArguments: [],
    bytecode: captain.bytecode,
  });
    updateEnvVariable("CAPTAIN_CONTRACT", captain.address);
}
