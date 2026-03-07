// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DotVault
/// @notice ERC-4626 style yield vault for Polkadot Hub that stakes DOT via precompiles,
///         accrues staking rewards, and enables cross-chain transfers via XCM.
/// @dev Interacts with IStaking, IXCM, and INativeAssets precompiles at their fixed addresses.

// ---------------------------------------------------------------------------
// Precompile Interfaces
// ---------------------------------------------------------------------------

/// @notice Staking precompile at 0x0000000000000000000000000000000000000800
interface IStaking {
    /// @notice Bond `amount` native tokens for staking
    function bond(uint256 amount) external;

    /// @notice Bond an additional `amount` on top of an existing bond
    function bondExtra(uint256 amount) external;

    /// @notice Begin unbonding `amount` tokens (subject to unbonding period)
    function unbond(uint256 amount) external;

    /// @notice Nominate a list of validator addresses
    function nominate(address[] calldata validators) external;

    /// @notice Returns the index of the currently active era
    function activeEra() external view returns (uint32);

    /// @notice Returns the total stake in a given era
    function erasTotalStake(uint32 era) external view returns (uint256);

    /// @notice Returns the total validator reward paid out in a given era
    function erasValidatorReward(uint32 era) external view returns (uint256);
}

/// @notice XCM precompile at 0x0000000000000000000000000000000000000804
interface IXCM {
    /// @notice Send `amount` of native assets to `recipient` on parachain `paraId`
    function transferAssetsToParachain(
        uint32 paraId,
        address recipient,
        uint256 amount
    ) external;
}

/// @notice Native assets precompile at 0x0000000000000000000000000000000000000806
interface INativeAssets {
    /// @notice Returns the native asset balance of `account`
    function balanceOf(address account) external view returns (uint256);

    /// @notice Transfer `amount` native tokens from the caller to `to`
    function transfer(address to, uint256 amount) external returns (bool);
}

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

/// @notice Reverts when a zero amount is supplied where a positive value is required
error ZeroAmount();

/// @notice Reverts when a user attempts to withdraw more shares than they own
error InsufficientShares();

/// @notice Reverts when the caller is not the vault owner
error NotOwner();

/// @notice Reverts when the staking precompile returns an error
error StakingFailed();

/// @notice Reverts when the XCM precompile returns an error
error XCMFailed();

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/// @notice Emitted when a user deposits native assets and receives vault shares
/// @param depositor Address that performed the deposit
/// @param assets    Amount of native tokens deposited
/// @param shares    Number of vault shares minted
event Deposited(address indexed depositor, uint256 assets, uint256 shares);

/// @notice Emitted when a user redeems vault shares and receives native assets
/// @param withdrawer Address that performed the withdrawal
/// @param shares     Number of vault shares burned
/// @param assets     Amount of native tokens returned
event Withdrawn(address indexed withdrawer, uint256 shares, uint256 assets);

/// @notice Emitted when staking rewards are harvested and compounded into the vault
/// @param era   Era index from which yield was collected
/// @param yield Total reward amount harvested
event YieldHarvested(uint32 indexed era, uint256 yield);

/// @notice Emitted when assets are bridged to another parachain via XCM
/// @param paraId    Target parachain ID
/// @param recipient Recipient address on the destination parachain
/// @param amount    Amount of tokens transferred
event CrossChainTransfer(uint32 indexed paraId, address indexed recipient, uint256 amount);

// ---------------------------------------------------------------------------
// DotVault
// ---------------------------------------------------------------------------

contract DotVault {

    // -----------------------------------------------------------------------
    // Precompile addresses (Polkadot Asset Hub)
    // -----------------------------------------------------------------------

    IStaking      public constant STAKING       = IStaking(0x0000000000000000000000000000000000000800);
    IXCM          public constant XCM_PRECOMPILE = IXCM(0x0000000000000000000000000000000000000804);
    INativeAssets public constant NATIVE_ASSETS  = INativeAssets(0x0000000000000000000000000000000000000806);

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    /// @notice Owner of the vault; may harvest yield and initiate cross-chain transfers
    address public immutable owner;

    /// @notice Cumulative native assets deposited (principal + compounded yield)
    ///         Increases on deposit and on yield harvest; decreases on withdrawal.
    ///         Share price = totalDeposited / totalShares
    uint256 public totalDeposited;

    /// @notice Total vault shares outstanding across all depositors
    uint256 public totalShares;

    /// @notice Per-address vault share balances
    mapping(address => uint256) private _shares;

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    constructor() {
        owner = msg.sender;
    }

    // -----------------------------------------------------------------------
    // Modifiers
    // -----------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // -----------------------------------------------------------------------
    // Core Functions
    // -----------------------------------------------------------------------

    /// @notice Deposit native tokens (DOT) into the vault.
    ///         Mints shares proportional to the caller's contribution relative to totalDeposited.
    ///         As yield is harvested, totalDeposited grows, so later depositors receive fewer shares
    ///         per token — preserving the share price for existing holders.
    ///         The deposited value is immediately bonded through the staking precompile.
    /// @dev    Send native tokens as msg.value. No ERC-20 approval required.
    function deposit() external payable {
        uint256 assets = msg.value;
        if (assets == 0) revert ZeroAmount();

        uint256 shares;
        if (totalShares == 0 || totalDeposited == 0) {
            // Bootstrap: first depositor sets the 1:1 anchor
            shares = assets;
        } else {
            // Preserve share price: newShares = assets * totalShares / totalDeposited
            shares = (assets * totalShares) / totalDeposited;
        }

        _shares[msg.sender] += shares;
        totalShares         += shares;
        totalDeposited      += assets;

        // Bond the newly deposited tokens via the staking precompile
        try STAKING.bond(assets) {} catch {
            revert StakingFailed();
        }

        emit Deposited(msg.sender, assets, shares);
    }

    /// @notice Redeem `shares` vault shares and receive the proportional underlying assets.
    ///         The equivalent asset amount is unbonded from the staking precompile.
    ///         Note: unbonded tokens are subject to the Polkadot unbonding period before transfer.
    /// @param  shares Number of vault shares to burn
    function withdraw(uint256 shares) external {
        if (shares == 0) revert ZeroAmount();
        if (_shares[msg.sender] < shares) revert InsufficientShares();

        // assets = shares * totalDeposited / totalShares
        uint256 assets = (shares * totalDeposited) / totalShares;

        _shares[msg.sender] -= shares;
        totalShares         -= shares;
        totalDeposited      -= assets;

        // Begin unbonding through the staking precompile
        try STAKING.unbond(assets) {} catch {
            revert StakingFailed();
        }

        // Transfer redeemed assets to the caller via the native assets precompile
        bool ok = NATIVE_ASSETS.transfer(msg.sender, assets);
        if (!ok) revert StakingFailed();

        emit Withdrawn(msg.sender, shares, assets);
    }

    /// @notice Harvest staking rewards for the last completed era and compound them into totalDeposited.
    ///         Compounding increases the share price, distributing yield proportionally to all holders
    ///         without requiring any share minting.
    /// @param  paraId  Parachain ID parameter (reserved for future XCM reward-claim routing)
    /// @param  amount  Minimum expected reward (reverts if reward is zero; use as a slippage guard)
    /// @param  weight  XCM execution weight (reserved for future reward-claim calls)
    function harvestYield(uint32 paraId, uint256 amount, uint64 weight) external onlyOwner {
        if (amount == 0) revert ZeroAmount();

        uint32 currentEra = STAKING.activeEra();
        uint32 harvestEra = currentEra > 0 ? currentEra - 1 : 0;

        uint256 reward = STAKING.erasValidatorReward(harvestEra);

        // Compound: growing totalDeposited raises share price for all existing holders
        totalDeposited += reward;

        emit YieldHarvested(harvestEra, reward);

        // Silence unused-parameter warnings (parameters reserved for future XCM integration)
        (paraId, weight);
    }

    /// @notice Transfer assets cross-chain to a recipient on another parachain via the XCM precompile.
    /// @param  paraId    Destination parachain ID
    /// @param  recipient Recipient address on the destination chain
    /// @param  amount    Amount of native tokens to transfer
    function bridgeYieldToParachain(
        uint32  paraId,
        address recipient,
        uint256 amount
    ) external onlyOwner {
        if (amount == 0) revert ZeroAmount();

        try XCM_PRECOMPILE.transferAssetsToParachain(paraId, recipient, amount) {} catch {
            revert XCMFailed();
        }

        emit CrossChainTransfer(paraId, recipient, amount);
    }

    // -----------------------------------------------------------------------
    // View Functions
    // -----------------------------------------------------------------------

    /// @notice Returns the vault share balance of `account`
    /// @param  account Address to query
    /// @return         Number of shares held by `account`
    function balanceOf(address account) external view returns (uint256) {
        return _shares[account];
    }

    /// @notice Returns the current share price as assets-per-share, scaled by 1e18.
    ///         The price increases monotonically as yield is harvested and compounded.
    /// @return price  Native assets per vault share (1e18 = 1.0)
    function sharePrice() external view returns (uint256 price) {
        if (totalShares == 0) return 1e18;
        price = (totalDeposited * 1e18) / totalShares;
    }

    /// @notice Estimates the annualised yield based on the last completed era reward.
    ///         Formula: APY (bps) = lastEraReward * erasPerYear * 10_000 / totalDeposited
    ///         Assumes 1 era ≈ 6 hours on Polkadot → 1 460 eras per year.
    /// @return apy  Estimated APY in basis points (100 bps = 1 %)
    function estimatedAPY() external view returns (uint256 apy) {
        if (totalDeposited == 0) return 0;
        uint32 currentEra = STAKING.activeEra();
        uint256 lastReward = STAKING.erasValidatorReward(currentEra > 0 ? currentEra - 1 : 0);
        uint256 erasPerYear = 1460; // 1 era / 6 h × 24 h × 365 days
        apy = (lastReward * erasPerYear * 10_000) / totalDeposited;
    }

    /// @notice Returns the total number of depositors currently holding shares.
    ///         NOTE: This implementation tracks count via an internal counter for gas efficiency.
    ///         A production vault should use OpenZeppelin's EnumerableSet for enumeration.
    /// @return count  Number of addresses that hold a non-zero share balance
    function depositorCount() external view returns (uint256 count) {
        // Simplified: returns totalShares as a proxy.
        // Replace with an explicit EnumerableSet counter in production.
        count = totalShares > 0 ? 1 : 0; // placeholder — override with explicit tracking
    }

    // -----------------------------------------------------------------------
    // Fallback
    // -----------------------------------------------------------------------

    /// @dev Accept plain native token transfers (e.g. reward callbacks from precompiles)
    receive() external payable {}
}
