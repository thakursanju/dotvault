# DotVault

A non-custodial yield vault for Polkadot Asset Hub. Users deposit native DOT, receive share tokens representing their proportional ownership, and the vault stakes deposited assets via the Polkadot staking precompile to generate yield. Yield is harvested by the owner and bridged to a parachain via XCM.

Built for **Polkadot Hackathon — Track 2: PVM Smart Contract** (Categories 2 & 3).

---

## Architecture

```
User
 │
 ├── deposit(msg.value)  →  DotVault.sol
 │                              │
 │                              ├── mints shares (ERC-4626-style, 1:1 on first deposit)
 │                              ├── calls Staking Precompile → bond(amount)
 │                              └── emits Deposited(user, amount, shares)
 │
 └── withdraw(shares)   →  DotVault.sol
                                │
                                ├── burns shares, calculates assets
                                ├── calls Staking Precompile → unbond(amount)
                                ├── transfers DOT back to user via ERC-20 precompile
                                └── emits Withdrawn(user, assets, shares)

Owner
 ├── harvestYield()     →  queries current era rewards via Staking Precompile
 │                          accumulates yield into totalDeposited (raises share price)
 │
 └── bridgeYieldToParachain(era, dest, amount)
                        →  calls XCM Precompile → teleportAssets to parachain
```

### Precompiles used

| Precompile | Address (Westend) | Address (Polkadot) | Function |
|---|---|---|---|
| Staking | `0x0000…0800` | `0x0000…0800` | bond, unbond, withdrawUnbonded, currentEra, erasStakersReward |
| ERC-20 (DOT) | `0x0000…0806` | `0x0000…0806` | transfer (DOT back to user on withdraw) |
| XCM | `0x0000…0804` | `0x0000…0804` | teleportAssets (bridge yield to parachain) |

> Verify exact addresses at: https://docs.substrate.io/reference/address-formats/

---

## Prerequisites

- Node.js 18+
- A funded Westend account (get WND from https://faucet.polkadot.io)

---

## Setup

```bash
npm install
cp .env.example .env
# Edit .env and set your PRIVATE_KEY
```

`.env` requires:
```
PRIVATE_KEY=0x_your_private_key_here
```

---

## Compile

```bash
npm run compile
```

Compiles with `solc 0.8.24`, `evmVersion: london` — required for Polkadot Asset Hub compatibility.

---

## Test

```bash
npm test
```

Expected: **29/29 passing**. The staking precompile is mocked via `hardhat_setCode` in the test setup so withdraw flows work on the local Hardhat network.

Run coverage:
```bash
npx hardhat coverage
```

---

## Deploy

### Westend testnet (recommended first)

```bash
npm run deploy:westend
```

Outputs the deployed contract address. Verify at: https://westend-asset-hub.subscan.io

### Polkadot mainnet

```bash
npm run deploy:polkadot
```

---

## Key design decisions

**Share price model** — shares are minted at a 1:1 ratio on the first deposit. Subsequent deposits mint shares proportional to `(amount * totalShares) / totalDeposited`, so early depositors automatically benefit from yield accumulation.

**No cooldown in Solidity** — unbonding cooldowns are enforced at the staking precompile level (28 days on Polkadot). The contract does not duplicate this logic.

**Owner-only yield operations** — `harvestYield` and `bridgeYieldToParachain` are restricted to the owner. A future version could use a keeper network or Polkadot's scheduler pallet.

**CEI pattern** — all state updates (shares, totals) happen before any external precompile call to prevent reentrancy.

---

## Project structure

```
contracts/
  DotVault.sol          # Main vault contract
scripts/
  deploy.ts             # Deployment script (Westend + Polkadot)
test/
  DotVault.test.ts      # Full test suite (29 tests)
  helpers/
    MockStaking.sol     # Staking precompile mock for local tests
hardhat.config.ts       # Network config (evmVersion: london for Asset Hub)
```

---

## Track 2 categories

| Category | How DotVault qualifies |
|---|---|
| **Category 2 — Polkadot native assets** | Vaults and stakes native DOT/WND directly. No ERC-20 wrapper. |
| **Category 3 — Precompiles** | Calls staking, ERC-20, and XCM precompiles on Polkadot Asset Hub. |

---

## License

ISC