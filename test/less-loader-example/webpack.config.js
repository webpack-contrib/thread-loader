const path = require('path');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const threadLoader = require('../../dist'); // eslint-disable-line import/no-extraneous-dependencies

module.exports = (env) => {
  const workerPool = {
    workers: +env.threads,
    workerParallelJobs: 2,
    poolTimeout: env.watch ? Infinity : 2000,
  };
  if (+env.threads > 0) {
    threadLoader.warmup(workerPool, ['less-loader', 'css-loader']);
  }
  return {
    mode: 'none',
    context: __dirname,
    devtool: false,
    entry: ['./index.js'],
    output: {
      path: path.resolve('dist'),
      filename: 'bundle.js',
    },
    module: {
      rules: [
        {
          test: /\.less$/,
          use: [
            MiniCssExtractPlugin.loader,
            env.threads !== 0 && {
              loader: path.resolve(__dirname, '../../dist/index.js'),
              options: workerPool,
            },
            'css-loader',
            'less-loader',
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
