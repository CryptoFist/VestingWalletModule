# VestingWalletModule
Using VestingWalletModule, users can create their own vesting schedule.
Ofc, it's different way that claim rewards by staking, but it can be helpful for keep token price and something like that.
I think, it can be so useful for small company for paying to devs.
This is implemented that accept all ERC20 and native token.
Mentioning more detail about that, by only depositing tokens, client will not care to pay devs. 
Devs can get paid through that contract.

## Variables
    | name              | type                          | description                                                           |
    | _released         | uint256                       | Presents total claimed native token amount.                           |
    | _erc20Released    | mapping(address => uint256)   | Presents total claimed erc20 token amount.                            |
    | _beneficiary      | address                       | Consider [constructor](#constructor)                                  |
    | _vestingManager   | address                       | Consider [constructor](#constructor)                                  |
    | _start            | uint64                        | Consider [constructor](#constructor)                                  |
    | duration          | uint64                        | Consider [constructor](#constructor)                                  |
    | tokens            | AddressSet                    | Presents token addresses that deposited to this vesting wallet.       |

## constructor
    | name                  | type    | description                                                                         |
    | vestingManager        | address | As manager address, this address will get permission for several actions            |
    | beneficiaryAddress    | address | This address is user's or contract address that when claim assets, it will goes to. |
    | startTimestamp        | uint64  | The block's timestamp that vesting will be started.                                 |
    | durationSeconds       | uint64  | The duration calculated by timestamp for vesting.                                   |

### functions
    `beneficiary`
        return _beneficiary value.
    `getTokens`
        return tokens list deposited to `VestingWallet`.
    `start`
        return _start timestamp value.
    `duration`
        return _duration timestamp value.
    `released`
        return released native token amount.
    `released`
        return released ERC20 token amount.
        | name  | type    | description          |
        | token | address | ERC20 token address  |
        
    # release()
        Anyone can call this function to claim native token to beneficiary.
        If there is releasable native token, it will be transferred to beneficiary.
        But before call this function, vesting should be started and there should be releasable amount.
        If not, it reverts tx.
    # release(address token)
        Anyone can call this function to claim erc20 token to beneficiary.
        If there is releasable ERC20 token, it will be transferred to beneficiary.
        But before call this function, vesting should be started and there should be releasable amount.
        If not, it reverts tx.
    # addToken(address token)
        This function can be called only vesting manager.
        Vesting manager should call this function after deposit erc20 tokens to `VestingWallet`.
        But after deposit native token, no need to call this function.
        Even if didn't call this function after deposit, no affect to claim vested amount but there will be serious problem for cancel and format vesting wallet.
        So I suggests to use `VestingManager`.
    # changeVestingManager(address newManager)
    # startVesting(
        address beneficiaryAddress,
        uint64 startTimestamp,
        uint64 durationSeconds
    )
        This function also can be called by only vesting manager.
        Vesting manager calls this function when manager will keep going on the vesting.
        When call this function, this function remove all old datas and replace new data such as beneficiary, startTimestamp and durationSeconds.
    # cancelVesting()
        This function also can be called by only vesting manager.
        Vesting manager calls this function when manager wanna cancel this vesting schedule.
        At that time, releasable amount that didn't claim to beneficiary will be transferred to beneficiary and others will goes to vesting manager.
    # changeBeneficiary(address newBeneficiary)
        Users can't change beneficiary after started vesting.
        But vesting manager can do this.
    # vestedAmount(uint64 timestamp)
        return total amount of native token that deposited to `VestingWallet`.
    # vestedAmount(address token, uint64 timestamp)
        return total amount of erc20 token that deposited to `VestingWallet`.
    # releasableAmount()
        return relesable native token amount.
    # releasableAmount(address token)
        return relesable erc20 token amount.

# VestingManager
This contract is combination of ERC20, Ownable and `VestingWallet` module.
As you can read through `VestingWallet` explanation, I suggest to use this `VestingManager`.
Using this contract, manager can manage several vesting schedules.

### variables
    # vestingWallets
    # vestingUsers

### constructor

### functions
    # getVestingWallet(address vestingPlayer)
        This is public function so anyone can see the vesting wallet address by a vesting player.
    # changeBeneficiary(address newBeneficiary)
        Change beneficiary address of sender.
        This function should be called by a vesting player who wants to change beneficiary address.
        If not, it reverts tx.
    # addNewVesting(
        address vestingUser,
        address beneficiary,
        uint64 duration
    )
        This function can be called by only owner.
        Let users to start vesting if they didn't start vesting already.
        If they started vesting already, it reverts tx.
    # cancelVesting(address vestingPlayer)
        This function can be called by only owner.
        Call cancelVesting function of `VestingWallet` of `VestingPlayer`.
        Releasable amount will goes beneficiary and other will goes to `VestingManager` contract.
    # depositAndProvideETH()
        Anyone can call this function to deposit native token.
        If a user deposit native token, this function divide to same amount and provide it to vesting wallets.
    # depositToVestingWallets(address[] users)
        Anyone can call this function to deposit native token.
        If a user deposit native token, this function divide to same amount and provide it to vesting wallets passed as params.
        The address list for users should not be empty.
        If not, reverts tx.
    # depositAndProvideERC20(address token, uint256 amount)
        Anyone can call this function to deposit ERC20 token.
        If a user deposit native token, this function divide to same amount and provide it to vesting wallets.
    # depositToVestingWallets(
        address token,
        address[] memory users,
        uint256 amount
    )
        Anyone can call this function to deposit ERC20 token.
        If a user deposit native token, this function divide to same amount and provide it to vesting wallets.
    # withdrawETH()
        Only owner can call this function.
        Withdraw all native token to owner.
    # withdrawERC20(address token)
        Only owner can call this function.
        Withdraw all erc20 token amount to owner.