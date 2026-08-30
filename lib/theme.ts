export const colors = {
  bg: '#ffffff',
  surface: '#f2f2f2',
  cubeTop: '#9a9a9a',
  cubeLeft: '#5c5c5c',
  cubeRight: '#787878',
  text: '#333333',
  muted: '#6a6a6a',
  line: '#e0e0e0',
  button: '#333333',
  buttonText: '#ffffff',
};

/** Nunito — rounded sans. Loaded in the root layout. */
export const fonts = {
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
} as const;

export const USDC_ASA_ID = 31566704;
export const ALGOD_URL = 'https://mainnet-api.algonode.cloud';
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
