import { Platform } from 'react-native';

let SecureStore: any;
if (Platform.OS !== 'web') {
  SecureStore = require('expo-secure-store');
} else {
  SecureStore = {
    getItemAsync: async () => null,
    setItemAsync: async () => {},
    deleteItemAsync: async () => {},
    isAvailableAsync: async () => false,
  };
}

export default SecureStore;