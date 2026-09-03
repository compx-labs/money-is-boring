import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useStore } from '@tanstack/react-store';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Chamfer } from '@/components/Chamfer';
import { HapticPressable } from '@/components/HapticPressable';
import { SheetScaffold } from '@/components/SheetScaffold';
import { useAccent } from '@/hooks/useAccent';
import { useChrome } from '@/hooks/useChrome';
import { compileMerchantSuite } from '@/lib/agent/http-tools';
import { getCachedMerchant, loadX402Merchant, type X402Merchant } from '@/lib/x402/merchants';
import { colors, fonts } from '@/lib/theme';
import { agentToolsStore, setLoadedSuite } from '@/stores/agent-tools';

const LOGO = 64;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatVolume(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSettles(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function Stat({ label, value }: { label: string; value: string }) {
  const { bg } = useChrome();
  return (
    <View style={styles.stat} accessible accessibilityRole="text" accessibilityLabel={`${label} ${value}`}>
      <Text style={[styles.statLabel, { color: bg }]}>{label}</Text>
      <Text style={[styles.statValue, { color: bg }]}>{value}</Text>
    </View>
  );
}

function MerchantBody({ merchant }: { merchant: X402Merchant }) {
  const { bg, ink } = useChrome();
  const { accent } = useAccent();
  const suite = useStore(agentToolsStore, (state) => state);
  const live = suite?.merchantId === merchant.id;
  const [logoFailed, setLogoFailed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [loadError, setLoadError] = React.useState('');

  const onLoad = async () => {
    if (busy) return;
    setBusy(true);
    setLoadError('');
    try {
      setLoadedSuite(await compileMerchantSuite(merchant));
    } catch (e) {
      setLoadError(e instanceof Error && e.message === 'no tools listed' ? 'no tools listed' : 'couldn’t load tools');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.logoWrap} accessibilityIgnoresInvertColors>
          {logoFailed ? (
            <Text style={styles.logoLetter}>{(merchant.name.charAt(0) || '?').toUpperCase()}</Text>
          ) : (
            <Image
              source={{ uri: merchant.logo }}
              style={styles.logo}
              onError={() => setLogoFailed(true)}
            />
          )}
        </View>
        <Text style={[styles.name, { color: bg }]}>{merchant.name}</Text>
        <HapticPressable
          onPress={() => {
            void onLoad();
          }}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={live ? 'Agent loaded' : 'Load agent'}
          accessibilityState={{ selected: live, busy }}
          style={[styles.loadPress, busy && styles.loadBusy]}
        >
          <Chamfer
            fill={bg}
            stroke={live ? accent : undefined}
            strokeWidth={live ? 2 : 0}
            style={styles.loadFace}
            contentStyle={styles.loadInner}
          >
            <MaterialCommunityIcons name="robot-outline" size={20} color={live ? accent : ink} />
          </Chamfer>
        </HapticPressable>
      </View>

      <Text style={[styles.description, { color: bg }]}>{merchant.description}</Text>

      {merchant.url ? (
        <Text style={[styles.url, { color: bg }]} numberOfLines={1}>
          {merchant.url}
        </Text>
      ) : null}

      <View style={styles.stats}>
        {merchant.firstSeen != null ? (
          <Stat label="first seen" value={formatDate(merchant.firstSeen)} />
        ) : null}
        {merchant.lastSeen != null ? (
          <Stat label="last seen" value={formatDate(merchant.lastSeen)} />
        ) : null}
        {merchant.settles != null ? (
          <Stat label="settles" value={formatSettles(merchant.settles)} />
        ) : null}
        {merchant.volume != null ? (
          <Stat label="volume" value={formatVolume(merchant.volume)} />
        ) : null}
      </View>

      {loadError ? <Text style={[styles.error, { color: bg }]}>{loadError}</Text> : null}
    </View>
  );
}

export default function MerchantSheet() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const cached = id ? getCachedMerchant(id) : undefined;
  const [merchant, setMerchant] = React.useState<X402Merchant | null>(cached ?? null);
  const [error, setError] = React.useState(false);
  const { bg } = useChrome();

  React.useEffect(() => {
    if (!id || cached) return;
    let alive = true;
    loadX402Merchant(id)
      .then((next) => {
        if (alive) setMerchant(next);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [cached, id]);

  return (
    <SheetScaffold>
      {merchant ? (
        <MerchantBody merchant={merchant} />
      ) : (
        <View style={styles.screen}>
          <Text style={[styles.meta, { color: bg }]}>{error ? 'couldn’t load merchant' : 'loading'}</Text>
        </View>
      )}
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: 'transparent',
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 16,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logoWrap: {
    width: LOGO,
    height: LOGO,
    borderRadius: LOGO / 2,
    backgroundColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  logo: {
    width: LOGO,
    height: LOGO,
  },
  logoLetter: {
    color: colors.buttonText,
    fontFamily: fonts.semibold,
    fontSize: 28,
    lineHeight: 32,
  },
  name: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 1,
  },
  loadPress: {
    width: 72,
    height: 44,
    justifyContent: 'center',
    marginRight: -8,
    flexShrink: 0,
  },
  loadFace: {
    width: 72,
    height: 32,
  },
  loadInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadBusy: {
    opacity: 0.6,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 26,
  },
  url: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  stats: {
    gap: 10,
    paddingTop: 8,
  },
  stat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 16,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 24,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 26,
    lineHeight: 36,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
});
