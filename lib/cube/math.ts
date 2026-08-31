import { colors } from '@/lib/theme';

/** SVG viewBox that matches the original handmade cube. */
export const CUBE_VIEW = { width: 120, height: 136 } as const;

const HALF = 0.5;
const COS30 = Math.sqrt(3) / 2;
const EDGE = 60;
const ORIGIN_X = 60;
const ORIGIN_Y = 68;

/** Camera sits in −X +Y −Z, so rest pose shows top, left (−X), right (−Z). */
const VIEW = normalize(-1, 1, -1);

/**
 * World light tuned so rest-pose Lambert hits cubeTop / cubeLeft / cubeRight.
 * Left is darkest, top lightest, right in between on that lerp.
 */
const LAMBERT_LEFT = 0.25;
const LAMBERT_TOP = 1;
const T_RIGHT =
  (gray(colors.cubeRight) - gray(colors.cubeLeft)) /
  (gray(colors.cubeTop) - gray(colors.cubeLeft));
const LAMBERT_RIGHT = LAMBERT_LEFT + T_RIGHT * (LAMBERT_TOP - LAMBERT_LEFT);
const LIGHT = { x: -LAMBERT_LEFT, y: LAMBERT_TOP, z: -LAMBERT_RIGHT };

type Vec3 = { x: number; y: number; z: number };

type Face = {
  id: string;
  normal: Vec3;
  corners: readonly [Vec3, Vec3, Vec3, Vec3];
};

const FACES: readonly Face[] = [
  {
    id: 'py',
    normal: { x: 0, y: 1, z: 0 },
    corners: [
      { x: -HALF, y: HALF, z: -HALF },
      { x: HALF, y: HALF, z: -HALF },
      { x: HALF, y: HALF, z: HALF },
      { x: -HALF, y: HALF, z: HALF },
    ],
  },
  {
    id: 'ny',
    normal: { x: 0, y: -1, z: 0 },
    corners: [
      { x: -HALF, y: -HALF, z: HALF },
      { x: HALF, y: -HALF, z: HALF },
      { x: HALF, y: -HALF, z: -HALF },
      { x: -HALF, y: -HALF, z: -HALF },
    ],
  },
  {
    id: 'px',
    normal: { x: 1, y: 0, z: 0 },
    corners: [
      { x: HALF, y: -HALF, z: -HALF },
      { x: HALF, y: -HALF, z: HALF },
      { x: HALF, y: HALF, z: HALF },
      { x: HALF, y: HALF, z: -HALF },
    ],
  },
  {
    id: 'nx',
    normal: { x: -1, y: 0, z: 0 },
    corners: [
      { x: -HALF, y: -HALF, z: HALF },
      { x: -HALF, y: -HALF, z: -HALF },
      { x: -HALF, y: HALF, z: -HALF },
      { x: -HALF, y: HALF, z: HALF },
    ],
  },
  {
    id: 'pz',
    normal: { x: 0, y: 0, z: 1 },
    corners: [
      { x: -HALF, y: -HALF, z: HALF },
      { x: -HALF, y: HALF, z: HALF },
      { x: HALF, y: HALF, z: HALF },
      { x: HALF, y: -HALF, z: HALF },
    ],
  },
  {
    id: 'nz',
    normal: { x: 0, y: 0, z: -1 },
    corners: [
      { x: HALF, y: -HALF, z: -HALF },
      { x: HALF, y: HALF, z: -HALF },
      { x: -HALF, y: HALF, z: -HALF },
      { x: -HALF, y: -HALF, z: -HALF },
    ],
  },
];

export type ProjectedFace = {
  id: string;
  points: string;
  fill: string;
};

/** Rotate around Y, squash toward the camera, project visible faces far-to-near. */
export function projectCube(yaw: number, squash: number): ProjectedFace[] {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const out: (ProjectedFace & { depth: number })[] = [];

  for (const face of FACES) {
    const normal = rotateY(face.normal, cos, sin);
    if (dot(normal, VIEW) <= 0) continue;

    const corners = face.corners.map((p) => {
      const spun = rotateY(p, cos, sin);
      return squashAlong(spun, VIEW, squash);
    });
    const depth =
      (dot(corners[0], VIEW) +
        dot(corners[1], VIEW) +
        dot(corners[2], VIEW) +
        dot(corners[3], VIEW)) /
      4;

    out.push({
      id: face.id,
      points: corners.map(projectIso).join(' '),
      fill: shade(dot(normal, LIGHT)),
      depth,
    });
  }

  out.sort((a, b) => a.depth - b.depth);
  return out.map(({ id, points, fill }) => ({ id, points, fill }));
}

function rotateY(p: Vec3, cos: number, sin: number): Vec3 {
  return {
    x: p.x * cos - p.z * sin,
    y: p.y,
    z: p.x * sin + p.z * cos,
  };
}

function squashAlong(p: Vec3, axis: Vec3, s: number): Vec3 {
  const k = (s - 1) * dot(p, axis);
  return { x: p.x + k * axis.x, y: p.y + k * axis.y, z: p.z + k * axis.z };
}

function projectIso(p: Vec3): string {
  const sx = (p.x - p.z) * COS30;
  const sy = -(p.y + (p.x + p.z) * 0.5);
  return `${ORIGIN_X + sx * EDGE},${ORIGIN_Y + sy * EDGE}`;
}

function shade(lambert: number): string {
  const t = clamp(
    (lambert - LAMBERT_LEFT) / (LAMBERT_TOP - LAMBERT_LEFT),
    0,
    1,
  );
  return lerpHex(colors.cubeLeft, colors.cubeTop, t);
}

function lerpHex(a: string, b: string, t: number): string {
  const ca = hexRgb(a);
  const cb = hexRgb(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bch = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `#${toHex(r)}${toHex(g)}${toHex(bch)}`;
}

function hexRgb(hex: string): [number, number, number] {
  const n = hex.startsWith('#') ? hex.slice(1) : hex;
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, '0');
}

function gray(hex: string): number {
  return hexRgb(hex)[0];
}

function normalize(x: number, y: number, z: number): Vec3 {
  const len = Math.hypot(x, y, z);
  return { x: x / len, y: y / len, z: z / len };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
