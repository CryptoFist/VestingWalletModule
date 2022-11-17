const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deploy, getTimestmp, spendTime, getETHBalance } = require('../scripts/utils');
const { constants } = require('@openzeppelin/test-helpers');

const bigNum = num => (num + '0'.repeat(18));
const smallNum = num => (parseInt(num) / bigNum(1));
const hour = 60 * 60;
const day = 24 * hour;

describe ("Test BunzVestingWallet", function () {
    before (async function () {
        [
            this.deployer,
            this.vestingManager,
            this.vestingManager_1,
            this.beneficiary,
            this.beneficiary_1,
            this.user_1,
            this.user_2
        ] = await ethers.getSigners();

        this.startTimestamp = BigInt(await getTimestmp()) + BigInt(hour);
        this.durationSeconds = day;

        this.vestingWallet = await deploy("BunzzVestingWallet");

        this.vestingToken = await deploy(
            "ERC20Mock",
            "VestingToken",
            "VT"
        );
    })

    it ("check deployment", async function () {
        console.log("deployed successfully");
    })

    it ("reverts withdraw if vesting token is not set", async function () {
        await expect (
            this.vestingWallet.emergencyWithdraw()
        ).to.be.revertedWith("vesting token isn't set");
    })

    it ("reverts release and rovoke if not started vesting", async function () {
        await expect (
            this.vestingWallet.release()
        ).to.be.revertedWith("Pausable: paused");

        await expect (
            this.vestingWallet.revokeVestingSchedule()
        ).to.be.revertedWith("Pausable: paused");
    })

    it ("connect ERC20 vesting token to VestingWallet module", async function () {
        await expect (
            this.vestingWallet.connect(this.user_1).connectToOtherContracts(
                [
                    this.vestingToken.address
                ]
            )
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect (
            this.vestingWallet.connectToOtherContracts(
                [
                    constants.ZERO_ADDRESS
                ]
            )
        ).to.be.revertedWith("invalid contract address");

        await expect (
            this.vestingWallet.connectToOtherContracts([])
        ).to.be.revertedWith("invalid contracts length");

        await this.vestingWallet.connectToOtherContracts(
            [
                this.vestingToken.address
            ]
        );

        expect (await this.vestingWallet.vestingToken()).to.be.equal(this.vestingToken.address);
    })

    it ("create vesting schedule", async function () {
        let curTime = await getTimestmp();
        await expect (
            this.vestingWallet.createVestingSchedule(
                this.beneficiary.address,
                BigInt(curTime) + BigInt(1000),
                10 * day,
                false
            )
        ).to.be.revertedWith("not enough vesting token amount");

        await this.vestingToken.transfer(this.vestingWallet.address, bigNum(10000));

        await expect(
            this.vestingWallet.createVestingSchedule(
                constants.ZERO_ADDRESS,
                BigInt(curTime) + BigInt(1000),
                10 * day,
                false
            )
        ).to.be.revertedWith("VestingWalletModule: beneficiary is zero address");

        await expect(
            this.vestingWallet.createVestingSchedule(
                this.beneficiary.address,
                BigInt(curTime) - BigInt(1000),
                10 * day,
                false
            )
        ).to.be.revertedWith("invalid start time");

        await expect(
            this.vestingWallet.createVestingSchedule(
                this.beneficiary.address,
                BigInt(curTime) + BigInt(1000),
                0,
                false
            )
        ).to.be.revertedWith("invalid duration time");

        await expect (
            this.vestingWallet.createVestingSchedule(
                this.beneficiary.address,
                BigInt(curTime) + BigInt(1000),
                10 * day,
                true
            )
        ).to.be.emit(this.vestingWallet, "StartVesting");

        expect (await this.vestingWallet.revockable()).to.be.equal(true);
        expect (await this.vestingWallet.beneficiary()).to.be.equal(this.beneficiary.address);
        expect(await this.vestingWallet.start()).to.be.equal(curTime + 1000);
        expect(await this.vestingWallet.duration()).to.be.equal(10 * day);
        expect(await this.vestingWallet.released()).to.be.equal(0);
    })

    it ("release vesting token", async function () {
        await expect (
            this.vestingWallet.release()
        ).to.be.revertedWith("no releasable amount");
        let curTime = await getTimestmp();
        expect (smallNum(await this.vestingWallet.vestedAmount(BigInt(curTime)))).to.be.equal(0);
        expect (smallNum(await this.vestingWallet.releasableAmount())).to.be.equal(0);

        await spendTime(day * 2);
        let releasable = await this.vestingWallet.releasableAmount();
        let beforeBal = await this.vestingToken.balanceOf(this.beneficiary.address);
        await this.vestingWallet.release();
        let afterBal = await this.vestingToken.balanceOf(this.beneficiary.address);
        expect (smallNum(afterBal) - smallNum(beforeBal)).to.be.closeTo(smallNum(releasable), 0.1);
    })

    it ("revoke vesting schedule and withdraw", async function () {
        await expect (
            this.vestingWallet.revokeVestingSchedule()
        ).to.be.emit(this.vestingWallet, "CancelVesting");

        await expect (
            this.vestingWallet.connectToOtherContracts(
                [
                    this.vestingToken.address
                ]
            )
        ).to.be.revertedWith("remain origin tokens");

        let expectAmount = await this.vestingToken.balanceOf(this.vestingWallet.address);
        let beforeBal = await this.vestingToken.balanceOf(this.deployer.address);
        await this.vestingWallet.emergencyWithdraw();
        let afterBal = await this.vestingToken.balanceOf(this.deployer.address);
        expect (smallNum(afterBal) - smallNum(beforeBal)).to.be.closeTo(smallNum(expectAmount), 0.1);

        await this.vestingWallet.connectToOtherContracts(
            [
                this.vestingToken.address
            ]
        );
    })
})