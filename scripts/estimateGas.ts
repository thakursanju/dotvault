import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const factory = await ethers.getContractFactory("DotVault");
  try {
    const estimatedGas = await factory.getDeployTransaction();
    console.log("Deploy tx:", estimatedGas);
    const gas = await ethers.provider.estimateGas(estimatedGas);
    console.log("Estimated gas:", gas.toString());
  } catch (error) {
    console.error("Estimation failed:");
    console.error(error);
  }
}

main().catch(console.error);
