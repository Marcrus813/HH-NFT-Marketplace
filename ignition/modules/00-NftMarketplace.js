const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const { ethers } = require("hardhat");
const { supportedTokens } = require("../../configs/contracts/supportedTokens");

// Won't be doing default local network, will be using fork

module.exports = buildModule("NftMarketplaceModule", (m) => {
    const NftMarketplace = m.contract("NftMarketplace", [supportedTokens], {
        value: ethers.parseUnits("0.01", 18)
    });

    return { NftMarketplace };
});
