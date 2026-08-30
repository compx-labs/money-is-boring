import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Chamfer } from '@/components/Chamfer';
import { HapticPressable } from '@/components/HapticPressable';
import { LoadingScreen } from '@/components/LoadingScreen';
import { MorphIcon } from '@/components/MorphIcon';
import { SheetScaffold } from '@/components/SheetScaffold';
import { useProvider } from '@/hooks/useProvider';
import { algorandAddressFromKey, findWalletAccount } from '@/lib/keystore/wallet-account';
import { ICON_MORPH_MS } from '@/lib/motion/icon';
import { colors, fonts } from '@/lib/theme';

const ICON_HOLD_MS = ICON_MORPH_MS + 280;

function ProfileBody() {
  const { keys, accounts } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), ICON_HOLD_MS);
    return () => clearTimeout(id);
  }, [copied]);

  if (!wallet || !address) {
    if (keys.length === 0) return <Redirect href="/onboarding" />;
    return <LoadingScreen />;
  }

  const onCopy = async () => {
    await Clipboard.setStringAsync(address);
    setCopied(true);
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>profile</Text>
      <HapticPressable
        onPress={onCopy}
        accessibilityRole="button"
        accessibilityLabel={copied ? 'Copied address' : 'Copy address'}
        style={styles.addressPress}
      >
        <Chamfer
          fill={colors.bg}
          stroke={colors.button}
          strokeWidth={2}
          style={styles.addressFace}
          contentStyle={styles.addressInner}
        >
          <Text style={styles.address} numberOfLines={1}>
            {address}
          </Text>
          <MorphIcon
            name={copied ? 'checkmark' : 'copy-outline'}
            size={22}
            color={colors.button}
            bounce={copied}
          />
        </Chamfer>
      </HapticPressable>
    </View>
  );
}

export default function Profile() {
  return (
    <SheetScaffold>
      <ProfileBody />
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 28,
    alignItems: 'flex-start',
  },
  title: {
    color: colors.button,
    fontFamily: fonts.semibold,
    fontSize: 44,
  },
  addressPress: {
    alignSelf: 'stretch',
  },
  addressFace: {
    alignSelf: 'stretch',
  },
  addressInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 16,
  },
  address: {
    flex: 1,
    color: colors.button,
    fontFamily: fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
});
