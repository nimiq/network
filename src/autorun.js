import {Network} from './network';

// todo own entry point for each config OR pass it via url parameters

function getConfig() {
    switch (location.origin) {
        case 'nimiq.com':
            return {
                cdn: 'https://cdn.nimiq.com/nimiq.js',
                network: 'main',
            };
        default:
            return {
                cdn: 'https://cdn.nimiq-network.com/branches/marvin-pico-consensus/nimiq.js',
                network: 'main',
            }
    }
}

const network = new Network(getConfig());
network.connect().catch(console.error);
