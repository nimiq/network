import Boruca from '/libraries/boruca-messaging/src/boruca.js';
import NanoNetworkApi from '/libraries/nano-api/nano-network-api.js';
import config from './config.js';

class Network {

    constructor() {
        // Check if we run in iframe or were opened by window.open()
        this._communicationTarget = window.parent || window.opener;

        const that = this;

        if (this._communicationTarget) {
            this._connect();
        }
    }

    async _connect() {
        const { proxy, stub } = await Boruca.proxy(this._communicationTarget, this._communicationTarget.origin, NanoNetworkApi);
        stub.fire = (event, value) => proxy.fire(event, value);
        await stub.init();
        await stub.connect();
    }
}

new Network();
