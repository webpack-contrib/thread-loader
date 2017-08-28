import loaderUtils from 'loader-utils';
import { getPool } from './workerPools';

function pitch() {
  const options = loaderUtils.getOptions(this) || {};
  const workerPool = getPool(options);
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
    optionsContext: this.options.context,
  }, (err, r) => {
    if (r) {
      r.fileDependencies.forEach(d => this.addDependency(d));
      r.contextDependencies.forEach(d => this.addContextDependency(d));
    }
    if (err) {
      callback(err);
      return;
    }
    callback(null, ...r.result);
  });
}

function warmup(options, requires) {
  const workerPool = getPool(options);
  workerPool.warmup(requires);
}

export { pitch, warmup }; // eslint-disable-line import/prefer-default-export
