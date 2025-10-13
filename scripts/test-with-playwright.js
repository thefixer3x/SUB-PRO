const { chromium } = require('playwright');

(async () => {
  // Launch browser
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('Testing SubTrack Pro application...');
  
  try {
    // Navigate to the local development server
    console.log('Navigating to http://localhost:8081...');
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
    
    // Wait for content to load
    await page.waitForTimeout(5000);
    
    // Take a screenshot of the development server
    await page.screenshot({ path: 'dev-server-screenshot.png' });
    console.log('Screenshot saved as dev-server-screenshot.png');
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Get current URL
    const url = page.url();
    console.log('Current URL:', url);
    
    // Get page content
    const content = await page.content();
    console.log('Page has content:', content.length > 100 ? 'Yes' : 'No');
    
    // Check for specific elements
    const signupButton = await page.$('text=Start Free Trial');
    if (signupButton) {
      console.log('✅ Found "Start Free Trial" button');
    } else {
      console.log('❌ Could not find "Start Free Trial" button');
    }
    
    // Check for other key elements
    const signInLink = await page.$('text=Sign In');
    if (signInLink) {
      console.log('✅ Found "Sign In" link');
    } else {
      console.log('❌ Could not find "Sign In" link');
    }
    
  } catch (error) {
    console.error('Error testing development server:', error.message);
  }
  
  try {
    // Navigate to the production build server
    console.log('\nNavigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Wait for content to load
    await page.waitForTimeout(5000);
    
    // Take a screenshot of the production server
    await page.screenshot({ path: 'prod-server-screenshot.png' });
    console.log('Screenshot saved as prod-server-screenshot.png');
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Get current URL
    const url = page.url();
    console.log('Current URL:', url);
    
    // Get page content
    const content = await page.content();
    console.log('Page has content:', content.length > 100 ? 'Yes' : 'No');
    
    // Check for specific elements
    const signupButton = await page.$('text=Start Free Trial');
    if (signupButton) {
      console.log('✅ Found "Start Free Trial" button');
    } else {
      console.log('❌ Could not find "Start Free Trial" button');
    }
    
    // Check for other key elements
    const signInLink = await page.$('text=Sign In');
    if (signInLink) {
      console.log('✅ Found "Sign In" link');
    } else {
      console.log('❌ Could not find "Sign In" link');
    }
    
  } catch (error) {
    console.error('Error testing production server:', error.message);
  }
  
  // Close browser
  await browser.close();
  
  console.log('\nTest completed. Check the screenshots to see what is being rendered.');
})();