// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

interface IBunzzVestingWallet {
    function beneficiary() external view returns (address);

    function getTokens() external view returns (address[] memory);

    function addToken(address token) external;

    function start() external view returns (uint256);

    function duration() external view returns (uint256);

    function released() external view returns (uint256);

    function released(address token) external view returns (uint256);

    function release() external ;

    function release(address token) external;

    function changeVestingManager(address newManager) external;

    function startVesting(
        address beneficiaryAddress,
        uint64 startTimestamp,
        uint64 durationSeconds
    ) external;

    function cancelVesting() external;

    function changeBeneficiary(address newBeneficiary) external;

    function vestedAmount(uint64 timestamp) external view returns (uint256);

    function vestedAmount(address token, uint64 timestamp) external view returns (uint256);
}