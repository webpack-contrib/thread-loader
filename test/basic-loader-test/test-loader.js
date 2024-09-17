const path = require('path');

module.exports = async function testLoader() {
  const options = this.getOptions();
  const callback = this.async();

  this.emitWarning(new Error('Test Message Warning'));
  this.emitError(new Error('Test Message Error'));
  this.dependency(require.resolve('./dep1.js'));
  this.addDependency(require.resolve('./dep.js'));
  this.addBuildDependency(require.resolve('./build-dep.js'));
  this.addContextDependency(path.resolve(__dirname, './directory'));
  // Todo fix me
  // this.addMissingDependency(require.resolve("./missing-dep.js"));

  callback(
    null,
    `module.exports = ${JSON.stringify({
      options,
      getOptions: typeof this.getOptions,
      async: typeof this.async,
      version: this.version,
      mode: this.mode,
      webpack: this.webpack,
      sourceMap: this.sourceMap,
      target: this.target,
      rootContext: this.rootContext,
      context: this.context,
      environment: this.environment,
      loaderIndex: this.loaderIndex,
      loaders: this.loaders,
      resourcePath: this.resourcePath,
      resourceQuery: this.resourceQuery,
      resourceFragment: this.resourceFragment,
      resource: this.resource,
      request: this.request,
      remainingRequest: this.remainingRequest,
      currentRequest: this.currentRequest,
      previousRequest: this.previousRequest,
      query: this.query,
      data: this.data,
      hot: this.hot,
      cacheable: typeof this.cacheable,
      emitWarning: typeof this.emitWarning,
      emitError: typeof this.emitError,
      resolve: typeof this.resolve,
      getResolve: typeof this.getResolve,
      getLogger: typeof this.getLogger,
      // Todo fix me
      emitFile: typeof this.emitFile,
      addBuildDependency: typeof this.addBuildDependency,
      utils: {
        absolutify: typeof this.absolutify,
        contextify: typeof this.contextify,
        createHash: typeof this.createHash,
      },
      loadModule: typeof this.loadModule,
      loadModuleResult: await new Promise((resolve, reject) =>
        this.loadModule('./mod2.js', (err, source, map, mod) => {
          if (err) {
            reject(err);
            return;
          }

          resolve({ source, map, mod });
        })
      ),
      importModule: typeof this.importModule,
      importModuleResult1: await this.importModule('./mod.js', {
        publicPath: 'http://test.com/first/',
      }),
      importModuleResult2: await new Promise((resolve, reject) =>
        this.importModule(
          './mod1.js',
          {
            publicPath: 'http://test.com/first/',
          },
          (err, result) => {
            if (err) {
              reject(err);
              return;
            }

            resolve(result);
          }
        )
      ),
      callback: typeof this.callback,
      addDependency: typeof this.addDependency,
      dependency: typeof this.addDependency,
      addContextDependency: typeof this.addContextDependency,
      addMissingDependency: typeof this.addMissingDependency,
      getDependencies: typeof this.getDependencies,
      getDependenciesResult: this.getDependencies(),
      getContextDependencies: typeof this.getContextDependencies,
      getContextDependenciesResult: this.getContextDependencies(),
      getMissingDependencies: typeof this.getMissingDependencies,
      getMissingDependenciesResult: this.getMissingDependencies(),
      clearDependencies: typeof this.clearDependencies,
    }).replace(new RegExp(process.cwd(), 'g'), '<cwd>')};`
  );
};
