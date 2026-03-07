import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      { version: "0.8.24" },
      { version: "0.8.28" },
    ]
  },
  networks: {
    westendHub: {
      chainId: 420420421,
      url: "https://westend-asset-hub-eth-rpc.polkadot.io",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    } as any,
    polkadotHub: {
      chainId: 420420420,
      url: "https://polkadot-asset-hub-eth-rpc.polkadot.io",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    } as any, 
  },
};

export default config;