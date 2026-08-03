import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1400,1000'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1000 });

const EMAIL = process.env.FLEET_EMAIL;
const PASSWORD = process.env.FLEET_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error(
    'Set FLEET_EMAIL and FLEET_PASSWORD before running this.\n' +
      '  FLEET_EMAIL=you@example.com FLEET_PASSWORD=… npm run smoke\n' +
      'They are the dashboard sign-in, and are read from the environment so ' +
      'they never end up in the repository.',
  );
  process.exit(1);
}

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
await page.type('input[type=email]', EMAIL);
await page.type('input[type=password]', PASSWORD);
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 25000 }).catch(() => {}),
  page.click('button[type=submit], .btn-primary'),
]);
await new Promise((r) => setTimeout(r, 3500));

console.log('URL AFTER LOGIN:', page.url());
const body = await page.evaluate(() => document.body.innerText.slice(0, 400));
console.log('--- page text ---');
console.log(body);
if (errors.length) console.log('--- console errors ---\n' + errors.join('\n'));

await page.screenshot({ path: '/tmp/dash_real.png', fullPage: false });
await browser.close();
