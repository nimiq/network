import {Network} from './network';

function getConfig() {
    switch (location.origin) {
        case 'nimiq.com':
            return {
                cdn: 'https://cdn.nimiq.com/nimiq.js',
                network: 'main',
            };
        default:
            return {
                cdn: 'https://cdn.nimiq-network.com/branches/max-volatile-pico/nimiq.js',
                // cdn: 'http://localhost:8003/dist/nimiq.js',
                network: 'test',
            }
    }
}

const network = new Network(getConfig());
network.connect().catch(console.error);
