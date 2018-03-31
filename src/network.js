import { EventServer, RPC } from '/libraries/boruca-messaging/src/boruca.js';
import NanoNetworkApi from '/libraries/nano-api/nano-network-api.js';
import config from './config.js';

class Network {
    constructor() {
        this.connect();
    }

    async connect() {
        const eventServer = new EventServer();
        const network = RPC.Server(NanoNetworkApi(config));
        network.fire = (event, value) => eventServer.fire(event, value);

        await network.connect();
    }
}

new Network();