import { EventServer } from '@nimiq/rpc-events';
import { NanoNetworkApi } from '@nimiq/nano-api';

export class Network extends NanoNetworkApi {
    /**
     * @param {{cdn: string, network: string}} config
     */
    constructor(config) {
        super(config);
        this._eventServer = new EventServer();

		// Define RPC calls.
		const interstingEvents = [
			{
				name : "connect",
				runs : () => {
					this.connect();
				}
			}, {
				name : "connectPico",
				runs : (state, addresses) => {
					this.connectPico(addresses);
				}
			}, {
				name : "relayTransaction",
				runs : (state, arg) => {
					this.relayTransaction(arg);
				}
			}, {
				name : "getTransactionSize",
				runs : (state, arg) => {
					this.getTransactionSize(arg);
				}
			}, {
				name : "subscribe",
				runs : (state, arg) => {
					this.subscribe(arg);
				}
			}, {
				name : "getBalance",
				runs : (state, arg) => {
					this.getBalance(arg);
				}
			}, {
				name : "getAccountTypeString",
				runs : (state, arg) => {
					this.getAccountTypeString(arg);
				}
			}, {
				name : "requestTransactionHistory",
				runs : (state, addresses, knownReceipts, fromHeight) => {
					this.requestTransactionHistory(addresses, knownReceipts, fromHeight);
				}
			}, {
				name : "requestTransactionReceipts",
				runs : (state, arg) => {
					this.requestTransactionReceipts(arg);
				}
			}, {
				name : "getGenesisVestingContracts",
				runs : (state, arg) => {
					this.getGenesisVestingContracts(arg);
				}
			}, {
				name : "removeTxFromMempool",
				runs : (state, arg) => {
					this.removeTxFromMempool(arg);
				}
			}
		];

		// Register RPC calls.
		interestingEvents.forEach((event) => {
			this._eventServer.onRequest(event.name, event.runs);
		})
    }

    fire(event, data) {
        this._eventServer.fire(event, data);
    }
}
