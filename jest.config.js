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
  testPathIgnorePatterns: ['/node_modules/', '/docs/', '/coverage/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="253bdf3a-132c-5f7b-af82-886a8032ff3c")}catch(e){}}();
//# debugId=253bdf3a-132c-5f7b-af82-886a8032ff3c
