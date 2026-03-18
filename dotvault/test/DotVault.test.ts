import { expect } from "chai";
import { ethers } from "hardhat";

const STAKING_ADDR       = "0x0000000000000000000000000000000000000800";
const XCM_ADDR           = "0x0000000000000000000000000000000000000804";
const NATIVE_ASSETS_ADDR = "0x0000000000000000000000000000000000000806";

describe("DotVault", function () {

  async function deployDotVaultFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const MockStakingFactory      = await ethers.getContractFactory("MockStaking");
    const MockNativeAssetsFactory = await ethers.getContractFactory("MockNativeAssets");
    const MockXCMFactory          = await ethers.getContractFactory("MockXCM");

    const tmpStaking = await MockStakingFactory.deploy();
    const tmpNative  = await MockNativeAssetsFactory.deploy();
    const tmpXCM     = await MockXCMFactory.deploy();

    await tmpStaking.waitForDeployment();
    await tmpNative.waitForDeployment();
    await tmpXCM.waitForDeployment();

    const stakingCode = await ethers.provider.getCode(await tmpStaking.getAddress());
    const nativeCode  = await ethers.provider.getCode(await tmpNative.getAddress());
    const xcmCode     = await ethers.provider.getCode(await tmpXCM.getAddress());

    await ethers.provider.send("hardhat_setCode", [STAKING_ADDR,       stakingCode]);
    await ethers.provider.send("hardhat_setCode", [NATIVE_ASSETS_ADDR, nativeCode]);
    await ethers.provider.send("hardhat_setCode", [XCM_ADDR,           xcmCode]);

    // Initialize storage for MockStaking: era = 1, reward = 1 ether
    await ethers.provider.send("hardhat_setStorageAt", [STAKING_ADDR, "0x0", "0x0000000000000000000000000000000000000000000000000000000000000001"]);
    await ethers.provider.send("hardhat_setStorageAt", [STAKING_ADDR, "0x1", "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000"]);

    await owner.sendTransaction({ to: NATIVE_ASSETS_ADDR, value: ethers.parseEther("10") });

    const DotVaultFactory = await ethers.getContractFactory("DotVault");
    const vault = await DotVaultFactory.deploy();
    await vault.waitForDeployment();

    const ONE_DOT  = ethers.parseEther("1");
    const FIVE_DOT = ethers.parseEther("5");
    const TEN_DOT  = ethers.parseEther("10");

    return { vault, owner, alice, bob, ONE_DOT, FIVE_DOT, TEN_DOT };
  }

  // Deployment
  describe("Deployment", function () {
    it("should set the deployer as owner", async function () {
      const { vault, owner } = await deployDotVaultFixture();
      expect(await vault.owner()).to.equal(owner.address);
    });

    it("should start with totalShares equal to 0", async function () {
      const { vault } = await deployDotVaultFixture();
      expect(await vault.totalShares()).to.equal(0n);
    });

    it("should start with totalDeposited equal to 0", async function () {
      const { vault } = await deployDotVaultFixture();
      expect(await vault.totalDeposited()).to.equal(0n);
    });
  });

  // deposit()
  describe("deposit()", function () {
    it("first deposit should mint shares 1:1 (bootstrap)", async function () {
      const { vault, alice, ONE_DOT } = await deployDotVaultFixture();
      await vault.connect(alice).deposit({ value: ONE_DOT });
      expect(await vault.balanceOf(alice.address)).to.equal(ONE_DOT);
      expect(await vault.totalShares()).to.equal(ONE_DOT);
      expect(await vault.totalDeposited()).to.equal(ONE_DOT);
    });

    it("should track multiple depositors correctly", async function () {
      const { vault, alice, bob, ONE_DOT, TEN_DOT } = await deployDotVaultFixture();
      await vault.connect(alice).deposit({ value: ONE_DOT });
      await vault.connect(bob).deposit({ value: TEN_DOT });
      expect(await vault.balanceOf(alice.address)).to.equal(ONE_DOT);
      expect(await vault.balanceOf(bob.address)).to.equal(TEN_DOT);
      expect(await vault.totalDeposited()).to.equal(ONE_DOT + TEN_DOT);
      expect(await vault.totalShares()).to.equal(ONE_DOT + TEN_DOT);
    });

    it("should revert with ZeroAmount when deposit value is 0", async function () {
      const { vault, alice } = await deployDotVaultFixture();
      await expect(vault.connect(alice).deposit({ value: 0n }))
        .to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("should emit Deposited event with correct args", async function () {
      const { vault, alice, ONE_DOT } = await deployDotVaultFixture();
      await expect(vault.connect(alice).deposit({ value: ONE_DOT }))
        .to.emit(vault, "Deposited")
        .withArgs(alice.address, ONE_DOT, ONE_DOT);
    });

    it("second depositor should receive proportional shares at 1:1", async function () {
      const { vault, alice, bob, ONE_DOT } = await deployDotVaultFixture();
      await vault.connect(alice).deposit({ value: ONE_DOT });
      await vault.connect(bob).deposit({ value: ONE_DOT });
      expect(await vault.balanceOf(bob.address)).to.equal(ONE_DOT);
    });
  });

  // balanceOf()
  describe("balanceOf()", function () {
    it("should return correct share balance after deposit", async function () {
      const { vault, alice, TEN_DOT } = await deployDotVaultFixture();
      await vault.connect(alice).deposit({ value: TEN_DOT });
      expect(await vault.balanceOf(alice.address)).to.equal(TEN_DOT);
    });

    it("should return zero for a non-depositor", async function () {
      const { vault, bob } = await deployDotVaultFixture();
      expect(await vault.balanceOf(bob.address)).to.equal(0n);
    });
  });

  // sharePrice()
  describe("sharePrice()", function () {
    it("should return 1e18 (1:1) when vault is empty", async function () {
      const { vault } = await deployDotVaultFixture();
      expect(await vault.sharePrice()).to.equal(ethers.parseEther("1"));
    });

    it("should return 1:1 ratio immediately after first deposit", async function () {
      const { vault, alice, ONE_DOT } = await deployDotVaultFixture();
      await vault.connect(alice).deposit({ value: ONE_DOT });
      expect(await vault.sharePrice()).to.equal(ethers.parseEther("1"));
    });

    it("should maintain 1:1 ratio with multiple depositors and no yield", async function () {
      const { vault, alice, bob, ONE_DOT } = await deployDotVaultFixture();
      await vault.connect(alice).deposit({ value: ONE_DOT });
      await vault.connect(bob).deposit({ value: ONE_DOT });
      expect(await vault.sharePrice()).to.equal(ethers.parseEther("1"));
    });
  });

  // withdraw()
  describe("withdraw()", function () {
    it("should revert with InsufficientShares when withdrawing too many", async function () {
      const { vault, alice, ONE_DOT } = await deployDotVaultFixture();
      await vault.connect(alice).deposit({ value: ONE_DOT });
      const aliceShares = await vault.balanceOf(alice.address);
      await expect(vault.connect(alice).withdraw(aliceShares + 1n))
        .to.be.revertedWithCustomError(vault, "InsufficientShares");
    });

    it("should revert with ZeroAmount when withdrawing 0 shares", async function () {
      const { vault, alice, ONE_DOT } = await deployDotVaultFixture();
      await vault.connect(alice).deposit({ value: ONE_DOT });
      await expect(vault.connect(alice).withdraw(0n))
        .to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("should revert with InsufficientShares for a non-depositor", async function () {
      const { vault, alice, bob, ONE_DOT } = await deployDotVaultFixture();
      await vault.connect(alice).deposit({ value: ONE_DOT });
      await expect(vault.connect(bob).withdraw(ONE_DOT))
        .to.be.revertedWithCustomError(vault, "InsufficientShares");
    });

    it("should burn shares and reduce totalShares on partial withdrawal", async function () {
      const { vault, alice, TEN_DOT } = await deployDotVaultFixture();
      await vault.connect(alice).deposit({ value: TEN_DOT });
      const aliceShares = await vault.balanceOf(alice.address);
      const half = aliceShares / 2n;
      await vault.connect(alice).withdraw(half);
      expect(await vault.balanceOf(alice.address)).to.equal(aliceShares - half);
      expect(await vault.totalShares()).to.equal(aliceShares - half);
    });

    it("should emit Withdrawn event with correct args", async function () {
      const { vault, alice, ONE_DOT } = await deployDotVaultFixture();
      await vault.connect(alice).deposit({ value: ONE_DOT });
      const aliceShares = await vault.balanceOf(alice.address);
      await expect(vault.connect(alice).withdraw(aliceShares))
        .to.emit(vault, "Withdrawn")
        .withArgs(alice.address, aliceShares, ONE_DOT);
    });

    it("full withdrawal should zero out vault state", async function () {
      const { vault, alice, ONE_DOT } = await deployDotVaultFixture();
      await vault.connect(alice).deposit({ value: ONE_DOT });
      const aliceShares = await vault.balanceOf(alice.address);
      await vault.connect(alice).withdraw(aliceShares);
      expect(await vault.totalShares()).to.equal(0n);
      expect(await vault.totalDeposited()).to.equal(0n);
      expect(await vault.balanceOf(alice.address)).to.equal(0n);
    });
  });

  // Admin
  describe("Admin", function () {
    it("non-owner should revert with NotOwner on harvestYield", async function () {
      const { vault, alice, ONE_DOT } = await deployDotVaultFixture();
      await vault.connect(alice).deposit({ value: ONE_DOT });
      await expect(vault.connect(alice).harvestYield(1000, ONE_DOT, 1_000_000n))
        .to.be.revertedWithCustomError(vault, "NotOwner");
    });

    it("non-owner should revert with NotOwner on bridgeYieldToParachain", async function () {
      const { vault, alice, bob, ONE_DOT } = await deployDotVaultFixture();
      await expect(vault.connect(alice).bridgeYieldToParachain(1000, bob.address, ONE_DOT))
        .to.be.revertedWithCustomError(vault, "NotOwner");
    });

    it("owner is set immutably at deployment", async function () {
      const { vault, owner, alice } = await deployDotVaultFixture();
      expect(await vault.owner()).to.equal(owner.address);
      expect(await vault.owner()).to.not.equal(alice.address);
    });

    it("owner calling harvestYield should succeed and emit YieldHarvested", async function () {
      const { vault, owner, alice, ONE_DOT } = await deployDotVaultFixture();
      await vault.connect(alice).deposit({ value: ONE_DOT });
      await expect(vault.connect(owner).harvestYield(1000, ONE_DOT, 1_000_000n))
        .to.emit(vault, "YieldHarvested");
    });
  });

});