import React from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Chamfer } from '@/components/Chamfer';
import { HapticPressable } from '@/components/HapticPressable';
import { useSheetPalette } from '@/components/SheetScaffold';
import { useAccent } from '@/hooks/useAccent';
import { chamferCut, fonts } from '@/lib/theme';

const FACE_HEIGHT = 64;
const COMPACT_HEIGHT = 48;

/** Magenta parallelogram action — same object as the home swap/send/receive row. */
export function ChamferButton({
  label,
  onPress,
  disabled = false,
  compact = false,
  overlap = false,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  compact?: boolean;
  overlap?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { accent, onAccent } = useAccent();
  const sheet = useSheetPalette();
  const fill = sheet?.ink ?? accent;
  const labelColor = sheet ? accent : onAccent;
  return (
    <HapticPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        compact ? styles.compactPress : styles.press,
        overlap && { marginLeft: -chamferCut(Number.POSITIVE_INFINITY, compact ? COMPACT_HEIGHT : FACE_HEIGHT) },
        disabled && styles.busy,
        style,
      ]}
    >
      <Chamfer
        fill={fill}
        style={compact ? styles.compactFace : styles.face}
        contentStyle={compact ? styles.compactInner : styles.inner}
      >
        <Text
          style={[compact ? styles.compactLabel : styles.label, { color: labelColor }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Chamfer>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  press: {
    alignSelf: 'stretch',
  },
  compactPress: {
    alignSelf: 'flex-end',
  },
  busy: {
    opacity: 0.6,
  },
  face: {
    alignSelf: 'stretch',
    minHeight: FACE_HEIGHT,
  },
  inner: {
    minHeight: FACE_HEIGHT,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 28,
  },
  compactFace: {
    minHeight: COMPACT_HEIGHT,
  },
  compactInner: {
    minHeight: COMPACT_HEIGHT,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactLabel: {
    fontFamily: fonts.bold,
    fontSize: 18,
  },
});
