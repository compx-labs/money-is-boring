import {
  assignGroupID,
  decodeUnsignedTransaction,
  makeApplicationOptInTxnFromObject,
  makeAssetTransferTxnWithSuggestedParamsFromObject,
  waitForConfirmation,
} from 'algosdk';
import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { algod } from '@/lib/algorand/client';
import type { HayTxn } from '@/lib/hay/router';

/** Hay serializes Uint8Array as `{ "0": n, "1": n, ... }`. Do not use Object.values (lexicographic keys). */
export function bytesFromHayJson(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) return Uint8Array.from(value);
  if (typeof value === 'string') return Uint8Array.from(Buffer.from(value, 'base64'));
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (rec.type === 'Buffer' && Array.isArray(rec.data)) {
      return Uint8Array.from(rec.data as number[]);
    }
    const n = Object.keys(rec).length;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i += 1) {
      const b = rec[i] ?? rec[String(i)];
      if (typeof b !== 'number') throw new Error('Malformed Hay byte object');
      out[i] = b;
    }
    return out;
  }
  throw new Error('Unusable Hay bytes');
}

function haystackBlob(txn: HayTxn): Uint8Array | null {
  if (txn.logicSigBlob === false || txn.logicSigBlob == null) return null;
  return bytesFromHayJson(txn.logicSigBlob);
}

/** Sign user legs of a Hay group. Haystack members (logicSigBlob) pass through. */
export async function signHayGroup(
  store: Pick<KeyStoreAPI, 'sign'>,
  keyId: string,
  address: string,
  transactions: HayTxn[],
): Promise<{ blobs: Uint8Array[]; txid: string }> {
  const blobs: Uint8Array[] = [];
  let txid = '';

  for (const txn of transactions) {
    const ready = haystackBlob(txn);
    if (ready) {
      blobs.push(ready);
      continue;
    }

    const decoded = decodeUnsignedTransaction(bytesFromHayJson(txn.data));
    const sig = await store.sign(keyId, decoded.bytesToSign());
    blobs.push(decoded.attachSignature(address, sig));
    if (!txid) txid = decoded.txID();
  }

  if (!txid) throw new Error('Nothing for this device to sign');
  return { blobs, txid };
}

export async function signAndSubmitAssetOptIn(
  store: Pick<KeyStoreAPI, 'sign'>,
  keyId: string,
  address: string,
  assetId: number,
): Promise<void> {
  const client = algod();
  const suggestedParams = await client.getTransactionParams().do();
  const txn = makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    amount: 0,
    assetIndex: assetId,
    suggestedParams,
  });
  const sig = await store.sign(keyId, txn.bytesToSign());
  await submitSignedGroup([txn.attachSignature(address, sig)], txn.txID());
}

export async function signAndSubmitAppOptIns(
  store: Pick<KeyStoreAPI, 'sign'>,
  keyId: string,
  address: string,
  appIds: number[],
): Promise<void> {
  if (appIds.length === 0) return;
  const client = algod();
  const suggestedParams = await client.getTransactionParams().do();
  const txns = appIds.map((appIndex) =>
    makeApplicationOptInTxnFromObject({ sender: address, appIndex, suggestedParams }),
  );
  if (txns.length > 1) assignGroupID(txns);

  const blobs: Uint8Array[] = [];
  let txid = '';
  for (const txn of txns) {
    const sig = await store.sign(keyId, txn.bytesToSign());
    blobs.push(txn.attachSignature(address, sig));
    if (!txid) txid = txn.txID();
  }
  await submitSignedGroup(blobs, txid);
}

export async function submitSignedGroup(blobs: Uint8Array[], txid: string) {
  const client = algod();
  await client.sendRawTransaction(blobs).do();
  await waitForConfirmation(client, txid, 16);
}
