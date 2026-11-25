// Expo config plugin: sign release APKs with your own key when one is set up.
// The key's location and passwords come from your user-level Gradle settings
// (%USERPROFILE%\.gradle\gradle.properties): DAFTAR_STORE_FILE, DAFTAR_STORE_PASSWORD, DAFTAR_KEY_ALIAS, DAFTAR_KEY_PASSWORD.
// Nothing secret is ever written into this project. Without those settings, builds use the shared test key.
const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING = `
        release {
            if (project.hasProperty('DAFTAR_STORE_FILE')) {
                storeFile file(DAFTAR_STORE_FILE)
                storePassword DAFTAR_STORE_PASSWORD
                keyAlias DAFTAR_KEY_ALIAS
                keyPassword DAFTAR_KEY_PASSWORD
            }
        }`;

// The text change to android/app/build.gradle (also used by scripts to patch an existing project)
function applySigning(gradle) {
  if (gradle.includes('DAFTAR_STORE_FILE')) return gradle;
  return gradle
    .replace(/signingConfigs\s*\{/, (m) => `${m}${SIGNING}`)
    .replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[^{}]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig project.hasProperty('DAFTAR_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
    );
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = applySigning(cfg.modResults.contents);
    return cfg;
  });
};
module.exports.applySigning = applySigning;
