#!/bin/bash

# Script to remove exposed secrets from git history
set -e

echo "🚨 FIXING SECRETS EXPOSURE IN SEFTECHUB MOBILE..."

cd /Users/seyederick/DevOps/_project_folders/seftechub-workspace/seftec-mobile-standalone

echo "📋 Files that need to be removed from git history:"
echo "- cohesive-mender-459104-c3-310879eaa6e5.json (Google Cloud service account key)"
echo "- .claude/settings.local.json (might contain sensitive settings)"

# Remove sensitive files from git history using git filter-branch
echo "🔧 Removing sensitive files from git history..."

# Remove Google Cloud service account key
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch cohesive-mender-459104-c3-310879eaa6e5.json' \
  --prune-empty --tag-name-filter cat -- --all

# Remove Claude settings file that might contain sensitive info
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .claude/settings.local.json' \
  --prune-empty --tag-name-filter cat -- --all

# Create proper .gitignore
echo "📝 Creating comprehensive .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Secrets and keys
*.key
*.pem
*.p12
*.keystore
*.jks
*-key.json
service-account*.json
cohesive-mender-*.json

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Build outputs
dist/
build/
*.tgz

# Logs
logs/
*.log

# Claude AI settings
.claude/
EOF

# Add .gitignore and commit
git add .gitignore
git commit -m "Add comprehensive .gitignore and remove sensitive files"

echo "⚠️  IMPORTANT: You must now:"
echo "1. Revoke the Google Cloud service account key in GCP Console"
echo "2. Generate a new service account key if needed"
echo "3. Force push to GitHub to update the remote repository"
echo ""
echo "Run: git push --force origin main"
echo ""
echo "🔐 The sensitive files have been removed from git history"