import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";
import "@matterlabs/hardhat-zksync-deploy";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-verify";
import "@matterlabs/hardhat-zksync-verify";

dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";
const privateKey1: string = process.env.PRIVATE_KEY1 || "";
// ZKSync Envrionment
module.exports = {
    zksolc: {
        version: "1.3.9",
        compilerSource: "binary",
        settings: {}
    },
    defaultNetwork: "zkMain",
    networks: {
        zkSyncTestnet: {
            url: "https://testnet.era.zksync.dev",
            ethNetwork: "goerli", // RPC URL of the network (e.g. `https://goerli.infura.io/v3/<API_KEY>`)
            zksync: true,
            verifyURL: 'https://zksync2-testnet-explorer.zksync.dev/contract_verification'
        },
        zkMain: {
            url: "https://mainnet.era.zksync.io",
            ethNetwork: "mainnet",
            zksync: true,
            verifyURL: 'https://zksync2-mainnet-explorer.zksync.io/contract_verification'
        },
        eth: {
            url: "https://eth-mainnet.g.alchemy.com/v2/-c4AnGWtMVj4pF8l1jMjZn87VAuCL6DL",
            ethNetwork: "mainnet",
            zksync: false
        },
        goerli: {
            url: "https://eth-goerli.g.alchemy.com/v2/Mw8-Kd3V-RC5SeVKRAiJgVMEGQYQbZlm",
            ethNetwork: "goerli",
            zksync: false
        },
        BSCMain: {
            url: "https://bsc-dataseed.binance.org/",
            gas: "auto",
            accounts: [privateKey],
            gasPrice: "auto",
            gasMultiplier: 1.5,
            timeout: 1000000
        },
        bsc_testnet: {
            url: `https://data-seed-prebsc-1-s1.binance.org:8545/`,
            accounts: [privateKey],
            chainId: 97,
            gas: "auto",
            gasPrice: "auto",
            gasMultiplier: 1.5,
            gaslimit: "auto",
            timeout: 1000000
        },
        PolygonMain: {
            url: "https://polygon-mainnet.g.alchemy.com/v2/-F1uYgZlfQcQN5B3xXcxTICRhxyqDo63",
            apiKey: '-F1uYgZlfQcQN5B3xXcxTICRhxyqDo63',
            gaslimit: "auto",
            gasPrice: "auto",
            gasMultiplier: 1.5,
            timeout: 1000000
        },
        hardhat: {
            accounts: [
                {
                    privateKey: privateKey,
                    balance: "1000000000000000000000"
                },
                {
                    privateKey: privateKey1,
                    balance: "1000000000000000000000"
                },
            ],
            gas: "auto",
            gasLimit: "auto",
            gasPrice: "auto"

        },
        mumbai: {
            url: `https://polygon-mumbai.g.alchemy.com/v2/_BuYhiU95d9Z3GowXbz876NwerOs3c90`,
            accounts: [privateKey],
            chainId: 80001,
            gas: "auto",
            gasPrice: "auto",
            gasMultiplier: 1.5,
            timeout: 1000000,
            apiKey: '_BuYhiU95d9Z3GowXbz876NwerOs3c90',
          },

    },
    etherscan: {
        apiKey: {
            
            //ethereum
            polygonMumbai: '-F1uYgZlfQcQN5B3xXcxTICRhxyqDo63',
       }
    },
    solidity: {
        version: "0.8.18",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    }
};
