/* global require */
/* eslint-disable no-console */
import fs from 'fs';
import NativeModule from 'module';
import loaderRunner from 'loader-runner';
import asyncQueue from 'async/queue';
import readBuffer from './readBuffer';

const writePipe = fs.createWriteStream(null, { fd: 3 });
const readPipe = fs.createReadStream(null, { fd: 4 });

writePipe.on('error', console.error.bind(console));
readPipe.on('error', console.error.bind(console));

const PARALLEL_JOBS = +process.argv[2];

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

function writeJson(data) {
  writePipe.cork();
  process.nextTick(() => writePipe.uncork());
  const lengthBuffer = new Buffer(4);
  const messageBuffer = new Buffer(JSON.stringify(data), 'utf-8');
  lengthBuffer.writeInt32BE(messageBuffer.length, 0);
  writePipe.write(lengthBuffer);
  writePipe.write(messageBuffer);
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
      const buffersToSend = [];
      const convertedResult = Array.isArray(result) && result.map((item) => {
        const isBuffer = Buffer.isBuffer(item);
        if (isBuffer) {
          buffersToSend.push(item);
          return {
            buffer: true,
          };
        }
        if (typeof item === 'string') {
          const stringBuffer = new Buffer(item, 'utf-8');
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
        },
        data: buffersToSend.map(buffer => buffer.length),
      });
      buffersToSend.forEach((buffer) => {
        writePipe.write(buffer);
      });
      setImmediate(taskCallback);
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

function readNextMessage() {
  readBuffer(readPipe, 4, (lengthReadError, lengthBuffer) => {
    if (lengthReadError) {
      console.error(`Failed to communicate with main process (read length) ${lengthReadError}`);
      return;
    }
    const length = lengthBuffer.readInt32BE(0);
    if (length === 0) {
      // worker should exit
      process.exit(0);
      return;
    }
    readBuffer(readPipe, length, (messageError, messageBuffer) => {
      if (messageError) {
        console.error(`Failed to communicate with main process (read message) ${messageError}`);
        return;
      }
      const messageString = messageBuffer.toString('utf-8');
      const message = JSON.parse(messageString);
      onMessage(message);
      setImmediate(() => readNextMessage());
    });
  });
}

// start reading messages from main process
readNextMessage();
