require("@nomicfoundation/hardhat-ignition");
require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("solidity-coverage");

const MAINNET_RPC_URL = process.env.MAINNET_RPC_URL || "http://localhost:8545";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "http://localhost:8545";
const SEPOLIA_PRIV_KEY = process.env.SEPOLIA_PRIV_KEY || "0x";
const ETHERSCAN_API_KEY =
    process.env.ETHERSCAN_API_KEY || "YOUR_ETHERSCAN_API_KEY";
const COINMARKETCAP_API_KEY =
    process.env.COINMARKETCAP_API_KEY || "YOUR_COINMARKETCAP_API_KEY";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        compilers: [
            { version: "0.8.10" },
            { version: "0.8.19" },
            { version: "0.8.27" },
            { version: "0.7.5" },
        ],
    },
    networks: {
        /* hardhat: {
            chainId: 31337,
            forking: {
                url: MAINNET_RPC_URL,
            },
        }, */
        localhost: {
            ignition: {
                blockPollingInterval: 1_000,
                requiredConfirmations: 1,
            },
        },
        sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: [SEPOLIA_PRIV_KEY],
            chainId: 11155111,
            ignition: {
                blockPollingInterval: 1_000,
                requiredConfirmations: 1,
            },
        },
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },
    gasReporter: {
        enabled: true,
        outputFile: "./test-reports/gas-report.txt",
        noColors: true,
        currency: "USD",
        // coinmarketcap: COINMARKETCAP_API_KEY,
    },
    mocha: {
        timeout: 300_000,
    },
};
