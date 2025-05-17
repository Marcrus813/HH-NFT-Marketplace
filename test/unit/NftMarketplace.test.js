const { ethers, ignition } = require("hardhat");
const { expect } = require("chai");

const {
    loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { supportedTokens } = require("../../configs/contracts/supportedTokens");
const NftMarketplaceModules = require("../../ignition/modules/00-NftMarketplace");

const {
    aggregatorV3InterfaceAbi,
} = require("../../utils/blockchain/abis/aggregatorV3Interface");

const {
    supplyToken,
    approveAllowance,
    transferNft,
} = require("../../utils/blockchain/mainnetMock");
const {
    ERC20WhaleAddress,
} = require("../../configs/contracts/erc20WhaleAddress");

const {
    tokenContracts: NFTTokens,
    getTokenInfo,
} = require("../../configs/contracts/nftAddress");

describe("NftMarketplace", () => {
    let NftMarketplace;
    let NftMarketplaceAddress;
    let deployer;
    let clientAccounts;

    let initialEthBalanceMap = new Map();

    const usdcAddress = supportedTokens[0].toLowerCase();
    const daiAddress = supportedTokens[1].toLowerCase();
    const linkAddress = supportedTokens[2].toLowerCase();
    const uniAddress = supportedTokens[3].toLowerCase();
    const wBtcAddress = supportedTokens[4].toLowerCase();
    const wEthAddress =
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2".toLowerCase();
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    const sxtAddress = "0xe6bfd33f52d82ccb5b37e16d3dd81f9ffdabb195";
    const tetherAddress = "0xdac17f958d2ee523a2206206994597c13d831ec7";

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

    describe("Tool functions", () => {
        it("Should be able to check whether payment is supported", async () => {
            const ethCheck =
                await NftMarketplace.checkPaymentSupport(zeroAddress);
            expect(ethCheck).to.be.true;

            const wEthCheck =
                await NftMarketplace.checkPaymentSupport(wEthAddress);
            expect(wEthCheck).to.be.true;

            const usdcCheck =
                await NftMarketplace.checkPaymentSupport(usdcAddress);
            expect(usdcCheck).to.be.true;

            const daiCheck =
                await NftMarketplace.checkPaymentSupport(daiAddress);
            expect(daiCheck).to.be.true;

            const linkCheck =
                await NftMarketplace.checkPaymentSupport(linkAddress);
            expect(linkCheck).to.be.true;

            const uniCheck =
                await NftMarketplace.checkPaymentSupport(uniAddress);
            expect(uniCheck).to.be.true;

            const wBtcCheck =
                await NftMarketplace.checkPaymentSupport(wBtcAddress);
            expect(wBtcCheck).to.be.true;

            const tetherCheck =
                await NftMarketplace.checkPaymentSupport(tetherAddress);
            expect(tetherCheck).to.be.false;

            const sxtCheck =
                await NftMarketplace.checkPaymentSupport(sxtAddress);
            expect(sxtCheck).to.be.false;
        });

        it("Should be able to provide correct supported payments", async () => {
            const supportedPayments =
                await NftMarketplace.getSupportedPayments();
            expect(supportedPayments.length).to.be.equals(
                supportedTokens.length + 1,
            );
            expect(
                supportedPayments[supportedPayments.length - 1].toLowerCase(),
            ).to.be.equals(wEthAddress);
            expect(supportedPayments[0].toLowerCase()).to.be.equals(
                usdcAddress,
            );
            expect(supportedPayments[1].toLowerCase()).to.be.equals(daiAddress);
            expect(supportedPayments[2].toLowerCase()).to.be.equals(
                linkAddress,
            );
            expect(supportedPayments[3].toLowerCase()).to.be.equals(uniAddress);
            expect(supportedPayments[4].toLowerCase()).to.be.equals(
                wBtcAddress,
            );
        });

        it("Should provide the correct price feeds", async () => {
            const properUsdcFeed = "0x986b5E1e1755e3C2440e960477f25201B0a8bbD4";
            const properDaiFeed = "0x773616E4d11A78F511299002da57A0a94577F1f4";
            const properLinkFeed = "0xDC530D9457755926550b59e8ECcdaE7624181557";
            const properUniFeed = "0xD6aA3D25116d8dA79Ea0246c4826EB951872e02e";
            const properWbtcFeed = "0xfdFD9C85aD200c506Cf9e21F1FD8dd01932FBB23";

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

        describe("Token conversion(Tested with visibility as PUBLIC)", () => {
            describe("Convert to ETH", () => {
                it("Should correctly convert USDC to ETH", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(usdcAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer,
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertToEth(
                        usdcAddress,
                        1000000n,
                    );
                    expect(result).to.be.equals(feedAnswer);
                });
                it("Should correctly convert DAI to ETH", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(daiAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer,
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertToEth(
                        daiAddress,
                        BigInt(1e18),
                    );
                    expect(result).to.be.equals(feedAnswer);
                });
                it("Should correctly convert LINK to ETH", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(linkAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer,
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertToEth(
                        linkAddress,
                        BigInt(1e18),
                    );
                    expect(result).to.be.equals(feedAnswer);
                });
                it("Should correctly convert UNI to ETH", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(uniAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer,
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertToEth(
                        uniAddress,
                        BigInt(1e18),
                    );
                    expect(result).to.be.equals(feedAnswer);
                });
                it("Should correctly convert WBTC to ETH", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(wBtcAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer,
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertToEth(
                        wBtcAddress,
                        BigInt(1e8),
                    );
                    expect(result).to.be.equals(
                        feedAnswer * BigInt(1e10) /** 18-8 */,
                    );
                });
            });

            describe("Convert from ETH", () => {
                it("Should correctly convert ETH to USDC", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(usdcAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer,
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertFromEth(
                        usdcAddress,
                        feedAnswer,
                    );
                    expect(result).to.be.equals(BigInt(1e6));
                });
                it("Should correctly convert ETH to DAI", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(daiAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer,
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertFromEth(
                        daiAddress,
                        feedAnswer,
                    );
                    expect(result).to.be.equals(BigInt(1e18));
                });
                it("Should correctly convert ETH to LINK", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(daiAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer,
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertFromEth(
                        daiAddress,
                        feedAnswer,
                    );
                    expect(result).to.be.equals(BigInt(1e18));
                });
                it("Should correctly convert ETH to UNI", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(uniAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer,
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertFromEth(
                        uniAddress,
                        feedAnswer,
                    );
                    expect(result).to.be.equals(BigInt(1e18));
                });
                it("Should correctly convert ETH to WBTC", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(wBtcAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer,
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertFromEth(
                        wBtcAddress,
                        feedAnswer * BigInt(1e10), // 18(ETH decimal) - 8(price feed decimal)
                    );
                    expect(result).to.be.equals(BigInt(1e8));
                });
            });
        });

        describe("Verify payment(Tested with visibility as PUBLIC)", () => {
            let usdcValidAccount;
            let daiValidAccount;
            let linkValidAccount;
            let uniValidAccount;
            let wBtcValidAccount;
            let wEthValidAccount;

            let buyer;
            let value;
            let paymentToken;
            let preferredToken;
            let isStrictPayment;
            let targetPrice;

            async function supplyTokensToAccounts() {
                usdcValidAccount = clientAccounts[0];
                daiValidAccount = clientAccounts[1];
                linkValidAccount = clientAccounts[2];
                uniValidAccount = clientAccounts[3];
                wBtcValidAccount = clientAccounts[4];
                wEthValidAccount = clientAccounts[5];

                await supplyToken(
                    usdcAddress,
                    ERC20WhaleAddress.get(usdcAddress),
                    usdcValidAccount,
                    BigInt(10000e6),
                );
                await supplyToken(
                    daiAddress,
                    ERC20WhaleAddress.get(daiAddress),
                    daiValidAccount,
                    BigInt(10000e18),
                );
                await supplyToken(
                    linkAddress,
                    ERC20WhaleAddress.get(linkAddress),
                    linkValidAccount,
                    BigInt(10000e18),
                );
                await supplyToken(
                    uniAddress,
                    ERC20WhaleAddress.get(uniAddress),
                    uniValidAccount,
                    BigInt(10000e18),
                );
                await supplyToken(
                    wBtcAddress,
                    ERC20WhaleAddress.get(wBtcAddress),
                    wBtcValidAccount,
                    BigInt(100e8),
                );
                await supplyToken(
                    wEthAddress,
                    ERC20WhaleAddress.get(wEthAddress),
                    wEthValidAccount,
                    BigInt(500e18),
                );
            }

            beforeEach(async () => {
                await supplyTokensToAccounts();
            });
            describe("Strict payment", () => {
                beforeEach(() => {
                    isStrictPayment = true;
                });
                describe("Supplying ETH", () => {
                    beforeEach(async () => {
                        await NftMarketplace.connect(deployer);

                        buyer = deployer;
                        paymentToken = zeroAddress;
                        preferredToken = zeroAddress;
                        targetPrice = ethers.parseEther("0.01");
                    });
                    it("Should return false when not enough sent", async () => {
                        value = ethers.parseEther("0.009");
                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );
                        expect(verification).to.be.false;
                    });
                    it("Should return true when enough sent", async () => {
                        value = ethers.parseEther("0.011");
                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );
                        expect(verification).to.be.true;
                    });
                });
                describe("Supplying wETH", () => {
                    beforeEach(() => {
                        value = 0;
                        paymentToken = wEthAddress;
                        preferredToken = paymentToken;
                        targetPrice = BigInt(1e18);
                    });

                    it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                        buyer = wEthValidAccount;

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );
                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice,
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                        buyer = wEthValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice,
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.true;
                    });
                });
                describe("Supplying USDC", () => {
                    beforeEach(() => {
                        value = 0;
                        paymentToken = usdcAddress;
                        preferredToken = paymentToken;
                        targetPrice = BigInt(1e6);
                    });

                    it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                        buyer = usdcValidAccount;

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );
                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice,
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                        buyer = usdcValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice,
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.true;
                    });
                });
                describe("Supplying DAI", () => {
                    beforeEach(() => {
                        value = 0;
                        paymentToken = daiAddress;
                        preferredToken = paymentToken;
                        targetPrice = BigInt(1e18);
                    });

                    it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                        buyer = daiValidAccount;

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice,
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                        buyer = daiValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice,
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.true;
                    });
                });
                describe("Supplying LINK", () => {
                    beforeEach(() => {
                        value = 0;
                        paymentToken = linkAddress;
                        preferredToken = paymentToken;
                        targetPrice = BigInt(1e18);
                    });

                    it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                        buyer = linkValidAccount;

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice,
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                        buyer = linkValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice,
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.true;
                    });
                });
                describe("Supplying UNI", () => {
                    beforeEach(() => {
                        value = 0;
                        paymentToken = uniAddress;
                        preferredToken = paymentToken;
                        targetPrice = BigInt(1e18);
                    });

                    it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                        buyer = uniValidAccount;

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice,
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                        buyer = uniValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice,
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.true;
                    });
                });
                describe("Supplying wBTC", () => {
                    beforeEach(() => {
                        value = 0;
                        paymentToken = wBtcAddress;
                        preferredToken = paymentToken;
                        targetPrice = BigInt(1e8);
                    });

                    it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                        buyer = wEthValidAccount;

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                        buyer = wEthValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice,
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice,
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice,
                        );

                        expect(verification).to.be.true;
                    });
                });
            });
            describe("Non-strict payment", () => {
                beforeEach(() => {
                    isStrictPayment = false;
                });
                describe("Supplying ETH", () => {
                    beforeEach(async () => {
                        await NftMarketplace.connect(deployer);

                        buyer = deployer;
                        paymentToken = zeroAddress;
                    });

                    describe("Preferred ETH", () => {
                        beforeEach(() => {
                            preferredToken = zeroAddress;
                            targetPrice = ethers.parseEther("0.01");
                        });
                        it("Should return false when not enough sent", async () => {
                            value = ethers.parseEther("0.009");

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );
                            expect(verification).to.be.false;
                        });
                        it("Should return true when enough sent", async () => {
                            value = ethers.parseEther("0.011");
                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );
                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred wETH", () => {
                        beforeEach(() => {
                            preferredToken = wEthAddress;
                            targetPrice = ethers.parseEther("0.01");
                        });
                        it("Should return false when not enough sent", async () => {
                            value = ethers.parseEther("0.009");

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );
                            expect(verification).to.be.false;
                        });
                        it("Should return true when enough sent", async () => {
                            value = ethers.parseEther("0.011");
                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );
                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred USDC", () => {
                        beforeEach(async () => {
                            preferredToken = usdcAddress;

                            const priceFeedAddress =
                                await NftMarketplace.getPriceFeed(
                                    preferredToken,
                                );
                            const priceFeed = await ethers.getContractAt(
                                aggregatorV3InterfaceAbi,
                                priceFeedAddress,
                                deployer,
                            );
                            const { answer: feedAnswer } =
                                await priceFeed.latestRoundData();
                            value = feedAnswer;
                            targetPrice = BigInt(1e6); // 1 Token
                        });
                        it("Should return false when not enough sent", async () => {
                            value = value - 1n;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );
                            expect(verification).to.be.false;
                        });
                        it("Should return true when enough sent", async () => {
                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );
                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred DAI", () => {
                        beforeEach(async () => {
                            preferredToken = daiAddress;

                            const priceFeedAddress =
                                await NftMarketplace.getPriceFeed(
                                    preferredToken,
                                );
                            const priceFeed = await ethers.getContractAt(
                                aggregatorV3InterfaceAbi,
                                priceFeedAddress,
                                deployer,
                            );
                            const { answer: feedAnswer } =
                                await priceFeed.latestRoundData();
                            value = feedAnswer;
                            targetPrice = BigInt(1e18); // 1 Token
                        });
                        it("Should return false when not enough sent", async () => {
                            value = value - 1n;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );
                            expect(verification).to.be.false;
                        });
                        it("Should return true when enough sent", async () => {
                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );
                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred LINK", () => {
                        beforeEach(async () => {
                            preferredToken = linkAddress;

                            const priceFeedAddress =
                                await NftMarketplace.getPriceFeed(
                                    preferredToken,
                                );
                            const priceFeed = await ethers.getContractAt(
                                aggregatorV3InterfaceAbi,
                                priceFeedAddress,
                                deployer,
                            );
                            const { answer: feedAnswer } =
                                await priceFeed.latestRoundData();
                            value = feedAnswer;
                            targetPrice = BigInt(1e18); // 1 Token
                        });
                        it("Should return false when not enough sent", async () => {
                            value = value - 1n;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );
                            expect(verification).to.be.false;
                        });
                        it("Should return true when enough sent", async () => {
                            value = targetPrice;
                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );
                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred UNI", () => {
                        beforeEach(async () => {
                            preferredToken = uniAddress;

                            const priceFeedAddress =
                                await NftMarketplace.getPriceFeed(
                                    preferredToken,
                                );
                            const priceFeed = await ethers.getContractAt(
                                aggregatorV3InterfaceAbi,
                                priceFeedAddress,
                                deployer,
                            );
                            const { answer: feedAnswer } =
                                await priceFeed.latestRoundData();
                            value = feedAnswer;
                            targetPrice = BigInt(1e18); // 1 Token
                        });
                        it("Should return false when not enough sent", async () => {
                            value = value - 1n;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );
                            expect(verification).to.be.false;
                        });
                        it("Should return true when enough sent", async () => {
                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );
                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred wBTC", () => {
                        beforeEach(async () => {
                            preferredToken = wBtcAddress;

                            targetPrice = BigInt(1e8); // 1 Token
                            value = await NftMarketplace.convertToEth(
                                wBtcAddress,
                                targetPrice,
                            );
                        });
                        it("Should return false when not enough sent", async () => {
                            value = value - 1n;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );
                            expect(verification).to.be.false;
                        });
                        it("Should return true when enough sent", async () => {
                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );
                            expect(verification).to.be.true;
                        });
                    });
                });
                describe("Supplying wETH", () => {
                    beforeEach(() => {
                        paymentToken = wEthAddress;
                        value = 0;
                    });

                    describe("Preferred ETH", () => {
                        beforeEach(() => {
                            preferredToken = zeroAddress;
                            targetPrice = ethers.parseEther("0.01");
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                targetPrice,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                targetPrice,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred wETH", () => {
                        beforeEach(() => {
                            preferredToken = wEthAddress;
                            targetPrice = ethers.parseEther("0.01");
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                targetPrice,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                targetPrice,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred USDC", () => {
                        let minimalAllowance;
                        beforeEach(async () => {
                            preferredToken = usdcAddress;
                            targetPrice = BigInt(1e6);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred DAI", () => {
                        let minimalAllowance;
                        beforeEach(async () => {
                            preferredToken = daiAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred LINK", () => {
                        let minimalAllowance;
                        beforeEach(async () => {
                            preferredToken = linkAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred UNI", () => {
                        let minimalAllowance;
                        beforeEach(async () => {
                            preferredToken = uniAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred wBTC", () => {
                        let minimalAllowance;
                        beforeEach(async () => {
                            preferredToken = wBtcAddress;
                            targetPrice = BigInt(1e8);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                });
                describe("Supplying USDC", () => {
                    beforeEach(() => {
                        paymentToken = usdcAddress;
                        value = 0;
                    });
                    describe("Preferred ETH", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = zeroAddress;
                            targetPrice = ethers.parseEther("0.01");

                            const expectedEthAmount = targetPrice;
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred wETH", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = wEthAddress;
                            targetPrice = ethers.parseEther("0.01");

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred USDC", () => {
                        let minimalAllowance;
                        beforeEach(async () => {
                            preferredToken = usdcAddress;
                            targetPrice = BigInt(1e6);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred DAI", () => {
                        let minimalAllowance;
                        beforeEach(async () => {
                            preferredToken = daiAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred LINK", () => {
                        let minimalAllowance;
                        beforeEach(async () => {
                            preferredToken = linkAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred UNI", () => {
                        let minimalAllowance;
                        beforeEach(async () => {
                            preferredToken = uniAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred wBTC", () => {
                        let minimalAllowance;
                        beforeEach(async () => {
                            preferredToken = wBtcAddress;
                            targetPrice = BigInt(1e8);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                });
                describe("Supplying DAI", () => {
                    beforeEach(() => {
                        paymentToken = daiAddress;
                        value = 0;
                    });
                    describe("Preferred ETH", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = zeroAddress;
                            targetPrice = ethers.parseEther("0.01");

                            const expectedEthAmount = targetPrice;
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = daiValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = daiValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred wETH", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = wEthAddress;
                            targetPrice = ethers.parseEther("0.01");

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = daiValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = daiValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred USDC", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = usdcAddress;
                            targetPrice = BigInt(1e6);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = daiValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = daiValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred DAI", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = daiAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = daiValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = daiValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred LINK", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = linkAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = daiValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = daiValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred UNI", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = uniAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = daiValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = daiValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred wBTC", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = wBtcAddress;
                            targetPrice = BigInt(1e8);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = daiValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = daiValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                });
                describe("Supplying LINK", () => {
                    beforeEach(() => {
                        paymentToken = linkAddress;
                        value = 0;
                    });
                    describe("Preferred ETH", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = zeroAddress;
                            targetPrice = ethers.parseEther("0.01");

                            const expectedEthAmount = targetPrice;
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = linkValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = linkValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred wETH", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = wEthAddress;
                            targetPrice = ethers.parseEther("0.01");

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = linkValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = linkValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred USDC", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = usdcAddress;
                            targetPrice = BigInt(1e6);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = linkValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = linkValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred DAI", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = daiAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = linkValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = linkValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred LINK", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = linkAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = linkValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = linkValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred UNI", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = uniAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = linkValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = linkValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred wBTC", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = wBtcAddress;
                            targetPrice = BigInt(1e8);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = linkValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = linkValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                });
                describe("Supplying UNI", () => {
                    beforeEach(() => {
                        paymentToken = uniAddress;
                        value = 0;
                    });
                    describe("Preferred ETH", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = zeroAddress;
                            targetPrice = ethers.parseEther("0.01");

                            const expectedEthAmount = targetPrice;
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = uniValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = uniValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred wETH", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = wEthAddress;
                            targetPrice = ethers.parseEther("0.01");

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = uniValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = uniValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred USDC", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = usdcAddress;
                            targetPrice = BigInt(1e6);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = uniValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = uniValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred DAI", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = daiAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = uniValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = uniValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred LINK", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = linkAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = uniValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = uniValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred UNI", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = uniAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = uniValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = uniValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred wBTC", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = wBtcAddress;
                            targetPrice = BigInt(1e8);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = uniValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = uniValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                });
                describe("Supplying wBTC", () => {
                    beforeEach(() => {
                        paymentToken = wBtcAddress;
                        value = 0;
                    });
                    describe("Preferred ETH", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = zeroAddress;
                            targetPrice = ethers.parseEther("0.01");

                            const expectedEthAmount = targetPrice;
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred wETH", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = wEthAddress;
                            targetPrice = ethers.parseEther("0.01");

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );
                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred USDC", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = usdcAddress;
                            targetPrice = BigInt(1e6);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred DAI", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = daiAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred LINK", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = linkAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred UNI", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = uniAddress;
                            targetPrice = BigInt(1e18);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred wBTC", () => {
                        let minimalAllowance;

                        beforeEach(async () => {
                            preferredToken = wBtcAddress;
                            targetPrice = BigInt(1e8);

                            const expectedEthAmount =
                                await NftMarketplace.convertToEth(
                                    preferredToken,
                                    targetPrice,
                                );

                            minimalAllowance =
                                await NftMarketplace.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount,
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance,
                            );

                            const verification =
                                await NftMarketplace.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice,
                                );

                            expect(verification).to.be.true;
                        });
                    });
                });
            });
        });
    });

    describe("Deployment", () => {
        describe("Nft Marketplace", () => {
            it("Should have proper address", async () => {
                expect(NftMarketplaceAddress).to.be.properAddress;
            });
        });
    });
    describe("Initial state", () => {
        describe("Storage variables", () => {
            it("Should have correct `s_supportedPayments`", async () => {
                const supportedPayments =
                    await NftMarketplace.getSupportedPayments();
                expect(supportedPayments.length).to.be.equals(
                    supportedTokens.length + 1,
                );
                expect(
                    supportedPayments[
                        supportedPayments.length - 1
                    ].toLowerCase(),
                ).to.be.equals(wEthAddress);
                expect(supportedPayments[0].toLowerCase()).to.be.equals(
                    usdcAddress,
                );
                expect(supportedPayments[1].toLowerCase()).to.be.equals(
                    daiAddress,
                );
                expect(supportedPayments[2].toLowerCase()).to.be.equals(
                    linkAddress,
                );
                expect(supportedPayments[3].toLowerCase()).to.be.equals(
                    uniAddress,
                );
                expect(supportedPayments[4].toLowerCase()).to.be.equals(
                    wBtcAddress,
                );
            });
            it("Should provide the correct price feeds", async () => {
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
            it("Should have empty `s_listingMap`", async () => {
                const randomWallet = ethers.Wallet.createRandom();
                const randomAddress = randomWallet.address;

                const randomId = Math.floor(Math.random());
                await expect(
                    NftMarketplace.getListingInfo(randomAddress, randomId),
                ).to.be.revertedWithCustomError(
                    NftMarketplace,
                    "NftMarketplace__TokenNotListed",
                );
            });
            it("Should have empty `s_activeListings`", async () => {
                const activeListings =
                    await NftMarketplace.getActiveListingKeys();

                expect(activeListings.length).to.be.equals(0);
            });
            it("Should have empty `s_listingPaddedIndex`", async () => {
                const randomWallet = ethers.Wallet.createRandom();

                const randomAddress = randomWallet.address;
                const randomId = Math.floor(Math.random());

                const paddedIndex = await NftMarketplace.getListingPaddedIndex(
                    randomAddress,
                    randomId,
                );
                expect(paddedIndex).to.be.equals(0);
            });
            it("Should have empty `s_proceeds`", async () => {
                const randomWallet0 = ethers.Wallet.createRandom();
                const randomAddress0 = randomWallet0.address;

                const randomWallet1 = ethers.Wallet.createRandom();
                const randomAddress1 = randomWallet1.address;

                const proceeds = await NftMarketplace.getSupplierProceeds(
                    randomAddress0,
                    randomAddress1,
                );
                expect(proceeds).to.be.equals(0);
            });
        });
    });

    describe("Listing", () => {
        let doodlesTokens, boredApeYachtClubTokens, lilPudgysTokens;

        let doodleAddress;
        let boredApeYachtClubAddress;
        let lilPudgysAddress;

        let doodleHolder;
        let boredApeYachtClubHolder;
        let lilPudgysHolder;

        beforeEach(async () => {
            doodleAddress = NFTTokens[0].address;
            boredApeYachtClubAddress = NFTTokens[1].address;
            lilPudgysAddress = NFTTokens[2].address;

            doodleHolder = clientAccounts[0];
            boredApeYachtClubHolder = clientAccounts[1];
            lilPudgysHolder = clientAccounts[2];

            const tokenInfo = await getTokenInfo();
            doodlesTokens = tokenInfo.doodlesTokens;
            boredApeYachtClubTokens = tokenInfo.boredApeYachtClubTokens;
            lilPudgysTokens = tokenInfo.lilPudgysTokens;

            // Transfer all doodles to local holder
            for (let index = 0; index < doodlesTokens.length; index++) {
                const token = doodlesTokens[index];
                const tokenId = token.id;
                const tokenOwner = token.owner;

                await transferNft(
                    doodleAddress,
                    tokenOwner,
                    doodleHolder,
                    tokenId,
                );
            }

            // Transfer all BAYC to local holder
            for (
                let index = 0;
                index < boredApeYachtClubTokens.length;
                index++
            ) {
                const token = boredApeYachtClubTokens[index];
                const tokenId = token.id;
                const tokenOwner = token.owner;

                await transferNft(
                    boredApeYachtClubAddress,
                    tokenOwner,
                    boredApeYachtClubHolder,
                    tokenId,
                );
            }

            // Transfer all LilPudgys to local holder
            for (let index = 0; index < lilPudgysTokens.length; index++) {
                const token = lilPudgysTokens[index];
                const tokenId = token.id;
                const tokenOwner = token.owner;

                await transferNft(
                    lilPudgysAddress,
                    tokenOwner,
                    lilPudgysHolder,
                    tokenId,
                );
            }
        });
        it("Should revert when listing with not supported tokens", async () => {
            const tokenAddress = NFTTokens[0].address;
            const token = doodlesTokens[0];
            const tokenId = token.id;

            const tokenOwner = doodleHolder;

            const preferredPayment = tetherAddress;
            const price = ethers.parseEther("0.05");
            const isStrictPayment = true;

            await expect(
                NftMarketplace.connect(tokenOwner).listNft(
                    tokenAddress,
                    tokenId,
                    preferredPayment,
                    price,
                    isStrictPayment,
                ),
            ).to.be.revertedWithCustomError(
                NftMarketplace,
                "NftMarketplace__PaymentNotSupported",
            );
        });
    });
    describe("Buying", () => {});
    describe("Withdrawing", () => {});
});
