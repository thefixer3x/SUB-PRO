const { chromium } = require('playwright');

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('=== Testing Production Build ===');
  
  try {
    // Enable console logging
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));
    
    // Navigate to the production build server
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for content to load
    console.log('Waiting for content to load...');
    await page.waitForTimeout(10000);
    
    // Take a screenshot
    await page.screenshot({ path: 'prod-build-test.png' });
    console.log('Screenshot saved as prod-build-test.png');
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Check for specific text that should be in your landing page
    const landingText = await page.$('text=SubTrack Pro');
    if (landingText) {
      console.log('✅ Found "SubTrack Pro" text');
    } else {
      console.log('❌ Could not find "SubTrack Pro" text');
    }
    
    // Check for sign up button
    const signUpButton = await page.$('text=Start Free Trial');
    if (signUpButton) {
      console.log('✅ Found "Start Free Trial" button');
    } else {
      console.log('❌ Could not find "Start Free Trial" button');
    }
    
    // Check for sign in link
    const signInLink = await page.$('text=Sign In');
    if (signInLink) {
      console.log('✅ Found "Sign In" link');
    } else {
      console.log('❌ Could not find "Sign In" link');
    }
    
    // Check if React is loaded
    const reactLoaded = await page.evaluate(() => typeof window.React !== 'undefined');
    console.log('React loaded:', reactLoaded ? '✅ Yes' : '❌ No');
    
    // Check if Expo is loaded
    const expoLoaded = await page.evaluate(() => typeof window.Expo !== 'undefined');
    console.log('Expo loaded:', expoLoaded ? '✅ Yes' : '❌ No');
    
  } catch (error) {
    console.error('Error testing production build:', error.message);
  }
  
  // Close browser
  await browser.close();
  
  console.log('\nTest completed. Check the screenshot to see what is being rendered.');
})();