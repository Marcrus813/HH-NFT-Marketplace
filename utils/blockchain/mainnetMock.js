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

    const balance = await token.balanceOf(targetAddress);
    return balance;
};

const getErc20Allowance = async (tokenAddress, ownerAddress, targetAddress) => {
    await supplyGas(ownerAddress);

    const impersonatedSigner = await ethers.getImpersonatedSigner(ownerAddress);
    const token = await ethers.getContractAt(
        ERC20Abi,
        tokenAddress,
        impersonatedSigner,
    );

    const allowance = await token.allowance(ownerAddress, targetAddress);
    return allowance;
};

const getErc721Owner = async (tokenAddress, tokenId) => {
    const [queryAccount] = await ethers.getSigners();

    const token = await ethers.getContractAt(
        ERC721Abi,
        tokenAddress,
        queryAccount,
    );

    const owner = await token.ownerOf(tokenId);
    return owner;
};

const transferNft = async (token, from, to, id) => {
    await supplyGas(from);

    const token = await ethers.getContractAt(ERC721Abi, tokenAddress, from);

    const transferTxn = await token.safeTransferFrom(from, to, id);
    await transferTxn.wait();
};

module.exports = {
    supplyToken,
    approveAllowance,
    getErc20Balance,
    getErc20Allowance,
    getErc721Owner,
    transferNft
};
