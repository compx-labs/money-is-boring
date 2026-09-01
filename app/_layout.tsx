import { install } from 'react-native-quick-crypto';
import { subtle } from 'react-native-quick-crypto';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  BarlowSemiCondensed_400Regular,
  BarlowSemiCondensed_600SemiBold,
  BarlowSemiCondensed_700Bold,
} from '@expo-google-fonts/barlow-semi-condensed';
import React from 'react';
import { useStore } from '@tanstack/react-store';
import { BootDoors } from '@/components/BootDoors';
import { bootstrap } from '@/lib/keystore/bootstrap';
import { biometricOptions } from '@/lib/keystore/auth-options';
import { ReactNativeProvider, WalletProvider } from '@/providers/ReactNativeProvider';
import { accountsStore } from '@/stores/accounts';
import { accountHooks, keyStoreHooks } from '@/stores/before-after';
import { keyStore } from '@/stores/keystore';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BackgroundTexture } from '@/components/BackgroundTexture';
import { useChrome } from '@/hooks/useChrome';
import { useColorMode } from '@/hooks/useColorMode';
import { sheetScreenOptions } from '@/lib/motion/sheet';

// Ensure install() ran even if a test imports this module without index.js.
install();

SplashScreen.preventAutoHideAsync().catch(() => {});

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

function RootNavigation({
  ready,
  doorsGone,
  onDoorsLaidOut,
  onDoorsOpened,
}: {
  ready: boolean;
  doorsGone: boolean;
  onDoorsLaidOut: () => void;
  onDoorsOpened: () => void;
}) {
  return (
    <View style={styles.fill}>
      {ready ? (
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
          <Stack.Screen name="merchant/[id]" options={sheetScreenOptions} />
          <Stack.Screen name="add-asset" options={sheetScreenOptions} />
        </Stack>
      ) : null}
      {doorsGone ? null : (
        <BootDoors open={ready} onLaidOut={onDoorsLaidOut} onOpened={onDoorsOpened} />
      )}
    </View>
  );
}

export default function RootLayout() {
  const status = useStore(keyStore, (state) => state.status);
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);
  const [doorsGone, setDoorsGone] = React.useState(false);
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
  const { bg } = useChrome();
  const mode = useColorMode();

  const hideSplash = React.useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const dismissDoors = React.useCallback(() => {
    setDoorsGone(true);
  }, []);

  return (
    <SafeAreaProvider>
      <View style={[styles.root, { backgroundColor: bg }]}>
        <BackgroundTexture />
        <WalletProvider provider={provider}>
          <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
          <RootNavigation
            ready={hasLoadedOnce && fontsReady}
            doorsGone={doorsGone}
            onDoorsLaidOut={hideSplash}
            onDoorsOpened={dismissDoors}
          />
        </WalletProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
});
