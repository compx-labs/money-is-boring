import type { Key, KeyStoreAPI } from '@algorandfoundation/react-native-keystore';

export const SEED_KEY_TYPE = 'seed';

const SEED_TYPES = [SEED_KEY_TYPE, 'hd-seed'];

export function findSeed(keys: Key[]): Key | undefined {
  return keys.find((k) => SEED_TYPES.includes(k.type));
}

export function importSeed(
  store: Pick<KeyStoreAPI, 'import' | 'importSeed'>,
  seed: Uint8Array,
): Promise<string> {
  if (store.importSeed) return store.importSeed(seed);

  return store.import(
    {
      type: SEED_KEY_TYPE,
      algorithm: 'raw',
      extractable: true,
      keyUsages: ['deriveKey', 'deriveBits'],
      privateKey: seed,
    },
    'bytes',
  );
}
