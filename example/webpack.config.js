const path = require('path');

module.exports = (env) => ({
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
            options: {
              workers: +env.threads,
            },
          },
          'babel-loader',
        ].filter(Boolean),
      },
    ],
  },
});
