import { decodeUnsignedTransaction } from 'algosdk';
import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { bytesFromHayJson, submitSignedGroup } from '@/lib/algorand/submit';
import { signWithAc2 } from '@/lib/keystore/ac2';
import { b64Decode } from '@/lib/zerosignal/bytes';

export type CanixMember = {
  index: number;
  unsigned: Uint8Array;
  signed?: Uint8Array;
  signer: 'user' | 'other';
};

export type CanixGroup = {
  members: CanixMember[];
  userSignIndexes: number[];
};

function asIndexList(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((n): n is number => typeof n === 'number' && n >= 0);
}

function memberBytes(txn: Record<string, unknown>): {
  unsigned: Uint8Array;
  signed?: Uint8Array;
} {
  if (typeof txn.encodedTransaction === 'string') {
    const unsigned = b64Decode(txn.encodedTransaction);
    const signed =
      typeof txn.signedTransaction === 'string' ? b64Decode(txn.signedTransaction) : undefined;
    return { unsigned, signed };
  }
  if (txn.data != null) {
    const unsigned = bytesFromHayJson(txn.data);
    const signed =
      txn.logicSigBlob != null && txn.logicSigBlob !== false
        ? bytesFromHayJson(txn.logicSigBlob)
        : undefined;
    return { unsigned, signed };
  }
  throw new Error('Canix group member has no transaction bytes');
}

/** Parse a Walletless / Hay / encoded Canix group. Null if this object is not a group. */
export function parseCanixGroup(raw: unknown): CanixGroup | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;

  if (Array.isArray(rec.encodedTransactions) && rec.encodedTransactions.length > 0) {
    const encoded = rec.encodedTransactions.filter((x): x is string => typeof x === 'string');
    if (encoded.length === 0) return null;
    const userSignIndexes = asIndexList(
      rec.userSignIndexes,
      encoded.map((_, i) => i),
    );
    return {
      userSignIndexes,
      members: encoded.map((b64, i) => ({
        index: i,
        unsigned: b64Decode(b64),
        signer: userSignIndexes.includes(i) ? 'user' : 'other',
      })),
    };
  }

  if (!Array.isArray(rec.transactions) || rec.transactions.length === 0) return null;
  const txns = rec.transactions.filter((t): t is Record<string, unknown> => !!t && typeof t === 'object');
  if (txns.length === 0) return null;
  const first = txns[0];
  if (typeof first.encodedTransaction !== 'string' && first.data == null) return null;

  const members: CanixMember[] = txns.map((txn, i) => {
    const { unsigned, signed } = memberBytes(txn);
    const haystack = txn.signer === 'haystack' || signed != null;
    return {
      index: typeof txn.index === 'number' ? txn.index : i,
      unsigned,
      signed,
      signer: haystack ? 'other' : 'user',
    };
  });
  const userSignIndexes = asIndexList(
    rec.userSignIndexes,
    members.filter((m) => m.signer === 'user').map((m) => m.index),
  );
  for (const m of members) {
    if (userSignIndexes.includes(m.index)) m.signer = 'user';
    else if (m.signer === 'user' && userSignIndexes.length > 0) m.signer = 'other';
  }
  return { members, userSignIndexes };
}

function fingerprint(group: CanixGroup): string {
  return Buffer.from(group.members[0].unsigned.subarray(0, 32)).toString('base64');
}

const GROUP_KEYS = ['quotes', 'steps', 'groups', 'data', 'optIn', 'swap', 'enter', 'group', 'quote'] as const;

/** Walk a Canix JSON payload and collect unsigned groups in document order. */
export function collectCanixGroups(root: unknown): CanixGroup[] {
  const out: CanixGroup[] = [];
  const seen = new Set<string>();

  const add = (group: CanixGroup | null) => {
    if (!group || group.members.length === 0) return;
    const key = fingerprint(group);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(group);
  };

  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 8) return;
    add(parseCanixGroup(node));
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    const rec = node as Record<string, unknown>;
    for (const key of GROUP_KEYS) {
      if (key in rec) visit(rec[key], depth + 1);
    }
  };

  visit(root, 0);
  return out;
}

/** Sign user legs with AC2, keep Haystack / pre-signed members, submit locally. */
export async function signAndSubmitCanixGroup(input: {
  store: Pick<KeyStoreAPI, 'sign'>;
  keyId: string;
  address: string;
  group: CanixGroup;
}): Promise<{ txid: string }> {
  const { store, keyId, address, group } = input;
  const blobs: Uint8Array[] = [];
  let txid = '';

  for (const member of group.members) {
    const needsUser = group.userSignIndexes.includes(member.index) || member.signer === 'user';
    if (!needsUser) {
      if (!member.signed) throw new Error('Canix group member is not for this wallet and is unsigned');
      blobs.push(member.signed);
      continue;
    }
    const decoded = decodeUnsignedTransaction(member.unsigned);
    const sig = await signWithAc2(store, keyId, decoded.bytesToSign());
    blobs.push(decoded.attachSignature(address, sig));
    if (!txid) txid = decoded.txID();
  }

  if (!txid) throw new Error('Nothing for this device to sign');
  await submitSignedGroup(blobs, txid);
  return { txid };
}
