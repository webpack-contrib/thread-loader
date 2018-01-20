import os from 'os';
import WorkerPool from './WorkerPool';

const workerPools = Object.create(null);

function getPool(options) {
  const workerPoolOptions = {
    name: options.name || '',
    numberOfWorkers: options.workers || os.cpus().length,
    workerNodeArgs: options.workerNodeArgs,
    workerParallelJobs: options.workerParallelJobs || 20,
    poolTimeout: options.poolTimeout || 500,
    poolParallelJobs: options.poolParallelJobs || 200,
    stack: options.stack || false,
  };
  const tpKey = JSON.stringify(workerPoolOptions);
  workerPools[tpKey] = workerPools[tpKey] || new WorkerPool(workerPoolOptions);
  const workerPool = workerPools[tpKey];
  return workerPool;
}

export { getPool }; // eslint-disable-line import/prefer-default-export
