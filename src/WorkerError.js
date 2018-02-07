const stack = (origin, worker, workerId) => {
  const originError = origin
    .split('\n')
    .filter(line => line.includes('at'));

  const workerError = worker
    .split('\n')
    .filter(line => line.includes('at'))
    .map(line => `${line} [Thread Loader (Worker ${workerId})]`);

  const diff = workerError.slice(0, workerError.length - originError.length).join('\n');

  originError.unshift(diff);

  return originError.join('\n');
};

class WorkerError extends Error {
  constructor(err, workerId) {
    super(err);
    this.name = err.name;
    this.message = err.message;

    Error.captureStackTrace(this, this.constructor);

    this.stack = stack(err.stack, this.stack, workerId);
    // this.stack = [`Thread Loader (Worker ${workerId})`, err.message, this.stack].join('\n');
  }
}

export default WorkerError;
