import {ethers} from "hardhat";
import Escrow from "../../artifacts/contracts/Escrow.sol/Escrow.json";
import dotenv from "dotenv";
import {HardhatRuntimeEnvironment} from "hardhat/types";


dotenv.config();

async function main(hre : HardhatRuntimeEnvironment) {
    const privateKey = process.env.PRIVATE_KEY || "";

    const contractAddress = "";

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

    const escrowContract = new ethers.Contract(contractAddress, Escrow.abi, wallet);

    // Get contract balance
    const balance = await provider.getBalance(contractAddress);
    console.log(`Contract balance: ${
        ethers.utils.formatEther(balance)
    } ETH`);

    // Withdraw all funds if balance > 0
    if (balance.gt(0)) {
        console.log("Withdrawing all funds from the contract...");
        const withdrawTx = await escrowContract.withdraw(ethers.constants.AddressZero, balance);
        await withdrawTx.wait();
        console.log("Withdraw successful. Transaction hash:", withdrawTx.hash);
    } else {
        console.log("No balance in the contract to withdraw");
    }
}

main(hre).then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
});
