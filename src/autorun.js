import { Network } from './network';
import { Config } from '@nimiq/utils';

const network = new Network(Config);
network.connectPico([], false).catch(console.error);
