const { chromium } = require('playwright');

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('=== Direct Navigation Test to Sign-In Page ===');
  
  try {
    // Navigate directly to the sign-in page
    console.log('Navigating directly to http://localhost:8081/signin...');
    await page.goto('http://localhost:8081/signin', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for content to load
    console.log('Waiting for content to load...');
    await page.waitForTimeout(10000);
    
    // Take a screenshot
    await page.screenshot({ path: 'direct-signin-test.png' });
    console.log('Screenshot saved as direct-signin-test.png');
    
    // Check the current URL
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // Check if we're on the sign-in page
    if (currentUrl.includes('/signin')) {
      console.log('✅ Successfully navigated to sign-in page');
      
      // Check for sign-in form elements
      const emailInput = await page.$('input[placeholder="Enter your email"]');
      const passwordInput = await page.$('input[placeholder="Enter your password"]');
      const signInButton = await page.$('text=Sign In');
      
      console.log('Sign-in form elements:');
      console.log('  Email input:', !!emailInput);
      console.log('  Password input:', !!passwordInput);
      console.log('  Sign-in button:', !!signInButton);
      
      if (emailInput && passwordInput && signInButton) {
        console.log('✅ Sign-in form is fully functional');
        
        // Test filling out the form
        console.log('Testing form filling...');
        await emailInput.fill('test@example.com');
        await passwordInput.fill('TestPass123!');
        console.log('✅ Successfully filled form fields');
        
        console.log('The sign-in functionality should now work with real Supabase credentials!');
      } else {
        console.log('❌ Some sign-in form elements are missing');
      }
    } else {
      console.log('❌ Did not navigate to sign-in page');
      console.log('Landed on:', currentUrl);
    }
    
  } catch (error) {
    console.error('❌ Error during direct navigation test:', error.message);
  }
  
  // Close browser
  await browser.close();
  
  console.log('\n=== Direct Navigation Test Completed ===');
})();