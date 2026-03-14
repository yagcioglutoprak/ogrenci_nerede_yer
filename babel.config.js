module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@': './src',
          },
        },
      ],
      [
        'transform-remove-console',
        {
          exclude: ['error'],
        },
      ],
      // Must be last
      'react-native-reanimated/plugin',
    ],
  };
};
