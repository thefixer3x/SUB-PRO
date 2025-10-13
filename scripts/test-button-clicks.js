const { chromium } = require('playwright');

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('=== Testing Button Click Functionality ===');
  
  try {
    // Enable console logging
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));
    
    // Navigate to the sign-up page
    console.log('Navigating to http://localhost:8081/signup...');
    await page.goto('http://localhost:8081/signup', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for content to load
    console.log('Waiting for content to load...');
    await page.waitForTimeout(10000);
    
    // Take a screenshot
    await page.screenshot({ path: 'button-test-signup.png' });
    console.log('Screenshot saved as button-test-signup.png');
    
    // Check if we're on the sign-up page
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    if (currentUrl.includes('/signup')) {
      console.log('✅ Successfully on sign-up page');
      
      // Try to fill out the form
      console.log('Filling out sign-up form...');
      
      // Fill name
      const nameInput = await page.$('input[placeholder="Full Name"]');
      if (nameInput) {
        await nameInput.fill('Test User');
        console.log('✅ Filled name field');
      } else {
        console.log('❌ Name input not found');
      }
      
      // Fill email
      const emailInput = await page.$('input[placeholder="Email Address"]');
      if (emailInput) {
        await emailInput.fill('test@example.com');
        console.log('✅ Filled email field');
      } else {
        console.log('❌ Email input not found');
      }
      
      // Fill password
      const passwordInput = await page.$('input[placeholder="Password"]');
      if (passwordInput) {
        await passwordInput.fill('TestPass123!');
        console.log('✅ Filled password field');
      } else {
        console.log('❌ Password input not found');
      }
      
      // Fill confirm password
      const confirmPasswordInput = await page.$('input[placeholder="Confirm Password"]');
      if (confirmPasswordInput) {
        await confirmPasswordInput.fill('TestPass123!');
        console.log('✅ Filled confirm password field');
      } else {
        console.log('❌ Confirm password input not found');
      }
      
      // Accept terms
      const termsCheckbox = await page.$('text=I agree to the');
      if (termsCheckbox) {
        await termsCheckbox.click();
        console.log('✅ Accepted terms');
      } else {
        console.log('❌ Terms checkbox not found');
      }
      
      // Look for the sign-up submit button
      console.log('Looking for "Start Free Trial" button...');
      const submitButtons = await page.$$('text=Start Free Trial');
      console.log(`Found ${submitButtons.length} "Start Free Trial" buttons`);
      
      if (submitButtons.length > 0) {
        // Check if the button is enabled
        const isDisabled = await submitButtons[0].isDisabled();
        console.log('Button disabled:', isDisabled);
        
        if (!isDisabled) {
          console.log('Clicking "Start Free Trial" button...');
          await submitButtons[0].click();
          
          // Wait to see what happens
          await page.waitForTimeout(5000);
          
          const newUrl = page.url();
          console.log('URL after clicking:', newUrl);
          
          if (newUrl !== currentUrl) {
            console.log('✅ Button click resulted in navigation');
          } else {
            console.log('❌ Button click did not result in navigation');
          }
        } else {
          console.log('❌ Button is disabled');
        }
      } else {
        console.log('❌ Sign-up submit button not found');
      }
    } else {
      console.log('❌ Not on sign-up page');
    }
    
    // Now test sign-in page
    console.log('\n--- Testing Sign-In Page ---');
    await page.goto('http://localhost:8081/signin', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    // Take a screenshot
    await page.screenshot({ path: 'button-test-signin.png' });
    console.log('Screenshot saved as button-test-signin.png');
    
    // Fill sign-in form
    console.log('Filling out sign-in form...');
    
    // Fill email
    const signInEmailInput = await page.$('input[placeholder="Enter your email"]');
    if (signInEmailInput) {
      await signInEmailInput.fill('test@example.com');
      console.log('✅ Filled email field');
    } else {
      console.log('❌ Email input not found');
    }
    
    // Fill password
    const signInPasswordInput = await page.$('input[placeholder="Enter your password"]');
    if (signInPasswordInput) {
      await signInPasswordInput.fill('TestPass123!');
      console.log('✅ Filled password field');
    } else {
      console.log('❌ Password input not found');
    }
    
    // Look for the sign-in submit button
    console.log('Looking for "Sign In" button...');
    const signInButtons = await page.$$('text=Sign In');
    console.log(`Found ${signInButtons.length} "Sign In" buttons`);
    
    if (signInButtons.length > 0) {
      // Check if the button is enabled
      const isDisabled = await signInButtons[0].isDisabled();
      console.log('Button disabled:', isDisabled);
      
      if (!isDisabled) {
        console.log('Clicking "Sign In" button...');
        await signInButtons[0].click();
        
        // Wait to see what happens
        await page.waitForTimeout(5000);
        
        const newUrl = page.url();
        console.log('URL after clicking:', newUrl);
        
        if (newUrl.includes('/tabs')) {
          console.log('✅ Successfully signed in and navigated to tabs');
        } else if (newUrl !== page.url()) {
          console.log('✅ Button click resulted in navigation');
        } else {
          console.log('❌ Button click did not result in navigation');
        }
      } else {
        console.log('❌ Button is disabled');
      }
    } else {
      console.log('❌ Sign-in submit button not found');
    }
    
  } catch (error) {
    console.error('❌ Error during button test:', error.message);
  }
  
  // Close browser
  await browser.close();
  
  console.log('\n=== Button Click Test Completed ===');
})();