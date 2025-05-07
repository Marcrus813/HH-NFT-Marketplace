// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/utils/math/SignedMath.sol";

error NftMarketplace__PriceIsZero();
error NftMarketplace__NotApprovedForMarketplace(
    address nftAddress,
    uint256 tokenId
);
error NftMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketplace__NotListedByOwner(
    address nftAddress,
    uint256 tokenId,
    address sender
);
error NftMarketplace__TokenNotListed(address nftAddress, uint256 tokenId);

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

contract NftMarketplace {
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

    constructor(address[] memory supportedPayments) {
        s_supportedPayments = supportedPayments;
        s_supportedPayments.push(WETH_ADDRESS); // WETH
        for (uint i = 0; i < supportedPayments.length; i++) {
            address tokenAddress = supportedPayments[i];
            address tokenPriceFeed = getPriceFeedForPayment(tokenAddress);
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
        }
    }

    modifier priceNotZero(uint256 price) {
        if (price == 0) {
            revert NftMarketplace__PriceIsZero();
        }
        _;
    }

    modifier notYetListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listingMap[nftAddress][tokenId];
        if (listing.price > 0) {
            revert NftMarketplace__AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isTokenOwner(
        address nftAddress,
        uint256 tokenId,
        address sender
    ) {
        IERC721 nft = IERC721(nftAddress);
        if (nft.ownerOf(tokenId) != sender) {
            revert NftMarketplace__NotListedByOwner(
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
        isTokenOwner(nftAddress, tokenId, msg.sender)
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
        address paymentToken,
        uint256 amount
    ) private view paymentSupported(paymentToken) returns (uint256 result) {
        if (paymentToken != address(0) && paymentToken != WETH_ADDRESS) {
            AggregatorV3Interface priceFeed = AggregatorV3Interface(
                s_priceFeeds[paymentToken]
            );
            uint8 priceFeedDecimals = priceFeed.decimals();
            (, int256 answer, , , ) = priceFeed.latestRoundData();

            ERC20 paymentTokenInstance = ERC20(paymentToken);
            uint8 tokenDecimals = paymentTokenInstance.decimals();

            result = (answer.abs() * amount) / 1e8;
        } else {
            result = amount;
        }
    }

    modifier tokenListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listingMap[nftAddress][tokenId];
        if (listing.price <= 0) {
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

    function verifyPayment(
        uint256 msgValue,
        bool strictPayment,
        address paymentToken,
        uint256 price
    ) internal view returns (bool result) {
        ERC20 paymentTokenInstance = ERC20(paymentToken);
        uint256 allowance = paymentTokenInstance.allowance(
            msg.sender,
            address(this)
        );
        uint256 buyerBalance = paymentTokenInstance.balanceOf(msg.sender);
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

                if (allowance < price || buyerBalance < price) {
                    result = false;
                } else {
                    result = true;
                }
            }
        } else {
            uint256 convertedPrice = convertToEth(paymentToken, price);
            if (paymentToken == address(0)) {
                // ETH
                if (msgValue < convertedPrice) {
                    result = false;
                } else {
                    result = true;
                }
            } else {
                // ERC20
                uint256 convertedAllowance = convertToEth(
                    paymentToken,
                    allowance
                );
                uint256 convertedBuyerBalance = convertToEth(
                    paymentToken,
                    buyerBalance
                );
                if (
                    convertedAllowance < convertedPrice ||
                    convertedBuyerBalance < convertedPrice
                ) {
                    result = false;
                } else {
                    result = true;
                }
            }
        }
    }

    function buyToken(
        address nftAddress,
        uint256 tokenId,
        address paymentToken
    )
        external
        payable
        tokenListed(nftAddress, tokenId)
        paymentSupported(paymentToken)
        strictPaymentChecked(nftAddress, tokenId, paymentToken)
    {
        Listing memory listing = s_listingMap[nftAddress][tokenId];
        uint256 nftPrice = listing.price;
        bool strictPayment = listing.strictPayment;
        bool paymentValid = verifyPayment(
            msg.value,
            strictPayment,
            paymentToken,
            nftPrice
        );
        if (!paymentValid) {
            revert NftMarketplace__InvalidPayment(
                paymentToken,
                msg.sender,
                nftPrice
            );
        }
        uint256 price = listing.price;
        if (strictPayment) {
            if (paymentToken == address(0)) {
                // ETH
                s_proceeds[listing.seller][address(0)] += msg.value;
            } else {
                // ERC20
                ERC20 paymentTokenInstance = ERC20(paymentToken);
                paymentTokenInstance.transferFrom(
                    msg.sender,
                    address(this),
                    price
                );
                s_proceeds[listing.seller][paymentToken] += price;
            }
        } else {
            address preferredPayment = listing.preferredPayment;
            bool paymentMatch = paymentToken == preferredPayment;
        }
    }

    function checkPaymentSupport(
        address tokenAddress
    ) public view returns (bool result) {
        address priceFeedAddress = s_priceFeeds[tokenAddress];
        result = priceFeedAddress != address(0);
    }

    function getSupportedPayments()
        public
        view
        returns (address[] memory result)
    {
        result = s_supportedPayments;
    }

    function getPriceFeedForPayment(
        address payment
    ) private pure returns (address result) {
        address tokenPriceFeed;
        if (payment == 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) {
            // USDC
            tokenPriceFeed == 0x986b5E1e1755e3C2440e960477f25201B0a8bbD4;
        } else if (payment == 0x6B175474E89094C44Da98b954EedeAC495271d0F) {
            // DAI
            tokenPriceFeed == 0x773616E4d11A78F511299002da57A0a94577F1f4;
        } else if (payment == 0x514910771AF9Ca656af840dff83E8264EcF986CA) {
            // LINK
            tokenPriceFeed == 0xDC530D9457755926550b59e8ECcdaE7624181557;
        } else if (payment == 0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984) {
            // UNI
            tokenPriceFeed == 0xD6aA3D25116d8dA79Ea0246c4826EB951872e02e;
        } else if (payment == 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599) {
            // wBTC
            tokenPriceFeed == 0xfdFD9C85aD200c506Cf9e21F1FD8dd01932FBB23;
        } else if (payment == 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2) {
            // wETH
            tokenPriceFeed == address(0);
        } else {
            revert NftMarketplace__PaymentNotSupported(payment);
        }
        result = tokenPriceFeed;
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
            uint256 diff = destinationIndex - listingsCount + 1;
            length -= diff;
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
}
