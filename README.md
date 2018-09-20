# Nimiq Network Client

Connect to Nimiq Network, send transactions and get updated when things change on the blockchain.

# Getting started
```javascript
import NetworkClient from '@nimiq/network-client';
const networkClient = new NetworkClient('https://network.nimiq-testnet.com');
await networkClient.init();
```
After the await, the client is loaded and ready to interact with.

## Events
All changes in the network can be listened to by calling the `on` method. It receives two parameters: the event name and a callback method. E.g. to wait for the consensus to be established use:

```javascript
networkClient.on('nimiq-consensus-established', function() { /*... do something ... */ });
```

Basic events about the status of the client and the network:

| Event                       | Meaning                                             |
| --------------------------- | --------------------------------------------------- |
| nimiq-consensus-syncing     | Client is downloading block headers from peers [?] |
| nimiq-consensus-established | Client is in sync with it's peers                   |
| nimiq-consensus-lost        | [what does that mean exactly?]                                                   |
| nimiq-api-fail              | [What can cause it to fail? What are ways to recover?]                                                   |
| nimiq-peer-count            | Number of peers the client is currently connected to |

Events for actions happening in the network:

| Event                     | Meaning                                                                          |
| ------------------------- | -------------------------------------------------------------------------------- |
| nimiq-balances            | A map of each address and its balance |
| nimiq-transaction-pending | A TX not yet confirmed by network, e.g. incoming TX                                    |
| nimiq-transaction-expired | TX has not been mined before end of validity window has been reached             |
| nimiq-transaction-mined   | TX confirmed by network [structure? height?]                                     |
| nimiq-transaction-relayed | TX in mempool of peers, waiting to be mined                                      |

## Methods

All address parameters are strings in the IBAN format `NQXX XXXX ...`.
Transactions, short TX, are objects with following fields: [!!!].

| Method                                                          | Meaning                                                                                                                                                  |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| init                                                            | Initializes the API, needs to be called first.                                                                                                           |
| on(event, callback)                                             | Receive a callback when the given event occurs (see above)                                                                                               |
| off(event, callback)                                            | Stop calling the callback for the given event                                                                                                            |
| relayTransaction(tx)                                            | Send the signed transaction (TX) to the network so that it can be confirmed/mined.                                                                       |
| getTransactionSize(tx)                                          | [?]                                                                                                                                                      |
| connect                                                         | [not to be used? remove?]                                                                                                                                |
| subscribe(addresses)                                            | A list or single address to receive `nimiq-balances` events for [No unsubscribe method?!]                                                                |
| getBalance(addresses)                                           | A list or single address to retrieve the current balance for. Result is a map of each address and it's balance.                                          |
| getAccountTypeString(address)                                   | Get human readable account type name for the given address.                                                                                              |
| requestTransactionHistory(addresses, knownReceipts, fromHeight) | Retrieve the latest TX history for the given address or addresses starting from the given height. `transactions` on the returned object contains all TX. |
| getGenesisVestingContracts                                      | lists all the vesting accounts defined in the Genesis block with address, owner account and total amount (among other).                                  |
| removeTxFromMempool(tx)                                         | Rarely to be used. Removes the given TX from the local mempool. The TX might have been relayed to other peer already.                                    |

## How it works
The network client adds an iFrame to the DOM loading a Nimiq Nano API instance inside connecting to the network. Using an iFrame enables the API to run in parallel without blocking the app using it.

## Upcoming
Self hosting?
