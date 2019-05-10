import { Network } from './network';

const CORE_VERSION = '1.4.1';

function getConfig() {
    switch (location.origin) {
        case 'nimiq.com':
            return {
                cdn: `https://cdn.nimiq.com/v${CORE_VERSION}/nimiq.js`,
                network: 'main',
            };
        default:
            return {
                cdn: `https://cdn.nimiq-testnet.com/v${CORE_VERSION}/nimiq.js`,
                network: 'test',
            }
    }
}

const network = new Network(getConfig());
network.connectPico([], false).catch(console.error);
