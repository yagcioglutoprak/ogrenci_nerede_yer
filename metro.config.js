const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.alias = { '@': path.resolve(__dirname, 'src') };
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
