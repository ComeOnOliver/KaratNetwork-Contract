import {Wallet, Provider} from 'zksync-web3';
import {ethers} from 'ethers';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {Deployer} from '@matterlabs/hardhat-zksync-deploy';
import dotenv from 'dotenv';


dotenv.config();

// load contract artifact. Make sure to compile first!
import * as ContractArtifact from "../../artifacts-zk/contracts/Validator.sol/ValidatorNFT.json";


export default async function (hre : HardhatRuntimeEnvironment) {
    console.log(`Upgrading ValidatorNFT to ValidatorV2`);

    const privateKey = process.env.PRIVATE_KEY || '';
    const wallet = new Wallet(privateKey);

    const deployer = new Deployer(hre, wallet);

    const urls = {
        zkSyncTestnet: 'https://testnet.era.zksync.dev',
        zkMain: 'https://mainnet.era.zksync.io'
    };

    const network = hre.network.name;
    const url = urls[network as keyof typeof urls];
    console.log("URL: ", url);

    const provider = new Provider(url);
    const signer = new ethers.Wallet(privateKey, provider);

    const ValidatorV2 = await deployer.loadArtifact('ValidatorNFTV2'); // Replace 'ValidatorV2' with your new version of the contract
    const validatorV2Impl = await deployer.deploy(ValidatorV2);
    await validatorV2Impl.deployed();

    console.log("ValidatorV2 implementation deployed at:", validatorV2Impl.address);

    const proxyAddress = ""; // Replace with your validator proxy address
    const contract = new ethers.Contract(proxyAddress, ContractArtifact.abi, signer);

    await contract.upgradeTo(validatorV2Impl.address);

    console.log("Upgraded");
}
