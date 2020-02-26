import { EventServer } from '@nimiq/rpc-events';
import { NanoNetworkApi } from '@nimiq/nano-api';

const CAN_BROADCAST = "BroadcastChannel" in window;

// Time to wait in seconds before deciding that we are the source node for sure.
// Communication via broadcast channels is incredibly fast, so this number can probably come down a lot.
const PATIENCE_TIME = 0.5; // seconds
function buildFWithLength(len, call = () => {}) {
    const fLengths = [
        () => call(),
        (a) => call(a),
        (a, b) => call(a, b),
        (a, b, c) => call(a, b, c),
        (a, b, c, d) => call(a, b, c, d),
        (a, b, c, d, e) => call(a, b, c, d, e),
        (a, b, c, d, e, f) => call(a, b, c, d, e, f),
        (a, b, c, d, e, f, g) => call(a, b, c, d, e, f, g),
    ];
    return fLengths[len];
}
function replaceSource(args, replaceWith = "REPLACE_WITH_WINDOW") {
    let replaced = null;
    args.forEach(it => {
        if (typeof it == "object") {
            Object.entries(it).forEach(entry => {
                if (entry[0] == "_source") {
            replaced = entry[1];
            it[entry[0]] = replaceWith;
                }
            });
        }
    });
    return replaced;
}

// Copied RandomUtils class as I was unable to access it.
// It was copied exactly so that it's an effortless switch if RandomUtils is made accessible to Network.
class RandomUtils {
    static generateRandomId() {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return array[0];
    }
}

export class Network extends NanoNetworkApi {
    /**
     * @param {{cdn: string, network: string}} config
     */
    constructor(config) {
        super(config);

        window.network = this;

        this._eventServer = new EventServer();

        // Public promise to communicate when an RPC client is connected.
        // Used by autostart.js to only trigger connect() after a client
        // is connected, so no events are fired before.
        this.rpcConnectedPromise = new Promise(res => {
            this._rpcConnectedPromiseResolver = res;
        });
        // Overwrite 'ping' handler of RpcEventServer, to detect a client connection.
        this._eventServer.onRequest('ping', () => {
            console.log('RPC connected');
            this._rpcConnectedPromiseResolver();
            return 'pong';
        });

        // Internal promise to track broadcast and Nimiq connection status.
        // Used to make sure events are only fired once we know if we are
        // the source or not and the broadcasting channel is set up.
        this._nimiqConnectedPromise = new Promise(res => {
            this._nimiqConnectedPromiseResolver = res;
        });

        // If we can't use broadcast channels, we know our place and it's as our own source node.
        this._knowsPlace = CAN_BROADCAST ? false : true;
        this._isSource = true;
        this._needsResponse = { };

        this._myID = RandomUtils.generateRandomId();
        this._dependents = [];
        this._mySource = 0;

        this._suggestionTracker = 0;
        this._acceptedPriority = 0;

        this._sourceInfo = null;
        this._peerCount = 0;
        this._headBlock = null;
        this._consensusState = '';

        // Define RPC calls.
        this._rpcMethods = [
            {
                name: "connect",
                runs: async () => {
                    return this.connect();
                }
            }, {
                name: "connectPico",
                runs: async (state, addresses) => {
                    return this.connectPico(addresses);
                }
            }, {
                name: "relayTransaction",
                runs: async (state, txObj) => {
                    return this.relayTransaction(txObj);
                }
            }, {
                name: "getTransactionSize",
                runs: async (state, txObj) => {
                    return this.getTransactionSize(txObj);
                }
            }, {
                name: "subscribe",
                runs: async (state, addresses) => {
                    return this.subscribe(addresses);
                }
            }, {
                name: "getBalance",
                runs: async (state, addresses) => {
                    return this.getBalance(addresses);
                }
            }, {
                name: "getAccountTypeString",
                runs: async (state, address) => {
                    return this.getAccountTypeString(address);
                }
            }, {
                name: "requestTransactionHistory",
                runs: async (state, addresses, knownReceipts, fromHeight) => {
                    return this.requestTransactionHistory(addresses, knownReceipts, fromHeight);
                }
            }, {
                name: "requestTransactionReceipts",
                runs: async (state, address) => {
                    return this.requestTransactionReceipts(address);
                }
            }, {
                name: "getGenesisVestingContracts",
                runs: async (state) => {
                    return this.getGenesisVestingContracts();
                }
            }, {
                name: "removeTxFromMempool",
                runs: async (state, txObj) => {
                    return this.removeTxFromMempool(txObj);
                }
            }
        ];

        // Register RPC calls.
        this._rpcMethods.forEach(e => {
            let f = buildFWithLength(e.runs.length, async (...args) => {
                return this.decide(() => {
                    return e.runs(...args);
                }, () => {
                    return this.broadcastRequest(e.name, args);
                });
            });

            this._eventServer.onRequest(e.name, f);
        });
    }

    setUpBroadcasting() {
        this._broadcastChannel = CAN_BROADCAST ? new BroadcastChannel("nimiq-rpc") : {
            postMessage: () => { },
            onmessage: () => { },
        };

        return new Promise(resolve => {
            setTimeout(() => {
                if (!this._knowsPlace) {
                    this._knowsPlace = true;
                    // Had alrady assumed we are the source node.
                    console.log("Timeout! - We are now the source");
                    resolve();
                }
            }, PATIENCE_TIME * 1000);

            this._broadcastChannel.onmessage = (message) => {
                if (typeof message.data != "object" || !("type" in message.data)) {
                    return;
                }

                console.debug("Broadcast RECEIVE", message.data);

                if (message.data.type == "nimiq-network-ping") {
                    if (message.data.targetId && message.data.targetId !== this._myID) {
                        return;
                    }

                    this.decide(() => {
                        if (!this._dependents.includes(message.data.senderID)) {
                            this._dependents.push(message.data.senderID);
                        }

                        this.broadcast({
                            type: "nimiq-network-pong",
                            info: {
                                peers: this._peerCount,
                                block: this._headBlock,
                                state: this._consensusState
                            }
                        }, message.target);
                    });
                } else if (message.data.type == "nimiq-network-pong") {
                    // We've received a response and now know we are not the source.
                    this._knowsPlace = true;
                    this._isSource = false;
                    this._mySource = message.data.senderID;
                    this._sourceInfo = message.data.info;
                    console.log("Got PONG! - We are not the source");
                    resolve();
                } else if (message.data.type == "nimiq-network-goodbye") {
                    if (!message.data.successors) {
                        // A non-source node left, remove it from dependants to avoid cycling through it
                        // during source negotiations.
                        this.decide(() => {
                            this._dependents = this._dependents.filter(id => id !== message.data.senderID);
                        });
                        return;
                    }

                    // We've received notification that the source node is leaving us.
                    // We now suggest that the node first seen by the previous source, be the new source.
                    // If that node hasn't responded accepting it's role as the new source in PATIENCE_TIME seconds, suggest the next source.

                    this._mySource = 0;

                    let suggestSource = (selectFrom, selectWhich) => {
                        const cast = {
                            type: "nimiq-network-suggestion",
                            suggestion: selectFrom[selectWhich],
                            priority: selectWhich
                        };
                        this.broadcast(cast, message.target); // Broadcast,
                        this._broadcastChannel.onmessage({data: cast}); // but also send to ourselves so we can react if we are the suggestion

                        this._suggestionTracker = setTimeout(() => {
                            if (this._mySource == 0) {
                                if (selectWhich < selectFrom.length - 1) {
                                    suggestSource(selectFrom, selectWhich + 1);
                                } else {
                                    this._isSource = true;
                                }
                            }
                        }, PATIENCE_TIME * 1000);
                    };

                    suggestSource(message.data.successors, 0);
                } else if (message.data.type == "nimiq-network-suggestion") {
                    // We've received a suggestion for a new source node.
                    // If we were the node suggested, we respond and accept the responsibility.
                    // If we were not the node suggested, we ignore the message and wait for the suggested node to accept or for another suggestion.

                    if (message.data.suggestion === this._myID) {
                        console.log("Source LEFT - We are now the source");
                        this.broadcast({
                            type: "nimiq-network-accepted",
                            priority: message.data.priority
                        }, message.target);
                        clearTimeout(this._suggestionTracker);

                        this._acceptedPriority = message.data.priority;
                        this._isSource = true;
                        super.connect();
                    }
                } else if (message.data.type == "nimiq-network-accepted") {
                    // We've received a response and have found our new source node.

                    // To prevent someone tricking us into leaving our source.
                    if (this._mySource !== 0) {
                        return;
                    }

                    if (this._acceptedPriority) {
                        if (message.data.priority < this._acceptedPriority) {
                            // We've previously accepted being a source node, but us being picked was a mistake (messages go too fast / too slow sometimes and two nodes may accept being the source).
                            // If there is a way to disconnect the node we should do so, otherwise we're just going to ignore our node and request from the source.

                            //this.disconnect(); ???
                        } else {
                            // We've previously accepted being a source node, and another node mistakenly also accepted.
                            // We ignore this accepted message and hope that the mistaken source node sees our accepted message and realizes it's mistake.
                            return;
                        }
                    }

                    console.log("Source LEFT! - We are still not the source");

                    this._mySource = message.data.senderID;
                    this._isSource = false;
                    this._acceptedPriority = 0;

                    this.broadcast({
                        type: "nimiq-network-ping",
                        targetId: this._mySource
                    });
                } else if (message.data.type == "nimiq-network-fire") {
                    if (message.data.senderID == this._mySource) {
                        this.fire(message.data.event, message.data.data);
                    }
                } else if (message.data.type == "nimiq-network-request") {
                    let requestedEvent = this._rpcMethods.find(e => e.name === message.data.request);
                    if (requestedEvent) {
                        replaceSource(message.data.args, window);
                        requestedEvent.runs(...message.data.args).then(response => {
                            replaceSource(message.data.args);
                            this.broadcast({
                                type: "nimiq-network-response",
                                request: message.data.request,
                                args: message.data.args,
                                response,
                                respondingToSender: message.data.senderID,
                                respondingToMessage: message.data.messageID,
                            }, message.target);
                        })
                    }
                } else if (message.data.type == "nimiq-network-response") {
                    // Only process messages sent from our source node.
                    // Only process messages specifically sent to us.
                    // Only process messages of a type that we are awaiting responses for.
                    if (message.data.senderID == this._mySource && message.data.respondingToSender == this._myID && message.data.request in this._needsResponse && this._needsResponse[message.data.request].length > 0) {
                        let stillNeedsResponse = [];

                        this._needsResponse[message.data.request].forEach(r => {
                            // If the response has the same args as the request, resolve that request.
                            if (message.data.respondingToMessage == r.id) {
                                r.resolve(message.data.response);
                            } else {
                                stillNeedsResponse.push(r);
                            }
                        });

                        // This pattern felt cleaner than a filter here using the negative of the condition used in if statement in the forEach above.
                        this._needsResponse[message.data.request] = stillNeedsResponse;
                    }
                }
            };
            window.addEventListener('beforeunload', (event) => {
                this.decide(() => {
                    this.broadcast({
                        type: "nimiq-network-goodbye",
                        successors: this._dependents
                    });
                }, () => {
                    this.broadcast({
                        type: "nimiq-network-goodbye",
                    });
                });
            });

            this.broadcast({
                type: "nimiq-network-ping",
            });

            if (!CAN_BROADCAST) {
                console.log("Broadcast API not available! - We are the source");
                resolve();
            }
        });
    }

    broadcast(message, channel = this._broadcastChannel) {
        let messageID = RandomUtils.generateRandomId();
        message.senderID = this._myID;
        message.messageID = messageID;

        console.debug("Broadcast SEND", message);
        channel.postMessage(message);
        return messageID;
    }

    broadcastRequest(method, args) {
        return new Promise((res, rej) => {
            if (!(method in this._needsResponse)) {
                this._needsResponse[method] = [];
            }

            let win = replaceSource(args);

            // Request a response from the source node.
            let id = this.broadcast({
                type: "nimiq-network-request",
                request: method,
                args,
            });

            // Register promise callbacks for when response comes in.
            this._needsResponse[method].push({
                resolve: function (...vals) {
                    replaceSource(args, this.win);
                    res(...vals);
                },
                reject: function (...vals) {
                    replaceSource(args, this.win);
                    rej(...vals);
                },
                args: args,
                win: win,
                id,
            });
        });
    }

    /**
     * Decides between 3 functions, returning a promise.
     *
     * @param {Function} a - If we know our place and our place is as the source node.
     * @param {Function} [b] - If we know our place and our place is not as the source (optional, otherwise nothing).
     * @param {Function} [c] - If we don't know our place (optional, otherwise attempt again in 1 second).
     */
    async decide(a, b, c) {
        if (this._knowsPlace) {
            if (this._isSource) {
                return a();
            } else if (b) {
                return b();
            }
        } else {
            if (c) {
                return c();
            } else {
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        // Try again in 1 second resolving if a or b are called, and default for c (trying again in 1 second).
                        this.decide(a, b).then(resolve).catch(reject);
                    }, 1000);
                });
            }
        }
    }

    async fire(event, data) {
        await this._nimiqConnectedPromise;

        this._eventServer.fire(event, data);

        if (event === "nimiq-api-ready") {
            if (this._sourceInfo) {
                if (this._sourceInfo.peers) {
                    this.fire("nimiq-peer-count", this._sourceInfo.peers);
                }

                if (this._sourceInfo.block) {
                    this.fire("nimiq-head-change", this._sourceInfo.block);
                }

                if (this._sourceInfo.state) {
                    this.fire(this._sourceInfo.state);
                }
            }
        } else {
            this.decide(() => {
                if (event == "nimiq-peer-count") {
                    this._peerCount = data;
                } else if (event == "nimiq-head-change") {
                    this._headBlock = data;
                } else if (event.startsWith("nimiq-consensus")) {
                    this._consensusState = event;
                }

                this.broadcast({
                    type: "nimiq-network-fire",
                    event,
                    data,
                });
            });
        }
    }

    async connect() {
        await this.setUpBroadcasting();
        await this.decide(() => {
            return super.connect();
        }, () => {
            return true;
        });
        // Start firing events
        console.log('Connected');
        this._nimiqConnectedPromiseResolver();
    }
}
