import os from 'os';
import loaderUtils from 'loader-utils';
import WorkerPool from './WorkerPool';

const workerPools = Object.create(null);

function pitch() {
  const options = loaderUtils.getOptions(this) || {};
  const workerPoolOptions = {
    name: options.name || '',
    numberOfWorkers: options.workers || os.cpus().length,
    workerNodeArgs: options.workerNodeArgs,
    workerParallelJobs: options.workerParallelJobs || 20,
    poolTimeout: options.poolTimeout || 500,
    poolParallelJobs: options.poolParallelJobs || 200,
  };
  const tpKey = JSON.stringify(workerPoolOptions);
  workerPools[tpKey] = workerPools[tpKey] || new WorkerPool(workerPoolOptions);
  const workerPool = workerPools[tpKey];
  const callback = this.async();
  workerPool.run({
    loaders: this.loaders.slice(this.loaderIndex + 1).map((l) => {
      return {
        loader: l.path,
        options: l.options,
        ident: l.ident,
      };
    }),
    resource: this.resourcePath + (this.resourceQuery || ''),
    sourceMap: this.sourceMap,
    emitError: this.emitError,
    emitWarning: this.emitWarning,
    resolve: this.resolve,
  }, (err, r) => {
    if (err) {
      callback(err);
      return;
    }
    r.fileDependencies.forEach(d => this.addDependency(d));
    r.contextDependencies.forEach(d => this.addContextDependency(d));
    callback(null, ...r.result);
  });
}

export { pitch }; // eslint-disable-line import/prefer-default-export
