const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to:
 * 1. Inject release signing configuration directly into android/app/build.gradle
 *    (single-pass native Gradle release signing with v1, v2, v3 schemes).
 * 2. Configure expo.useLegacyPackaging=true in gradle.properties to ensure
 *    native libraries are compressed and extracted to disk on installation (extractNativeLibs="true"),
 *    preventing modern Samsung/Android page-alignment or memory-mapping installation failures.
 */
function withReleaseSigning(config) {
  config = withAppBuildGradle(config, (config) => {
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
            enableV1Signing = true
            enableV2Signing = true
            enableV3Signing = true
            enableV4Signing = false
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

  config = withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => item.key !== 'expo.useLegacyPackaging'
    );
    config.modResults.push({
      type: 'property',
      key: 'expo.useLegacyPackaging',
      value: 'true',
    });
    return config;
  });

  return config;
}

module.exports = withReleaseSigning;
