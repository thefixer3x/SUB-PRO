const fs = require('fs');
const path = require('path');

console.log('=== Analyzing Built JavaScript Files ===\n');

// Check if dist directory exists
const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
  console.log('❌ Dist directory does not exist. Run "npm run build:web" first.');
  process.exit(1);
}

// Check static js directory
const staticJsPath = path.join(distPath, '_expo', 'static', 'js', 'web');
if (!fs.existsSync(staticJsPath)) {
  console.log('❌ Static JS directory does not exist.');
  process.exit(1);
}

// List all JS files
const jsFiles = fs.readdirSync(staticJsPath).filter(file => file.endsWith('.js'));
console.log('Found JS files:');
jsFiles.forEach(file => console.log(`  - ${file}`));

// Analyze the main entry file
const entryFile = jsFiles.find(file => file.includes('entry'));
if (entryFile) {
  console.log(`\n=== Analyzing Entry File: ${entryFile} ===`);
  const entryFilePath = path.join(staticJsPath, entryFile);
  const entryContent = fs.readFileSync(entryFilePath, 'utf8');
  
  console.log(`File size: ${entryContent.length} characters`);
  
  // Look for common issues
  const issues = [];
  
  // Check for undefined default exports
  const undefinedDefaultMatches = entryContent.match(/undefined\.default/g);
  if (undefinedDefaultMatches) {
    issues.push(`Found ${undefinedDefaultMatches.length} references to "undefined.default"`);
  }
  
  // Check for import issues
  const importMatches = entryContent.match(/import\s+.*?from\s+['"][^'"]+['"]/g);
  if (importMatches) {
    console.log(`Found ${importMatches.length} import statements`);
  }
  
  // Check for require statements
  const requireMatches = entryContent.match(/require\(['"][^'"]+['"]\)/g);
  if (requireMatches) {
    console.log(`Found ${requireMatches.length} require statements`);
  }
  
  // Check for React usage
  const reactUsage = entryContent.includes('React') || entryContent.includes('react');
  console.log(`React usage detected: ${reactUsage ? 'Yes' : 'No'}`);
  
  // Show first 1000 characters for context
  console.log('\nFirst 1000 characters of entry file:');
  console.log('----------------------------------------');
  console.log(entryContent.substring(0, 1000));
  console.log('----------------------------------------');
  
  if (issues.length > 0) {
    console.log('\nPotential issues found:');
    issues.forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log('\nNo obvious issues found in entry file analysis.');
  }
} else {
  console.log('\n❌ Could not find entry file');
}

console.log('\n=== Analysis Complete ===');