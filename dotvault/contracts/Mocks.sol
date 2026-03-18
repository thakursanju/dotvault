// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Mock Contracts for DotVault Testing
/// @notice Contains all mock precompiles used for testing DotVault contract

// ---------------------------------------------------------------------------
// Mock Staking Precompile
// ---------------------------------------------------------------------------

contract MockStaking {
    uint32 public era = 1;
    uint256 public reward = 1 ether;

    function bond(uint256) external {}
    function bondExtra(uint256) external {}
    function unbond(uint256) external {}
    function nominate(address[] calldata) external {}
    function activeEra() external view returns (uint32) { return era; }
    function erasTotalStake(uint32) external pure returns (uint256) { return 100 ether; }
    function erasValidatorReward(uint32) external view returns (uint256) { return reward; }
}

// ---------------------------------------------------------------------------
// Mock Native Assets Precompile
// ---------------------------------------------------------------------------

contract MockNativeAssets {
    function balanceOf(address) external view returns (uint256) {
        return address(this).balance;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        // For testing, just return true without sending value
        // In real precompile, this would handle native asset transfer
        return true;
    }
    receive() external payable {}
}

// ---------------------------------------------------------------------------
// Mock XCM Precompile
// ---------------------------------------------------------------------------

contract MockXCM {
    event MockTransfer(uint32 paraId, address recipient, uint256 amount);

    function transferAssetsToParachain(
        uint32 paraId,
        address recipient,
        uint256 amount
    ) external {
        emit MockTransfer(paraId, recipient, amount);
    }
}