# NFT marketplace

---

## Essentials

- Approve
    - Listing available tokens
        - NFT contract approves the marketplace for transfer
        - Data storage
            - Array / Mapping
                - My thoughts
                    - Mapping is straight forward to operate
                    - I need to keep track of token owner for future transfer proceeds

## Events

- New thoughts
    - It is not best practice to use up 3 indexed variables, these should be used for variables needed for off-chain filtering, and store other variables not significant for this purpose in `data` section(not indexed)

---

## Payments

- Support multiple tokens
    - To operate multiple tokens, tests using mocks is clearly not ideal, so I would use fork
    - Use mapping to store corresponding price feed address
        - When payment / listing, will need to supply token address
            - Default should be ETH, then should naturally support wETH
            - When using ETH, `paymentToken` use `address(0)`, and for wETH, try to match
                - Not dynamically added cuz this should be implicit support, hardcoding should be fine
