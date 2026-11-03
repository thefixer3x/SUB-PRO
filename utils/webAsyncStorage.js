const webAsyncStorage = {
  async getItem(key) {
    try {
      const value = localStorage.getItem(key);
      return Promise.resolve(value);
    } catch (error) {
      return Promise.reject(error);
    }
  },

  async setItem(key, value) {
    try {
      localStorage.setItem(key, value);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  },

  async removeItem(key) {
    try {
      localStorage.removeItem(key);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  },

  async clear() {
    try {
      localStorage.clear();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  },

  async getAllKeys() {
    try {
      const keys = Object.keys(localStorage);
      return Promise.resolve(keys);
    } catch (error) {
      return Promise.reject(error);
    }
  },
};

module.exports = webAsyncStorage;
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="73249141-2cec-5d35-a834-0acd2f3b4776")}catch(e){}}();
//# debugId=73249141-2cec-5d35-a834-0acd2f3b4776
