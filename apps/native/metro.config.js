const { getDefaultConfig } = require('expo/metro-config');
const { wrapWithReanimatedMetroConfig } = require('react-native-reanimated/metro-config');

// eslint-disable-next-line no-undef
const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.resolver.unstable_enablePackageExports = true;

module.exports = wrapWithReanimatedMetroConfig(config);
