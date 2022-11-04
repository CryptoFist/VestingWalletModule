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

        this.vestingWallet = await deploy(
            "BunzzVestingWallet",
            this.vestingManager.address,
            this.beneficiary.address,
            BigInt(this.startTimestamp),
            BigInt(this.durationSeconds)
        );

        this.vestingToken = await deploy(
            "ERC20Mock",
            "VestingToken",
            "VT"
        );
    })

    it ("check deployment", async function () {
        console.log("deployed successfully");
    })

    it ("check initial values", async function () {
        let curTime = await getTimestmp();
        expect (await this.vestingWallet.beneficiary()).to.be.equal(this.beneficiary.address);
        expect ((await this.vestingWallet.getTokens()).length).to.be.equal(0);
        expect (Number(await this.vestingWallet.start())).to.be.equal(Number(this.startTimestamp));
        expect (Number(await this.vestingWallet.duration())).to.be.equal(Number(this.durationSeconds));
        
        expect (smallNum(await this.vestingWallet['vestedAmount(uint64)'](BigInt(curTime)))).to.be.equal(0);
        expect (smallNum(await this.vestingWallet['vestedAmount(address,uint64)'](this.vestingToken.address, BigInt(curTime)))).to.be.equal(0);
    })

    it ("reverts startVesting if caller is not the manager", async function () {
        await expect (
            this.vestingWallet.startVesting(
                this.beneficiary.address,
                this.startTimestamp,
                this.durationSeconds
            )
        ).to.be.revertedWith("no permission");
    })

    it ("reverts startVesting if already created", async function () {
        await expect (
            this.vestingWallet.connect(this.vestingManager).startVesting(
                this.beneficiary.address,
                this.startTimestamp,
                this.durationSeconds
            )
        ).to.be.revertedWith("Pausable: not paused")
    })

    describe ("ETH vesting", function () {
        it("afer some times, claim vesting tokens", async function () {
            // Send ETH to vesting wallet.
            let depositAmount = bigNum(300);
            await this.vestingManager.sendTransaction({
                to: this.vestingWallet.address,
                value: BigInt(depositAmount)
            });
            // before startTime, vestedAmount is zero.
            expect(smallNum(await this.vestingWallet['vestedAmount(uint64)'](BigInt(await getTimestmp())))).to.be.equal(0);

            await spendTime(2 * hour);

            let currentTime = await getTimestmp();
            let expectAmount = BigInt(depositAmount) * (BigInt(currentTime) - BigInt(this.startTimestamp)) / BigInt(this.durationSeconds);
            expect(smallNum(await this.vestingWallet['vestedAmount(uint64)'](BigInt(await getTimestmp())))).to.be.closeTo(smallNum(expectAmount), 0.1);
            expect(smallNum(await this.vestingWallet['released()']())).to.be.equal(0);

            let beforeBal = await getETHBalance(this.beneficiary.address);
            await this.vestingWallet['release()']();
            let afterBal = await getETHBalance(this.beneficiary.address);
            expectAmount = await this.vestingWallet['released()']();
            expect(smallNum(afterBal) - smallNum(beforeBal)).to.be.closeTo(smallNum(expectAmount), 0.1);
        })

        it("cancel veting and check left releasable token is transferred to beneficiary", async function () {
            await spendTime(4 * hour);

            await expect(
                this.vestingWallet['cancelVesting()']()
            ).to.be.revertedWith("no permission");

            let expectAmount = await this.vestingWallet['vestedAmount(uint64)'](await getTimestmp());
            let releasable = await this.vestingWallet['releasableAmount()']();
            
            expectAmount = BigInt(expectAmount) - BigInt(await this.vestingWallet['released()']());
            expect (smallNum(expectAmount)).to.be.closeTo(smallNum(releasable), 0.1);
            let expectAmountForManager = BigInt(bigNum(300));
            let beforeBal = await getETHBalance(this.beneficiary.address);
            let beforeManagerBal = await getETHBalance(this.vestingManager.address);
            await expect(
                this.vestingWallet.connect(this.vestingManager).cancelVesting()
            ).to.be.emit(this.vestingWallet, "CancelVesting");
            let afterBal = await getETHBalance(this.beneficiary.address);
            let afterManagerBal = await getETHBalance(this.vestingManager.address);
            expectAmountForManager = BigInt(expectAmountForManager) - BigInt(await this.vestingWallet['released()']());

            expect(smallNum(afterBal) - smallNum(beforeBal)).to.be.closeTo(smallNum(expectAmount), 0.1);
            expect(smallNum(afterManagerBal) - smallNum(beforeManagerBal)).to.be.closeTo(smallNum(expectAmountForManager), 0.1);
        })
    })

    describe ("ERC20 vesting", function () {
        describe ("start and cancel vesting", function () {
            it("start vesting", async function () {
                await expect(
                    this.vestingWallet.connect(this.vestingManager).startVesting(
                        constants.ZERO_ADDRESS,
                        this.startTimestamp,
                        this.durationSeconds
                    )
                ).to.be.revertedWith("VestingWalletModule: beneficiary is zero address");

                this.startTimestamp = BigInt(await getTimestmp()) + BigInt(hour);

                await expect(
                    this.vestingWallet.connect(this.vestingManager).startVesting(
                        this.beneficiary.address,
                        this.startTimestamp,
                        this.durationSeconds
                    )
                ).to.be.emit(this.vestingWallet, "StartVesting");
            })

            it("afer some times, claim vesting tokens", async function () {

                // change beneficiary wallet
                await expect(
                    this.vestingWallet.changeBeneficiary(this.beneficiary_1.address)
                ).to.be.revertedWith("no permission");

                await this.vestingWallet.connect(this.vestingManager).changeBeneficiary(this.beneficiary_1.address);

                // Send VestingToken to vesting wallet.
                let depositAmount = bigNum(300);
                await this.vestingToken.transfer(this.vestingWallet.address, BigInt(depositAmount));
                // before startTime, vestedAmount is zero.
                expect(smallNum(await this.vestingWallet['vestedAmount(address,uint64)'](this.vestingToken.address, BigInt(await getTimestmp())))).to.be.equal(0);

                await spendTime(2 * hour);

                let currentTime = await getTimestmp();
                let expectAmount = BigInt(depositAmount) * (BigInt(currentTime) - BigInt(this.startTimestamp)) / BigInt(this.durationSeconds);
                expect(smallNum(await this.vestingWallet['vestedAmount(address,uint64)'](this.vestingToken.address, BigInt(await getTimestmp())))).to.be.closeTo(smallNum(expectAmount), 0.1);
                expect(smallNum(await this.vestingWallet['released(address)'](this.vestingToken.address))).to.be.equal(0);

                let beforeBal = await this.vestingToken.balanceOf(this.beneficiary_1.address);
                await this.vestingWallet['release(address)'](this.vestingToken.address);
                let afterBal = await this.vestingToken.balanceOf(this.beneficiary_1.address);
                expectAmount = await this.vestingWallet['released(address)'](this.vestingToken.address);
                expect(smallNum(afterBal) - smallNum(beforeBal)).to.be.closeTo(smallNum(expectAmount), 0.1);
            })

            it("cancel veting and check left releasable token is transferred to beneficiary", async function () {
                await spendTime(4 * hour);

                await expect(
                    this.vestingWallet['cancelVesting()']()
                ).to.be.revertedWith("no permission");

                let expectAmount = await this.vestingWallet['vestedAmount(address,uint64)'](this.vestingToken.address, await getTimestmp());
                expectAmount = BigInt(expectAmount) - BigInt(await this.vestingWallet['released(address)'](this.vestingToken.address));
                let expectAmountForManager = BigInt(bigNum(300));
                let beforeBal = await this.vestingToken.balanceOf(this.beneficiary_1.address);
                let beforeManagerBal = await this.vestingToken.balanceOf(this.vestingManager.address);
                await expect(
                    this.vestingWallet.connect(this.vestingManager).cancelVesting()
                ).to.be.emit(this.vestingWallet, "CancelVesting");
                let afterBal = await this.vestingToken.balanceOf(this.beneficiary_1.address);
                let afterManagerBal = await this.vestingToken.balanceOf(this.vestingManager.address);
                expectAmountForManager = BigInt(expectAmountForManager) - BigInt(await this.vestingWallet['released(address)'](this.vestingToken.address));

                expect(smallNum(afterBal) - smallNum(beforeBal)).to.be.closeTo(smallNum(expectAmount), 0.1);
                expect(smallNum(afterManagerBal) - smallNum(beforeManagerBal)).to.be.closeTo(smallNum(expectAmountForManager), 0.1);
            })
        })

        describe ("start vesting and fill full period", function () {
            it("start vesting", async function () {
                await expect(
                    this.vestingWallet.connect(this.vestingManager).startVesting(
                        constants.ZERO_ADDRESS,
                        this.startTimestamp,
                        this.durationSeconds
                    )
                ).to.be.revertedWith("VestingWalletModule: beneficiary is zero address");

                this.startTimestamp = BigInt(await getTimestmp()) + BigInt(hour);

                await expect(
                    this.vestingWallet.connect(this.vestingManager).startVesting(
                        this.beneficiary.address,
                        this.startTimestamp,
                        this.durationSeconds
                    )
                ).to.be.emit(this.vestingWallet, "StartVesting");
            })

            it("afer some times, claim vesting tokens", async function () {

                // change beneficiary wallet
                await expect(
                    this.vestingWallet.changeBeneficiary(this.beneficiary_1.address)
                ).to.be.revertedWith("no permission");

                await this.vestingWallet.connect(this.vestingManager).changeBeneficiary(this.beneficiary_1.address);

                // Send VestingToken to vesting wallet.
                let depositAmount = bigNum(300);
                await this.vestingToken.transfer(this.vestingWallet.address, BigInt(depositAmount));
                // before startTime, vestedAmount is zero.
                expect(smallNum(await this.vestingWallet['vestedAmount(address,uint64)'](this.vestingToken.address, BigInt(await getTimestmp())))).to.be.equal(0);

                await spendTime(2 * hour);

                let currentTime = await getTimestmp();
                let expectAmount = BigInt(depositAmount) * (BigInt(currentTime) - BigInt(this.startTimestamp)) / BigInt(this.durationSeconds);
                expect(smallNum(await this.vestingWallet['vestedAmount(address,uint64)'](this.vestingToken.address, BigInt(await getTimestmp())))).to.be.closeTo(smallNum(expectAmount), 0.1);
                expect(smallNum(await this.vestingWallet['released(address)'](this.vestingToken.address))).to.be.equal(0);

                let beforeBal = await this.vestingToken.balanceOf(this.beneficiary_1.address);
                await this.vestingWallet['release(address)'](this.vestingToken.address);
                let afterBal = await this.vestingToken.balanceOf(this.beneficiary_1.address);
                expectAmount = await this.vestingWallet['released(address)'](this.vestingToken.address);
                expect(smallNum(afterBal) - smallNum(beforeBal)).to.be.closeTo(smallNum(expectAmount), 0.1);
            })

            it("after duration get all vested amount", async function () {
                await spendTime(2 * day);
                await this.vestingWallet.connect(this.vestingManager).changeVestingManager(this.vestingManager_1.address);

                let beforeexpectAmount = await this.vestingWallet['released(address)'](this.vestingToken.address);
                let beforeBal = await this.vestingToken.balanceOf(this.beneficiary_1.address);
                await this.vestingWallet['release(address)'](this.vestingToken.address);
                let afterBal = await this.vestingToken.balanceOf(this.beneficiary_1.address);
                let afterexpectAmount = await this.vestingWallet['released(address)'](this.vestingToken.address);
                expect(smallNum(afterBal) - smallNum(beforeBal)).to.be.closeTo(smallNum(afterexpectAmount) - smallNum(beforeexpectAmount), 0.1);

                expect (smallNum(await this.vestingWallet['releasableAmount(address)'](this.vestingToken.address))).to.be.equal(0);
            })
        })
        
    })
})