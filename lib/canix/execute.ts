import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { hayOptIns, haySwapGroup, quoteHaySwap, type HayQuote } from '@/lib/canix/hay';
import { signWalletlessGroup, submitSignedGroup } from '@/lib/algorand/submit';

export async function executeHaySwap(input: {
  store: Pick<KeyStoreAPI, 'sign'>;
  keyId: string;
  address: string;
  quote: HayQuote;
  onStatus?: (step: string) => void;
}): Promise<void> {
  const { store, keyId, address } = input;
  let quote = input.quote;

  input.onStatus?.('checking opt-ins');
  const opt = await hayOptIns(address, quote);
  if (opt.required && opt.transactions.length > 0) {
    input.onStatus?.('opting in');
    const signed = await signWalletlessGroup(
      store,
      keyId,
      address,
      opt.transactions,
      opt.userSignIndexes.length ? opt.userSignIndexes : opt.transactions.map((_, i) => i),
    );
    await submitSignedGroup(signed.blobs, signed.txid);
    input.onStatus?.('quoting');
    quote = await quoteHaySwap({
      address,
      fromAssetId: Number(quote.fromAssetId),
      toAssetId: Number(quote.toAssetId),
      amount: quote.amount,
    });
  }

  input.onStatus?.('building swap');
  const group = await haySwapGroup(store, keyId, address, quote);
  input.onStatus?.('signing');
  const signed = await signWalletlessGroup(
    store,
    keyId,
    address,
    group.transactions,
    group.userSignIndexes,
  );
  input.onStatus?.('submitting');
  await submitSignedGroup(signed.blobs, signed.txid);
}
