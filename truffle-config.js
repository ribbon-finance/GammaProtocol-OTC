require('ts-node/register')
require('dotenv').config()

const HDWalletProvider = require('@truffle/hdwallet-provider')

const fs = require('fs')
const mnemonic = fs.existsSync('.secret')
  ? fs
      .readFileSync('.secret')
      .toString()
      .trim()
  : "put mnemonic into .secret file, don't paste it here" // deployer wallet mnemonic
const key = fs.existsSync('.infuraKey')
  ? fs
      .readFileSync('.infuraKey')
      .toString()
      .trim()
  : "put infura key inside a .infuraKey file, don't paste it here" // infura key

module.exports = {
  networks: {
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
    },
    rinkeby: {
      provider: () => new HDWalletProvider(mnemonic, `https://rinkeby.infura.io/v3/${key}`),
      network_id: 4,
      timeoutBlocks: 2000,
      skipDryRun: true,
      gasPrice: 100000000000,
    },
    ropsten: {
      provider: () => new HDWalletProvider(mnemonic, `https://ropsten.infura.io/v3/${key}`),
      network_id: 3,
      timeoutBlocks: 2000,
      skipDryRun: true,
      gasPrice: 100000000000,
    },
    kovan: {
      provider: () => {
        return new HDWalletProvider(mnemonic, `https://kovan.infura.io/v3/${key}`)
      },
      network_id: 42,
      gas: 6700000,
    },
    ropsten: {
      provider: () => {
        return new HDWalletProvider(mnemonic, `https://ropsten.infura.io/v3/${key}`)
      },
      network_id: 3,
      gasPrice: 50000000000,
      gas: 4000000,
    },
    mainnet: {
      provider: () => new HDWalletProvider(mnemonic, `https://mainnet.infura.io/v3/${key}`),
      network_id: 1,
      chain_id: 1,
      confirmations: 2,
      timeoutBlocks: 50,
      skipDryRun: false,
      gasPrice: 30000000000,
    },
    avax: {
      provider: () => new HDWalletProvider(mnemonic, 'https://api.avax.network/ext/bc/C/rpc'),
      network_id: 1,
    },
    fuji: {
      provider: () => new HDWalletProvider(mnemonic, 'https://api.avax-test.network/ext/bc/C/rpc'),
      network_id: 1,
      gas: 8000000,
      gasPrice: 250000000000,
      skipDryRun: true,
    },
    sepolia: {
      provider: () => new HDWalletProvider(mnemonic, 'https://ethereum-sepolia.blockpi.network/v1/rpc/public'),
      network_id: 11155111,
      gasPrice: 10000000000,
      skipDryRun: true,
    }
  },

  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions: {
      currency: 'USD',
      artifactType: 'truffle-v5',
      coinmarketcap: process.env.COINMARKETCAP_API,
      excludeContracts: ['Migrations'],
      showTimeSpent: true,
    },
  },

  plugins: ['solidity-coverage', 'truffle-contract-size', 'truffle-plugin-verify'],

  api_keys: {
    etherscan: process.env.ETHERSCAN_API,
  },

  compilers: {
    solc: {
      version: "pragma",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
  },
}
