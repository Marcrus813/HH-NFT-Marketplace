// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
    // NFT contract address => tokenId => Listing(Will contain price, seller)
    mapping(address => mapping(uint256 => Listing)) private s_listingMap;
    address[] private s_allNftContracts;
    mapping(address => uint256[]) private s_allTokenIds;
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
        
        emit TokenListed(
            nftAddress,
            tokenId,
            msg.sender,
            preferredPayment,
            price,
            strictPayment
        );
    }

    function convertToEth(
        address paymentToken,
        uint256 amount
    ) private view paymentSupported(paymentToken) returns (uint256 result) {
        if (paymentToken != address(0) && paymentToken != WETH_ADDRESS) {
            AggregatorV3Interface priceFeed = AggregatorV3Interface(
                s_priceFeeds[paymentToken]
            );
            (, int256 answer, , , ) = priceFeed.latestRoundData();
            result = answer.abs();
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
        IERC20 paymentTokenInstance = IERC20(paymentToken);
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
                // ETH or wETH
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
        if (strictPayment) {
            IERC20 paymentTokenInstance = IERC20(paymentToken);
            uint256 price = listing.price;
            paymentTokenInstance.transferFrom(msg.sender, address(this), price);
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

    function getListing() public view returns (Listing memory result) {
        // TODO: To be implemented
    }
}
