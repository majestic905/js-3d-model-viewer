/* global __dirname, require, module*/

const path = require('path');
const pkg = require('./package.json');


module.exports = {
    mode: 'production',
    entry: path.resolve(__dirname, 'src', 'index.js'),
    devtool: 'source-map',
    module: {
        rules: [
            {
                test: /(\.jsx|\.js)$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                },
                exclude: /(node_modules|bower_components)/
            }
        ]
    },
    resolve: {
        modules: [path.resolve('./node_modules'), path.resolve('./src')],
        extensions: ['.json', '.js']
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: `${pkg.name}.min.js`,
        library: pkg.name,
        libraryTarget: 'umd',
        umdNamedDefine: true
    },
};
