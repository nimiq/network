import NetworkClient from '@nimiq/network-client';

class App {
    async launchNetwork() {
        this.networkClient = new NetworkClient('https://network.nimiq-testnet.com');

        await this.networkClient.init();

        this.networkClient.on('nimiq-head-change', this._onHeadChange.bind(this));

        this.networkClient.on('nimiq-api-ready', () => console.log('NanoNetworkApi ready'));
        this.networkClient.on('nimiq-consensus-syncing', this._onConsensusSyncing.bind(this));
        this.networkClient.on('nimiq-consensus-established', this._onConsensusEstablished.bind(this));
        this.networkClient.on('nimiq-consensus-lost', this._onConsensusLost.bind(this));
        this.networkClient.on('nimiq-balances', this._onBalanceChanged.bind(this));
        this.networkClient.on('nimiq-api-fail', this._onApiFail.bind(this));
        this.networkClient.on('nimiq-transaction-pending', this._onTransaction.bind(this));
        this.networkClient.on('nimiq-transaction-expired', this._onTransactionExpired.bind(this));
        this.networkClient.on('nimiq-transaction-mined', this._onTransaction.bind(this));
        this.networkClient.on('nimiq-transaction-relayed', this._onTransactionRelayed.bind(this));
        this.networkClient.on('nimiq-peer-count', this._onPeerCountChanged.bind(this));
    }

    _onHeadChange() {

    }

    _onConsensusSyncing() {

    }

    _onConsensusEstablished() {

    }

    _onConsensusLost() {

    }

    _onBalanceChanged() {

    }

    _onApiFail() {

    }

    _onTransaction() {

    }

    _onTransactionExpired() {

    }

    _onTransactionRelayed() {

    }

    _onPeerCountChanged() {

    }
}

const app = new App();
app.launchNetwork();