const { ethers } = require("hardhat");

const { ERC20Abi } = require("./abis/erc20");
const { ERC721Abi } = require("./abis/erc721");

const initializeNftHolders = async () => {
    let doodleHolder, boredApeYachtClubHolder, lilPudgysHolder;

    const doodleHolderAddress = "0xC6426dcd6804A4519d366389d48ecC05370bD76a";
    const boredApeYachtClubHolderAddress =
        "0x3E71DAda87b34a5c9309C80752b5b43Bc04b7Dd9";
    const lilPudgysHolderAddress = "0x82B5eD97d8A5A3497b75D2304368276AfEC672b6";

    doodleHolder = await ethers.getImpersonatedSigner(doodleHolderAddress);
    boredApeYachtClubHolder = await ethers.getImpersonatedSigner(
        boredApeYachtClubHolderAddress
    );
    lilPudgysHolder = await ethers.getImpersonatedSigner(
        lilPudgysHolderAddress
    );

    await supplyGas(doodleHolderAddress);
    await supplyGas(boredApeYachtClubHolderAddress);
    await supplyGas(lilPudgysHolderAddress);

    return { doodleHolder, boredApeYachtClubHolder, lilPudgysHolder };
};

async function supplyGas(targetAddress) {
    const targetEthBalance = await ethers.provider.getBalance(targetAddress);
    if (targetEthBalance < ethers.parseEther("10")) {
        const [funder] = await ethers.getSigners();
        await funder.sendTransaction({
            to: targetAddress,
            value: ethers.parseEther("10")
        });
    }
}

const supplyToken = async (
    tokenAddress,
    ownerAddress,
    targetAddress,
    amount
) => {
    // Supply ETH to owner for gas fee
    await supplyGas(ownerAddress);

    const impersonatedSigner = await ethers.getImpersonatedSigner(ownerAddress);
    const token = await ethers.getContractAt(
        ERC20Abi,
        tokenAddress,
        impersonatedSigner
    );

    const transferTxn = await token.transfer(targetAddress, amount);
    await transferTxn.wait();
};

const approveAllowance = async (
    tokenAddress,
    ownerAddress,
    targetAddress,
    amount
) => {
    await supplyGas(ownerAddress);

    const impersonatedSigner = await ethers.getImpersonatedSigner(ownerAddress);
    const token = await ethers.getContractAt(
        ERC20Abi,
        tokenAddress,
        impersonatedSigner
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
        impersonatedSigner
    );

    return await token.balanceOf(targetAddress);
};

const getErc20Allowance = async (tokenAddress, ownerAddress, targetAddress) => {
    await supplyGas(ownerAddress);

    const impersonatedSigner = await ethers.getImpersonatedSigner(ownerAddress);
    const token = await ethers.getContractAt(
        ERC20Abi,
        tokenAddress,
        impersonatedSigner
    );

    return await token.allowance(ownerAddress, targetAddress);
};

const getNftOwner = async (tokenAddress, tokenId, queryAddress) => {
    await supplyGas(queryAddress);

    const impersonatedSigner = await ethers.getImpersonatedSigner(queryAddress);

    const token = await ethers.getContractAt(
        ERC721Abi,
        tokenAddress,
        impersonatedSigner
    );

    return await token.ownerOf(tokenId);
};

const transferNft = async (tokenAddress, fromAddress, toAddress, tokenId) => {
    await supplyGas(fromAddress);

    const impersonatedSigner = await ethers.getImpersonatedSigner(fromAddress);

    const token = await ethers.getContractAt(
        ERC721Abi,
        tokenAddress,
        impersonatedSigner
    );

    const transferTxn = await token.transferFrom(
        impersonatedSigner,
        toAddress,
        tokenId
    );
    await transferTxn.wait();
};

const approveNft = async (tokenAddress, fromAddress, toAddress, tokenId) => {
    await supplyGas(fromAddress);

    const impersonatedSigner = await ethers.getImpersonatedSigner(fromAddress);
    const token = await ethers.getContractAt(
        ERC721Abi,
        tokenAddress,
        impersonatedSigner
    );
    const approveTxn = await token.approve(toAddress, tokenId);
    await approveTxn.wait();
};

module.exports = {
    initializeNftHolders,
    supplyGas,
    supplyToken,
    approveAllowance,
    getErc20Balance,
    getErc20Allowance,
    getNftOwner,
    transferNft,
    approveNft
};
