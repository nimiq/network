import { Network } from './network';

const CORE_VERSION = '1.5.8';

function getConfig() {
    switch (location.host) {
        case 'network.nimiq.com':
            return {
                // cdn: `https://cdn.nimiq.com/v${CORE_VERSION}/nimiq.js`,
                cdn: '/nimiq/nimiq.js',
                network: 'main',
            };
        default:
            return {
                // cdn: `https://cdn.nimiq-testnet.com/v${CORE_VERSION}/nimiq.js`,
                cdn: '/nimiq/nimiq.js',
                network: 'test',
            }
    }
}

const network = new Network(getConfig());
network.connect().catch(console.error);
