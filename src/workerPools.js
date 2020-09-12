import os from 'os';

import WorkerPool from './WorkerPool';

const workerPools = Object.create(null);

function calculateNumberOfWorkers() {
  // There are situations when this call will return undefined so
  // we are fallback here to 1.
  // More info on: https://github.com/nodejs/node/issues/19022
  const cpus = os.cpus() || { length: 1 };

  return Math.max(1, cpus.length - 1);
}

function getPool(options) {
  const workerPoolOptions = {
    name: options.name || '',
    numberOfWorkers: options.workers || calculateNumberOfWorkers(),
    workerNodeArgs: options.workerNodeArgs,
    workerParallelJobs: options.workerParallelJobs || 20,
    poolTimeout: options.poolTimeout || 500,
    poolParallelJobs: options.poolParallelJobs || 200,
    poolRespawn: options.poolRespawn || false,
  };
  const tpKey = JSON.stringify(workerPoolOptions);

  workerPools[tpKey] = workerPools[tpKey] || new WorkerPool(workerPoolOptions);

  return workerPools[tpKey];
}

export { getPool }; // eslint-disable-line import/prefer-default-export
