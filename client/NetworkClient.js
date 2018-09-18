import { EventClient } from '@nimiq/rpc-events';
export default class NetworkClient {
    constructor(endpoint = NetworkClient.DEFAULT_ENDPOINT) {
        this._endpoint = endpoint;
    }
    static getAllowedOrigin(endpoint) {
        // FIXME derive from endpoint url
        return '*';
    }
    async init() {
        this.$iframe = await NetworkClient._createIframe(this._endpoint);
        const targetWindow = this.$iframe.contentWindow;
        this._eventClient = await EventClient.create(targetWindow, NetworkClient.getAllowedOrigin(this._endpoint));
    }
    async relayTransaction(txObj) {
        return this._eventClient.call('relayTransaction', txObj);
    }
    async getTransactionSize(txObj) {
        return this._eventClient.call('getTransactionSize', txObj);
    }
    async connect() {
        return this._eventClient.call('connect');
    }
    async subscribe(addresses) {
        return this._eventClient.call('subscribe', addresses);
    }
    async getBalance(addresses) {
        return this._eventClient.call('getBalance', addresses);
    }
    async getAccountTypeString(address) {
        return this._eventClient.call('getAccountTypeString', address);
    }
    async requestTransactionHistory(addresses, knownReceipts, fromHeight) {
        return this._eventClient.call('requestTransactionHistory', addresses, knownReceipts, fromHeight);
    }
    async getGenesisVestingContracts() {
        return this._eventClient.call('getGenesisVestingContracts');
    }
    async removeTxFromMempool(txObj) {
        return this._eventClient.call('removeTxFromMempool', txObj);
    }
    static async _createIframe(src) {
        const $iframe = document.createElement('iframe');
        const promise = new Promise(resolve => $iframe.addEventListener('load', () => resolve($iframe)));
        $iframe.src = src;
        $iframe.name = 'network';
        document.body.appendChild($iframe);
        return promise;
    }
}
NetworkClient.DEFAULT_ENDPOINT = '../src';
//# sourceMappingURL=NetworkClient.js.map