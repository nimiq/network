// rollup.config.js
export default [
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
    }
];
