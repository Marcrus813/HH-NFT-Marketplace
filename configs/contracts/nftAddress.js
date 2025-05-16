const { ethers } = require("hardhat");
const { getErc721Owner } = require("../../utils/blockchain/mainnetMock");

const tokenContracts = [
    {
        name: "Doodles",
        address: "0x8a90CAb2b38dba80c64b7734e58Ee1dB38B8992e".toLowerCase(),
    },
    {
        name: "BoredApeYachtClub",
        address: "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D".toLowerCase(),
    },
    {
        name: "LilPudgys",
        address: "0x524cAB2ec69124574082676e6F654a18df49A048".toLowerCase(),
    },
];

const _doodlesTokens = [
    {
        id: 5561,
        owner: "",
    },
    {
        id: 8315,
        owner: "",
    },
    {
        id: 1211,
        owner: "",
    },
    {
        id: 5856,
        owner: "",
    },
    {
        id: 9690,
        owner: "",
    },
    {
        id: 2526,
        owner: "",
    },
    {
        id: 2402,
        owner: "",
    },
    {
        id: 4740,
        owner: "",
    },
    {
        id: 7761,
        owner: "",
    },
    {
        id: 319,
        owner: "",
    },
];

const _boredApeYachtClubTokens = [
    {
        id: 4434,
        owner: "",
    },
    {
        id: 5326,
        owner: "",
    },
    {
        id: 1302,
        owner: "",
    },
    {
        id: 6895,
        owner: "",
    },
    {
        id: 2920,
        owner: "",
    },
    {
        id: 2918,
        owner: "",
    },
    {
        id: 2218,
        owner: "",
    },
    {
        id: 917,
        owner: "",
    },
    {
        id: 4650,
        owner: "",
    },
    {
        id: 4513,
        owner: "",
    },
];

const _lilPudgysTokens = [
    {
        id: 1033,
        owner: "",
    },
    {
        id: 593,
        owner: "",
    },
    {
        id: 11633,
        owner: "",
    },
    {
        id: 10945,
        owner: "",
    },
    {
        id: 8710,
        owner: "",
    },
    {
        id: 18116,
        owner: "",
    },
    {
        id: 14867,
        owner: "",
    },
    {
        id: 5814,
        owner: "",
    },
    {
        id: 7113,
        owner: "",
    },
    {
        id: 13391,
        owner: "",
    },
];

const getTokenInfo = async () => {
    const [queryAccount] = await ethers.getSigners();
    let tokenContractInstance;

    // Doodles
    const doodlesAddress = tokenContracts[0].address;
    let doodlesTokens = [];
    for (let index = 0; index < _doodlesTokens.length; index++) {
        let token = _doodlesTokens[index];
        const id = token.id;
        const owner = await getErc721Owner(doodlesAddress, id);
        token.owner = owner.toLowerCase();
        doodlesTokens.push(token);
    }

    // BoredApeYachtClub
    const boredApeYachtClubAddress = tokenContracts[1].address;
    let boredApeYachtClubTokens = [];
    for (let index = 0; index < _boredApeYachtClubTokens.length; index++) {
        let token = _boredApeYachtClubTokens[index];
        const id = token.id;
        const owner = await getErc721Owner(boredApeYachtClubAddress, id);
        token.owner = owner.toLowerCase();
        boredApeYachtClubTokens.push(token);
    }

    // LilPudgy
    const lilPudgysAddress = tokenContracts[2].address;
    let lilPudgysTokens = [];
    for (let index = 0; index < _lilPudgysTokens.length; index++) {
        let token = _lilPudgysTokens[index];
        const id = token.id;
        const owner = await getErc721Owner(lilPudgysAddress, id);
        token.owner = owner.toLowerCase();
        lilPudgysTokens.push(token);
    }

    return { doodlesTokens, boredApeYachtClubTokens, lilPudgysTokens };
};

module.exports = { tokenContracts, getTokenInfo };
