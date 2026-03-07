# DotVault

An ERC-4626 style yield vault for Polkadot Asset Hub that stakes DOT via precompiles, accrues staking rewards, and enables cross-chain transfers via XCM.

---

## Overview

DotVault lets users deposit native DOT tokens and receive vault shares in return. Deposited tokens are automatically bonded through the Polkadot staking precompile. As staking rewards are harvested and compounded, the share price increases — distributing yield proportionally to all holders without minting new shares.

---

## Features

- **Deposit** — Deposit DOT and receive vault shares (1:1 on first deposit, proportional thereafter)
- **Withdraw** — Redeem shares for underlying DOT (unbonding period applies on Polkadot)
- **Yield Harvesting** — Owner harvests staking rewards and compounds them into the vault
- **Cross-Chain Transfers** — Bridge yield to another parachain via the XCM precompile
- **Share Price** — Monotonically increases as yield is harvested

---

## Contract Architecture

```
DotVault.sol
├── Precompile Interfaces
│   ├── IStaking       (0x0000000000000000000000000000000000000800)
│   ├── IXCM           (0x0000000000000000000000000000000000000804)
│   └── INativeAssets  (0x0000000000000000000000000000000000000806)
├── Core Functions
│   ├── deposit()
│   ├── withdraw()
│   ├── harvestYield()
│   └── bridgeYieldToParachain()
└── View Functions
    ├── balanceOf()
    ├── sharePrice()
    ├── estimatedAPY()
    └── depositorCount()
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- npm

### Install

```bash
git clone https://github.com/YOUR_USERNAME/dotvault.git
cd dotvault
npm install --legacy-peer-deps
```

### Configure

Create a `.env` file in the project root:

```
PRIVATE_KEY=your_private_key_here
```

### Compile

```bash
npx hardhat compile
```

### Test

```bash
npx hardhat test
```

Expected output: 15 passing tests covering deployment, deposit, withdraw, balanceOf, sharePrice, and admin functions.

---

## Deploy

### Deploy to Westend Asset Hub (testnet)

```bash
npx hardhat run scripts/deploy.ts --network westendHub
```

### Deploy to Polkadot Asset Hub (mainnet)

```bash
npx hardhat run scripts/deploy.ts --network polkadotHub
```

---

## Networks

| Network           | Chain ID   | RPC                                              |
|-------------------|------------|--------------------------------------------------|
| Westend Asset Hub | 420420421  | https://westend-asset-hub-eth-rpc.polkadot.io    |
| Polkadot Asset Hub| 420420420  | https://polkadot-asset-hub-eth-rpc.polkadot.io   |

---

## Project Structure

```
dotvault/
├── contracts/
│   ├── DotVault.sol           # Main vault contract
│   └── mocks/
│       ├── MockStaking.sol    # Staking precompile mock for tests
│       ├── MockNativeAssets.sol
│       └── MockXCM.sol
├── scripts/
│   └── deploy.ts              # Deployment script
├── test/
│   └── DotVault.test.ts       # Full test suite (15 tests)
├── hardhat.config.ts
└── .env
```

---

## Built With

- [Hardhat](https://hardhat.org/) — Ethereum development environment
- [Polkadot Asset Hub](https://wiki.polkadot.network/docs/learn-assets) — EVM-compatible parachain
- [ethers.js v6](https://docs.ethers.org/v6/) — Ethereum library
- [Chai](https://www.chaijs.com/) — Test assertions