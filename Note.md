
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
    - Current solution:
        - All are recorded in ETH, when listed, user specifies expected token and price, then converted to ETH
            - This will introduce problem: when people have bought the item, they will pay the token, I would have to recalculate the amount then transfer
    - Solution after re-thinking
        - Points
            1. Discarding the idea of strict token match, this will obviously work, not match token will have to swap outside of the platform but this will defeat the purpose of flexibility
            2. Auto swapping will be too complicated for this learning project, and it will be gas heavy and risky
            3. Only allows stable coins, also kinda defeating the purpose
            4. Seller configures to accepted non-preferred token purchase, if true then just transfer, if false then will have to convert to stable coin or ETH
        - Opting for the configuration method
            - `Listing` records `strictPayment`
                - If true, then don't have to worry much, just transfer the token to seller when withdrawing
                - If false, then will have to do a swap to ETH
                    - Providing ETH or USDC are the same for this practice purpose, in production it is best to use USDC though
            - When buying token
                - If strict payment, only allows payment in preferred token, easy
                - If not then accept the payment, transfer the NFT to buyer, then under the hood swap payment to ETH then record the amount for withdraw
                - Buyer first `ERC20.approve` then marketplace does `transferFrom` to pay with tokens, `payable` only works with ETH
                    - **To do this, need to insert a function on front end to approve the market place**, then proceed to marketplace contract and `transferFrom`, so in the contract consider the marketplace already approved
    - Difficulties

        - Reading all info from `s_listingMap`

            - `mapping` is not iterable, so my first idea was to store the keys in arrays:

                ```solidity
                mapping(address => mapping(uint256 => Listing)) private s_listingMap;
                address[] private s_allNftContracts;
                mapping(address => uint256[]) private s_allTokenIds;
                ```

                but then I would need to do duplication check on every `s_allNftContracts` entry

                - Current idea
                    - Use a new mapping `s_nftAddressTracked`, every address has a default value of false, when listed set the value to true and push to `address[]`, so in future listings, `tracked` will be true and address won't be pushed, same with token IDs just with an extra layer of mapping
                        - Problems
                            - With this approach, when buying will have to check and clear corresponding record, might cost a lot of gas
- Pull over push(best practice)
    - To **Shift the risk associated with transferring ether to the user**
    - Always have user withdraw instead of sending them

***
## Reentrancy Attack
- One of most common attacks, amongst Oracle attack
- See sub lesson for example
- Ways to prevent
    - **ALWAYS** do state changes first, then transfer assets
    - Mutex locks, E.g.: OpenZeppelin: ReentrancyGuard
        ```solidity
        bool locked;
        function transaction() {
            require(!locked, "revert");

            locked = true;

            // Complete txn

            locked = false;
        }
        ```
***
## Updating
- Whether to check if update is needed
    - Gas consideration
        - It is natural to think that if checked and no write needed, it would save gas, but sometimes reading values and running logic might overweight
    - Logic consideration
        - If emitting event(like in this case), I should check to prevent log spamming
***
## Problems
- [ ] Compiling
    - `CompilerError: Stack too deep.`
        - [More on the error](https://web.archive.org/web/20161015173410/http://james.carlyle.space/2015/07/22/solidity-stack-too-deep/)
        - [Enabling optimizer](https://stackoverflow.com/questions/70310087/how-do-i-resolve-this-hardhat-compilererror-stack-too-deep-when-compiling-inli)
            - [ ] What does optimizer do and what is [`viaIR`](https://soliditylang.org/blog/2024/07/12/a-closer-look-at-via-ir/)?
                - Reduce gas consumption(eliminate redundant operations or combining logic)
                - Minimize memory and stack usage
                - Reuse variables when possible
                - Why it works here?
                    - `viaIR`
                        - `IR`: Intermediate Representation
                        - Transforms Solidity into intermediate form -> Applies deeper optimization