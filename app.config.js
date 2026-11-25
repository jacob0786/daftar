// Adds your own Expo project (for over-the-air updates) on top of app.json.
// The details live in daftar.local.json, which is never committed, so the public code names no one's account.
// To set up your own: copy daftar.local.example.json to daftar.local.json and fill it in (see README).
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const file = path.join(__dirname, 'daftar.local.json');
  const local = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const ota = Boolean(local.projectId && local.updatesUrl);
  return {
    ...config,
    ...(local.owner ? { owner: local.owner } : {}),
    updates: {
      ...config.updates,
      enabled: ota,
      ...(ota ? { url: local.updatesUrl, requestHeaders: { 'expo-channel-name': 'production' } } : {}),
    },
    extra: { ...config.extra, ...(local.projectId ? { eas: { projectId: local.projectId } } : {}) },
  };
};
