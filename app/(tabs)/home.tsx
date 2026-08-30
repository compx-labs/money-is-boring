import React, { type ComponentProps } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HapticPressable } from '@/components/HapticPressable';
import { MorphIcon } from '@/components/MorphIcon';
import { SittingCube } from '@/components/SittingCube';
import { RollingNumber } from '@/components/RollingNumber';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SpringInsert } from '@/components/SpringInsert';
import { useProvider } from '@/hooks/useProvider';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { algorandAddressFromKey, findWalletAccount } from '@/lib/keystore/wallet-account';
import { truncateAddress } from '@/lib/algorand/balances';
import { colors, fonts } from '@/lib/theme';
import { ICON_MORPH_MS } from '@/lib/motion/icon';
import { Redirect, useRouter } from 'expo-router';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICON_HOLD_MS = ICON_MORPH_MS + 280;

function formatBalance(value: number): string {
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
    <HapticPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.circle}
    >
      <MorphIcon name={icon} size={24} color={colors.buttonText} bounce={icon === 'checkmark'} />
    </HapticPressable>
  );
}

function Row({ label, value }: { label: string; value: number | null }) {
  return (
    <HapticPressable accessibilityRole="button" accessibilityLabel={label} style={styles.row}>
      <View style={styles.rowInner}>
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.rowValuePill}>
          <RollingNumber value={value} format={formatBalance} style={styles.rowValue} />
        </View>
      </View>
    </HapticPressable>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { keys, accounts } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const [copied, setCopied] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const balances = useWalletBalances(address);
  const seenHoldings = React.useRef<Set<number> | null>(null);

  React.useLayoutEffect(() => {
    if (seenHoldings.current === null) {
      seenHoldings.current = new Set(balances.holdings.map((h) => h.id));
    }
  }, [balances.holdings]);

  React.useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), ICON_HOLD_MS);
    return () => clearTimeout(id);
  }, [copied]);

  React.useEffect(() => {
    if (!sent) return;
    const id = setTimeout(() => setSent(false), ICON_HOLD_MS);
    return () => clearTimeout(id);
  }, [sent]);

  if (!wallet || !address) {
    if (keys.length === 0) return <Redirect href="/onboarding" />;
    return <LoadingScreen />;
  }

  const onCopy = async () => {
    await Clipboard.setStringAsync(address);
    setCopied(true);
  };

  const onSend = () => {
    setSent(true);
    router.push('/send');
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <HapticPressable
          onPress={onCopy}
          accessibilityRole="button"
          accessibilityLabel={copied ? 'Copied address' : 'Copy address'}
          style={styles.addressPill}
        >
          <Text style={styles.address} numberOfLines={1}>
            {truncateAddress(address, 4)}
          </Text>
          <Ionicons name="chevron-down" size={21} color={colors.muted} />
        </HapticPressable>
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
          <CircleButton
            icon={sent ? 'checkmark' : 'arrow-up'}
            label="Send"
            onPress={onSend}
          />
          <CircleButton icon="arrow-down" label="Receive" onPress={() => router.push('/receive')} />
        </View>

        <View style={styles.balances}>
          {balances.holdings.map((holding) => (
            <SpringInsert
              key={holding.id}
              active={seenHoldings.current !== null && !seenHoldings.current.has(holding.id)}
            >
              <Row label={holding.unit} value={holding.amount} />
            </SpringInsert>
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
    borderWidth: 2,
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
    alignSelf: 'stretch',
  },
  rowInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 40,
  },
  rowLabel: {
    color: colors.muted,
    fontFamily: fonts.semibold,
    fontSize: 21,
    lineHeight: 24,
    letterSpacing: 2,
    flexShrink: 1,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  rowValuePill: {
    backgroundColor: colors.button,
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  rowValue: {
    color: colors.buttonText,
    fontFamily: fonts.regular,
    fontSize: 20,
    lineHeight: 24,
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
  error: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 26,
  },
});
