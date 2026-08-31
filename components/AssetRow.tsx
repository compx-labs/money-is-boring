import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Chamfer } from '@/components/Chamfer';
import { HapticPressable } from '@/components/HapticPressable';
import { AssetIcon } from '@/components/AssetIcon';
import { RollingNumber } from '@/components/RollingNumber';
import { useAccent } from '@/hooks/useAccent';
import { useChrome } from '@/hooks/useChrome';
import { fonts } from '@/lib/theme';

function formatBalance(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function AssetRow({
  label,
  value,
  icon,
  optedIn = true,
  onPress,
  disabled = false,
}: {
  label: string;
  value?: number | null;
  icon: string | undefined;
  optedIn?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { accent } = useAccent();
  const { bg, ink } = useChrome();
  return (
    <HapticPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={optedIn ? label : `Add ${label}`}
      accessibilityState={{ disabled, selected: optedIn }}
      style={styles.rowPress}
    >
      <Chamfer
        fill={bg}
        stroke={accent}
        strokeWidth={6}
        strokeDasharray={optedIn ? undefined : '8 6'}
        strokeEdge="left"
        style={styles.row}
        contentStyle={styles.rowInner}
      >
        <View style={styles.rowLeft}>
          <AssetIcon unit={label} uri={icon} />
          <Text style={[styles.rowLabel, { color: ink }]}>{label}</Text>
        </View>
        {optedIn ? (
          <RollingNumber
            value={value ?? null}
            format={formatBalance}
            style={[styles.rowValue, { color: ink }]}
          />
        ) : null}
      </Chamfer>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  rowPress: {
    alignSelf: 'stretch',
  },
  row: {
    alignSelf: 'stretch',
  },
  rowInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 20,
    gap: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexShrink: 1,
  },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 20,
    letterSpacing: 2,
    flexShrink: 1,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  rowValue: {
    fontFamily: fonts.bold,
    fontSize: 36,
    lineHeight: 40,
    fontVariant: ['tabular-nums'],
  },
});
