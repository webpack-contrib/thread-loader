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

const runPitch = options => pitch.call(
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
    },
  ),
);

it('validation', () => {
  runGetPoolMock(null);
  expect(() => runPitch({})).not.toThrow();

  runGetPoolMock(new Error('Unexpected Error'));
  expect(() => runPitch({})).toThrowErrorMatchingSnapshot();
});
