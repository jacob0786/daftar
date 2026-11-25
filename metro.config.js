// Bundler settings. The desktop (web) build loads SQLite as WebAssembly, so .wasm files are bundled as assets,
// and the dev server sends the headers SQLite needs for shared memory.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');
// The desktop wrapper has its own packages; keep the bundler out of them
config.resolver.blockList = [/[\\/]desktop[\\/].*/, /[\\/]dist-web[\\/].*/];
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
