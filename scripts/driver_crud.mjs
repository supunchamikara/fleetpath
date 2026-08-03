import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1500,1100'],
});
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

const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1100 });
page.on('dialog', (d) => d.accept());

await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
await page.type('input[type=email]', EMAIL);
await page.type('input[type=password]', PASSWORD);
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {}),
  page.click('.btn-primary'),
]);

await page.goto('http://localhost:3000/dashboard/drivers', { waitUntil: 'networkidle0' });

// Add a driver from the web.
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Add driver');
  b.click();
});
await new Promise((r) => setTimeout(r, 600));
const inputs = await page.$$('input.input');
await inputs[0].type('webdriver');
await inputs[1].type('7788');
await inputs[2].type('7788');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Create driver'));
  b.click();
});
await new Promise((r) => setTimeout(r, 3500));

const text = await page.evaluate(() => document.body.innerText);
console.log('CREATED webdriver present:', text.includes('webdriver'));
await page.screenshot({ path: '/tmp/drivers_crud.png' });
await browser.close();
