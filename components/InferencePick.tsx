import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Chamfer } from '@/components/Chamfer';
import { HapticPressable } from '@/components/HapticPressable';
import { MorphIcon } from '@/components/MorphIcon';
import { useSheetPalette } from '@/components/SheetScaffold';
import { useAccent } from '@/hooks/useAccent';
import { useChrome } from '@/hooks/useChrome';
import { fonts } from '@/lib/theme';

export type InferenceChoice = 'zerosignal' | 'qvac';

const OPTIONS: {
  id: InferenceChoice;
  title: string;
  description: string;
}[] = [
  {
    id: 'zerosignal',
    title: 'ZeroSignal.ai',
    description:
      'Privacy focussed cloud inference provider. Choose from multiple models and pay per call in USDC directly from your wallet.',
  },
  {
    id: 'qvac',
    title: 'QVAC',
    description: 'Local only. Use your phone for inference, no data leaves your device.',
  },
];

export function InferencePick({
  value,
  onChange,
}: {
  value: InferenceChoice | null;
  onChange: (id: InferenceChoice) => void;
}) {
  const { accent } = useAccent();
  const { ink } = useChrome();
  const sheet = useSheetPalette();
  const fill = sheet?.ink ?? ink;

  return (
    <View style={styles.list}>
      {OPTIONS.map((option) => {
        const selected = value === option.id;
        return (
          <HapticPressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="button"
            accessibilityLabel={option.title}
            accessibilityState={{ selected }}
            style={styles.rowPress}
          >
            <Chamfer fill={fill} style={styles.row} contentStyle={styles.rowInner}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, { color: selected ? accent : ink }]}>
                  {option.title}
                </Text>
                {selected ? (
                  <MorphIcon name="checkmark" size={20} color={accent} bounce />
                ) : null}
              </View>
              <Text style={[styles.description, { color: ink }]}>{option.description}</Text>
            </Chamfer>
          </HapticPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
  },
  rowPress: {
    alignSelf: 'stretch',
  },
  row: {
    alignSelf: 'stretch',
  },
  rowInner: {
    paddingLeft: 14,
    paddingRight: 14,
    paddingVertical: 12,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 20,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
});
