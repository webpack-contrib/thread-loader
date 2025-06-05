import { getPool } from './workerPools';

function pitch() {
  const options = this.getOptions();
  const workerPool = getPool(options);

  if (!workerPool.isAbleToRun()) {
    return;
  }

  const callback = this.async();

  workerPool.run(
    {
      loaders: this.loaders.slice(this.loaderIndex + 1).map((l) => {
        return {
          loader: l.path,
          options: l.options,
          ident: l.ident,
        };
      }),
      _compiler: {
        fsStartTime: this._compiler.fsStartTime,
        options: { plugins: [] },
      },
      _compilation: {
        outputOptions: {
          hashSalt: this._compilation.outputOptions.hashSalt,
          hashFunction: this._compilation.outputOptions.hashFunction,
          hashDigest: this._compilation.outputOptions.hashDigest,
          hashDigestLength: this._compilation.outputOptions.hashDigestLength,
        },
        options: {
          devtool:
            this._compilation &&
            this._compilation.options &&
            this._compilation.options.devtool,
        },
      },
      resourcePath: this.resourcePath,
      resourceQuery: this.resourceQuery,
      resourceFragment: this.resourceFragment,
      environment: this.environment,
      resource:
        this.resourcePath +
        (this.resourceQuery || '') +
        (this.resourceFragment || ''),
      sourceMap: this.sourceMap,
      emitError: this.emitError,
      emitWarning: this.emitWarning,
      getLogger: this.getLogger,
      loggers: {},
      loadModule: this.loadModule,
      importModule: this.importModule,
      resolve: this.resolve,
      getResolve: this.getResolve,
      target: this.target,
      mode: this.mode,
      minimize: this.minimize,
      optionsContext: this.rootContext || this.options.context,
      rootContext: this.rootContext,
      hot: this.hot,
    },
    (err, r) => {
      if (r) {
        this.cacheable(r.cacheable);

        r.fileDependencies.forEach((d) => this.addDependency(d));
        r.contextDependencies.forEach((d) => this.addContextDependency(d));
        r.missingDependencies.forEach((d) => this.addMissingDependency(d));
        r.buildDependencies.forEach((d) =>
          // Compatibility with webpack v4
          this.addBuildDependency
            ? this.addBuildDependency(d)
            : this.addDependency(d)
        );
      }

      if (err) {
        callback(err);
        return;
      }

      callback(null, ...r.result);
    }
  );
}

function warmup(options, requires) {
  const workerPool = getPool(options);

  workerPool.warmup(requires);
}

export { pitch, warmup }; // eslint-disable-line import/prefer-default-export
