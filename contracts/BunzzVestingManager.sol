// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./BunzzVestingWallet.sol";
import "./interfaces/IBunzzVestingWallet.sol";

import "hardhat/console.sol";

contract BunzzVestingManager is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    event StartNewVesting(address indexed user);
    event ChangeBeneficiary(address indexed vestingPlayer, address newBeneficiary);

    mapping(address => address) private vestingWallets;
    EnumerableSet.AddressSet private vestingUsers;

    constructor () { }

    /// @notice Get vesting wallet.
    /// @param vestingPlayer The address of a vestingPlayer.
    /// @return The address of vestingWallet.
    function getVestingWallet(address vestingPlayer) external view returns (address) {
        return vestingWallets[vestingPlayer];
    }

    /// @notice Change beneficiary address of a user.
    /// @param newBeneficiary The address of new beneficiary.
    function changeBeneficiary(address newBeneficiary) external {
        address sender = _msgSender();
        require (
            vestingUsers.contains(sender) == true, 
            "vesting is not started"
        );
        IBunzzVestingWallet vestingWallet = IBunzzVestingWallet(vestingWallets[sender]);
        vestingWallet.changeBeneficiary(newBeneficiary);
        emit ChangeBeneficiary(sender, newBeneficiary);
    }

    /// @notice Start new vesting for a user.
    /// @dev Only owner can call this function.
    /// @param vestingUser The address of a vesting user.
    /// @param beneficiary The address of beneficiary.
    /// @param duration The vesting period as second.
    function addNewVesting(
        address vestingUser,
        address beneficiary,
        uint64 duration
    ) external onlyOwner {
        require (vestingUsers.contains(vestingUser) == false, "Already started");
        address vestingWallet = vestingWallets[vestingUser];
        if (vestingWallet != address(0)) {
            IBunzzVestingWallet(vestingWallet).startVesting(
                beneficiary, 
                uint64(block.timestamp),
                duration
            );
        } else {
            address newVestingWallet = address(new BunzzVestingWallet(
                address(this),
                beneficiary,
                uint64(block.timestamp),
                duration
            ));

            vestingWallets[vestingUser] = newVestingWallet;
        }
        vestingUsers.add(vestingUser);

        emit StartNewVesting(vestingUser);
        
    }

    /// @notice Cancel user vesting.
    /// @dev Only owner can call this function.
    /// @param vestingPlayer The address of a vestingPlayer.
    function cancelVesting(address vestingPlayer) external onlyOwner {
        require (
            vestingUsers.contains(vestingPlayer) == true, 
            "vesting is not started"
        );
        IBunzzVestingWallet vestingWallet = IBunzzVestingWallet(vestingWallets[vestingPlayer]);
        vestingWallet.cancelVesting();
        vestingUsers.remove(vestingPlayer);
    }

    /// @notice Deposit ETH and divide ETH to all vesting wallets.
    function depositAndProvideETH() external payable {
        uint256 amount = msg.value;
        uint256 userLength = vestingUsers.length();

        require (userLength > 0, "no vesting wallets to divide");
        uint256 divideAmount = amount / userLength;
        for (uint256 i = 0; i < userLength; i ++) {
            address vestingPlayer = vestingUsers.at(i);
            address vestingWallet = vestingWallets[vestingPlayer];
            Address.sendValue(payable(vestingWallet), divideAmount);
        }
    }

    /// @notice Deposit ETH to users vesting wallet.
    function depositToVestingWallets(
        address[] memory users
    ) external payable {
        uint256 amount = msg.value;
        uint256 userLength = users.length;

        require (userLength > 0, "invalid user list");
        uint256 divideAmount = amount / userLength;
        for (uint256 i = 0; i < userLength; i ++) {
            address vestingWallet = vestingWallets[users[i]];
            Address.sendValue(payable(vestingWallet), divideAmount);
        }
    }

    /// @notice Deposit ERC20 and divide ETH to all vesting wallets.
    function depositAndProvideERC20(address token, uint256 amount) external {
        uint256 userLength = vestingUsers.length();
        require (userLength > 0, "no vesting wallets to divide");
        
        SafeERC20.safeTransferFrom(IERC20(token), msg.sender, address(this), amount);
        uint256 divideAmount = amount / userLength;
        for (uint256 i = 0; i < userLength; i ++) {
            address vestingPlayer = vestingUsers.at(i);
            address vestingWallet = vestingWallets[vestingPlayer];
            SafeERC20.safeTransfer(IERC20(token), vestingWallet, divideAmount);
            IBunzzVestingWallet(vestingWallet).addToken(token);
        }
    }

    /// @notice Deposit ETH to users vesting wallet.
    function depositToVestingWallets(
        address token,
        address[] memory users,
        uint256 amount
    ) external {
        uint256 userLength = users.length;

        require (userLength > 0, "invalid user list");
        SafeERC20.safeTransferFrom(IERC20(token), msg.sender, address(this), amount);
        uint256 divideAmount = amount / userLength;
        for (uint256 i = 0; i < userLength; i ++) {
            address vestingWallet = vestingWallets[users[i]];
            SafeERC20.safeTransfer(IERC20(token), vestingWallet, divideAmount);
            IBunzzVestingWallet(vestingWallet).addToken(token);
        }
    }

    /// @notice Withdraw ETH to owner.
    /// @dev Only owner can call this function.
    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            Address.sendValue(payable(owner()), balance);
        }
    }

    /// @notice Withdraw ERC20 to owner.
    /// @dev Only owner can call this function.
    /// @param token The address of ERC20 token.
    function withdrawERC20(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            SafeERC20.safeTransfer(IERC20(token), owner(), balance);
        }
    }

    receive() external payable {}
}