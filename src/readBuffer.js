export default function readBuffer(pipe, length, callback) {
  if (length === 0) {
    callback(null, new Buffer(0));
    return;
  }
  let terminated = false;
  let remainingLength = length;
  const buffers = [];
  const readChunk = () => {
    const onChunk = (arg) => {
      if (terminated) {
        return;
      }
      let chunk = arg;
      let overflow;
      if (chunk.length > remainingLength) {
        overflow = chunk.slice(remainingLength);
        chunk = chunk.slice(0, remainingLength);
        remainingLength = 0;
      } else {
        remainingLength -= chunk.length;
      }
      buffers.push(chunk);
      if (remainingLength === 0) {
        pipe.pause();
        pipe.removeListener('data', onChunk);
        if (overflow) {
          pipe.unshift(overflow);
        }
        terminated = true;
        callback(null, Buffer.concat(buffers, length));
      }
    };
    const onEnd = () => {
      if (terminated) {
        return;
      }
      terminated = true;
      const err = new Error(`Stream ended ${remainingLength.toString()} bytes prematurely`);
      err.name = 'EarlyEOFError';
      callback(err);
    };
    pipe.on('data', onChunk);
    pipe.on('end', onEnd);
    pipe.resume();
  };
  readChunk();
}
