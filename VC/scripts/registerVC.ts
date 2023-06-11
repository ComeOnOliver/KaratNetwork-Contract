import {ethers} from "hardhat";
import Escrow from "../../artifacts/contracts/VCRegistry.sol/VCRegistry.json";
import dotenv from "dotenv";
import {keccak256, solidityKeccak256} from "ethers/lib/utils";
import {HardhatRuntimeEnvironment} from "hardhat/types";


dotenv.config();

class Issuer {

    constructor(id, ethereumAddress) {
        this.id = id;
        this.ethereumAddress = ethereumAddress;
    }
}

class CredentialSubject {
    constructor(ethereumAddress, _type, url) {
        this.ethereumAddress = ethereumAddress;
        this._type = _type;
        this.url = url;
    }
}

class VerifiableCredential {
    constructor(issuer, credentialSubject, issuanTime) {
        this.issuer = issuer;
        this.credentialSubject = credentialSubject;
        this.issuanTime = issuanTime;
    }
}
let users: any;

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

    const contractAddress = "0x42F3604a6414EE0cf6482fAB7336caFd4ff39eAe";


    const network = hre.network.name;
    console.log("Network is: ", network);
    const url = urls[network as keyof typeof urls];
    console.log("URL: ", url);

    const provider = new ethers.providers.JsonRpcProvider(url);

    const wallet = new ethers.Wallet(privateKey, provider);

    const escrowContract = new ethers.Contract(contractAddress, Escrow.abi, wallet)as unknown as Escrow;
    users = ["0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2", "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", "0x4c79B28335723E158b8F02b7E3191Aa570B2ED91", wallet.address];

    // console.log("Approve USDC");
    // await escrowContract.setToken(USDCAdd, true);

    
    const issuer = {
        id: "issuer1",
        ethereumAddress: wallet.address
    };

    const credentialSubject = {
        ethereumAddress: users[0],
        _type: "type1",
        url: "ceramic://url"
    };

    const vc = {
        issuer: issuer,
        credentialSubject: credentialSubject,
        issuanTime: 1685990276
    };

    console.log("Registering VC...");
    const depositTx = await escrowContract.registerVC(users[0], vc, '0x0f2098e1017631024864cdb6c3aea4f3edb266ad0421b5e5f915250b5b26166e1d15bf8cb722f0352a48b715fe987f6882a9a12e6172dd0e2b6eb84ac8706aa51c');
    await depositTx.wait();
    console.log("Deposit successful. Transaction hash:", depositTx.hash);

}

main(hre).then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
});
