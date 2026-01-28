#!/bin/bash

# SubTrack Pro - Demo Mode Toggle Script
# This script enables or disables demo mode for development/production

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AUTH_CONTEXT="$PROJECT_ROOT/contexts/AuthContext.tsx"
SIGNIN_FILE="$PROJECT_ROOT/app/(auth)/signin.tsx"
SIGNUP_FILE="$PROJECT_ROOT/app/(auth)/signup.tsx"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

show_usage() {
    echo "Usage: $0 [enable|disable|status]"
    echo ""
    echo "Commands:"
    echo "  enable   - Enable demo mode (for development/testing)"
    echo "  disable  - Disable demo mode (for production/App Store)"
    echo "  status   - Show current demo mode status"
    echo ""
    echo "Example:"
    echo "  $0 disable   # Prepare for App Store submission"
}

check_status() {
    if grep -q "DEMO_MODE_ENABLED = true" "$AUTH_CONTEXT" 2>/dev/null; then
        echo -e "${YELLOW}Demo Mode: ENABLED${NC}"
        echo "The app is currently in demo mode."
        echo "Users can bypass authentication with guest login."
        return 0
    else
        echo -e "${GREEN}Demo Mode: DISABLED${NC}"
        echo "The app requires real authentication."
        echo "Ready for production/App Store submission."
        return 1
    fi
}

enable_demo_mode() {
    echo -e "${YELLOW}Enabling demo mode...${NC}"
    
    if [ -f "$AUTH_CONTEXT" ]; then
        sed -i 's/const DEMO_MODE_ENABLED = false/const DEMO_MODE_ENABLED = true/' "$AUTH_CONTEXT"
        echo "  - Updated AuthContext.tsx"
    fi
    
    echo -e "${GREEN}Demo mode enabled!${NC}"
    echo ""
    echo "What this means:"
    echo "  - Users can click 'Continue as Guest' to bypass login"
    echo "  - No Supabase connection required"
    echo "  - Useful for development and testing"
}

disable_demo_mode() {
    echo -e "${YELLOW}Disabling demo mode for production...${NC}"
    
    if [ -f "$AUTH_CONTEXT" ]; then
        sed -i 's/const DEMO_MODE_ENABLED = true/const DEMO_MODE_ENABLED = false/' "$AUTH_CONTEXT"
        echo "  - Updated AuthContext.tsx"
    fi
    
    echo -e "${GREEN}Demo mode disabled!${NC}"
    echo ""
    echo "Production checklist:"
    echo "  [ ] Ensure Supabase is operational"
    echo "  [ ] Verify environment secrets are set in EAS"
    echo "  [ ] Test login with real credentials"
    echo "  [ ] Build with: eas build --platform ios --profile store-submission"
}

case "$1" in
    enable)
        enable_demo_mode
        ;;
    disable)
        disable_demo_mode
        ;;
    status)
        check_status
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
