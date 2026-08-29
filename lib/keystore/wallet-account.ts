import { encodeAddress } from 'algosdk';
import type { Key } from '@algorandfoundation/react-native-keystore';
import type { Account } from '@algorandfoundation/accounts-store';
import type { KeystoreAccount } from '@algorandfoundation/accounts-keystore-extension';

type WalletAccount = Account | KeystoreAccount;

export function isWalletAccountKey(key: Key | undefined): key is Key {
  if (!key?.publicKey) return false;
  if (key.type === 'hd-derived-ed25519') return key.metadata?.context === 0;
  return false;
}

function publicKeyBytes(pk: unknown): Uint8Array | null {
  if (pk instanceof Uint8Array && pk.byteLength >= 32) {
    return pk.subarray(0, 32);
  }
  if (ArrayBuffer.isView(pk) && pk.byteLength >= 32) {
    return new Uint8Array(pk.buffer, pk.byteOffset, 32);
  }
  return null;
}

/** Encode the spending key as a checksummed Algorand address (not the bridge's base64 pubkey). */
export function algorandAddressFromKey(key: Key): string {
  const pk = publicKeyBytes(key.publicKey);
  if (!pk) return '';
  return encodeAddress(pk);
}

export function findWalletAccount(
  accounts: WalletAccount[],
  keys: Key[],
): { account: WalletAccount | null; key: Key } | null {
  for (const account of accounts) {
    const key = keys.find((k) => k.id === account.metadata?.keyId);
    if (isWalletAccountKey(key)) return { account, key };
  }

  const key = keys.find(isWalletAccountKey);
  if (!key) return null;
  const account = accounts.find((a) => a.metadata?.keyId === key.id) ?? null;
  return { account, key };
}
