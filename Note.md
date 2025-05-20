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
    - It is not best practice to use up 3 indexed variables, these should be used for variables needed for off-chain
      filtering, and store other variables not significant for this purpose in `data` section(not indexed)

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
            - This will introduce problem: when people have bought the item, they will pay the token, I would have to
              recalculate the amount then transfer
    - Solution after re-thinking
        - Points
            1. Discarding the idea of strict token match, this will obviously work, not match token will have to swap
               outside of the platform but this will defeat the purpose of flexibility
            2. Auto swapping will be too complicated for this learning project, and it will be gas heavy and risky
            3. Only allows stable coins, also kinda defeating the purpose
            4. Seller configures to accepted non-preferred token purchase, if true then just transfer, if false then
               will have to convert to stable coin or ETH
        - Opting for the configuration method
            - `Listing` records `strictPayment`
                - If true, then don't have to worry much, just transfer the token to seller when withdrawing
                - If false, then will have to do a swap to ETH
                    - Providing ETH or USDC are the same for this practice purpose, in production it is best to use USDC
                      though
            - When buying token
                - If strict payment, only allows payment in preferred token, easy
                - If not then accept the payment, transfer the NFT to buyer, then under the hood swap payment to ETH
                  then record the amount for withdraw
                - Buyer first `ERC20.approve` then marketplace does `transferFrom` to pay with tokens, `payable` only
                  works with ETH
                    - **To do this, need to insert a function on front end to approve the market place**, then proceed
                      to marketplace contract and `transferFrom`, so in the contract consider the marketplace already
                      approved
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
                    - Use a new mapping `s_nftAddressTracked`, every address has a default value of false, when listed
                      set the value to true and push to `address[]`, so in future listings, `tracked` will be true and
                      address won't be pushed, same with token IDs just with an extra layer of mapping
                        - Problems
                            - With this approach, when buying will have to check and clear corresponding record, might
                              cost a lot of gas

- Pull over push(best practice)
    - To **Shift the risk associated with transferring ether to the user**
    - Always have user withdraw instead of sending them

---

## Reentrancy Attack

- One of most common attacks, amongst Oracle attack
- See sub lesson for example
- Ways to prevent

    - **ALWAYS** do state changes first, then transfer assets
    - Mutex locks, E.g.: OpenZeppelin: ReentrancyGuard

        ```solidity
        bool locked
        function transaction() {
            require(!locked, "revert");

            locked = true;

            // Complete txn

            locked = false;
        }
        ```

---

## Updating

- Whether to check if update is needed
    - Gas consideration
        - It is natural to think that if checked and no write needed, it would save gas, but sometimes reading values
          and running logic might overweight
    - Logic consideration
        - If emitting event(like in this case), I should check to prevent log spamming

---

## Problems

- [x] `hardhat/console`

    - ~~Don't know why, but log does not work with modifiers, this is a conclusion based on test: it works
      with `checkPaymentSupport`, but not `convertToEth`, then removed modifier then works~~
        - Turns out there's something wrong with function, possibly it takes ERC20 as param, but we are using an address

- [x] Compiling
    - `CompilerError: Stack too deep.`
        - [More on the error](https://web.archive.org/web/20161015173410/http://james.carlyle.space/2015/07/22/solidity-stack-too-deep/)
        - [Enabling optimizer](https://stackoverflow.com/questions/70310087/how-do-i-resolve-this-hardhat-compilererror-stack-too-deep-when-compiling-inli)
            - [ ] What does optimizer do and what is [
                  `viaIR`](https://soliditylang.org/blog/2024/07/12/a-closer-look-at-via-ir/)?
                - Reduce gas consumption(eliminate redundant operations or combining logic)
                - Minimize memory and stack usage
                - Reuse variables when possible
                - Why it works here?
                    - `viaIR`
                        - `IR`: Intermediate Representation
                        - Transforms Solidity into intermediate form -> Applies deeper optimization
- [x] Converting prices
    - Key points
        - Answer: 404515560157583 means 1 USDC = 404515560157583 wei
        - `decimals` from price feed `USDC / ETH` returns `18` while decimals of USDC is 6, ~~so probably the decimals
          of the target token~~ here it is the decimals of the price feed
            - Take `wBTC / ETH` for example, the decimal is 8, same as `wBTC`, the result would also be in 8 decimals
- [x] Yarn problem
    - Unable to fetch due to ssl problem
        - The root cause is from getting `yarn 1.22.22`. When running `yarn` in `4.9.1` and getting some packages that
          require `1.22.22`, the previous setup has `4.9.1` installed globally, so need to download `1.22.22` in this
          case, now we have `1.22.22` installed globally, so when in this scenario, it will work even the project is
          running `4.9.1`
            - So WSL might not be the culprit here, but I discarded it anyway.🤭
- [x] Fixing IDE Warnings
    - Not recognizing `describe` and `it`
        - Installing `mocha` in WebStorm as Javascript library fixed the problem
            - Configure WebStorm to use `npm` instead of yarn
        - Not recognizing contract functions
            - Import `typechain/hardhat` in `hardhat.config.js`
                - Clean and compile the contracts
            - Add following config:
                ```javascript
                typechain: {
                    outDir: "typechain",
                    target: "ethers-v6",
                    alwaysGenerateOverloads: true,
                    dontOverrideCompile: false
                },
                ```
- [x] Using WebStorm Mocha
    - Edit Mocha template
        - Edit Configuration -> Edit configuration template
            - Extra Mocha options: `--require hardhat/register --timeout 120000`
            - Before launch: Add `npm run h-compile`
- [x] Listing
    - [x] Having a major problem with listing, preferred payment is not correctly recorded(except zeroAddress for ETH, I
          have only used this for listing tests, that's why I never found out).
        - The addresses in js scripts are correct, so are the tokenIds, contract log shows that it is being listed with
          zero
          address regard less of the choice of the address.
            - Forgot to add `_;` in `paymentSupported` modifier.
            - **What to take away?**
                - The problem was not exposed when testing `listNft`, I thought I have tested `paymentSupported`
                  modifier, but I did not test all the branches in it and failed to see the problem

## Testing

- Fork
    - When using fork, to give the local accounts, need to use hardhat ethers to personate the accounts and transfer
      funds to the local test accounts(or just use the accounts, but we will need to instantiate the account first)
    - When sending funds or tokens, there may be scenarios where the original account does not have enough ETH to pay
      gas:
      `ProviderError: Sender doesn't have enough funds to send tx. The max upfront cost is: 79949756940000000 and the sender's balance is: 63297255814439858.`
        - When sending ETH, the whale address might be a contract, so when there's no receive function in it, sending it
          eth will go wrong
        - It's difficult to find all the EOA addresses owning the token, so in the end I used a Binance account:
          `0x28C6c06298d514Db089934071355E5743bf21d60`
    - Impersonating can be tricky, may have to do sth about checking whether the gas receiver is a contact
        - Check `ethers.provider.getCode(address) == "0x"`
            - Possible security risk(on chain):
                - [Reference](https://ethereum.stackexchange.com/questions/28521/how-to-detect-if-an-address-is-a-contract)
                - Key point, when returned `0x`, it means the address is not a contract **YET**, also, some libraries
                  can exploit this behavior
                - Generally, avoid doing this on-chain, but off-chain it should be good
