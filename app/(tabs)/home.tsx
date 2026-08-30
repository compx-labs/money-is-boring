import React, { type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SittingCube } from '@/components/SittingCube';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useProvider } from '@/hooks/useProvider';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { algorandAddressFromKey, findWalletAccount } from '@/lib/keystore/wallet-account';
import { truncateAddress } from '@/lib/algorand/balances';
import { colors, fonts } from '@/lib/theme';
import { Redirect, useRouter } from 'expo-router';

type IconName = ComponentProps<typeof Ionicons>['name'];

function formatBalance(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function CircleButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.circle, pressed && styles.circlePressed]}
    >
      <Ionicons name={icon} size={24} color={colors.buttonText} />
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValuePill}>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { keys, accounts } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const [copied, setCopied] = React.useState(false);
  const balances = useWalletBalances(address);

  if (!wallet || !address) {
    if (keys.length === 0) return <Redirect href="/onboarding" />;
    return <LoadingScreen />;
  }

  const onCopy = async () => {
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={onCopy}
          accessibilityRole="button"
          accessibilityLabel="Wallet address"
          style={({ pressed }) => [styles.addressPill, pressed && styles.circlePressed]}
        >
          <Text style={styles.address} numberOfLines={1}>
            {copied ? 'copied' : truncateAddress(address, 4)}
          </Text>
          <Ionicons name="chevron-down" size={21} color={colors.muted} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.screen, { paddingBottom: 24 }]}
      >
        <SittingCube size={140} />

        <View style={styles.actions}>
          <CircleButton
            icon="swap-horizontal"
            label="Swap"
            onPress={() => router.push('/swap')}
          />
          <CircleButton icon="arrow-up" label="Send" onPress={() => router.push('/send')} />
          <CircleButton icon="arrow-down" label="Receive" onPress={() => router.push('/receive')} />
        </View>

        <View style={styles.balances}>
          {balances.holdings.map((holding) => (
            <Row key={holding.id} label={holding.unit} value={formatBalance(holding.amount)} />
          ))}
        </View>

        {balances.error ? <Text style={styles.error}>couldn’t load balances</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 28,
    paddingBottom: 8,
    alignItems: 'flex-start',
  },
  addressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bg,
    borderColor: colors.line,
    borderWidth: 8,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
    maxWidth: '70%',
  },
  address: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: 21,
    fontVariant: ['tabular-nums'],
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screen: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 12,
    gap: 28,
  },
  balances: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowLabel: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: 21,
    letterSpacing: 2,
  },
  rowValuePill: {
    backgroundColor: colors.button,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  rowValue: {
    color: colors.buttonText,
    fontFamily: fonts.regular,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePressed: { opacity: 0.85 },
  error: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 26,
  },
});
