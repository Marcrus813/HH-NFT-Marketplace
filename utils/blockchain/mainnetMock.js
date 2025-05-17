const { ethers } = require("hardhat");

const { ERC20Abi } = require("./abis/erc20");
const { ERC721Abi } = require("./abis/erc721");

async function supplyGas(targetAddress) {
    const targetEthBalance = await ethers.provider.getBalance(targetAddress);
    if (targetEthBalance < ethers.parseEther("10")) {
        const [funder] = await ethers.getSigners();
        await funder.sendTransaction({
            to: targetAddress,
            value: ethers.parseEther("10"),
        });
    }
}

const supplyToken = async (
    tokenAddress,
    ownerAddress,
    targetAddress,
    amount,
) => {
    // Supply ETH to owner for gas fee
    await supplyGas(ownerAddress);

    const impersonatedSigner = await ethers.getImpersonatedSigner(ownerAddress);
    const token = await ethers.getContractAt(
        ERC20Abi,
        tokenAddress,
        impersonatedSigner,
    );

    const transferTxn = await token.transfer(targetAddress, amount);
    await transferTxn.wait();
};

const approveAllowance = async (
    tokenAddress,
    ownerAddress,
    targetAddress,
    amount,
) => {
    await supplyGas(ownerAddress);

    const impersonatedSigner = await ethers.getImpersonatedSigner(ownerAddress);
    const token = await ethers.getContractAt(
        ERC20Abi,
        tokenAddress,
        impersonatedSigner,
    );

    const approveTxn = await token.approve(targetAddress, amount);
    await approveTxn.wait();
};

const getErc20Balance = async (tokenAddress, ownerAddress, targetAddress) => {
    await supplyGas(ownerAddress);

    const impersonatedSigner = await ethers.getImpersonatedSigner(ownerAddress);
    const token = await ethers.getContractAt(
        ERC20Abi,
        tokenAddress,
        impersonatedSigner,
    );

    return await token.balanceOf(targetAddress);
};

const getErc20Allowance = async (tokenAddress, ownerAddress, targetAddress) => {
    await supplyGas(ownerAddress);

    const impersonatedSigner = await ethers.getImpersonatedSigner(ownerAddress);
    const token = await ethers.getContractAt(
        ERC20Abi,
        tokenAddress,
        impersonatedSigner,
    );

    return await token.allowance(ownerAddress, targetAddress);
};

const transferNft = async (tokenAddress, fromAddress, toAddress, tokenId) => {
    await supplyGas(fromAddress);

    const impersonatedSigner = await ethers.getImpersonatedSigner(fromAddress);

    const token = await ethers.getContractAt(
        ERC721Abi,
        tokenAddress,
        impersonatedSigner,
    );

    const transferTxn = await token.transferFrom(
        impersonatedSigner,
        toAddress,
        tokenId,
    );
    await transferTxn.wait();
};

module.exports = {
    supplyToken,
    approveAllowance,
    getErc20Balance,
    getErc20Allowance,
    transferNft,
};
