import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { fetchHaySwapTxns, neededAppOptIns, quoteHaySwap, type HayQuote } from '@/lib/hay/router';
import { signAndSubmitAppOptIns, signHayGroup, submitSignedGroup } from '@/lib/algorand/submit';

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
  const apps = await neededAppOptIns(address, quote.requiredAppOptIns ?? []);
  if (apps.length > 0) {
    input.onStatus?.('opting in');
    await signAndSubmitAppOptIns(store, keyId, address, apps);
    input.onStatus?.('quoting');
    quote = await quoteHaySwap({
      address,
      fromAssetId: quote.fromASAID,
      toAssetId: quote.toASAID,
      amount: quote.amount,
    });
  }

  input.onStatus?.('building swap');
  const txns = await fetchHaySwapTxns(address, quote);
  input.onStatus?.('signing');
  const signed = await signHayGroup(store, keyId, address, txns);
  input.onStatus?.('submitting');
  await submitSignedGroup(signed.blobs, signed.txid);
}
