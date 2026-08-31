import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { AssetRow } from '@/components/AssetRow';
import { LoadingScreen } from '@/components/LoadingScreen';
import { SheetScaffold } from '@/components/SheetScaffold';
import { useAccent } from '@/hooks/useAccent';
import { useAsaIcons } from '@/hooks/useAsaIcons';
import { useProvider } from '@/hooks/useProvider';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { TOP_ASSETS } from '@/lib/algorand/assets';
import { algorandAddressFromKey, findWalletAccount } from '@/lib/keystore/wallet-account';
import { signAndSubmitAssetOptIn } from '@/lib/algorand/submit';
import { colors, fonts } from '@/lib/theme';

function AddAssetBody() {
  const { keys, accounts, key } = useProvider();
  const wallet = findWalletAccount(accounts, keys);
  const address = wallet ? algorandAddressFromKey(wallet.key) : '';
  const { accent } = useAccent();
  const balances = useWalletBalances(address);
  const icons = useAsaIcons();
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [error, setError] = React.useState('');

  const opted = React.useMemo(
    () => new Set(balances.holdings.map((h) => h.id)),
    [balances.holdings],
  );

  if (!wallet || !address) {
    if (keys.length === 0) return <Redirect href="/onboarding" />;
    return <LoadingScreen />;
  }

  const onSelect = async (assetId: number, unit: string) => {
    if (opted.has(assetId) || busyId != null) return;
    setError('');
    setBusyId(assetId);
    try {
      await signAndSubmitAssetOptIn(key.store, wallet.key.id, address, assetId);
      balances.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : `couldn’t add ${unit}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={[styles.title, { color: accent }]}>add asset</Text>
      <View style={styles.list}>
        {TOP_ASSETS.map((asset) => {
          const holding = balances.holdings.find((h) => h.id === asset.id);
          const isOptedIn = opted.has(asset.id);
          return (
            <AssetRow
              key={asset.id}
              label={asset.unit}
              value={holding?.amount ?? null}
              icon={icons.get(asset.id)}
              optedIn={isOptedIn}
              disabled={busyId != null}
              onPress={() => onSelect(asset.id, asset.unit)}
            />
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export default function AddAsset() {
  return (
    <SheetScaffold>
      <AddAssetBody />
    </SheetScaffold>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 28,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 44,
  },
  list: {
    alignSelf: 'stretch',
    paddingHorizontal: 8,
    gap: 10,
  },
  error: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 26,
  },
});
