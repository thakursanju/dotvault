import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'london',
      metadata: {
        bytecodeHash: 'none',
        appendCBOR: false,
      },
    },
  },
  networks: {
    westendHub: {
      chainId: 420420421,
      url: 'https://westend-asset-hub-eth-rpc.polkadot.io',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    polkadotHub: {
      chainId: 420420420,
      url: 'https://polkadot-asset-hub-eth-rpc.polkadot.io',
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

export default config;