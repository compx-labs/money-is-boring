import React, { type ComponentProps } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountMenu, type MenuAnchor } from '@/components/AccountMenu';
import { Chamfer } from '@/components/Chamfer';
import { HapticPressable } from '@/components/HapticPressable';
import { MorphIcon } from '@/components/MorphIcon';
import { SittingCube } from '@/components/SittingCube';
import { RollingNumber } from '@/components/RollingNumber';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SpringInsert } from '@/components/SpringInsert';
import { AssetRow } from '@/components/AssetRow';
import { useAccent } from '@/hooks/useAccent';
import { useNickname } from '@/hooks/useNickname';
import { useProvider } from '@/hooks/useProvider';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { useAsaIcons } from '@/hooks/useAsaIcons';
import { useFiatTotal } from '@/hooks/useFiatTotal';
import { algorandAddressFromKey, findWalletAccount } from '@/lib/keystore/wallet-account';
import { truncateAddress } from '@/lib/algorand/balances';
import { colors, fonts } from '@/lib/theme';
import { CUBE_VIEW } from '@/lib/cube/math';
import { ICON_MORPH_MS } from '@/lib/motion/icon';
import { Redirect, useRouter } from 'expo-router';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICON_HOLD_MS = ICON_MORPH_MS + 280;
const CUBE_SIZE = 140;
const CUBE_H = CUBE_SIZE * (CUBE_VIEW.height / CUBE_VIEW.width);
const SCREEN_PAD = 28;
const ACTION_HEIGHT = 48;
const ACTION_WIDTH = 120;
const ACTION_HANG = 70;
const ACTION_GAP = 4;

function formatFiat(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const { accent, onAccent } = useAccent();
  return (
    <HapticPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.actionPress}
    >
      <Chamfer fill={accent} style={styles.actionFace} contentStyle={styles.actionContent}>
        <MorphIcon name={icon} size={24} color={onAccent} bounce={icon === 'checkmark'} />
      </Chamfer>
    </HapticPressable>
  );
}

function OptInRow({ onPress }: { onPress: () => void }) {
  const { accent } = useAccent();
  return (
    <HapticPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Opt-in to more assets"
      style={styles.rowPress}
    >
      <Chamfer
        fill="none"
        stroke={accent}
        strokeWidth={2}
        strokeDasharray="8 6"
        style={styles.row}
        contentStyle={styles.optInInner}
      >
        <Text style={[styles.optInPlus, { color: accent }]}>+</Text>
      </Chamfer>
    </HapticPressable>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { keys, accounts } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const nickname = useNickname(address);
  const { accent, onAccent } = useAccent();
  const [copied, setCopied] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuAnchor, setMenuAnchor] = React.useState<MenuAnchor | null>(null);
  const pillRef = React.useRef<View>(null);
  const balances = useWalletBalances(address);
  const fiatTotal = useFiatTotal(balances.holdings);
  const icons = useAsaIcons();
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

  const onOpenMenu = () => {
    pillRef.current?.measureInWindow((x, y, width, height) => {
      setMenuAnchor({ x, y, width, height });
      setMenuOpen(true);
    });
  };

  const onViewProfile = () => {
    setMenuOpen(false);
    router.push('/profile');
  };

  const onSend = () => {
    setSent(true);
    router.push('/send');
  };

  const pillLabel = nickname ? nickname.slice(0, 10) : truncateAddress(address, 4);
  const menuLabel = copied
    ? 'Copied address'
    : nickname
      ? `${pillLabel} account menu`
      : 'Account menu';

  return (
    <View style={styles.root}>
      <AccountMenu
        visible={menuOpen}
        anchor={menuAnchor}
        onClose={() => setMenuOpen(false)}
        onViewProfile={onViewProfile}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: 24 }]}
      >
        <View style={styles.heroStage}>
          <View style={styles.hero}>
            <SittingCube size={CUBE_SIZE} scrollFriendly />
            <View ref={pillRef} collapsable={false} style={styles.addressWrap}>
              <HapticPressable
                onPress={onOpenMenu}
                onLongPress={onCopy}
                accessibilityRole="button"
                accessibilityLabel={menuLabel}
                accessibilityHint="Opens account menu. Press and hold to copy address."
              >
                <Chamfer fill={accent} contentStyle={styles.addressInner}>
                  <Text style={[styles.address, { color: onAccent }]} numberOfLines={1}>
                    {pillLabel}
                  </Text>
                  <MorphIcon
                    name={copied ? 'checkmark' : menuOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={onAccent}
                    bounce={copied}
                  />
                </Chamfer>
              </HapticPressable>
            </View>
            <View
              style={styles.fiat}
              accessible
              accessibilityRole="text"
              accessibilityLabel={
                fiatTotal == null ? 'Total loading' : `Total ${formatFiat(fiatTotal)} dollars`
              }
            >
              <Text style={[styles.fiatDollar, { color: accent }]}>$</Text>
              <RollingNumber
                value={fiatTotal}
                format={formatFiat}
                style={[styles.fiatAmount, { color: accent }]}
              />
            </View>
          </View>

          <View style={styles.actions} pointerEvents="box-none">
            <ActionButton
              icon="swap-horizontal"
              label="Swap"
              onPress={() => router.push('/swap')}
            />
            <ActionButton
              icon={sent ? 'checkmark' : 'arrow-forward'}
              label="Send"
              onPress={onSend}
            />
            <ActionButton
              icon="arrow-back"
              label="Receive"
              onPress={() => router.push('/receive')}
            />
          </View>
        </View>

        <View style={styles.balances}>
          {balances.holdings.map((holding) => (
            <SpringInsert
              key={holding.id}
              active={seenHoldings.current !== null && !seenHoldings.current.has(holding.id)}
            >
              <AssetRow label={holding.unit} value={holding.amount} icon={icons.get(holding.id)} />
            </SpringInsert>
          ))}
          <OptInRow onPress={() => router.push('/add-asset')} />
        </View>

        {balances.error ? <Text style={styles.error}>couldn’t load balances</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  addressWrap: {
    maxWidth: '70%',
  },
  addressInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  address: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screen: {
    flexGrow: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PAD,
    gap: 28,
  },
  heroStage: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: 8,
  },
  fiat: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  fiatDollar: {
    fontFamily: fonts.bold,
    fontSize: 40,
    lineHeight: 56,
    marginRight: 2,
    marginBottom: 4,
  },
  fiatAmount: {
    fontFamily: fonts.bold,
    fontSize: 56,
    lineHeight: 64,
    fontVariant: ['tabular-nums'],
  },
  balances: {
    alignSelf: 'stretch',
    paddingHorizontal: 8,
    gap: 10,
  },
  rowPress: {
    alignSelf: 'stretch',
  },
  row: {
    alignSelf: 'stretch',
  },
  optInInner: {
    minHeight: 40,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optInPlus: {
    opacity: 0.5,
    fontFamily: fonts.semibold,
    fontSize: 28,
    lineHeight: 32,
    includeFontPadding: false,
  },
  actions: {
    position: 'absolute',
    left: -SCREEN_PAD - ACTION_HANG,
    top: CUBE_H / 2,
    gap: ACTION_GAP,
    zIndex: 2,
  },
  actionPress: {
    width: ACTION_WIDTH,
  },
  actionFace: {
    height: ACTION_HEIGHT,
    width: ACTION_WIDTH,
  },
  actionContent: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 6,
  },
  error: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 26,
  },
});
