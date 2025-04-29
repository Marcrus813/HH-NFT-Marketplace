// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

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

error NftMarketplace__PaymentNotSupported(address paymentToken);

contract NftMarketplace {
    /*- `listNft`: List the NFT on the marketplace
    - `buyNft`: Buy
    - `cancelNft`: Cancel listing
    - `updateListing`: Update price
    - `WithdrawProceeds`: When sold, market holds funds, then withdraw*/
    address private constant WETH_ADDRESS =
        0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address[] private s_supportedPayments;
    mapping(address => address) private s_priceFeeds;

    struct Listing {
        uint256 price;
        address seller;
    }
    // NFT contract address => tokenId => Listing(Will contain price, seller)
    mapping(address => mapping(uint256 => Listing)) private s_listingMap;

    event TokenListed(
        address indexed tokenAddress,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
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
        address paymentToken,
        uint256 price
    )
        external
        paymentSupported(paymentToken)
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
        s_listingMap[nftAddress][tokenId] = Listing(price, msg.sender);
        emit TokenListed(nftAddress, tokenId, msg.sender, price);
    }

    function convertPriceToEth(
        address paymentToken,
        uint256 amount
    ) private pure returns (uint256 result) {
        // TODO: Implementation
    }

    function buyToken(address nftAddress, uint256 tokenId) external payable {}

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
}
