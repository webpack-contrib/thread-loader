const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin'); // eslint-disable-line import/no-extraneous-dependencies
const threadLoader = require('thread-loader'); // eslint-disable-line import/no-extraneous-dependencies

module.exports = (env) => {
  const workerPool = {
    workers: +env.threads,
  };
  threadLoader.warmup(workerPool, ['babel-loader', 'babel-preset-env', 'sass-loader', 'css-loader']);
  return {
    context: __dirname,
    entry: ['react', 'lodash-es', './index.js'],
    output: {
      path: path.resolve('dist'),
      filename: 'bundle.js',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          use: [
            env.threads !== 0 && {
              loader: 'thread-loader',
              options: workerPool,
            },
            'babel-loader',
          ].filter(Boolean),
        },
        {
          test: /\.scss$/,
          use: ExtractTextPlugin.extract({
            use: [
              env.threads !== 0 && {
                loader: 'thread-loader',
                options: workerPool,
              },
              'css-loader',
              'sass-loader',
            ].filter(Boolean),
          }),
        },
      ],
    },
    plugins: [
      new ExtractTextPlugin('style.css'),
    ],
    stats: {
      children: false,
    },
  };
};
