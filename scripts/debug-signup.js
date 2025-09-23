// Create a debug version of the sign-up functionality
const { chromium } = require('playwright');

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('=== Debugging Sign-Up Functionality ===');
  
  try {
    // Enable console logging
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));
    
    // Add a listener for all JavaScript errors
    page.on('console', async (msg) => {
      if (msg.type() === 'error') {
        console.log('JS Error:', msg.text());
        // Try to get stack trace if available
        const args = await msg.args();
        for (let i = 0; i < args.length; ++i) {
          const arg = args[i];
          if (arg.toString().includes('Error')) {
            try {
              const value = await arg.jsonValue();
              console.log('Error details:', value);
            } catch (e) {
              // Ignore if we can't get the value
            }
          }
        }
      }
    });
    
    // Navigate to the sign-up page
    console.log('Navigating to http://localhost:8081/signup...');
    await page.goto('http://localhost:8081/signup', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for content to load
    console.log('Waiting for content to load...');
    await page.waitForTimeout(10000);
    
    // Fill out the form first
    console.log('Filling out sign-up form...');
    
    // Fill name
    const nameInput = await page.$('input[placeholder="Full Name"]');
    if (nameInput) {
      await nameInput.fill('Debug User');
      console.log('✅ Filled name field');
    }
    
    // Fill email
    const emailInput = await page.$('input[placeholder="Email Address"]');
    if (emailInput) {
      await emailInput.fill('debug@example.com');
      console.log('✅ Filled email field');
    }
    
    // Fill password
    const passwordInput = await page.$('input[placeholder="Password"]');
    if (passwordInput) {
      await passwordInput.fill('DebugPass123!');
      console.log('✅ Filled password field');
    }
    
    // Fill confirm password
    const confirmPasswordInput = await page.$('input[placeholder="Confirm Password"]');
    if (confirmPasswordInput) {
      await confirmPasswordInput.fill('DebugPass123!');
      console.log('✅ Filled confirm password field');
    }
    
    // Accept terms
    const termsCheckbox = await page.$('text=I agree to the');
    if (termsCheckbox) {
      await termsCheckbox.click();
      console.log('✅ Accepted terms');
    }
    
    // Now try to click the "Start Free Trial" button with detailed monitoring
    console.log('\n--- Attempting to click "Start Free Trial" button ---');
    
    // Add network request monitoring
    const networkRequests = [];
    page.on('request', request => {
      networkRequests.push({
        method: request.method(),
        url: request.url(),
        timestamp: Date.now()
      });
      console.log('➡️ Network request:', request.method(), request.url());
    });
    
    page.on('response', response => {
      console.log('⬅️ Network response:', response.status(), response.url());
    });
    
    // Find the button
    const startTrialButtons = await page.$$('text=Start Free Trial');
    console.log(`Found ${startTrialButtons.length} "Start Free Trial" buttons`);
    
    if (startTrialButtons.length > 0) {
      const button = startTrialButtons[0];
      
      // Check if it's actually clickable
      const isDisabled = await button.isDisabled();
      const isVisible = await button.isVisible();
      
      console.log('Button state before click:');
      console.log('  Disabled:', isDisabled);
      console.log('  Visible:', isVisible);
      
      if (isVisible && !isDisabled) {
        console.log('Clicking button...');
        
        // Clear network requests before clicking
        networkRequests.length = 0;
        
        // Click the button
        await button.click({ force: true }); // Force click to bypass any potential overlays
        
        console.log('Button clicked, waiting for response...');
        
        // Wait for a longer time to see what happens
        await page.waitForTimeout(10000);
        
        console.log('Network requests captured during click:', networkRequests.length);
        networkRequests.forEach(req => {
          console.log(`  ${req.method} ${req.url}`);
        });
        
        // Check current URL
        const currentUrl = page.url();
        console.log('Current URL after click:', currentUrl);
        
        if (currentUrl.includes('/tabs')) {
          console.log('✅ Successfully signed up and navigated to app');
        } else if (currentUrl.includes('/signin')) {
          console.log('✅ Navigated to sign-in (might be expected flow)');
        } else if (currentUrl === 'http://localhost:8081/signup') {
          console.log('❌ Still on sign-up page - no navigation occurred');
        } else {
          console.log('ℹ️ Navigated to:', currentUrl);
        }
      } else {
        console.log('❌ Button is not clickable');
      }
    } else {
      console.log('❌ Button not found');
    }
    
  } catch (error) {
    console.error('❌ Error during debug test:', error.message);
  }
  
  // Close browser
  await browser.close();
  
  console.log('\n=== Sign-Up Debug Test Completed ===');
})();