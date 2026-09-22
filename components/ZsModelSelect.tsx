import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Chamfer } from '@/components/Chamfer';
import { HapticPressable } from '@/components/HapticPressable';
import { MorphIcon } from '@/components/MorphIcon';
import { useSheetPalette } from '@/components/SheetScaffold';
import { useAccent } from '@/hooks/useAccent';
import { useChrome } from '@/hooks/useChrome';
import { orderModels } from '@/lib/zerosignal/discover';
import { fonts } from '@/lib/theme';

export function ZsModelSelect({
  value,
  models,
  loading = false,
  error = false,
  onChange,
}: {
  value: string;
  models: string[];
  loading?: boolean;
  error?: boolean;
  onChange: (id: string) => void;
}) {
  const { accent } = useAccent();
  const { ink } = useChrome();
  const sheet = useSheetPalette();
  const fill = sheet?.ink ?? ink;
  const hint = sheet?.ink ?? ink;
  const [open, setOpen] = React.useState(false);
  const ordered = orderModels(models, value);

  return (
    <View style={styles.wrap}>
      <HapticPressable
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={`Model ${value}`}
        accessibilityState={{ expanded: open }}
        accessibilityHint="Opens the ZeroSignal model list"
        style={styles.rowPress}
      >
        <Chamfer fill={fill} style={styles.row} contentStyle={styles.triggerInner}>
          <Text style={[styles.title, { color: ink }]} numberOfLines={1}>
            {value}
          </Text>
          <MorphIcon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={ink} />
        </Chamfer>
      </HapticPressable>
      {open ? (
        <View style={styles.list}>
          {ordered.map((id) => {
            const selected = id === value;
            return (
              <HapticPressable
                key={id}
                onPress={() => {
                  onChange(id);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityLabel={id}
                accessibilityState={{ selected }}
                style={styles.rowPress}
              >
                <Chamfer fill={fill} style={styles.row} contentStyle={styles.optionInner}>
                  <Text
                    style={[styles.title, { color: selected ? accent : ink }]}
                    numberOfLines={1}
                  >
                    {id}
                  </Text>
                  {selected ? <MorphIcon name="checkmark" size={20} color={accent} bounce /> : null}
                </Chamfer>
              </HapticPressable>
            );
          })}
        </View>
      ) : null}
      <Text
        style={[styles.hint, { color: hint }]}
        accessibilityLiveRegion="polite"
      >
        {loading ? 'loading models' : error ? 'couldn’t load models' : ' '}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    gap: 8,
  },
  list: {
    gap: 10,
  },
  rowPress: {
    alignSelf: 'stretch',
  },
  row: {
    alignSelf: 'stretch',
  },
  triggerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 14,
    paddingVertical: 12,
  },
  optionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 14,
    paddingVertical: 12,
  },
  title: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 20,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 22,
  },
});
