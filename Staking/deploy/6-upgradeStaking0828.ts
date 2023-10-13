import { Wallet, utils, Provider } from "zksync-web3";
import * as ethers from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";

import * as STAKING_ARTIFACT from "../artifacts-zk/contracts/KaratStakingv2.sol/StakedKaratPoolToken.json";

// load env file
import dotenv from "dotenv";
dotenv.config();

// load wallet private key from env file
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const STAKING_CONTRACT = process.env.STAKING_CONTRACT || "";

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

  // Create deployer object and load the artifact of the contract you want to deploy.
  const staking = new ethers.Contract(STAKING_CONTRACT, STAKING_ARTIFACT.abi, signer);

  console.log(`Tring to Upgrade Staker`);
  const StakingV2 = await deployer.loadArtifact("StakedKaratPoolToken");
  
  const stakingV2Impl = await deployer.deploy(StakingV2);
  await staking.connect(signer).upgradeTo(stakingV2Impl.address);
  
  console.log("Upgrade Contract Success. ");
}