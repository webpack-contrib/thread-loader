/* eslint-disable no-console */

import childProcess from 'child_process';

import asyncQueue from 'async/queue';
import asyncMapSeries from 'async/mapSeries';

import readBuffer from './readBuffer';
import WorkerError from './WorkerError';

const workerPath = require.resolve('./worker');

let workerId = 0;

class PoolWorker {
  constructor(options, onJobDone) {
    this.nextJobId = 0;
    this.jobs = Object.create(null);
    this.activeJobs = 0;
    this.onJobDone = onJobDone;
    this.id = workerId;
    workerId += 1;
    this.worker = childProcess.spawn(
      process.execPath,
      []
        .concat(options.nodeArgs || [])
        .concat(workerPath, options.parallelJobs),
      {
        stdio: ['ignore', 1, 2, 'pipe', 'pipe'],
      }
    );
    const [, , , readPipe, writePipe] = this.worker.stdio;
    this.readPipe = readPipe;
    this.writePipe = writePipe;
    this.readNextMessage();
  }

  run(data, callback) {
    const jobId = this.nextJobId;
    this.nextJobId += 1;
    this.jobs[jobId] = { data, callback };
    this.activeJobs += 1;
    this.writeJson({
      type: 'job',
      id: jobId,
      data,
    });
  }

  warmup(requires) {
    this.writeJson({
      type: 'warmup',
      requires,
    });
  }

  writeJson(data) {
    const lengthBuffer = new Buffer(4);
    const messageBuffer = new Buffer(JSON.stringify(data), 'utf-8');
    lengthBuffer.writeInt32BE(messageBuffer.length, 0);
    this.writePipe.write(lengthBuffer);
    this.writePipe.write(messageBuffer);
  }

  writeEnd() {
    const lengthBuffer = new Buffer(4);
    lengthBuffer.writeInt32BE(0, 0);
    this.writePipe.write(lengthBuffer);
  }

  readNextMessage() {
    this.state = 'read length';
    this.readBuffer(4, (lengthReadError, lengthBuffer) => {
      if (lengthReadError) {
        console.error(
          `Failed to communicate with worker (read length) ${lengthReadError}`
        );
        return;
      }
      this.state = 'length read';
      const length = lengthBuffer.readInt32BE(0);
      this.state = 'read message';
      this.readBuffer(length, (messageError, messageBuffer) => {
        if (messageError) {
          console.error(
            `Failed to communicate with worker (read message) ${messageError}`
          );
          return;
        }
        this.state = 'message read';
        const messageString = messageBuffer.toString('utf-8');
        const message = JSON.parse(messageString);
        this.state = 'process message';
        this.onWorkerMessage(message, (err) => {
          if (err) {
            console.error(
              `Failed to communicate with worker (process message) ${err}`
            );
            return;
          }
          this.state = 'soon next';
          setImmediate(() => this.readNextMessage());
        });
      });
    });
  }

  onWorkerMessage(message, finalCallback) {
    const { type, id } = message;
    switch (type) {
      case 'job': {
        const { data, error, result } = message;
        asyncMapSeries(
          data,
          (length, callback) => this.readBuffer(length, callback),
          (eachErr, buffers) => {
            const { callback: jobCallback } = this.jobs[id];
            const callback = (err, arg) => {
              if (jobCallback) {
                delete this.jobs[id];
                this.activeJobs -= 1;
                this.onJobDone();
                if (err) {
                  jobCallback(err instanceof Error ? err : new Error(err), arg);
                } else {
                  jobCallback(null, arg);
                }
              }
              finalCallback();
            };
            if (eachErr) {
              callback(eachErr);
              return;
            }
            let bufferPosition = 0;
            if (result.result) {
              result.result = result.result.map((r) => {
                if (r.buffer) {
                  const buffer = buffers[bufferPosition];
                  bufferPosition += 1;
                  if (r.string) {
                    return buffer.toString('utf-8');
                  }
                  return buffer;
                }
                return r.data;
              });
            }
            if (error) {
              callback(this.fromErrorObj(error), result);
              return;
            }
            callback(null, result);
          }
        );
        break;
      }
      case 'resolve': {
        const { context, request, questionId } = message;
        const { data } = this.jobs[id];
        data.resolve(context, request, (error, result) => {
          this.writeJson({
            type: 'result',
            id: questionId,
            error: error
              ? {
                  message: error.message,
                  details: error.details,
                  missing: error.missing,
                }
              : null,
            result,
          });
        });
        finalCallback();
        break;
      }
      case 'emitWarning': {
        const { data } = message;
        const { data: jobData } = this.jobs[id];
        jobData.emitWarning(this.fromErrorObj(data));
        finalCallback();
        break;
      }
      case 'emitError': {
        const { data } = message;
        const { data: jobData } = this.jobs[id];
        jobData.emitError(this.fromErrorObj(data));
        finalCallback();
        break;
      }
      default: {
        console.error(`Unexpected worker message ${type} in WorkerPool.`);
        finalCallback();
        break;
      }
    }
  }

  fromErrorObj(arg) {
    let obj;
    if (typeof arg === 'string') {
      obj = { message: arg };
    } else {
      obj = arg;
    }
    return new WorkerError(obj, this.id);
  }

  readBuffer(length, callback) {
    readBuffer(this.readPipe, length, callback);
  }

  dispose() {
    this.writeEnd();
  }
}

export default class WorkerPool {
  constructor(options) {
    this.options = options || {};
    this.numberOfWorkers = options.numberOfWorkers;
    this.poolTimeout = options.poolTimeout;
    this.workerNodeArgs = options.workerNodeArgs;
    this.workerParallelJobs = options.workerParallelJobs;
    this.workers = new Set();
    this.activeJobs = 0;
    this.timeout = null;
    this.poolQueue = asyncQueue(
      this.distributeJob.bind(this),
      options.poolParallelJobs
    );
  }

  run(data, callback) {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.activeJobs += 1;
    this.poolQueue.push(data, callback);
  }

  distributeJob(data, callback) {
    // use worker with the fewest jobs
    let bestWorker;
    for (const worker of this.workers) {
      if (!bestWorker || worker.activeJobs < bestWorker.activeJobs) {
        bestWorker = worker;
      }
    }
    if (
      bestWorker &&
      (bestWorker.activeJobs === 0 || this.workers.size >= this.numberOfWorkers)
    ) {
      bestWorker.run(data, callback);
      return;
    }
    const newWorker = this.createWorker();
    newWorker.run(data, callback);
  }

  createWorker() {
    // spin up a new worker
    const newWorker = new PoolWorker(
      {
        nodeArgs: this.workerNodeArgs,
        parallelJobs: this.workerParallelJobs,
      },
      () => this.onJobDone()
    );
    this.workers.add(newWorker);
    return newWorker;
  }

  warmup(requires) {
    while (this.workers.size < this.numberOfWorkers) {
      this.createWorker().warmup(requires);
    }
  }

  onJobDone() {
    this.activeJobs -= 1;
    if (this.activeJobs === 0 && isFinite(this.poolTimeout)) {
      this.timeout = setTimeout(() => this.disposeWorkers(), this.poolTimeout);
    }
  }

  disposeWorkers() {
    if (this.activeJobs === 0) {
      for (const worker of this.workers) {
        worker.dispose();
      }
      this.workers.clear();
    }
  }
}
