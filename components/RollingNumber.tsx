import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

const DURATION_MS = 460;
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

function defaultFormat(value: number): string {
  if (value === 0) return '0';
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function isVisualZero(value: number, formatted: string): boolean {
  if (value === 0) return true;
  return !/[1-9]/.test(formatted);
}

function RollingGlyph({
  char,
  height,
  width,
  textStyle,
  animate,
}: {
  char: string;
  height: number;
  width: number;
  textStyle: TextStyle;
  animate: boolean;
}) {
  const digit = /^\d$/.test(char);
  const n = digit ? Number(char) : 0;
  const y = React.useRef(new Animated.Value(animate ? 0 : -n * height)).current;

  React.useLayoutEffect(() => {
    if (!digit) return;
    const to = -n * height;
    if (!animate) {
      y.setValue(to);
      return;
    }
    const motion = Animated.timing(y, {
      toValue: to,
      duration: DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    motion.start();
    return () => motion.stop();
  }, [animate, digit, height, n, y]);

  if (!digit) {
    return <Text style={[textStyle, { height, lineHeight: height }]}>{char}</Text>;
  }

  return (
    <View style={{ height, width, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateY: y }] }}>
        {DIGITS.map((d) => (
          <Text
            key={d}
            style={[textStyle, { height, lineHeight: height, width, textAlign: 'center' }]}
          >
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * Money figures tick/roll into a new value. A value that stays 0 does not
 * move. First paint snaps so opening the wallet does not count up from zero.
 */
export function RollingNumber({
  value,
  format = defaultFormat,
  placeholder = '—',
  style,
}: {
  value: number | null;
  format?: (value: number) => string;
  placeholder?: string;
  style?: StyleProp<TextStyle>;
}) {
  const flat = StyleSheet.flatten(style) ?? {};
  const fontSize = typeof flat.fontSize === 'number' ? flat.fontSize : 16;
  const height = typeof flat.lineHeight === 'number' ? flat.lineHeight : Math.round(fontSize * 1.2);
  const digitWidth = Math.ceil(fontSize * 0.66);
  const display = value == null ? placeholder : format(value);

  const prevValue = React.useRef<number | null | undefined>(undefined);
  const prevDisplay = React.useRef<string | undefined>(undefined);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (alive) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  React.useLayoutEffect(() => {
    prevValue.current = value;
    prevDisplay.current = display;
  }, [display, value]);

  const hadNumber = prevValue.current != null;
  const stayedZero =
    value != null &&
    isVisualZero(value, display) &&
    (prevValue.current == null || isVisualZero(prevValue.current, prevDisplay.current ?? '0'));
  const animate =
    value != null &&
    hadNumber &&
    prevDisplay.current !== display &&
    !stayedZero &&
    !reduceMotion;

  const textStyle: TextStyle = {
    ...flat,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  };

  if (value == null) {
    return (
      <Text style={style} accessibilityLabel={placeholder}>
        {placeholder}
      </Text>
    );
  }

  return (
    <View accessible accessibilityRole="text" accessibilityLabel={display} style={styles.row}>
      {[...display].map((char, i) => (
        <RollingGlyph
          key={display.length - 1 - i}
          char={char}
          height={height}
          width={digitWidth}
          textStyle={textStyle}
          animate={animate}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
