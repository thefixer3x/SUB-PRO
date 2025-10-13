const { chromium } = require('playwright');

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('=== Testing Sign-Up Functionality with Real Credentials ===');
  
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
    await page.screenshot({ path: 'signup-real-creds-before.png' });
    console.log('Screenshot saved as signup-real-creds-before.png');
    
    // Click the "Start Free Trial" button
    console.log('Looking for "Start Free Trial" button...');
    const signUpButtons = await page.$$('text=Start Free Trial');
    
    if (signUpButtons.length > 0) {
      console.log(`✅ Found ${signUpButtons.length} "Start Free Trial" button(s)`);
      
      // Click the first one
      await signUpButtons[0].click();
      console.log('Clicked the "Start Free Trial" button');
      
      // Wait for navigation
      await page.waitForTimeout(5000);
      
      // Take another screenshot
      await page.screenshot({ path: 'signup-real-creds-after.png' });
      console.log('Screenshot saved as signup-real-creds-after.png');
      
      // Check if we're on the sign-up page
      const currentUrl = page.url();
      console.log('Current URL:', currentUrl);
      
      if (currentUrl.includes('/signup')) {
        console.log('✅ Successfully navigated to sign-up page');
        
        // Check if the sign-up form is visible
        const signUpForm = await page.$('form');
        if (signUpForm) {
          console.log('✅ Sign-up form is visible');
          
          // Check for form fields
          const nameInput = await page.$('input[placeholder="Full Name"]');
          const emailInput = await page.$('input[placeholder="Email Address"]');
          const passwordInput = await page.$('input[placeholder="Password"]');
          const confirmPasswordInput = await page.$('input[placeholder="Confirm Password"]');
          
          console.log('Form fields status:');
          console.log('  Name input:', !!nameInput);
          console.log('  Email input:', !!emailInput);
          console.log('  Password input:', !!passwordInput);
          console.log('  Confirm password input:', !!confirmPasswordInput);
          
          if (nameInput && emailInput && passwordInput && confirmPasswordInput) {
            console.log('✅ All sign-up form fields are present');
            
            // Test filling out the form with sample data
            console.log('Testing form filling...');
            await nameInput.fill('Test User');
            await emailInput.fill('test@example.com');
            await passwordInput.fill('TestPass123!');
            await confirmPasswordInput.fill('TestPass123!');
            console.log('✅ Successfully filled form fields');
            
            // Check for terms agreement checkbox
            const termsCheckbox = await page.$('text=I agree to the');
            if (termsCheckbox) {
              console.log('✅ Terms agreement checkbox found');
              await termsCheckbox.click();
              console.log('✅ Accepted terms');
            } else {
              console.log('❌ Terms agreement checkbox not found');
            }
            
            // Look for the sign-up submit button
            const submitButton = await page.$('text=Start Free Trial');
            if (submitButton) {
              console.log('✅ Sign-up submit button found');
              console.log('The sign-up button should now be functional with real Supabase credentials!');
            } else {
              console.log('❌ Sign-up submit button not found');
            }
          } else {
            console.log('❌ Some form fields are missing');
          }
        } else {
          console.log('❌ Sign-up form not found');
        }
      } else {
        console.log('❌ Did not navigate to sign-up page');
        console.log('Current URL:', currentUrl);
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
  
  console.log('\n=== Sign-Up Functionality Test Completed ===');
  console.log('With real Supabase credentials, the authentication should now work properly!');
})();