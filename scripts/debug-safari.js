const { webkit } = require('@playwright/test');

(async () => {
  const browser = await webkit.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', (msg) => {
    console.log('[console]', msg.type(), msg.text());
  });

  page.on('pageerror', (error) => {
    console.log('[pageerror]', error.message);
  });

  try {
    const response = await page.goto(
      process.argv[2] ?? 'http://127.0.0.1:4173',
      {
        waitUntil: 'load',
        timeout: 60000,
      }
    );
    console.log('Status:', response?.status());
  } catch (error) {
    console.error('Goto error:', error);
  }

  await page.waitForTimeout(5000);
  await browser.close();
})();
