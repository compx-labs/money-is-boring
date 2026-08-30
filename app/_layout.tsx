import { install } from 'react-native-quick-crypto';
import { subtle } from 'react-native-quick-crypto';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Fredoka_400Regular,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import React from 'react';
import { useStore } from '@tanstack/react-store';
import { LoadingScreen } from '@/components/LoadingScreen';
import { bootstrap } from '@/lib/keystore/bootstrap';
import { biometricOptions } from '@/lib/keystore/auth-options';
import { ReactNativeProvider, WalletProvider } from '@/providers/ReactNativeProvider';
import { accountsStore } from '@/stores/accounts';
import { accountHooks, keyStoreHooks } from '@/stores/before-after';
import { keyStore } from '@/stores/keystore';
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
        contentStyle: { backgroundColor: colors.bg },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="swap" options={sheetScreenOptions} />
      <Stack.Screen name="send" options={sheetScreenOptions} />
      <Stack.Screen name="receive" options={sheetScreenOptions} />
    </Stack>
  );
}

export default function RootLayout() {
  const status = useStore(keyStore, (state) => state.status);
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_400Regular,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
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
    <WalletProvider provider={provider}>
      <StatusBar style="dark" />
      <RootNavigation ready={hasLoadedOnce && fontsReady} />
    </WalletProvider>
  );
}
