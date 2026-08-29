import Svg, { Polygon } from 'react-native-svg';
import { colors } from '@/lib/theme';

/** Handmade isometric sitting cube. Static. No 3D pipeline. */
export function SittingCube({ size = 160 }: { size?: number }) {
  const w = size;
  const h = size * 0.92;
  return (
    <Svg width={w} height={h} viewBox="0 0 120 110" accessibilityLabel="A sitting gray cube">
      <Polygon points="60,8 112,38 60,68 8,38" fill={colors.cubeTop} />
      <Polygon points="8,38 60,68 60,102 8,72" fill={colors.cubeLeft} />
      <Polygon points="60,68 112,38 112,72 60,102" fill={colors.cubeRight} />
    </Svg>
  );
}
