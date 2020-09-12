const path = require('path');

// eslint-disable-next-line import/no-extraneous-dependencies
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

// eslint-disable-line import/no-extraneous-dependencies
const threadLoader = require('../dist');

module.exports = (env = {}) => {
  const workerPool = {
    workers: +env.threads,
    poolTimeout: env.watch ? Infinity : 2000,
  };
  const workerPoolSass = {
    workers: +env.threads,
    workerParallelJobs: 2,
    poolTimeout: env.watch ? Infinity : 2000,
  };

  if (+env.threads > 0) {
    threadLoader.warmup(workerPool, ['babel-loader', 'babel-preset-env']);
    threadLoader.warmup(workerPoolSass, ['sass-loader', 'css-loader']);
  }

  return {
    mode: 'development',
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
              loader: path.resolve(__dirname, '../dist/index.js'),
              options: workerPool,
            },
            'babel-loader',
          ].filter(Boolean),
        },
        {
          test: /\.scss$/,
          use: [
            MiniCssExtractPlugin.loader,
            env.threads !== 0 && {
              loader: path.resolve(__dirname, '../dist/index.js'),
              options: workerPoolSass,
            },
            'css-loader',
            'sass-loader',
          ].filter(Boolean),
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: 'style.css',
      }),
    ],
    stats: {
      children: false,
    },
  };
};
