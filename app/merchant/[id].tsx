import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SheetScaffold } from '@/components/SheetScaffold';
import { useChrome } from '@/hooks/useChrome';
import { getCachedMerchant, loadX402Merchant, type X402Merchant } from '@/lib/x402/merchants';
import { colors, fonts } from '@/lib/theme';

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
  const { bg } = useChrome();
  const [logoFailed, setLogoFailed] = React.useState(false);

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
});
