jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-crypto's native module needs an ExpoModule proxy in the jest
// environment. Mock it with the platform CSPRNG so tests exercise the same
// API the app calls, and so no insecure fallback is possible.
jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');

  return {
    getRandomBytes: (byteCount: number) => {
      const bytes = new Uint8Array(byteCount);
      nodeCrypto.randomFillSync(bytes);
      return bytes;
    },
    getRandomBytesAsync: async (byteCount: number) => {
      const bytes = new Uint8Array(byteCount);
      nodeCrypto.randomFillSync(bytes);
      return bytes;
    },
    getRandomValues: <T extends Uint8Array>(typedArray: T): T => {
      nodeCrypto.randomFillSync(typedArray);
      return typedArray;
    },
    randomUUID: () => nodeCrypto.randomUUID(),
  };
});
