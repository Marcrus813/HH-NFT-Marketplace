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
    });

    describe("Tool functions", () => {
        let NftMarketplaceByDeployer;

        beforeEach(async () => {
            NftMarketplaceByDeployer = await NftMarketplace.connect(deployer);
        });

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
                await supplyTokensToAccounts();
            });
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
        let NftMarketplaceByDeployer;

        beforeEach(async () => {
            NftMarketplaceByDeployer = await NftMarketplace.connect(deployer);
        });

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

    describe("Listing", () => {
        let doodlesTokens, boredApeYachtClubTokens, lilPudgysTokens;

        let doodleAddress;
        let boredApeYachtClubAddress;
        let lilPudgysAddress;

        let doodleHolder;
        let boredApeYachtClubHolder;
        let lilPudgysHolder;

        let NftMarketplaceByDoodleHolder;
        let NftMarketplaceByBaycHolder;
        let NftMarketplaceBylilPudgysHolder;

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
            NftMarketplaceBylilPudgysHolder =
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
                        "NftMarketplace__NotListedByOwner"
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
            let tokenAddress,
                token,
                tokenId,
                tokenOwner,
                preferredPayment,
                price,
                isStrictPayment;

            async function listNft(
                _tokenAddress,
                _tokenId,
                _preferredPayment,
                _price,
                _isStrictPayment
            ) {
                const listTxn = await NftMarketplaceByDoodleHolder.listNft(
                    _tokenAddress,
                    _tokenId,
                    _preferredPayment,
                    _price,
                    _isStrictPayment
                );

                await listTxn.wait();
            }

            beforeEach(async () => {
                tokenAddress = doodleAddress;
                token = doodlesTokens[0];
                tokenId = token.id;
                tokenOwner = doodleHolder;
                preferredPayment = zeroAddress;
                price = ethers.parseEther("1");
                isStrictPayment = true;

                await approveNft(
                    tokenAddress,
                    tokenOwner.address,
                    NftMarketplaceAddress,
                    tokenId
                );
            });
            it("Should update `s_listingMap`", async () => {
                await listNft(
                    tokenAddress,
                    tokenId,
                    preferredPayment,
                    price,
                    isStrictPayment
                );

                const updatedListing =
                    await NftMarketplaceByDoodleHolder.getListingInfo(
                        tokenAddress,
                        tokenId
                    );

                const listedPayment = updatedListing.preferredPayment;
                const listedPrice = updatedListing.price;
                const listedStrictPayment = updatedListing.strictPayment;
                const listedSeller = updatedListing.seller;

                expect(listedPayment).to.be.equals(preferredPayment);
                expect(listedPrice).to.be.equals(ethers.parseEther("1"));
                expect(listedStrictPayment).to.be.true;
                expect(listedSeller).to.be.equals(doodleHolder.address);
            });
            it("Should update `s_activeListings`", async () => {
                const activeListingsBefore =
                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                const activeListingLengthBefore = activeListingsBefore.length;

                await listNft(
                    tokenAddress,
                    tokenId,
                    preferredPayment,
                    price,
                    isStrictPayment
                );

                const activeListingsAfter =
                    await NftMarketplaceByDoodleHolder.getActiveListingKeys();
                const activeListingLengthAfter = activeListingsAfter.length;
                const latestActiveListingKey =
                    activeListingsAfter[activeListingLengthAfter - 1];

                const listingKeyAddress = latestActiveListingKey.nftAddress;
                const listingKeyId = latestActiveListingKey.tokenId;

                expect(activeListingLengthAfter).to.be.equals(
                    activeListingLengthBefore + 1
                );
                expect(listingKeyAddress).to.be.equals(tokenAddress);
                expect(listingKeyId).to.be.equals(tokenId);
            });
        });
    });
    describe("Buying", () => {});
    describe("Withdrawing", () => {});
});
