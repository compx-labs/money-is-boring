import React from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { G, Line, Polygon } from 'react-native-svg';
import { chamferCut } from '@/lib/theme';
import { useAccent } from '@/hooks/useAccent';

const SHADOW_PAD = 8;
const SHADOW_X = 3;
const SHADOW_Y = 4;

function numericPad(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function leftEdge(width: number, height: number, inset = 0): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} {
  const cut = chamferCut(width, height, inset);
  const i = inset;
  return { x1: cut + i, y1: i, x2: i, y2: height - i };
}

function parallelogramPoints(width: number, height: number, inset = 0): string {
  const cut = chamferCut(width, height, inset);
  const i = inset;
  return `${cut + i},${i} ${width - i},${i} ${width - cut - i},${height - i} ${i},${height - i}`;
}

/** Clip the outer parallelogram into equal-width columns so icons and highlights share the same slots. */
function segmentPoints(width: number, height: number, count: number, index: number): string {
  const cut = chamferCut(width, height);
  const x0 = (width / count) * index;
  const x1 = (width / count) * (index + 1);
  const topLeft = Math.max(x0, cut);
  const topRight = Math.min(x1, width);
  const botLeft = Math.max(x0, 0);
  const botRight = Math.min(x1, width - cut);
  return `${topLeft},0 ${topRight},0 ${botRight},${height} ${botLeft},${height}`;
}

/** Right-leaning parallelogram face. Slant is a fixed angle from vertical; corners are cut, not rounded. */
export function Chamfer({
  children,
  fill,
  stroke,
  strokeWidth = 0,
  strokeDasharray,
  strokeEdge = 'all',
  shadow = false,
  segments,
  activeSegment,
  activeFill,
  contentInset = true,
  style,
  contentStyle,
}: {
  children?: React.ReactNode;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string | number;
  strokeEdge?: 'all' | 'left';
  shadow?: boolean;
  segments?: number;
  activeSegment?: number;
  activeFill?: string;
  contentInset?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { accent } = useAccent();
  const [box, setBox] = React.useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  const flat = StyleSheet.flatten(style) ?? {};
  const inner = StyleSheet.flatten(contentStyle) ?? {};
  const padL = numericPad(inner.paddingLeft ?? inner.paddingHorizontal ?? inner.padding);
  const padR = numericPad(inner.paddingRight ?? inner.paddingHorizontal ?? inner.padding);
  // Padding must not track measured height — wrapping text would grow the cut,
  // add inset, wrap again, and loop (Maximum update depth). SVG still uses full height.
  const cut =
    contentInset && box.width > 0 ? chamferCut(box.width, Math.min(box.height || 48, 48)) : 0;

  const face = (
    <View style={style} onLayout={onLayout}>
      {box.width > 0 && box.height > 0 ? (
        <Svg
          pointerEvents="none"
          width={box.width + (shadow ? SHADOW_PAD : 0)}
          height={box.height + (shadow ? SHADOW_PAD : 0)}
          style={styles.svg}
        >
          {shadow ? (
            <G opacity={0.18} transform={`translate(${SHADOW_X}, ${SHADOW_Y})`}>
              <Polygon points={parallelogramPoints(box.width, box.height)} fill={accent} />
            </G>
          ) : null}
          <Polygon
            points={parallelogramPoints(box.width, box.height, strokeWidth / 2)}
            fill={fill}
          />
          {segments != null &&
          activeSegment != null &&
          activeSegment >= 0 &&
          activeFill ? (
            <Polygon
              points={segmentPoints(box.width, box.height, segments, activeSegment)}
              fill={activeFill}
            />
          ) : null}
          {stroke && strokeWidth ? (
            strokeEdge === 'left' ? (
              <Line
                {...leftEdge(box.width, box.height, strokeWidth / 2)}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeLinecap="butt"
              />
            ) : (
              <Polygon
                points={parallelogramPoints(box.width, box.height, strokeWidth / 2)}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeLinejoin="miter"
              />
            )
          ) : null}
        </Svg>
      ) : null}
      <View
        style={[
          styles.content,
          contentStyle,
          contentInset ? { paddingLeft: padL + cut, paddingRight: padR + cut } : null,
        ]}
      >
        {children}
      </View>
    </View>
  );

  if (!shadow) return face;

  return (
    <View style={[styles.shadowClip, { alignSelf: flat.alignSelf, flex: flat.flex }]}>{face}</View>
  );
}

const styles = StyleSheet.create({
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  content: {
    zIndex: 1,
  },
  shadowClip: {
    overflow: 'hidden',
    paddingRight: SHADOW_PAD,
    paddingBottom: SHADOW_PAD,
    marginRight: -SHADOW_PAD,
    marginBottom: -SHADOW_PAD,
  },
});
