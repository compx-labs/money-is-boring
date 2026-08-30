import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticPressable } from '@/components/HapticPressable';
import { SittingCube } from '@/components/SittingCube';
import { useProvider } from '@/hooks/useProvider';
import { useWalletSetup } from '@/hooks/useWalletSetup';
import { colors, fonts } from '@/lib/theme';

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { keys } = useProvider();
  const { createWallet } = useWalletSetup();
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (keys.some((k) => k.type === 'hd-derived-ed25519')) {
      router.replace('/home');
    }
  }, [keys, router]);

  const onCreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createWallet();
      router.replace('/home');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      Alert.alert('Could not create wallet', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 28 }]}>
      <View style={styles.hero}>
        <SittingCube size={168} />
        <Text style={styles.tagline}>money is boring.</Text>
      </View>

      <View style={styles.actions}>
        <HapticPressable
          onPress={onCreate}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Create with passkey"
          style={[styles.button, busy && styles.buttonBusy]}
        >
          <Text style={styles.buttonLabel}>{busy ? 'creating…' : 'Create with passkey'}</Text>
        </HapticPressable>
        <Text style={styles.hint}>
          A second passkey / iCloud restore comes later. This device holds the key.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 28,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  tagline: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 44,
    letterSpacing: 0.8,
  },
  actions: {
    gap: 16,
  },
  button: {
    backgroundColor: colors.button,
    borderRadius: 8,
    minHeight: 80,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBusy: {
    opacity: 0.6,
  },
  buttonLabel: {
    color: colors.buttonText,
    fontFamily: fonts.bold,
    fontSize: 32,
  },
  hint: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 26,
    lineHeight: 36,
    textAlign: 'center',
  },
});
