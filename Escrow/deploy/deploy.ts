import { ethers, upgrades } from "hardhat";
import dotenv from "dotenv";
import { Escrow__factory } from "./types/ethers-contracts";
import { HardhatRuntimeEnvironment } from "hardhat/types";

dotenv.config();

const Tokens = {
    tokens: {
        BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
        USDC: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
        USDT: "0x55d398326f99059ff775485246999027b3197955",
    },
};

async function main(hre: HardhatRuntimeEnvironment) {
    const privateKey = process.env.PRIVATE_KEY || "";

    const urls = {
        mainnet: 'https://eth-mainnet.g.alchemy.com/v2/-c4AnGWtMVj4pF8l1jMjZn87VAuCL6DL',
        polygon: 'https://polygon-mainnet.g.alchemy.com/v2/-F1uYgZlfQcQN5B3xXcxTICRhxyqDo63',
        bsc: 'https://bsc-dataseed.binance.org/',
        bsc_testnet: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        goerli: 'https://eth-goerli.g.alchemy.com/v2/Mw8-Kd3V-RC5SeVKRAiJgVMEGQYQbZlm',
        mumbai: 'https://polygon-mumbai.g.alchemy.com/v2/_BuYhiU95d9Z3GowXbz876NwerOs3c90',
    };

    const network = hre.network.name;
    console.log("Network is: ", network);
    const url = urls[network as keyof typeof urls];
    console.log("URL: ", url);

    const provider = new ethers.providers.JsonRpcProvider(url);
    const wallet = new ethers.Wallet(privateKey, provider);

    const EscrowFactory = (await ethers.getContractFactory("Escrow", wallet)) as Escrow__factory;
    const escrow = await upgrades.deployProxy(EscrowFactory, [], { initializer: "initialize" });

    await escrow.deployed();
    console.log("Escrow deployed to:", escrow.address);

    const currentImplAddress = await upgrades.erc1967.getImplementationAddress(escrow.address);
    console.log("Escrow ", network, " implementation deployed to:", currentImplAddress);

    const abi = EscrowFactory.interface.format(ethers.utils.FormatTypes.json);  // Get the ABI from the factory
    const esImpl = new ethers.Contract(currentImplAddress, abi, wallet);
    await esImpl.initialize();
    console.log("Implementation Initialized");

    // Add authorized tokens
    for (const [tokenName, tokenAddress] of Object.entries(Tokens.tokens)) {
        await escrow.setToken(tokenAddress, true);
        console.log(`Authorized token added - ${tokenName}: ${tokenAddress}`);
    }
}

main(hre)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });