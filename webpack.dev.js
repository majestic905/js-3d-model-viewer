const { merge } = require('webpack-merge')
const common = require('./webpack.config.js')
const path = require('path');
const pkg = require("./package.json");


module.exports = merge(common, {
    mode: 'development',
    devtool: 'eval-source-map',
    output: {
        filename: `${pkg.name}.js`,
    },
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        webSocketServer: false,
        hot: true,
    }
});