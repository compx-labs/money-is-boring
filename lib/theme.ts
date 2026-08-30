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

/** Barlow Semi Condensed. Loaded in the root layout. */
export const fonts = {
  regular: 'BarlowSemiCondensed_400Regular',
  semibold: 'BarlowSemiCondensed_600SemiBold',
  bold: 'BarlowSemiCondensed_700Bold',
} as const;

/** Right-leaning parallelogram cut, as a fraction of width. No rounding. */
export const CHAMFER = 0.1;

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
export const HAY_URL = 'https://hayrouter.txnlab.dev';
/** Published Hay free-tier key (60 req/min). Not a Canix secret. */
export const HAY_API_KEY = '1b72df7e-1131-4449-8ce1-29b79dd3f51e';
/** Hay output fee in basis points (10 = 0.10%). */
export const HAY_FEE_BPS = 10;
/** Hay slippage as a percentage (1 = 1%). */
export const HAY_SLIPPAGE_PCT = 1;
