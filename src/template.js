// TODO export it from webpack

const { basename, extname } = require('path');
const util = require('util');

const { Chunk } = require('webpack');
const { Module } = require('webpack');
const { parseResource } = require('webpack/lib/util/identifier');

const REGEXP = /\[\\*([\w:]+)\\*\]/gi;

/**
 * @param {string | number} id id
 * @returns {string | number} result
 */
const prepareId = (id) => {
  if (typeof id !== 'string') return id;

  if (/^"\s\+*.*\+\s*"$/.test(id)) {
    const match = /^"\s\+*\s*(.*)\s*\+\s*"$/.exec(id);

    return `" + (${
      /** @type {string[]} */ (match)[1]
    } + "").replace(/(^[.-]|[^a-zA-Z0-9_-])+/g, "_") + "`;
  }

  return id.replace(/(^[.-]|[^a-zA-Z0-9_-])+/g, '_');
};

/**
 * @callback ReplacerFunction
 * @param {string} match
 * @param {string | undefined} arg
 * @param {string} input
 */

/**
 * @param {ReplacerFunction} replacer replacer
 * @param {((arg0: number) => string) | undefined} handler handler
 * @param {AssetInfo | undefined} assetInfo asset info
 * @param {string} hashName hash name
 * @returns {ReplacerFunction} hash replacer function
 */
const hashLength = (replacer, handler, assetInfo, hashName) => {
  /** @type {ReplacerFunction} */
  const fn = (match, arg, input) => {
    let result;
    const length = arg && Number.parseInt(arg, 10);

    if (length && handler) {
      result = handler(length);
    } else {
      const hash = replacer(match, arg, input);

      result = length ? hash.slice(0, length) : hash;
    }
    if (assetInfo) {
      // eslint-disable-next-line no-param-reassign
      assetInfo.immutable = true;
      if (Array.isArray(assetInfo[hashName])) {
        // eslint-disable-next-line no-param-reassign
        assetInfo[hashName] = [...assetInfo[hashName], result];
      } else if (assetInfo[hashName]) {
        // eslint-disable-next-line no-param-reassign
        assetInfo[hashName] = [assetInfo[hashName], result];
      } else {
        // eslint-disable-next-line no-param-reassign
        assetInfo[hashName] = result;
      }
    }
    return result;
  };

  return fn;
};

/** @typedef {(match: string, arg?: string, input?: string) => string} Replacer */

/**
 * @param {string | number | null | undefined | (() => string | number | null | undefined)} value value
 * @param {boolean=} allowEmpty allow empty
 * @returns {Replacer} replacer
 */
const replacer = (value, allowEmpty) => {
  /** @type {Replacer} */
  const fn = (match, arg, input) => {
    if (typeof value === 'function') {
      // eslint-disable-next-line no-param-reassign
      value = value();
    }
    // eslint-disable-next-line no-undefined
    if (value === null || value === undefined) {
      if (!allowEmpty) {
        throw new Error(
          `Path variable ${match} not implemented in this context: ${input}`,
        );
      }

      return '';
    }

    return `${value}`;
  };

  return fn;
};

const deprecationCache = new Map();
const deprecatedFunction = (() => () => {})();
/**
 * @param {Function} fn function
 * @param {string} message message
 * @param {string} code code
 * @returns {function(...any[]): void} function with deprecation output
 */
const deprecated = (fn, message, code) => {
  let d = deprecationCache.get(message);
  // eslint-disable-next-line no-undefined
  if (d === undefined) {
    d = util.deprecate(deprecatedFunction, message, code);
    deprecationCache.set(message, d);
  }
  return (...args) => {
    d();
    return fn(...args);
  };
};

/** @typedef {string | function(PathData, AssetInfo=): string} TemplatePath */

/**
 * @param {TemplatePath} path the raw path
 * @param {PathData} data context data
 * @param {AssetInfo | undefined} assetInfo extra info about the asset (will be written to)
 * @returns {string} the interpolated path
 */
const replacePathVariables = (path, data, assetInfo) => {
  const { chunkGraph } = data;

  /** @type {Map<string, Function>} */
  const replacements = new Map();

  // Filename context
  //
  // Placeholders
  //
  // for /some/path/file.js?query#fragment:
  // [file] - /some/path/file.js
  // [query] - ?query
  // [fragment] - #fragment
  // [base] - file.js
  // [path] - /some/path/
  // [name] - file
  // [ext] - .js
  if (typeof data.filename === 'string') {
    const { path: file, query, fragment } = parseResource(data.filename);

    const ext = extname(file);
    const base = basename(file);
    const name = base.slice(0, base.length - ext.length);
    // eslint-disable-next-line no-shadow
    const path = file.slice(0, file.length - base.length);

    replacements.set('file', replacer(file));
    replacements.set('query', replacer(query, true));
    replacements.set('fragment', replacer(fragment, true));
    replacements.set('path', replacer(path, true));
    replacements.set('base', replacer(base));
    replacements.set('name', replacer(name));
    replacements.set('ext', replacer(ext, true));
    // Legacy
    replacements.set(
      'filebase',
      deprecated(
        replacer(base),
        '[filebase] is now [base]',
        'DEP_WEBPACK_TEMPLATE_PATH_PLUGIN_REPLACE_PATH_VARIABLES_FILENAME',
      ),
    );
  }

  // Compilation context
  //
  // Placeholders
  //
  // [fullhash] - data.hash (3a4b5c6e7f)
  //
  // Legacy Placeholders
  //
  // [hash] - data.hash (3a4b5c6e7f)
  if (data.hash) {
    const hashReplacer = hashLength(
      replacer(data.hash),
      data.hashWithLength,
      assetInfo,
      'fullhash',
    );

    replacements.set('fullhash', hashReplacer);

    // Legacy
    replacements.set(
      'hash',
      deprecated(
        hashReplacer,
        '[hash] is now [fullhash] (also consider using [chunkhash] or [contenthash], see documentation for details)',
        'DEP_WEBPACK_TEMPLATE_PATH_PLUGIN_REPLACE_PATH_VARIABLES_HASH',
      ),
    );
  }

  // Chunk Context
  //
  // Placeholders
  //
  // [id] - chunk.id (0.js)
  // [name] - chunk.name (app.js)
  // [chunkhash] - chunk.hash (7823t4t4.js)
  // [contenthash] - chunk.contentHash[type] (3256u3zg.js)
  if (data.chunk) {
    const { chunk } = data;

    const { contentHashType } = data;

    const idReplacer = replacer(chunk.id);
    const nameReplacer = replacer(chunk.name || chunk.id);
    const chunkhashReplacer = hashLength(
      replacer(chunk instanceof Chunk ? chunk.renderedHash : chunk.hash),
      // eslint-disable-next-line no-undefined
      'hashWithLength' in chunk ? chunk.hashWithLength : undefined,
      assetInfo,
      'chunkhash',
    );
    const contenthashReplacer = hashLength(
      replacer(
        data.contentHash ||
          (contentHashType &&
            chunk.contentHash &&
            chunk.contentHash[contentHashType]),
      ),
      data.contentHashWithLength ||
        ('contentHashWithLength' in chunk && chunk.contentHashWithLength
          ? chunk.contentHashWithLength[/** @type {string} */ (contentHashType)]
          : // eslint-disable-next-line no-undefined
            undefined),
      assetInfo,
      'contenthash',
    );

    replacements.set('id', idReplacer);
    replacements.set('name', nameReplacer);
    replacements.set('chunkhash', chunkhashReplacer);
    replacements.set('contenthash', contenthashReplacer);
  }

  // Module Context
  //
  // Placeholders
  //
  // [id] - module.id (2.png)
  // [hash] - module.hash (6237543873.png)
  //
  // Legacy Placeholders
  //
  // [moduleid] - module.id (2.png)
  // [modulehash] - module.hash (6237543873.png)
  if (data.module) {
    const { module } = data;

    const idReplacer = replacer(() =>
      prepareId(
        module instanceof Module
          ? /** @type {ModuleId} */
            (/** @type {ChunkGraph} */ (chunkGraph).getModuleId(module))
          : module.id,
      ),
    );
    const moduleHashReplacer = hashLength(
      replacer(() =>
        module instanceof Module
          ? /** @type {ChunkGraph} */
            (chunkGraph).getRenderedModuleHash(module, data.runtime)
          : module.hash,
      ),
      // eslint-disable-next-line no-undefined
      'hashWithLength' in module ? module.hashWithLength : undefined,
      assetInfo,
      'modulehash',
    );
    const contentHashReplacer = hashLength(
      replacer(/** @type {string} */ (data.contentHash)),
      // eslint-disable-next-line no-undefined
      undefined,
      assetInfo,
      'contenthash',
    );

    replacements.set('id', idReplacer);
    replacements.set('modulehash', moduleHashReplacer);
    replacements.set('contenthash', contentHashReplacer);
    replacements.set(
      'hash',
      data.contentHash ? contentHashReplacer : moduleHashReplacer,
    );
    // Legacy
    replacements.set(
      'moduleid',
      deprecated(
        idReplacer,
        '[moduleid] is now [id]',
        'DEP_WEBPACK_TEMPLATE_PATH_PLUGIN_REPLACE_PATH_VARIABLES_MODULE_ID',
      ),
    );
  }

  // Other things
  if (data.url) {
    replacements.set('url', replacer(data.url));
  }
  if (typeof data.runtime === 'string') {
    replacements.set(
      'runtime',
      replacer(() => prepareId(/** @type {string} */ (data.runtime))),
    );
  } else {
    replacements.set('runtime', replacer('_'));
  }

  if (typeof path === 'function') {
    // eslint-disable-next-line no-param-reassign
    path = path(data, assetInfo);
  }

  // eslint-disable-next-line no-param-reassign
  path = path.replace(REGEXP, (match, content) => {
    if (content.length + 2 === match.length) {
      const contentMatch = /^(\w+)(?::(\w+))?$/.exec(content);
      if (!contentMatch) return match;
      const [, kind, arg] = contentMatch;
      // eslint-disable-next-line no-shadow
      const replacer = replacements.get(kind);
      // eslint-disable-next-line no-undefined
      if (replacer !== undefined) {
        return replacer(match, arg, path);
      }
    } else if (match.startsWith('[\\') && match.endsWith('\\]')) {
      return `[${match.slice(2, -2)}]`;
    }
    return match;
  });

  return path;
};

module.exports = replacePathVariables;
