import { EventServer } from '@nimiq/rpc-events';
import { NanoNetworkApi } from '@nimiq/nano-api';

export class Network extends NanoNetworkApi {
    /**
     * @param {{cdn:string, network:string}} config
     */
    constructor(config) {
        super(config);
        this._eventServer = new EventServer();

        // Register RPC calls.
        this._eventServer.onRequest('relayTransaction', (state, arg) => this.relayTransaction(arg));
        this._eventServer.onRequest('getTransactionSize', (state, arg) => this.getTransactionSize(arg));
        this._eventServer.onRequest('subscribe', (state, arg) => this.subscribe(arg));
        this._eventServer.onRequest('getBalance', (state, arg) => this.getBalance(arg));
        this._eventServer.onRequest('getAccountTypeString', (state, arg) => this.getAccountTypeString(arg));
        this._eventServer.onRequest(
            'requestTransactionHistory',
            (state, addresses, knownReceipts, fromHeight) => this.requestTransactionHistory(addresses, knownReceipts, fromHeight),
        );
        this._eventServer.onRequest('getGenesisVestingContracts', (state, arg) => this.getGenesisVestingContracts(arg));
        this._eventServer.onRequest('removeTxFromMempool', (state, arg) => this.removeTxFromMempool(arg));
    }

    fire(event, data) {
        this._eventServer.fire(event, data);
    }
}
