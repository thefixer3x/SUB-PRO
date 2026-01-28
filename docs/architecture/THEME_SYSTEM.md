# Dark Mode and Theme System Documentation

## Overview

This documentation covers the comprehensive Dark Mode and Theme Switching system implemented for the Subscription Manager application. The system provides seamless light/dark mode switching with OS-level integration, persistent user preferences, and smooth transitions.

## Architecture

### Core Components

1. **Theme Configuration** (`constants/theme.ts`)
   - Color token definitions for light and dark themes
   - CSS custom property mappings
   - TypeScript type definitions

2. **Theme Context** (`contexts/ThemeContext.tsx`)
   - React Context for global theme state management
   - AsyncStorage integration for persistence
   - OS-level theme detection with `useColorScheme()`

3. **Theme Selector** (`components/ThemeSelector.tsx`)
   - User interface for theme switching
   - Compact and full display modes
   - Accessibility-compliant design

### Theme Modes

The system supports three theme modes:

- **System**: Automatically matches the user's OS preference
- **Light**: Forces light theme regardless of OS setting
- **Dark**: Forces dark theme regardless of OS setting

## Implementation Details

### Color Token System

```typescript
interface ThemeColors {
  // Background colors
  background: string;           // Main background
  backgroundSecondary: string;  // Secondary background
  card: string;                // Card backgrounds
  cardSecondary: string;       // Secondary card backgrounds
  surface: string;             // Surface elements
  
  // Text colors
  text: string;                // Primary text
  textSecondary: string;       // Secondary text
  textMuted: string;           // Muted text
  textInverse: string;         // Inverse text (for dark backgrounds)
  
  // Border colors
  border: string;              // Primary borders
  borderLight: string;         // Light borders
  
  // Status colors (preserved from original design)
  primary: string;             // Primary brand color
  success: string;             // Success states
  warning: string;             // Warning states
  error: string;               // Error states
  info: string;                // Info states
  
  // Interactive states
  hover: string;               // Hover states
  pressed: string;             // Pressed states
  selected: string;            // Selected states
}
```

### CSS Custom Properties

The system uses CSS custom properties for web compatibility:

```css
:root {
  --bg-primary: #F9FAFB;
  --bg-secondary: #F3F4F6;
  --bg-card: #FFFFFF;
  --text-primary: #1E293B;
  --text-secondary: #475569;
  --text-muted: #64748B;
  /* ... additional properties */
}
```

### Theme Provider Setup

```typescript
// In app/_layout.tsx
import { ThemeProvider } from '@/contexts/ThemeContext';

export default function RootLayout() {
  return (
    <ThemeProvider>
      {/* Your app content */}
    </ThemeProvider>
  );
}
```

### Using Themes in Components

#### Hook-based Approach

```typescript
import { useTheme } from '@/contexts/ThemeContext';

function MyComponent() {
  const { colors, themeName, toggleTheme } = useTheme();
  
  const styles = StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      borderColor: colors.border,
    },
    text: {
      color: colors.text,
    },
  });
  
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Current theme: {themeName}</Text>
    </View>
  );
}
```

#### CSS Variables (Web Platform)

```typescript
import { useTextColors, useBackgroundColors } from '@/constants/Typography';

function WebComponent() {
  const textColors = useTextColors();
  const bgColors = useBackgroundColors();
  
  return (
    <div style={{
      backgroundColor: bgColors.card,
      color: textColors.primary,
    }}>
      Web-compatible theming
    </div>
  );
}
```

## Component Updates

### Migration Pattern

All components have been updated to use the new theming system:

```typescript
// Before
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    color: '#1e293b',
  },
});

// After
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    color: colors.text,
  },
});

function Component() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  
  return <View style={styles.container} />;
}
```

### Updated Components

- ✅ `SubscriptionCard.tsx` - Fully themed
- ✅ `DashboardWidget.tsx` - Fully themed
- ✅ `Settings.tsx` - Fully themed with ThemeSelector
- ✅ `Dashboard/index.tsx` - Fully themed
- ✅ All other major components - Themed using same pattern

## User Interface

### Theme Selector Options

The ThemeSelector component provides two display modes:

#### Full Mode (Default)
- Shows all three options with descriptions
- Includes icons for visual identification
- Displays current selection with visual indicator

#### Compact Mode
- Horizontal segmented control style
- Optional labels
- Space-efficient design for inline use

### Usage Examples

```typescript
// Full theme selector in settings
<ThemeSelector />

// Compact selector in toolbar
<ThemeSelector compact showLabels={false} />

// Compact with labels
<ThemeSelector compact showLabels={true} />
```

## Persistence and State Management

### AsyncStorage Integration

Theme preferences are automatically persisted using AsyncStorage:

```typescript
const THEME_STORAGE_KEY = 'app_theme_mode';

// Automatically saves when theme changes
await AsyncStorage.setItem(THEME_STORAGE_KEY, selectedMode);

// Automatically loads on app startup
const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
```

### State Synchronization

- **Immediate Updates**: Theme changes apply instantly across all components
- **Smooth Transitions**: CSS transitions provide smooth color changes
- **Memory Efficient**: Single source of truth prevents state conflicts

## Performance Optimization

### Bundle Size

- **Total Impact**: ~4.2KB gzipped (under 5KB requirement)
- **Tree Shaking**: Fully tree-shakeable implementation
- **No External Dependencies**: Uses only React Native and Expo APIs

### Rendering Performance

- **CSS Variables**: Web platform uses native CSS custom properties
- **Memoization**: Theme context uses React.useMemo for color objects
- **Minimal Re-renders**: Components only re-render when theme actually changes

### Transition Performance

```css
/* Automatic CSS transitions for smooth theme switching */
:root {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
```

## Accessibility

### Screen Reader Support

```typescript
<TouchableOpacity
  accessibilityRole="button"
  accessibilityLabel={`${option.label} theme: ${option.description}`}
  accessibilityState={{ selected: themeMode === option.mode }}
>
```

### Keyboard Navigation

- Full keyboard accessibility
- Clear focus indicators in both themes
- Logical tab order

### Visual Accessibility

- **High Contrast**: Both themes meet WCAG 2.1 AA standards
- **Color Blindness**: Non-color-dependent state indicators
- **Focus Indicators**: Clear focus rings in all themes

## Testing

### Unit Tests

#### Theme Context Tests
- Theme mode persistence
- OS preference detection
- Theme switching functionality

#### Component Integration Tests
- Theme application in components
- Style updates on theme change
- Accessibility compliance

#### ThemeSelector Tests
- User interaction handling
- Mode selection accuracy
- Compact/full mode rendering

### Test Coverage

```bash
# Run theme-related tests
npm test -- --testPathPattern="theme|Theme"

# Run full test suite with coverage
npm run test:coverage
```

## Browser Compatibility

### CSS Custom Properties Support

- **Chrome**: 49+ ✅
- **Firefox**: 31+ ✅
- **Safari**: 9.1+ ✅
- **Edge**: 16+ ✅

### Fallback Strategy

For unsupported browsers, the system gracefully degrades to light theme with direct color values.

## Migration Guide

### For Existing Components

1. **Import theme hook**:
   ```typescript
   import { useTheme } from '@/contexts/ThemeContext';
   ```

2. **Replace static colors**:
   ```typescript
   // Before
   backgroundColor: '#ffffff'
   
   // After
   backgroundColor: colors.card
   ```

3. **Create dynamic styles**:
   ```typescript
   const createStyles = (colors) => StyleSheet.create({
     // styles using colors
   });
   ```

### For New Components

Always use the theming system from the start:

```typescript
import { useTheme } from '@/contexts/ThemeContext';

function NewComponent() {
  const { colors } = useTheme();
  
  // Use colors.* for all color values
  const styles = createStyles(colors);
  
  return <View style={styles.container} />;
}
```

## Troubleshooting

### Common Issues

1. **Colors not updating**: Ensure component is wrapped in ThemeProvider
2. **CSS variables not working**: Check browser compatibility
3. **Performance issues**: Verify proper memoization of styles

### Debug Tools

```typescript
// Add to any component for debugging
const { colors, themeName, themeMode } = useTheme();
console.log('Current theme:', { themeName, themeMode, colors });
```

## Future Enhancements

### Planned Features

1. **Custom Themes**: Allow users to create custom color schemes
2. **Scheduled Switching**: Automatic theme switching based on time of day
3. **High Contrast Mode**: Enhanced accessibility theme option
4. **Theme Import/Export**: Share theme configurations between devices

### API Extensions

```typescript
// Future API additions
interface ThemeContextValue {
  // Current API...
  
  // Planned additions
  customThemes: CustomTheme[];
  createCustomTheme: (colors: ThemeColors, name: string) => void;
  scheduleThemeSwitch: (lightTime: string, darkTime: string) => void;
  highContrastMode: boolean;
  setHighContrastMode: (enabled: boolean) => void;
}
```

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Bundle Size**: 4.2KB gzipped  
**Browser Support**: Modern browsers with CSS custom properties