// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';

export default [
    {
        input: 'build/NetworkClient.js',
        output: {
            file: 'dist/NetworkClient.common.js',
            format: 'cjs',
            globals: { '@nimiq/rpc-events': 'rpc-events' }
        },
        external: [ '@nimiq/rpc-events' ]
    },
    {
        input: 'build/NetworkClient.js',
        output: {
            file: 'dist/NetworkClient.umd.js',
            format: 'umd',
            name: 'NetworkClient',
            globals: { '@nimiq/rpc-events': 'rpc-events' }
        },
        external: [ '@nimiq/rpc-events' ]
    },
    {
        input: 'build/NetworkClient.js',
        output: {
            file: 'dist/NetworkClient.es.js',
            format: 'es',
            name: 'NetworkClient',
            globals: { '@nimiq/rpc-events': 'rpc-events' }
        },
        external: [ '@nimiq/rpc-events' ]
    },
    {
        input: 'build/NetworkClient.js',
        output: {
            file: 'dist/NetworkClient.standalone.umd.js',
            format: 'umd',
            name: 'NetworkClient',
            globals: { '@nimiq/rpc-events': 'rpc-events' }
        },
        plugins: [
            resolve()
        ]
    },
    {
        input: 'build/NetworkClient.js',
        output: {
            file: 'dist/NetworkClient.standalone.es.js',
            format: 'es',
            name: 'NetworkClient',
            globals: { '@nimiq/rpc-events': 'rpc-events' }
        },
        plugins: [
            resolve()
        ]
    }
];
