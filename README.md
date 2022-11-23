# VestingWalletModule


## Overview

Using VestingWalletModule, users can create their own vesting schedule.
Ofc, it's different way that claim rewards by staking, but it can be helpful for keep token price and something like that.
For now, I think it can be used for two purposes.
One is keeping token price and other is paying to devs.
This is implemented that accept vesting token and wallet owner set and manage only one vesting schedule.
In addition, this `VestingWallet` connect to `ERC20` contract.


## How to Use

1. Deploy smart contract via `Bunzz`
2. Set `vesting token` address by calling `connectToOtherContracts` function.   (If you deploy this module and `ERC20` at the same time, the `connectToOtherContracts` function is executed by `Bunzz` automatically)
3. By calling `createVestingSchedule` function, create vesting schedule. 
   1) Before that, you should deposit vesting token.
4. If you think it's not fair, you can revoke the vesting schedule anytime by calling `revokeVestingSchedule` function.
5. Beneficiary will get reelased vesting tokens when someone calls `release` function.


## Functions

<br>

### `connectToOtherContracts`

`Bunzz` style function.  
`contracts` length is 1 and contracts[0] is vesting token address.

| name        | type             | description                       |
| :---        |    :----:        |          ---:                     |
| contracts   |address[] calldata| addresses should be connected to vesting wallet   |
        
### `beneficiary`
return _beneficiary value.

### `start`
return _start timestamp value.

### `duration`
return _duration timestamp value.

### `revockable`
return _revockable bool value.

### `released`
return released vesting token amount.

### `vestingToken`
return vesting token address.

### `release`
Anyone can call this function to claim vesting token to beneficiary.
If there is releasable vesting token, it will be transferred to beneficiary.
But before call this function, vesting should be started and there should be releasable amount.
If not, it reverts tx.

### `createVestingSchedule`

This function also can be called by only owner.
Vesting manager calls this function to create new vesting.
When call this function, this function remove all old datas and replace new data such as beneficiary, startTimestamp and durationSeconds.

| name             | type             | description                     |
| :---             |    :----:        |          ---:                   |
|beneficiaryAddress| address          | The address of beneficiary.     |
| startTimestamp   | uint64           | The timestamp of start vesting. |
| durationSeconds  | uint64           | Vesting period                  |
| revockable       | bool             | Whether can revocek or not.     |

### `revokeVestingSchedule`
This function also can be called by only owner.
Vesting manager calls this function when owner wanna cancel this vesting schedule.
At that time, releasable amount that didn't claim to beneficiary will be transferred to beneficiary and `vesting wallet` is paused.

### `emergencyWithdraw`
Withdraw vesting token that `vesting wallet` contract has.
But only owner can call this function and before call this, contract should be paused.

### `vestedAmount`

return total amount of vesting token that deposited to `VestingWallet`.

| name             | type             | description                      |
| :---             |    :----:        |          ---:                    |
| timestamp        | uint64           | Timestamp that get vested amount |

### `releasableAmount`
return relesable vesting token amount.

## Variables

### `_released`
Presents total claimed vesting token amount.

### `_beneficiary`
This address is user's or contract address that when claim assets, it will goes to.

### `_start`
The block's timestamp that vesting will be started.

### `_duration`
The duration calculated by timestamp for vesting.

### `_vestingToken`
The address of vesting token.

### `_revockable`
The flag to indicate whether revock vesting schedule is possible.