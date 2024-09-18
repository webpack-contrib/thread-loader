import webpack from 'webpack';

import basicLoaderConfig from './basic-loader-test/webpack.config';
import sassLoaderConfig from './sass-loader-example/webpack.config';
import tsLoaderConfig from './ts-loader-example/webpack.config';
import lessLoaderConfig from './less-loader-example/webpack.config';

test("Processes sass-loader's @import correctly", (done) => {
  const config = sassLoaderConfig({ threads: 1 });

  webpack(config, (err, stats) => {
    if (err) {
      throw err;
    }

    expect(err).toBe(null);
    expect(stats.hasErrors()).toBe(false);
    done();
  });
}, 30000);

test('Processes ts-loader correctly', (done) => {
  const config = tsLoaderConfig({ threads: 1 });

  webpack(config, (err, stats) => {
    if (err) {
      throw err;
    }

    expect(err).toBe(null);
    expect(stats.hasErrors()).toBe(false);
    done();
  });
}, 30000);

test('Works with less-loader', (done) => {
  const config = lessLoaderConfig({ threads: 1 });

  webpack(config, (err, stats) => {
    if (err) {
      throw err;
    }

    expect(err).toBe(null);
    expect(stats.hasErrors()).toBe(false);
    done();
  });
}, 30000);

test('Works with test-loader', (done) => {
  const config = basicLoaderConfig({ threads: 1 });

  webpack(config, (err, stats) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }

    expect(stats.compilation.errors).toMatchSnapshot('errors');
    expect(stats.compilation.warnings).toMatchSnapshot('warnings');

    const logs = Array.from(stats.compilation.logging.entries())
      .filter((item) => /file\.js\?q=1#hash/.test(item[0]))
      .map((item) => item[1].map(({ time, ...rest }) => rest));

    expect(logs).toMatchSnapshot('logs');

    const [testMod] = [...stats.compilation.modules].filter(
      (i) => i.rawRequest === './file.js?q=1#hash'
    );

    expect(testMod.buildInfo.cacheable).toBe(false);
    // eslint-disable-next-line no-eval, no-underscore-dangle
    expect(eval(testMod._source.source())).toMatchSnapshot('result');

    done();
  });
}, 30000);
