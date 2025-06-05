<div align="center">
  <a href="https://webpack.js.org/">
    <img width="200" height="200" hspace="25" src="https://cdn.rawgit.com/webpack/media/e7485eb2/logo/icon-square-big.svg">
  </a>
</div>

[![npm][npm]][npm-url]
[![node][node]][node-url]
[![tests][tests]][tests-url]
[![coverage][cover]][cover-url]
[![discussion][discussion]][discussion-url]
[![size][size]][size-url]

# thread-loader

Runs the specified loaders in a worker pool.

## Getting Started

```bash
npm install --save-dev thread-loader
```

or

```bash
yarn add -D thread-loader
```

or

```bash
pnpm add -D thread-loader
```

Put this loader in front of other loaders.
The following loaders run in a worker pool.

Loaders running in a worker pool have limitations. Examples:

- Loaders cannot emit files.
- Loaders cannot use custom loader APIs (i.e. by plugins).
- Loaders cannot access webpack options.

Each worker is a separate Node.js process, which has an overhead of ~600ms. There is also additional overhead from inter-process communication.

> Use this loader only for expensive operations!

### Examples

**webpack.config.js**

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.js$/,
        include: path.resolve('src'),
        use: [
          'thread-loader',
          // your expensive loader (e.g babel-loader)
        ],
      },
    ],
  },
};
```

**with options**

```js
use: [
  {
    loader: 'thread-loader',
    // loaders with equal options will share worker pools
    options: {
      // the number of spawned workers, defaults to (number of cpus - 1) or
      // fallback to 1 when require('os').cpus() is undefined
      workers: 2,

      // number of jobs a worker processes in parallel
      // defaults to 20
      workerParallelJobs: 50,

      // additional node.js arguments
      workerNodeArgs: ['--max-old-space-size=1024'],

      // Allow to respawn a dead worker pool
      // respawning slows down the entire compilation
      // and should be set to false for development
      poolRespawn: false,

      // timeout for killing the worker processes when idle
      // defaults to 500 (ms)
      // can be set to Infinity for watching builds to keep workers alive
      poolTimeout: 2000,

      // number of jobs the pool distributes to the workers
      // defaults to 200
      // decrease for less efficient but more fair distribution
      poolParallelJobs: 50,

      // name of the pool
      // can be used to create different pools with otherwise identical options
      name: 'my-pool',
    },
  },
  // your expensive loader (e.g babel-loader)
];
```

**prewarming**

To prevent the high delays when booting workers, it is possible to warm up the worker pool.

This boots the max number of workers in the pool and loads the specified modules into the Node.js module cache.

```js
const threadLoader = require('thread-loader');

threadLoader.warmup(
  {
    // pool options, like passed to loader options
    // must match loader options to boot the correct pool
  },
  [
    // modules to load
    // can be any module, i.e.
    'babel-loader',
    '@babel/preset-env',
    'sass-loader',
  ]
);
```

## Contributing

We welcome all contributions!
If you're new here, please take a moment to review our contributing guidelines before submitting issues or pull requests.

[CONTRIBUTING](./.github/CONTRIBUTING.md)

## License

[MIT](./LICENSE)

[npm]: https://img.shields.io/npm/v/thread-loader.svg
[npm-url]: https://npmjs.com/package/thread-loader
[node]: https://img.shields.io/node/v/thread-loader.svg
[node-url]: https://nodejs.org
[tests]: https://github.com/webpack-contrib/thread-loader/workflows/thread-loader/badge.svg
[tests-url]: https://github.com/webpack-contrib/thread-loader/actions
[cover]: https://codecov.io/gh/webpack-contrib/thread-loader/branch/master/graph/badge.svg
[cover-url]: https://codecov.io/gh/webpack-contrib/thread-loader
[discussion]: https://img.shields.io/github/discussions/webpack/webpack
[discussion-url]: https://github.com/webpack/webpack/discussions
[size]: https://packagephobia.now.sh/badge?p=thread-loader
[size-url]: https://packagephobia.now.sh/result?p=thread-loader
