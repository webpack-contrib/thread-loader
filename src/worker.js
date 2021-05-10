/* eslint-disable no-console */
import fs from 'fs';
import NativeModule from 'module';

import querystring from 'querystring';

import loaderRunner from 'loader-runner';
import asyncQueue from 'neo-async/queue';
import parseJson from 'json-parse-better-errors';
import { validate } from 'schema-utils';

import readBuffer from './readBuffer';
import { replacer, reviver } from './serializer';

const writePipe = fs.createWriteStream(null, { fd: 3 });
const readPipe = fs.createReadStream(null, { fd: 4 });

writePipe.on('finish', onTerminateWrite);
readPipe.on('end', onTerminateRead);
writePipe.on('close', onTerminateWrite);
readPipe.on('close', onTerminateRead);

readPipe.on('error', onError);
writePipe.on('error', onError);

const PARALLEL_JOBS = +process.argv[2] || 20;

let terminated = false;
let nextQuestionId = 0;
const callbackMap = Object.create(null);

function onError(error) {
  console.error(error);
}

function onTerminateRead() {
  terminateRead();
}

function onTerminateWrite() {
  terminateWrite();
}

function writePipeWrite(...args) {
  if (!terminated) {
    writePipe.write(...args);
  }
}

function writePipeCork() {
  if (!terminated) {
    writePipe.cork();
  }
}

function writePipeUncork() {
  if (!terminated) {
    writePipe.uncork();
  }
}

function terminateRead() {
  terminated = true;
  readPipe.removeAllListeners();
}

function terminateWrite() {
  terminated = true;
  writePipe.removeAllListeners();
}

function terminate() {
  terminateRead();
  terminateWrite();
}

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

function writeJson(data) {
  writePipeCork();
  process.nextTick(() => {
    writePipeUncork();
  });

  const lengthBuffer = Buffer.alloc(4);
  const messageBuffer = Buffer.from(JSON.stringify(data, replacer), 'utf-8');
  lengthBuffer.writeInt32BE(messageBuffer.length, 0);

  writePipeWrite(lengthBuffer);
  writePipeWrite(messageBuffer);
}

const queue = asyncQueue(({ id, data }, taskCallback) => {
  try {
    const resolveWithOptions = (context, request, callback, options) => {
      callbackMap[nextQuestionId] = callback;
      writeJson({
        type: 'resolve',
        id,
        questionId: nextQuestionId,
        context,
        request,
        options,
      });
      nextQuestionId += 1;
    };

    const buildDependencies = [];

    loaderRunner.runLoaders(
      {
        loaders: data.loaders,
        resource: data.resource,
        readResource: fs.readFile.bind(fs),
        context: {
          version: 2,
          fs,
          loadModule: (request, callback) => {
            callbackMap[nextQuestionId] = (error, result) =>
              callback(error, ...result);
            writeJson({
              type: 'loadModule',
              id,
              questionId: nextQuestionId,
              request,
            });
            nextQuestionId += 1;
          },
          resolve: (context, request, callback) => {
            resolveWithOptions(context, request, callback);
          },
          // eslint-disable-next-line consistent-return
          getResolve: (options) => (context, request, callback) => {
            if (callback) {
              resolveWithOptions(context, request, callback, options);
            } else {
              return new Promise((resolve, reject) => {
                resolveWithOptions(
                  context,
                  request,
                  (err, result) => {
                    if (err) {
                      reject(err);
                    } else {
                      resolve(result);
                    }
                  },
                  options
                );
              });
            }
          },
          // Not an arrow function because it uses this
          getOptions(schema) {
            // loaders, loaderIndex will be defined by runLoaders
            const loader = this.loaders[this.loaderIndex];

            // Verbatim copy from
            // https://github.com/webpack/webpack/blob/v5.31.2/lib/NormalModule.js#L471-L508
            // except eslint/prettier differences
            // -- unfortunate result of getOptions being synchronous functions.

            let { options } = loader;

            if (typeof options === 'string') {
              if (options.substr(0, 1) === '{' && options.substr(-1) === '}') {
                try {
                  options = parseJson(options);
                } catch (e) {
                  throw new Error(`Cannot parse string options: ${e.message}`);
                }
              } else {
                options = querystring.parse(options, '&', '=', {
                  maxKeys: 0,
                });
              }
            }

            // eslint-disable-next-line no-undefined
            if (options === null || options === undefined) {
              options = {};
            }

            if (schema) {
              let name = 'Loader';
              let baseDataPath = 'options';
              let match;
              // eslint-disable-next-line no-cond-assign
              if (schema.title && (match = /^(.+) (.+)$/.exec(schema.title))) {
                [, name, baseDataPath] = match;
              }
              validate(schema, options, {
                name,
                baseDataPath,
              });
            }

            return options;
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
          addBuildDependency: (filename) => {
            buildDependencies.push(filename);
          },
          options: {
            context: data.optionsContext,
          },
          webpack: true,
          'thread-loader': true,
          sourceMap: data.sourceMap,
          target: data.target,
          minimize: data.minimize,
          resourceQuery: data.resourceQuery,
          rootContext: data.rootContext,
        },
      },
      (err, lrResult) => {
        const {
          result,
          cacheable,
          fileDependencies,
          contextDependencies,
          missingDependencies,
        } = lrResult;
        const buffersToSend = [];
        const convertedResult =
          Array.isArray(result) &&
          result.map((item) => {
            const isBuffer = Buffer.isBuffer(item);
            if (isBuffer) {
              buffersToSend.push(item);
              return {
                buffer: true,
              };
            }
            if (typeof item === 'string') {
              const stringBuffer = Buffer.from(item, 'utf-8');
              buffersToSend.push(stringBuffer);
              return {
                buffer: true,
                string: true,
              };
            }
            return {
              data: item,
            };
          });
        writeJson({
          type: 'job',
          id,
          error: err && toErrorObj(err),
          result: {
            result: convertedResult,
            cacheable,
            fileDependencies,
            contextDependencies,
            missingDependencies,
            buildDependencies,
          },
          data: buffersToSend.map((buffer) => buffer.length),
        });
        buffersToSend.forEach((buffer) => {
          writePipeWrite(buffer);
        });
        setImmediate(taskCallback);
      }
    );
  } catch (e) {
    writeJson({
      type: 'job',
      id,
      error: toErrorObj(e),
    });
    taskCallback();
  }
}, PARALLEL_JOBS);

function dispose() {
  terminate();

  queue.kill();
  process.exit(0);
}

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
        requires.forEach((r) => require(r)); // eslint-disable-line import/no-dynamic-require, global-require
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

function readNextMessage() {
  readBuffer(readPipe, 4, (lengthReadError, lengthBuffer) => {
    if (lengthReadError) {
      console.error(
        `Failed to communicate with main process (read length) ${lengthReadError}`
      );
      return;
    }

    const length = lengthBuffer.length && lengthBuffer.readInt32BE(0);

    if (length === 0) {
      // worker should dispose and exit
      dispose();
      return;
    }
    readBuffer(readPipe, length, (messageError, messageBuffer) => {
      if (terminated) {
        return;
      }

      if (messageError) {
        console.error(
          `Failed to communicate with main process (read message) ${messageError}`
        );
        return;
      }
      const messageString = messageBuffer.toString('utf-8');
      const message = JSON.parse(messageString, reviver);

      onMessage(message);
      setImmediate(() => readNextMessage());
    });
  });
}

// start reading messages from main process
readNextMessage();
