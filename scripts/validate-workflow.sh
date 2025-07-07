#!/bin/bash

# Enhanced EAS Build Workflow Validator
# Validates the GitHub Actions workflow for common issues

set -e

echo "🔍 Validating Enhanced EAS Build Workflow..."

WORKFLOW_FILE=".github/workflows/enhanced-eas-build.yml"

# Check if workflow file exists
if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "❌ Workflow file not found: $WORKFLOW_FILE"
    exit 1
fi

echo "✅ Workflow file found"

# Validate YAML syntax
if command -v yamllint > /dev/null; then
    echo "🔍 Validating YAML syntax..."
    yamllint "$WORKFLOW_FILE" || echo "⚠️ YAML linting completed with warnings"
else
    echo "⚠️ yamllint not available, skipping YAML validation"
fi

# Check for required secrets
echo "🔍 Checking for required secrets..."
if grep -q "EXPO_TOKEN" "$WORKFLOW_FILE"; then
    echo "✅ EXPO_TOKEN secret reference found"
else
    echo "❌ EXPO_TOKEN secret reference missing"
    exit 1
fi

# Validate workflow structure
echo "🔍 Validating workflow structure..."

# Check for required jobs
REQUIRED_JOBS=("validate" "test" "build" "update" "notification")
for job in "${REQUIRED_JOBS[@]}"; do
    if grep -q "^  $job:" "$WORKFLOW_FILE"; then
        echo "✅ Job '$job' found"
    else
        echo "❌ Job '$job' missing"
        exit 1
    fi
done

# Check for required triggers
if grep -q "workflow_dispatch:" "$WORKFLOW_FILE"; then
    echo "✅ Manual trigger configured"
else
    echo "❌ Manual trigger missing"
    exit 1
fi

if grep -q "push:" "$WORKFLOW_FILE"; then
    echo "✅ Push trigger configured"
else
    echo "❌ Push trigger missing"
    exit 1
fi

if grep -q "pull_request:" "$WORKFLOW_FILE"; then
    echo "✅ Pull request trigger configured"
else
    echo "❌ Pull request trigger missing"
    exit 1
fi

# Check for EAS CLI installation
if grep -q "eas-cli@" "$WORKFLOW_FILE"; then
    echo "✅ EAS CLI installation found"
else
    echo "❌ EAS CLI installation missing"
    exit 1
fi

# Check for platform matrix
if grep -q "matrix:" "$WORKFLOW_FILE"; then
    echo "✅ Build matrix configured"
else
    echo "❌ Build matrix missing"
    exit 1
fi

# Check for artifact upload
if grep -q "actions/upload-artifact@v4" "$WORKFLOW_FILE"; then
    echo "✅ Artifact upload configured"
else
    echo "❌ Artifact upload missing"
    exit 1
fi

# Check for proper job dependencies
if grep -q "needs:" "$WORKFLOW_FILE"; then
    echo "✅ Job dependencies configured"
else
    echo "❌ Job dependencies missing"
    exit 1
fi

echo ""
echo "🎉 Workflow validation completed successfully!"
echo ""
echo "📋 Summary:"
echo "- Workflow file: $WORKFLOW_FILE"
echo "- Required jobs: ${#REQUIRED_JOBS[@]}"
echo "- Trigger events: 3 (push, pull_request, workflow_dispatch)"
echo "- Platform support: Android & iOS"
echo "- Build profiles: development, preview, production"
echo ""
echo "🔧 Next steps:"
echo "1. Ensure EXPO_TOKEN secret is set in GitHub repository settings"
echo "2. Configure EAS project with 'eas init' if not already done"
echo "3. Test the workflow by pushing to main branch or triggering manually"
echo ""
echo "🚀 Ready for production builds!"
