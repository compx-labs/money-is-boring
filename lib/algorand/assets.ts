import { COMPX_ASA_ID, HAY_ASA_ID, USDC_ASA_ID } from '@/lib/theme';

export type CatalogAsset = {
  id: number;
  unit: string;
  decimals: number;
};

/** Curated mainnet ASAs shown in the add-asset sheet. Expand later. */
export const TOP_ASSETS: CatalogAsset[] = [
  { id: USDC_ASA_ID, unit: 'USDC', decimals: 6 },
  { id: COMPX_ASA_ID, unit: 'COMPX', decimals: 6 },
  { id: HAY_ASA_ID, unit: 'HAY', decimals: 6 },
];
