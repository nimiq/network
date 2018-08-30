import {Network} from './network';
import {Config} from '@nimiq/utils';

const network = new Network(Config);
network.connect().catch(console.error);
