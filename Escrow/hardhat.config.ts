import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import "@openzeppelin/hardhat-upgrades";
import '@nomicfoundation/hardhat-chai-matchers';

import * as dotenv from "dotenv";
dotenv.config();

const privateKey: string = process.env.PRIVATE_KEY || "";

module.exports = {
defaultNetwork: "mumbai",
networks: {
    hardhat: {
      accounts: [
        {
          privateKey,
          balance: "1000000000000000000000",
        },
      ],
      gas: "auto",
      gasLimit: 10000000,
      gasPrice: 1000000000,
    },
    main: {
        url: "https://eth-mainnet.g.alchemy.com/v2/-c4AnGWtMVj4pF8l1jMjZn87VAuCL6DL",
        ethNetwork: "mainnet", // RPC URL of the network (e.g. `https://goerli.infura.io/v3/<API_KEY>`)
        zksync: false,
        apiKey: 'c4AnGWtMVj4pF8l1jMjZn87VAuCL6DL',
        gas: "auto",
        gasPrice: "auto",
        gasMultiplier: 1.5,
        timeout: 1000000,
      },
    PolygonMain: {
        url: "https://polygon-mainnet.g.alchemy.com/v2/-F1uYgZlfQcQN5B3xXcxTICRhxyqDo63",
        apiKey: '-F1uYgZlfQcQN5B3xXcxTICRhxyqDo63',
        gaslimit: 30000000,
        gasPrice: 300000000000,
        gasMultiplier: 1.5,
        timeout: 1000000,
    },
    BSCMain: {
        url: "https://bsc-dataseed.binance.org/",
        gas: "auto",
        accounts: [privateKey],
        gasPrice: "auto",
        gasMultiplier: 1.5,
        timeout: 1000000,
      },
    bsc_testnet: {
      url: `https://data-seed-prebsc-1-s1.binance.org:8545/`,
      accounts: [privateKey],
      chainId: 97,
      gas: "auto",
      gasPrice: "auto",
      gasMultiplier: 1.5,
      timeout: 1000000,
    },
    mumbai: {
            url: `https://polygon-mumbai.g.alchemy.com/v2/_BuYhiU95d9Z3GowXbz876NwerOs3c90`,
            accounts: [privateKey],
            chainId: 80001,
            gas: "auto",
            gasPrice: "auto",
            gasMultiplier: 1.5,
            timeout: 1000000,
          },

},
solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
},
};