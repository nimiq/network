import { EventClient, EventCallback } from '@nimiq/rpc-events';

type PlainNimiqTransaction = ReturnType<import ('@nimiq/core-web').Transaction["toPlain"]>;
type PlainNimiqTransactionReceipt = ReturnType<import ('@nimiq/core-web').TransactionReceipt["toPlain"]>;
type PlainNimiqTransactionDetails = ReturnType<import ('@nimiq/core-web').Client.TransactionDetails["toPlain"]>;
type PlainNimiqVestingContract = ReturnType<import ('@nimiq/core-web').VestingContract["toPlain"]>;

// tslint:disable:interface-over-type-literal
export type PlainTransaction = {
    sender: string,
    senderPubKey: Uint8Array,
    recipient: string,
    value: number, // in NIM
    fee: number, // IN NIM
    validityStartHeight: number,
    signature: Uint8Array,
    extraData?: string | Uint8Array,
};

export type DetailedPlainTransaction = {
    sender: string,
    recipient: string,
    value: number, // in NIM
    fee: number, // IN NIM
    extraData: Uint8Array,
    hash: string, // base64
    blockHeight: number,
    blockHash?: string, // base64
    timestamp: number,
    validityStartHeight: number,
};

export type PlainVestingContract = {
    address: string,
    owner: string,
    start: number,
    stepAmount: number,
    stepBlocks: number,
    totalAmount: number,
};

export type PlainAddressInfo = {
    banned: boolean,
    connected: boolean,
    netAddress: {
        ip: Uint8Array,
        reliable: boolean,
    } | null,
    peerAddress: string,
    peerId: string,
    services: Array<'FULL_BLOCKS'|'BLOCK_HISTORY'|'BLOCK_PROOF'|'CHAIN_PROOF'|'ACCOUNTS_PROOF'|'ACCOUNTS_CHUNKS'|'MEMPOOL'|'TRANSACTION_INDEX'|'BODY_PROOF'>,
};
// tslint:enable:interface-over-type-literal

class NetworkClient {
    public static readonly DEFAULT_ENDPOINT =
        window.location.origin.endsWith('nimiq.com')
            ? 'https://network.nimiq.com'
            : 'https://network.nimiq-testnet.com';

    public static createInstance(endPoint: string = NetworkClient.DEFAULT_ENDPOINT) {
        if (NetworkClient._instance) throw new Error('NetworkClient already instantiated.');
        const networkClient = new NetworkClient(endPoint);
        NetworkClient._instance = networkClient;
        return networkClient;
    }

    public static hasInstance() {
        return !!NetworkClient._instance;
    }

    public static get Instance(): NetworkClient {
        return NetworkClient._instance || (NetworkClient._instance = new NetworkClient());
    }

    private static _instance: NetworkClient | null = null;

    private static getAllowedOrigin(endpoint: string): string {
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
    private _initializationPromise?: Promise<void>;
    private _apiLoadingState: 'not-started' | 'ready' | 'failed' = 'not-started';
    private _consensusState: 'syncing' | 'established' | 'lost' = 'syncing';
    private _peerCount: number = 0;
    private _headInfo: { height: number, globalHashrate: number } = { height: 0, globalHashrate: 0 };
    private _balances: Map<string, number> = new Map<string, number>();
    private _pendingTransactions: Map<string, Partial<DetailedPlainTransaction>>
        = new Map<string, Partial<DetailedPlainTransaction>>();
    private _expiredTransactions: Array<[number, string]> = [];
    private _minedTransactions: Map<string, DetailedPlainTransaction> = new Map<string, DetailedPlainTransaction>();
    private _relayedTransactions: Map<string, Partial<DetailedPlainTransaction>> =
        new Map<string, Partial<DetailedPlainTransaction>>();

    private constructor(endpoint: string = NetworkClient.DEFAULT_ENDPOINT) {
        this._endpoint = endpoint + '/v2/';
    }

    public async init() {
        this._initializationPromise = this._initializationPromise || (async () => {
            this.$iframe = await NetworkClient._createIframe(this._endpoint);
            const targetWindow = this.$iframe.contentWindow!;
            this._eventClient = await EventClient.create(targetWindow, NetworkClient.getAllowedOrigin(this._endpoint));

            this.on(NetworkClient.Events.API_READY, () => this._apiLoadingState = 'ready');
            this.on(NetworkClient.Events.API_FAIL, () => this._apiLoadingState = 'failed');
            this.on(NetworkClient.Events.CONSENSUS_SYNCING, () => this._consensusState = 'syncing');
            this.on(NetworkClient.Events.CONSENSUS_ESTABLISHED, () => this._consensusState = 'established');
            this.on(NetworkClient.Events.CONSENSUS_LOST, () => this._consensusState = 'lost');
            this.on(NetworkClient.Events.PEERS_CHANGED, (peerCount: number) => this._peerCount = peerCount);
            this.on(NetworkClient.Events.BALANCES_CHANGED,
                (balances: Map<string, number>) => this._balances = balances);
            this.on(NetworkClient.Events.TRANSACTION_PENDING,
                (tx: Partial<DetailedPlainTransaction>) => this._pendingTransactions.set(tx.hash!, tx));
            this.on(NetworkClient.Events.TRANSACTION_EXPIRED, (txHash: string) => {
                this._expiredTransactions.push([this.headInfo.height, txHash]);
                this._pendingTransactions.delete(txHash);
                this._relayedTransactions.delete(txHash);
            });
            this.on(NetworkClient.Events.TRANSACTION_MINED, (tx: DetailedPlainTransaction) => {
                this._minedTransactions.set(tx.hash, tx);
                this._pendingTransactions.delete(tx.hash);
                this._relayedTransactions.delete(tx.hash);
            });
            this.on(NetworkClient.Events.TRANSACTION_RELAYED, (tx: Partial<DetailedPlainTransaction>) => {
                tx.blockHeight = this.headInfo.height;
                this._relayedTransactions.set(tx.hash!, tx);
            });
            this.on(NetworkClient.Events.HEAD_CHANGE, (headInfo: { height: number, globalHashrate: number}) => {
                this._headInfo = headInfo;
                this._evictCachedTransactions();
            });
        })();

        try {
            await this._initializationPromise;
        } catch (e) {
            delete this._initializationPromise;
            throw e;
        }
    }

    public async on(event: NetworkClient.Events, callback: EventCallback) {
        this._eventClient.on(event, callback);
    }

    public async off(event: NetworkClient.Events, callback: EventCallback) {
        this._eventClient.off(event, callback);
    }

    public async connect(): Promise<boolean> {
        return this._eventClient.call('connect');
    }

    public async relayTransaction(txObj: PlainTransaction): Promise<object> {
        return this._eventClient.call('relayTransaction', txObj);
    }

    public async getTransactionSize(txObj: PlainTransaction): Promise<number> {
        return this._eventClient.call('getTransactionSize', txObj);
    }

    public async subscribe(addresses: string | string[]): Promise<boolean> {
        return this._eventClient.call('subscribe', addresses);
    }

    public async getBalance(addresses: string | string[]): Promise<Map<string, number>> {
        return this._eventClient.call('getBalance', addresses) as Promise<Map<string, number>>;
    }

    public async getAccountTypeString(address: string): Promise<string|false> {
        return this._eventClient.call('getAccountTypeString', address);
    }

    public async requestTransactionHistory(
        addresses: string | string[], // userfriendly addresses
        knownReceipts: Map<string, string>, // Map<txhash (base64), blockhash (base64)>
        fromHeight?: number,
    ): Promise<{
        newTransactions: DetailedPlainTransaction[],
        // removedTransactions: string[],
        wasRateLimited: boolean,
    }> {
        return this._eventClient.call('requestTransactionHistory', addresses, knownReceipts, fromHeight);
    }

    public async requestTransactionReceipts(addresses: string, limit?: number): Promise<PlainNimiqTransactionReceipt[]> {
        return this._eventClient.call('requestTransactionReceipts', addresses, limit);
    }

    public async getGenesisVestingContracts(): Promise<PlainVestingContract[]>
    public async getGenesisVestingContracts(modern: true): Promise<PlainNimiqVestingContract[]> // MODERN
    public async getGenesisVestingContracts(modern?: boolean): Promise<(PlainVestingContract|PlainNimiqVestingContract)[]> {
        return this._eventClient.call('getGenesisVestingContracts', modern);
    }

    public async removeTxFromMempool(txObj: PlainTransaction): Promise<boolean> {
        return this._eventClient.call('removeTxFromMempool', txObj);
    }

    public async getPeerAddresses(): Promise<PlainAddressInfo[]> {
        return this._eventClient.call('getPeerAddresses');
    }

    // MODERN

    public async sendTransaction(tx: PlainNimiqTransaction | string): Promise<PlainNimiqTransactionDetails> {
        return this._eventClient.call('sendTransaction', tx);
    }

    public async getTransactionsByAddress(
        address: string,
        sinceHeight?: number,
        knownDetails?: PlainNimiqTransactionDetails[],
        limit?: number
    ): Promise<PlainNimiqTransactionDetails[]> {
        return this._eventClient.call('getTransactionsByAddress', address, sinceHeight, knownDetails, limit);
    }

    // Getter

    public get apiLoadingState(): 'not-started' | 'ready' | 'failed' {
        return this._apiLoadingState;
    }

    public get consensusState(): 'syncing' | 'established' | 'lost' {
        return this._consensusState;
    }

    public get peerCount(): number {
        return this._peerCount;
    }

    public get headInfo(): { height: number, globalHashrate: number } {
        return this._headInfo;
    }

    public get balances(): Map<string, number> {
        return this._balances;
    }

    public get pendingTransactions(): Iterable<Partial<DetailedPlainTransaction>> {
        return this._pendingTransactions.values();
    }

    public get minedTransactions(): Iterable<DetailedPlainTransaction> {
        return this._minedTransactions.values();
    }

    public get relayedTransactions(): Iterable<Partial<DetailedPlainTransaction>> {
        return this._relayedTransactions.values();
    }

    /** @returns base64 transaction hashes */
    public get expiredTransactions(): Iterable<string> {
        return this._expiredTransactions.map(([height, txHash]) => txHash);
    }

    // Private methods

    private _evictCachedTransactions() {
        const CACHE_DURATION = 30;
        // purge expired transactions
        for (let i = 0; i < this._expiredTransactions.length; ++i) {
            const [expiredAt] = this._expiredTransactions[i];
            if (expiredAt + CACHE_DURATION <= this.headInfo.height) {
                this._expiredTransactions.splice(i, 1);
                --i;
            }
        }
        // purge mined transactions
        for (const tx of this._minedTransactions.values()) {
            if (tx.blockHeight + CACHE_DURATION <= this.headInfo.height) {
                this._minedTransactions.delete(tx.hash);
            }
        }
    }
}

namespace NetworkClient { // tslint:disable-line:no-namespace
    export enum Events {
        API_READY = 'nimiq-api-ready',
        API_FAIL = 'nimiq-api-fail',
        CONSENSUS_SYNCING = 'nimiq-consensus-syncing',
        CONSENSUS_ESTABLISHED = 'nimiq-consensus-established',
        CONSENSUS_LOST = 'nimiq-consensus-lost',
        PEERS_CHANGED = 'nimiq-peer-count',
        BALANCES_CHANGED = 'nimiq-balances',
        TRANSACTION_PENDING = 'nimiq-transaction-pending',
        TRANSACTION_EXPIRED = 'nimiq-transaction-expired',
        TRANSACTION_MINED = 'nimiq-transaction-mined',
        TRANSACTION_RELAYED = 'nimiq-transaction-relayed',
        HEAD_CHANGE = 'nimiq-head-change',

        HEAD_HEIGHT = 'head-height',
        CONSENSUS = 'consensus',
        BALANCES = 'balances',
        TRANSACTION = 'transaction',
        PEER_COUNT = 'peer-count',
        PEER_ADDRESSES_ADDED = 'peer-addresses-added',
    }
}

export { NetworkClient };
