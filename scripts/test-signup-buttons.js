const { chromium } = require('playwright');

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('=== Testing Sign-Up Page Button Responsiveness ===');
  
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
    await page.screenshot({ path: 'signup-page-buttons.png' });
    console.log('Screenshot saved as signup-page-buttons.png');
    
    // Check if we're on the sign-up page
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    if (currentUrl.includes('/signup')) {
      console.log('✅ Successfully on sign-up page');
      
      // Test the "Start Free Trial" button
      console.log('\n--- Testing "Start Free Trial" Button ---');
      const startTrialButtons = await page.$$('text=Start Free Trial');
      console.log(`Found ${startTrialButtons.length} "Start Free Trial" buttons`);
      
      if (startTrialButtons.length > 0) {
        const button = startTrialButtons[0];
        
        // Check button properties
        const isDisabled = await button.isDisabled();
        const isVisible = await button.isVisible();
        const boundingBox = await button.boundingBox();
        
        console.log('Button properties:');
        console.log('  Disabled:', isDisabled);
        console.log('  Visible:', isVisible);
        console.log('  Position:', boundingBox);
        
        if (isVisible && !isDisabled) {
          console.log('Attempting to click "Start Free Trial" button...');
          
          // Add a listener for network requests
          const requests = [];
          page.on('request', request => {
            requests.push(request);
            console.log('Network request:', request.method(), request.url());
          });
          
          // Click the button
          await button.click();
          
          // Wait to see what happens
          await page.waitForTimeout(5000);
          
          const newUrl = page.url();
          console.log('URL after clicking:', newUrl);
          
          if (newUrl !== currentUrl) {
            console.log('✅ Button click resulted in navigation');
          } else {
            console.log('❌ Button click did not result in navigation');
            
            // Check if any network requests were made
            console.log('Network requests made:', requests.length);
            if (requests.length > 0) {
              console.log('Last request URL:', requests[requests.length - 1].url());
            }
          }
        } else {
          console.log('❌ Button is not clickable (disabled or not visible)');
        }
      } else {
        console.log('❌ "Start Free Trial" button not found');
      }
      
      // Reload the page to test the "Sign In" link
      console.log('\n--- Reloading page to test "Sign In" link ---');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(5000);
      
      // Test the "Sign In" link
      console.log('\n--- Testing "Sign In" Link ---');
      const signInElements = await page.$$('text=Sign In');
      console.log(`Found ${signInElements.length} "Sign In" elements`);
      
      if (signInElements.length > 0) {
        const signInLink = signInElements[0];
        
        // Check link properties
        const isDisabled = await signInLink.isDisabled();
        const isVisible = await signInLink.isVisible();
        const boundingBox = await signInLink.boundingBox();
        
        console.log('Link properties:');
        console.log('  Disabled:', isDisabled);
        console.log('  Visible:', isVisible);
        console.log('  Position:', boundingBox);
        
        if (isVisible && !isDisabled) {
          console.log('Attempting to click "Sign In" link...');
          
          // Add a listener for navigation
          let navigationHappened = false;
          page.on('framenavigated', () => {
            navigationHappened = true;
            console.log('Navigation detected');
          });
          
          // Click the link
          await signInLink.click();
          
          // Wait to see what happens
          await page.waitForTimeout(5000);
          
          const newUrl = page.url();
          console.log('URL after clicking:', newUrl);
          
          if (newUrl.includes('/signin')) {
            console.log('✅ "Sign In" link click resulted in navigation to sign-in page');
          } else if (navigationHappened) {
            console.log('✅ Navigation happened but not to expected page');
          } else {
            console.log('❌ "Sign In" link click did not result in navigation');
          }
        } else {
          console.log('❌ "Sign In" link is not clickable (disabled or not visible)');
        }
      } else {
        console.log('❌ "Sign In" link not found');
      }
    } else {
      console.log('❌ Not on sign-up page');
    }
    
  } catch (error) {
    console.error('❌ Error during button test:', error.message);
  }
  
  // Close browser
  await browser.close();
  
  console.log('\n=== Sign-Up Page Button Test Completed ===');
})();