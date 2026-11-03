// Web-compatible implementation of expo-secure-store
// This provides localStorage-based storage for web platform

const webSecureStore = {
  async setItemAsync(key, value, options = {}) {
    try {
      localStorage.setItem(key, value);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  },

  async getItemAsync(key, options = {}) {
    try {
      const value = localStorage.getItem(key);
      return Promise.resolve(value);
    } catch (error) {
      return Promise.reject(error);
    }
  },

  async deleteItemAsync(key, options = {}) {
    try {
      localStorage.removeItem(key);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  },

  async isAvailableAsync() {
    return Promise.resolve(typeof Storage !== 'undefined');
  }
};

module.exports = webSecureStore;
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="d7188abf-6769-5a02-9cb5-739384e527ef")}catch(e){}}();
//# debugId=d7188abf-6769-5a02-9cb5-739384e527ef
