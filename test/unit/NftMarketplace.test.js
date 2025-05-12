const { ethers, ignition } = require("hardhat");
const { expect } = require("chai");

const {
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { supportedTokens } = require("../../configs/contracts/supportedTokens");
const NftMarketplaceModules = require("../../ignition/modules/00-NftMarketplace");

describe("NftMarketplace", () => {
    let NftMarketplace;
    let NftMarketplaceAddress;
    let deployer;
    let clientAccounts;

    let initialEthBalanceMap = new Map();

    const usdcAddress = supportedTokens[0];
    const daiAddress = supportedTokens[1];
    const linkAddress = supportedTokens[2];
    const uniAddress = supportedTokens[3];
    const wBtcAddress = supportedTokens[4];

    async function deployFixture() {
        const { NftMarketplace: NftMarketplaceDeployment } =
            await ignition.deploy(NftMarketplaceModules);
        return { NftMarketplaceDeployment };
    }

    beforeEach(async () => {
        const { NftMarketplaceDeployment } = await loadFixture(deployFixture);
        NftMarketplace = NftMarketplaceDeployment;
        NftMarketplaceAddress = await NftMarketplace.getAddress();
        [deployer, ...clientAccounts] = await ethers.getSigners();
        const deployerInitialEthBalance = await ethers.provider.getBalance(
            deployer.address,
        );
        initialEthBalanceMap.set(deployer.address, deployerInitialEthBalance);
        for (const clientAccount of clientAccounts) {
            const clientInitialEthBalance = await ethers.provider.getBalance(
                clientAccount.address,
            );
            initialEthBalanceMap.set(
                clientAccount.address,
                clientInitialEthBalance,
            );
        }
    });

    describe("Deployment", () => {
        describe("Nft Marketplace", () => {
            it("Should have proper address", async () => {
                expect(NftMarketplaceAddress).to.be.properAddress;
            });

            it("Should have the correct supported payments", async () => {
                const supportedPayments =
                    await NftMarketplace.getSupportedPayments();
                expect(supportedPayments.length).to.be.equals(
                    supportedTokens.length + 1,
                );
                expect(
                    supportedPayments[supportedPayments.length - 1],
                ).to.be.equals("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
                expect(supportedPayments[0]).to.be.equals(usdcAddress);
                expect(supportedPayments[1]).to.be.equals(daiAddress);
                expect(supportedPayments[2]).to.be.equals(linkAddress);
                expect(supportedPayments[3]).to.be.equals(uniAddress);
                expect(supportedPayments[4]).to.be.equals(wBtcAddress);
            });

            it("Should have the correct price feeds", async () => {
                const properUsdcFeed =
                    "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4";
                const properDaiFeed =
                    "0x773616E4d11A78F511299002da57A0a94577F1f4";
                const properLinkFeed =
                    "0xDC530D9457755926550b59e8ECcdaE7624181557";
                const properUniFeed =
                    "0xD6aA3D25116d8dA79Ea0246c4826EB951872e02e";
                const properWbtcFeed =
                    "0xfdFD9C85aD200c506Cf9e21F1FD8dd01932FBB23";

                const usdcFeed = await NftMarketplace.getPriceFeed(usdcAddress);
                const daiFeed = await NftMarketplace.getPriceFeed(daiAddress);
                const linkFeed = await NftMarketplace.getPriceFeed(linkAddress);
                const uniFeed = await NftMarketplace.getPriceFeed(uniAddress);
                const wBtcFeed = await NftMarketplace.getPriceFeed(wBtcAddress);

                expect(usdcFeed).to.be.equals(properUsdcFeed);
                expect(daiFeed).to.be.equals(properDaiFeed);
                expect(linkFeed).to.be.equals(properLinkFeed);
                expect(uniFeed).to.be.equals(properUniFeed);
                expect(wBtcFeed).to.be.equals(properWbtcFeed);
            });
        });
    });
    describe("Initial state", () => {});
    describe("Tool functions", () => {});
    describe("Listing", () => {});
    describe("Buying", () => {});
    describe("Withdrawing", () => {});
});
