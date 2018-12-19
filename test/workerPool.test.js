import childProcess from 'child_process';
import stream from 'stream';
import WorkerPool from '../src/WorkerPool';

jest.mock('child_process', () => {
  return {
    spawn: jest.fn(() => {
      return {
        unref: jest.fn(),
      };
    }),
  };
});

describe('workerPool', () => {
  it('should throw an error when worker.stdio is undefined', () => {
    const workerPool = new WorkerPool({});
    expect(() => workerPool.createWorker()).toThrowErrorMatchingSnapshot();
    expect(() => workerPool.createWorker()).toThrowError('Please verify if you hit the OS open files limit');
  });

  it('should not throw an error when worker.stdio is defined', () => {
    childProcess.spawn.mockImplementationOnce(() => {
      return {
        stdio: new Array(5).fill(new stream.PassThrough()),
        unref: jest.fn(),
      };
    });

    const workerPool = new WorkerPool({});
    expect(() => workerPool.createWorker()).not.toThrow();
  });
});
