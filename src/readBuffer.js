export default function readBuffer(pipe, length, callback) {
  if (length === 0) {
    callback(null, Buffer.alloc(0));
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
        pipe.removeListener('data', onChunk);
        pipe.pause();

        if (overflow) {
          pipe.unshift(overflow);
        }

        callback(null, Buffer.concat(buffers, length));
      }
    };

    const onTerminate = () => {
      if (terminated) {
        return;
      }

      terminated = true;
      pipe.removeListener('close', onTerminate);
      pipe.removeListener('end', onTerminate);

      callback(null, Buffer.alloc(0));
    };

    pipe.on('close', onTerminate);
    pipe.on('end', onTerminate);
    pipe.on('data', onChunk);
    pipe.resume();
  };
  readChunk();
}
