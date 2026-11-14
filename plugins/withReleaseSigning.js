const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to inject release signing configuration directly into android/app/build.gradle.
 * This ensures Gradle builds, aligns, and signs the release APK in a single native pass
 * using the official android-release.keystore.
 */
function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents;

    if (!buildGradle.includes('signingConfigs.release')) {
      const releaseSigning = `        release {
            if (project.hasProperty('RELEASE_STORE_FILE')) {
                storeFile file(RELEASE_STORE_FILE)
                storePassword RELEASE_STORE_PASSWORD
                keyAlias RELEASE_KEY_ALIAS
                keyPassword RELEASE_KEY_PASSWORD
            } else if (file('../../android-release.keystore').exists()) {
                storeFile file('../../android-release.keystore')
                storePassword 'moneyplus123'
                keyAlias 'moneyplus'
                keyPassword 'moneyplus123'
            }
            v1SigningEnabled true
            v2SigningEnabled true
            v3SigningEnabled true
        }`;

      // Insert release block inside signingConfigs
      buildGradle = buildGradle.replace(
        /(signingConfigs\s*\{[\s\S]*?debug\s*\{[\s\S]*?\})/,
        `$1\n${releaseSigning}`
      );

      // Point release buildType to signingConfigs.release
      buildGradle = buildGradle.replace(
        /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.debug/,
        `$1(signingConfigs.findByName('release')?.storeFile?.exists() ? signingConfigs.release : signingConfigs.debug)`
      );

      config.modResults.contents = buildGradle;
    }

    return config;
  });
}

module.exports = withReleaseSigning;
