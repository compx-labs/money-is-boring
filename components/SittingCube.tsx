import React from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Polygon } from 'react-native-svg';
import { CUBE_VIEW, projectCube } from '@/lib/cube/math';
import { tick } from '@/lib/motion/haptics';
import { LAYOUT_SPRING } from '@/lib/motion/layout';
import { pressOutSpring } from '@/lib/motion/press';

const YAW_PER_PX = 0.012;
const FRICTION = 3.2;
const SETTLE_VEL = 0.4;
const REST_EPS = 0.002;
const POKE_SQUASH_VEL = -7.5;
const POKE_YAW_VEL = 2.4;
const DT_CAP = 1 / 30;

type Pose = {
  yaw: number;
  yawVel: number;
  squash: number;
  squashVel: number;
  dragging: boolean;
  settling: boolean;
};

const REST: Pose = {
  yaw: 0,
  yawVel: 0,
  squash: 1,
  squashVel: 0,
  dragging: false,
  settling: false,
};

function wrapPi(angle: number): number {
  const x = ((angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  return x - Math.PI;
}

function atRest(p: Pose): boolean {
  return (
    !p.dragging &&
    Math.abs(p.yaw) < REST_EPS &&
    Math.abs(p.yawVel) < REST_EPS &&
    Math.abs(p.squash - 1) < REST_EPS &&
    Math.abs(p.squashVel) < REST_EPS
  );
}

/**
 * Isometric cube you can spin (horizontal drag) and poke (tap).
 * Springs back to the sitting pose. SVG projection, no GL.
 */
export function SittingCube({
  size = 160,
  scrollFriendly = false,
}: {
  size?: number;
  scrollFriendly?: boolean;
}) {
  const w = size;
  const h = size * (CUBE_VIEW.height / CUBE_VIEW.width);
  const pose = React.useRef<Pose>({ ...REST });
  const dragStartYaw = React.useRef(0);
  const raf = React.useRef<number | null>(null);
  const lastTs = React.useRef<number | null>(null);
  const [faces, setFaces] = React.useState(() => projectCube(0, 1));
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

  const paint = React.useCallback(() => {
    const p = pose.current;
    setFaces(projectCube(p.yaw, p.squash));
  }, []);

  const stopLoop = React.useCallback(() => {
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    lastTs.current = null;
  }, []);

  const startLoop = React.useCallback(() => {
    if (raf.current != null) return;
    lastTs.current = null;
    const step = (ts: number) => {
      const p = pose.current;
      const prev = lastTs.current;
      lastTs.current = ts;
      const dt = prev == null ? 1 / 60 : Math.min((ts - prev) / 1000, DT_CAP);

      if (!p.dragging) {
        if (p.settling) {
          const acc =
            (-LAYOUT_SPRING.stiffness * p.yaw - LAYOUT_SPRING.damping * p.yawVel) /
            LAYOUT_SPRING.mass;
          p.yawVel += acc * dt;
          p.yaw += p.yawVel * dt;
        } else {
          p.yawVel *= Math.exp(-FRICTION * dt);
          p.yaw += p.yawVel * dt;
          if (Math.abs(p.yawVel) < SETTLE_VEL) {
            p.yaw = wrapPi(p.yaw);
            p.settling = true;
          }
        }
      }

      const squashAcc =
        (-pressOutSpring.stiffness * (p.squash - 1) - pressOutSpring.damping * p.squashVel) /
        pressOutSpring.mass;
      p.squashVel += squashAcc * dt;
      p.squash += p.squashVel * dt;

      if (atRest(p)) {
        pose.current = { ...REST };
        paint();
        raf.current = null;
        lastTs.current = null;
        return;
      }

      paint();
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, [paint]);

  React.useEffect(() => () => stopLoop(), [stopLoop]);

  React.useEffect(() => {
    if (!reduceMotion) return;
    stopLoop();
    pose.current = { ...REST };
    paint();
  }, [paint, reduceMotion, stopLoop]);

  const poke = React.useCallback(() => {
    tick();
    if (reduceMotion) return;
    const p = pose.current;
    p.squashVel += POKE_SQUASH_VEL;
    p.yawVel += Math.random() < 0.5 ? -POKE_YAW_VEL : POKE_YAW_VEL;
    p.settling = false;
    startLoop();
  }, [reduceMotion, startLoop]);

  const gesture = React.useMemo(() => {
    const tap = Gesture.Tap().maxDistance(12).onEnd((_e, success) => {
      if (success) poke();
    });

    if (reduceMotion) return tap;

    const pan = Gesture.Pan()
      .maxPointers(1)
      .onStart(() => {
        const p = pose.current;
        p.dragging = true;
        p.settling = false;
        p.yawVel = 0;
        dragStartYaw.current = p.yaw;
      })
      .onUpdate((e) => {
        pose.current.yaw = dragStartYaw.current + e.translationX * YAW_PER_PX;
        paint();
      })
      .onEnd((e) => {
        const p = pose.current;
        p.dragging = false;
        if (Math.abs(e.translationX) < 12 && Math.abs(e.velocityX) < 80) {
          poke();
          return;
        }
        p.yawVel = e.velocityX * YAW_PER_PX;
        p.settling = false;
        startLoop();
      })
      .onFinalize(() => {
        const p = pose.current;
        if (!p.dragging) return;
        p.dragging = false;
        p.settling = false;
        startLoop();
      });

    if (scrollFriendly) {
      pan.activeOffsetX([-12, 12]).failOffsetY([-16, 16]);
    }

    return Gesture.Exclusive(pan, tap);
  }, [paint, poke, reduceMotion, scrollFriendly, startLoop]);

  return (
    <GestureHandlerRootView style={{ width: w, height: h }}>
      <GestureDetector gesture={gesture}>
        <View
          collapsable={false}
          style={[styles.hit, { width: w, height: h }]}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Sitting cube"
          accessibilityHint="Pokes the cube. Drag sideways to spin."
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'activate') poke();
          }}
        >
          <Svg
            width={w}
            height={h}
            viewBox={`0 0 ${CUBE_VIEW.width} ${CUBE_VIEW.height}`}
            pointerEvents="none"
          >
            {faces.map((face) => (
              <Polygon key={face.id} points={face.points} fill={face.fill} />
            ))}
          </Svg>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
