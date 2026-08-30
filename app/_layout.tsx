import { install } from 'react-native-quick-crypto';
import { subtle } from 'react-native-quick-crypto';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  BarlowSemiCondensed_400Regular,
  BarlowSemiCondensed_600SemiBold,
  BarlowSemiCondensed_700Bold,
} from '@expo-google-fonts/barlow-semi-condensed';
import React from 'react';
import { useStore } from '@tanstack/react-store';
import { LoadingScreen } from '@/components/LoadingScreen';
import { bootstrap } from '@/lib/keystore/bootstrap';
import { biometricOptions } from '@/lib/keystore/auth-options';
import { ReactNativeProvider, WalletProvider } from '@/providers/ReactNativeProvider';
import { accountsStore } from '@/stores/accounts';
import { accountHooks, keyStoreHooks } from '@/stores/before-after';
import { keyStore } from '@/stores/keystore';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BackgroundTexture } from '@/components/BackgroundTexture';
import { colors } from '@/lib/theme';
import { sheetScreenOptions } from '@/lib/motion/sheet';

// Ensure install() ran even if a test imports this module without index.js.
install();

export const provider = new ReactNativeProvider(
  {
    id: 'money-is-boring',
    name: 'Money is Boring',
  },
  {
    accounts: {
      store: accountsStore,
      hooks: accountHooks,
      keystore: {
        autoPopulate: true,
      },
    },
    keystore: {
      store: keyStore,
      hooks: keyStoreHooks,
      subtle: subtle as unknown as SubtleCrypto,
      authentication: biometricOptions,
    },
  },
);

function RootNavigation({ ready }: { ready: boolean }) {
  if (!ready) return <LoadingScreen />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="swap" options={sheetScreenOptions} />
      <Stack.Screen name="send" options={sheetScreenOptions} />
      <Stack.Screen name="receive" options={sheetScreenOptions} />
      <Stack.Screen name="profile" options={sheetScreenOptions} />
      <Stack.Screen name="add-asset" options={sheetScreenOptions} />
    </Stack>
  );
}

export default function RootLayout() {
  const status = useStore(keyStore, (state) => state.status);
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);
  const [fontsLoaded, fontError] = useFonts({
    BarlowSemiCondensed_400Regular,
    BarlowSemiCondensed_600SemiBold,
    BarlowSemiCondensed_700Bold,
  });

  React.useEffect(() => {
    bootstrap().catch(() => {
      keyStore.setState((s) => ({ ...s, status: 'error' }));
    });
  }, []);

  const ready = status !== 'loading';
  React.useEffect(() => {
    if (ready) setHasLoadedOnce(true);
  }, [ready]);

  const fontsReady = fontsLoaded || fontError != null;

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <BackgroundTexture />
        <WalletProvider provider={provider}>
          <StatusBar style="dark" />
          <View style={styles.fill}>
            <RootNavigation ready={hasLoadedOnce && fontsReady} />
          </View>
        </WalletProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fill: {
    flex: 1,
  },
});
