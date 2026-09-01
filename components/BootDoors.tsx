import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Line, Polygon } from 'react-native-svg';
import { SittingCube } from '@/components/SittingCube';
import { useAccent } from '@/hooks/useAccent';
import { layoutSpringConfig } from '@/lib/motion/layout';
import { CHAMFER_DEG } from '@/lib/theme';

const SEAM_WIDTH = 6;
const MIN_DWELL_MS = 720;
const CUBE_SIZE = 160;
const SLOPE = Math.tan((CHAMFER_DEG * Math.PI) / 180);

function doorCut(height: number): number {
  return height * SLOPE;
}

/**
 * Cold-start overlay: two 16° chamfered doors in the accent colour, seam, spinning cube.
 * Springs apart to reveal the app once `open` is true.
 */
export function BootDoors({
  open,
  onLaidOut,
  onOpened,
}: {
  open: boolean;
  onLaidOut?: () => void;
  onOpened: () => void;
}) {
  const { accent, onAccent } = useAccent();
  const window = useWindowDimensions();
  const [box, setBox] = React.useState({ width: 0, height: 0 });
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const [opening, setOpening] = React.useState(false);
  const shownAt = React.useRef(Date.now());
  const played = React.useRef(false);
  const laidOut = React.useRef(false);
  const onLaidOutRef = React.useRef(onLaidOut);
  const onOpenedRef = React.useRef(onOpened);
  const leftX = React.useRef(new Animated.Value(0)).current;
  const rightX = React.useRef(new Animated.Value(0)).current;
  const fade = React.useRef(new Animated.Value(1)).current;

  onLaidOutRef.current = onLaidOut;
  onOpenedRef.current = onOpened;

  const width = box.width || window.width;
  const height = box.height || window.height;

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

  const notifyLaidOut = React.useCallback((w: number, h: number) => {
    if (laidOut.current || w < 1 || h < 1) return;
    laidOut.current = true;
    onLaidOutRef.current?.();
  }, []);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setBox((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    notifyLaidOut(w, h);
  };

  React.useEffect(() => {
    notifyLaidOut(width, height);
  }, [height, notifyLaidOut, width]);

  React.useEffect(() => {
    if (!open || played.current || width < 1 || height < 1) return;

    if (reduceMotion) {
      played.current = true;
      onOpenedRef.current();
      return;
    }

    const wait = Math.max(0, MIN_DWELL_MS - (Date.now() - shownAt.current));
    const timer = setTimeout(() => {
      played.current = true;
      setOpening(true);
      const travel = width / 2 + doorCut(height);
      Animated.parallel([
        Animated.spring(leftX, layoutSpringConfig(-travel)),
        Animated.spring(rightX, layoutSpringConfig(travel)),
        Animated.spring(fade, layoutSpringConfig(0)),
      ]).start(({ finished }) => {
        if (finished) onOpenedRef.current();
      });
    }, wait);

    return () => clearTimeout(timer);
  }, [fade, height, leftX, open, reduceMotion, rightX, width]);

  const cut = doorCut(height);
  const leftW = width / 2 + cut / 2;
  const rightW = width / 2 + cut / 2;
  const rightLeft = width / 2 - cut / 2;

  return (
    <View
      style={styles.overlay}
      onLayout={onLayout}
      pointerEvents={opening ? 'none' : 'auto'}
      accessibilityViewIsModal
      accessibilityLabel="Loading"
    >
      <Animated.View
        style={[
          styles.door,
          { left: 0, width: leftW, height, transform: [{ translateX: leftX }] },
        ]}
      >
        <Svg width={leftW} height={height}>
          <Polygon
            points={`0,0 ${leftW},0 ${leftW - cut},${height} 0,${height}`}
            fill={accent}
          />
          <Line
            x1={leftW}
            y1={0}
            x2={leftW - cut}
            y2={height}
            stroke={onAccent}
            strokeWidth={SEAM_WIDTH}
            strokeLinecap="butt"
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          styles.door,
          {
            left: rightLeft,
            width: rightW,
            height,
            transform: [{ translateX: rightX }],
          },
        ]}
      >
        <Svg width={rightW} height={height}>
          <Polygon
            points={`${cut},0 ${rightW},0 ${rightW},${height} 0,${height}`}
            fill={accent}
          />
          <Line
            x1={cut}
            y1={0}
            x2={0}
            y2={height}
            stroke={onAccent}
            strokeWidth={SEAM_WIDTH}
            strokeLinecap="butt"
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.cube, { opacity: fade }]} pointerEvents="none">
        <SittingCube size={CUBE_SIZE} spin />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 20,
  },
  door: {
    position: 'absolute',
    top: 0,
  },
  cube: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
