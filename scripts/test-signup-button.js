const { chromium } = require('playwright');

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('=== Testing Sign-Up Button Functionality ===');
  
  try {
    // Enable console logging
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));
    
    // Navigate to the local development server
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for content to load
    console.log('Waiting for content to load...');
    await page.waitForTimeout(10000);
    
    // Take a screenshot
    await page.screenshot({ path: 'signup-test-before.png' });
    console.log('Screenshot saved as signup-test-before.png');
    
    // Click the "Start Free Trial" button
    console.log('Looking for "Start Free Trial" button...');
    const signUpButton = await page.$('text=Start Free Trial');
    if (signUpButton) {
      console.log('✅ Found "Start Free Trial" button');
      await signUpButton.click();
      console.log('Clicked the button');
      
      // Wait for navigation
      await page.waitForTimeout(3000);
      
      // Take another screenshot
      await page.screenshot({ path: 'signup-test-after.png' });
      console.log('Screenshot saved as signup-test-after.png');
      
      // Check if we're on the sign-up page
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      
      if (currentUrl.includes('/signup')) {
        console.log('✅ Successfully navigated to sign-up page');
        
        // Try to fill out the form
        console.log('Attempting to fill out sign-up form...');
        
        // Fill name
        const nameInput = await page.$('input[placeholder="Full Name"]');
        if (nameInput) {
          await nameInput.fill('Test User');
          console.log('✅ Filled name field');
        }
        
        // Fill email
        const emailInput = await page.$('input[placeholder="Email Address"]');
        if (emailInput) {
          await emailInput.fill('test@example.com');
          console.log('✅ Filled email field');
        }
        
        // Fill password
        const passwordInput = await page.$('input[placeholder="Password"]');
        if (passwordInput) {
          await passwordInput.fill('TestPass123!');
          console.log('✅ Filled password field');
        }
        
        // Fill confirm password
        const confirmPasswordInput = await page.$('input[placeholder="Confirm Password"]');
        if (confirmPasswordInput) {
          await confirmPasswordInput.fill('TestPass123!');
          console.log('✅ Filled confirm password field');
        }
        
        // Accept terms
        const termsCheckbox = await page.$('text=I agree to the');
        if (termsCheckbox) {
          await termsCheckbox.click();
          console.log('✅ Accepted terms');
        }
        
        // Click sign-up button
        const submitButton = await page.$('[testID="sign-up-submit"]');
        if (submitButton) {
          console.log('✅ Found sign-up submit button');
          // Don't actually click it since we don't have real credentials
          // This is just to test that the button exists and is clickable
        } else {
          console.log('❌ Could not find sign-up submit button');
        }
        
      } else {
        console.log('❌ Did not navigate to sign-up page');
      }
    } else {
      console.log('❌ Could not find "Start Free Trial" button');
      
      // Let's check what buttons are available
      const allButtons = await page.$$('button');
      console.log(`Found ${allButtons.length} buttons on the page`);
      
      // Check for any text that might indicate sign-up/sign-in
      const signUpText = await page.$('text=Sign Up');
      const signInText = await page.$('text=Sign In');
      const createAccountText = await page.$('text=Create Account');
      
      if (signUpText) console.log('✅ Found "Sign Up" text');
      if (signInText) console.log('✅ Found "Sign In" text');
      if (createAccountText) console.log('✅ Found "Create Account" text');
    }
    
  } catch (error) {
    console.error('❌ Error during sign-up test:', error.message);
  }
  
  // Close browser
  await browser.close();
  
  console.log('\n=== Sign-Up Button Test Completed ===');
})();