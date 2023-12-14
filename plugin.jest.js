const path = require('path');
const crypto = require('crypto');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { RawSource } = require('webpack-sources');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const {
  WEBPACK_OUTPUT_DIR,
  createWebpackConfig,
  webpackCompile,
} = require('./test-utils/webpack-helpers');
const CspHtmlWebpackPlugin = require('./plugin');

const testOptions = {
  enabled: true,
  integrityEnabled: false,
  primeReactEnabled: true,
  hashingMethod: 'sha384',
  hashEnabled: {
    'script-src': true,
    'style-src': true,
  },
  nonceEnabled: {
    'script-src': true,
    'style-src': true,
  },
};

describe('CspHtmlWebpackPlugin', () => {
  beforeEach(() => {
    jest
      .spyOn(crypto, 'randomBytes')
      .mockImplementationOnce(() => 'primereact-nonce')
      .mockImplementationOnce(() => 'mockedbase64string-1')
      .mockImplementationOnce(() => 'mockedbase64string-2')
      .mockImplementationOnce(() => 'mockedbase64string-3')
      .mockImplementationOnce(() => 'mockedbase64string-4')
      .mockImplementationOnce(() => 'mockedbase64string-5')
      .mockImplementationOnce(() => 'mockedbase64string-6')
      .mockImplementationOnce(() => 'mockedbase64string-7')
      .mockImplementationOnce(() => 'mockedbase64string-8')
      .mockImplementationOnce(() => 'mockedbase64string-9')
      .mockImplementationOnce(() => 'mockedbase64string-10')
      .mockImplementation(
        () => new Error('Need to add more crypto.randomBytes mocks')
      );
  });

  afterEach(() => {
    crypto.randomBytes.mockReset();
  });

  describe('Error checking', () => {
    it('throws an error if an invalid hashing method is used', () => {
      expect(() => {
        // eslint-disable-next-line no-new
        new CspHtmlWebpackPlugin(
          {},
          {
            hashingMethod: 'invalid',
          }
        );
      }).toThrow(new Error(`'invalid' is not a valid hashing method`));
    });

    describe('validatePolicy', () => {
      [
        'self',
        'unsafe-inline',
        'unsafe-eval',
        'none',
        'strict-dynamic',
        'report-sample',
      ].forEach((source) => {
        it(`throws an error if '${source}' is not wrapped in apostrophes in an array defined policy`, () => {
          const config = createWebpackConfig([
            new HtmlWebpackPlugin({
              filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
              template: path.join(
                __dirname,
                'test-utils',
                'fixtures',
                'with-nothing.html'
              ),
            }),
            new CspHtmlWebpackPlugin(
              {
                'script-src': [source],
              },
              testOptions
            ),
          ]);

          return webpackCompile(
            config,
            (_1, _2, _3, errors) => {
              expect(errors[0]).toEqual(
                new Error(
                  `CSP: policy for script-src contains ${source} which should be wrapped in apostrophes`
                )
              );
            },
            {
              expectError: true,
            }
          );
        });

        it(`throws an error if '${source}' is not wrapped in apostrophes in a string defined policy`, () => {
          const config = createWebpackConfig([
            new HtmlWebpackPlugin({
              filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
              template: path.join(
                __dirname,
                'test-utils',
                'fixtures',
                'with-nothing.html'
              ),
            }),
            new CspHtmlWebpackPlugin(
              {
                'script-src': source,
              },
              testOptions
            ),
          ]);

          return webpackCompile(
            config,
            (_1, _2, _3, errors) => {
              expect(errors[0]).toEqual(
                new Error(
                  `CSP: policy for script-src contains ${source} which should be wrapped in apostrophes`
                )
              );
            },
            {
              expectError: true,
            }
          );
        });
      });
    });
  });

  describe('Adding sha and nonce checksums', () => {
    it('inserts the default policy, including sha-256 hashes of other inline scripts and styles found, and nonce hashes of external scripts found', () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-script-and-style.html'
          ),
        }),
        new CspHtmlWebpackPlugin({}, testOptions),
      ]);

      return webpackCompile(config, (csps) => {
        const expected =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-I8j99RwEV9SFO6EKWmKLpw3VxsvfabPoUJPZMFL1WWGjVShwX4YDWuJfq5+077jO' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-1' 'nonce-mockedbase64string-2';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-3P+ddXxfmvvtbEUrdZKBMTjmKpirnUElgB2vlkVZ4l6LCQYHCIyFMLp+OKTIR6ob' 'nonce-mockedbase64string-3' 'nonce-primereact-nonce'";

        expect(csps['index.html']).toEqual(expected);
      });
    });

    it('inserts hashes for linked scripts and styles from the same Webpack build', () => {
      const config = createWebpackConfig(
        [
          new HtmlWebpackPlugin({
            filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
            template: path.join(
              __dirname,
              'test-utils',
              'fixtures',
              'external-scripts-styles.html'
            ),
          }),
          new MiniCssExtractPlugin(),
          new CspHtmlWebpackPlugin(),
        ],
        undefined,
        'index-styled.js',
        {
          module: {
            rules: [
              {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
              },
            ],
          },
        }
      );
      // the following setting is required for SRI to work:
      config.output.crossOriginLoading = 'anonymous';

      return webpackCompile(config, (csps) => {
        const expected =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-WgET5XoAJGc0It6r8VkXSFPWq9s8fkK6gkP+veIwTd3X+jBr00Jqir+6n2anN3T4' 'nonce-mockedbase64string-1' 'nonce-mockedbase64string-2' 'nonce-mockedbase64string-3';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-ePgPKVdofu2Id6+vq//vnkON0KolpiwbPbJuiALXh1vTb/dXtC/WjAbgcrL5N1wz' 'nonce-mockedbase64string-4' 'nonce-mockedbase64string-5' 'nonce-mockedbase64string-6' 'nonce-primereact-nonce'";

        expect(csps['index.html']).toEqual(expected);
      });
    });

    it('only inserts hashes for linked scripts and styles from the same HtmlWebpackPlugin instance', () => {
      const config = createWebpackConfig(
        [
          new HtmlWebpackPlugin({
            filename: path.join(WEBPACK_OUTPUT_DIR, 'index-1.html'),
            template: path.join(
              __dirname,
              'test-utils',
              'fixtures',
              'external-scripts-styles.html'
            ),
            chunks: ['1'],
          }),
          new HtmlWebpackPlugin({
            filename: path.join(WEBPACK_OUTPUT_DIR, 'index-2.html'),
            template: path.join(
              __dirname,
              'test-utils',
              'fixtures',
              'external-scripts-styles.html'
            ),
            chunks: ['2'],
          }),
          new MiniCssExtractPlugin(),
          new CspHtmlWebpackPlugin(),
        ],
        undefined,
        undefined,
        {
          entry: {
            1: path.join(__dirname, 'test-utils', 'fixtures', 'index-1.js'),
            2: path.join(__dirname, 'test-utils', 'fixtures', 'index-2.js'),
          },
          module: {
            rules: [
              {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
              },
            ],
          },
          output: {
            path: WEBPACK_OUTPUT_DIR,
            filename: 'index-[name].bundle.js',
            crossOriginLoading: 'anonymous',
          },
        }
      );

      return webpackCompile(config, (csps) => {
        const expected1 =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-MNBsDd86ojq/E2ui0CRqhF7X8jLUhjXV09NVZ6oqeq5r0ZHH9345GYhftO9U8yfA' 'nonce-mockedbase64string-1' 'nonce-mockedbase64string-2' 'nonce-mockedbase64string-3';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'nonce-mockedbase64string-4' 'nonce-mockedbase64string-5' 'nonce-primereact-nonce'";
        const expected2 =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-LF8cxUorWv/F9Ftzm+e8te0dhz9zILBuNuJQUQwDdPJopBzXiSUakOVQ+qEnd3yx' 'nonce-mockedbase64string-6' 'nonce-mockedbase64string-7' 'nonce-mockedbase64string-8';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'nonce-mockedbase64string-9' 'nonce-mockedbase64string-10' 'nonce-primereact-nonce'";

        expect(csps['index-1.html']).toEqual(expected1);
        expect(csps['index-2.html']).toEqual(expected2);
      });
    });

    it('inserts a custom policy if one is defined', () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-nothing.html'
          ),
        }),
        new CspHtmlWebpackPlugin(
          {
            'base-uri': ["'self'", 'https://slack.com'],
            'font-src': ["'self'", "'https://a-slack-edge.com'"],
            'script-src': ["'self'"],
            'style-src': ["'self'"],
            'connect-src': ["'self'"],
          },
          testOptions
        ),
      ]);

      return webpackCompile(config, (csps) => {
        const expected =
          "base-uri 'self' https://slack.com;" +
          " object-src 'none';" +
          " script-src 'self' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-1';" +
          " style-src 'self' 'nonce-primereact-nonce';" +
          " font-src 'self' 'https://a-slack-edge.com';" +
          " connect-src 'self'";

        expect(csps['index.html']).toEqual(expected);
      });
    });

    it('handles string values for policies where hashes and nonces are appended', () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-script-and-style.html'
          ),
        }),
        new CspHtmlWebpackPlugin(
          {
            'script-src': "'self'",
            'style-src': "'self'",
          },
          testOptions
        ),
      ]);

      return webpackCompile(config, (csps) => {
        const expected =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'self' 'sha384-I8j99RwEV9SFO6EKWmKLpw3VxsvfabPoUJPZMFL1WWGjVShwX4YDWuJfq5+077jO' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-1' 'nonce-mockedbase64string-2';" +
          " style-src 'self' 'sha384-3P+ddXxfmvvtbEUrdZKBMTjmKpirnUElgB2vlkVZ4l6LCQYHCIyFMLp+OKTIR6ob' 'nonce-mockedbase64string-3' 'nonce-primereact-nonce'";

        expect(csps['index.html']).toEqual(expected);
      });
    });

    it("doesn't add nonces for scripts / styles generated where their host has already been defined in the CSP, and 'strict-dynamic' doesn't exist in the policy", () => {
      const config = createWebpackConfig(
        [
          new HtmlWebpackPlugin({
            filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
            template: path.join(
              __dirname,
              'test-utils',
              'fixtures',
              'with-script-and-style.html'
            ),
          }),
          new CspHtmlWebpackPlugin(
            {
              'script-src': ["'self'", 'https://my.cdn.com'],
              'style-src': ["'self'"],
            },
            testOptions
          ),
        ],
        'https://my.cdn.com/'
      );

      return webpackCompile(config, (csps, selectors) => {
        const $ = selectors['index.html'];
        const expected =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'self' https://my.cdn.com 'sha384-I8j99RwEV9SFO6EKWmKLpw3VxsvfabPoUJPZMFL1WWGjVShwX4YDWuJfq5+077jO' 'nonce-mockedbase64string-1';" +
          " style-src 'self' 'sha384-3P+ddXxfmvvtbEUrdZKBMTjmKpirnUElgB2vlkVZ4l6LCQYHCIyFMLp+OKTIR6ob' 'nonce-mockedbase64string-2' 'nonce-primereact-nonce'";

        // csp should be defined properly
        expect(csps['index.html']).toEqual(expected);

        // script with host not defined should have nonce defined, and correct
        expect($('script')[0].attribs.src).toEqual(
          'https://example.com/example.js'
        );
        expect($('script')[0].attribs.nonce).toEqual('mockedbase64string-1');

        // inline script, so no nonce
        expect($('script')[1].attribs).toEqual({});

        // script with host defined should not have a nonce
        expect($('script')[2].attribs.src).toEqual(
          'https://my.cdn.com/index.bundle.js'
        );
        expect(Object.keys($('script')[2].attribs)).not.toContain('nonce');
      });
    });

    it("continues to add nonces to scripts / styles even if the host has already been whitelisted due to 'strict-dynamic' existing in the policy", () => {
      const config = createWebpackConfig(
        [
          new HtmlWebpackPlugin({
            filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
            template: path.join(
              __dirname,
              'test-utils',
              'fixtures',
              'with-script-and-style.html'
            ),
          }),
          new CspHtmlWebpackPlugin(
            {
              'script-src': [
                "'self'",
                "'strict-dynamic'",
                'https://my.cdn.com',
              ],
              'style-src': ["'self'"],
            },
            testOptions
          ),
        ],
        'https://my.cdn.com/'
      );

      return webpackCompile(config, (csps, selectors) => {
        const $ = selectors['index.html'];

        // 'strict-dynamic' should be at the end of the script-src here
        const expected =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'self' https://my.cdn.com 'sha384-I8j99RwEV9SFO6EKWmKLpw3VxsvfabPoUJPZMFL1WWGjVShwX4YDWuJfq5+077jO' 'nonce-mockedbase64string-1' 'nonce-mockedbase64string-2' 'strict-dynamic';" +
          " style-src 'self' 'sha384-3P+ddXxfmvvtbEUrdZKBMTjmKpirnUElgB2vlkVZ4l6LCQYHCIyFMLp+OKTIR6ob' 'nonce-mockedbase64string-3' 'nonce-primereact-nonce'";

        // csp should be defined properly
        expect(csps['index.html']).toEqual(expected);

        // script with host not defined should have nonce defined, and correct
        expect($('script')[0].attribs.src).toEqual(
          'https://example.com/example.js'
        );
        expect($('script')[0].attribs.nonce).toEqual('mockedbase64string-1');

        // inline script, so no nonce
        expect($('script')[1].attribs).toEqual({});

        // script with host defined should also have a nonce
        expect($('script')[2].attribs.src).toEqual(
          'https://my.cdn.com/index.bundle.js'
        );
        expect($('script')[2].attribs.nonce).toEqual('mockedbase64string-2');
      });
    });

    describe('HtmlWebpackPlugin defined policy', () => {
      it('inserts a custom policy from a specific HtmlWebpackPlugin instance, if one is defined', () => {
        const config = createWebpackConfig([
          new HtmlWebpackPlugin({
            filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
            template: path.join(
              __dirname,
              'test-utils',
              'fixtures',
              'with-nothing.html'
            ),
            cspPlugin: {
              policy: {
                'base-uri': ["'self'", 'https://slack.com'],
                'font-src': ["'self'", "'https://a-slack-edge.com'"],
                'script-src': ["'self'"],
                'style-src': ["'self'"],
                'connect-src': ["'self'"],
              },
            },
          }),
          new CspHtmlWebpackPlugin({}, testOptions),
        ]);

        return webpackCompile(config, (csps) => {
          const expected =
            "base-uri 'self' https://slack.com;" +
            " object-src 'none';" +
            " script-src 'self' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-1';" +
            " style-src 'self' 'nonce-primereact-nonce';" +
            " font-src 'self' 'https://a-slack-edge.com';" +
            " connect-src 'self'";

          expect(csps['index.html']).toEqual(expected);
        });
      });

      it('merges and overwrites policies, with a html webpack plugin instance policy taking precedence, followed by the csp instance, and then the default policy', () => {
        const config = createWebpackConfig([
          new HtmlWebpackPlugin({
            filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
            template: path.join(
              __dirname,
              'test-utils',
              'fixtures',
              'with-nothing.html'
            ),
            cspPlugin: {
              policy: {
                'font-src': [
                  "'https://a-slack-edge.com'",
                  "'https://b-slack-edge.com'",
                ],
              },
            },
          }),
          new CspHtmlWebpackPlugin(
            {
              'base-uri': ["'self'", 'https://slack.com'],
              'font-src': ["'self'"],
            },
            testOptions
          ),
        ]);

        return webpackCompile(config, (csps) => {
          const expected =
            "base-uri 'self' https://slack.com;" + // this should be included as it's not defined in the HtmlWebpackPlugin instance
            " object-src 'none';" + // this comes from the default policy
            " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-1';" + // this comes from the default policy
            " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'nonce-primereact-nonce';" + // this comes from the default policy
            " font-src 'https://a-slack-edge.com' 'https://b-slack-edge.com'"; // this should only include the HtmlWebpackPlugin instance policy

          expect(csps['index.html']).toEqual(expected);
        });
      });

      it('only adds a custom policy to the html file which has a policy defined; uses the default policy for any others', () => {
        const config = createWebpackConfig([
          new HtmlWebpackPlugin({
            filename: path.join(WEBPACK_OUTPUT_DIR, 'index-csp.html'),
            template: path.join(
              __dirname,
              'test-utils',
              'fixtures',
              'with-nothing.html'
            ),
            cspPlugin: {
              policy: {
                'script-src': ["'https://a-slack-edge.com'"],
                'style-src': ["'https://b-slack-edge.com'"],
              },
            },
          }),
          new HtmlWebpackPlugin({
            filename: path.join(WEBPACK_OUTPUT_DIR, 'index-no-csp.html'),
            template: path.join(
              __dirname,
              'test-utils',
              'fixtures',
              'with-nothing.html'
            ),
          }),
          new CspHtmlWebpackPlugin({}, testOptions),
        ]);

        return webpackCompile(config, (csps) => {
          const expectedCustom =
            "base-uri 'self';" +
            " object-src 'none';" +
            " script-src 'https://a-slack-edge.com' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-1';" +
            " style-src 'https://b-slack-edge.com' 'nonce-primereact-nonce'";

          const expectedDefault =
            "base-uri 'self';" +
            " object-src 'none';" +
            " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-2';" +
            " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'nonce-primereact-nonce'";

          expect(csps['index-csp.html']).toEqual(expectedCustom);
          expect(csps['index-no-csp.html']).toEqual(expectedDefault);
        });
      });
    });
  });

  describe('Adding integrity attribute', () => {
    it('adds an integrity attribute to linked scripts and styles', () => {
      const config = createWebpackConfig(
        [
          new HtmlWebpackPlugin({
            filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
            template: path.join(
              __dirname,
              'test-utils',
              'fixtures',
              'external-scripts-styles.html'
            ),
          }),
          new MiniCssExtractPlugin(),
          new CspHtmlWebpackPlugin(),
        ],
        undefined,
        'index-styled.js',
        {
          module: {
            rules: [
              {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
              },
            ],
          },
        }
      );
      // the following setting is required for SRI to work:
      config.output.crossOriginLoading = 'anonymous';

      return webpackCompile(config, (_, html) => {
        const scripts = html['index.html']('script[src]');
        const styles = html['index.html']('link[rel="stylesheet"]');

        scripts.each((i, script) => {
          if (!script.attribs.src.startsWith('http')) {
            expect(script.attribs.integrity).toEqual(
              'sha384-WgET5XoAJGc0It6r8VkXSFPWq9s8fkK6gkP+veIwTd3X+jBr00Jqir+6n2anN3T4'
            );
          } else {
            expect(script.attribs.integrity).toBeUndefined();
          }
        });
        styles.each((i, style) => {
          if (!style.attribs.href.startsWith('http')) {
            expect(style.attribs.integrity).toEqual(
              'sha384-ePgPKVdofu2Id6+vq//vnkON0KolpiwbPbJuiALXh1vTb/dXtC/WjAbgcrL5N1wz'
            );
          } else {
            expect(style.attribs.integrity).toBeUndefined();
          }
        });
      });
    });

    it('does not add an integrity attribute to inline scripts or styles', () => {
      const config = createWebpackConfig(
        [
          new HtmlWebpackPlugin({
            filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
            template: path.join(
              __dirname,
              'test-utils',
              'fixtures',
              'with-script-and-style.html'
            ),
          }),
          new MiniCssExtractPlugin(),
          new CspHtmlWebpackPlugin(),
        ],
        undefined,
        'index-styled.js',
        {
          module: {
            rules: [
              {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
              },
            ],
          },
        }
      );

      // the following setting is required for SRI to work:
      config.output.crossOriginLoading = 'anonymous';

      return webpackCompile(config, (_, html) => {
        const scripts = html['index.html']('script:not([src])');
        const styles = html['index.html']('style');

        scripts.each((i, script) => {
          expect(script.attribs.integrity).toBeUndefined();
        });
        styles.each((i, style) => {
          expect(style.attribs.integrity).toBeUndefined();
        });
      });
    });
  });

  describe('Hash / Nonce enabled check', () => {
    it("doesn't add hashes to any policy rule if that policy rule has been globally disabled", () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index-1.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-script-and-style.html'
          ),
        }),
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index-2.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-script-and-style.html'
          ),
        }),
        new CspHtmlWebpackPlugin(
          {},
          {
            hashEnabled: {
              'script-src': false,
              'style-src': false,
            },
            integrityEnabled: false,
          }
        ),
      ]);

      return webpackCompile(config, (csps) => {
        const expected1 =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'nonce-mockedbase64string-1' 'nonce-mockedbase64string-2';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'nonce-mockedbase64string-3' 'nonce-primereact-nonce'";

        const expected2 =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'nonce-mockedbase64string-4' 'nonce-mockedbase64string-5';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'nonce-mockedbase64string-6' 'nonce-primereact-nonce'";

        // no hashes in either one of the script-src or style-src policies
        expect(csps['index-1.html']).toEqual(expected1);
        expect(csps['index-2.html']).toEqual(expected2);
      });
    });

    it("doesn't add nonces to any policy rule if that policy rule has been globally disabled", () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index-1.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-script-and-style.html'
          ),
        }),
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index-2.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-script-and-style.html'
          ),
        }),
        new CspHtmlWebpackPlugin(
          {},
          {
            nonceEnabled: {
              'script-src': false,
              'style-src': false,
            },
            integrityEnabled: false,
          }
        ),
      ]);

      return webpackCompile(config, (csps) => {
        const expected1 =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-I8j99RwEV9SFO6EKWmKLpw3VxsvfabPoUJPZMFL1WWGjVShwX4YDWuJfq5+077jO' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-3P+ddXxfmvvtbEUrdZKBMTjmKpirnUElgB2vlkVZ4l6LCQYHCIyFMLp+OKTIR6ob' 'nonce-primereact-nonce'";

        const expected2 =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-I8j99RwEV9SFO6EKWmKLpw3VxsvfabPoUJPZMFL1WWGjVShwX4YDWuJfq5+077jO' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-3P+ddXxfmvvtbEUrdZKBMTjmKpirnUElgB2vlkVZ4l6LCQYHCIyFMLp+OKTIR6ob' 'nonce-primereact-nonce'";

        // no nonces in either one of the script-src or style-src policies
        expect(csps['index-1.html']).toEqual(expected1);
        expect(csps['index-2.html']).toEqual(expected2);
      });
    });

    it("doesn't add hashes to a specific policy rule if that policy rule has been disabled for that instance of HtmlWebpackPlugin", () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index-no-hashes.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-script-and-style.html'
          ),
          cspPlugin: {
            hashEnabled: {
              'script-src': false,
              'style-src': false,
            },
          },
        }),
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index-hashes.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-script-and-style.html'
          ),
        }),
        new CspHtmlWebpackPlugin({}, testOptions),
      ]);

      return webpackCompile(config, (csps) => {
        const expectedNoHashes =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'nonce-mockedbase64string-1' 'nonce-mockedbase64string-2';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'nonce-mockedbase64string-3' 'nonce-primereact-nonce'";

        const expectedHashes =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-I8j99RwEV9SFO6EKWmKLpw3VxsvfabPoUJPZMFL1WWGjVShwX4YDWuJfq5+077jO' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-4' 'nonce-mockedbase64string-5';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-3P+ddXxfmvvtbEUrdZKBMTjmKpirnUElgB2vlkVZ4l6LCQYHCIyFMLp+OKTIR6ob' 'nonce-mockedbase64string-6' 'nonce-primereact-nonce'";

        // no hashes in index-no-hashes script-src or style-src policies
        expect(csps['index-no-hashes.html']).toEqual(expectedNoHashes);
        expect(csps['index-hashes.html']).toEqual(expectedHashes);
      });
    });

    it("doesn't add nonces to a specific policy rule if that policy rule has been disabled for that instance of HtmlWebpackPlugin", () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index-no-nonce.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-script-and-style.html'
          ),
          cspPlugin: {
            nonceEnabled: {
              'script-src': false,
              'style-src': false,
            },
          },
        }),
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index-nonce.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-script-and-style.html'
          ),
        }),
        new CspHtmlWebpackPlugin({}, testOptions),
      ]);

      return webpackCompile(config, (csps) => {
        const expectedNoNonce =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-I8j99RwEV9SFO6EKWmKLpw3VxsvfabPoUJPZMFL1WWGjVShwX4YDWuJfq5+077jO' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-3P+ddXxfmvvtbEUrdZKBMTjmKpirnUElgB2vlkVZ4l6LCQYHCIyFMLp+OKTIR6ob' 'nonce-primereact-nonce'";

        const expectedNonce =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-I8j99RwEV9SFO6EKWmKLpw3VxsvfabPoUJPZMFL1WWGjVShwX4YDWuJfq5+077jO' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-1' 'nonce-mockedbase64string-2';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-3P+ddXxfmvvtbEUrdZKBMTjmKpirnUElgB2vlkVZ4l6LCQYHCIyFMLp+OKTIR6ob' 'nonce-mockedbase64string-3' 'nonce-primereact-nonce'";

        // no nonce in index-no-nonce script-src or style-src policies
        expect(csps['index-no-nonce.html']).toEqual(expectedNoNonce);
        expect(csps['index-nonce.html']).toEqual(expectedNonce);
      });
    });
  });

  describe('Plugin enabled check', () => {
    it("doesn't modify the html if enabled is the bool false", () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-no-meta-tag.html'
          ),
        }),
        new CspHtmlWebpackPlugin(
          {},
          {
            enabled: false,
          }
        ),
      ]);

      return webpackCompile(config, (csps, selectors) => {
        expect(csps['index.html']).toBeUndefined();
        expect(selectors['index.html']('meta').length).toEqual(1);
        expect(selectors['index.html']('[integrity]').length).toEqual(0);
        expect(selectors['index.html']('[integrity]').length).toEqual(0);
        expect(selectors['index.html']('[integrity]').length).toEqual(0);
      });
    });

    it("doesn't modify the html if the `cspPlugin.enabled` option in HtmlWebpack Plugin is false", () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-no-meta-tag.html'
          ),
          cspPlugin: {
            enabled: false,
          },
        }),
        new CspHtmlWebpackPlugin({}, testOptions),
      ]);

      return webpackCompile(config, (csps, selectors) => {
        expect(csps['index.html']).toBeUndefined();
        expect(selectors['index.html']('meta').length).toEqual(1);
      });
    });

    it("doesn't modify the html if enabled is a function which return false", () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-no-meta-tag.html'
          ),
        }),
        new CspHtmlWebpackPlugin(
          {},
          {
            enabled: () => false,
            integrityEnabled: false,
          }
        ),
      ]);

      return webpackCompile(config, (csps, selectors) => {
        expect(csps['index.html']).toBeUndefined();
        expect(selectors['index.html']('meta').length).toEqual(1);
      });
    });

    it("doesn't modify html from the HtmlWebpackPlugin instance which has been disabled", () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index-enabled.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-no-meta-tag.html'
          ),
        }),
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index-disabled.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-no-meta-tag.html'
          ),
          cspPlugin: {
            enabled: false,
          },
        }),
        new CspHtmlWebpackPlugin({}, testOptions),
      ]);

      return webpackCompile(config, (csps, selectors) => {
        expect(csps['index-enabled.html']).toBeDefined();
        expect(csps['index-disabled.html']).toBeUndefined();
        expect(selectors['index-enabled.html']('meta').length).toEqual(2);
        expect(selectors['index-disabled.html']('meta').length).toEqual(1);
        expect(selectors['index-enabled.html']('[integrity]').length).toEqual(
          1
        );
        expect(selectors['index-disabled.html']('[integrity]').length).toEqual(
          0
        );
      });
    });
  });

  describe('Meta tag', () => {
    it('still adds the CSP policy into the CSP meta tag even if the content attribute is missing', () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-no-content-attr.html'
          ),
        }),
        new CspHtmlWebpackPlugin({}, testOptions),
      ]);

      return webpackCompile(config, (csps) => {
        const expected =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-1';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'nonce-primereact-nonce'";

        expect(csps['index.html']).toEqual(expected);
      });
    });

    it('adds meta tag with completed policy when no meta tag is specified', () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-no-meta-tag.html'
          ),
        }),
        new CspHtmlWebpackPlugin({}, testOptions),
      ]);

      return webpackCompile(config, (csps) => {
        const expected =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-1';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'nonce-primereact-nonce'";

        expect(csps['index.html']).toEqual(expected);
      });
    });

    it('adds meta tag with completed policy when no template is specified', () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
        }),
        new CspHtmlWebpackPlugin({}, testOptions),
      ]);

      return webpackCompile(config, (csps) => {
        const expected =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-1';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'nonce-primereact-nonce'";

        expect(csps['index.html']).toEqual(expected);
      });
    });

    it("adds the meta tag as the top most meta tag to ensure that the CSP is defined before we try loading any other scripts, if it doesn't exist", () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-script-and-style.html'
          ),
        }),
        new CspHtmlWebpackPlugin({}, testOptions),
      ]);

      return webpackCompile(config, (csps, selectors) => {
        const $ = selectors['index.html'];
        const metaTags = $('meta');

        expect(metaTags[0].attribs['http-equiv']).toEqual(
          'Content-Security-Policy'
        );
      });
    });
  });

  describe('Custom process function', () => {
    it('Allows the process function to be overwritten', () => {
      const processFn = jest.fn();
      const builtPolicy = `base-uri 'self'; object-src 'none'; script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-I8j99RwEV9SFO6EKWmKLpw3VxsvfabPoUJPZMFL1WWGjVShwX4YDWuJfq5+077jO' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-1' 'nonce-mockedbase64string-2'; style-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-3P+ddXxfmvvtbEUrdZKBMTjmKpirnUElgB2vlkVZ4l6LCQYHCIyFMLp+OKTIR6ob' 'nonce-mockedbase64string-3' 'nonce-primereact-nonce'`;

      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-script-and-style.html'
          ),
        }),
        new CspHtmlWebpackPlugin(
          {},
          {
            processFn,
            integrityEnabled: false,
          }
        ),
      ]);

      return webpackCompile(config, (csps) => {
        // we've overwritten the default processFn, which writes the policy into the html file
        // so it won't exist in this object anymore.
        expect(csps['index.html']).toBeUndefined();

        // The processFn should receive the built policy as it's first arg
        expect(processFn).toHaveBeenCalledWith(
          builtPolicy,
          expect.anything(),
          expect.anything(),
          expect.anything()
        );
      });
    });

    it('only overwrites the processFn for the HtmlWebpackInstance where it has been defined', () => {
      const processFn = jest.fn();
      const index1BuiltPolicy = `base-uri 'self'; object-src 'none'; script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-I8j99RwEV9SFO6EKWmKLpw3VxsvfabPoUJPZMFL1WWGjVShwX4YDWuJfq5+077jO' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-1' 'nonce-mockedbase64string-2'; style-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-3P+ddXxfmvvtbEUrdZKBMTjmKpirnUElgB2vlkVZ4l6LCQYHCIyFMLp+OKTIR6ob' 'nonce-mockedbase64string-3' 'nonce-primereact-nonce'`;
      const index2BuiltPolicy = `base-uri 'self'; object-src 'none'; script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-I8j99RwEV9SFO6EKWmKLpw3VxsvfabPoUJPZMFL1WWGjVShwX4YDWuJfq5+077jO' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-4' 'nonce-mockedbase64string-5'; style-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-3P+ddXxfmvvtbEUrdZKBMTjmKpirnUElgB2vlkVZ4l6LCQYHCIyFMLp+OKTIR6ob' 'nonce-mockedbase64string-6' 'nonce-primereact-nonce'`;

      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index-1.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-script-and-style.html'
          ),
          cspPlugin: {
            processFn,
          },
        }),
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index-2.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-script-and-style.html'
          ),
        }),
        new CspHtmlWebpackPlugin({}, testOptions),
      ]);

      return webpackCompile(config, (csps) => {
        // it won't exist in the html file since we overwrote processFn
        expect(csps['index-1.html']).toBeUndefined();
        // processFn wasn't overwritten here, so this should be added to the html file as normal
        expect(csps['index-2.html']).toEqual(index2BuiltPolicy);

        // index-1.html should have used our custom function defined
        expect(processFn).toHaveBeenCalledWith(
          index1BuiltPolicy,
          expect.anything(),
          expect.anything(),
          expect.anything()
        );
      });
    });

    it('Allows to generate a file containing the policy', () => {
      function generateCSPFile(
        builtPolicy,
        _htmlPluginData,
        _obj,
        compilation
      ) {
        compilation.emitAsset('csp.conf', new RawSource(builtPolicy));
      }
      const index1BuiltPolicy = `base-uri 'self'; object-src 'none'; script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-I8j99RwEV9SFO6EKWmKLpw3VxsvfabPoUJPZMFL1WWGjVShwX4YDWuJfq5+077jO' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-1' 'nonce-mockedbase64string-2'; style-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-3P+ddXxfmvvtbEUrdZKBMTjmKpirnUElgB2vlkVZ4l6LCQYHCIyFMLp+OKTIR6ob' 'nonce-mockedbase64string-3' 'nonce-primereact-nonce'`;

      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index-1.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-script-and-style.html'
          ),
        }),
        new CspHtmlWebpackPlugin(
          {},
          {
            processFn: generateCSPFile,
            integrityEnabled: false,
          }
        ),
      ]);

      return webpackCompile(config, (csps, selectors, fileSystem) => {
        const cspFileContent = fileSystem
          .readFileSync(path.join(WEBPACK_OUTPUT_DIR, 'csp.conf'), 'utf8')
          .toString();

        // it won't exist in the html file since we overwrote processFn
        expect(csps['index-1.html']).toBeUndefined();

        // A file has been generated
        expect(cspFileContent).toEqual(index1BuiltPolicy);
      });
    });
  });

  describe('HTML parsing', () => {
    it("doesn't encode escaped HTML entities", () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-escaped-html.html'
          ),
        }),
        new CspHtmlWebpackPlugin({}, testOptions),
      ]);

      return webpackCompile(config, (_, selectors) => {
        const $ = selectors['index.html'];
        expect($('body').html().trim()).toEqual(
          '&lt;h1&gt;Escaped Content&lt;h1&gt;'
        );
      });
    });

    it('generates a hash for style tags wrapped in noscript tags', () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-noscript-tags.html'
          ),
        }),
        new CspHtmlWebpackPlugin({}, testOptions),
      ]);

      return webpackCompile(config, (csps) => {
        const expected =
          "base-uri 'self';" +
          " object-src 'none';" +
          " script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-1';" +
          " style-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-cgYi6eN32TaTz3QrlHQ6sNzjd+bVpCL/DE1qzIF7vnAq1RbzHcrvDE9Cpvwk09cG' 'nonce-primereact-nonce'";

        expect(csps['index.html']).toEqual(expected);
      });
    });

    it('honors xhtml mode if set on the html-webpack-plugin instance', () => {
      const config = createWebpackConfig([
        new HtmlWebpackPlugin({
          filename: path.join(WEBPACK_OUTPUT_DIR, 'index.html'),
          template: path.join(
            __dirname,
            'test-utils',
            'fixtures',
            'with-xhtml.html'
          ),
          xhtml: true,
        }),
        new CspHtmlWebpackPlugin({}, testOptions),
      ]);

      return webpackCompile(config, (csps, selectors, fileSystem) => {
        const xhtmlContents = fileSystem
          .readFileSync(path.join(WEBPACK_OUTPUT_DIR, 'index.html'), 'utf8')
          .toString();

        // correct doctype
        expect(xhtmlContents).toContain(
          '<!DOCTYPE composition PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">'
        );

        // self closing tag
        expect(xhtmlContents).toContain(
          '<meta name="author" content="Slack"/>'
        );

        // csp has been added in
        expect(xhtmlContents).toContain(
          "<meta http-equiv=\"Content-Security-Policy\" content=\"base-uri 'self'; object-src 'none'; script-src 'unsafe-inline' 'self' 'unsafe-eval' 'sha384-rGumVytQRHlFeUsbLx6mhENgPUXD3Vs9nl5eV91pTDa+fYTdj7pa8SEoS7lKrmRe' 'nonce-mockedbase64string-1'; style-src 'unsafe-inline' 'self' 'unsafe-eval' 'nonce-primereact-nonce'\"/>"
        );
      });
    });
  });
});
