// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
const dependencies = Object.keys(require('./package.json').dependencies);

export default [
    {
        input: 'src/network.js',
        output: {
            file: 'dist/network.common.js',
            format: 'cjs'
        },
        external: dependencies
    },
    {
        input: 'src/network.js',
        output: {
            file: 'dist/network.umd.js',
            format: 'umd',
            name: 'Network',
            globals: {
                '@nimiq/rpc-events': 'Rpc',
                '@nimiq/nano-api': 'window'
            }
        },
        external: dependencies
    },
    {
        input: 'src/network.js',
        output: {
            file: 'dist/network.es.js',
            format: 'es'
        },
        external: dependencies
    },
    {
        input: 'src/autorun.js',
        output: {
            file: `nimiq-dist/network.${process.env._HASH ? `${process.env._HASH}.` : ''}js`,
            format: 'iife',
            name: 'Network'
        },
        plugins: [
            resolve()
        ]
    }
];
