module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|@expo|expo(nent)?|expo-blur|expo-linear-gradient|expo-linking|expo-constants|expo-secure-store|expo-status-bar|expo-web-browser|expo-modules-core|react-native-reanimated|react-native-safe-area-context|@react-native-async-storage|@expo-google-fonts/.*|lucide-react-native)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
