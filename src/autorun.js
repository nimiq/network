import { Network } from './network';

const CORE_VERSION = '1.4.1';

function getConfig() {
    switch (location.host) {
        case 'network.nimiq.com':
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
const params = new URLSearchParams(window.location.hash.substring(1));
if (params.get('consensusType') === 'nano') {
    network.connect().catch(console.error);
} else {
    network.connectPico([], false).catch(console.error);
}
