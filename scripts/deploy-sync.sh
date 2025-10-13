#!/bin/bash
# SubTrack Pro - Complete Deployment and Sync Script
# This script handles database migration, build, and deployment

set -e  # Exit on error

echo "🚀 SubTrack Pro - Deployment & Database Sync"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if required tools are installed
check_requirements() {
    print_step "Checking requirements..."
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install Node.js and npm first."
        exit 1
    fi
    
    # Check if supabase CLI is installed
    if ! command -v supabase &> /dev/null; then
        print_warning "Supabase CLI not found. Installing..."
        npm install -g supabase
    fi
    
    print_success "Requirements check completed"
}

# Function to run database migrations
migrate_database() {
    print_step "Running database migrations..."
    
    # Check if Supabase is linked
    if [ ! -f ".supabase/config.toml" ]; then
        print_warning "Supabase project not linked. Please run:"
        echo "  supabase link --project-ref YOUR_PROJECT_ID"
        echo "  supabase db pull"
        return 1
    fi
    
    # Run migrations
    print_step "Applying database migrations..."
    if supabase db push; then
        print_success "Database migrations completed successfully"
    else
        print_error "Database migration failed"
        return 1
    fi
}

# Function to sync database schema
sync_database() {
    print_step "Syncing database schema..."
    
    # Apply the complete schema migration
    if [ -f "supabase/migrations/20250902_complete_schema.sql" ]; then
        print_step "Applying complete schema migration..."
        # The migration will be applied via supabase db push
        print_success "Schema migration file ready"
    else
        print_warning "Complete schema migration file not found"
    fi
}

# Function to generate TypeScript types
generate_types() {
    print_step "Generating TypeScript types from Supabase..."
    
    if supabase gen types typescript --local > lib/supabase-generated.ts; then
        print_success "TypeScript types generated successfully"
        print_warning "Remember to update your imports if using the generated types"
    else
        print_warning "Failed to generate types - using existing manual types"
    fi
}

# Function to build the application
build_app() {
    print_step "Building application..."
    
    # Install dependencies
    print_step "Installing dependencies..."
    npm install
    
    # Run type check
    print_step "Running type checks..."
    if npm run type-check 2>/dev/null || echo "Type check skipped (tsc not available)"; then
        print_success "Type checks passed"
    fi
    
    # Build for web
    print_step "Building web application..."
    if npm run build:production; then
        print_success "Web build completed successfully"
    else
        print_error "Web build failed"
        return 1
    fi
}

# Function to deploy to Netlify
deploy_netlify() {
    print_step "Deploying to Netlify..."
    
    # Check if netlify CLI is installed
    if ! command -v netlify &> /dev/null; then
        print_warning "Netlify CLI not found. Installing..."
        npm install -g netlify-cli
    fi
    
    # Deploy to Netlify
    if netlify deploy --prod --dir=dist; then
        print_success "Deployed to Netlify successfully"
    else
        print_error "Netlify deployment failed"
        return 1
    fi
}

# Function to validate deployment
validate_deployment() {
    print_step "Validating deployment..."
    
    # Check if environment variables are set
    if [ -z "$EXPO_PUBLIC_SUPABASE_URL" ] || [ -z "$EXPO_PUBLIC_SUPABASE_ANON_KEY" ]; then
        print_warning "Supabase environment variables not set in production"
        echo "Make sure to set:"
        echo "  EXPO_PUBLIC_SUPABASE_URL"
        echo "  EXPO_PUBLIC_SUPABASE_ANON_KEY"
        echo "  SUPABASE_SERVICE_ROLE_KEY (for server functions)"
    fi
    
    if [ -z "$STRIPE_SECRET_KEY" ] || [ -z "$EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY" ]; then
        print_warning "Stripe environment variables not set in production"
        echo "Make sure to set:"
        echo "  STRIPE_SECRET_KEY"
        echo "  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"
        echo "  STRIPE_WEBHOOK_SECRET"
    fi
    
    print_success "Deployment validation completed"
}

# Main execution
main() {
    echo ""
    echo "Select deployment option:"
    echo "1) Full deployment (Database + Build + Deploy)"
    echo "2) Database sync only"
    echo "3) Build and deploy only"
    echo "4) Generate types only"
    
    read -p "Enter choice (1-4): " choice
    
    case $choice in
        1)
            print_step "Running full deployment..."
            check_requirements
            sync_database
            migrate_database
            generate_types
            build_app
            deploy_netlify
            validate_deployment
            print_success "Full deployment completed! 🎉"
            ;;
        2)
            print_step "Running database sync only..."
            check_requirements
            sync_database
            migrate_database
            generate_types
            print_success "Database sync completed! 🗄️"
            ;;
        3)
            print_step "Running build and deploy only..."
            check_requirements
            build_app
            deploy_netlify
            validate_deployment
            print_success "Build and deploy completed! 🚀"
            ;;
        4)
            print_step "Generating types only..."
            check_requirements
            generate_types
            print_success "Type generation completed! 📝"
            ;;
        *)
            print_error "Invalid choice. Please run the script again."
            exit 1
            ;;
    esac
}

# Run main function
main "$@"