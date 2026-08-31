import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Chamfer } from '@/components/Chamfer';
import { HapticPressable } from '@/components/HapticPressable';
import { layoutSpringConfig } from '@/lib/motion/layout';
import { fonts } from '@/lib/theme';
import { useAccent } from '@/hooks/useAccent';
import { useChrome } from '@/hooks/useChrome';

export type MenuAnchor = { x: number; y: number; width: number; height: number };

export function AccountMenu({
  visible,
  anchor,
  onClose,
  onViewProfile,
}: {
  visible: boolean;
  anchor: MenuAnchor | null;
  onClose: () => void;
  onViewProfile: () => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const { accent } = useAccent();
  const { bg, ink } = useChrome();
  const opacity = React.useRef(new Animated.Value(0)).current;
  const offset = React.useRef(new Animated.Value(-8)).current;
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

  React.useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      offset.setValue(-8);
      return;
    }
    if (reduceMotion) {
      opacity.setValue(1);
      offset.setValue(0);
      return;
    }
    opacity.setValue(0);
    offset.setValue(-8);
    Animated.parallel([
      Animated.spring(opacity, layoutSpringConfig(1)),
      Animated.spring(offset, layoutSpringConfig(0)),
    ]).start();
  }, [visible, reduceMotion, opacity, offset]);

  if (!visible || !anchor) return null;

  const menuWidth = Math.max(anchor.width, 220);
  const left = Math.min(Math.max(16, anchor.x), windowWidth - menuWidth - 16);
  const top = anchor.y + anchor.height + 8;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss menu"
        />
        <Animated.View
          style={[
            styles.menu,
            {
              top,
              left,
              minWidth: menuWidth,
              opacity,
              transform: [{ translateY: offset }],
            },
          ]}
        >
          <Chamfer
            fill={bg}
            stroke={accent}
            strokeWidth={2}
            style={{ minWidth: menuWidth }}
            contentStyle={styles.menuInner}
          >
            <HapticPressable
              onPress={onViewProfile}
              accessibilityRole="button"
              accessibilityLabel="View profile"
              style={styles.item}
            >
              <Text style={[styles.itemLabel, { color: ink }]}>view profile</Text>
            </HapticPressable>
            <View style={[styles.divider, { backgroundColor: accent }]} />
            <HapticPressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Switch account"
              accessibilityHint="Not available yet"
              style={styles.item}
            >
              <Text style={[styles.itemLabel, { color: ink }]}>switch account</Text>
            </HapticPressable>
          </Chamfer>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
  },
  menuInner: {
    paddingVertical: 6,
  },
  item: {
    alignSelf: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  itemLabel: {
    fontFamily: fonts.semibold,
    fontSize: 18,
  },
  divider: {
    height: 2,
    opacity: 0.35,
    marginHorizontal: 14,
  },
});
