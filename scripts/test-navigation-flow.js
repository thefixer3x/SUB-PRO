const { chromium } = require('playwright');

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('=== Detailed Sign-Up to Sign-In Navigation Test ===');
  
  try {
    // Navigate to the home page
    console.log('Navigating to http://localhost:8081...');
    await page.goto('http://localhost:8081', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for content to load
    console.log('Waiting for content to load...');
    await page.waitForTimeout(10000);
    
    // Click the "Start Free Trial" button to go to sign-up
    console.log('Looking for "Start Free Trial" button...');
    const signUpButtons = await page.$$('text=Start Free Trial');
    
    if (signUpButtons.length > 0) {
      console.log(`✅ Found ${signUpButtons.length} "Start Free Trial" button(s)`);
      await signUpButtons[0].click();
      console.log('Clicked the "Start Free Trial" button');
      
      // Wait for navigation to sign-up page
      await page.waitForTimeout(5000);
      
      const signUpUrl = page.url();
      console.log('Current URL (sign-up page):', signUpUrl);
      
      if (signUpUrl.includes('/signup')) {
        console.log('✅ Successfully navigated to sign-up page');
        
        // Now look for the "Already have an account" link
        console.log('Looking for "Already have an account" link...');
        const accountElements = await page.$$('text=Already have an account');
        console.log(`Found ${accountElements.length} "Already have an account" elements`);
        
        if (accountElements.length > 0) {
          // Get the text content to see what's inside
          const textContent = await accountElements[0].textContent();
          console.log('Text content:', textContent);
          
          // Click on the "Already have an account" text
          console.log('Clicking on "Already have an account"...');
          await accountElements[0].click();
          
          // Wait for navigation
          await page.waitForTimeout(3000);
          
          const afterClickUrl = page.url();
          console.log('URL after clicking "Already have an account":', afterClickUrl);
          
          if (afterClickUrl.includes('/signin')) {
            console.log('✅ Successfully navigated to sign-in page');
          } else {
            console.log('❌ Did not navigate to sign-in page');
            
            // Try clicking the "Sign In" text within the element
            const signInLinks = await page.$$('text=Sign In');
            console.log(`Found ${signInLinks.length} "Sign In" links`);
            
            if (signInLinks.length > 0) {
              console.log('Clicking on "Sign In" link...');
              await signInLinks[0].click();
              await page.waitForTimeout(3000);
              
              const finalUrl = page.url();
              console.log('URL after clicking "Sign In" link:', finalUrl);
              
              if (finalUrl.includes('/signin')) {
                console.log('✅ Successfully navigated to sign-in page via "Sign In" link');
              } else {
                console.log('❌ Still not on sign-in page');
              }
            }
          }
        } else {
          console.log('❌ "Already have an account" link not found');
        }
      } else {
        console.log('❌ Did not navigate to sign-up page');
      }
    } else {
      console.log('❌ "Start Free Trial" button not found');
    }
    
  } catch (error) {
    console.error('❌ Error during navigation test:', error.message);
  }
  
  // Close browser
  await browser.close();
  
  console.log('\n=== Detailed Navigation Test Completed ===');
})();