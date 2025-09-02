// Lan Onasis Branding Colors and Variables
// Based on developer handoff specifications

export const LanOnasisColors = {
  // Primary brand colors (light mode)
  navy: '#1B265D',
  green: '#00D4AA', 
  gold: '#FFD700',
  
  // Dark mode variants
  dark: {
    navy: '#182B4E',
    green: '#00BC97',
    gold: '#F5C800',
  },
  
  // CSS custom properties for dynamic theming
  cssVariables: {
    light: {
      '--ln-navy': '#1B265D',
      '--ln-green': '#00D4AA',
      '--ln-gold': '#FFD700',
    },
    dark: {
      '--ln-navy': '#182B4E', 
      '--ln-green': '#00BC97',
      '--ln-gold': '#F5C800',
    }
  }
};

// Logo sizing specifications
export const LogoSpecs = {
  primary: {
    maxWidth: {
      mobile: '150px',
      tablet: '200px', 
      desktop: '250px',
    },
    height: 'auto',
  },
  secondary: {
    maxHeight: '60px',
    mobile: {
      maxHeight: '48px',
    }
  },
  icon: {
    width: '32px',
    height: '32px',
  }
};

// Responsive breakpoints from handoff
export const BrandingBreakpoints = {
  mobile: '480px',
  tablet: '768px',
  desktop: '1200px',
};

// Helper function to apply branding colors to existing theme
export const applyLanOnasisBranding = (existingTheme: any, isDark: boolean = false) => {
  const brandColors = isDark ? LanOnasisColors.dark : LanOnasisColors;
  
  return {
    ...existingTheme,
    // Enhance existing colors with branding
    primary: brandColors.navy,
    accent: brandColors.green,
    secondary: brandColors.gold,
    
    // Add branding-specific colors while keeping existing theme structure
    branding: {
      navy: brandColors.navy,
      green: brandColors.green,
      gold: brandColors.gold,
    },
    
    // Keep existing theme colors for compatibility
    // (removed redundant spread of existingTheme)
  };
};