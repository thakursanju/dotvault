import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
  console.log("============================================================");
  console.log("  DotVault Deployment Script");
  console.log("============================================================");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "WND");

  if (balance === 0n) {
    console.error("❌ No balance! Get testnet WND from faucet.polkadot.io/westend");
    process.exit(1);
  }

  console.log("\nDeploying DotVault...");

  const DotVault = await ethers.getContractFactory("DotVault");
  const vault = await DotVault.deploy();
  await vault.waitForDeployment();

  const address = await vault.getAddress();

  console.log("\n============================================================");
  console.log("✅ DotVault deployed at:", address);
  console.log("🔍 Subscan:", `https://assethub-westend.subscan.io/account/${address}`);
  console.log("============================================================");

  const network = await ethers.provider.getNetwork();

  const deployment = {
    contractName: "DotVault",
    address,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    txHash: vault.deploymentTransaction()?.hash ?? "",
    timestamp: new Date().toISOString(),
    network: network.name,
    subscanUrl: `https://assethub-westend.subscan.io/account/${address}`,
  };

  fs.writeFileSync("deployment.json", JSON.stringify(deployment, null, 2));
  console.log("\n📄 Saved to deployment.json");
  console.log("📋 Copy this address into useVault.js:", address);
}

main().catch((err) => {
  console.error("[Deployment Failed]", err);
  process.exit(1);
});