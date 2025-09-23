const { chromium } = require('playwright');

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('=== Detailed SubTrack Pro Debug Test ===');
  
  try {
    // Enable console logging
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));
    
    // Navigate to the local development server
    console.log('\n1. Navigating to http://localhost:8081...');
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for content to load
    console.log('2. Waiting for content to load...');
    await page.waitForTimeout(10000);
    
    // Take a screenshot of the development server
    await page.screenshot({ path: 'detailed-dev-screenshot.png' });
    console.log('3. Screenshot saved as detailed-dev-screenshot.png');
    
    // Get page title
    const title = await page.title();
    console.log('4. Page title:', title);
    
    // Get current URL
    const url = page.url();
    console.log('5. Current URL:', url);
    
    // Get page content
    const content = await page.content();
    console.log('6. Page content length:', content.length);
    
    // Check if it's a blank page
    if (content.length < 500) {
      console.log('⚠️  Page content is very short - likely a blank page');
    }
    
    // Check for React-specific elements
    const rootDiv = await page.$('#root');
    if (rootDiv) {
      const rootContent = await rootDiv.innerHTML();
      console.log('7. Root div content length:', rootContent.length);
      if (rootContent.trim() === '') {
        console.log('⚠️  Root div is empty - React may not be rendering');
      } else {
        console.log('✅ Root div has content');
      }
    } else {
      console.log('❌ No root div found');
    }
    
    // Check for JavaScript errors
    console.log('8. Checking for JavaScript errors...');
    const jsErrors = await page.evaluate(() => {
      const errors = [];
      // Check if React is loaded
      if (typeof window.React === 'undefined') {
        errors.push('React is not loaded');
      }
      
      // Check if Expo is loaded
      if (typeof window.Expo === 'undefined') {
        errors.push('Expo is not loaded');
      }
      
      return errors;
    });
    
    if (jsErrors.length > 0) {
      console.log('⚠️  JavaScript issues found:', jsErrors);
    } else {
      console.log('✅ No major JavaScript issues detected');
    }
    
    // Check for specific UI elements
    console.log('9. Checking for UI elements...');
    const elementsToCheck = [
      { selector: 'text=SubTrack Pro', description: 'App title' },
      { selector: 'text=Start Free Trial', description: 'Sign up button' },
      { selector: 'text=Sign In', description: 'Sign in link' },
      { selector: 'button', description: 'Any button' },
      { selector: 'a', description: 'Any link' }
    ];
    
    for (const element of elementsToCheck) {
      const found = await page.$(element.selector);
      if (found) {
        console.log(`✅ Found ${element.description}`);
      } else {
        console.log(`❌ Could not find ${element.description}`);
      }
    }
    
    // Check window dimensions
    const viewport = await page.viewportSize();
    console.log('10. Viewport size:', viewport);
    
    // Wait a bit more to see if anything loads
    console.log('11. Waiting a bit more...');
    await page.waitForTimeout(5000);
    
    // Take another screenshot
    await page.screenshot({ path: 'detailed-dev-screenshot-2.png' });
    console.log('12. Second screenshot saved as detailed-dev-screenshot-2.png');
    
  } catch (error) {
    console.error('❌ Error during detailed test:', error.message);
    console.error('Stack trace:', error.stack);
  }
  
  // Close browser
  await browser.close();
  
  console.log('\n=== Test completed ===');
  console.log('Check the detailed screenshots to see what is being rendered.');
})();