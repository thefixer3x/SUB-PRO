#!/bin/bash

# Script to push seftechub mobile app to GitHub
set -e

echo "🚀 Pushing SeftechHub Mobile to GitHub..."

# Navigate to the seftechub mobile directory
cd /Users/seyederick/DevOps/_project_folders/seftechub-workspace/seftec-mobile-standalone

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    git branch -M main
fi

# Add all files
echo "📁 Adding files to git..."
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "⚠️  No changes to commit"
else
    echo "💾 Committing changes..."
    git commit -m "Initial commit: SeftechHub Mobile App with Netlify config

- Added React Native/Expo mobile app
- Configured for web deployment
- Added netlify.toml for deployment
- Updated package.json with build scripts
- Ready for deployment to app.seftec.store"
fi

# Check if remote exists
if git remote get-url origin > /dev/null 2>&1; then
    echo "🔄 Pushing to existing remote..."
    git push origin main
else
    echo "🌐 Creating new GitHub repository..."
    # Create GitHub repo using gh CLI
    gh repo create seftechub-mobile --private --source=. --remote=origin --push
    
    echo "✅ Repository created and pushed to: https://github.com/thefixer3x/seftechub-mobile"
fi

echo "🎉 SeftechHub Mobile successfully pushed to GitHub!"
echo "📍 Repository: https://github.com/thefixer3x/seftechub-mobile"
echo "🌐 Ready for Netlify deployment to app.seftec.store"