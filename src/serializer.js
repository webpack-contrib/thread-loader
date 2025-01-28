export function replacer(_key, value) {
  if (value instanceof RegExp) {
    return {
      __serialized_type: 'RegExp',
      source: value.source,
      flags: value.flags,
    };
  }
  return value;
}

export function reviver(_key, value) {
  if (typeof value === 'object' && value !== null) {
    // eslint-disable-next-line no-underscore-dangle
    if (value.__serialized_type === 'RegExp') {
      return new RegExp(value.source, value.flags);
    }
    // eslint-disable-next-line no-underscore-dangle
    else if (value.__serialized_type === 'Function') {
      // eslint-disable-next-line no-new-func
      return new Function(
        ...value.args,
        ` try {
          return (${value.fnBody})(${value.args.join(',')})
        } catch(err) {
          console.error("[Invalid Function call]", err);
        }
        `
      );
    }
  }

  return value;
}
