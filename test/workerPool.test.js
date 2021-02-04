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
    expect(() => workerPool.createWorker()).toThrowError(
      'Please verify if you hit the OS open files limit'
    );
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

  it('should be able to run if the worker pool was not terminated', () => {
    const workerPool = new WorkerPool({});
    expect(workerPool.isAbleToRun()).toBe(true);
  });

  it('should not be able to run if the worker pool was terminated', () => {
    const workerPool = new WorkerPool({});
    workerPool.terminate();
    expect(workerPool.isAbleToRun()).toBe(false);
  });

  it('should sanitize nodeArgs when spawn a child process', () => {
    childProcess.spawn.mockClear();
    childProcess.spawn.mockImplementationOnce(() => {
      return {
        stdio: new Array(5).fill(new stream.PassThrough()),
        unref: jest.fn(),
      };
    });

    const workerPool = new WorkerPool({
      workerNodeArgs: ['--max-old-space-size=1024', '', null],
      workerParallelJobs: 20,
    });

    expect(() => workerPool.createWorker()).not.toThrow();

    const nonSanitizedNodeArgs = childProcess.spawn.mock.calls[0][1].filter(
      (opt) => !opt
    );
    expect(nonSanitizedNodeArgs.length).toEqual(0);
  });
});
