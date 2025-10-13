const { chromium } = require('playwright');

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('=== Testing Simple App ===');
  
  try {
    // Enable console logging
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));
    
    // Navigate to the local development server
    console.log('Navigating to http://localhost:8081...');
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for content to load
    console.log('Waiting for content to load...');
    await page.waitForTimeout(10000);
    
    // Take a screenshot
    await page.screenshot({ path: 'simple-app-test.png' });
    console.log('Screenshot saved as simple-app-test.png');
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Check for specific text
    const basicText = await page.$('text=Basic React Native Web Test');
    if (basicText) {
      console.log('✅ Found "Basic React Native Web Test" text');
    } else {
      console.log('❌ Could not find "Basic React Native Web Test" text');
    }
    
    // Check for other text
    const workingText = await page.$('text=If you can see this, React Native Web is working');
    if (workingText) {
      console.log('✅ Found "If you can see this, React Native Web is working" text');
    } else {
      console.log('❌ Could not find "If you can see this, React Native Web is working" text');
    }
    
  } catch (error) {
    console.error('Error testing simple app:', error.message);
  }
  
  // Close browser
  await browser.close();
  
  console.log('\nTest completed. Check the screenshot to see what is being rendered.');
})();