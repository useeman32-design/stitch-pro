// Temporary: cap Metro's worker pool to reduce peak memory usage in
// resource-constrained sandboxes (this does not affect production builds).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.maxWorkers = 1;

module.exports = config;
