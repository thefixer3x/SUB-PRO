#!/bin/zsh

# Exit on any error
set -e

echo "🚀 Starting Global NVM installation for all users..."

# Check if running with sudo
if [[ $EUID -eq 0 ]]; then
    echo "⚠️  This script should NOT be run with sudo. Please run as a regular user."
    exit 1
fi

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "🍺 Installing Homebrew first..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for current session
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [[ -f "/usr/local/bin/brew" ]]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
fi

# Remove any existing installations
echo "🧹 Cleaning up previous installations..."
rm -rf ~/.nvm ~/.npm 2>/dev/null || true

# Install nvm using Homebrew
echo "🍺 Installing nvm via Homebrew..."
brew update
brew install nvm

# Create nvm directory
echo "📁 Creating nvm directory..."
mkdir -p ~/.nvm

# Detect Homebrew installation path
if [[ -d "/opt/homebrew" ]]; then
    HOMEBREW_PREFIX="/opt/homebrew"
else
    HOMEBREW_PREFIX="/usr/local"
fi

echo "🔍 Detected Homebrew prefix: $HOMEBREW_PREFIX"

# Backup existing shell configuration files
echo "💾 Backing up shell configuration files..."
for shell_config in ~/.zshrc ~/.bashrc ~/.bash_profile ~/.profile; do
    if [[ -f "$shell_config" ]]; then
        cp "$shell_config" "${shell_config}.backup.$(date +%Y%m%d%H%M%S)" 2>/dev/null || true
    fi
done

# Function to add NVM configuration to shell config
add_nvm_config() {
    local config_file="$1"
    
    # Create the file if it doesn't exist
    touch "$config_file"
    
    # Check if NVM configuration already exists
    if ! grep -q "NVM_DIR" "$config_file"; then
        echo "⚙️  Adding NVM configuration to $config_file..."
        cat >> "$config_file" << EOF

# NVM configuration - Added by install script
export NVM_DIR="\$HOME/.nvm"
[ -s "$HOMEBREW_PREFIX/opt/nvm/nvm.sh" ] && \\. "$HOMEBREW_PREFIX/opt/nvm/nvm.sh"  # This loads nvm
[ -s "$HOMEBREW_PREFIX/opt/nvm/etc/bash_completion.d/nvm" ] && \\. "$HOMEBREW_PREFIX/opt/nvm/etc/bash_completion.d/nvm"  # This loads nvm bash_completion

# Auto-load nvm when entering directories with .nvmrc
autoload -U add-zsh-hook
load-nvmrc() {
  local node_version="\$(nvm version)"
  local nvmrc_path="\$(nvm_find_nvmrc)"

  if [ -n "\$nvmrc_path" ]; then
    local nvmrc_node_version=\$(nvm version "\$(cat "\${nvmrc_path}")")

    if [ "\$nvmrc_node_version" = "N/A" ]; then
      nvm install
    elif [ "\$nvmrc_node_version" != "\$node_version" ]; then
      nvm use
    fi
  elif [ "\$node_version" != "\$(nvm version default)" ]; then
    echo "Reverting to nvm default version"
    nvm use default
  fi
}
add-zsh-hook chpwd load-nvmrc
load-nvmrc
EOF
    else
        echo "✅ NVM configuration already exists in $config_file"
    fi
}

# Add configuration to shell files
add_nvm_config ~/.zshrc
add_nvm_config ~/.bashrc

# Source the configuration for current session
echo "🔄 Loading NVM for current session..."
export NVM_DIR="$HOME/.nvm"
[ -s "$HOMEBREW_PREFIX/opt/nvm/nvm.sh" ] && \. "$HOMEBREW_PREFIX/opt/nvm/nvm.sh"

# Install Node.js LTS
echo "📦 Installing Node.js LTS..."
nvm install --lts
nvm alias default node
nvm use default

# Install global packages commonly used with Expo
echo "📦 Installing global packages..."
npm install -g expo-cli @expo/cli eas-cli

# Verify installation
echo "✅ Installation complete! Verifying..."
echo "nvm version: $(nvm --version)"
echo "node version: $(node --version)"
echo "npm version: $(npm --version)"
echo "expo version: $(expo --version)"

# Create .nvmrc file in the current project
echo "📝 Creating .nvmrc file for this project..."
node --version > .nvmrc
echo "✅ Created .nvmrc with Node version: $(cat .nvmrc)"

# Set up global npm configuration
echo "⚙️  Configuring npm..."
npm config set fund false
npm config set audit-level moderate

echo ""
echo "✨ Global NVM installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Restart your terminal or run: source ~/.zshrc"
echo "2. Verify installation with: nvm --version"
echo "3. Use 'nvm use' in any project with .nvmrc file"
echo "4. Install project dependencies with: npm install"
echo ""
echo "🔧 Useful NVM commands:"
echo "  nvm list                 - List installed Node versions"
echo "  nvm install <version>    - Install specific Node version"
echo "  nvm use <version>        - Switch to specific version"
echo "  nvm alias default <ver>  - Set default Node version"
echo ""
