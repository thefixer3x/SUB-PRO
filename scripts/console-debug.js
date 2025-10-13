const { chromium } = require('playwright');

(async () => {
  // Launch browser with visible window
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('=== Detailed Browser Console Analysis ===');
  
  // Capture all console messages
  page.on('console', msg => {
    console.log(`Console [${msg.type()}]: ${msg.text()}`);
    if (msg.args().length > 0) {
      console.log('  Args:', msg.args().map(arg => arg.toString()));
    }
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    console.log('Page Error:', error.message);
    console.log('Stack:', error.stack);
  });
  
  // Capture request failures
  page.on('requestfailed', request => {
    console.log('Request Failed:', request.url(), request.failure().errorText);
  });
  
  // Capture response failures
  page.on('response', response => {
    if (!response.ok()) {
      console.log('Response Error:', response.status(), response.url());
    }
  });
  
  try {
    console.log('\nNavigating to http://localhost:8081...');
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for content to load
    console.log('Waiting for content to load...');
    await page.waitForTimeout(15000);
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Get current URL
    const url = page.url();
    console.log('Current URL:', url);
    
    // Check if it's a blank page
    const content = await page.content();
    console.log('Page content length:', content.length);
    
    // Check for React-specific elements
    const rootDiv = await page.$('#root');
    if (rootDiv) {
      const rootContent = await rootDiv.innerHTML();
      console.log('Root div content length:', rootContent.length);
      if (rootContent.trim() === '') {
        console.log('⚠️  Root div is empty - React may not be rendering');
      } else {
        console.log('✅ Root div has content');
      }
    } else {
      console.log('❌ No root div found');
    }
    
    // Take a screenshot
    await page.screenshot({ path: 'console-debug-screenshot.png' });
    console.log('Screenshot saved as console-debug-screenshot.png');
    
    // Evaluate in browser context
    console.log('\nEvaluating browser context...');
    const browserInfo = await page.evaluate(() => {
      return {
        reactLoaded: typeof window.React !== 'undefined',
        expoLoaded: typeof window.Expo !== 'undefined',
        documentReady: document.readyState,
        bodyChildren: document.body.children.length,
        rootChildren: document.getElementById('root') ? document.getElementById('root').children.length : 0
      };
    });
    
    console.log('Browser info:', browserInfo);
    
    // Wait a bit more
    console.log('Waiting a bit more...');
    await page.waitForTimeout(5000);
    
  } catch (error) {
    console.error('❌ Error during console analysis:', error.message);
    console.error('Stack trace:', error.stack);
  }
  
  // Close browser
  await browser.close();
  
  console.log('\n=== Console Analysis Completed ===');
})();