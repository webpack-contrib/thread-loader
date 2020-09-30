const { replacer, reviver } = require('../src/serializer');

test('round-trips plain objects', () => {
  const json = JSON.stringify(
    {
      a: 1,
      b: 'foo',
      c: [null, false],
    },
    replacer
  );
  expect(JSON.parse(json, reviver)).toEqual({
    a: 1,
    b: 'foo',
    c: [null, false],
  });
});

test('round-trips regular expressions', () => {
  const json = JSON.stringify(
    {
      r: /hoge/g,
      s: /^(\w\s)+$/m,
    },
    replacer
  );
  expect(JSON.parse(json, reviver)).toEqual({
    r: /hoge/g,
    s: /^(\w\s)+$/m,
  });
});
