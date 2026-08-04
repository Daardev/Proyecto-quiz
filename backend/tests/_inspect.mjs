import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on('response', async (r) => {
    const url = r.url();
    if (url.includes('/submit')) {
      console.log('SUBMIT RESPONSE:', r.status());
      try {
        const body = await r.json();
        console.log('  isCorrect:', body.isCorrect);
        console.log('  testsPassed:', body.testsPassed);
        console.log('  testsTotal:', body.testsTotal);
        if (body.sandbox?.results?.[0]) {
          console.log('  solutions[0].error:', body.sandbox.results[0].error);
          console.log('  solutions[0].passed:', body.sandbox.results[0].passed);
          console.log('  solutions[0].total:', body.sandbox.results[0].total);
        }
      } catch (e) {
        console.log('  parse error:', e.message);
      }
    }
  });

  await page.goto('http://localhost:3001/login');
  await page.fill('input[name=username]', 'admin');
  await page.fill('input[name=password]', 'admin12345');
  await page.click('button[type=submit]');

  await browser.close();
}

run();
