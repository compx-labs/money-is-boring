const { version } = require('./package.json');

module.exports = {
  expo: {
    name: 'Money is Boring',
    slug: 'money-is-boring',
    version,
    orientation: 'portrait',
    scheme: 'mib',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#1a1a1a',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'io.compx.moneyisboring',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSFaceIDUsageDescription:
          'Money is Boring uses Face ID to unlock your wallet.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1a1a1a',
      },
      edgeToEdgeEnabled: true,
      package: 'io.compx.moneyisboring',
      allowBackup: false,
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/splash.png',
          resizeMode: 'contain',
          backgroundColor: '#1a1a1a',
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 35,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
  },
};
