import { EventServer } from '@nimiq/rpc-events';
import { ResponseStatus } from '@nimiq/rpc';
import { NanoApi } from '@nimiq/nano-api';

export class Network extends NanoApi {
    /**
     * @param {{cdn: string, network: string}} config
     */
    constructor(config) {
        super(config);
        this._eventServer = new EventServer();

        // Register RPC calls.
        this._registerCommand(
            'connect',
            () => this.connect().then((client) => undefined), // result client cannot be passed via postmessage
        );
        this._registerCommand('connectPico', this.connectPico);
        this._registerCommand('disconnect', this.disconnect);
        this._registerCommand('relayTransaction', this.relayTransaction);
        this._registerCommand('getTransactionSize', this.getTransactionSize);
        this._registerCommand('subscribe', this.subscribe);
        this._registerCommand('getBalance', this.getBalance);
        this._registerCommand('forgetBalances', this.forgetBalances);
        this._registerCommand('getAccounts', this.getAccounts);
        this._registerCommand('getAccountTypeString', this.getAccountTypeString);
        this._registerCommand('requestTransactionHistory', this.requestTransactionHistory);
        this._registerCommand('requestTransactionReceipts', this.requestTransactionReceipts);
        this._registerCommand('getGenesisVestingContracts', this.getGenesisVestingContracts);
        this._registerCommand('removeTxFromMempool', this.removeTxFromMempool);
        this._registerCommand('getPeerAddresses', this.getPeerAddresses);
        this._registerCommand('resetConsensus', () => this.client.resetConsensus());

        // Modern
        this._registerCommand('sendTransaction', this.sendTransaction);
        this._registerCommand('getTransactionsByAddress', this.getTransactionsByAddress);
        this._registerCommand('addTransactionListener', this.addTransactionListener);
        this._registerCommand('addConsensusChangedListener', this.addConsensusChangedListener);
        this._registerCommand('removeListener', this.removeListener);
    }

    fire(event, data) {
        this._eventServer.fire(event, data);
    }

    _registerCommand(command, handler) {
        this._eventServer.onRequest(
            command,
            // defining a bunch of parameters instead of only just using ...args as single rest parameter to circumvent
            // rpc lib's maximum expected arguments count check which is not compatible with rest parameters
            async (state, arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, ...args) => {
                const result = await (handler.bind(this)(arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, ...args));
                if (result !== undefined) return result;
                else {
                    // we have to reply manually to resolve the rpc call
                    state.reply(ResponseStatus.OK, result);
                }
            },
        );
    }
}
