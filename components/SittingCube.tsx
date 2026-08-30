import Svg, { Polygon } from 'react-native-svg';
import { colors } from '@/lib/theme';

/**
 * Handmade isometric cube. Static. No 3D pipeline.
 * All 2D edges share one length so the silhouette is a regular hexagon
 * (a cube from the default isometric camera), not a flat slab.
 */
export function SittingCube({ size = 160 }: { size?: number }) {
  const w = size;
  const h = size * (136 / 120);
  return (
    <Svg width={w} height={h} viewBox="0 0 120 136" accessibilityLabel="A sitting gray cube">
      <Polygon points="60,8 112,38 60,68 8,38" fill={colors.cubeTop} />
      <Polygon points="8,38 60,68 60,128 8,98" fill={colors.cubeLeft} />
      <Polygon points="60,68 112,38 112,98 60,128" fill={colors.cubeRight} />
    </Svg>
  );
}
