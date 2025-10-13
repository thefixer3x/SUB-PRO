const { chromium } = require('playwright');

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('=== Testing Sign-In Page Access ===');
  
  try {
    // Navigate to the local development server
    console.log('Navigating to http://localhost:8081...');
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for content to load
    console.log('Waiting for content to load...');
    await page.waitForTimeout(10000);
    
    // Try to find a sign-in link or button
    console.log('Looking for sign-in options...');
    
    // Check for "Sign In" text
    const signInElements = await page.$$('text=Sign In');
    console.log(`Found ${signInElements.length} "Sign In" elements`);
    
    // Check for "Already have an account" text which should link to sign-in
    const accountElements = await page.$$('text=Already have an account');
    console.log(`Found ${accountElements.length} "Already have an account" elements`);
    
    if (accountElements.length > 0) {
      // Click on the "Already have an account" text to go to sign-in
      await accountElements[0].click();
      console.log('Clicked on "Already have an account"');
      
      // Wait for navigation
      await page.waitForTimeout(3000);
      
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      
      if (currentUrl.includes('/signin')) {
        console.log('✅ Successfully navigated to sign-in page');
      } else {
        console.log('❌ Did not navigate to sign-in page');
      }
    } else if (signInElements.length > 0) {
      // Click on the first "Sign In" element
      await signInElements[0].click();
      console.log('Clicked on "Sign In"');
      
      // Wait for navigation
      await page.waitForTimeout(3000);
      
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      
      if (currentUrl.includes('/signin')) {
        console.log('✅ Successfully navigated to sign-in page');
      } else {
        console.log('❌ Did not navigate to sign-in page');
      }
    } else {
      console.log('❌ No sign-in options found on the page');
      
      // Try direct navigation
      console.log('Trying direct navigation to /signin...');
      await page.goto('http://localhost:8081/signin', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      
      if (currentUrl.includes('/signin')) {
        console.log('✅ Successfully navigated to sign-in page via direct URL');
      } else {
        console.log('❌ Direct navigation to sign-in page failed');
      }
    }
    
  } catch (error) {
    console.error('❌ Error during sign-in test:', error.message);
  }
  
  // Close browser
  await browser.close();
  
  console.log('\n=== Sign-In Page Access Test Completed ===');
})();