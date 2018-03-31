function getConfig(host) {
    switch (host) {
        case 'https://network.nimiq.com':
            return {
                mode: 'main'
            };

        case 'https://network.nimiq-testnet.com':
            return {
                mode: 'test'
            };

        default:
            return {
                mode: 'dev'
            };
    }
}

const host = window.location.origin;

export default getConfig(host);
