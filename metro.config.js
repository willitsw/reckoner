const osModule = require('os');

// Metro calls os.availableParallelism() (Node >= 18.14). IDE/shells sometimes
// start Expo with an older Node, or an interop-wrapped `os` without that API.
const os =
  osModule && osModule.__esModule && osModule.default ? osModule.default : osModule;
if (typeof os.availableParallelism !== 'function') {
  os.availableParallelism = () => Math.max(1, os.cpus().length);
}

const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;
