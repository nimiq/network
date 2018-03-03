import { EventServer, RPC } from '/libraries/boruca-messaging/src/boruca.js';
import NanoNetworkApi from '/libraries/nano-api/nano-network-api.js';

class Network {
    constructor() {
        this.connect();
    }

    async connect() {
        const eventServer = new EventServer();
        const stub = RPC.Server(NanoNetworkApi);
        stub.fire = (event, value) => eventServer.fire(event, value);
        await stub.init();
        await stub.connect();
    }
}

new Network();
