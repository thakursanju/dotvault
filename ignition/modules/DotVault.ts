import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const DotVaultModule = buildModule("DotVaultModule", (m) => {
  const vault = m.contract("DotVault", []);

  return { vault };
});

export default DotVaultModule;
