import { EventServer } from '@nimiq/rpc-events';
import { NanoApi } from '@nimiq/nano-api';

export class Network extends NanoApi {
    /**
     * @param {{cdn: string, network: string}} config
     */
    constructor(config) {
        super(config);
        this._eventServer = new EventServer();

        // Register RPC calls.
        this._eventServer.onRequest('connect', () => this.connect());
        this._eventServer.onRequest('connectPico', (state, addresses) => this.connectPico(addresses));
        this._eventServer.onRequest('relayTransaction', (state, arg) => this.relayTransaction(arg));
        this._eventServer.onRequest('getTransactionSize', (state, arg) => this.getTransactionSize(arg));
        this._eventServer.onRequest('subscribe', (state, arg) => this.subscribe(arg));
        this._eventServer.onRequest('getBalance', (state, arg) => this.getBalance(arg));
        this._eventServer.onRequest('getAccountTypeString', (state, arg) => this.getAccountTypeString(arg));
        this._eventServer.onRequest(
            'requestTransactionHistory',
            (state, addresses, knownReceipts, fromHeight) => this.requestTransactionHistory(addresses, knownReceipts, fromHeight),
        );
        this._eventServer.onRequest('requestTransactionReceipts', (state, address, limit) => this.requestTransactionReceipts(address, limit));
        this._eventServer.onRequest('getGenesisVestingContracts', (state, modern) => this.getGenesisVestingContracts(modern));
        this._eventServer.onRequest('removeTxFromMempool', (state, arg) => this.removeTxFromMempool(arg));
        this._eventServer.onRequest('getKnownAddresses', (state) => this.getKnownAddresses());

        // Modern
        this._eventServer.onRequest('sendTransaction', (state, tx) => this.sendTransaction(tx));
        this._eventServer.onRequest('getTransactionsByAddress', (state, address, sinceHeight, knownDetails, limit) => this.getTransactionsByAddress(address, sinceHeight, knownDetails, limit));
    }

    fire(event, data) {
        this._eventServer.fire(event, data);
    }
}
