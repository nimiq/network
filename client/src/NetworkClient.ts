import { EventClient, EventCallback } from '@nimiq/rpc-events';

export type PlainTransaction = {
    sender: string,
    senderPubKey: Uint8Array,
    recipient: string,
    value: number,
    fee: number,
    validityStartHeight: number,
    signature: Uint8Array,
    extraData?: string | Uint8Array,
}

export class NetworkClient {
    private static readonly DEFAULT_ENDPOINT = 'https://network.nimiq-testnet.com';

    private static getAllowedOrigin(endpoint: string) {
        const url = new URL(endpoint);
        return url.origin;
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
        if (this._eventClient) return;
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

    public async relayTransaction(txObj: PlainTransaction) {
        return this._eventClient.call('relayTransaction', txObj);
    }

    public async getTransactionSize(txObj: PlainTransaction) {
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
        addresses: string | string[], // userfriendly addresses
        knownReceipts: Map<string, Map<string, string>>, // Map<address (userfriendly), Map<txhash (base64), blockhash (base64)>>
        fromHeight?: number,
    ) {
        return this._eventClient.call('requestTransactionHistory', addresses, knownReceipts, fromHeight);
    }

    public async getGenesisVestingContracts() {
        return this._eventClient.call('getGenesisVestingContracts');
    }

    public async removeTxFromMempool(txObj: PlainTransaction) {
        return this._eventClient.call('removeTxFromMempool', txObj);
    }
}
