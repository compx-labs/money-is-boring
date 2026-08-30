import { decodeUnsignedTransaction } from 'algosdk';
import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { algod } from '@/lib/algorand/client';
import { waitForConfirmation } from 'algosdk';

export type WalletlessTxn = {
  index: number;
  encodedTransaction: string;
  signedTransaction?: string;
  signer: 'user' | 'haystack';
};

function b64Bytes(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'base64'));
}

/** Sign user legs of a Canix/Hay group. Haystack members pass through unchanged. */
export async function signWalletlessGroup(
  store: Pick<KeyStoreAPI, 'sign'>,
  keyId: string,
  address: string,
  transactions: WalletlessTxn[],
  userSignIndexes: number[],
): Promise<{ blobs: Uint8Array[]; txid: string }> {
  const user = new Set(userSignIndexes);
  const blobs: Uint8Array[] = [];
  let txid = '';

  for (let i = 0; i < transactions.length; i += 1) {
    const txn = transactions[i];
    if (!user.has(i) && txn.signer !== 'user') {
      if (!txn.signedTransaction) {
        throw new Error(`Haystack member ${i} is missing a signature`);
      }
      blobs.push(b64Bytes(txn.signedTransaction));
      continue;
    }

    const decoded = decodeUnsignedTransaction(b64Bytes(txn.encodedTransaction));
    const sig = await store.sign(keyId, decoded.bytesToSign());
    blobs.push(decoded.attachSignature(address, sig));
    if (!txid) txid = decoded.txID();
  }

  if (!txid) throw new Error('Nothing for this device to sign');
  return { blobs, txid };
}

export async function submitSignedGroup(blobs: Uint8Array[], txid: string) {
  const client = algod();
  await client.sendRawTransaction(blobs).do();
  await waitForConfirmation(client, txid, 16);
}
