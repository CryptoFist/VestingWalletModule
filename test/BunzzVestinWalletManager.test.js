const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deploy, getTimestmp, spendTime, getETHBalance } = require('../scripts/utils');
const { constants } = require('@openzeppelin/test-helpers');
const { abi } = require('../artifacts/contracts/BunzzVestingWallet.sol/BunzzVestingWallet.json');

const bigNum = num => (num + '0'.repeat(18));
const smallNum = num => (parseInt(num) / bigNum(1));
const hour = 60 * 60;
const day = 24 * hour;

describe ("Test BunzzVetingWalletManager", function () {
    before (async function () {
        [
            this.deployer,
            this.vester_1,
            this.vester_2,
            this.vester_3,
            this.beneficiary_1,
            this.beneficiary_2,
            this.beneficiary_3
        ] = await ethers.getSigners();

        this.vestingManager = await deploy("BunzzVestingManager");
        this.vestingToken = await deploy(
            "ERC20Mock",
            "VestingToken",
            "VT"
        );
    })

    it ("check deployment", async function () {
        console.log("deployed successfully!");
    })

    describe ("Vesting with ETH", async function () {
        it("reverts deposit if there is no vesting wallets", async function () {
            await expect(
                this.vestingManager.depositAndProvideETH({ value: bigNum(10) })
            ).to.be.revertedWith("no vesting wallets to divide");
        })

        it("add Vesting for vester_1", async function () {
            await expect(
                this.vestingManager.connect(this.vester_1).addNewVesting(
                    this.vester_1.address,
                    this.beneficiary_1.address,
                    hour * 3
                )
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await expect(
                this.vestingManager.addNewVesting(
                    this.vester_1.address,
                    this.beneficiary_1.address,
                    hour * 10
                )
            ).to.be.emit(this.vestingManager, "StartNewVesting")
                .withArgs(this.vester_1.address);

            await expect(
                this.vestingManager.addNewVesting(
                    this.vester_1.address,
                    this.beneficiary_1.address,
                    hour * 10
                )
            ).to.be.revertedWith("Already started");
        })

        it("deposit ETH to vesting wallets", async function () {
            let vestingWallet = await this.vestingManager.getVestingWallet(this.vester_1.address)
            let depositAmount = bigNum(300);
            let beforeBal = await getETHBalance(vestingWallet);
            await this.vestingManager.depositAndProvideETH(
                { value: BigInt(depositAmount) }
            );
            let afterBal = await getETHBalance(vestingWallet);
            expect(smallNum(afterBal) - smallNum(beforeBal)).to.be.equal(smallNum(depositAmount));

            beforeBal = await getETHBalance(vestingWallet);
            depositAmount = bigNum(100);
            await expect(
                this.vestingManager['depositToVestingWallets(address[])'](
                    [],
                    { value: BigInt(depositAmount) }
                )
            ).to.be.revertedWith("invalid user list");

            await this.vestingManager['depositToVestingWallets(address[])'](
                [
                    this.vester_1.address
                ],
                { value: BigInt(depositAmount) }
            );
            afterBal = await getETHBalance(vestingWallet);
            expect(smallNum(afterBal) - smallNum(beforeBal)).to.be.equal(smallNum(depositAmount));
        })

        it("cancel vesting", async function () {
            await expect(
                this.vestingManager.connect(this.vester_1).cancelVesting(this.vester_1.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await spendTime(3 * hour);
            let beforeVesterBal = await getETHBalance(this.beneficiary_1.address);
            let beforeManagerBal = await getETHBalance(this.vestingManager.address);
            await this.vestingManager.cancelVesting(this.vester_1.address);
            let afterVesterBal = await getETHBalance(this.beneficiary_1.address);
            let afterManagerBal = await getETHBalance(this.vestingManager.address);


            let vestingWallet = await this.vestingManager.getVestingWallet(this.vester_1.address);
            let depositAmount = bigNum(400);
            vestingWallet = new ethers.Contract(vestingWallet, abi, this.deployer);

            let beneficiaryAmount = BigInt(afterVesterBal) - BigInt(beforeVesterBal)

            expect(smallNum(beneficiaryAmount)).to.be.closeTo(smallNum(await vestingWallet['released()']()), 0.1);
            expect(smallNum(afterManagerBal) - smallNum(beforeManagerBal)).to.be.closeTo(smallNum(depositAmount) - smallNum(beneficiaryAmount), 0.1);
        })

        it("reverts cancel vesting if vesting is already closed", async function () {
            await expect(
                this.vestingManager.cancelVesting(this.vester_1.address)
            ).to.be.revertedWith("vesting is not started");
        })

        it("reverts change beneficiary if vesting is closed", async function () {
            await expect(
                this.vestingManager.connect(this.vester_1).changeBeneficiary(this.beneficiary_1.address)
            ).to.be.revertedWith("vesting is not started");
        })

        it("withdraw ETH", async function () {
            let expectAmount = await getETHBalance(this.vestingManager.address);
            await expect(
                this.vestingManager.connect(this.beneficiary_1).withdrawETH()
            ).to.be.revertedWith("Ownable: caller is not the owner");

            let beforeBal = await getETHBalance(this.deployer.address);
            await this.vestingManager.withdrawETH();
            let afterBal = await getETHBalance(this.deployer.address);

            expect(smallNum(afterBal) - smallNum(beforeBal)).to.be.closeTo(smallNum(expectAmount), 0.1);
        })
    })

    describe("Vesting with ERC20 Vesting Token", async function () {
        it("add Vesting for vester_1 and vester_2", async function () {
            await this.vestingManager.addNewVesting(
                this.vester_1.address,
                this.beneficiary_1.address,
                hour * 10
            );

            await this.vestingManager.addNewVesting(
                this.vester_2.address,
                this.beneficiary_2.address,
                hour * 10
            );
        })

        it("deposit ERC20 to vesting wallets", async function () {
            let vestingWallet_1 = await this.vestingManager.getVestingWallet(this.vester_1.address);
            let vestingWallet_2 = await this.vestingManager.getVestingWallet(this.vester_2.address);
            let depositAmount = bigNum(300);
            let beforeBal_1 = await this.vestingToken.balanceOf(vestingWallet_1);
            let beforeBal_2 = await this.vestingToken.balanceOf(vestingWallet_2);
            await this.vestingToken.approve(this.vestingManager.address, BigInt(depositAmount));
            await this.vestingManager.depositAndProvideERC20(
                this.vestingToken.address,
                BigInt(depositAmount)
            );
            let afterBal_1 = await this.vestingToken.balanceOf(vestingWallet_1);
            let afterBal_2 = await this.vestingToken.balanceOf(vestingWallet_2);
            expect(smallNum(afterBal_1) - smallNum(beforeBal_1)).to.be.closeTo(smallNum(BigInt(depositAmount) / BigInt(2)), 0.1);
            expect(smallNum(afterBal_2) - smallNum(beforeBal_2)).to.be.closeTo(smallNum(BigInt(depositAmount) / BigInt(2)), 0.1);

            beforeBal_1 = await this.vestingToken.balanceOf(vestingWallet_1);
            beforeBal_2 = await this.vestingToken.balanceOf(vestingWallet_2);
            depositAmount = bigNum(100);

            await this.vestingToken.approve(this.vestingManager.address, BigInt(depositAmount));
            await this.vestingManager['depositToVestingWallets(address,address[],uint256)'](
                this.vestingToken.address,
                [
                    this.vester_1.address,
                    this.vester_2.address
                ],
                BigInt(depositAmount)
            );
            afterBal_1 = await this.vestingToken.balanceOf(vestingWallet_1);
            afterBal_2 = await this.vestingToken.balanceOf(vestingWallet_2);
            expect(smallNum(afterBal_1) - smallNum(beforeBal_1)).to.be.closeTo(smallNum(BigInt(depositAmount) / BigInt(2)), 0.1);
            expect(smallNum(afterBal_2) - smallNum(beforeBal_2)).to.be.closeTo(smallNum(BigInt(depositAmount) / BigInt(2)), 0.1);
        })

        it("cancel vesting", async function () {
            await this.vestingManager.connect(this.vester_1).changeBeneficiary(this.beneficiary_3.address);
            await spendTime(3 * hour);
            let beforeVesterBal = await this.vestingToken.balanceOf(this.beneficiary_3.address);
            let beforeManagerBal = await this.vestingToken.balanceOf(this.vestingManager.address);
            await this.vestingManager.cancelVesting(this.vester_1.address);
            let afterVesterBal = await this.vestingToken.balanceOf(this.beneficiary_3.address);
            let afterManagerBal = await this.vestingToken.balanceOf(this.vestingManager.address);


            let vestingWallet = await this.vestingManager.getVestingWallet(this.vester_1.address);
            let depositAmount = bigNum(200);
            vestingWallet = new ethers.Contract(vestingWallet, abi, this.deployer);

            let beneficiaryAmount = BigInt(afterVesterBal) - BigInt(beforeVesterBal)

            expect(smallNum(beneficiaryAmount)).to.be.closeTo(smallNum(await vestingWallet['released(address)'](this.vestingToken.address)), 0.1);
            expect(smallNum(afterManagerBal) - smallNum(beforeManagerBal)).to.be.closeTo(smallNum(depositAmount) - smallNum(beneficiaryAmount), 0.1);
        })

        it("withdraw ERC20", async function () {
            let expectAmount = await this.vestingToken.balanceOf(this.vestingManager.address);

            let beforeBal = await this.vestingToken.balanceOf(this.deployer.address);
            await this.vestingManager.withdrawERC20(this.vestingToken.address)
            let afterBal = await this.vestingToken.balanceOf(this.deployer.address);

            expect(smallNum(afterBal) - smallNum(beforeBal)).to.be.closeTo(smallNum(expectAmount), 0.1);
        })
    })
    
})