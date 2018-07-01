/* global require */
/* eslint-disable no-console */
import fs from 'fs';
import NativeModule from 'module';
// eslint-disable-next-line
import { parentPort, workerData } from 'worker_threads';
import loaderRunner from 'loader-runner';
import asyncQueue from 'async/queue';


parentPort.on('message', onMessage);

function writeJson(data) {
  parentPort.postMessage(data);
}

const PARALLEL_JOBS = +workerData.parallelJobs;

let nextQuestionId = 0;
const callbackMap = Object.create(null);

function toErrorObj(err) {
  return {
    message: err.message,
    details: err.details,
    stack: err.stack,
    hideStack: err.hideStack,
  };
}

function toNativeError(obj) {
  if (!obj) return null;
  const err = new Error(obj.message);
  err.details = obj.details;
  err.missing = obj.missing;
  return err;
}

const queue = asyncQueue(({ id, data }, taskCallback) => {
  try {
    loaderRunner.runLoaders({
      loaders: data.loaders,
      resource: data.resource,
      readResource: fs.readFile.bind(fs),
      context: {
        version: 2,
        resolve: (context, request, callback) => {
          callbackMap[nextQuestionId] = callback;
          writeJson({
            type: 'resolve',
            id,
            questionId: nextQuestionId,
            context,
            request,
          });
          nextQuestionId += 1;
        },
        emitWarning: (warning) => {
          writeJson({
            type: 'emitWarning',
            id,
            data: toErrorObj(warning),
          });
        },
        emitError: (error) => {
          writeJson({
            type: 'emitError',
            id,
            data: toErrorObj(error),
          });
        },
        exec: (code, filename) => {
          const module = new NativeModule(filename, this);
          module.paths = NativeModule._nodeModulePaths(this.context); // eslint-disable-line no-underscore-dangle
          module.filename = filename;
          module._compile(code, filename); // eslint-disable-line no-underscore-dangle
          return module.exports;
        },
        options: {
          context: data.optionsContext,
        },
        webpack: true,
        'thread-loader': true,
        sourceMap: data.sourceMap,
      },
    }, (err, lrResult) => {
      const {
        result,
        cacheable,
        fileDependencies,
        contextDependencies,
      } = lrResult;
      writeJson({
        type: 'job',
        id,
        error: err && toErrorObj(err),
        result: {
          result,
          cacheable,
          fileDependencies,
          contextDependencies,
        },
        data: result,
      });
      taskCallback();
    });
  } catch (e) {
    writeJson({
      type: 'job',
      id,
      error: toErrorObj(e),
    });
    taskCallback();
  }
}, PARALLEL_JOBS);

function onMessage(message) {
  try {
    const { type, id } = message;
    switch (type) {
      case 'job': {
        queue.push(message);
        break;
      }
      case 'result': {
        const { error, result } = message;
        const callback = callbackMap[id];
        if (callback) {
          const nativeError = toNativeError(error);
          callback(nativeError, result);
        } else {
          console.error(`Worker got unexpected result id ${id}`);
        }
        delete callbackMap[id];
        break;
      }
      case 'warmup': {
        const { requires } = message;
        // load modules into process
        requires.forEach(r => require(r)); // eslint-disable-line import/no-dynamic-require, global-require
        break;
      }
      default: {
        console.error(`Worker got unexpected job type ${type}`);
        break;
      }
    }
  } catch (e) {
    console.error(`Error in worker ${e}`);
  }
}
