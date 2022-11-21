# VestingWalletModule
Using VestingWalletModule, users can create their own vesting schedule.
Ofc, it's different way that claim rewards by staking, but it can be helpful for keep token price and something like that.
I think, it can be so useful for small company for paying to devs.
This is implemented that accept vesting token wallet owner set and manage only one vesting schedule.
Mentioning more detail about that, by only depositing tokens, client will not care to pay devs. 
Devs can get paid through that contract.

### Variables
    # _released
        Presents total claimed vesting token amount.
    # _beneficiary
        This address is user's or contract address that when claim assets, it will goes to.
    # _start
        The block's timestamp that vesting will be started.
    # _duration
        The duration calculated by timestamp for vesting.
    # _vestingToken
        The address of vesting token.
    # _revockable
        The flag to indicate whether revock vesting schedule is possible.

### functions
    # connectToOtherContracts(address[] calldata contracts)
        Bunzz style function.  `contracts` length is 1 and contracts[0] is vesting token address.
    # beneficiary()
        return _beneficiary value.
    # start()
        return _start timestamp value.
    # duration()
        return _duration timestamp value.
    # revockable()
        return _revockable bool value.
    # released()
        return released vesting token amount.
    # vestingToken()
        return vesting token address.
    # release()
        Anyone can call this function to claim vesting token to beneficiary.
        If there is releasable vesting token, it will be transferred to beneficiary.
        But before call this function, vesting should be started and there should be releasable amount.
        If not, it reverts tx.
    # createVestingSchedule(
        address beneficiaryAddress,
        uint64 startTimestamp,
        uint64 durationSeconds,
        bool revockable
    )
        This function also can be called by only owner.
        Vesting manager calls this function to create new vesting.
        When call this function, this function remove all old datas and replace new data such as beneficiary, startTimestamp and durationSeconds.
    # revokeVestingSchedule()
        This function also can be called by only owner.
        Vesting manager calls this function when owner wanna cancel this vesting schedule.
        At that time, releasable amount that didn't claim to beneficiary will be transferred to beneficiary and `vesting wallet` is paused.
    # emergencyWithdraw()
        Withdraw vesting token that `vesting wallet` contract has.
        But only owner can call this function and before call this, contract should be paused.
    # vestedAmount(uint64 timestamp)
        return total amount of vesting token that deposited to `VestingWallet`.
    # releasableAmount()
        return relesable vesting token amount.