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
        rootContext: path.resolve('../'),
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
