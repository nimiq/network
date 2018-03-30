(function () {
'use strict';

class Reflection {
    /** @param {Object} proto
     *
     * @returns {Set<string>}
     */
    static userFunctions(proto) {
        return new Set(Reflection._deepFunctions(proto).filter(name => {
            return name !== 'constructor'
                && name !== 'fire'
                && name[0] !== '_';
        }));
    }

    /** @param {Object} proto
     *
     * @returns {string[]}
     */
    static _deepFunctions(proto) {
        if (!proto || proto === Object.prototype) return [];

        const ownProps = Object.getOwnPropertyNames(proto);

        const ownFunctions = ownProps.filter(name => {
            const desc = Object.getOwnPropertyDescriptor(proto, name);
            return !!desc && typeof desc.value === 'function';
        });

        const deepFunctions = Reflection._deepFunctions(Object.getPrototypeOf(proto));

        return [...ownFunctions, ...deepFunctions];
    }
}

class Random {
    static getRandomId() {
        let array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return array[0];
    }
}

class RPC {
    /**
     * @param {Window} targetWindow
     * @param {string} interfaceName
     * @param {string} [targetOrigin]
     * @returns {Promise}
     */
    static async Client(targetWindow, interfaceName, targetOrigin = '*') {
        return new Promise((resolve, reject) => {
            let connected = false;

            const interfaceListener = (message) => {
                if (message.source !== targetWindow
                    || message.data.status !== 'OK'
                    || message.data.interfaceName !== interfaceName
                    || (targetOrigin !== '*' && message.origin !== targetOrigin)) return;

                self.removeEventListener('message', interfaceListener);

                connected = true;

                resolve( new (RPC._Client(targetWindow, targetOrigin, interfaceName, message.data.result))() );
            };

            self.addEventListener('message', interfaceListener);


            let connectTimer;
            const timeoutTimer = setTimeout(() => {
                reject(new Error('Connection timeout'));
                clearTimeout(connectTimer);
            }, 10000);

            const tryToConnect = () => {
                if (connected) {
                    clearTimeout(timeoutTimer);
                    return;
                }

                try {
                    targetWindow.postMessage({ command: 'getRpcInterface', interfaceName, id: 0 }, targetOrigin);
                } catch (e){
                    console.log('postMessage failed:' + e);
                }
                connectTimer = setTimeout(tryToConnect, 1000);
            };

            connectTimer = setTimeout(tryToConnect, 100);
        });
    }


    /**
     * @param {Window} targetWindow
     * @param {string} interfaceName
     * @param {array} functionNames
     * @returns {Class}
     * @private
     */
    static _Client(targetWindow, targetOrigin, interfaceName, functionNames) {
        const Client = class {
            constructor() {
                this.availableMethods = functionNames;
                // Svub: Code smell that _targetWindow and _waiting are visible outside. Todo later!
                /** @private
                 *  @type {Window} */
                this._targetWindow = targetWindow;
                this._targetOrigin = targetOrigin;
                /** @private
                 *  @type {Map.<number,{resolve:Function,error:Function}>} */
                this._waiting = new Map();
                self.addEventListener('message', this._receive.bind(this));
            }

            close() {
                self.removeEventListener('message', this._receive.bind(this));
            }

            _receive({ source, origin, data }) {
                // Discard all messages from unwanted sources
                // or which are not replies
                // or which are not from the correct interface
                if (source !== this._targetWindow
                    || !data.status
                    || data.interfaceName !== interfaceName
                    || (this._targetOrigin !== '*' && origin !== this._targetOrigin)) return;

                const callback = this._waiting.get(data.id);

                if (!callback) {
                    console.log('Unknown reply', data);
                } else {
                    this._waiting.delete(data.id);

                    if (data.status === 'OK') {
                        callback.resolve(data.result);
                    } else if (data.status === 'error') {
                        const { message, stack, code } = data.result;
                        const error = new Error(message);
                        error.code = code;
                        error.stack = stack;
                        callback.error(error);
                    }
                }
            }

            /**
             * @param {string} command
             * @param {object[]} [args]
             * @returns {Promise}
             * @private
             */
            _invoke(command, args = []) {
                return new Promise((resolve, error) => {
                    const obj = { command, interfaceName, args, id: Random.getRandomId() };
                    this._waiting.set(obj.id, { resolve, error });
                    this._targetWindow.postMessage(obj, '*');
                    // no timeout for now, as some actions require user interactions
                    // todo maybe set timeout via parameter?
                    //setTimeout(() => error(new Error ('request timeout')), 10000);
                });
            }
        };

        for (const functionName of functionNames) {
            Client.prototype[functionName] = function (...args) {
                return this._invoke(functionName, args);
            };
        }

        return Client;
    }

    /**
     * @param {Class} clazz: The class whose methods will be made available via postMessage RPC
     * @param {boolean} useAccessControl: If set, message.source and message.origin will be passed as first two arguments to each method.
     * @return {T extends clazz}
     */
    static Server(clazz, useAccessControl) {
        return new (RPC._Server(clazz, useAccessControl))();
    }

    static _Server(clazz, useAccessControl) {
        const Server = class extends clazz {
            constructor() {
                super();
                this._name = Server.prototype.__proto__.constructor.name;
                self.addEventListener('message', this._receive.bind(this));
            }

            close() {
                self.removeEventListener('message', this._receive.bind(this));
            }

            _replyTo(message, status, result) {
                message.source.postMessage({ status, result, interfaceName: this._name, id: message.data.id }, message.origin);
            }

            _receive(message) {
                try {
                    if (message.data.interfaceName !== this._name) return;

                    let args = message.data.args || [];

                    if (useAccessControl && message.data.command !== 'getRpcInterface') {
                        // Inject calling origin to function args
                        args = [{ callingWindow: message.source, callingOrigin: message.origin }, ...args];
                    }

                    /* deactivate this since there is no security issue and by wrapping in acl length info gets lost
                    // Test if request calls an existing method with the right number of arguments
                    const calledMethod = this[message.data.command];
                    if (!calledMethod) {
                        throw `Non-existing method ${message.data.command} called: ${message}`;
                    }

                    if (calledMethod.length < args.length) {
                        throw `Too many arguments passed: ${message}`;
                    }*/

                    const result = this._invoke(message.data.command, args);

                    if (result instanceof Promise) {
                        result
                            .then((finalResult) => this._replyTo(message, 'OK', finalResult))
                            .catch(e => this._replyTo(message, 'error',
                                e.message ? { message: e.message, stack: e.stack, code: e.code } : { message: e } ));
                    } else {
                        this._replyTo(message, 'OK', result);
                    }
                } catch (e) {
                    this._replyTo(message, 'error',
                        e.message ? { message: e.message, stack: e.stack, code: e.code } : { message: e } );
                }
            }

            _invoke(command, args) {
                return this[command].apply(this, args);
            }
        };

        // Collect function names of the Server's interface
        Server.prototype._rpcInterface = [];
        for (const functionName of Reflection.userFunctions(clazz.prototype)) {
            Server.prototype._rpcInterface.push(functionName);
        }
        Server.prototype._rpcInterface.push('getRpcInterface');

        // Add function to retrieve the interface
        Server.prototype['getRpcInterface'] = function() {
            if(this.onConnected) this.onConnected.call(this);
            return Server.prototype._rpcInterface;
        };

        return Server;
    }
}

// TODO: Handle unload/load events (how?)

class EventServer {
    constructor() {
        this._listeners = new Map();
        const that = this;
        RPC.Server(class EventRPCServer {
            on({ callingWindow, callingOrigin }, event) {
                if (!that._listeners.get(event)) {
                    that._listeners.set(event, new Map());
                }
                that._listeners.get(event).set(callingWindow, callingOrigin);
            }

            off({ callingWindow, callingOrigin }, event) {
                const eventEntry = that._listeners.get(event);
                if (eventEntry.get(callingWindow) !== callingOrigin) return;

                eventEntry.delete(callingWindow);
                if (that._listeners.get(event).length === 0) {
                    that._listeners.delete(event);
                }
            }

            onConnected() {
                that.onConnected();
            }
        }, true);
    }

    fire(event, value) {
        if (!this._listeners.get(event)) return;

        for (const [callingWindow, callingOrigin] of this._listeners.get(event)) {
            callingWindow.postMessage({event, value}, callingOrigin);
        }
    }

    onConnected() { }
}

class NanoNetworkApi {

    // static get API_URL() { return 'https://cdn.nimiq-network.com/branches/master/nimiq.js' }
    /*
    @asset(nimiq.js)
    @asset(web.js)
    @asset(worker.js)
    @asset(worker-wasm.js)
    @asset(worker-wasm.wasm)
    */
    static get API_URL() { return 'nimiq.js' }
    static get satoshis() { return 1e5 }

    static getApi() {
        this._api = this._api || new NanoNetworkApi();
        return this._api;
    }

    constructor() {
        this._apiInitialized = new Promise(async (resolve) => {
            await NanoNetworkApi._importApi();
            await Nimiq.load();
            // setTimeout(resolve, 500);
            resolve();
        });
        this._createConsensusPromise();

        this._balances = new Map();
    }

    async connect() {
        await this._apiInitialized;
        Nimiq.GenesisConfig.bounty();
        this._consensus = await Nimiq.Consensus.volatileNano();
        this._consensus.on('syncing', e => this._onConsensusSyncing());
        this._consensus.on('established', e => this.__consensusEstablished());
        this._consensus.on('lost', e => this._consensusLost());

        // this._consensus.on('sync-finished', e => console.log('consensus sync-finished'));
        // this._consensus.on('sync-failed', e => console.log('consensus sync-failed'));
        // this._consensus.on('sync-chain-proof', e => console.log('consensus sync-chain-proof'));
        // this._consensus.on('verify-chain-proof', e => console.log('consensus verify-chain-proof'));

        this._consensus.network.connect();

        this._consensus.blockchain.on('head-changed', block => this._headChanged(block.header));
        this._consensus.mempool.on('transaction-added', tx => this._transactionAdded(tx));
        // this._consensus.mempool.on('transaction-expired', tx => this._transactionExpired(tx));
        this._consensus.mempool.on('transaction-mined', (tx, header) => this._transactionMined(tx, header));
        this._consensus.network.on('peers-changed', () => this._onPeersChanged());
    }

    async _headChanged(header) {
        if (!this._consensus.established) return;
        const balances = await this._getBalances([...this._balances.keys()]);

        for (const [address, balance] of balances) {
            if (this._balances.get(address) === balance) {
                balances.delete(address);
                continue;
            }

            this._balances.set(address, balance);
        }

        if (balances.size) this._onBalancesChanged(balances);

        this._onHeadChange(header);
    }

    /**
     * @returns {Array<Account>} An array element can be NULL if account does not exist
     */
    async _getAccounts(addresses, stackHeight) {
        if (addresses.length === 0) return [];
        await this._consensusEstablished;
        let accounts;
        const addressesAsAddresses = addresses.map(address => Nimiq.Address.fromUserFriendlyAddress(address));
        try {
            accounts = await this._consensus.getAccounts(addressesAsAddresses);
        } catch (e) {
            stackHeight = stackHeight || 0;
            stackHeight++;
            return await new Promise(resolve => {
                const timeout = 1000 * stackHeight;
                setTimeout(async _ => {
                    resolve(await this._getAccounts(addresses, stackHeight));
                }, timeout);
                console.warn(`Could not retrieve accounts from consensus, retrying in ${timeout / 1000} s`);
            });
        }

        return accounts;
    }

    /**
     * @param {Array<string>} addresses
     */
    async _subscribeAddresses(addresses) {
        addresses.forEach(address => this._balances.set(address, 0));

        const addressesAsAddresses = addresses.map(address => Nimiq.Address.fromUserFriendlyAddress(address));
        await this._consensusEstablished;
        this._consensus.subscribeAccounts(addressesAsAddresses);
    }

    /**
     * @param {Array<string>} addresses
     * @returns {Map}
     */
    async _getBalances(addresses) {
        let accounts = await this._getAccounts(addresses);

        const balances = new Map();

        accounts.forEach((account, i) => {
            const address = addresses[i];
            const balance = account ? account.balance / NanoNetworkApi.satoshis : 0;
            balances.set(address, balance);
        });

        return balances;
    }

    /**
     * @param {string} address
     * @param {Map} [knownReceipts] A map with the tx hash as key and the blockhash as value
     * @param {uint} [fromHeight]
     */
    async _requestTransactionHistory(address, knownReceipts = new Map(), fromHeight = 0) {
        await this._consensusEstablished;
        address = Nimiq.Address.fromUserFriendlyAddress(address);

        // Inpired by Nimiq.BaseConsensus._requestTransactionHistory()

        // 1. Get transaction receipts.
        let receipts = await this._consensus._requestTransactionReceipts(address);
        // console.log(`Received ${receipts.length} receipts from the network.`);

        // 2 Filter out known receipts.
        const knownTxHashes = [...knownReceipts.keys()];

        receipts = receipts.filter(receipt => {
            if (receipt.blockHeight < fromHeight) return false;

            const hash = receipt.transactionHash.toBase64();

            // Known transaction
            if (knownTxHashes.includes(hash)) {
                // Check if block has changed
                return receipt.blockHash.toBase64() !== knownReceipts.get(hash);
            }

            // Unknown transaction
            return true;
        });
        // console.log(`Reduced to ${receipts.length} unknown receipts.`);

        // FIXME TODO: Check for tx that have been removed from the blockchain!

        // 3. Request proofs for missing blocks.
        /** @type {Array.<Promise.<Block>>} */
        const blockRequests = [];
        let lastBlockHash = null;
        for (const receipt of receipts) {
            if (!receipt.blockHash.equals(lastBlockHash)) {
                // eslint-disable-next-line no-await-in-loop
                const block = await this._consensus._blockchain.getBlock(receipt.blockHash);
                if (block) {
                    blockRequests.push(Promise.resolve(block));
                } else {
                    const request = this._consensus._requestBlockProof(receipt.blockHash, receipt.blockHeight)
                        .catch(e => console.error(NanoNetworkApi, `Failed to retrieve proof for block ${receipt.blockHash}`
                            + ` (${e.message || e}) - transaction history may be incomplete`));
                    blockRequests.push(request);
                }

                lastBlockHash = receipt.blockHash;
            }
        }
        const blocks = await Promise.all(blockRequests);

        // 4. Request transaction proofs.
        const transactionRequests = [];
        for (const block of blocks) {
            if (!block) continue;

            const request = this._consensus._requestTransactionsProof([address], block)
                .then(txs => txs.map(tx => ({ transaction: tx, header: block.header })))
                .catch(e => console.error(NanoNetworkApi, `Failed to retrieve transactions for block ${block.hash}`
                    + ` (${e.message || e}) - transaction history may be incomplete`));
            transactionRequests.push(request);
        }

        const transactions = await Promise.all(transactionRequests);
        return transactions
            .reduce((flat, it) => it ? flat.concat(it) : flat, [])
            .sort((a, b) => a.header.height - b.header.height);
    }

    __consensusEstablished() {
        this._consensusEstablishedResolver();
        this._headChanged(this._consensus.blockchain.head);
        this._onConsensusEstablished();
    }

    _consensusLost() {
        this._createConsensusPromise();
        this._onConsensusLost();
    }

    _transactionAdded(tx) {
        const recipientAddr = tx.recipient.toUserFriendlyAddress();
        const senderAddr = tx.sender.toUserFriendlyAddress();
        const trackedAddresses = new Set(this._balances.keys());

        if (trackedAddresses.has(senderAddr) || trackedAddresses.has(recipientAddr)) {
            this._onTransactionPending(senderAddr, recipientAddr, tx.value / NanoNetworkApi.satoshis, tx.fee / NanoNetworkApi.satoshis, tx.hash().toBase64());
        }
    }

    _transactionMined(tx, header) {
        const recipientAddr = tx.recipient.toUserFriendlyAddress();
        const senderAddr = tx.sender.toUserFriendlyAddress();
        const trackedAddresses = new Set(this._balances.keys());

        if (trackedAddresses.has(recipientAddr) || trackedAddresses.has(senderAddr)) {
            this._onTransactionMined(senderAddr, recipientAddr, tx.value / NanoNetworkApi.satoshis, tx.fee / NanoNetworkApi.satoshis, tx.hash().toBase64(), header.height, header.timestamp);
        }
    }

    _createConsensusPromise() {
        this._consensusEstablished = new Promise(resolve => {
            this._consensusEstablishedResolver = resolve;
        });
    }

    _globalHashrate(difficulty) {
        return Math.round(difficulty * Math.pow(2, 16) / Nimiq.Policy.BLOCK_TIME);
    }

    /*
        Public API

        @param {Object} obj: {
            sender: <user friendly address>,
            senderPubKey: <serialized public key>,
            recipient: <user friendly address>,
            value: <value in NIM>,
            fee: <fee in NIM>,
            validityStartHeight: <integer>,
            signature: <serialized signature>
        }
    */
    async relayTransaction(obj) {
        await this._consensusEstablished;
        const senderPubKey = Nimiq.PublicKey.unserialize(Nimiq.SerialBuffer.from(obj.senderPubKey));
        const recipientAddr = Nimiq.Address.fromUserFriendlyAddress(obj.recipient);
        const value = Nimiq.Policy.coinsToSatoshis(obj.value);
        const fee = Nimiq.Policy.coinsToSatoshis(obj.fee);
        const validityStartHeight = parseInt(obj.validityStartHeight);
        const signature = Nimiq.Signature.unserialize(Nimiq.SerialBuffer.from(obj.signature));

        const tx = new Nimiq.BasicTransaction(senderPubKey, recipientAddr, value, fee, validityStartHeight, signature);

        return this._consensus.relayTransaction(tx);
    }

    /**
     * @param {string|Array<string>} addresses
     */
    async subscribe(addresses) {
        if (!(addresses instanceof Array)) addresses = [addresses];

        this._subscribeAddresses(addresses);

        const balances = await this._getBalances(addresses);
        for (const [address, balance] of balances) { this._balances.set(address, balance); }

        this._onBalancesChanged(balances);
    }

    /**
     * @param {string|Array<string>} addresses
     * @returns {Map}
     */
    getBalance(addresses) {
        if (!(addresses instanceof Array)) addresses = [addresses];

        const balances = this._getBalances(addresses);
        for (const [address, balance] of balances) { this._balances.set(address, balance); }

        return balances;
    }

    async getAccountTypeString(address) {
        const account = (await this._getAccounts([address]))[0];

        if (!account) return 'basic';

        // See Nimiq.Account.Type
        switch (account.type) {
            case Nimiq.Account.Type.BASIC: return 'basic';
            case Nimiq.Account.Type.VESTING: return 'vesting';
            case Nimiq.Account.Type.HTLC: return 'htlc';
            default: return false;
        }
    }

    async requestTransactionHistory(addresses, knownReceipts, fromHeight) {
        if (!(addresses instanceof Array)) addresses = [addresses];

        let txs = await Promise.all(addresses.map(address => this._requestTransactionHistory(address, knownReceipts, fromHeight)));

        // txs is an array of arrays of objects, which have the format {transaction: Nimiq.Transaction, header: Nimiq.BlockHeader}
        // We need to reduce this to usable simple tx objects

        // First, reduce
        txs = txs.reduce((flat, it) => it ? flat.concat(it) : flat, []);

        // Then map to simple objects
        txs = txs.map(tx => ({
            sender: tx.transaction.sender.toUserFriendlyAddress(),
            recipient: tx.transaction.recipient.toUserFriendlyAddress(),
            value: tx.transaction.value / NanoNetworkApi.satoshis,
            fee: tx.transaction.fee / NanoNetworkApi.satoshis,
            hash: tx.transaction.hash().toBase64(),
            blockHeight: tx.header.height,
            blockHash: tx.header.hash().toBase64(),
            timestamp: tx.header.timestamp
        }));

        // Finally, sort the array
        // return txs.sort((a, b) => a.blockHeight - b.blockHeight);
        return txs; // Sorting is done in transaction-redux
    }

    async getGenesisVestingContracts() {
        await this._apiInitialized;
        const accounts = [];
        const buf = Nimiq.BufferUtils.fromBase64(Nimiq.GenesisConfig.GENESIS_ACCOUNTS);
        const count = buf.readUint16();
        for (let i = 0; i < count; i++) {
            const address = Nimiq.Address.unserialize(buf);
            const account = Nimiq.Account.unserialize(buf);

            if (account.type === 1) {
                accounts.push({
                    address: address.toUserFriendlyAddress(),
                    // balance: account.balance / NanoNetworkApi.satoshis,
                    owner: account.owner.toUserFriendlyAddress(),
                    start: account.vestingStart,
                    stepAmount: account.vestingStepAmount / NanoNetworkApi.satoshis,
                    stepBlocks: account.vestingStepBlocks,
                    totalAmount: account.vestingTotalAmount / NanoNetworkApi.satoshis
                });
            }
        }
        return accounts;
    }

    _onInitialized() {
        // console.log('Nimiq API ready to use');
        this.fire('nimiq-api-ready');
    }

    _onConsensusSyncing() {
        // console.log('consensus syncing');
        this.fire('nimiq-consensus-syncing');
    }

    _onConsensusEstablished() {
        // console.log('consensus established');
        this.fire('nimiq-consensus-established');
    }

    _onConsensusLost() {
        // console.log('consensus lost');
        this.fire('nimiq-consensus-lost');
    }

    _onBalancesChanged(balances) {
        // console.log('new balances:', balances);
        this.fire('nimiq-balances', balances);
    }

    _onTransactionPending(sender, recipient, value, fee, hash) {
        // console.log('pending:', { sender, recipient, value, fee, hash });
        this.fire('nimiq-transaction-pending', { sender, recipient, value, fee, hash });
    }

    _onTransactionMined(sender, recipient, value, fee, hash, blockHeight, timestamp) {
        // console.log('mined:', { sender, recipient, value, fee, hash, blockHeight, timestamp });
        this.fire('nimiq-transaction-mined', { sender, recipient, value, fee, hash, blockHeight, timestamp });
    }

    _onDifferentTabError(e) {
        // console.log('Nimiq API is already running in a different tab:', e);
        this.fire('nimiq-different-tab-error', e);
    }

    _onInitializationError(e) {
        // console.log('Nimiq API could not be initialized:', e);
        this.fire('nimiq-api-fail', e);
    }

    _onHeadChange(header) {
        // console.log('height changed:', height);
        this.fire('nimiq-head-change', {
            height: header.height,
            globalHashrate: this._globalHashrate(header.difficulty)
        });
    }

    _onPeersChanged() {
        // console.log('peers changed:', this._consensus.network.peerCount);
        this.fire('nimiq-peer-count', this._consensus.network.peerCount);
    }

    static _importApi() {
        return new Promise((resolve, reject) => {
            let script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = NanoNetworkApi.API_URL;
            script.addEventListener('load', () => resolve(script), false);
            script.addEventListener('error', () => reject(script), false);
            document.body.appendChild(script);
        });
    }

    fire() {
        throw new Error('The fire() method needs to be overloaded!');
    }
}

// todo replace master by release before release!

class Network {
    constructor() {
        this.connect();
    }

    async connect() {
        const eventServer = new EventServer();
        const network = RPC.Server(NanoNetworkApi);
        network.fire = (event, value) => eventServer.fire(event, value);

        // TODO: Init network with the GenesisConfig that we want
        // TODO: Make the GenesisConfig configurable

        await network.connect();
    }
}

new Network();

}());

//# sourceMappingURL=network.js.map
