const { ethers } = require("hardhat");

const { ERC20Abi } = require("./abis/erc20");

const supplyToken = async (
    tokenAddress,
    ownerAddress,
    targetAddress,
    amount,
) => {
    const impersonatedSigner = await ethers.getImpersonatedSigner(ownerAddress);
    const token = await ethers.getContractAt(
        ERC20Abi,
        tokenAddress,
        impersonatedSigner,
    );

    const transferTxn = await token.transfer(targetAddress, amount);
    await transferTxn.wait();
};

module.exports = { supplyToken };
