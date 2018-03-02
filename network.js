import Boruca from '/libraries/boruca-messaging/src/boruca.js';
import config from './config.js';

class Network {

    constructor() {
        // Check if we run in iframe or were opened by window.open()
        this._communicationTarget = window.parent || window.opener;

        const that = this;

        // TODO: To be replaced by NanoApi, essentially
        this.NetworkApi = class {
            getBalance(address) {
                return 25;
            }
        };


        if (this._communicationTarget) {
            this._connect();
        }
    }

    async _connect() {
        const { proxy } = await Boruca.proxy(this._communicationTarget, this._communicationTarget.origin, this.NetworkApi);
        this._events = proxy;

        this._events.fire('consensus-established');
        this._events.fire('balance-changed', 25);
    }
}

new Network();
