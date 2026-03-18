import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Greeter with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const Greeter = await ethers.getContractFactory("Greeter");
  const greeter = await Greeter.deploy("Hello PVM", { gasLimit: 50000000 });
  await greeter.waitForDeployment();
  console.log("Greeter deployed to:", await greeter.getAddress());

  console.log("\n[Verification]");
  console.log("Greeting:", await greeter.greeting());
}

main().catch(console.error);
