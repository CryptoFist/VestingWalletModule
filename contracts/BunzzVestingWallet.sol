// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract BunzzVestingWallet is Ownable, Pausable {

    event Released(uint256 amount);
    event CancelVesting();
    event StartVesting();

    address public _vestingToken;
    address private _beneficiary;
    uint256 private _released;
    uint64 private _start;
    uint64 private _duration;
    bool private _revockable;
    
    constructor() {
        _pause();
    }

    function connectToOtherContracts(
        address[] calldata contracts
    ) external onlyOwner whenPaused {
        require (contracts.length > 0, "invalid contracts length");
        require (contracts[0] != address(0), "invalid contract address");

        if (_vestingToken != address(0)) {
            require(IERC20(_vestingToken).balanceOf(address(this)) == 0, "remain origin tokens.");
        }
        _vestingToken = contracts[0];
    }

    function beneficiary() public view returns (address) {
        return _beneficiary;
    }

    function start() public view returns (uint256) {
        return _start;
    }

    function duration() public view returns (uint256) {
        return _duration;
    }

    function revockable() public view returns (bool) {
        return _revockable;
    }

    function released() public view returns (uint256) {
        return _released;
    }

    function vestingToken() public view returns (address) {
        return _vestingToken;
    }

    function release() public whenNotPaused {
        uint256 releasable = releasableAmount();
        require (releasable > 0, "no releasable amount");
        _released += releasable;
        emit Released(releasable);
        SafeERC20.safeTransfer(IERC20(_vestingToken), beneficiary(), releasable);
    }

    /// @notice Start again stoped vesting
    /// @dev Only vesting manager can call this function.
    /// @param beneficiaryAddress The address of beneficiary.
    /// @param startTimestamp The timestamp of start vesting.
    /// @param durationSeconds Vesting period
    function createVestingSchedule(
        address beneficiaryAddress,
        uint64 startTimestamp,
        uint64 durationSeconds,
        bool revockable_
    ) external onlyOwner whenPaused {
        require (IERC20(_vestingToken).balanceOf(address(this)) > 0, "not enough vesting token amount");
        require(beneficiaryAddress != address(0), "VestingWalletModule: beneficiary is zero address");
        require (startTimestamp >= block.timestamp, "invalid start time");
        require (durationSeconds > 0, "invalid duration time");
        
        _beneficiary = beneficiaryAddress;
        _start = startTimestamp;
        _duration = durationSeconds;
        _unpause();
        _released = 0;
        _revockable = revockable_;

        emit StartVesting();
    }

    /// @notice Cancel vesting
    /// @dev Only vesting manager can call this function.
    function revokeVestingSchedule() external onlyOwner whenNotPaused {
        require (_revockable == true, "revocke not available");
        _pause();
        _cancelVesting();

        emit CancelVesting();
    }

    function emergencyWithdraw() external onlyOwner whenPaused {
        require (_vestingToken != address(0), "vesting token isn't set");
        uint256 vestingTokenAmount = IERC20(_vestingToken).balanceOf(address(this));
        require (vestingTokenAmount > 0, "no remain vesting token");
        SafeERC20.safeTransfer(IERC20(_vestingToken), owner(), vestingTokenAmount);
    }

    function vestedAmount(uint64 timestamp) public view returns (uint256) {
        return _vestingSchedule(IERC20(_vestingToken).balanceOf(address(this)) + _released, timestamp);
    }

    function releasableAmount() public view returns (uint256) {
        return vestedAmount(uint64(block.timestamp)) - released();
    }

    function _vestingSchedule(uint256 totalAllocation, uint64 timestamp) internal view returns (uint256) {
        if (timestamp < start()) {
            return 0;
        } else if (timestamp > start() + duration()) {
            return totalAllocation;
        } else {
            return (totalAllocation * (timestamp - start())) / duration();
        }
    }

    function _cancelVesting() internal {
        uint256 releasable = releasableAmount();
        if (releasable > 0) {
            SafeERC20.safeTransfer(IERC20(_vestingToken), _beneficiary, releasable);
            _released += releasable;
        }
    }
}