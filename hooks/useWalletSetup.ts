import { useCallback } from 'react';
import { getRandomValues } from 'react-native-quick-crypto';
import { useProvider } from '@/hooks/useProvider';
import { bootstrap } from '@/lib/keystore/bootstrap';
import { ADDRESS_CONTEXT, deriveContextKey } from '@/lib/keystore/hd-keys';
import { importSeed } from '@/lib/keystore/seed';

function randomSeed(bytes: number): Uint8Array {
  const seed = new Uint8Array(bytes);
  getRandomValues(seed);
  return seed;
}

function wipe(buf: Uint8Array) {
  buf.fill(0);
}

export function useWalletSetup() {
  const { key, account } = useProvider();

  const createWallet = useCallback(async () => {
    await key.store.clear();
    await account.store.clear();

    const seed = randomSeed(64);
    let seedId: string;
    try {
      seedId = await importSeed(key.store, seed);
    } finally {
      wipe(seed);
    }

    const rootKeyId = await key.store.generate({
      type: 'hd-root-key',
      algorithm: 'raw',
      extractable: true,
      keyUsages: ['deriveKey', 'deriveBits'],
      params: { parentKeyId: seedId },
    });

    await deriveContextKey(key.store, rootKeyId, { context: ADDRESS_CONTEXT });
    await bootstrap();
  }, [key, account]);

  return { createWallet };
}
