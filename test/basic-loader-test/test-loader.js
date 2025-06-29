const path = require('path');

const normalize = (str) =>
  str.split(process.cwd()).join('<PROJECT_ROOT>').replace(/\\/g, '/');

module.exports = async function testLoader() {
  this.cacheable(false);

  const options = this.getOptions();
  const callback = this.async();

  this.emitWarning(new Error('Test Message Warning'));
  this.emitError(new Error('Test Message Error'));
  this.dependency(require.resolve('./dep1.js'));
  this.addDependency(require.resolve('./dep.js'));
  this.addBuildDependency(require.resolve('./build-dep.js'));
  this.addContextDependency(path.resolve(__dirname, './directory'));

  const logger = this.getLogger('name');

  logger.info('test message');

  const logger1 = this.getLogger();

  logger1.log('test message');

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
      rootContext: normalize(this.rootContext),
      context: normalize(this.context),
      environment: this.environment,
      loaderIndex: this.loaderIndex,
      loaders: this.loaders.map((item) => {
        return {
          ...item,
          path: normalize(item.path),
          request: normalize(item.request),
        };
      }),
      resourcePath: normalize(this.resourcePath),
      resourceQuery: this.resourceQuery,
      resourceFragment: this.resourceFragment,
      resource: normalize(this.resource),
      request: normalize(this.request),
      remainingRequest: normalize(this.remainingRequest),
      currentRequest: normalize(this.currentRequest),
      previousRequest: this.previousRequest,
      query: this.query,
      hot: this.hot,
      cacheable: typeof this.cacheable,
      emitWarning: typeof this.emitWarning,
      emitError: typeof this.emitError,
      resolve: typeof this.resolve,
      getResolve: typeof this.getResolve,
      getLogger: typeof this.getLogger,
      addBuildDependency: typeof this.addBuildDependency,
      utils: {
        absolutify: typeof this.utils.absolutify,
        contextify: typeof this.utils.contextify,
        createHash: typeof this.utils.createHash,
        createHashResult: this.utils.createHash().update('test').digest('hex'),
        createHashResult1: this.utils
          .createHash('xxhash64')
          .update('test')
          .digest('hex'),
      },
      loadModule: typeof this.loadModule,
      loadModuleResult: await new Promise((resolve, reject) =>
        this.loadModule('./mod2.js', (err, source, map, mod) => {
          if (err) {
            reject(err);
            return;
          }

          resolve({ source, map, mod });
        }),
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
          },
        ),
      ),
      callback: typeof this.callback,
      addDependency: typeof this.addDependency,
      dependency: typeof this.addDependency,
      addContextDependency: typeof this.addContextDependency,
      addMissingDependency: typeof this.addMissingDependency,
      getDependencies: typeof this.getDependencies,
      getDependenciesResult: this.getDependencies().map(normalize),
      getContextDependencies: typeof this.getContextDependencies,
      getContextDependenciesResult:
        this.getContextDependencies().map(normalize),
      getMissingDependencies: typeof this.getMissingDependencies,
      getMissingDependenciesResult: this.getMissingDependencies(),
      clearDependencies: typeof this.clearDependencies,
    })};`,
  );
};
