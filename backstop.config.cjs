module.exports = {
  id: 'cavern-ui-regression',
  viewports: [
    { label: 'desktop', width: 1440, height: 900 },
    { label: 'mobile', width: 390, height: 844 },
  ],
  scenarios: [
    {
      label: 'title-screen',
      url: 'http://127.0.0.1:3000',
      selectors: ['document'],
      misMatchThreshold: 0.1,
    },
  ],
  paths: {
    bitmaps_reference: 'tests/visual/backstop_data/bitmaps_reference',
    bitmaps_test: 'tests/visual/backstop_data/bitmaps_test',
    engine_scripts: 'tests/visual/backstop_data/engine_scripts',
    html_report: 'tests/visual/backstop_data/html_report',
    ci_report: 'tests/visual/backstop_data/ci_report',
  },
  report: ['browser', 'CI'],
  engine: 'puppeteer',
  engineOptions: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
  asyncCaptureLimit: 2,
  asyncCompareLimit: 10,
  debug: false,
  debugWindow: false,
};
