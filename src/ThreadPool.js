import * as path from 'path';
import { Worker } from 'worker_threads';
import { wrap, proxy } from 'comlink';
import { Subject, asapScheduler, zip } from 'rxjs';
import { filter, map, mergeMap, observeOn, takeUntil } from 'rxjs/operators';

const nodeEndpoint = require('comlink/dist/umd/node-adapter');

/**
 * Create worker object wraps native threads with proxy interfaces.
 */
const createWorker = () => {
  const worker = new Worker(path.resolve(__dirname, './workerEntryPoint.js')});
  const workerProxy = wrap(nodeEndpoint(worker));
  worker.unref();

  let disposed = false;

  return {
    disposed,
    workerProxy,
    close: () => {
      disposed = true;
      return new Promise((resolve) => {
        worker.once('exit', () => {
          workerProxy[releaseProxy]();
          resolve();
        });

        workerProxy.close();
      });
    },
  };
};

/**
 * Create comlink proxy-wrapped transferrable object from given
 * worker data context.
 *
 * Each loader's data context includes Webpack::loader::LoaderContext
 * have various functions. This marshall splits object between POJO to functions,
 * then wrap all functions into comlink proxy to avoid cloning attempt.
 *
 * In marshalled object, non-proxied (POJO) contains all keys of proxied fn property
 * as iterating & gettings keys to proxy object is bit tricky.
 *
 * Note `workerEntryPoint` have additional handling for some edge cases as well.
 */
const marshallWorkerDataContext = context =>
  Object.entries(context).reduce(
    (acc, [key, value]) => {
      if (typeof value === 'function') {
        acc[1][key] = proxy(value);
        acc[0].proxyFnKeys.push(key);
      } else {
        acc[0][key] = value;
      }

      return acc;
    },
    [{ proxyFnKeys: [] }, {}],
  );

export default class ThreadPool {
  constructor(maxWorkers) {
    this.maxWorkers = maxWorkers;
    this.taskCount = 0;
    this.timeoutId = null;

    this.taskQueue = new Subject();
    this.workerQueue = new Subject();
    this.disposeAwaiter = new Subject();

    this.workerPool = [...new Array(maxWorkers)].map(() => createWorker());

    this.poolSubscription = this.startPoolScheduler();
  }

  /**
   * Ask all threads to exit once queued task completes.
   */
  async closeWorkers() {
    let worker = this.workerPool.shift();
    while (worker) {
      if (!worker.disposed) {
        await worker.close();
      }
      worker = this.workerPool.shift();
    }
  }

  /**
   * Try to exit existing workers when there's no task scheduled within timeout (2sec)
   * If there is any running task when timeout reaches extend timeout to next timeout tick.
   */
  async scheduleTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.timeoutId = setTimeout(async () => {
      if (this.taskCount === 0) {
        await this.closeWorkers();
      } else {
        this.scheduleTimeout();
      }
    }, 2000);
  }

  /**
  * Run task via worker, raises timeoutError if worker does not respond in timeout period (10sec).
  * Most cases this happens when task is scheduled into disposed worker which released complink proxy already.
  */
  tryRunTaskWithTimeout(
    worker,
    id,
    context,
    proxyContext,
  ) {
    let runTaskTimeoutId = null;

    return new Promise((resolve, reject) => {
      runTaskTimeoutId = setTimeout(() => {
        if (worker.disposed) {
          this.workerPool.splice(this.workerPool.indexOf(worker), 1);
        }
        reject({ timeout: true });
      }, 10000);

      worker.workerProxy.run({ id }, context, proxyContext).then(
        (result) => {
          if (runTaskTimeoutId) {
            clearTimeout(runTaskTimeoutId);
            runTaskTimeoutId = null;
          }
          resolve(result);
        },
        (err) => {
          if (runTaskTimeoutId) {
            clearTimeout(runTaskTimeoutId);
            runTaskTimeoutId = null;
          }
          reject(err);
        },
      );
    });
  }

  /**
   * Actual task scheduler.
   */
  startPoolScheduler() {
    const sub = zip(
      // Each time new task is scheduled, reset timeout for close worker.
      // If this task is scheduled after timeout, it will reinstall worker threads.
      this.taskQueue.pipe(
        map((v) => {
          this.scheduleTimeout();

          if (this.workerPool.length < this.maxWorkers) {
            for (let idx = this.workerPool.length; idx < this.maxWorkers; idx++) {
              const worker = createWorker();
              this.workerPool.push(worker);
              this.workerQueue.next(worker);
            }
          }
          return v;
        }),
      ),
      this.workerQueue.pipe(
        filter(x => !x.disposed),
        map((v, i) => v),
      ),
    )
      .pipe(
        observeOn(asapScheduler),
        takeUntil(this.disposeAwaiter),
        mergeMap(async ([task, worker]) => {
          if (!worker || worker.disposed) {
            this.taskQueue.next(task);
          }
          const { context, proxyContext, id } = task;

          try {
            const result = await this.tryRunTaskWithTimeout(worker, id, context, proxyContext);
            task.onComplete(result);
            return { id, value: true };
          } catch (err) {
            if (!!err && err.timeout) {
              this.taskQueue.next(task);
            } else {
              task.onError(err);
            }

            return { id, value: false };
          }
        }),
      )
      .subscribe(
        (x) => {
          this.taskCount--;

          // Each time task completes, queue new worker to let zip operator picks up task / worker pair
          const worker = this.workerPool[(x.id + 1) % this.maxWorkers];
          this.workerQueue.next(worker);
        },
        null,
        () => {
          this.closeWorkers();
        },
      );

    // Queue all workers when starting scheduler
    this.workerPool.forEach(function initialQueue(w) { this.workerQueue.next(w); });

    return sub;
  }

  warmup() {
    /* noop */
  }

  run(data, callback) {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    ++this.taskCount;

    const [normalContext, proxyContext] = marshallWorkerDataContext(context);
    this.taskQueue.next({
      context: normalContext,
      // Wrap whole object into proxy again, otherwise worker will try clone
      proxyContext: proxy(proxyContext),
      onComplete: callback,
      onError: callback,
    });
  }
}
