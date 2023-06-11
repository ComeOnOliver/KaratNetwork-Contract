import {ethers} from "hardhat";
import Escrow from "../../artifacts/contracts/Escrow.sol/Escrow.json";
import dotenv from "dotenv";
import {HardhatRuntimeEnvironment} from "hardhat/types";

dotenv.config();

const ERC20Tokens = {
    main: {
        tokens: {
            USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
            DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F"
        }
    }
};

async function main(hre : HardhatRuntimeEnvironment) {
    const privateKey = process.env.PRIVATE_KEY || "";

    const contractAddress = "0xcDa5B0E64D1AE306C632D8Bed5abC6DE9A77b62a";

    const urls = {
        mainnet: 'https://eth-mainnet.g.alchemy.com/v2/-c4AnGWtMVj4pF8l1jMjZn87VAuCL6DL',
        polygon: 'https://polygon-mainnet.g.alchemy.com/v2/-F1uYgZlfQcQN5B3xXcxTICRhxyqDo63',
        bsc: 'https://bsc-dataseed.binance.org/',
        bsc_testnet: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        goerli: 'https://eth-goerli.g.alchemy.com/v2/Mw8-Kd3V-RC5SeVKRAiJgVMEGQYQbZlm',
        mumbai: 'https://polygon-mumbai.g.alchemy.com/v2/_BuYhiU95d9Z3GowXbz876NwerOs3c90'
    };

    const network = hre.network.name;
    console.log("Network is: ", network);
    const url = urls[network as keyof typeof urls];
    console.log("URL: ", url);

    const provider = new ethers.providers.JsonRpcProvider(url);
    const wallet = new ethers.Wallet(privateKey, provider);

    const escrowContract = new ethers.Contract(contractAddress, Escrow.abi, wallet)as unknown as Escrow;

    for (const [tokenName, tokenAddress] of Object.entries(ERC20Tokens.main.tokens)) {
        await escrowContract.setToken(tokenAddress, true);
        console.log(`Authorized token added - ${tokenName}: ${tokenAddress}`);
    }
}

main(hre).then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
});
