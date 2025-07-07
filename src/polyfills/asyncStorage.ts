import { Platform } from 'react-native';

let AsyncStorage: any;
if (Platform.OS !== 'web') {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} else {
  AsyncStorage = {
    getItem: async (key: string) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Fail silently
      }
    },
    removeItem: async (key: string) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Fail silently
      }
    },
    clear: async () => {
      try {
        localStorage.clear();
      } catch {
        // Fail silently
      }
    },
    getAllKeys: async () => {
      try {
        return Object.keys(localStorage);
      } catch {
        return [];
      }
    },
  };
}

export default AsyncStorage;