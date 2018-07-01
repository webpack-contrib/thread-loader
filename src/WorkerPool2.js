/* eslint-disable no-console */
// eslint-disable-next-line
import { Worker } from 'worker_threads';
import asyncQueue from 'async/queue';
import WorkerError from './WorkerError';

const workerPath = require.resolve('./worker2');

let workerId = 0;

class PoolWorker {
  constructor(options, onJobDone) {
    this.nextJobId = 0;
    this.jobs = Object.create(null);
    this.activeJobs = 0;
    this.onJobDone = onJobDone;
    this.id = workerId;
    workerId += 1;
    this.worker = new Worker(workerPath, {
      workerData: {
        nodeArgs: options.nodeArgs,
        parallelJobs: options.parallelJobs,
      },
    });

    this.worker.on('message', this.onWorkerMessage.bind(this));
    this.worker.on('error', console.error);
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
    const message = {
      id: data.id,
      type: data.type,
      data: {
        loaders: data.data.loaders,
        resource: data.data.resource,
        optionsContext: data.data.optionsContext,
        sourceMap: data.data.sourceMap,
      },
    };

    this.worker.postMessage(message);
  }

  onWorkerMessage(message) {
    const { type, id } = message;
    switch (type) {
      case 'job': {
        const { error, result } = message;
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
        };

        if (error) {
          callback(this.fromErrorObj(error), result);
          return;
        }

        callback(null, result);
        break;
      }
      case 'resolve': {
        const { context, request, questionId } = message;
        const { data } = this.jobs[id];
        data.resolve(context, request, (error, result) => {
          this.writeJson({
            type: 'result',
            id: questionId,
            error: error ? {
              message: error.message,
              details: error.details,
              missing: error.missing,
            } : null,
            result,
          });
        });
        break;
      }
      case 'emitWarning': {
        const { data } = message;
        const { data: jobData } = this.jobs[id];
        jobData.emitWarning(this.fromErrorObj(data));
        break;
      }
      case 'emitError': {
        const { data } = message;
        const { data: jobData } = this.jobs[id];
        jobData.emitError(this.fromErrorObj(data));
        break;
      }
      default: {
        console.error(`Unexpected worker message ${type} in WorkerPool.`);
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

  dispose() {
    this.worker.terminate();
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
    this.poolQueue = asyncQueue(this.distributeJob.bind(this), options.poolParallelJobs);
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
    if (bestWorker && (bestWorker.activeJobs === 0 || this.workers.size >= this.numberOfWorkers)) {
      bestWorker.run(data, callback);
      return;
    }
    const newWorker = this.createWorker();
    newWorker.run(data, callback);
  }

  createWorker() {
    // spin up a new worker
    const newWorker = new PoolWorker({
      nodeArgs: this.workerNodeArgs,
      parallelJobs: this.workerParallelJobs,
    }, () => this.onJobDone());
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
