import webpack from 'webpack';

import sassLoaderConfig from './sass-loader-example/webpack.config';

test("Processes sass-loader's @import correctly", (done) => {
  const config = sassLoaderConfig({});

  webpack(config, (err, stats) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }

    expect(err).toBe(null);

    if (stats.hasErrors()) {
      // eslint-disable-next-line no-console
      console.error(stats.toJson().errors);
    }
    expect(stats.hasErrors()).toBe(false);
    done();
  });
}, 30000);
