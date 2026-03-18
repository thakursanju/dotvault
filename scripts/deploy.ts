import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Placeholder validator bytes32 values (replace with real validator IDs before mainnet)
const VALIDATOR_A = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
const VALIDATOR_B = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

async function main(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  DotVault Deployment Script");
  console.log("=".repeat(60));

  // -------------------------------------------------------------------------
  // 1. Get deployer signer and print address + DOT balance
  // -------------------------------------------------------------------------
  const [deployer] = await ethers.getSigners();
  const balanceWei = await ethers.provider.getBalance(deployer.address);
  const balanceDOT = ethers.formatEther(balanceWei);

  console.log("\n[Deployer]");
  console.log(`  Address : ${deployer.address}`);
  console.log(`  Balance : ${balanceDOT} DOT`);

  // -------------------------------------------------------------------------
  // 2. Deploy DotVault
  // -------------------------------------------------------------------------
  console.log("\n[Deploying DotVault...]");
  console.log(`  Validator A : ${VALIDATOR_A}`);
  console.log(`  Validator B : ${VALIDATOR_B}`);

  const DotVault = await ethers.getContractFactory("DotVault");
  const vault = await DotVault.deploy({ gasLimit: 50000000 });

  // Wait for deployment to be mined
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  const deployTx     = vault.deploymentTransaction();
  const txHash       = deployTx?.hash ?? "N/A";
  const blockNumber  = deployTx ? (await deployTx.wait())?.blockNumber : undefined;

  console.log("\n[Deployment Confirmed]");
  console.log(`  Contract Address : ${vaultAddress}`);
  console.log(`  Transaction Hash : ${txHash}`);
  console.log(`  Block Number     : ${blockNumber ?? "N/A"}`);

  // -------------------------------------------------------------------------
  // 3. Print Subscan explorer link
  // -------------------------------------------------------------------------
  const subscanBase = "https://assethub-westend.subscan.io/account";
  console.log("\n[Explorer]");
  console.log(`  ${subscanBase}/${vaultAddress}`);

  // -------------------------------------------------------------------------
  // 4. Verify deployment — call vault.owner() and vault.sharePrice()
  // -------------------------------------------------------------------------
  console.log("\n[Verification Calls]");

  const owner      = await vault.owner();
  const sharePrice = await vault.sharePrice();

  console.log(`  vault.owner()      = ${owner}`);
  console.log(`  vault.sharePrice() = ${ethers.formatEther(sharePrice)} (1e18 scale)`);

  const ownerMatch = owner.toLowerCase() === deployer.address.toLowerCase();
  console.log(`  Owner matches deployer: ${ownerMatch ? "✓ YES" : "✗ NO — unexpected!"}`);

  if (!ownerMatch) {
    throw new Error("Owner mismatch — deployment may be incorrect.");
  }

  // -------------------------------------------------------------------------
  // 5. Save deployment info to deployment.json
  // -------------------------------------------------------------------------
  const chainId   = (await ethers.provider.getNetwork()).chainId;
  const timestamp = new Date().toISOString();

  const deploymentInfo = {
    contractName : "DotVault",
    address      : vaultAddress,
    chainId      : chainId.toString(),
    deployer     : deployer.address,
    txHash,
    blockNumber  : blockNumber ?? null,
    timestamp,
    network      : network.name,
    subscanUrl   : `${subscanBase}/${vaultAddress}`,
    validators   : [VALIDATOR_A, VALIDATOR_B],
  };

  const outputPath = path.resolve(__dirname, "../deployment.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n[Deployment Info Saved]");
  console.log(`  File : ${outputPath}`);
  console.log("\n" + JSON.stringify(deploymentInfo, null, 2));

  console.log("\n" + "=".repeat(60));
  console.log("  Deployment complete!");
  console.log("=".repeat(60) + "\n");
}

main().catch((error) => {
  console.error("\n[Deployment Failed]", error);
  process.exitCode = 1;
});