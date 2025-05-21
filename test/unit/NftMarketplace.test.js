const { ethers, ignition } = require("hardhat");
const { expect } = require("chai");

const {
    loadFixture
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { supportedTokens } = require("../../configs/contracts/supportedTokens");
const NftMarketplaceModules = require("../../ignition/modules/00-NftMarketplace");

const {
    aggregatorV3InterfaceAbi
} = require("../../utils/blockchain/abis/aggregatorV3Interface");

const {
    supplyToken,
    approveAllowance,
    transferNft,
    approveNft
} = require("../../utils/blockchain/mainnetMock");
const {
    ERC20WhaleAddress
} = require("../../configs/contracts/erc20WhaleAddress");

const {
    tokenContracts: NFTTokens,
    getTokenInfo
} = require("../../configs/contracts/nftAddress");

describe("NftMarketplace", () => {
    let NftMarketplace;
    let NftMarketplaceByDeployer;
    let NftMarketplaceAddress;
    let deployer;
    let clientAccounts;

    let initialEthBalanceMap = new Map();

    const usdcAddress = supportedTokens[0];
    const daiAddress = supportedTokens[1];
    const linkAddress = supportedTokens[2];
    const uniAddress = supportedTokens[3];
    const wBtcAddress = supportedTokens[4];
    const wEthAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    const sxtAddress = "0xE6Bfd33F52d82Ccb5b37E16D3dD81f9FFDAbB195";
    const tetherAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

    let usdcValidAccount;
    let daiValidAccount;
    let linkValidAccount;
    let uniValidAccount;
    let wBtcValidAccount;
    let wEthValidAccount;

    async function deployFixture() {
        const { NftMarketplace: NftMarketplaceDeployment } =
            await ignition.deploy(NftMarketplaceModules);
        return { NftMarketplaceDeployment };
    }

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
            BigInt(10000e6)
        );
        await supplyToken(
            daiAddress,
            ERC20WhaleAddress.get(daiAddress),
            daiValidAccount,
            BigInt(10000e18)
        );
        await supplyToken(
            linkAddress,
            ERC20WhaleAddress.get(linkAddress),
            linkValidAccount,
            BigInt(10000e18)
        );
        await supplyToken(
            uniAddress,
            ERC20WhaleAddress.get(uniAddress),
            uniValidAccount,
            BigInt(10000e18)
        );
        await supplyToken(
            wBtcAddress,
            ERC20WhaleAddress.get(wBtcAddress),
            wBtcValidAccount,
            BigInt(100e8)
        );
        await supplyToken(
            wEthAddress,
            ERC20WhaleAddress.get(wEthAddress),
            wEthValidAccount,
            BigInt(500e18)
        );
    }

    beforeEach(async () => {
        const { NftMarketplaceDeployment } = await loadFixture(deployFixture);
        NftMarketplace = NftMarketplaceDeployment;
        NftMarketplaceByDeployer = await NftMarketplace.connect(deployer);
        NftMarketplaceAddress = await NftMarketplace.getAddress();
        [deployer, ...clientAccounts] = await ethers.getSigners();
        const deployerInitialEthBalance = await ethers.provider.getBalance(
            deployer.address
        );
        initialEthBalanceMap.set(deployer.address, deployerInitialEthBalance);
        for (const clientAccount of clientAccounts) {
            const clientInitialEthBalance = await ethers.provider.getBalance(
                clientAccount.address
            );
            initialEthBalanceMap.set(
                clientAccount.address,
                clientInitialEthBalance
            );
        }

        await supplyTokensToAccounts();
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
                supportedTokens.length + 1
            );
            expect(
                supportedPayments[supportedPayments.length - 1]
            ).to.be.equals(wEthAddress);
            expect(supportedPayments[0]).to.be.equals(usdcAddress);
            expect(supportedPayments[1]).to.be.equals(daiAddress);
            expect(supportedPayments[2]).to.be.equals(linkAddress);
            expect(supportedPayments[3]).to.be.equals(uniAddress);
            expect(supportedPayments[4]).to.be.equals(wBtcAddress);
        });

        it("Should revert when requesting not-listed token", async () => {
            await expect(
                NftMarketplaceByDeployer.getListingInfo(NFTTokens[0].address, 1)
            )
                .to.be.revertedWithCustomError(
                    NftMarketplaceByDeployer,
                    "NftMarketplace__TokenNotListed"
                )
                .withArgs(NFTTokens[0].address, 1);
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
                it("Should revert if requested not supported tokens", async () => {
                    await expect(
                        NftMarketplace.convertToEth(tetherAddress, BigInt(1e6))
                    )
                        .to.be.revertedWithCustomError(
                            NftMarketplace,
                            "NftMarketplace__PaymentNotSupported"
                        )
                        .withArgs(tetherAddress);
                });
                it("Should correctly convert USDC to ETH", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(usdcAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertToEth(
                        usdcAddress,
                        1000000n
                    );
                    expect(result).to.be.equals(feedAnswer);
                });
                it("Should correctly convert DAI to ETH", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(daiAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertToEth(
                        daiAddress,
                        BigInt(1e18)
                    );
                    expect(result).to.be.equals(feedAnswer);
                });
                it("Should correctly convert LINK to ETH", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(linkAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertToEth(
                        linkAddress,
                        BigInt(1e18)
                    );
                    expect(result).to.be.equals(feedAnswer);
                });
                it("Should correctly convert UNI to ETH", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(uniAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertToEth(
                        uniAddress,
                        BigInt(1e18)
                    );
                    expect(result).to.be.equals(feedAnswer);
                });
                it("Should correctly convert WBTC to ETH", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(wBtcAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertToEth(
                        wBtcAddress,
                        BigInt(1e8)
                    );
                    expect(result).to.be.equals(
                        feedAnswer * BigInt(1e10) /** 18-8 */
                    );
                });
            });

            describe("Convert from ETH", () => {
                it("Should revert if requested not supported tokens", async () => {
                    await expect(
                        NftMarketplace.convertFromEth(
                            tetherAddress,
                            BigInt(1e6)
                        )
                    )
                        .to.be.revertedWithCustomError(
                            NftMarketplace,
                            "NftMarketplace__PaymentNotSupported"
                        )
                        .withArgs(tetherAddress);
                });
                it("Should correctly convert ETH to USDC", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(usdcAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertFromEth(
                        usdcAddress,
                        feedAnswer
                    );
                    expect(result).to.be.equals(BigInt(1e6));
                });
                it("Should correctly convert ETH to DAI", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(daiAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertFromEth(
                        daiAddress,
                        feedAnswer
                    );
                    expect(result).to.be.equals(BigInt(1e18));
                });
                it("Should correctly convert ETH to LINK", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(daiAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertFromEth(
                        daiAddress,
                        feedAnswer
                    );
                    expect(result).to.be.equals(BigInt(1e18));
                });
                it("Should correctly convert ETH to UNI", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(uniAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertFromEth(
                        uniAddress,
                        feedAnswer
                    );
                    expect(result).to.be.equals(BigInt(1e18));
                });
                it("Should correctly convert ETH to WBTC", async () => {
                    const feedAddress =
                        await NftMarketplace.getPriceFeed(wBtcAddress);
                    const priceFeed = await ethers.getContractAt(
                        aggregatorV3InterfaceAbi,
                        feedAddress,
                        deployer
                    );
                    const { answer: feedAnswer } =
                        await priceFeed.latestRoundData();

                    const result = await NftMarketplace.convertFromEth(
                        wBtcAddress,
                        feedAnswer * BigInt(1e10) // 18(ETH decimal) - 8(price feed decimal)
                    );
                    expect(result).to.be.equals(BigInt(1e8));
                });
            });
        });

        describe("Verify payment(Tested with visibility as PUBLIC)", () => {
            let buyer;
            let value;
            let paymentToken;
            let preferredToken;
            let isStrictPayment;
            let targetPrice;
            describe("Strict payment", () => {
                beforeEach(() => {
                    isStrictPayment = true;
                });
                describe("Supplying ETH", () => {
                    beforeEach(async () => {
                        buyer = deployer;
                        paymentToken = zeroAddress;
                        preferredToken = zeroAddress;
                        targetPrice = ethers.parseEther("0.01");
                    });
                    it("Should return false when not enough sent", async () => {
                        value = ethers.parseEther("0.009");
                        const verification =
                            await NftMarketplaceByDeployer.verifyPayment(
                                buyer,
                                value,
                                isStrictPayment,
                                paymentToken,
                                preferredToken,
                                targetPrice
                            );
                        expect(verification).to.be.false;
                    });
                    it("Should return true when enough sent", async () => {
                        value = ethers.parseEther("0.011");
                        const verification =
                            await NftMarketplaceByDeployer.verifyPayment(
                                buyer,
                                value,
                                isStrictPayment,
                                paymentToken,
                                preferredToken,
                                targetPrice
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

                        const verification =
                            await NftMarketplaceByDeployer.verifyPayment(
                                buyer,
                                value,
                                isStrictPayment,
                                paymentToken,
                                preferredToken,
                                targetPrice
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
                            targetPrice
                        );
                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                        buyer = wEthValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice
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
                            targetPrice
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
                            targetPrice
                        );
                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                        buyer = usdcValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice
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
                            targetPrice
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
                            targetPrice
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                        buyer = daiValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice
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
                            targetPrice
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
                            targetPrice
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                        buyer = linkValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice
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
                            targetPrice
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
                            targetPrice
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                        buyer = uniValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice
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
                            targetPrice
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
                            targetPrice
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                        buyer = wEthValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice
                        );

                        expect(verification).to.be.false;
                    });
                    it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                        buyer = wBtcValidAccount;

                        await approveAllowance(
                            paymentToken,
                            buyer.address,
                            NftMarketplaceAddress,
                            targetPrice
                        );

                        const verification = await NftMarketplace.verifyPayment(
                            buyer,
                            value,
                            isStrictPayment,
                            paymentToken,
                            preferredToken,
                            targetPrice
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
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );
                            expect(verification).to.be.false;
                        });
                        it("Should return true when enough sent", async () => {
                            value = ethers.parseEther("0.011");
                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );
                            expect(verification).to.be.false;
                        });
                        it("Should return true when enough sent", async () => {
                            value = ethers.parseEther("0.011");
                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );
                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred USDC", () => {
                        beforeEach(async () => {
                            preferredToken = usdcAddress;

                            const priceFeedAddress =
                                await NftMarketplaceByDeployer.getPriceFeed(
                                    preferredToken
                                );
                            const priceFeed = await ethers.getContractAt(
                                aggregatorV3InterfaceAbi,
                                priceFeedAddress,
                                deployer
                            );
                            const { answer: feedAnswer } =
                                await priceFeed.latestRoundData();
                            value = feedAnswer;
                            targetPrice = BigInt(1e6); // 1 Token
                        });
                        it("Should return false when not enough sent", async () => {
                            value = value - 1n;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );
                            expect(verification).to.be.false;
                        });
                        it("Should return true when enough sent", async () => {
                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );
                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred DAI", () => {
                        beforeEach(async () => {
                            preferredToken = daiAddress;

                            const priceFeedAddress =
                                await NftMarketplaceByDeployer.getPriceFeed(
                                    preferredToken
                                );
                            const priceFeed = await ethers.getContractAt(
                                aggregatorV3InterfaceAbi,
                                priceFeedAddress,
                                deployer
                            );
                            const { answer: feedAnswer } =
                                await priceFeed.latestRoundData();
                            value = feedAnswer;
                            targetPrice = BigInt(1e18); // 1 Token
                        });
                        it("Should return false when not enough sent", async () => {
                            value = value - 1n;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );
                            expect(verification).to.be.false;
                        });
                        it("Should return true when enough sent", async () => {
                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );
                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred LINK", () => {
                        beforeEach(async () => {
                            preferredToken = linkAddress;

                            const priceFeedAddress =
                                await NftMarketplaceByDeployer.getPriceFeed(
                                    preferredToken
                                );
                            const priceFeed = await ethers.getContractAt(
                                aggregatorV3InterfaceAbi,
                                priceFeedAddress,
                                deployer
                            );
                            const { answer: feedAnswer } =
                                await priceFeed.latestRoundData();
                            value = feedAnswer;
                            targetPrice = BigInt(1e18); // 1 Token
                        });
                        it("Should return false when not enough sent", async () => {
                            value = value - 1n;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );
                            expect(verification).to.be.false;
                        });
                        it("Should return true when enough sent", async () => {
                            value = targetPrice;
                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );
                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred UNI", () => {
                        beforeEach(async () => {
                            preferredToken = uniAddress;

                            const priceFeedAddress =
                                await NftMarketplaceByDeployer.getPriceFeed(
                                    preferredToken
                                );
                            const priceFeed = await ethers.getContractAt(
                                aggregatorV3InterfaceAbi,
                                priceFeedAddress,
                                deployer
                            );
                            const { answer: feedAnswer } =
                                await priceFeed.latestRoundData();
                            value = feedAnswer;
                            targetPrice = BigInt(1e18); // 1 Token
                        });
                        it("Should return false when not enough sent", async () => {
                            value = value - 1n;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );
                            expect(verification).to.be.false;
                        });
                        it("Should return true when enough sent", async () => {
                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );
                            expect(verification).to.be.true;
                        });
                    });
                    describe("Preferred wBTC", () => {
                        beforeEach(async () => {
                            preferredToken = wBtcAddress;

                            targetPrice = BigInt(1e8); // 1 Token
                            value = await NftMarketplaceByDeployer.convertToEth(
                                wBtcAddress,
                                targetPrice
                            );
                        });
                        it("Should return false when not enough sent", async () => {
                            value = value - 1n;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );
                            expect(verification).to.be.false;
                        });
                        it("Should return true when enough sent", async () => {
                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                targetPrice
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                targetPrice
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                targetPrice
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                targetPrice
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );
                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );
                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );
                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );
                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );
                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );
                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );
                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );
                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );
                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );
                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = usdcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = daiValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = daiValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );
                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = daiValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = daiValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = daiValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = daiValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = daiValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = daiValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = daiValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = daiValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = daiValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = daiValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = daiValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = daiValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = linkValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = linkValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );
                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = linkValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = linkValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = linkValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = linkValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = linkValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = linkValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = linkValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = linkValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = linkValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = linkValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = linkValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = linkValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = uniValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = uniValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );
                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = uniValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = uniValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = uniValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = uniValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = uniValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = uniValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = uniValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = uniValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = uniValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = uniValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = uniValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = uniValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );
                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                                await NftMarketplaceByDeployer.convertToEth(
                                    preferredToken,
                                    targetPrice
                                );

                            minimalAllowance =
                                await NftMarketplaceByDeployer.convertFromEth(
                                    paymentToken,
                                    expectedEthAmount
                                );
                        });
                        it("Should return false when buyer has insufficient balance & market has insufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has sufficient balance & market has insufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return false when buyer has insufficient balance & market has sufficient allowance", async () => {
                            buyer = wEthValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
                                );

                            expect(verification).to.be.false;
                        });
                        it("Should return true when buyer has sufficient balance and Market has sufficient allowance", async () => {
                            buyer = wBtcValidAccount;

                            await approveAllowance(
                                paymentToken,
                                buyer.address,
                                NftMarketplaceAddress,
                                minimalAllowance
                            );

                            const verification =
                                await NftMarketplaceByDeployer.verifyPayment(
                                    buyer,
                                    value,
                                    isStrictPayment,
                                    paymentToken,
                                    preferredToken,
                                    targetPrice
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
                    await NftMarketplaceByDeployer.getSupportedPayments();
                expect(supportedPayments.length).to.be.equals(
                    supportedTokens.length + 1
                );
                expect(
                    supportedPayments[supportedPayments.length - 1]
                ).to.be.equals(wEthAddress);
                expect(supportedPayments[0]).to.be.equals(usdcAddress);
                expect(supportedPayments[1]).to.be.equals(daiAddress);
                expect(supportedPayments[2]).to.be.equals(linkAddress);
                expect(supportedPayments[3]).to.be.equals(uniAddress);
                expect(supportedPayments[4]).to.be.equals(wBtcAddress);
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

                const usdcFeed =
                    await NftMarketplaceByDeployer.getPriceFeed(usdcAddress);
                const daiFeed =
                    await NftMarketplaceByDeployer.getPriceFeed(daiAddress);
                const linkFeed =
                    await NftMarketplaceByDeployer.getPriceFeed(linkAddress);
                const uniFeed =
                    await NftMarketplaceByDeployer.getPriceFeed(uniAddress);
                const wBtcFeed =
                    await NftMarketplaceByDeployer.getPriceFeed(wBtcAddress);

                const wEthFeed =
                    await NftMarketplaceByDeployer.getPriceFeed(wEthAddress);

                expect(usdcFeed).to.be.equals(properUsdcFeed);
                expect(daiFeed).to.be.equals(properDaiFeed);
                expect(linkFeed).to.be.equals(properLinkFeed);
                expect(uniFeed).to.be.equals(properUniFeed);
                expect(wBtcFeed).to.be.equals(properWbtcFeed);

                expect(wEthFeed).to.be.equals(zeroAddress);
            });
            it("Should have empty `s_listingMap`", async () => {
                const randomWallet = ethers.Wallet.createRandom();
                const randomAddress = randomWallet.address;

                const randomId = Math.floor(Math.random());
                await expect(
                    NftMarketplaceByDeployer.getListingInfo(
                        randomAddress,
                        randomId
                    )
                )
                    .to.be.revertedWithCustomError(
                        NftMarketplaceByDeployer,
                        "NftMarketplace__TokenNotListed"
                    )
                    .withArgs(randomAddress, randomId);
            });
            it("Should have empty `s_activeListings`", async () => {
                const activeListings =
                    await NftMarketplaceByDeployer.getActiveListingKeys();

                expect(activeListings.length).to.be.equals(0);
            });
            it("Should have empty `s_listingPaddedIndex`", async () => {
                const randomWallet = ethers.Wallet.createRandom();

                const randomAddress = randomWallet.address;
                const randomId = Math.floor(Math.random());

                const paddedIndex =
                    await NftMarketplaceByDeployer.getListingPaddedIndex(
                        randomAddress,
                        randomId
                    );
                expect(paddedIndex).to.be.equals(0);
            });
            it("Should have empty `s_proceeds`", async () => {
                const randomWallet0 = ethers.Wallet.createRandom();
                const randomAddress0 = randomWallet0.address;

                const randomWallet1 = ethers.Wallet.createRandom();
                const randomAddress1 = randomWallet1.address;

                const proceeds =
                    await NftMarketplaceByDeployer.getSupplierProceeds(
                        randomAddress0,
                        randomAddress1
                    );
                expect(proceeds).to.be.equals(0);
            });
        });
    });

    describe("Functional behavior", () => {
        function getNftMarketplaceInstanceByTokenHolder(_tokenAddress) {
            let NftMarketplaceInstance;
            switch (_tokenAddress) {
                case doodleAddress:
                    NftMarketplaceInstance = NftMarketplaceByDoodleHolder;
                    break;
                case boredApeYachtClubAddress:
                    NftMarketplaceInstance = NftMarketplaceByBaycHolder;
                    break;
                case lilPudgysAddress:
                    NftMarketplaceInstance = NftMarketplaceByLilPudgysHolder;
                    break;
            }

            return NftMarketplaceInstance;
        }

        async function listNft(
            _tokenAddress,
            _tokenId,
            _preferredPayment,
            _price,
            _isStrictPayment
        ) {
            const NftMarketplaceInstance =
                getNftMarketplaceInstanceByTokenHolder(_tokenAddress);

            const listTxn = await NftMarketplaceInstance.listNft(
                _tokenAddress,
                _tokenId,
                _preferredPayment,
                _price,
                _isStrictPayment
            );

            await listTxn.wait();
        }

        async function cancelListing(_tokenAddress, _tokenId) {
            const NftMarketplaceInstance =
                getNftMarketplaceInstanceByTokenHolder(_tokenAddress);

            const cancelTxn = await NftMarketplaceInstance.cancelListing(
                _tokenAddress,
                _tokenId
            );

            await cancelTxn.wait();
        }

        async function updateListing(
            _tokenAddress,
            _tokenId,
            _preferredPayment,
            _price,
            _isStrictPayment
        ) {
            const NftMarketplaceInstance =
                getNftMarketplaceInstanceByTokenHolder(_tokenAddress);

            const updateTxn = await NftMarketplaceInstance.updateListing(
                _tokenAddress,
                _tokenId,
                _preferredPayment,
                _price,
                _isStrictPayment
            );

            await updateTxn.wait();
        }

        let doodlesTokens, boredApeYachtClubTokens, lilPudgysTokens;

        let doodleAddress;
        let boredApeYachtClubAddress;
        let lilPudgysAddress;

        let doodleHolder;
        let boredApeYachtClubHolder;
        let lilPudgysHolder;

        let NftMarketplaceByDoodleHolder;
        let NftMarketplaceByBaycHolder;
        let NftMarketplaceByLilPudgysHolder;

        beforeEach(async () => {
            doodleAddress = NFTTokens[0].address;
            boredApeYachtClubAddress = NFTTokens[1].address;
            lilPudgysAddress = NFTTokens[2].address;

            doodleHolder = clientAccounts[0];
            boredApeYachtClubHolder = clientAccounts[1];
            lilPudgysHolder = clientAccounts[2];

            NftMarketplaceByDoodleHolder =
                await NftMarketplace.connect(doodleHolder);
            NftMarketplaceByBaycHolder = await NftMarketplace.connect(
                boredApeYachtClubHolder
            );
            NftMarketplaceByLilPudgysHolder =
                await NftMarketplace.connect(lilPudgysHolder);

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
                    tokenId
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
                    tokenId
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
                    tokenId
                );
            }
        });
        describe("Listing operations", () => {
            describe("Listing", () => {
                describe("Precautions", () => {
                    it("Should revert when listing with not supported tokens", async () => {
                        const tokenAddress = doodleAddress;
                        const token = doodlesTokens[0];
                        const tokenId = token.id;

                        const preferredPayment = tetherAddress;
                        const price = ethers.parseEther("0.05");
                        const isStrictPayment = true;

                        await expect(
                            NftMarketplaceByDoodleHolder.listNft(
                                tokenAddress,
                                tokenId,
                                preferredPayment,
                                price,
                                isStrictPayment
                            )
                        )
                            .to.be.revertedWithCustomError(
                                NftMarketplace,
                                "NftMarketplace__PaymentNotSupported"
                            )
                            .withArgs(tetherAddress);
                    });

                    it("Should revert if listing with price of zero", async () => {
                        const tokenAddress = doodleAddress;
                        const token = doodlesTokens[0];
                        const tokenId = token.id;
                        const preferredPayment = zeroAddress;
                        const price = 0;
                        const isStrictPayment = true;

                        await expect(
                            NftMarketplaceByDoodleHolder.listNft(
                                tokenAddress,
                                tokenId,
                                preferredPayment,
                                price,
                                isStrictPayment
                            )
                        ).to.be.revertedWithCustomError(
                            NftMarketplace,
                            "NftMarketplace__PriceIsZero"
                        );
                    });

                    it("Should revert if listing an already listed token", async () => {
                        const tokenAddress = doodleAddress;
                        const token = doodlesTokens[0];
                        const tokenId = token.id;

                        const tokenOwner = doodleHolder;
                        const preferredPayment = zeroAddress;
                        const price = ethers.parseEther("1");
                        const isStrictPayment = true;

                        await approveNft(
                            tokenAddress,
                            tokenOwner.address,
                            NftMarketplaceAddress,
                            tokenId
                        );

                        const initialListTxn =
                            await NftMarketplaceByDoodleHolder.listNft(
                                tokenAddress,
                                tokenId,
                                preferredPayment,
                                price,
                                isStrictPayment
                            );
                        await initialListTxn.wait();

                        await expect(
                            NftMarketplaceByDoodleHolder.listNft(
                                tokenAddress,
                                tokenId,
                                preferredPayment,
                                price,
                                isStrictPayment
                            )
                        )
                            .to.be.revertedWithCustomError(
                                NftMarketplace,
                                "NftMarketplace__AlreadyListed"
                            )
                            .withArgs(tokenAddress, tokenId);
                    });
                    it("Should revert if not being listed by token owner", async () => {
                        const tokenAddress = doodleAddress;
                        const token = doodlesTokens[0];
                        const tokenId = token.id;

                        const tokenOwner = doodleHolder;

                        const preferredPayment = zeroAddress;
                        const price = ethers.parseEther("1");
                        const isStrictPayment = true;

                        await approveNft(
                            tokenAddress,
                            tokenOwner.address,
                            NftMarketplaceAddress,
                            tokenId
                        );

                        await expect(
                            NftMarketplaceByBaycHolder.listNft(
                                tokenAddress,
                                tokenId,
                                preferredPayment,
                                price,
                                isStrictPayment
                            )
                        )
                            .to.be.revertedWithCustomError(
                                NftMarketplace,
                                "NftMarketplace__NotOperatedByOwner"
                            )
                            .withArgs(
                                tokenAddress,
                                tokenId,
                                boredApeYachtClubHolder.address
                            );
                    });
                    it("Should revert if marketplace is not approved for the token", async () => {
                        const tokenAddress = doodleAddress;
                        const token = doodlesTokens[0];
                        const tokenId = token.id;

                        const preferredPayment = zeroAddress;
                        const price = ethers.parseEther("1");
                        const isStrictPayment = true;

                        await expect(
                            NftMarketplaceByDoodleHolder.listNft(
                                tokenAddress,
                                tokenId,
                                preferredPayment,
                                price,
                                isStrictPayment
                            )
                        )
                            .to.be.revertedWithCustomError(
                                NftMarketplace,
                                "NftMarketplace__NotApprovedForMarketplace"
                            )
                            .withArgs(tokenAddress, tokenId);
                    });
                });
                describe("Updating storage", () => {
                    let presetDoodlesTokenAddress,
                        presetDoodlesToken,
                        presetDoodlesTokenId,
                        presetDoodlesTokenOwner,
                        presetDoodlesPreferredPayment,
                        presetDoodlesPrice,
                        presetDoodlesIsStrictPayment;

                    beforeEach(async () => {
                        presetDoodlesTokenAddress = doodleAddress;
                        presetDoodlesToken = doodlesTokens[0];
                        presetDoodlesTokenId = presetDoodlesToken.id;
                        presetDoodlesTokenOwner = doodleHolder;
                        presetDoodlesPreferredPayment = zeroAddress;
                        presetDoodlesPrice = ethers.parseEther("1");
                        presetDoodlesIsStrictPayment = true;

                        await approveNft(
                            presetDoodlesTokenAddress,
                            presetDoodlesTokenOwner.address,
                            NftMarketplaceAddress,
                            presetDoodlesTokenId
                        );
                    });
                    describe("Listing with different preferred payment", () => {
                        describe("ETH", () => {
                            it("Should update `s_listingMap`", async () => {
                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const updatedListing =
                                    await NftMarketplaceByDoodleHolder.getListingInfo(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );

                                const listedPayment =
                                    updatedListing.preferredPayment;
                                const listedPrice = updatedListing.price;
                                const listedStrictPayment =
                                    updatedListing.strictPayment;
                                const listedSeller = updatedListing.seller;

                                expect(listedPayment).to.be.equals(
                                    presetDoodlesPreferredPayment
                                );
                                expect(listedPrice).to.be.equals(
                                    ethers.parseEther("1")
                                );
                                expect(listedStrictPayment).to.be.true;
                                expect(listedSeller).to.be.equals(
                                    doodleHolder.address
                                );
                            });
                            it("Should update `s_activeListings`", async () => {
                                const activeListingsBefore =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingLengthBefore =
                                    activeListingsBefore.length;

                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const activeListingsAfter =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingLengthAfter =
                                    activeListingsAfter.length;
                                const latestActiveListingKey =
                                    activeListingsAfter[
                                        activeListingLengthAfter - 1
                                    ];

                                const listingKeyAddress =
                                    latestActiveListingKey.nftAddress;
                                const listingKeyId =
                                    latestActiveListingKey.tokenId;

                                expect(activeListingLengthAfter).to.be.equals(
                                    activeListingLengthBefore + 1
                                );
                                expect(listingKeyAddress).to.be.equals(
                                    presetDoodlesTokenAddress
                                );
                                expect(listingKeyId).to.be.equals(
                                    presetDoodlesTokenId
                                );
                            });
                            it("Should update `s_listingPaddedIndex`", async () => {
                                const listingPaddedIndexBefore =
                                    await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );
                                expect(listingPaddedIndexBefore).to.be.equals(
                                    0
                                );

                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const activeListings =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingsCount =
                                    activeListings.length;
                                const latestListingPaddedIndex =
                                    await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );
                                expect(latestListingPaddedIndex).to.be.equals(
                                    activeListingsCount
                                );
                            });
                            it("Should emit `TokenListed` event", async () => {
                                await expect(
                                    NftMarketplaceByDoodleHolder.listNft(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId,
                                        presetDoodlesPreferredPayment,
                                        presetDoodlesPrice,
                                        presetDoodlesIsStrictPayment
                                    )
                                )
                                    .to.emit(
                                        NftMarketplaceByDoodleHolder,
                                        "TokenListed"
                                    )
                                    .withArgs(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId,
                                        doodleHolder.address,
                                        presetDoodlesPreferredPayment,
                                        presetDoodlesPrice,
                                        presetDoodlesIsStrictPayment
                                    );
                            });
                        });

                        describe("wETH", () => {
                            beforeEach(() => {
                                presetDoodlesPreferredPayment = wEthAddress;
                            });
                            it("Should update `s_listingMap`", async () => {
                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const updatedListing =
                                    await NftMarketplaceByDoodleHolder.getListingInfo(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );

                                const listedPayment =
                                    updatedListing.preferredPayment;
                                const listedPrice = updatedListing.price;
                                const listedStrictPayment =
                                    updatedListing.strictPayment;
                                const listedSeller = updatedListing.seller;

                                expect(listedPayment).to.be.equals(
                                    presetDoodlesPreferredPayment
                                );
                                expect(listedPrice).to.be.equals(
                                    ethers.parseEther("1")
                                );
                                expect(listedStrictPayment).to.be.true;
                                expect(listedSeller).to.be.equals(
                                    doodleHolder.address
                                );
                            });
                            it("Should update `s_activeListings`", async () => {
                                const activeListingsBefore =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingLengthBefore =
                                    activeListingsBefore.length;

                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const activeListingsAfter =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingLengthAfter =
                                    activeListingsAfter.length;
                                const latestActiveListingKey =
                                    activeListingsAfter[
                                        activeListingLengthAfter - 1
                                    ];

                                const listingKeyAddress =
                                    latestActiveListingKey.nftAddress;
                                const listingKeyId =
                                    latestActiveListingKey.tokenId;

                                expect(activeListingLengthAfter).to.be.equals(
                                    activeListingLengthBefore + 1
                                );
                                expect(listingKeyAddress).to.be.equals(
                                    presetDoodlesTokenAddress
                                );
                                expect(listingKeyId).to.be.equals(
                                    presetDoodlesTokenId
                                );
                            });
                            it("Should update `s_listingPaddedIndex`", async () => {
                                const listingPaddedIndexBefore =
                                    await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );
                                expect(listingPaddedIndexBefore).to.be.equals(
                                    0
                                );

                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const activeListings =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingsCount =
                                    activeListings.length;
                                const latestListingPaddedIndex =
                                    await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );
                                expect(latestListingPaddedIndex).to.be.equals(
                                    activeListingsCount
                                );
                            });
                            it("Should emit `TokenListed` event", async () => {
                                await expect(
                                    NftMarketplaceByDoodleHolder.listNft(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId,
                                        presetDoodlesPreferredPayment,
                                        presetDoodlesPrice,
                                        presetDoodlesIsStrictPayment
                                    )
                                )
                                    .to.emit(
                                        NftMarketplaceByDoodleHolder,
                                        "TokenListed"
                                    )
                                    .withArgs(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId,
                                        doodleHolder.address,
                                        presetDoodlesPreferredPayment,
                                        presetDoodlesPrice,
                                        presetDoodlesIsStrictPayment
                                    );
                            });
                        });
                        describe("USDC", () => {
                            beforeEach(() => {
                                presetDoodlesPreferredPayment = usdcAddress;
                            });
                            it("Should update `s_listingMap`", async () => {
                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const updatedListing =
                                    await NftMarketplaceByDoodleHolder.getListingInfo(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );

                                const listedPayment =
                                    updatedListing.preferredPayment;
                                const listedPrice = updatedListing.price;
                                const listedStrictPayment =
                                    updatedListing.strictPayment;
                                const listedSeller = updatedListing.seller;

                                expect(listedPayment).to.be.equals(
                                    presetDoodlesPreferredPayment
                                );
                                expect(listedPrice).to.be.equals(
                                    ethers.parseEther("1")
                                );
                                expect(listedStrictPayment).to.be.true;
                                expect(listedSeller).to.be.equals(
                                    doodleHolder.address
                                );
                            });
                            it("Should update `s_activeListings`", async () => {
                                const activeListingsBefore =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingLengthBefore =
                                    activeListingsBefore.length;

                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const activeListingsAfter =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingLengthAfter =
                                    activeListingsAfter.length;
                                const latestActiveListingKey =
                                    activeListingsAfter[
                                        activeListingLengthAfter - 1
                                    ];

                                const listingKeyAddress =
                                    latestActiveListingKey.nftAddress;
                                const listingKeyId =
                                    latestActiveListingKey.tokenId;

                                expect(activeListingLengthAfter).to.be.equals(
                                    activeListingLengthBefore + 1
                                );
                                expect(listingKeyAddress).to.be.equals(
                                    presetDoodlesTokenAddress
                                );
                                expect(listingKeyId).to.be.equals(
                                    presetDoodlesTokenId
                                );
                            });
                            it("Should update `s_listingPaddedIndex`", async () => {
                                const listingPaddedIndexBefore =
                                    await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );
                                expect(listingPaddedIndexBefore).to.be.equals(
                                    0
                                );

                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const activeListings =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingsCount =
                                    activeListings.length;
                                const latestListingPaddedIndex =
                                    await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );
                                expect(latestListingPaddedIndex).to.be.equals(
                                    activeListingsCount
                                );
                            });
                            it("Should emit `TokenListed` event", async () => {
                                await expect(
                                    NftMarketplaceByDoodleHolder.listNft(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId,
                                        presetDoodlesPreferredPayment,
                                        presetDoodlesPrice,
                                        presetDoodlesIsStrictPayment
                                    )
                                )
                                    .to.emit(
                                        NftMarketplaceByDoodleHolder,
                                        "TokenListed"
                                    )
                                    .withArgs(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId,
                                        doodleHolder.address,
                                        presetDoodlesPreferredPayment,
                                        presetDoodlesPrice,
                                        presetDoodlesIsStrictPayment
                                    );
                            });
                        });
                        describe("DAI", () => {
                            beforeEach(() => {
                                presetDoodlesPreferredPayment = daiAddress;
                            });
                            it("Should update `s_listingMap`", async () => {
                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const updatedListing =
                                    await NftMarketplaceByDoodleHolder.getListingInfo(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );

                                const listedPayment =
                                    updatedListing.preferredPayment;
                                const listedPrice = updatedListing.price;
                                const listedStrictPayment =
                                    updatedListing.strictPayment;
                                const listedSeller = updatedListing.seller;

                                expect(listedPayment).to.be.equals(
                                    presetDoodlesPreferredPayment
                                );
                                expect(listedPrice).to.be.equals(
                                    ethers.parseEther("1")
                                );
                                expect(listedStrictPayment).to.be.true;
                                expect(listedSeller).to.be.equals(
                                    doodleHolder.address
                                );
                            });
                            it("Should update `s_activeListings`", async () => {
                                const activeListingsBefore =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingLengthBefore =
                                    activeListingsBefore.length;

                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const activeListingsAfter =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingLengthAfter =
                                    activeListingsAfter.length;
                                const latestActiveListingKey =
                                    activeListingsAfter[
                                        activeListingLengthAfter - 1
                                    ];

                                const listingKeyAddress =
                                    latestActiveListingKey.nftAddress;
                                const listingKeyId =
                                    latestActiveListingKey.tokenId;

                                expect(activeListingLengthAfter).to.be.equals(
                                    activeListingLengthBefore + 1
                                );
                                expect(listingKeyAddress).to.be.equals(
                                    presetDoodlesTokenAddress
                                );
                                expect(listingKeyId).to.be.equals(
                                    presetDoodlesTokenId
                                );
                            });
                            it("Should update `s_listingPaddedIndex`", async () => {
                                const listingPaddedIndexBefore =
                                    await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );
                                expect(listingPaddedIndexBefore).to.be.equals(
                                    0
                                );

                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const activeListings =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingsCount =
                                    activeListings.length;
                                const latestListingPaddedIndex =
                                    await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );
                                expect(latestListingPaddedIndex).to.be.equals(
                                    activeListingsCount
                                );
                            });
                            it("Should emit `TokenListed` event", async () => {
                                await expect(
                                    NftMarketplaceByDoodleHolder.listNft(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId,
                                        presetDoodlesPreferredPayment,
                                        presetDoodlesPrice,
                                        presetDoodlesIsStrictPayment
                                    )
                                )
                                    .to.emit(
                                        NftMarketplaceByDoodleHolder,
                                        "TokenListed"
                                    )
                                    .withArgs(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId,
                                        doodleHolder.address,
                                        presetDoodlesPreferredPayment,
                                        presetDoodlesPrice,
                                        presetDoodlesIsStrictPayment
                                    );
                            });
                        });
                        describe("LINK", () => {
                            beforeEach(() => {
                                presetDoodlesPreferredPayment = linkAddress;
                            });
                            it("Should update `s_listingMap`", async () => {
                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const updatedListing =
                                    await NftMarketplaceByDoodleHolder.getListingInfo(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );

                                const listedPayment =
                                    updatedListing.preferredPayment;
                                const listedPrice = updatedListing.price;
                                const listedStrictPayment =
                                    updatedListing.strictPayment;
                                const listedSeller = updatedListing.seller;

                                expect(listedPayment).to.be.equals(
                                    presetDoodlesPreferredPayment
                                );
                                expect(listedPrice).to.be.equals(
                                    ethers.parseEther("1")
                                );
                                expect(listedStrictPayment).to.be.true;
                                expect(listedSeller).to.be.equals(
                                    doodleHolder.address
                                );
                            });
                            it("Should update `s_activeListings`", async () => {
                                const activeListingsBefore =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingLengthBefore =
                                    activeListingsBefore.length;

                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const activeListingsAfter =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingLengthAfter =
                                    activeListingsAfter.length;
                                const latestActiveListingKey =
                                    activeListingsAfter[
                                        activeListingLengthAfter - 1
                                    ];

                                const listingKeyAddress =
                                    latestActiveListingKey.nftAddress;
                                const listingKeyId =
                                    latestActiveListingKey.tokenId;

                                expect(activeListingLengthAfter).to.be.equals(
                                    activeListingLengthBefore + 1
                                );
                                expect(listingKeyAddress).to.be.equals(
                                    presetDoodlesTokenAddress
                                );
                                expect(listingKeyId).to.be.equals(
                                    presetDoodlesTokenId
                                );
                            });
                            it("Should update `s_listingPaddedIndex`", async () => {
                                const listingPaddedIndexBefore =
                                    await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );
                                expect(listingPaddedIndexBefore).to.be.equals(
                                    0
                                );

                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const activeListings =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingsCount =
                                    activeListings.length;
                                const latestListingPaddedIndex =
                                    await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );
                                expect(latestListingPaddedIndex).to.be.equals(
                                    activeListingsCount
                                );
                            });
                            it("Should emit `TokenListed` event", async () => {
                                await expect(
                                    NftMarketplaceByDoodleHolder.listNft(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId,
                                        presetDoodlesPreferredPayment,
                                        presetDoodlesPrice,
                                        presetDoodlesIsStrictPayment
                                    )
                                )
                                    .to.emit(
                                        NftMarketplaceByDoodleHolder,
                                        "TokenListed"
                                    )
                                    .withArgs(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId,
                                        doodleHolder.address,
                                        presetDoodlesPreferredPayment,
                                        presetDoodlesPrice,
                                        presetDoodlesIsStrictPayment
                                    );
                            });
                        });
                        describe("UNI", () => {
                            beforeEach(() => {
                                presetDoodlesPreferredPayment = uniAddress;
                            });
                            it("Should update `s_listingMap`", async () => {
                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const updatedListing =
                                    await NftMarketplaceByDoodleHolder.getListingInfo(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );

                                const listedPayment =
                                    updatedListing.preferredPayment;
                                const listedPrice = updatedListing.price;
                                const listedStrictPayment =
                                    updatedListing.strictPayment;
                                const listedSeller = updatedListing.seller;

                                expect(listedPayment).to.be.equals(
                                    presetDoodlesPreferredPayment
                                );
                                expect(listedPrice).to.be.equals(
                                    ethers.parseEther("1")
                                );
                                expect(listedStrictPayment).to.be.true;
                                expect(listedSeller).to.be.equals(
                                    doodleHolder.address
                                );
                            });
                            it("Should update `s_activeListings`", async () => {
                                const activeListingsBefore =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingLengthBefore =
                                    activeListingsBefore.length;

                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const activeListingsAfter =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingLengthAfter =
                                    activeListingsAfter.length;
                                const latestActiveListingKey =
                                    activeListingsAfter[
                                        activeListingLengthAfter - 1
                                    ];

                                const listingKeyAddress =
                                    latestActiveListingKey.nftAddress;
                                const listingKeyId =
                                    latestActiveListingKey.tokenId;

                                expect(activeListingLengthAfter).to.be.equals(
                                    activeListingLengthBefore + 1
                                );
                                expect(listingKeyAddress).to.be.equals(
                                    presetDoodlesTokenAddress
                                );
                                expect(listingKeyId).to.be.equals(
                                    presetDoodlesTokenId
                                );
                            });
                            it("Should update `s_listingPaddedIndex`", async () => {
                                const listingPaddedIndexBefore =
                                    await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );
                                expect(listingPaddedIndexBefore).to.be.equals(
                                    0
                                );

                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const activeListings =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingsCount =
                                    activeListings.length;
                                const latestListingPaddedIndex =
                                    await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );
                                expect(latestListingPaddedIndex).to.be.equals(
                                    activeListingsCount
                                );
                            });
                            it("Should emit `TokenListed` event", async () => {
                                await expect(
                                    NftMarketplaceByDoodleHolder.listNft(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId,
                                        presetDoodlesPreferredPayment,
                                        presetDoodlesPrice,
                                        presetDoodlesIsStrictPayment
                                    )
                                )
                                    .to.emit(
                                        NftMarketplaceByDoodleHolder,
                                        "TokenListed"
                                    )
                                    .withArgs(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId,
                                        doodleHolder.address,
                                        presetDoodlesPreferredPayment,
                                        presetDoodlesPrice,
                                        presetDoodlesIsStrictPayment
                                    );
                            });
                        });
                        describe("wBTC", () => {
                            beforeEach(() => {
                                presetDoodlesPreferredPayment = wBtcAddress;
                            });
                            it("Should update `s_listingMap`", async () => {
                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const updatedListing =
                                    await NftMarketplaceByDoodleHolder.getListingInfo(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );

                                const listedPayment =
                                    updatedListing.preferredPayment;
                                const listedPrice = updatedListing.price;
                                const listedStrictPayment =
                                    updatedListing.strictPayment;
                                const listedSeller = updatedListing.seller;

                                expect(listedPayment).to.be.equals(
                                    presetDoodlesPreferredPayment
                                );
                                expect(listedPrice).to.be.equals(
                                    ethers.parseEther("1")
                                );
                                expect(listedStrictPayment).to.be.true;
                                expect(listedSeller).to.be.equals(
                                    doodleHolder.address
                                );
                            });
                            it("Should update `s_activeListings`", async () => {
                                const activeListingsBefore =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingLengthBefore =
                                    activeListingsBefore.length;

                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const activeListingsAfter =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingLengthAfter =
                                    activeListingsAfter.length;
                                const latestActiveListingKey =
                                    activeListingsAfter[
                                        activeListingLengthAfter - 1
                                    ];

                                const listingKeyAddress =
                                    latestActiveListingKey.nftAddress;
                                const listingKeyId =
                                    latestActiveListingKey.tokenId;

                                expect(activeListingLengthAfter).to.be.equals(
                                    activeListingLengthBefore + 1
                                );
                                expect(listingKeyAddress).to.be.equals(
                                    presetDoodlesTokenAddress
                                );
                                expect(listingKeyId).to.be.equals(
                                    presetDoodlesTokenId
                                );
                            });
                            it("Should update `s_listingPaddedIndex`", async () => {
                                const listingPaddedIndexBefore =
                                    await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );
                                expect(listingPaddedIndexBefore).to.be.equals(
                                    0
                                );

                                await listNft(
                                    presetDoodlesTokenAddress,
                                    presetDoodlesTokenId,
                                    presetDoodlesPreferredPayment,
                                    presetDoodlesPrice,
                                    presetDoodlesIsStrictPayment
                                );

                                const activeListings =
                                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                                const activeListingsCount =
                                    activeListings.length;
                                const latestListingPaddedIndex =
                                    await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId
                                    );
                                expect(latestListingPaddedIndex).to.be.equals(
                                    activeListingsCount
                                );
                            });
                            it("Should emit `TokenListed` event", async () => {
                                await expect(
                                    NftMarketplaceByDoodleHolder.listNft(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId,
                                        presetDoodlesPreferredPayment,
                                        presetDoodlesPrice,
                                        presetDoodlesIsStrictPayment
                                    )
                                )
                                    .to.emit(
                                        NftMarketplaceByDoodleHolder,
                                        "TokenListed"
                                    )
                                    .withArgs(
                                        presetDoodlesTokenAddress,
                                        presetDoodlesTokenId,
                                        doodleHolder.address,
                                        presetDoodlesPreferredPayment,
                                        presetDoodlesPrice,
                                        presetDoodlesIsStrictPayment
                                    );
                            });
                        });
                    });
                });
            });
            describe("Remove Listing", () => {
                let presetTokenAddress;
                let presetToken;
                let presetTokenId;
                let presetPreferredPayment;
                let presetPrice;
                let presetIsStrictPayment;

                beforeEach(async () => {
                    presetTokenAddress = doodleAddress;
                    presetToken = doodlesTokens[0];
                    presetTokenId = presetToken.id;

                    presetPreferredPayment = zeroAddress;
                    presetPrice = ethers.parseEther("1");
                    presetIsStrictPayment = true;

                    await approveNft(
                        presetTokenAddress,
                        doodleHolder.address,
                        NftMarketplaceAddress,
                        presetTokenId
                    );

                    await listNft(
                        presetTokenAddress,
                        presetTokenId,
                        presetPreferredPayment,
                        presetPrice,
                        presetIsStrictPayment
                    );
                });

                describe("Precautions", () => {
                    it("Should revert when being cancel by non-owner caller", async () => {
                        const NftMarketplaceAttackInstance =
                            getNftMarketplaceInstanceByTokenHolder(
                                lilPudgysAddress
                            );
                        await expect(
                            NftMarketplaceAttackInstance.cancelListing(
                                presetTokenAddress,
                                presetTokenId
                            )
                        )
                            .to.be.revertedWithCustomError(
                                NftMarketplace,
                                "NftMarketplace__NotOperatedByOwner"
                            )
                            .withArgs(
                                presetTokenAddress,
                                presetTokenId,
                                lilPudgysHolder.address
                            );
                    });
                    it("Should revert when canceling a not-listed token", async () => {
                        await expect(
                            NftMarketplaceByDoodleHolder.cancelListing(
                                doodleAddress,
                                doodlesTokens[1].id
                            )
                        )
                            .to.be.revertedWithCustomError(
                                NftMarketplace,
                                "NftMarketplace__TokenNotListed"
                            )
                            .withArgs(doodleAddress, doodlesTokens[1].id);
                    });
                });

                describe("Removing", () => {
                    let doodleToken1, baycToken, lilPudgysToken;
                    let preferredPayment, price, isStrictPayment;

                    beforeEach(async () => {
                        doodleToken1 = doodlesTokens[1];
                        baycToken = boredApeYachtClubTokens[0];
                        lilPudgysToken = lilPudgysTokens[0];
                        preferredPayment = zeroAddress;
                        price = ethers.parseEther("1");
                        isStrictPayment = true;

                        await approveNft(
                            doodleAddress,
                            doodleHolder.address,
                            NftMarketplaceAddress,
                            doodleToken1.id
                        );
                        await approveNft(
                            boredApeYachtClubAddress,
                            boredApeYachtClubHolder.address,
                            NftMarketplaceAddress,
                            baycToken.id
                        );
                        await approveNft(
                            lilPudgysAddress,
                            lilPudgysHolder.address,
                            NftMarketplaceAddress,
                            lilPudgysToken.id
                        );

                        await listNft(
                            doodleAddress,
                            doodleToken1.id,
                            preferredPayment,
                            price,
                            isStrictPayment
                        );

                        await listNft(
                            boredApeYachtClubAddress,
                            baycToken.id,
                            preferredPayment,
                            price,
                            isStrictPayment
                        );

                        await listNft(
                            lilPudgysAddress,
                            lilPudgysToken.id,
                            preferredPayment,
                            price,
                            isStrictPayment
                        );
                    });

                    it("Should be able to remove the latest listing", async () => {
                        const activeListingKeysBefore =
                            await NftMarketplaceByLilPudgysHolder.getActiveListingKeys();
                        const lastActiveListingKeyBefore =
                            activeListingKeysBefore[
                                activeListingKeysBefore.length - 1
                            ];

                        const tokenAddressToRemove = lilPudgysAddress;
                        const tokenIdToRemove = lilPudgysToken.id;

                        await cancelListing(
                            tokenAddressToRemove,
                            tokenIdToRemove
                        );
                        const activeListingKeysAfter =
                            await NftMarketplaceByLilPudgysHolder.getActiveListingKeys();
                        const lastActiveListingKeyAfter =
                            activeListingKeysAfter[
                                activeListingKeysAfter.length - 1
                            ];

                        expect(
                            lastActiveListingKeyBefore.nftAddress
                        ).to.be.equals(tokenAddressToRemove);
                        expect(lastActiveListingKeyBefore.tokenId).to.be.equals(
                            tokenIdToRemove
                        );

                        expect(activeListingKeysAfter.length).to.be.equals(
                            activeListingKeysBefore.length - 1
                        );

                        expect(
                            lastActiveListingKeyAfter.nftAddress
                        ).to.be.equals(boredApeYachtClubAddress);
                        expect(lastActiveListingKeyAfter.tokenId).to.be.equals(
                            baycToken.id
                        );
                    });
                    it("Should be able to remove non-latest listing", async () => {
                        const activeListingKeysBefore =
                            await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                        const lastActiveListingKeyBefore =
                            activeListingKeysBefore[
                                activeListingKeysBefore.length - 1
                            ];
                        const secondLastActiveListingKeyBefore =
                            activeListingKeysBefore[
                                activeListingKeysBefore.length - 2
                            ];

                        const tokenAddressToRemove = doodleAddress;
                        const tokenIdToRemove = doodleToken1.id;

                        const paddedIndexToRemove =
                            await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                tokenAddressToRemove,
                                tokenIdToRemove
                            );

                        await cancelListing(
                            tokenAddressToRemove,
                            tokenIdToRemove
                        );

                        const activeListingKeysAfter =
                            await NftMarketplaceByDoodleHolder.getActiveListingKeys();

                        expect(activeListingKeysAfter.length).to.be.equals(
                            activeListingKeysBefore.length - 1
                        );

                        // Check if swapped with the original last item
                        expect(
                            activeListingKeysAfter[paddedIndexToRemove - 1n]
                                .nftAddress
                        ).to.be.equals(lastActiveListingKeyBefore.nftAddress);
                        expect(
                            activeListingKeysAfter[paddedIndexToRemove - 1n]
                                .tokenId
                        ).to.be.equals(lastActiveListingKeyBefore.tokenId);

                        // Previous second last should be last now
                        const newPaddedIndexOfSecondLast =
                            await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                secondLastActiveListingKeyBefore.nftAddress,
                                secondLastActiveListingKeyBefore.tokenId
                            );
                        expect(newPaddedIndexOfSecondLast).to.be.equals(
                            activeListingKeysAfter.length
                        );
                    });
                    it("Should update `s_listingPaddedIndex`", async () => {
                        const tokenAddressToRemove = doodleAddress;
                        const tokenIdToRemove = doodleToken1.id;

                        await cancelListing(
                            tokenAddressToRemove,
                            tokenIdToRemove
                        );

                        const newPaddedIndexOfRemoved =
                            await NftMarketplaceByDoodleHolder.getListingPaddedIndex(
                                tokenAddressToRemove,
                                tokenIdToRemove
                            );
                        expect(newPaddedIndexOfRemoved).to.be.equals(0);
                    });
                    it("Should update `s_listingMap`", async () => {
                        const tokenAddressToRemove = doodleAddress;
                        const tokenIdToRemove = doodleToken1.id;

                        await cancelListing(
                            tokenAddressToRemove,
                            tokenIdToRemove
                        );

                        await expect(
                            NftMarketplaceByDoodleHolder.getListingInfo(
                                tokenAddressToRemove,
                                tokenIdToRemove
                            )
                        )
                            .to.be.revertedWithCustomError(
                                NftMarketplaceByDoodleHolder,
                                "NftMarketplace__TokenNotListed"
                            )
                            .withArgs(tokenAddressToRemove, tokenIdToRemove);
                    });
                });
            });
            describe("Update Listing", () => {
                let presetTokenAddress;
                let presetToken;
                let presetTokenId;
                let presetPreferredPayment;
                let presetPrice;
                let presetIsStrictPayment;

                beforeEach(async () => {
                    presetTokenAddress = doodleAddress;
                    presetToken = doodlesTokens[0];
                    presetTokenId = presetToken.id;

                    presetPreferredPayment = zeroAddress;
                    presetPrice = ethers.parseEther("1");
                    presetIsStrictPayment = true;

                    await approveNft(
                        presetTokenAddress,
                        doodleHolder.address,
                        NftMarketplaceAddress,
                        presetTokenId
                    );

                    await listNft(
                        presetTokenAddress,
                        presetTokenId,
                        presetPreferredPayment,
                        presetPrice,
                        presetIsStrictPayment
                    );
                });
                describe("Precautions", () => {
                    it("Should revert when being updated by non-owner caller", async () => {
                        const NftMarketplaceAttackInstance =
                            getNftMarketplaceInstanceByTokenHolder(
                                lilPudgysAddress
                            );
                        await expect(
                            NftMarketplaceAttackInstance.updateListing(
                                doodleAddress,
                                presetTokenId,
                                presetPreferredPayment,
                                presetPrice,
                                presetIsStrictPayment
                            )
                        )
                            .to.be.revertedWithCustomError(
                                NftMarketplace,
                                "NftMarketplace__NotOperatedByOwner"
                            )
                            .withArgs(
                                presetTokenAddress,
                                presetTokenId,
                                lilPudgysHolder.address
                            );
                    });
                    it("Should revert when updating a not-listed token", async () => {
                        await expect(
                            NftMarketplaceByDoodleHolder.updateListing(
                                doodleAddress,
                                doodlesTokens[1].id,
                                presetPreferredPayment,
                                presetPrice,
                                presetIsStrictPayment
                            )
                        )
                            .to.be.revertedWithCustomError(
                                NftMarketplace,
                                "NftMarketplace__TokenNotListed"
                            )
                            .withArgs(doodleAddress, doodlesTokens[1].id);
                    });
                    it("Should revert when updating to a not-supported payment", async () => {
                        await expect(
                            NftMarketplaceByDoodleHolder.updateListing(
                                doodleAddress,
                                presetTokenId,
                                tetherAddress,
                                presetPrice,
                                presetIsStrictPayment
                            )
                        )
                            .to.be.revertedWithCustomError(
                                NftMarketplace,
                                "NftMarketplace__PaymentNotSupported"
                            )
                            .withArgs(tetherAddress);
                    });
                    it("Should revert when updating with price of zero", async () => {
                        await expect(
                            NftMarketplaceByDoodleHolder.updateListing(
                                doodleAddress,
                                presetTokenId,
                                wEthAddress,
                                0,
                                presetIsStrictPayment
                            )
                        ).to.be.revertedWithCustomError(
                            NftMarketplace,
                            "NftMarketplace__PriceIsZero"
                        );
                    });
                    it("Should revert if update not needed", async () => {
                        await expect(
                            NftMarketplaceByDoodleHolder.updateListing(
                                doodleAddress,
                                presetTokenId,
                                presetPreferredPayment,
                                presetPrice,
                                presetIsStrictPayment
                            )
                        )
                            .to.be.revertedWithCustomError(
                                NftMarketplace,
                                "NftMarketplace__UpdateNotNeeded"
                            )
                            .withArgs(
                                doodleAddress,
                                presetTokenId,
                                presetPreferredPayment,
                                presetPrice,
                                presetIsStrictPayment
                            );
                    });
                });
                describe("Updating", () => {
                    describe("Updating payment", () => {
                        it("Should be able to update preferred payment to wETH", async () => {
                            await updateListing(
                                presetTokenAddress,
                                presetTokenId,
                                wEthAddress,
                                presetPrice,
                                presetIsStrictPayment
                            );

                            const newListingInfo =
                                await NftMarketplaceByDoodleHolder.getListingInfo(
                                    presetTokenAddress,
                                    presetTokenId
                                );

                            expect(
                                newListingInfo.preferredPayment
                            ).to.be.equals(wEthAddress);
                        });
                        it("Should be able to update preferred payment to USDC", async () => {
                            await updateListing(
                                presetTokenAddress,
                                presetTokenId,
                                usdcAddress,
                                presetPrice,
                                presetIsStrictPayment
                            );

                            const newListingInfo =
                                await NftMarketplaceByDoodleHolder.getListingInfo(
                                    presetTokenAddress,
                                    presetTokenId
                                );

                            expect(
                                newListingInfo.preferredPayment
                            ).to.be.equals(usdcAddress);
                        });
                        it("Should be able to update preferred payment to DAI", async () => {
                            await updateListing(
                                presetTokenAddress,
                                presetTokenId,
                                daiAddress,
                                presetPrice,
                                presetIsStrictPayment
                            );

                            const newListingInfo =
                                await NftMarketplaceByDoodleHolder.getListingInfo(
                                    presetTokenAddress,
                                    presetTokenId
                                );

                            expect(
                                newListingInfo.preferredPayment
                            ).to.be.equals(daiAddress);
                        });
                        it("Should be able to update preferred payment to LINK", async () => {
                            await updateListing(
                                presetTokenAddress,
                                presetTokenId,
                                linkAddress,
                                presetPrice,
                                presetIsStrictPayment
                            );

                            const newListingInfo =
                                await NftMarketplaceByDoodleHolder.getListingInfo(
                                    presetTokenAddress,
                                    presetTokenId
                                );

                            expect(
                                newListingInfo.preferredPayment
                            ).to.be.equals(linkAddress);
                        });
                        it("Should be able to update preferred payment to UNI", async () => {
                            await updateListing(
                                presetTokenAddress,
                                presetTokenId,
                                uniAddress,
                                presetPrice,
                                presetIsStrictPayment
                            );

                            const newListingInfo =
                                await NftMarketplaceByDoodleHolder.getListingInfo(
                                    presetTokenAddress,
                                    presetTokenId
                                );

                            expect(
                                newListingInfo.preferredPayment
                            ).to.be.equals(uniAddress);
                        });
                        it("Should be able to update preferred payment to wBTC", async () => {
                            await updateListing(
                                presetTokenAddress,
                                presetTokenId,
                                wBtcAddress,
                                presetPrice,
                                presetIsStrictPayment
                            );

                            const newListingInfo =
                                await NftMarketplaceByDoodleHolder.getListingInfo(
                                    presetTokenAddress,
                                    presetTokenId
                                );

                            expect(
                                newListingInfo.preferredPayment
                            ).to.be.equals(wBtcAddress);
                        });
                        it("Should be able to update preferred payment to ETH", async () => {
                            await approveNft(
                                lilPudgysAddress,
                                lilPudgysHolder.address,
                                NftMarketplaceAddress,
                                lilPudgysTokens[1].id
                            );

                            await listNft(
                                lilPudgysAddress,
                                lilPudgysTokens[1].id,
                                usdcAddress,
                                presetPrice,
                                true
                            );

                            await updateListing(
                                lilPudgysAddress,
                                lilPudgysTokens[1].id,
                                zeroAddress,
                                presetPrice,
                                true
                            );

                            const newListingInfo =
                                await NftMarketplaceByDoodleHolder.getListingInfo(
                                    lilPudgysAddress,
                                    lilPudgysTokens[1].id
                                );

                            expect(
                                newListingInfo.preferredPayment
                            ).to.be.equals(zeroAddress);
                        });
                    });
                    describe("Updating price", () => {
                        it("Should be able to update price", async () => {
                            await updateListing(
                                presetTokenAddress,
                                presetTokenId,
                                presetPreferredPayment,
                                ethers.parseEther("2"),
                                presetIsStrictPayment
                            );

                            const newListingInfo =
                                await NftMarketplaceByDoodleHolder.getListingInfo(
                                    presetTokenAddress,
                                    presetTokenId
                                );
                            const newPrice = newListingInfo.price;
                            expect(newPrice).to.be.equals(
                                ethers.parseEther("2")
                            );
                        });
                    });
                    describe("Updating strict payment flag", () => {
                        it("Should be able to update strict payment policy to false", async () => {
                            await updateListing(
                                presetTokenAddress,
                                presetTokenId,
                                usdcAddress,
                                presetPrice,
                                false
                            );

                            const newListingInfo =
                                await NftMarketplaceByDoodleHolder.getListingInfo(
                                    presetTokenAddress,
                                    presetTokenId
                                );
                            const newStrictFlag = newListingInfo.strictPayment;
                            expect(newStrictFlag).to.be.false;
                        });
                        it("Should be able to update strict payment policy to true", async () => {
                            await updateListing(
                                presetTokenAddress,
                                presetTokenId,
                                usdcAddress,
                                presetPrice,
                                false
                            );

                            await updateListing(
                                presetTokenAddress,
                                presetTokenId,
                                usdcAddress,
                                presetPrice,
                                true
                            );

                            const newListingInfo =
                                await NftMarketplaceByDoodleHolder.getListingInfo(
                                    presetTokenAddress,
                                    presetTokenId
                                );
                            const newStrictFlag = newListingInfo.strictPayment;
                            expect(newStrictFlag).to.be.true;
                        });
                    });
                    it("Should be able to update `s_listingMap`", async () => {
                        await updateListing(
                            presetTokenAddress,
                            presetTokenId,
                            wBtcAddress,
                            BigInt(1e8),
                            false
                        );

                        const newListingInfo =
                            await NftMarketplaceByDoodleHolder.getListingInfo(
                                presetTokenAddress,
                                presetTokenId
                            );
                        expect(newListingInfo.preferredPayment).to.be.equals(
                            wBtcAddress
                        );
                        expect(newListingInfo.price).to.be.equals(BigInt(1e8));
                        expect(newListingInfo.strictPayment).to.be.false;
                    });
                    it("Should emit an `ListingUpdated` event with correct args", async () => {
                        await expect(
                            NftMarketplaceByDoodleHolder.updateListing(
                                presetTokenAddress,
                                presetTokenId,
                                wBtcAddress,
                                BigInt(1e8),
                                false
                            )
                        )
                            .to.emit(NftMarketplace, "ListingUpdated")
                            .withArgs(
                                presetTokenAddress,
                                presetTokenId,
                                doodleHolder.address,
                                wBtcAddress,
                                BigInt(1e8),
                                false
                            );
                    });
                });
            });
            describe("Tool function: `getListings`", () => {
                let doodleToken0,
                    baycToken0,
                    lilPudgysToken0,
                    doodleToken1,
                    baycToken1;
                let preferredPayment0, price0, isStrictPayment0;
                let preferredPayment1, price1, isStrictPayment1;
                let preferredPayment2, price2, isStrictPayment2;
                let preferredPayment3, price3, isStrictPayment3;
                let preferredPayment4, price4, isStrictPayment4;

                beforeEach(async () => {
                    doodleToken0 = doodlesTokens[0];
                    baycToken0 = boredApeYachtClubTokens[0];
                    lilPudgysToken0 = lilPudgysTokens[0];
                    doodleToken1 = doodlesTokens[1];
                    baycToken1 = boredApeYachtClubTokens[1];

                    preferredPayment0 = zeroAddress;
                    price0 = ethers.parseEther("1");
                    isStrictPayment0 = true;

                    preferredPayment1 = usdcAddress;
                    price1 = ethers.parseEther("1");
                    isStrictPayment1 = false;

                    preferredPayment2 = daiAddress;
                    price2 = ethers.parseEther("1");
                    isStrictPayment2 = true;

                    preferredPayment3 = linkAddress;
                    price3 = ethers.parseEther("1");
                    isStrictPayment3 = true;

                    preferredPayment4 = wBtcAddress;
                    price4 = BigInt(1e8);
                    isStrictPayment4 = true;

                    await approveNft(
                        doodleAddress,
                        doodleHolder.address,
                        NftMarketplaceAddress,
                        doodleToken0.id
                    );
                    await approveNft(
                        boredApeYachtClubAddress,
                        boredApeYachtClubHolder.address,
                        NftMarketplaceAddress,
                        baycToken0.id
                    );
                    await approveNft(
                        lilPudgysAddress,
                        lilPudgysHolder.address,
                        NftMarketplaceAddress,
                        lilPudgysToken0.id
                    );
                    await approveNft(
                        doodleAddress,
                        doodleHolder.address,
                        NftMarketplaceAddress,
                        doodleToken1.id
                    );
                    await approveNft(
                        boredApeYachtClubAddress,
                        boredApeYachtClubHolder.address,
                        NftMarketplaceAddress,
                        baycToken1.id
                    );

                    await listNft(
                        doodleAddress,
                        doodleToken0.id,
                        preferredPayment0,
                        price0,
                        isStrictPayment0
                    );

                    await listNft(
                        boredApeYachtClubAddress,
                        baycToken0.id,
                        preferredPayment1,
                        price1,
                        isStrictPayment1
                    );

                    await listNft(
                        lilPudgysAddress,
                        lilPudgysToken0.id,
                        preferredPayment2,
                        price2,
                        isStrictPayment2
                    );
                    await listNft(
                        doodleAddress,
                        doodleToken1.id,
                        preferredPayment3,
                        price3,
                        isStrictPayment3
                    );

                    await listNft(
                        boredApeYachtClubAddress,
                        baycToken1.id,
                        preferredPayment4,
                        price4,
                        isStrictPayment4
                    );
                });
                it("Should revert when requesting length of `0`", async () => {
                    await expect(
                        NftMarketplaceByDoodleHolder.getListings(0, 0)
                    ).to.be.revertedWith("Limit less than 0");
                });
                it("Should revert when requesting start index exceeding range", async () => {
                    const activeListings =
                        await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                    const listingsCount = activeListings.length;
                    await expect(
                        NftMarketplaceByDoodleHolder.getListings(
                            listingsCount,
                            1
                        )
                    ).to.be.revertedWith("Out of bounds");
                });
                it("Should be able to return all when requesting exactly all", async () => {
                    const activeListings =
                        await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                    const listingsCount = activeListings.length;
                    const allListings =
                        await NftMarketplaceByDoodleHolder.getListings(
                            0,
                            listingsCount
                        );

                    expect(allListings[0].preferredPayment).to.be.equals(
                        preferredPayment0
                    );
                    expect(allListings[0].price).to.be.equals(price0);
                    expect(allListings[0].strictPayment).to.be.equals(
                        isStrictPayment0
                    );
                    expect(allListings[0].seller).to.be.equals(
                        doodleHolder.address
                    );

                    expect(allListings[1].preferredPayment).to.be.equals(
                        preferredPayment1
                    );
                    expect(allListings[1].price).to.be.equals(price1);
                    expect(allListings[1].strictPayment).to.be.equals(
                        isStrictPayment1
                    );
                    expect(allListings[1].seller).to.be.equals(
                        boredApeYachtClubHolder.address
                    );

                    expect(allListings[2].preferredPayment).to.be.equals(
                        preferredPayment2
                    );
                    expect(allListings[2].price).to.be.equals(price2);
                    expect(allListings[2].strictPayment).to.be.equals(
                        isStrictPayment2
                    );
                    expect(allListings[2].seller).to.be.equals(
                        lilPudgysHolder.address
                    );
                    expect(allListings[3].preferredPayment).to.be.equals(
                        preferredPayment3
                    );
                    expect(allListings[3].price).to.be.equals(price3);
                    expect(allListings[3].strictPayment).to.be.equals(
                        isStrictPayment3
                    );
                    expect(allListings[3].seller).to.be.equals(
                        doodleHolder.address
                    );

                    expect(allListings[4].preferredPayment).to.be.equals(
                        preferredPayment4
                    );
                    expect(allListings[4].price).to.be.equals(price4);
                    expect(allListings[4].strictPayment).to.be.equals(
                        isStrictPayment4
                    );
                    expect(allListings[4].seller).to.be.equals(
                        boredApeYachtClubHolder.address
                    );
                });
                it("Should return exactly tokens requested when not exceeding range", async () => {
                    const returnedListings =
                        await NftMarketplaceByDoodleHolder.getListings(1, 2);

                    expect(returnedListings[0].preferredPayment).to.be.equals(
                        preferredPayment1
                    );
                    expect(returnedListings[0].price).to.be.equals(price1);
                    expect(returnedListings[0].strictPayment).to.be.equals(
                        isStrictPayment1
                    );
                    expect(returnedListings[0].seller).to.be.equals(
                        boredApeYachtClubHolder.address
                    );

                    expect(returnedListings[1].preferredPayment).to.be.equals(
                        preferredPayment2
                    );
                    expect(returnedListings[1].price).to.be.equals(price2);
                    expect(returnedListings[1].strictPayment).to.be.equals(
                        isStrictPayment2
                    );
                    expect(returnedListings[1].seller).to.be.equals(
                        lilPudgysHolder.address
                    );
                });

                it("Should return all existing tokens in specified range", async () => {
                    const activeListings =
                        await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                    const listingsCount = activeListings.length;

                    const startIndex = 4;
                    const queryLength = 15;

                    const returnedListings =
                        await NftMarketplaceByDoodleHolder.getListings(
                            startIndex,
                            queryLength
                        );

                    expect(returnedListings.length).to.be.equals(
                        listingsCount - startIndex
                    );

                    expect(
                        returnedListings[returnedListings.length - 1]
                            .preferredPayment
                    ).to.be.equals(preferredPayment4);
                    expect(
                        returnedListings[returnedListings.length - 1].price
                    ).to.be.equals(price4);
                    expect(
                        returnedListings[returnedListings.length - 1]
                            .strictPayment
                    ).to.be.equals(isStrictPayment4);
                    expect(
                        returnedListings[returnedListings.length - 1].seller
                    ).to.be.equals(boredApeYachtClubHolder.address);
                });
            });
        });

        describe("Buying operations", () => {
            let doodleStrictUsdc;
            let baycNonStrictWbtc;

            beforeEach(async () => {
                doodleStrictUsdc = {
                    tokenAddress: doodleAddress,
                    tokenId: doodlesTokens[0].id,
                    preferredPayment: usdcAddress,
                    price: BigInt(1e18),
                    isStrictPayment: true
                };
                baycNonStrictWbtc = {
                    tokenAddress: boredApeYachtClubAddress,
                    tokenId: boredApeYachtClubTokens[0].id,
                    preferredPayment: wBtcAddress,
                    price: BigInt(1e8),
                    isStrictPayment: false
                };

                await approveNft(
                    doodleStrictUsdc.tokenAddress,
                    doodleHolder.address,
                    NftMarketplaceAddress,
                    doodleStrictUsdc.tokenId
                );
                await approveNft(
                    baycNonStrictWbtc.tokenAddress,
                    boredApeYachtClubHolder.address,
                    NftMarketplaceAddress,
                    baycNonStrictWbtc.tokenId
                );

                await listNft(
                    doodleStrictUsdc.tokenAddress,
                    doodleStrictUsdc.tokenId,
                    doodleStrictUsdc.preferredPayment,
                    doodleStrictUsdc.price,
                    doodleStrictUsdc.isStrictPayment
                );
                await listNft(
                    baycNonStrictWbtc.tokenAddress,
                    baycNonStrictWbtc.tokenId,
                    baycNonStrictWbtc.preferredPayment,
                    baycNonStrictWbtc.price,
                    baycNonStrictWbtc.isStrictPayment
                );
            });

            describe("Precautions", () => {
                it("Should revert when buying a not-listed token", async () => {
                    const notListedToken = {
                        tokenAddress: lilPudgysAddress,
                        tokenId: lilPudgysTokens[0].id
                    };

                    await expect(
                        NftMarketplace.connect(usdcValidAccount).buyToken(
                            notListedToken.tokenAddress,
                            notListedToken.tokenId,
                            usdcAddress
                        )
                    )
                        .to.be.revertedWithCustomError(
                            NftMarketplace,
                            "NftMarketplace__TokenNotListed"
                        )
                        .withArgs(
                            notListedToken.tokenAddress,
                            notListedToken.tokenId
                        );
                });

                it("Should revert when buying with not supported token", async () => {
                    await expect(
                        NftMarketplace.connect(usdcValidAccount).buyToken(
                            doodleStrictUsdc.tokenAddress,
                            doodleStrictUsdc.tokenId,
                            tetherAddress
                        )
                    )
                        .to.be.revertedWithCustomError(
                            NftMarketplace,
                            "NftMarketplace__PaymentNotSupported"
                        )
                        .withArgs(tetherAddress);
                });
                it("Should revert buying request with non-preferred token when strict payment is specified", async () => {
                    await expect(
                        NftMarketplace.connect(wBtcValidAccount).buyToken(
                            doodleStrictUsdc.tokenAddress,
                            doodleStrictUsdc.tokenId,
                            wBtcAddress
                        )
                    )
                        .to.be.revertedWithCustomError(
                            NftMarketplace,
                            "NftMarketplace__PaymentNotAccepted"
                        )
                        .withArgs(
                            doodleStrictUsdc.tokenAddress,
                            doodleStrictUsdc.tokenId,
                            wBtcAddress
                        );
                });
                it("Should revert when seller tries to buy their own listed token", async () => {
                    await expect(
                        NftMarketplaceByDoodleHolder.buyToken(
                            doodleStrictUsdc.tokenAddress,
                            doodleStrictUsdc.tokenId,
                            usdcAddress
                        )
                    )
                        .to.be.revertedWithCustomError(
                            NftMarketplace,
                            "NftMarketplace__BuyingYourOwnToken"
                        )
                        .withArgs(
                            doodleStrictUsdc.tokenAddress,
                            doodleStrictUsdc.tokenId,
                            doodleHolder.address
                        );
                });
                describe("Payment verification(should revert when buying with insufficient funds)", () => {
                    let doodleStrictEth,
                        doodleStrictWeth,
                        doodleStrictDai,
                        doodleStrictLink,
                        doodleStrictUni,
                        doodleStrictWbtc;
                    let doodleNonStrictEth,
                        doodleNonStrictWeth,
                        doodleNonStrictUsdc,
                        doodleNonStrictDai,
                        doodleNonStrictLink,
                        doodleNonStrictUni,
                        doodleNonStrictWbtc;

                    let highPrice, lowPrice;

                    beforeEach(async () => {
                        highPrice = 100000;
                        lowPrice = 5;

                        doodleStrictEth = {
                            tokenAddress: doodleAddress,
                            tokenId: doodlesTokens[1].id,
                            preferredPayment: zeroAddress,
                            price: BigInt(highPrice * 1e18),
                            isStrictPayment: true
                        };
                        doodleStrictWeth = {
                            tokenAddress: doodleAddress,
                            tokenId: doodlesTokens[2].id,
                            preferredPayment: wEthAddress,
                            price: BigInt(highPrice * 1e18),
                            isStrictPayment: true
                        };
                        doodleStrictDai = {
                            tokenAddress: doodleAddress,
                            tokenId: doodlesTokens[3].id,
                            preferredPayment: daiAddress,
                            price: BigInt(highPrice * 1e18),
                            isStrictPayment: true
                        };
                        doodleStrictLink = {
                            tokenAddress: doodleAddress,
                            tokenId: doodlesTokens[4].id,
                            preferredPayment: linkAddress,
                            price: BigInt(highPrice * 1e18),
                            isStrictPayment: true
                        };
                        doodleStrictUni = {
                            tokenAddress: doodleAddress,
                            tokenId: doodlesTokens[5].id,
                            preferredPayment: uniAddress,
                            price: BigInt(highPrice * 1e18),
                            isStrictPayment: true
                        };
                        doodleStrictWbtc = {
                            tokenAddress: doodleAddress,
                            tokenId: doodlesTokens[6].id,
                            preferredPayment: wBtcAddress,
                            price: BigInt(highPrice * 1e8),
                            isStrictPayment: true
                        };

                        doodleNonStrictEth = {
                            tokenAddress: doodleAddress,
                            tokenId: doodlesTokens[7].id,
                            preferredPayment: zeroAddress,
                            price: BigInt(highPrice * 1e18),
                            isStrictPayment: false
                        };
                        doodleNonStrictWeth = {
                            tokenAddress: doodleAddress,
                            tokenId: doodlesTokens[8].id,
                            preferredPayment: wEthAddress,
                            price: BigInt(highPrice * 1e18),
                            isStrictPayment: false
                        };
                        doodleNonStrictUsdc = {
                            tokenAddress: doodleAddress,
                            tokenId: doodlesTokens[9].id,
                            preferredPayment: usdcAddress,
                            price: BigInt(highPrice * 1e6),
                            isStrictPayment: false
                        };
                        doodleNonStrictDai = {
                            tokenAddress: doodleAddress,
                            tokenId: doodlesTokens[10].id,
                            preferredPayment: daiAddress,
                            price: BigInt(highPrice * 1e18),
                            isStrictPayment: false
                        };
                        doodleNonStrictLink = {
                            tokenAddress: doodleAddress,
                            tokenId: doodlesTokens[11].id,
                            preferredPayment: linkAddress,
                            price: BigInt(highPrice * 1e18),
                            isStrictPayment: false
                        };
                        doodleNonStrictUni = {
                            tokenAddress: doodleAddress,
                            tokenId: doodlesTokens[12].id,
                            preferredPayment: uniAddress,
                            price: BigInt(highPrice * 1e18),
                            isStrictPayment: false
                        };
                        doodleNonStrictWbtc = {
                            tokenAddress: doodleAddress,
                            tokenId: doodlesTokens[13].id,
                            preferredPayment: wBtcAddress,
                            price: BigInt(highPrice * 1e18),
                            isStrictPayment: false
                        };

                        await approveNft(
                            doodleStrictEth.tokenAddress,
                            doodleHolder.address,
                            NftMarketplaceAddress,
                            doodleStrictEth.tokenId
                        );
                        await approveNft(
                            doodleStrictWeth.tokenAddress,
                            doodleHolder.address,
                            NftMarketplaceAddress,
                            doodleStrictWeth.tokenId
                        );
                        await approveNft(
                            doodleStrictDai.tokenAddress,
                            doodleHolder.address,
                            NftMarketplaceAddress,
                            doodleStrictDai.tokenId
                        );
                        await approveNft(
                            doodleStrictLink.tokenAddress,
                            doodleHolder.address,
                            NftMarketplaceAddress,
                            doodleStrictLink.tokenId
                        );
                        await approveNft(
                            doodleStrictUni.tokenAddress,
                            doodleHolder.address,
                            NftMarketplaceAddress,
                            doodleStrictUni.tokenId
                        );
                        await approveNft(
                            doodleStrictWbtc.tokenAddress,
                            doodleHolder.address,
                            NftMarketplaceAddress,
                            doodleStrictWbtc.tokenId
                        );
                        await approveNft(
                            doodleNonStrictEth.tokenAddress,
                            doodleHolder.address,
                            NftMarketplaceAddress,
                            doodleNonStrictEth.tokenId
                        );
                        await approveNft(
                            doodleNonStrictWeth.tokenAddress,
                            doodleHolder.address,
                            NftMarketplaceAddress,
                            doodleNonStrictWeth.tokenId
                        );
                        await approveNft(
                            doodleNonStrictUsdc.tokenAddress,
                            doodleHolder.address,
                            NftMarketplaceAddress,
                            doodleNonStrictUsdc.tokenId
                        );
                        await approveNft(
                            doodleNonStrictDai.tokenAddress,
                            doodleHolder.address,
                            NftMarketplaceAddress,
                            doodleNonStrictDai.tokenId
                        );
                        await approveNft(
                            doodleNonStrictLink.tokenAddress,
                            doodleHolder.address,
                            NftMarketplaceAddress,
                            doodleNonStrictLink.tokenId
                        );
                        await approveNft(
                            doodleNonStrictUni.tokenAddress,
                            doodleHolder.address,
                            NftMarketplaceAddress,
                            doodleNonStrictUni.tokenId
                        );
                        await approveNft(
                            doodleNonStrictWbtc.tokenAddress,
                            doodleHolder.address,
                            NftMarketplaceAddress,
                            doodleNonStrictWbtc.tokenId
                        );

                        await listNft(
                            doodleStrictEth.tokenAddress,
                            doodleStrictEth.tokenId,
                            doodleStrictEth.preferredPayment,
                            doodleStrictEth.price,
                            doodleStrictEth.isStrictPayment
                        );
                        await listNft(
                            doodleStrictWeth.tokenAddress,
                            doodleStrictWeth.tokenId,
                            doodleStrictWeth.preferredPayment,
                            doodleStrictWeth.price,
                            doodleStrictWeth.isStrictPayment
                        );
                        await listNft(
                            doodleStrictDai.tokenAddress,
                            doodleStrictDai.tokenId,
                            doodleStrictDai.preferredPayment,
                            doodleStrictDai.price,
                            doodleStrictDai.isStrictPayment
                        );
                        await listNft(
                            doodleStrictLink.tokenAddress,
                            doodleStrictLink.tokenId,
                            doodleStrictLink.preferredPayment,
                            doodleStrictLink.price,
                            doodleStrictLink.isStrictPayment
                        );
                        await listNft(
                            doodleStrictUni.tokenAddress,
                            doodleStrictUni.tokenId,
                            doodleStrictUni.preferredPayment,
                            doodleStrictUni.price,
                            doodleStrictUni.isStrictPayment
                        );
                        await listNft(
                            doodleStrictWbtc.tokenAddress,
                            doodleStrictWbtc.tokenId,
                            doodleStrictWbtc.preferredPayment,
                            doodleStrictWbtc.price,
                            doodleStrictWbtc.isStrictPayment
                        );
                        await listNft(
                            doodleNonStrictEth.tokenAddress,
                            doodleNonStrictEth.tokenId,
                            doodleNonStrictEth.preferredPayment,
                            doodleNonStrictEth.price,
                            doodleNonStrictEth.isStrictPayment
                        );
                        await listNft(
                            doodleNonStrictWeth.tokenAddress,
                            doodleNonStrictWeth.tokenId,
                            doodleNonStrictWeth.preferredPayment,
                            doodleNonStrictWeth.price,
                            doodleNonStrictWeth.isStrictPayment
                        );
                        await listNft(
                            doodleNonStrictUsdc.tokenAddress,
                            doodleNonStrictUsdc.tokenId,
                            doodleNonStrictUsdc.preferredPayment,
                            doodleNonStrictUsdc.price,
                            doodleNonStrictUsdc.isStrictPayment
                        );
                        await listNft(
                            doodleNonStrictDai.tokenAddress,
                            doodleNonStrictDai.tokenId,
                            doodleNonStrictDai.preferredPayment,
                            doodleNonStrictDai.price,
                            doodleNonStrictDai.isStrictPayment
                        );
                        await listNft(
                            doodleNonStrictLink.tokenAddress,
                            doodleNonStrictLink.tokenId,
                            doodleNonStrictLink.preferredPayment,
                            doodleNonStrictLink.price,
                            doodleNonStrictLink.isStrictPayment
                        );
                        await listNft(
                            doodleNonStrictUni.tokenAddress,
                            doodleNonStrictUni.tokenId,
                            doodleNonStrictUni.preferredPayment,
                            doodleNonStrictUni.price,
                            doodleNonStrictUni.isStrictPayment
                        );
                        await listNft(
                            doodleNonStrictWbtc.tokenAddress,
                            doodleNonStrictWbtc.tokenId,
                            doodleNonStrictWbtc.preferredPayment,
                            doodleNonStrictWbtc.price,
                            doodleNonStrictWbtc.isStrictPayment
                        );
                    });

                    describe("Strict payment", () => {
                        describe("ETH", () => {
                            it("Should revert when not enough sent", async () => {
                                const buyer = deployer;
                                const targetToken = doodleStrictEth;
                                const buyerPayment = zeroAddress;

                                const value = BigInt(1e18);
                                await expect(
                                    NftMarketplace.connect(buyer).buyToken(
                                        targetToken.tokenAddress,
                                        targetToken.tokenId,
                                        buyerPayment,
                                        { value: value }
                                    )
                                )
                                    .to.be.revertedWithCustomError(
                                        NftMarketplace,
                                        "NftMarketplace__InvalidPayment"
                                    )
                                    .withArgs(
                                        buyerPayment,
                                        buyer.address,
                                        targetToken.price
                                    );
                            });
                        });
                        describe("wETH", () => {
                            it("Should revert when buyer does have enough", async () => {
                                const buyer = wEthValidAccount;
                                const targetToken = doodleStrictWeth;
                                const buyerPayment = wEthAddress;

                                await expect(
                                    NftMarketplace.connect(buyer).buyToken(
                                        targetToken.tokenAddress,
                                        targetToken.tokenId,
                                        buyerPayment
                                    )
                                )
                                    .to.be.revertedWithCustomError(
                                        NftMarketplace,
                                        "NftMarketplace__InvalidPayment"
                                    )
                                    .withArgs(
                                        buyerPayment,
                                        buyer.address,
                                        targetToken.price
                                    );
                            });
                        });
                        describe("USDC", () => {
                            it("Should revert when buyer does have enough", async () => {
                                const buyer = wBtcValidAccount;
                                const targetToken = doodleStrictUsdc;
                                const buyerPayment = usdcAddress;

                                await expect(
                                    NftMarketplace.connect(buyer).buyToken(
                                        targetToken.tokenAddress,
                                        targetToken.tokenId,
                                        buyerPayment
                                    )
                                )
                                    .to.be.revertedWithCustomError(
                                        NftMarketplace,
                                        "NftMarketplace__InvalidPayment"
                                    )
                                    .withArgs(
                                        buyerPayment,
                                        buyer.address,
                                        targetToken.price
                                    );
                            });
                        });
                        describe("DAI", () => {
                            it("Should revert when buyer does have enough", async () => {
                                const buyer = daiValidAccount;
                                const targetToken = doodleStrictDai;
                                const buyerPayment = daiAddress;

                                await expect(
                                    NftMarketplace.connect(buyer).buyToken(
                                        targetToken.tokenAddress,
                                        targetToken.tokenId,
                                        buyerPayment
                                    )
                                )
                                    .to.be.revertedWithCustomError(
                                        NftMarketplace,
                                        "NftMarketplace__InvalidPayment"
                                    )
                                    .withArgs(
                                        buyerPayment,
                                        buyer.address,
                                        targetToken.price
                                    );
                            });
                        });
                        describe("LINK", () => {
                            it("Should revert when buyer does have enough", async () => {
                                const buyer = linkValidAccount;
                                const targetToken = doodleStrictLink;
                                const buyerPayment = linkAddress;

                                await expect(
                                    NftMarketplace.connect(buyer).buyToken(
                                        targetToken.tokenAddress,
                                        targetToken.tokenId,
                                        buyerPayment
                                    )
                                )
                                    .to.be.revertedWithCustomError(
                                        NftMarketplace,
                                        "NftMarketplace__InvalidPayment"
                                    )
                                    .withArgs(
                                        buyerPayment,
                                        buyer.address,
                                        targetToken.price
                                    );
                            });
                        });
                        describe("UNI", () => {
                            it("Should revert when buyer does have enough", async () => {
                                const buyer = uniValidAccount;
                                const targetToken = doodleStrictUni;
                                const buyerPayment = uniAddress;

                                await expect(
                                    NftMarketplace.connect(buyer).buyToken(
                                        targetToken.tokenAddress,
                                        targetToken.tokenId,
                                        buyerPayment
                                    )
                                )
                                    .to.be.revertedWithCustomError(
                                        NftMarketplace,
                                        "NftMarketplace__InvalidPayment"
                                    )
                                    .withArgs(
                                        buyerPayment,
                                        buyer.address,
                                        targetToken.price
                                    );
                            });
                        });
                        describe("wBTC", () => {
                            it("Should revert when buyer does have enough", async () => {
                                const buyer = wBtcValidAccount;
                                const targetToken = doodleStrictWbtc;
                                const buyerPayment = wBtcAddress;

                                await expect(
                                    NftMarketplace.connect(buyer).buyToken(
                                        targetToken.tokenAddress,
                                        targetToken.tokenId,
                                        buyerPayment
                                    )
                                )
                                    .to.be.revertedWithCustomError(
                                        NftMarketplace,
                                        "NftMarketplace__InvalidPayment"
                                    )
                                    .withArgs(
                                        buyerPayment,
                                        buyer.address,
                                        targetToken.price
                                    );
                            });
                        });
                    });
                    describe("Non-strict payment", () => {
                        describe("Preferring ETH", () => {
                            describe("Supplying ETH", () => {
                                it("Should revert if not enough sent", async () => {
                                    const buyer = deployer;
                                    const targetToken = doodleNonStrictEth;
                                    const buyerPayment = zeroAddress;

                                    const value = BigInt(1e18);
                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment,
                                            { value: value }
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying wETH", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wEthValidAccount;
                                    const targetToken = doodleNonStrictEth;
                                    const buyerPayment = wEthAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying USDC", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wBtcValidAccount;
                                    const targetToken = doodleNonStrictEth;
                                    const buyerPayment = usdcAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying DAI", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = daiValidAccount;
                                    const targetToken = doodleNonStrictEth;
                                    const buyerPayment = daiAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying LINK", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = linkValidAccount;
                                    const targetToken = doodleNonStrictEth;
                                    const buyerPayment = linkAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying UNI", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = uniValidAccount;
                                    const targetToken = doodleNonStrictEth;
                                    const buyerPayment = uniAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying wBTC", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wBtcValidAccount;
                                    const targetToken = doodleNonStrictEth;
                                    const buyerPayment = wBtcAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                        });
                        describe("Preferring wETH", () => {
                            describe("Supplying ETH", () => {
                                it("Should revert if not enough sent", async () => {
                                    const buyer = deployer;
                                    const targetToken = doodleNonStrictWeth;
                                    const buyerPayment = zeroAddress;

                                    const value = BigInt(1e18);
                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment,
                                            { value: value }
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying wETH", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wEthValidAccount;
                                    const targetToken = doodleNonStrictWeth;
                                    const buyerPayment = wEthAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying USDC", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wBtcValidAccount;
                                    const targetToken = doodleNonStrictWeth;
                                    const buyerPayment = usdcAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying DAI", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = daiValidAccount;
                                    const targetToken = doodleNonStrictWeth;
                                    const buyerPayment = daiAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying LINK", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = linkValidAccount;
                                    const targetToken = doodleNonStrictWeth;
                                    const buyerPayment = linkAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying UNI", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = uniValidAccount;
                                    const targetToken = doodleNonStrictWeth;
                                    const buyerPayment = uniAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying wBTC", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wBtcValidAccount;
                                    const targetToken = doodleNonStrictWeth;
                                    const buyerPayment = wBtcAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                        });
                        describe("Preferring USDC", () => {
                            describe("Supplying ETH", () => {
                                it("Should revert if not enough sent", async () => {
                                    const buyer = deployer;
                                    const targetToken = doodleNonStrictUsdc;
                                    const buyerPayment = zeroAddress;

                                    const value = BigInt(1e18);
                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment,
                                            { value: value }
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying wETH", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wEthValidAccount;
                                    const targetToken = doodleNonStrictUsdc;
                                    const buyerPayment = wEthAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying USDC", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wBtcValidAccount;
                                    const targetToken = doodleNonStrictUsdc;
                                    const buyerPayment = usdcAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying DAI", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = daiValidAccount;
                                    const targetToken = doodleNonStrictUsdc;
                                    const buyerPayment = daiAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying LINK", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = linkValidAccount;
                                    const targetToken = doodleNonStrictUsdc;
                                    const buyerPayment = linkAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying UNI", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = uniValidAccount;
                                    const targetToken = doodleNonStrictUsdc;
                                    const buyerPayment = uniAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying wBTC", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wBtcValidAccount;
                                    const targetToken = doodleNonStrictUsdc;
                                    const buyerPayment = wBtcAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                        });
                        describe("Preferring DAI", () => {
                            describe("Supplying ETH", () => {
                                it("Should revert if not enough sent", async () => {
                                    const buyer = deployer;
                                    const targetToken = doodleNonStrictDai;
                                    const buyerPayment = zeroAddress;

                                    const value = BigInt(1e18);
                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment,
                                            { value: value }
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying wETH", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wEthValidAccount;
                                    const targetToken = doodleNonStrictDai;
                                    const buyerPayment = wEthAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying USDC", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wBtcValidAccount;
                                    const targetToken = doodleNonStrictDai;
                                    const buyerPayment = usdcAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying DAI", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = daiValidAccount;
                                    const targetToken = doodleNonStrictDai;
                                    const buyerPayment = daiAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying LINK", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = linkValidAccount;
                                    const targetToken = doodleNonStrictDai;
                                    const buyerPayment = linkAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying UNI", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = uniValidAccount;
                                    const targetToken = doodleNonStrictDai;
                                    const buyerPayment = uniAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying wBTC", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wBtcValidAccount;
                                    const targetToken = doodleNonStrictDai;
                                    const buyerPayment = wBtcAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                        });
                        describe("Preferring LINK", () => {
                            describe("Supplying ETH", () => {
                                it("Should revert if not enough sent", async () => {
                                    const buyer = deployer;
                                    const targetToken = doodleNonStrictLink;
                                    const buyerPayment = zeroAddress;

                                    const value = BigInt(1e18);
                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment,
                                            { value: value }
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying wETH", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wEthValidAccount;
                                    const targetToken = doodleNonStrictLink;
                                    const buyerPayment = wEthAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying USDC", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wBtcValidAccount;
                                    const targetToken = doodleNonStrictLink;
                                    const buyerPayment = usdcAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying DAI", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = daiValidAccount;
                                    const targetToken = doodleNonStrictLink;
                                    const buyerPayment = daiAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying LINK", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = linkValidAccount;
                                    const targetToken = doodleNonStrictLink;
                                    const buyerPayment = linkAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying UNI", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = uniValidAccount;
                                    const targetToken = doodleNonStrictLink;
                                    const buyerPayment = uniAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying wBTC", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wBtcValidAccount;
                                    const targetToken = doodleNonStrictLink;
                                    const buyerPayment = wBtcAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                        });
                        describe("Preferring UNI", () => {
                            describe("Supplying ETH", () => {
                                it("Should revert if not enough sent", async () => {
                                    const buyer = deployer;
                                    const targetToken = doodleNonStrictUni;
                                    const buyerPayment = zeroAddress;

                                    const value = BigInt(1e18);
                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment,
                                            { value: value }
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying wETH", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wEthValidAccount;
                                    const targetToken = doodleNonStrictUni;
                                    const buyerPayment = wEthAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying USDC", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wBtcValidAccount;
                                    const targetToken = doodleNonStrictUni;
                                    const buyerPayment = usdcAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying DAI", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = daiValidAccount;
                                    const targetToken = doodleNonStrictUni;
                                    const buyerPayment = daiAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying LINK", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = linkValidAccount;
                                    const targetToken = doodleNonStrictUni;
                                    const buyerPayment = linkAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying UNI", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = uniValidAccount;
                                    const targetToken = doodleNonStrictUni;
                                    const buyerPayment = uniAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying wBTC", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wBtcValidAccount;
                                    const targetToken = doodleNonStrictUni;
                                    const buyerPayment = wBtcAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                        });
                        describe("Preferring wBTC", () => {
                            describe("Supplying ETH", () => {
                                it("Should revert if not enough sent", async () => {
                                    const buyer = deployer;
                                    const targetToken = doodleNonStrictWbtc;
                                    const buyerPayment = zeroAddress;

                                    const value = BigInt(1e18);
                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment,
                                            { value: value }
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying wETH", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wEthValidAccount;
                                    const targetToken = doodleNonStrictWbtc;
                                    const buyerPayment = wEthAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying USDC", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wBtcValidAccount;
                                    const targetToken = doodleNonStrictWbtc;
                                    const buyerPayment = usdcAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying DAI", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = daiValidAccount;
                                    const targetToken = doodleNonStrictWbtc;
                                    const buyerPayment = daiAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying LINK", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = linkValidAccount;
                                    const targetToken = doodleNonStrictWbtc;
                                    const buyerPayment = linkAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying UNI", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = uniValidAccount;
                                    const targetToken = doodleNonStrictWbtc;
                                    const buyerPayment = uniAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                            describe("Supplying wBTC", () => {
                                it("Should revert when buyer does not have enough", async () => {
                                    const buyer = wBtcValidAccount;
                                    const targetToken = doodleNonStrictWbtc;
                                    const buyerPayment = wBtcAddress;

                                    await expect(
                                        NftMarketplace.connect(buyer).buyToken(
                                            targetToken.tokenAddress,
                                            targetToken.tokenId,
                                            buyerPayment
                                        )
                                    )
                                        .to.be.revertedWithCustomError(
                                            NftMarketplace,
                                            "NftMarketplace__InvalidPayment"
                                        )
                                        .withArgs(
                                            buyerPayment,
                                            buyer.address,
                                            targetToken.price
                                        );
                                });
                            });
                        });
                    });
                });
            });
        });
        describe("Withdrawing", () => {});
    });
});
