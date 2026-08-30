import { decodeAddress, encodeAddress } from 'algosdk';
import { ALGOD_URL, ZS_ESCROW_APP_ID, ZS_MODEL } from '@/lib/theme';
import { concatBytes, utf8 } from '@/lib/zerosignal/bytes';
import { verifyEphemeral, type EphemeralAdvertisement } from '@/lib/zerosignal/ticket';

const NODE_STATUS_ACTIVE = 1;
const SEED_NODES: Array<[number, number]> = [
  [1, 1],
  [1, 2],
  [1, 3],
];

export type ZsNode = {
  operatorId: number;
  nodeId: number;
  signingAddr: string;
  signingPubKey: Uint8Array;
  baseUrl: string;
  ageRecipient: string;
  protoVersion: string;
  model: string;
};

type DetailsJson = {
  operator_id?: number;
  node_id?: number;
  ephemeral_age_pubkey?: string;
  ephemeral_expiry?: number;
  ephemeral_issued_at?: number;
  ephemeral_sig?: string;
  proto_version?: string;
  models?: unknown;
};

function b64Name(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function u64be(n: number): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n), false);
  return b;
}

function nodeBoxName(operatorId: number, nodeId: number): Uint8Array {
  return concatBytes(utf8('n:'), u64be(operatorId), u64be(nodeId));
}

async function algodJson<T>(path: string): Promise<T> {
  const res = await fetch(`${ALGOD_URL}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`algod ${res.status}`);
  return (await res.json()) as T;
}

function parseNodeRecord(valueB64: string): { status: number; signingPubKey: Uint8Array; baseUrl: string } {
  const val = Uint8Array.from(Buffer.from(valueB64, 'base64'));
  if (val.length < 34 + 248) throw new Error('ZeroSignal node record too short');
  const status = val[0];
  const signingPubKey = val.subarray(1, 33);
  const urlLen = val[33];
  const baseUrl = new TextDecoder().decode(val.subarray(34, 34 + urlLen)).replace(/\0+$/, '');
  return { status, signingPubKey, baseUrl };
}

async function fetchNodeBox(operatorId: number, nodeId: number): Promise<{
  operatorId: number;
  nodeId: number;
  signingPubKey: Uint8Array;
  signingAddr: string;
  baseUrl: string;
} | null> {
  try {
    const name = b64Name(nodeBoxName(operatorId, nodeId));
    const box = await algodJson<{ value?: string }>(
      `/v2/applications/${ZS_ESCROW_APP_ID}/box?name=b64:${encodeURIComponent(name)}`,
    );
    if (!box.value) return null;
    const rec = parseNodeRecord(box.value);
    if (rec.status !== NODE_STATUS_ACTIVE || !rec.baseUrl.startsWith('https://')) return null;
    return {
      operatorId,
      nodeId,
      signingPubKey: rec.signingPubKey,
      signingAddr: encodeAddress(rec.signingPubKey),
      baseUrl: rec.baseUrl.replace(/\/+$/, ''),
    };
  } catch {
    return null;
  }
}

async function listOnChainNodes(): Promise<Array<{ operatorId: number; nodeId: number }>> {
  const listed: Array<{ operatorId: number; nodeId: number }> = [];
  try {
    const body = await algodJson<{ boxes?: { name: string }[] }>(
      `/v2/applications/${ZS_ESCROW_APP_ID}/boxes?limit=1000`,
    );
    for (const box of body.boxes ?? []) {
      const raw = Uint8Array.from(Buffer.from(box.name, 'base64'));
      if (raw.length !== 18) continue;
      if (raw[0] !== 0x6e || raw[1] !== 0x3a) continue;
      listed.push({
        operatorId: Number(new DataView(raw.buffer, raw.byteOffset + 2, 8).getBigUint64(0, false)),
        nodeId: Number(new DataView(raw.buffer, raw.byteOffset + 10, 8).getBigUint64(0, false)),
      });
    }
  } catch {
    // Seeded boxes below still run.
  }
  const seen = new Set(listed.map((n) => `${n.operatorId}:${n.nodeId}`));
  for (const [operatorId, nodeId] of SEED_NODES) {
    if (!seen.has(`${operatorId}:${nodeId}`)) listed.push({ operatorId, nodeId });
  }
  return listed;
}

function modelIds(models: unknown): string[] {
  if (!Array.isArray(models)) return [];
  return models
    .map((m) => (typeof m === 'string' ? m : m && typeof m === 'object' ? String((m as { id?: unknown }).id ?? '') : ''))
    .filter(Boolean);
}

async function probeDetails(
  chain: {
    operatorId: number;
    nodeId: number;
    signingPubKey: Uint8Array;
    signingAddr: string;
    baseUrl: string;
  },
  wantModel: string,
): Promise<ZsNode | null> {
  try {
    const res = await fetch(`${chain.baseUrl}/v1/zs/details`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const details = (await res.json()) as DetailsJson;
    if (details.operator_id !== chain.operatorId || details.node_id !== chain.nodeId) return null;
    const ids = modelIds(details.models);
    if (!ids.includes(wantModel)) return null;
    const ad: EphemeralAdvertisement = {
      ephemeral_age_pubkey: details.ephemeral_age_pubkey ?? '',
      ephemeral_expiry: details.ephemeral_expiry ?? 0,
      ephemeral_issued_at: details.ephemeral_issued_at ?? 0,
      ephemeral_sig: details.ephemeral_sig ?? '',
    };
    if (!ad.ephemeral_age_pubkey.startsWith('age1') || !ad.ephemeral_sig) return null;
    verifyEphemeral(chain.operatorId, chain.nodeId, ad, chain.signingPubKey);
    decodeAddress(chain.signingAddr);
    return {
      operatorId: chain.operatorId,
      nodeId: chain.nodeId,
      signingAddr: chain.signingAddr,
      signingPubKey: chain.signingPubKey,
      baseUrl: chain.baseUrl,
      ageRecipient: ad.ephemeral_age_pubkey,
      protoVersion: details.proto_version ?? '',
      model: wantModel,
    };
  } catch {
    return null;
  }
}

/** Find an on-chain ZeroSignal node that serves the in-wallet model. Direct HTTP, no relay. */
export async function discoverZsNode(model = ZS_MODEL): Promise<ZsNode> {
  const ids = await listOnChainNodes();
  const records = (
    await Promise.all(ids.map((id) => fetchNodeBox(id.operatorId, id.nodeId)))
  ).filter((n): n is NonNullable<typeof n> => n != null);

  const probed = await Promise.all(records.map((n) => probeDetails(n, model)));
  const hit = probed.find((n) => n != null);
  if (!hit) {
    throw new Error(`No live ZeroSignal node serving ${model}`);
  }
  return hit;
}
