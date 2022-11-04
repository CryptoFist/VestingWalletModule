const { ethers, upgrades, network } = require("hardhat")
const { getImplementationAddress } = require('@openzeppelin/upgrades-core');
const fs = require('fs')

const updateAddress = async (contractName, contractAddreses) => {
    if (network.name == 'localhost' || network.name == 'hardhat') return
    const addressDir = `${__dirname}/../deploy_address/${network.name}`;
    if (!fs.existsSync(addressDir)) {
        fs.mkdirSync(addressDir);
    }

    let data = '';
    if (contractAddreses.length == 2) {
        data = {
            proxy: contractAddreses[0],
            contract: contractAddreses[1]
        };
    } else {
        data = {
            contract: contractAddreses[0]
        };
    }

    fs.writeFileSync(
        `${addressDir}/${contractName}.txt`,
        JSON.stringify(data, null, 2)
    )
}

const getContractAddress = async (contractName, network_name) => {
    const addressDir = `${__dirname}/../deploy_address/${network_name}`;
    if (!fs.existsSync(addressDir)) {
        return '';
    }

    let data = fs.readFileSync(`${addressDir}/${contractName}.txt`);
    data = JSON.parse(data, null, 2);

    return data;
}

const deploy = async (contractName, ...args) => {
    const factory = await ethers.getContractFactory(contractName)
    const contract = await factory.deploy(...args)
    await contract.deployed()
    console.log(contractName, contract.address)
    await updateAddress(contractName, [contract.address])
    return contract
}

const getTimestmp = async () => {
    return (await ethers.provider.getBlock("latest")).timestamp;
}

const spendTime = async (spendSeconds) => {
    await network.provider.send("evm_increaseTime", [spendSeconds]);
    await network.provider.send("evm_mine");
}

const deployProxy = async (contractName, args = []) => {
    const factory = await ethers.getContractFactory(contractName)
    const contract = await upgrades.deployProxy(factory, args)
    await contract.deployed()
    const implAddress = await getImplementationAddress(ethers.provider, contract.address);
    await updateAddress(contractName, [contract.address, implAddress]);
    console.log(contractName, contract.address, implAddress)
    return contract
}

const upgradeProxy = async (contractName, contractAddress) => {
    const factory = await ethers.getContractFactory(contractName)
    const contract = await upgrades.upgradeProxy(contractAddress, factory)
    await contract.deployed()
    const implAddress = await getImplementationAddress(ethers.provider, contract.address);
    console.log(contractName, contract.address, implAddress)
    return contract
}

const getAt = async (contractName, contractAddress) => {
    return await ethers.getContractAt(contractName, contractAddress)
}

const getETHBalance = async (walletAddress) => {
    return await ethers.provider.getBalance(walletAddress);
}

module.exports = {
    getAt, deploy, deployProxy, upgradeProxy, getContractAddress, getTimestmp, spendTime, getETHBalance
}