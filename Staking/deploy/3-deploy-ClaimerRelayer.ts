import {Wallet, utils} from "zksync-web3";
import * as ethers from "ethers";
import {HardhatRuntimeEnvironment} from "hardhat/types";
import {Deployer} from "@matterlabs/hardhat-zksync-deploy";
import moment from 'moment-timezone';
import * as fs from "fs";

// load env file
import dotenv from "dotenv";
dotenv.config();

// load wallet private key from env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

let KAT: string;
let CLAIMER: string;

if (process.env.NODE_ENV === 'test') {
  KAT = '0x047A34D736dfe20adb09Ea96a63b342B7e99108B';
  CLAIMER = '0xaFAEd50654E6692fc457fcD9FC5a83Ad66f0A531';
} else if (process.env.NODE_ENV === 'mainnet') {
  KAT = '0xCDb7D260c107499C80B4b748e8331c64595972a1';
  CLAIMER = '0x112E5059a4742ad8b2baF9C453fDA8695c200454';
} else {
  // Handle other environments or set defaults
}


if (!KAT)
  throw "⛔️ KAT not detected! Add it to the .env file!";
console.log("Deploy Network: ", process.env.NODE_ENV);
console.log("KAT:", KAT);
console.log("CLAIMER:", CLAIMER);

const STAKING = process.env.STAKING_CONTRACT || "";
const REWARD = process.env.REWARD_CONTRACT || "";

if (! STAKING) 
    throw "⛔️ Staking Contract not detected! Add it to the .env file!";

if (! REWARD) 
    throw "⛔️ Staking Contract not detected! Add it to the .env file!";



async function updateEnvVariable(variableName : string, variableValue : string) {
    const envFileContent = fs.readFileSync(".env", {encoding: "utf8"});

    const variableRegex = new RegExp(`^${variableName}=`, "m");
    const variableEntry = `${variableName}=${variableValue}`;

    const updatedContent = variableRegex.test(envFileContent) ? envFileContent.replace(variableRegex, variableEntry) : envFileContent + `\n${variableEntry}`;

    fs.writeFileSync(".env", updatedContent, {encoding: "utf8"});

    console.log(`Updated .env file with the new variable: ${variableName} with Value: `, variableValue);
}

if (! PRIVATE_KEY) 
    throw "⛔️ Private key not detected! Add it to the .env file!";


function getUnixTime3pmOfDayPST(): number {
      // Get the current time in PST
      const startOfDayInPST = moment().tz('America/Los_Angeles').startOf('day');
      const fivePmInPST = startOfDayInPST.add(15, 'hours');
      
      // Convert the time to Unix format
      const unixTime = fivePmInPST.unix();
    
      return unixTime;
    }

    
// An example of a deploy script that will deploy and call a simple contract.
export default async function (hre : HardhatRuntimeEnvironment) {
    console.log(`Running deploy script for the Claimer Relayer contract`);

    // Initialize the wallet.
    const wallet = new Wallet(PRIVATE_KEY);

    // Create deployer object and load the artifact of the contract you want to deploy.
    const deployer = new Deployer(hre, wallet);
    const artifact = await deployer.loadArtifact("ClaimerRelayer");

    console.log("The first day Unix Time is: ", getUnixTime3pmOfDayPST());
    const firstDAY = getUnixTime3pmOfDayPST();

    // Estimate contract deployment fee
    const deploymentFee = await deployer.estimateDeployFee(artifact, [KAT, STAKING, CLAIMER, REWARD, firstDAY]);

    const parsedFee = ethers.utils.formatEther(deploymentFee.toString());
    console.log(`The deployment is estimated to cost ${parsedFee} ETH`);
  
    const ClaimerRelayerContract = await deployer.deploy(artifact, [KAT, STAKING, CLAIMER, REWARD, firstDAY]);

    const contractAddress = ClaimerRelayerContract.address;
    console.log(`${artifact.contractName} was deployed to ${contractAddress}`);



    console.log("------------------------------------------------------------");

    // verify contract for tesnet & mainnet

    // Contract MUST be fully qualified name (e.g. path/sourceName:contractName)
    const contractFullyQualifedName = "contracts/ClaimerRelayer.sol:ClaimerRelayer";

    // Verify contract programmatically
    console.log("Now Verifying Both Contracts of Claimer Relayer");
    const verificationId = await hre.run("verify:verify", {
        address: contractAddress,
        contract: contractFullyQualifedName,
        constructorArguments: [KAT, STAKING, CLAIMER, REWARD, firstDAY],
        bytecode: ClaimerRelayerContract.bytecode
    });

    updateEnvVariable("CLAIMERRELAYER_CONTRACT", contractAddress);
}
