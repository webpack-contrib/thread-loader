const path = require('path');

const threadLoader = require('../../src'); // eslint-disable-line import/no-extraneous-dependencies

module.exports = (env) => {
  const workerPool = {
    workers: +env.threads,
    poolTimeout: env.watch ? Infinity : 2000,
  };
  if (+env.threads > 0) {
    threadLoader.warmup(workerPool, ['ts-loader']);
  }
  return {
    mode: 'none',
    context: __dirname,
    devtool: false,
    entry: ['./index.ts'],
    output: {
      path: path.resolve('dist'),
      filename: 'bundle.js',
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [
            env.threads !== 0 && {
              loader: path.resolve(__dirname, '../../dist/index.js'),
              options: workerPool,
            },
            { loader: 'ts-loader', options: { happyPackMode: true } },
          ].filter(Boolean),
        },
      ],
    },
    stats: {
      children: false,
    },
  };
};
