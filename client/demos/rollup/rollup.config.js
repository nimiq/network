// rollup.config.js
import resolve from 'rollup-plugin-node-resolve';
const dependencies = Object.keys(require('./package.json').dependencies);

export default [
    {
        input: 'src/demo.js',
        output: {
            format: 'umd',
            name: 'Demo',
            globals: {
                '@nimiq/network-client': 'NetworkClient'
            }
        },
        external: dependencies
    },
    {
        input: 'src/demo.js',
        output: {
            file: 'dist/demo.js',
            format: 'iife',
            name: 'Demo'
        },
        plugins: [
            resolve()
        ]
    }
];
