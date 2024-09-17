const path = require('path');

const threadLoader = require('../../dist'); // eslint-disable-line import/no-extraneous-dependencies

module.exports = (env) => {
  const workerPool = {
    workers: +env.threads,
    workerParallelJobs: 2,
    poolTimeout: env.watch ? Infinity : 2000,
  };
  if (+env.threads > 0) {
    threadLoader.warmup(workerPool, [require.resolve('./test-loader.js')]);
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
          test: /test\.js$/,
          use: [
            env.threads !== 0 && {
              loader: path.resolve(__dirname, '../../dist/index.js'),
              options: workerPool,
            },
            {
              loader: require.resolve('./test-loader'),
              options: {
                test: /test/i,
              },
            },
          ],
        },
      ],
    },
  };
};
