import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AssetIcon } from '@/components/AssetIcon';
import { Chamfer } from '@/components/Chamfer';
import { HapticPressable } from '@/components/HapticPressable';
import { useAccent } from '@/hooks/useAccent';
import { useChrome } from '@/hooks/useChrome';
import { colors, fonts } from '@/lib/theme';
import type { X402Merchant } from '@/lib/x402/merchants';

export function MerchantRow({
  merchant,
  onPress,
}: {
  merchant: X402Merchant;
  onPress: () => void;
}) {
  const { accent } = useAccent();
  const { bg, ink } = useChrome();
  return (
    <HapticPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${merchant.name}. ${merchant.description}`}
      style={styles.wrap}
    >
      <Chamfer
        fill={bg}
        stroke={accent}
        strokeWidth={2}
        style={styles.row}
        contentStyle={styles.rowInner}
      >
        <AssetIcon unit={merchant.name} uri={merchant.logo} />
        <View style={styles.copy}>
          <Text style={[styles.name, { color: ink }]} numberOfLines={1}>
            {merchant.name}
          </Text>
          <View style={styles.divider} />
          <Text style={[styles.description, { color: ink }]} numberOfLines={3}>
            {merchant.description}
          </Text>
        </View>
      </Chamfer>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
  },
  row: {
    alignSelf: 'stretch',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 104,
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 16,
    gap: 14,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 2,
    includeFontPadding: false,
  },
  divider: {
    height: 1,
    width: '20%',
    backgroundColor: colors.cubeTop,
    opacity: 0.45,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
  },
});
