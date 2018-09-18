import { PostMessageRpcClient } from '@nimiq/rpc';
import { EventClient } from '@nimiq/rpc-events';

export default class NetworkClient {
    private static readonly DEFAULT_ENDPOINT = '../src';

    private readonly _endpoint: string;
    private readonly _observable: Nimiq.Observable;
    private _postMessageClient!: PostMessageRpcClient;
    public eventClient!: EventClient;
    private $iframe!: HTMLIFrameElement;

    constructor(endpoint: string = NetworkClient.DEFAULT_ENDPOINT) {
        this._endpoint = endpoint;
        this._observable = new Nimiq.Observable();
    }

    private static getAllowedOrigin(endpoint: string) {
        // FIXME derive from endpoint url
        return '*';
    }

    public async init() {
        this.$iframe = await NetworkClient._createIframe(this._endpoint) as HTMLIFrameElement;
        const targetWindow = this.$iframe.contentWindow as Window;

        this._postMessageClient = new PostMessageRpcClient(targetWindow, NetworkClient.getAllowedOrigin(this._endpoint));
        this.eventClient = await EventClient.create(targetWindow);
    }

    private static async _createIframe(src: string): Promise<HTMLIFrameElement> {
        const $iframe = document.createElement('iframe');
        const promise = new Promise<HTMLIFrameElement>(resolve => $iframe.addEventListener('load', () => resolve($iframe)));
        $iframe.src = src;
        $iframe.name = 'network';
        document.body.appendChild($iframe);
        return promise;
    }
}