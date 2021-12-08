const path = require('path');

const MiniCssExtractPlugin = require('mini-css-extract-plugin'); // eslint-disable-line import/no-extraneous-dependencies

module.exports = {
  mode: 'none',
  context: __dirname,
  entry: ['./style.less'],
  output: {
    path: path.resolve('dist'),
  },
  module: {
    rules: [
      {
        test: /\.less$/,
        use: [
          MiniCssExtractPlugin.loader,
          path.resolve(__dirname, '../../dist/index.js'),
          'css-loader',
          'less-loader',
        ],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'style.css',
    }),
  ],
};
