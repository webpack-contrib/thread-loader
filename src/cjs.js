function threadLoader() {
  throw new Error('This function should never be invoked');
}
Object.assign(threadLoader, require('./index'));

module.exports = threadLoader;
