import * as fs from 'fs';
import { promisify } from 'util';
import * as loaderRunner from 'loader-runner';
import { Subject, from, of } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { expose, proxy } from 'comlink';
import { parentPort } from 'worker_threads';
import { setupTransferHandler } from './messagePortTransferHandler';
const nodeEndpoint = require('comlink/dist/umd/node-adapter');

const asyncLoaderRunner = promisify(loaderRunner.runLoaders.bind(loaderRunner));

/**
 * Construct option object for loaderRunner.
 */
const buildLoaderOption = (
  context,
  proxyContext,
) => {
  // context is plain object cloned from main process
  const options = {
    ...context,
    // For fs, we won't try to proxy from Webpack::loader::LoaderContext as
    // it's complex object.
    readResource: fs.readFile.bind(fs),
    context: {
      options: {
        context: context.rootContext,
      },
      fs,
      webpack: true,
    },
  };

  // also context appends all available keys for proxied object,
  // augument option object using it
  context.proxyFnKeys.forEach(key => (options.context[key] = proxyContext[key]));

  // Webpack::loader::LoaderContext::resolve expects callback fn as param.
  // Same as proxied fn from main process to worker, callback fn in worker cannot be
  // cloned into main process - we'll wrap `resolve` here to forward proxy fn
  options.context.resolve = (resolveContext, request, callback) =>
    proxyContext.resolve(resolveContext, request, proxy(callback));

  return options;
};


/**
 * Interface to allow running specified task in worker threads,
 * exposed via comlink proxy.
 */
const taskRunner = (() => {
  const workerTaskQueue = new Subject();
  let isRunning = false;
  let isClosed = false;

  const run = async (queuedTask) => {
    isRunning = true;
    const { task, context, proxyContext } = queuedTask;

    const loaderOptions = buildLoaderOption(context, proxyContext);

    const result = await asyncLoaderRunner(loaderOptions);

    isRunning = false;
    return result;
  };

  workerTaskQueue
    .pipe(
      mergeMap(queuedTask =>
        from(run(queuedTask)).pipe(
          map((result) => { return { result, onComplete: queuedTask.onComplete }; }),
          catchError(err => of({ err, onError: queuedTask.onError })),
        ),
      ),
    )
    .subscribe(
      (taskResult) => {
        const { result, err, onComplete, onError } = taskResult;
        if (err) {
          onError(err);
        } else {
          onComplete(result);
        }
      },
      (e) => {
        process.exit(-1);
      },
      () => {
        process.exit(0);
      },
    );

  return {
    isAvailable: () => !isClosed && !isRunning,
    close: () => {
      isClosed = true;
      workerTaskQueue.complete();
    },
    run: (
      task,
      context,
      proxyContext,
    ) =>
      new Promise((resolve, reject) => {
        workerTaskQueue.next({
          task,
          context,
          proxyContext,
          onComplete: resolve,
          onError: reject,
        });
      }),
  };
})();

setupTransferHandler();
expose(taskRunner, nodeEndpoint(parentPort));

export { taskRunner };
