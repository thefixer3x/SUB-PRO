module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "react-native-reanimated/plugin",
        {
          processNestedWorklets: true,
        },
      ],
    ],
  };
};
!function(){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&(e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="518becf7-58d1-56a0-ae92-14e60be04e7e")}catch(e){}}();
//# debugId=518becf7-58d1-56a0-ae92-14e60be04e7e
