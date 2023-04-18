import path from 'path';

import { pitch } from '../src/cjs';
import { getPool } from '../src/workerPools';

jest.mock('../src/workerPools', () => {
  return {
    getPool: jest.fn(),
  };
});

const runGetPoolMock = (error) => {
  getPool.mockImplementationOnce(() => {
    return {
      isAbleToRun: () => true,
      run: jest.fn((opts, cb) => {
        cb(error, {
          buildDependencies: [],
          missingDependencies: [],
          fileDependencies: [],
          contextDependencies: [],
          result: {},
        });
      }),
    };
  });
};

const runPitch = (options) =>
  pitch.call(
    Object.assign(
      {},
      {
        query: options,
        loaders: [],
        _compiler: { fsStartTime: Date.now() },
        _compilation: {
          outputOptions: {
            assetModuleFilename: '[hash][ext][query]',
            asyncChunks: true,
            charset: true,
            chunkFilename: '[id].bundle.js',
            chunkFormat: 'array-push',
            chunkLoading: 'jsonp',
            chunkLoadingGlobal: 'webpackChunk',
            chunkLoadTimeout: 120000,
            cssFilename: 'bundle.css',
            cssChunkFilename: '[id].bundle.css',
            clean: undefined,
            compareBeforeEmit: true,
            crossOriginLoading: false,
            devtoolFallbackModuleFilenameTemplate: undefined,
            devtoolModuleFilenameTemplate: undefined,
            devtoolNamespace: '',
            environment: {
              arrowFunction: true,
              const: true,
              destructuring: true,
              forOf: true,
              bigIntLiteral: undefined,
              dynamicImport: undefined,
              module: undefined,
            },
            enabledChunkLoadingTypes: ['jsonp', 'import-scripts'],
            enabledLibraryTypes: [],
            enabledWasmLoadingTypes: ['fetch'],
            filename: 'bundle.js',
            globalObject: 'self',
            hashDigest: 'hex',
            hashDigestLength: 20,
            hashFunction: 'md4',
            hashSalt: undefined,
            hotUpdateChunkFilename: '[id].[fullhash].hot-update.js',
            hotUpdateGlobal: 'webpackHotUpdate',
            hotUpdateMainFilename: '[runtime].[fullhash].hot-update.json',
            iife: true,
            importFunctionName: 'import',
            importMetaName: 'import.meta',
            scriptType: false,
            library: undefined,
            module: false,
            path: '/Applications/SAPDevelop/forks/thread-loader/dist',
            pathinfo: false,
            publicPath: 'auto',
            sourceMapFilename: '[file].map[query]',
            sourcePrefix: undefined,
            strictModuleExceptionHandling: false,
            trustedTypes: undefined,
            uniqueName: '',
            wasmLoading: 'fetch',
            webassemblyModuleFilename: '[hash].module.wasm',
            workerPublicPath: '',
            workerChunkLoading: 'import-scripts',
            workerWasmLoading: 'fetch',
          },
        },
        rootContext: path.resolve('../'),
        getOptions: () => {
          return { workers: NaN, poolTimeout: 2000 };
        },
        async: () => (error) => {
          if (error) {
            throw error;
          }
        },
      }
    )
  );

// it('runs pitch successfully when workPool not throw an error', () => {
//   runGetPoolMock(null);
//   expect(() => runPitch({})).not.toThrow();
// });

it('runs pitch unsuccessfully when workPool throw an error', () => {
  runGetPoolMock(new Error('Unexpected Error'));
  expect(() => runPitch({})).toThrowErrorMatchingSnapshot();
});
