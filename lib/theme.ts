export const colors = {
  bg: '#f4f3ef',
  cream: '#f8d2c0',
  peach: '#f8d2c0',
  surface: '#ffd6ef',
  cubeTop: '#9a9a9a',
  cubeLeft: '#5c5c5c',
  cubeRight: '#787878',
  text: '#0066ff',
  muted: '#4d94ff',
  ink: '#1a1a1a',
  line: '#7eb6ff',
  button: '#ff1f8f',
  buttonText: '#ffffff',
  yellow: '#ffd400',
};

export type ColorMode = 'light' | 'dark';

export type Chrome = {
  bg: string;
  ink: string;
  tabFill: string;
};

export const CHROME: Record<ColorMode, Chrome> = {
  light: { bg: '#f4f3ef', ink: '#1a1a1a', tabFill: '#ffffff' },
  dark: { bg: '#141413', ink: '#f4f3ef', tabFill: '#1c1b19' },
};

export function isColorMode(value: string): value is ColorMode {
  return value === 'light' || value === 'dark';
}

export const ACCENT_IDS = ['pink', 'green', 'yellow', 'orange', 'black'] as const;
export type AccentId = (typeof ACCENT_IDS)[number];

export type AccentTheme = {
  id: AccentId;
  label: string;
  accent: string;
  surface: string;
  surfaceDark: string;
  onAccent: string;
  tabWash: string;
};

export const THEMES: Record<AccentId, AccentTheme> = {
  pink: {
    id: 'pink',
    label: 'Pink',
    accent: '#ff1f8f',
    surface: '#ffd6ef',
    surfaceDark: '#3d1528',
    onAccent: '#ffffff',
    tabWash: 'rgba(255, 31, 143, 0.12)',
  },
  green: {
    id: 'green',
    label: 'Neon green',
    accent: '#39ff14',
    surface: '#c8ffb8',
    surfaceDark: '#163d12',
    onAccent: '#1a1a1a',
    tabWash: 'rgba(57, 255, 20, 0.12)',
  },
  yellow: {
    id: 'yellow',
    label: 'Neon yellow',
    accent: '#eaff00',
    surface: '#f5ffb0',
    surfaceDark: '#2a2c08',
    onAccent: '#1a1a1a',
    tabWash: 'rgba(234, 255, 0, 0.18)',
  },
  orange: {
    id: 'orange',
    label: 'Neon orange',
    accent: '#ff5f00',
    surface: '#ffd4b0',
    surfaceDark: '#3a1600',
    onAccent: '#ffffff',
    tabWash: 'rgba(255, 95, 0, 0.12)',
  },
  black: {
    id: 'black',
    label: 'Black',
    accent: '#1a1a1a',
    surface: '#e6e6e6',
    surfaceDark: '#2a2a2a',
    onAccent: '#ffffff',
    tabWash: 'rgba(26, 26, 26, 0.12)',
  },
};

export function isAccentId(value: string): value is AccentId {
  return (ACCENT_IDS as readonly string[]).includes(value);
}

export function resolveAccent(id: AccentId, mode: ColorMode): AccentTheme {
  const base = THEMES[id];
  if (id === 'black' && mode === 'dark') {
    return {
      ...base,
      accent: '#ffffff',
      onAccent: '#1a1a1a',
      surface: base.surfaceDark,
      tabWash: 'rgba(255, 255, 255, 0.12)',
    };
  }
  if (mode === 'dark') {
    return { ...base, surface: base.surfaceDark };
  }
  return base;
}

/** Barlow Semi Condensed. Loaded in the root layout. */
export const fonts = {
  regular: 'BarlowSemiCondensed_400Regular',
  semibold: 'BarlowSemiCondensed_600SemiBold',
  bold: 'BarlowSemiCondensed_700Bold',
} as const;

/** Degrees from vertical. Same slant on every Chamfer. */
export const CHAMFER_DEG = 16;

const CHAMFER_SLOPE = Math.tan((CHAMFER_DEG * Math.PI) / 180);

export function chamferCut(width: number, height: number, inset = 0): number {
  const usable = Math.max(0, width - inset * 2);
  return Math.min(height * CHAMFER_SLOPE, usable * 0.45);
}

export const USDC_ASA_ID = 31566704;
export const COMPX_ASA_ID = 1732165149;
export const HAY_ASA_ID = 3160000000;
export const ALGOD_URL = 'https://mainnet-api.algonode.cloud';
/** Tinyman ASA list — icons + metadata for mainnet assets. */
export const TINYMAN_ASA_LIST_URL = 'https://asa-list.tinyman.org/assets.json';
/** ZeroSignal escrow app on Algorand mainnet. */
export const ZS_ESCROW_APP_ID = 3628061142;
/** Default in-wallet chat model (free-tier, still pay-per-call tickets). */
export const ZS_MODEL = 'glm-4.7-flash';
export const CANIX_URL = 'https://canix402-api.compx.io';
/** GoPlausible x402 facilitator — discovery + merchant branding. */
export const GOPLAUSIBLE_URL = 'https://facilitator.goplausible.xyz';
export const HAY_URL = 'https://hayrouter.txnlab.dev';
/** Published Hay free-tier key (60 req/min). Not a Canix secret. */
export const HAY_API_KEY = '1b72df7e-1131-4449-8ce1-29b79dd3f51e';
/** Hay output fee in basis points (10 = 0.10%). */
export const HAY_FEE_BPS = 10;
/** Hay slippage as a percentage (1 = 1%). */
export const HAY_SLIPPAGE_PCT = 1;
