function getConfig(host) {
    switch (host) {
        case 'https://network.nimiq.com':
            return {
                mode: 'live'
            };

        case 'https://network.nimiq-testnet.com':
            return {
                mode: 'test'
            };

        default:
            return {
                mode: 'bounty'
            };
    }
}

const host = window.location.origin;

export default getConfig(host);
