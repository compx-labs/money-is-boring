import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';

/** BIP44 context for Algorand spending addresses. */
export const ADDRESS_CONTEXT = 0;

const ALGO_COIN_TYPE = 283;

/** Peikert BIP32-Ed25519 derivation (AC2 / Foundation default). */
export const PEIKERT_DERIVATION = 9;

export interface DerivationSlot {
  context: number;
  account?: number;
  index?: number;
}

export function bip44Path({ context, account = 0, index = 0 }: DerivationSlot): string {
  if (context !== ADDRESS_CONTEXT) {
    throw new Error(`Unknown key context: ${context}`);
  }
  return `m/44'/${ALGO_COIN_TYPE}'/${account}'/0/${index}`;
}

/**
 * Derive an Algorand spending key from the BIP32-Ed25519 root.
 * Children come from `deriveFromSeed`, not `generate` (EdDSA is not on host Subtle).
 */
export function deriveContextKey(
  store: Pick<KeyStoreAPI, 'deriveFromSeed'>,
  rootKeyId: string,
  slot: DerivationSlot,
): Promise<string> {
  if (!store.deriveFromSeed) {
    throw new Error('This keystore cannot derive HD keys: deriveFromSeed is not implemented');
  }

  const { context, account = 0, index = 0 } = slot;
  return store.deriveFromSeed(rootKeyId, bip44Path(slot), {
    algorithm: 'EdDSA',
    metadata: { context, account, index, derivation: PEIKERT_DERIVATION },
  });
}
