import { EventClient, EventCallback } from '@nimiq/rpc-events';

export default class NetworkClient {
    private static readonly DEFAULT_ENDPOINT = '../src';

    private static getAllowedOrigin(endpoint: string) {
        // FIXME derive from endpoint url
        return '*';
    }

    private static async _createIframe(src: string): Promise<HTMLIFrameElement> {
        const $iframe = document.createElement('iframe');
        const promise = new Promise<HTMLIFrameElement>((resolve) =>
            $iframe.addEventListener('load', () => resolve($iframe)));
        $iframe.src = src;
        $iframe.name = 'NimiqNetwork';
        $iframe.style.display = 'none';
        document.body.appendChild($iframe);
        return promise;
    }

    private readonly _endpoint: string;
    private _eventClient!: EventClient;
    private $iframe!: HTMLIFrameElement;

    constructor(endpoint: string = NetworkClient.DEFAULT_ENDPOINT) {
        this._endpoint = endpoint;
    }

    public async init() {
        this.$iframe = await NetworkClient._createIframe(this._endpoint) as HTMLIFrameElement;
        const targetWindow = this.$iframe.contentWindow as Window;
        this._eventClient = await EventClient.create(targetWindow, NetworkClient.getAllowedOrigin(this._endpoint));
    }

    public async on(event: string, callback: EventCallback) {
        this._eventClient.on(event, callback);
    }

    public async off(event: string, callback: EventCallback) {
        this._eventClient.off(event, callback);
    }

    public async relayTransaction(txObj: Nimiq.Transaction) {
        return this._eventClient.call('relayTransaction', txObj);
    }

    public async getTransactionSize(txObj: Nimiq.Transaction) {
        return this._eventClient.call('getTransactionSize', txObj);
    }

    // 'connect' is not registered to the RPC server in network.js,
    // it is only meant to be used internally by autostart.js
    //
    // public async connect() {
    //     return this._eventClient.call('connect');
    // }

    public async subscribe(addresses: string | string[]) {
        return this._eventClient.call('subscribe', addresses);
    }

    public async getBalance(addresses: string | string[]): Promise<Map<string, number>> {
        return this._eventClient.call('getBalance', addresses) as Promise<Map<string, number>>;
    }

    public async getAccountTypeString(address: string) {
        return this._eventClient.call('getAccountTypeString', address);
    }

    public async requestTransactionHistory(
        addresses: string | string[],
        knownReceipts: Promise<Map<string, Nimiq.TransactionReceipt>>,
        fromHeight: number,
    ) {
        return this._eventClient.call('requestTransactionHistory', addresses, knownReceipts, fromHeight);
    }

    public async getGenesisVestingContracts() {
        return this._eventClient.call('getGenesisVestingContracts');
    }

    public async removeTxFromMempool(txObj: Nimiq.Transaction) {
        return this._eventClient.call('removeTxFromMempool', txObj);
    }
}
