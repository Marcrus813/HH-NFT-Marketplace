// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/math/SignedMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "hardhat/console.sol";

    error NftMarketplace__PriceIsZero();
    error NftMarketplace__NotApprovedForMarketplace(
        address nftAddress,
        uint256 tokenId
    );
    error NftMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
    error NftMarketplace__NotOperatedByOwner(
        address nftAddress,
        uint256 tokenId,
        address sender
    );
    error NftMarketplace__TokenNotListed(address nftAddress, uint256 tokenId);

    error NftMarketplace__UpdateNotNeeded(
        address nftAddress,
        uint256 tokenId,
        address oldPreferredPayment,
        uint256 oldPrice,
        bool oldStrictPayment
    );

    error NftMarketplace__BuyingYourOwnToken(
        address nftAddress,
        uint256 tokenId,
        address seller
    );

    error NftMarketplace__InvalidPayment(
        address paymentToken,
        address buyer,
        uint256 price
    );
    error NftMarketplace__PaymentNotAccepted(
        address nftAddress,
        uint256 tokenId,
        address paymentToken
    );
    error NftMarketplace__PaymentNotSupported(address paymentToken);

    error NftMarketplace__NothingToWithdraw(address supplier);

    error NftMarketplace__TransferFailed(address supplier, address token);

contract NftMarketplace is ReentrancyGuard {
    using SignedMath for uint256;
    using SignedMath for int256;

    /*- `listNft`: List the NFT on the marketplace
    - `buyNft`: Buy
    - `cancelNft`: Cancel listing
    - `updateListing`: Update price
    - `WithdrawProceeds`: When sold, market holds funds, then withdraw*/
    address private constant WETH_ADDRESS =
    0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address[] private s_supportedPayments;
    mapping(address => address) private s_priceFeeds;

    /// @dev Price in ETH
    struct Listing {
        address preferredPayment;
        uint256 price;
        bool strictPayment;
        address seller;
    }

    struct ListingKey {
        address nftAddress;
        uint256 tokenId;
    }

    // NFT contract address => tokenId => Listing(Will contain price, seller)
    mapping(address => mapping(uint256 => Listing)) private s_listingMap;
    ListingKey[] private s_activeListings;
    // NFT contract address => tokenId => Index in listing key array + 1
    /**
     * Reason for +1:
     *     - 0 means not listed, but default value is 0, so if we store the first index 0, it will be confused with not listed
     *     - So we add +1 to the index, so that 0 means not listed and 1 means first index
     */
    mapping(address => mapping(uint256 => uint256))
    private s_listingPaddedIndex;

    // Seller address => Token address => amount
    mapping(address => mapping(address => uint256)) private s_proceeds;

    event TokenListed(
        address indexed tokenAddress,
        uint256 indexed tokenId,
        address indexed seller,
        address preferredPayment,
        uint256 price,
        bool strictPayment
    );

    event TokenBought(
        address indexed buyer,
        address indexed tokenAddress,
        uint256 indexed tokenId,
        address usedPayment,
        uint256 paymentAmount
    );

    event ListingUpdated(
        address indexed tokenAddress,
        uint256 indexed tokenId,
        address indexed seller,
        address preferredPayment,
        uint256 price,
        bool strictPayment
    );

    event ListingCancelled(
        address indexed seller,
        address indexed tokenAddress,
        uint256 indexed tokenId
    );

    event ProceedsWithdrawn(
        address indexed supplier,
        address indexed token,
        uint256 amount
    );

    constructor(address[] memory supportedPayments) {
        s_supportedPayments = supportedPayments;
        s_supportedPayments.push(WETH_ADDRESS); // WETH
        for (uint i = 0; i < supportedPayments.length; i++) {
            address tokenAddress = supportedPayments[i];
            address tokenPriceFeed = initializePriceFeed(tokenAddress);
            s_priceFeeds[tokenAddress] = tokenPriceFeed;
        }
    }

    modifier paymentSupported(address paymentToken) {
        if (paymentToken == address(0) || paymentToken == WETH_ADDRESS) {
            // ETH & wETH
            _;
        } else {
            address priceFeedAddress = s_priceFeeds[paymentToken];
            if (priceFeedAddress == address(0)) {
                revert NftMarketplace__PaymentNotSupported(paymentToken);
            }
            _;
        }
    }

    modifier priceNotZero(uint256 price) {
        if (price == 0) {
            revert NftMarketplace__PriceIsZero();
        }
        _;
    }

    modifier notYetListed(address nftAddress, uint256 tokenId) {
        uint256 paddedIndex = s_listingPaddedIndex[nftAddress][tokenId];
        if (paddedIndex != 0) {
            revert NftMarketplace__AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    modifier onlyTokenOwner(
        address nftAddress,
        uint256 tokenId,
        address sender
    ) {
        IERC721 nft = IERC721(nftAddress);
        if (nft.ownerOf(tokenId) != sender) {
            revert NftMarketplace__NotOperatedByOwner(
                nftAddress,
                tokenId,
                sender
            );
        }
        _;
    }

    // Functionalities

    /// Exposed call to list an NFT on the marketplace
    /// @param nftAddress Address of NFT contract
    /// @param tokenId ID of the token being listed
    /// @param price Price of the token being listed
    /// @dev Using approve the marketplace instead of transferring the token
    function listNft(
        address nftAddress,
        uint256 tokenId,
        address preferredPayment,
        uint256 price,
        bool strictPayment
    )
    external
    paymentSupported(preferredPayment)
    priceNotZero(price)
    notYetListed(nftAddress, tokenId)
    onlyTokenOwner(nftAddress, tokenId, msg.sender)
    {
        // How to list?
        // 1. Transfer to the marketplace as new owner: gas expensive
        // 2. Give marketplace approval to sell
        //      use `getApproved` to check

        // Get my token instance
        IERC721 nft = IERC721(nftAddress);
        if (nft.getApproved(tokenId) != address(this)) {
            // Check if marketplace is approved
            revert NftMarketplace__NotApprovedForMarketplace(
                nftAddress,
                tokenId
            );
        }
        s_listingMap[nftAddress][tokenId] = Listing(
            preferredPayment,
            price,
            strictPayment,
            msg.sender
        );

        s_activeListings.push(ListingKey(nftAddress, tokenId));
        s_listingPaddedIndex[nftAddress][tokenId] = s_activeListings.length;

        emit TokenListed(
            nftAddress,
            tokenId,
            msg.sender,
            preferredPayment,
            price,
            strictPayment
        );
    }

    function removeListing(address nftAddress, uint256 tokenId) internal {
        uint256 paddedIndex = s_listingPaddedIndex[nftAddress][tokenId];
        require(
            paddedIndex != 0,
            NftMarketplace__TokenNotListed(nftAddress, tokenId)
        );
        uint256 index = paddedIndex - 1;

        uint256 lastIndex = s_activeListings.length - 1;
        if (index != lastIndex) {
            // Not removing the last, so can't pop, need to swap first
            ListingKey memory lastListing = s_activeListings[lastIndex];
            s_activeListings[index] = lastListing;
            s_listingPaddedIndex[lastListing.nftAddress][
            lastListing.tokenId
            ] = paddedIndex;
        }

        s_activeListings.pop();

        delete s_listingPaddedIndex[nftAddress][tokenId];
        delete s_listingMap[nftAddress][tokenId];
    }

    function convertToEth(
        ERC20 paymentToken,
        uint256 amount
    ) public view returns (uint256 result) {
        bool isPaymentSupported = checkPaymentSupport(address(paymentToken));
        if (!isPaymentSupported) {
            revert NftMarketplace__PaymentNotSupported(address(paymentToken));
        }
        if (address(paymentToken) != WETH_ADDRESS) {
            AggregatorV3Interface priceFeed = AggregatorV3Interface(
                s_priceFeeds[address(paymentToken)]
            );
            (, int256 answer, , ,) = priceFeed.latestRoundData();
            uint8 tokenDecimals = paymentToken.decimals();
            uint8 feedDecimals = priceFeed.decimals();

            uint256 scaledAmount = uint256(answer) * amount;

            /**
             * (scaledAmount * 1e18): Result in wei
             * Then normalize against both token and feed decimals
             */
            result =
                (scaledAmount * 1e18) /
                (10 ** (tokenDecimals + feedDecimals));
        } else {
            result = amount;
        }
    }

    function convertFromEth(
        ERC20 targetToken,
        uint256 ethAmount
    ) public view returns (uint256 result) {
        bool isPaymentSupported = checkPaymentSupport(address(targetToken));
        if (!isPaymentSupported) {
            revert NftMarketplace__PaymentNotSupported(address(targetToken));
        }

        if (address(targetToken) != WETH_ADDRESS) {
            AggregatorV3Interface priceFeed = AggregatorV3Interface(
                s_priceFeeds[address(targetToken)]
            );
            (, int256 answer, , ,) = priceFeed.latestRoundData();

            uint8 tokenDecimals = targetToken.decimals();
            uint8 feedDecimals = priceFeed.decimals();

            /**
             * (answer * 1e18): Token normalized by eth decimals
             * Then normalize against both token and feed decimals
             */
            result =
                (ethAmount * 10 ** (tokenDecimals + feedDecimals)) /
                (uint256(answer) * 1e18);
        } else {
            result = ethAmount;
        }
    }

    modifier tokenIsListed(address nftAddress, uint256 tokenId) {
        uint256 paddedIndex = s_listingPaddedIndex[nftAddress][tokenId];
        if (paddedIndex == 0) {
            revert NftMarketplace__TokenNotListed(nftAddress, tokenId);
        }
        _;
    }

    modifier strictPaymentChecked(
        address nftAddress,
        uint256 tokenId,
        address paymentToken
    ) {
        bool strictPayment = s_listingMap[nftAddress][tokenId].strictPayment;
        if (!strictPayment) {
            _;
        } else {
            if (
                paymentToken !=
                s_listingMap[nftAddress][tokenId].preferredPayment
            ) {
                revert NftMarketplace__PaymentNotAccepted(
                    nftAddress,
                    tokenId,
                    paymentToken
                );
            } else {
                _;
            }
        }
    }

    /**
     *
     * @param msgValue The amount sent when buying, msg.value
     * @param strictPayment The strict payment tag of the token
     * @param paymentToken The token provided by buyer
     * @param preferredToken The preferred token of the listing
     * @param price The price of the token
     * @return result True if the payment is valid, false otherwise
     * @dev This is used after `strictPaymentChecked` modifier, so if strict payment, then the tokens are matched
     */
    function verifyPayment(
        address buyer,
        uint256 msgValue,
        bool strictPayment,
        address paymentToken,
        address preferredToken,
        uint256 price
    ) public view returns (bool result) {
        ERC20 paymentTokenInstance;
        ERC20 preferredTokenInstance;

        bool paymentMatch = paymentToken == preferredToken;

        if (strictPayment) {
            if (paymentToken == address(0)) {
                // ETH
                if (msgValue < price) {
                    result = false;
                } else {
                    result = true;
                }
            } else {
                // ERC20
                paymentTokenInstance = ERC20(paymentToken);
                uint256 allowance = paymentTokenInstance.allowance(
                    buyer,
                    address(this)
                );
                uint256 buyerBalance = paymentTokenInstance.balanceOf(buyer);
                if (allowance < price || buyerBalance < price) {
                    result = false;
                } else {
                    result = true;
                }
            }
        } else {
            if (paymentToken == address(0)) {
                if (paymentMatch) {
                    if (msgValue < price) {
                        result = false;
                    } else {
                        result = true;
                    }
                } else {
                    preferredTokenInstance = ERC20(preferredToken);
                    uint256 convertedValue = convertToEth(
                        preferredTokenInstance,
                        price
                    );
                    if (msgValue < convertedValue) {
                        result = false;
                    } else {
                        result = true;
                    }
                }
            } else {
                // ERC20
                if (paymentMatch) {
                    paymentTokenInstance = ERC20(paymentToken);
                    uint256 allowance = paymentTokenInstance.allowance(
                        buyer,
                        address(this)
                    );
                    uint256 buyerBalance = paymentTokenInstance.balanceOf(
                        buyer
                    );
                    if (allowance < price || buyerBalance < price) {
                        result = false;
                    } else {
                        result = true;
                    }
                } else {
                    if (preferredToken != address(0)) {
                        // Not ETH
                        preferredTokenInstance = ERC20(preferredToken);
                        uint256 expectedEthAmount = convertToEth(
                            preferredTokenInstance,
                            price
                        );

                        paymentTokenInstance = ERC20(paymentToken);
                        uint256 expectedPaymentAmount = convertFromEth(
                            paymentTokenInstance,
                            expectedEthAmount
                        );

                        uint256 allowance = paymentTokenInstance.allowance(
                            buyer,
                            address(this)
                        );
                        uint256 buyerBalance = paymentTokenInstance.balanceOf(
                            buyer
                        );
                        if (
                            allowance < expectedPaymentAmount ||
                            buyerBalance < expectedPaymentAmount
                        ) {
                            result = false;
                        } else {
                            result = true;
                        }
                    } else {
                        // ETH
                        paymentTokenInstance = ERC20(paymentToken);
                        uint256 expectedPaymentAmount = convertFromEth(
                            paymentTokenInstance,
                            price
                        );

                        uint256 allowance = paymentTokenInstance.allowance(
                            buyer,
                            address(this)
                        );
                        uint256 buyerBalance = paymentTokenInstance.balanceOf(
                            buyer
                        );
                        if (
                            allowance < expectedPaymentAmount ||
                            buyerBalance < expectedPaymentAmount
                        ) {
                            result = false;
                        } else {
                            result = true;
                        }
                    }
                }
            }
        }
    }

    function checkPaymentSupport(
        address tokenAddress
    ) public view returns (bool result) {
        if (tokenAddress == WETH_ADDRESS || tokenAddress == address(0)) {
            result = true;
        } else {
            address priceFeedAddress = s_priceFeeds[tokenAddress];
            result = priceFeedAddress != address(0);
        }
    }

    function buyToken(
        address nftAddress,
        uint256 tokenId,
        address paymentToken
    )
    external
    payable
    nonReentrant
    tokenIsListed(nftAddress, tokenId)
    paymentSupported(paymentToken)
    strictPaymentChecked(nftAddress, tokenId, paymentToken)
    {
        Listing memory listing = s_listingMap[nftAddress][tokenId];

        address seller = listing.seller;
        if (seller == msg.sender) {
            revert NftMarketplace__BuyingYourOwnToken(
                nftAddress,
                tokenId,
                seller
            );
        }

        address preferredPayment = listing.preferredPayment;
        uint256 nftPrice = listing.price;
        bool strictPayment = listing.strictPayment;
        bool paymentMatch = paymentToken == preferredPayment;

        bool isPaymentValid = verifyPayment(
            msg.sender,
            msg.value,
            strictPayment,
            paymentToken,
            preferredPayment,
            nftPrice
        );
        if (!isPaymentValid) {
            revert NftMarketplace__InvalidPayment(
                paymentToken,
                msg.sender,
                nftPrice
            );
        }

        uint256 paymentAmount;

        ERC20 paymentTokenInstance;
        ERC20 preferredTokenInstance;

        if (strictPayment || paymentMatch) {
            if (paymentToken == address(0)) {
                // ETH
                s_proceeds[listing.seller][address(0)] += msg.value;
                paymentAmount = msg.value;
            } else {
                // ERC20
                paymentTokenInstance = ERC20(paymentToken);
                paymentTokenInstance.transferFrom(
                    msg.sender,
                    address(this),
                    nftPrice
                );

                s_proceeds[listing.seller][paymentToken] += nftPrice;
                paymentAmount = nftPrice;
            }
        } else {
            if (paymentToken == address(0)) {
                s_proceeds[listing.seller][address(0)] += msg.value;
                paymentAmount = msg.value;
            } else {
                preferredTokenInstance = ERC20(preferredPayment);
                uint256 convertedValue = convertToEth(
                    preferredTokenInstance,
                    nftPrice
                );

                paymentTokenInstance = ERC20(paymentToken);
                uint256 expectedPaymentAmount = convertFromEth(
                    paymentTokenInstance,
                    convertedValue
                );
                paymentTokenInstance.transferFrom(
                    msg.sender,
                    address(this),
                    expectedPaymentAmount
                );

                s_proceeds[listing.seller][address(0)] += convertedValue;
                paymentAmount = expectedPaymentAmount;
            }
        }

        removeListing(nftAddress, tokenId);
        IERC721(nftAddress).safeTransferFrom(
            listing.seller,
            msg.sender,
            tokenId
        );

        emit TokenBought(
            msg.sender,
            nftAddress,
            tokenId,
            paymentToken,
            paymentAmount
        );
    }

    function cancelListing(
        address nftAddress,
        uint256 tokenId
    )
    external
    onlyTokenOwner(nftAddress, tokenId, msg.sender)
    tokenIsListed(nftAddress, tokenId)
    {
        removeListing(nftAddress, tokenId);
        emit ListingCancelled(msg.sender, nftAddress, tokenId);
    }

    function updateListing(
        address nftAddress,
        uint256 tokenId,
        address preferredPayment,
        uint256 price,
        bool strictPayment
    )
    external
    onlyTokenOwner(nftAddress, tokenId, msg.sender)
    tokenIsListed(nftAddress, tokenId)
    paymentSupported(preferredPayment)
    priceNotZero(price)
    {
        Listing memory listing = s_listingMap[nftAddress][tokenId];
        bool updateNeeded;
        if (
            listing.preferredPayment != preferredPayment ||
            listing.price != price ||
            listing.strictPayment != strictPayment
        ) {
            updateNeeded = true;
        } else {
            updateNeeded = false;
        }
        if (updateNeeded) {
            listing.preferredPayment = preferredPayment;
            listing.price = price;
            listing.strictPayment = strictPayment;
            s_listingMap[nftAddress][tokenId] = listing;
            emit ListingUpdated(
                nftAddress,
                tokenId,
                msg.sender,
                preferredPayment,
                price,
                strictPayment
            );
        } else {
            revert NftMarketplace__UpdateNotNeeded(
                nftAddress,
                tokenId,
                listing.preferredPayment,
                listing.price,
                listing.strictPayment
            );
        }
    }

    /**
     * Withdraw all proceeds
     */
    function withdrawProceeds() external nonReentrant {
        address supplier = msg.sender;
        bool hasProceeds;
        for (uint256 i = 0; i < s_supportedPayments.length; i++) {
            address token = s_supportedPayments[i];
            uint256 proceeds = s_proceeds[supplier][token];
            if (proceeds <= 0) {
                hasProceeds = true;
                s_proceeds[supplier][token] = 0;
                IERC20(token).transfer(supplier, proceeds);
                emit ProceedsWithdrawn(supplier, token, proceeds);
            } else {
                continue;
            }
        }

        uint256 ethProceeds = s_proceeds[supplier][address(0)];
        if (ethProceeds > 0) {
            s_proceeds[supplier][address(0)] = 0;
            (bool success,) = payable(supplier).call{value: ethProceeds}("");
            require(
                success,
                NftMarketplace__TransferFailed(supplier, address(0))
            );
            emit ProceedsWithdrawn(supplier, address(0), ethProceeds);
        } else if (!hasProceeds) {
            revert NftMarketplace__NothingToWithdraw(supplier);
        }
    }

    /**
     * Withdraw specific token proceeds
     * @param token The token to withdraw
     */
    function withdrawProceeds(address token) external nonReentrant {
        address supplier = msg.sender;
        uint256 proceeds = s_proceeds[supplier][token];
        if (proceeds <= 0) {
            revert NftMarketplace__NothingToWithdraw(supplier);
        } else {
            if (token == address(0)) {
                s_proceeds[supplier][token] = 0;
                (bool success,) = payable(supplier).call{value: proceeds}("");
                require(
                    success,
                    NftMarketplace__TransferFailed(supplier, token)
                );
                emit ProceedsWithdrawn(supplier, address(0), proceeds);
            } else {
                s_proceeds[supplier][token] = 0;
                IERC20(token).transfer(supplier, proceeds);
                emit ProceedsWithdrawn(supplier, token, proceeds);
            }
        }
    }

    function getSupportedPayments()
    public
    view
    returns (address[] memory result)
    {
        result = s_supportedPayments;
    }

    function initializePriceFeed(
        address payment
    ) private pure returns (address result) {
        address tokenPriceFeed;
        if (payment == 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) {
            // USDC
            tokenPriceFeed = 0x986b5E1e1755e3C2440e960477f25201B0a8bbD4;
        } else if (payment == 0x6B175474E89094C44Da98b954EedeAC495271d0F) {
            // DAI
            tokenPriceFeed = 0x773616E4d11A78F511299002da57A0a94577F1f4;
        } else if (payment == 0x514910771AF9Ca656af840dff83E8264EcF986CA) {
            // LINK
            tokenPriceFeed = 0xDC530D9457755926550b59e8ECcdaE7624181557;
        } else if (payment == 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984) {
            // UNI
            tokenPriceFeed = 0xD6aA3D25116d8dA79Ea0246c4826EB951872e02e;
        } else if (payment == 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599) {
            // wBTC
            tokenPriceFeed = 0xfdFD9C85aD200c506Cf9e21F1FD8dd01932FBB23;
        } else if (payment == 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2) {
            // wETH
            tokenPriceFeed = address(0);
        } else {
            revert NftMarketplace__PaymentNotSupported(payment);
        }
        result = tokenPriceFeed;
    }

    function getPriceFeed(address token) public view returns (address result) {
        result = s_priceFeeds[token];
    }

    function getListings(
        uint256 startIndex,
        uint256 length
    ) public view returns (Listing[] memory result) {
        require(length != 0, "Limit less than 0");

        ListingKey[] memory activeListings = s_activeListings;
        uint256 listingsCount = activeListings.length;
        require(startIndex < listingsCount, "Out of bounds");

        if (length >= s_activeListings.length) {
            length = s_activeListings.length;
        }

        uint256 destinationIndex = startIndex + length - 1;
        if (destinationIndex > listingsCount - 1) {
            destinationIndex = listingsCount - 1;
            length = listingsCount - startIndex;
        }

        Listing[] memory buffer = new Listing[](length);

        for (uint256 index = 0; index < length; index++) {
            ListingKey memory listingKey = activeListings[startIndex + index];
            Listing memory listing = s_listingMap[listingKey.nftAddress][
                            listingKey.tokenId
                ];
            buffer[index] = listing;
        }
        result = buffer;
    }

    function getListingInfo(
        address nftAddress,
        uint256 tokenId
    ) public view returns (Listing memory result) {
        if (s_listingPaddedIndex[nftAddress][tokenId] == 0) {
            revert NftMarketplace__TokenNotListed(nftAddress, tokenId);
        }
        result = s_listingMap[nftAddress][tokenId];
    }

    function getActiveListingKeys()
    public
    view
    returns (ListingKey[] memory result)
    {
        result = s_activeListings;
    }

    function getListingPaddedIndex(
        address nftAddress,
        uint256 tokenId
    ) public view returns (uint256 result) {
        result = s_listingPaddedIndex[nftAddress][tokenId];
    }

    function getSupplierProceeds(
        address supplier,
        address token
    ) public view returns (uint256 result) {
        result = s_proceeds[supplier][token];
    }
}
