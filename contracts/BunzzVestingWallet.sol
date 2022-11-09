// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "hardhat/console.sol";

contract BunzzVestingWallet is Pausable {
    using EnumerableSet for EnumerableSet.AddressSet;

    event EtherReleased(uint256 amount);
    event ERC20Released(address indexed token, uint256 amount);
    event CancelVesting();
    event StartVesting();

    uint256 private _released;
    mapping(address => uint256) private _erc20Released;
    address private _beneficiary;
    address private _vestingManager;
    uint64 private _start;
    uint64 private _duration;

    EnumerableSet.AddressSet private tokens;

    /**
     * @dev Set the beneficiary, start timestamp and vesting duration of the vesting wallet.
     */
    constructor(
        address vestingManager,
        address beneficiaryAddress,
        uint64 startTimestamp,
        uint64 durationSeconds
    ) {
        require(beneficiaryAddress != address(0), "VestingWalletModule: beneficiary is zero address");
        require(vestingManager != address(0), "VestingWalletModule: vesting manager is zero address");
        _beneficiary = beneficiaryAddress;
        _vestingManager = vestingManager;
        _start = startTimestamp;
        _duration = durationSeconds;
    }

    modifier onlyManager {
        require(_msgSender() == _vestingManager, "no permission");
        _;
    }

    /**
     * @dev The contract should be able to receive Eth.
     */
    receive() external payable {}

    /**
     * @dev Getter for the beneficiary address.
     */
    function beneficiary() public view returns (address) {
        return _beneficiary;
    }

    /// @notice Get list of vesting tokens.
    /// @return List of vesting tokens.
    function getTokens() external view returns (address[] memory) {
        return tokens.values();
    }

    /**
     * @dev Getter for the start timestamp.
     */
    function start() public view returns (uint256) {
        return _start;
    }

    /**
     * @dev Getter for the vesting duration.
     */
    function duration() public view returns (uint256) {
        return _duration;
    }

    /**
     * @dev Amount of eth already released
     */
    function released() public view returns (uint256) {
        return _released;
    }

    /**
     * @dev Amount of token already released
     */
    function released(address token) public view returns (uint256) {
        return _erc20Released[token];
    }

    /**
     * @dev Release the native token (ether) that have already vested.
     *
     * Emits a {EtherReleased} event.
     */
    function release() public whenNotPaused {
        require (_start != 0, "not stared!");
        uint256 releasable = releasableAmount();
        require (releasable > 0, "no releasable amount");
        _released += releasable;
        emit EtherReleased(releasable);
        Address.sendValue(payable(beneficiary()), releasable);
    }

    /**
     * @dev Release the tokens that have already vested.
     *
     * Emits a {ERC20Released} event.
     */
    function release(address token) public whenNotPaused {
        require (_start != 0, "not stared!");
        uint256 releasable = releasableAmount(token);
        require (releasable > 0, "no releasable amount");
        _erc20Released[token] += releasable;
        emit ERC20Released(token, releasable);
        SafeERC20.safeTransfer(IERC20(token), beneficiary(), releasable);
        _addToken(token);
    }

    /// @notice Add token to list.
    /// @dev Only manager can call this function.
    /// @param token The address of a token.
    function addToken(address token) public whenNotPaused onlyManager {
        _addToken(token);
    }

    /// @notice Change vesting manager address.
    /// @dev Only vesting manager can call this function.
    /// @param newManager The address of new vesting manager.
    function changeVestingManager(address newManager) external onlyManager whenNotPaused {
        _vestingManager = newManager;
    }

    /// @notice Start again stoped vesting
    /// @dev Only vesting manager can call this function.
    /// @param beneficiaryAddress The address of beneficiary.
    /// @param startTimestamp The timestamp of start vesting.
    /// @param durationSeconds Vesting period
    function startVesting(
        address beneficiaryAddress,
        uint64 startTimestamp,
        uint64 durationSeconds
    ) external onlyManager whenPaused {
        require(beneficiaryAddress != address(0), "VestingWalletModule: beneficiary is zero address");
        
        _beneficiary = beneficiaryAddress;
        _start = startTimestamp;
        _duration = durationSeconds;
        _unpause();
        _formatInfo();
        emit StartVesting();
    }

    /// @notice Cancel vesting
    /// @dev Only vesting manager can call this function.
    function cancelVesting() external onlyManager whenNotPaused {
        _pause();
        _cancelETHVesting();
        uint256 tokenLength = tokens.length();
        if (tokenLength > 0) {
            for (uint256 i = 0; i < tokenLength; i ++) {
                _cancelERC20Vesting(tokens.at(i));
            }
        }

        _start = 0;
        _duration = 0;

        emit CancelVesting();
    }

    /// @notice Update beneficiary address.
    /// @dev Only vesting manager can call this function.
    /// @param newBeneficiary The address of new beneficiary.
    function changeBeneficiary(address newBeneficiary) external onlyManager {
        _beneficiary = newBeneficiary;
    }

    /**
     * @dev Calculates the amount of ether that has already vested. Default implementation is a linear vesting curve.
     */
    function vestedAmount(uint64 timestamp) public view returns (uint256) {
        return _vestingSchedule(address(this).balance + released(), timestamp);
    }

    /**
     * @dev Calculates the amount of tokens that has already vested. Default implementation is a linear vesting curve.
     */
    function vestedAmount(address token, uint64 timestamp) public view returns (uint256) {
        return _vestingSchedule(IERC20(token).balanceOf(address(this)) + released(token), timestamp);
    }

    /// @notice Get releasable ETH amount.
    /// @return Releasable ETH amount.
    function releasableAmount() public view returns (uint256) {
        return vestedAmount(uint64(block.timestamp)) - released();
    }

    /// @notice Get releasable ERC20 amount.
    /// @param token The address of ERC20.
    /// @return Releasable ERC20 amount.
    function releasableAmount(address token) public view returns (uint256) {
        return vestedAmount(token, uint64(block.timestamp)) - released(token);
    }

    /**
     * @dev implementation of the vesting formula. This returns the amount vested, as a function of time, for
     * an asset given its total historical allocation.
     */
    function _vestingSchedule(uint256 totalAllocation, uint64 timestamp) internal view returns (uint256) {
        if (timestamp < start()) {
            return 0;
        } else if (timestamp > start() + duration()) {
            return totalAllocation;
        } else {
            return (totalAllocation * (timestamp - start())) / duration();
        }
    }

    /// @notice Stop vesting fo ETH.
    /// @dev Send releasable amount to beneficiary and left will be sent to vesting manager.
    function _cancelETHVesting() internal {
        int256 releasable = int256(vestedAmount(uint64(block.timestamp))) - int256(released());
        int256 leftAmount = 0;
        if (releasable > 0) {
            leftAmount = int256(address(this).balance) - int256(releasable);
            Address.sendValue(payable(beneficiary()), uint256(releasable));
            _released += uint256(releasable);
        }
        
        if (leftAmount > 0) {
            Address.sendValue(payable(_vestingManager), uint256(leftAmount));
        }
    }

    /// @notice Stop vesting of ERC20.
    /// @dev Send releasable amount to beneficiary and left will be sent to vesting manager.
    function _cancelERC20Vesting(address token) internal {
        int256 releasable = int256(vestedAmount(token, uint64(block.timestamp)) - released(token));
        int256 leftAmount = 0;
        if (releasable > 0) {
            leftAmount = int256(IERC20(token).balanceOf(address(this))) - int256(releasable);
            SafeERC20.safeTransfer(IERC20(token), beneficiary(), uint256(releasable));
            _erc20Released[token] += uint256(releasable);
        }
        
        if (leftAmount > 0) {
            SafeERC20.safeTransfer(IERC20(token), _vestingManager, uint256(leftAmount));
        }
    }

    /// @notice notice all intial values with zero.
    function _formatInfo() internal {
        _released = 0;
        address[] memory tokenAddrs = tokens.values();
        for (uint256 i = 0; i < tokenAddrs.length; i ++) {
            address token = tokenAddrs[i];
            _erc20Released[token] = 0;
            tokens.remove(token);
        }
    }

    /// @notice add token to tokens.
    /// @param token The address of ERC20 token.
    function _addToken(address token) internal {
        if (tokens.contains(token) == true) {
            return;
        }
        tokens.add(token);
    }
}