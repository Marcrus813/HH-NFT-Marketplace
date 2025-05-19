const { ethers } = require("hardhat");

const { ERC721Abi } = require("../../utils/blockchain/abis/erc721");

const tokenContracts = [
    {
        name: "Doodles",
        address: "0x8a90CAb2b38dba80c64b7734e58Ee1dB38B8992e",
    },
    {
        name: "BoredApeYachtClub",
        address: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D",
    },
    {
        name: "LilPudgys",
        address: "0x524cAB2ec69124574082676e6F654a18df49A048",
    },
];

async function isContract(address) {
    const code = await ethers.provider.getCode(address);
    return code !== "0x";
}

async function findNftOwnedByWallets(nftAddress, expectedCount, queryLimit) {
    const [queryAccount] = await ethers.getSigners();

    const token = await ethers.getContractAt(
        ERC721Abi,
        nftAddress,
        queryAccount,
    );

    let result = [];
    for (let id = 1; id < queryLimit; id++) {
        let owner;
        try {
            owner = await token.ownerOf(id);
        } catch (e) {
            continue;
        }

        const isOwnerContract = await isContract(owner);
        if (!isOwnerContract) {
            result.push({
                id: id,
                owner: owner,
            });
        }
        if (result.length >= expectedCount) {
            break;
        }
    }

    return result;
}

const getTokenInfo = async () => {
    let doodlesTokens, boredApeYachtClubTokens, lilPudgysTokens;

    doodlesTokens = await findNftOwnedByWallets(
        tokenContracts[0].address,
        10,
        1000,
    );
    boredApeYachtClubTokens = await findNftOwnedByWallets(
        tokenContracts[1].address,
        10,
        1000,
    );
    lilPudgysTokens = await findNftOwnedByWallets(
        tokenContracts[2].address,
        10,
        1000,
    );

    return { doodlesTokens, boredApeYachtClubTokens, lilPudgysTokens };
};

module.exports = { tokenContracts, getTokenInfo };
