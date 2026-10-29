// TypeScript Dependency Analyzer
// Run with: npx tsx analyze-dependencies.ts

import * as fs from 'fs';
import * as path from 'path';

interface AnalysisResult {
  file: string;
  issues: string[];
  suggestions: string[];
}

const PATTERNS_TO_CHECK = {
  supabaseFeatureFlags: {
    patterns: [/sm_feature_flags/g, /fetchFeatureFlags/g, /update_feature_flag/g],
    message: 'Uses old Supabase feature flag pattern',
    suggestion: 'Replace with local FEATURE_FLAGS import from @/config/featureFlags'
  },
  apiRoutes: {
    patterns: [/fetch\s*\(\s*['"`]\/api\//g, /app\/api\//g],
    message: 'Uses API routes that won\'t work in Expo',
    suggestion: 'Replace with Supabase Edge Function calls'
  },
  stripeSecrets: {
    patterns: [/process\.env\.STRIPE_SECRET/g, /new\s+Stripe\s*\(/g, /stripe\.issuing/g],
    message: 'Contains Stripe secret key usage',
    suggestion: 'Move to Supabase Edge Functions'
  },
  removedPackages: {
    patterns: [/import.*puppeteer/g, /import.*playwright/g, /from\s+['"]stripe['"]/g],
    message: 'Imports removed packages',
    suggestion: 'Remove import or move logic to Edge Functions'
  },
  serverSidePatterns: {
    patterns: [/require\s*\(['"]stripe/g, /headless.*browser/g, /browser.*automation/g],
    message: 'Uses server-side only functionality',
    suggestion: 'Implement in Supabase Edge Functions'
  }
};

function analyzeFile(filePath: string): AnalysisResult | null {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    Object.entries(PATTERNS_TO_CHECK).forEach(([key, config]) => {
      config.patterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          issues.push(`${config.message} (${matches.length} occurrences)`);
          if (!suggestions.includes(config.suggestion)) {
            suggestions.push(config.suggestion);
          }
        }
      });
    });
    
    // Check for specific component patterns
    if (filePath.includes('VirtualCard') && content.includes('stripe')) {
      issues.push('Virtual Card component contains direct Stripe usage');
      suggestions.push('Use secureAPI.createVirtualCard() instead');
    }
    
    if (filePath.includes('Cancellation') && content.includes('puppeteer')) {
      issues.push('Cancellation component requires browser automation');
      suggestions.push('Use secureAPI.requestCancellation() instead');
    }
    
    // Check for feature flag patterns
    if (content.includes('useFeatureFlags') && content.includes('supabase')) {
      issues.push('Feature flag hook still references Supabase');
      suggestions.push('Ensure useFeatureFlags uses local config only');
    }
    
    return issues.length > 0 ? { file: filePath, issues, suggestions } : null;
  } catch (error) {
    return null;
  }
}

function walkDir(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and build directories
      if (!['node_modules', '.expo', 'dist', 'build', '.git'].includes(file)) {
        walkDir(filePath, fileList);
      }
    } else if (file.match(/\.(ts|tsx|js|jsx)$/)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function generateReport(results: AnalysisResult[]): void {
  const report = `# Dependency Analysis Report
Generated: ${new Date().toISOString()}

## Summary
- Total files analyzed: ${results.reduce((acc, r) => acc + 1, 0)}
- Files with issues: ${results.length}
- Total issues found: ${results.reduce((acc, r) => acc + r.issues.length, 0)}

## Files Requiring Updates

${results.map(result => `
### ${result.file.replace(process.cwd() + '/', '')}
**Issues:**
${result.issues.map(issue => `- ${issue}`).join('\n')}

**Suggestions:**
${result.suggestions.map(suggestion => `- ${suggestion}`).join('\n')}
`).join('\n')}

## Migration Checklist

${generateMigrationChecklist(results)}

## Safe File Patterns

Files that follow the new architecture:
- Import from \`@/config/featureFlags\` instead of Supabase
- Use \`secureAPI\` from \`@/lib/secure-api\` for sensitive operations
- No direct Stripe, Puppeteer, or server-side package imports
- All API calls go through Supabase Edge Functions
`;

  fs.writeFileSync('dependency-analysis-report.md', report);
  console.log('\n📄 Full report saved to: dependency-analysis-report.md');
}

function generateMigrationChecklist(results: AnalysisResult[]): string {
  const checklist: Set<string> = new Set();
  
  results.forEach(result => {
    result.issues.forEach(issue => {
      if (issue.includes('feature flag')) {
        checklist.add('- [ ] Update all feature flag imports to use `@/config/featureFlags`');
      }
      if (issue.includes('API routes')) {
        checklist.add('- [ ] Replace API route calls with Supabase Edge Function invocations');
      }
      if (issue.includes('Stripe')) {
        checklist.add('- [ ] Move Stripe operations to Edge Functions');
        checklist.add('- [ ] Update components to use `secureAPI` wrapper');
      }
      if (issue.includes('removed packages')) {
        checklist.add('- [ ] Remove imports of puppeteer, playwright, stripe packages');
      }
    });
  });
  
  return Array.from(checklist).join('\n');
}

// Main execution
console.log('🔍 Starting TypeScript dependency analysis...\n');

const projectRoot = process.cwd();
const files = walkDir(projectRoot);
console.log(`📁 Found ${files.length} TypeScript/JavaScript files to analyze\n`);

const results: AnalysisResult[] = [];
files.forEach(file => {
  const result = analyzeFile(file);
  if (result) {
    results.push(result);
    console.log(`❌ ${path.relative(projectRoot, file)}: ${result.issues.length} issues`);
  }
});

if (results.length > 0) {
  console.log(`\n⚠️  Found issues in ${results.length} files`);
  generateReport(results);
  
  // Show top issues
  console.log('\n🔥 Top Issues to Fix First:');
  results.slice(0, 5).forEach(result => {
    console.log(`\n${path.relative(projectRoot, result.file)}:`);
    result.issues.forEach(issue => console.log(`  - ${issue}`));
  });
} else {
  console.log('\n✅ No dependency issues found!');
}

console.log('\n💡 Next Steps:');
console.log('1. Review the full report: dependency-analysis-report.md');
console.log('2. Fix high-priority files first (Virtual Cards, Cancellation Bot)');
console.log('3. Test after each batch of fixes');
console.log('4. Run this analyzer again to verify all issues resolved');
