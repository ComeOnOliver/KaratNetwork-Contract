import {ethers} from "hardhat";
import Escrow from "../../artifacts/contracts/Escrow.sol/Escrow.json";
import dotenv from "dotenv";
import ERC20 from "./ERC20.json";
import {HardhatRuntimeEnvironment} from "hardhat/types";


dotenv.config();

async function main(hre : HardhatRuntimeEnvironment) {
    const privateKey = process.env.PRIVATE_KEY || "";
    const urls = {
        mainnet: 'https://eth-mainnet.g.alchemy.com/v2/-c4AnGWtMVj4pF8l1jMjZn87VAuCL6DL',
        polygon: 'https://polygon-mainnet.g.alchemy.com/v2/-F1uYgZlfQcQN5B3xXcxTICRhxyqDo63',
        bsc: 'https://bsc-dataseed.binance.org/',
        bsc_testnet: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        goerli: 'https://eth-goerli.g.alchemy.com/v2/Mw8-Kd3V-RC5SeVKRAiJgVMEGQYQbZlm',
        mumbai: 'https://polygon-mumbai.g.alchemy.com/v2/_BuYhiU95d9Z3GowXbz876NwerOs3c90'
    };

    const contractAddress = "0x9D9DcDBA885E6508f209d035000AE5f15f6C5b19";
    const depositAmount = ethers.utils.parseUnits("1", 6);
    const depositNativeAmount = ethers.utils.parseUnits("0.02", 18);


    const network = hre.network.name;
    console.log("Network is: ", network);
    const url = urls[network as keyof typeof urls];
    console.log("URL: ", url);

    const provider = new ethers.providers.JsonRpcProvider(url);

    const wallet = new ethers.Wallet(privateKey, provider);

    const escrowContract = new ethers.Contract(contractAddress, Escrow.abi, wallet)as unknown as Escrow;

    const USDCAdd = "0xE097d6B3100777DC31B34dC2c58fB524C2e76921";
    // console.log("Approve USDC");
    // await escrowContract.setToken(USDCAdd, true);

    console.log("Approving transfer of 1 USDC to Escrow contract...");
    const USDCContract = new ethers.Contract(USDCAdd, ERC20.abi, wallet);
    const approveTx = await USDCContract.approve(contractAddress, depositAmount);
    await approveTx.wait();
    console.log("Approval successful. Transaction hash:", approveTx.hash);

    console.log("Sending 1 USDC to the contract...");
    const depositTx = await escrowContract.depositERC20(USDCAdd, depositAmount);
    await depositTx.wait();
    console.log("Deposit successful. Transaction hash:", depositTx.hash);

    console.log("Sending 0.2 Matic to the contract...");
    const depositTx1 = await escrowContract.depositNativeToken({value: depositNativeAmount});
    await depositTx1.wait();
    console.log("Deposit 0.2 Matic successful. Transaction hash:", depositTx1.hash);

}

main(hre).then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
});
