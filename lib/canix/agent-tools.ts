import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { canixRequest } from '@/lib/canix/client';
import {
  collectCanixGroups,
  parseCanixGroup,
  signAndSubmitCanixGroup,
  type CanixGroup,
} from '@/lib/canix/groups';
import { HAY_SLIPPAGE_PCT } from '@/lib/theme';

export type AgentToolContext = {
  store: Pick<KeyStoreAPI, 'sign'>;
  keyId: string;
  address: string;
  onStatus?: (step: string) => void;
};

type PendingHay = {
  kind: 'hay-quote';
  quote: Record<string, unknown>;
  slippage: number;
  optInsDone: boolean;
};

type PendingGroups = {
  kind: 'groups';
  groups: CanixGroup[];
  summary: string;
};

type PendingSpend = PendingHay | PendingGroups;

const pending = new Map<string, PendingSpend>();
let pendingSeq = 0;

function stashId(): string {
  pendingSeq += 1;
  return `p${pendingSeq.toString(36)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Canix returned an unexpected payload');
  }
  return value as Record<string, unknown>;
}

function unwrapData(json: unknown): unknown {
  if (json && typeof json === 'object' && 'data' in json) {
    return (json as { data: unknown }).data;
  }
  return json;
}

function num(value: unknown, label: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  throw new Error(`Missing ${label}`);
}

function str(value: unknown, label: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new Error(`Missing ${label}`);
}

function trimOpportunity(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  const shapes = Array.isArray(o.executionShapes)
    ? (o.executionShapes as Record<string, unknown>[])
        .map((s) => (typeof s.shapeKey === 'string' ? s.shapeKey : null))
        .filter((s): s is string => !!s)
    : undefined;
  return {
    id: o.opportunityId ?? o.id,
    protocol: o.protocol,
    type: o.opportunityType,
    pair: o.assetPair,
    apy: o.apy ?? o.apr,
    tvlUsd: o.tvlUsd,
    executionReady: o.executionReady,
    assetIds: o.assetIds,
    shapes,
  };
}

function quoteSummary(quote: Record<string, unknown>): Record<string, unknown> {
  return {
    fromAssetId: quote.fromAssetId,
    toAssetId: quote.toAssetId,
    amount: quote.amount,
    quotedAmount: quote.quotedAmount,
    usdIn: quote.usdIn,
    usdOut: quote.usdOut,
    userPriceImpact: quote.userPriceImpact,
    expiresAt: quote.expiresAt,
    requiredAppOptIns: quote.requiredAppOptIns,
  };
}

function composeSummary(data: Record<string, unknown>, groupCount: number): Record<string, unknown> {
  return {
    opportunityId: data.opportunityId,
    protocol: data.protocol,
    pair: data.assetPair,
    fromAssetId: data.fromAssetId,
    toAssetId: data.toAssetId,
    inputAmount: data.inputAmount,
    enterAmount: data.enterAmount,
    expiresAt: data.expiresAt,
    warnings: data.warnings,
    expectedPositionDelta: data.expectedPositionDelta,
    unsignedGroups: groupCount,
  };
}

export const AGENT_CANIX_TOOLS = [
  {
    type: 'function',
    name: 'canix_opportunities',
    description:
      'List Canix DeFi opportunities (APY, TVL, shape keys). Paid from the wallet USDC balance. Does not spend beyond the research fee and never submits transactions.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 20, description: 'How many rows to return. Default 8.' },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'canix_hay_quote',
    description:
      'Fetch a Canix Haystack swap quote (unsigned; not submitted). Amount is integer base units. Stash the quote and return a pendingId. Call approve_canix_spend only after the user wants this swap.',
    parameters: {
      type: 'object',
      required: ['fromAssetId', 'toAssetId', 'amount'],
      properties: {
        fromAssetId: { type: 'integer', minimum: 0, description: 'Input ASA id; 0 is ALGO.' },
        toAssetId: { type: 'integer', minimum: 0, description: 'Output ASA id; 0 is ALGO.' },
        amount: { type: 'string', description: 'Input amount in base units, integer string.' },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'canix_compose',
    description:
      'Compose unsigned Canix groups to enter an opportunity (opt-in → Haystack swap inside the quote → enter). Canix never submits. Returns a pendingId. Call approve_canix_spend only after the user wants this enter.',
    parameters: {
      type: 'object',
      required: ['opportunityId', 'fromAssetId', 'amount'],
      properties: {
        opportunityId: { type: 'string' },
        fromAssetId: { type: 'integer', minimum: 0 },
        amount: { type: 'string', description: 'Input amount in base units, integer string.' },
        slippage: { type: 'number', minimum: 0, maximum: 100, description: 'Percent. Default 1.' },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'canix_execution_quote',
    description:
      'Compile one Canix execution shape into unsigned groups. Canix never submits. Returns a pendingId. Call approve_canix_spend only after the user wants this action.',
    parameters: {
      type: 'object',
      required: ['shapeKey', 'input'],
      properties: {
        shapeKey: { type: 'string' },
        input: { type: 'object', additionalProperties: true },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'approve_canix_spend',
    description:
      'Ask the user to approve on this phone (AC2), then this device signs user legs and submits via algod. Canix does not submit. Never claim a spend landed unless this returns a transaction id.',
    parameters: {
      type: 'object',
      required: ['pendingId'],
      properties: {
        pendingId: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
] as const;

async function opportunities(ctx: AgentToolContext, args: Record<string, unknown>) {
  const limit = Math.min(20, Math.max(1, typeof args.limit === 'number' ? args.limit : 8));
  ctx.onStatus?.('approve on this device');
  const { json, paidMicro } = await canixRequest<unknown>({
    store: ctx.store,
    keyId: ctx.keyId,
    address: ctx.address,
    path: `/opportunities?limit=${limit}`,
  });
  const data = unwrapData(json);
  const rows = Array.isArray(data)
    ? data
    : json && typeof json === 'object' && Array.isArray((json as { opportunities?: unknown }).opportunities)
      ? (json as { opportunities: unknown[] }).opportunities
      : [];
  return {
    paidMicro,
    body: {
      paidMicro: paidMicro.toString(),
      opportunities: rows.map(trimOpportunity).filter((r): r is Record<string, unknown> => !!r),
    },
  };
}

async function hayQuote(ctx: AgentToolContext, args: Record<string, unknown>) {
  const fromAssetId = num(args.fromAssetId, 'fromAssetId');
  const toAssetId = num(args.toAssetId, 'toAssetId');
  const amount = str(args.amount, 'amount');
  const { json, paidMicro } = await canixRequest<unknown>({
    store: ctx.store,
    keyId: ctx.keyId,
    address: ctx.address,
    path: '/swaps/quote',
    method: 'POST',
    body: {
      address: ctx.address,
      fromAssetId,
      toAssetId,
      amount,
      type: 'fixed-input',
    },
  });
  const quote = asRecord(unwrapData(json));
  const pendingId = stashId();
  pending.set(pendingId, { kind: 'hay-quote', quote, slippage: HAY_SLIPPAGE_PCT, optInsDone: false });
  return {
    paidMicro,
    body: {
      pendingId,
      paidMicro: paidMicro.toString(),
      quote: quoteSummary(quote),
      next: 'Call approve_canix_spend with this pendingId after the user wants the swap. The phone will prompt.',
    },
  };
}

async function compose(ctx: AgentToolContext, args: Record<string, unknown>) {
  ctx.onStatus?.('approve on this device');
  const { json, paidMicro } = await canixRequest<unknown>({
    store: ctx.store,
    keyId: ctx.keyId,
    address: ctx.address,
    path: '/execution/compose',
    method: 'POST',
    body: {
      address: ctx.address,
      opportunityId: str(args.opportunityId, 'opportunityId'),
      fromAssetId: num(args.fromAssetId, 'fromAssetId'),
      amount: str(args.amount, 'amount'),
      slippage: typeof args.slippage === 'number' ? args.slippage : HAY_SLIPPAGE_PCT,
    },
  });
  const data = asRecord(unwrapData(json));
  const groups = collectCanixGroups(json);
  if (groups.length === 0) {
    return {
      paidMicro,
      body: {
        paidMicro: paidMicro.toString(),
        error: 'Canix returned no unsigned groups',
        summary: composeSummary(data, 0),
      },
    };
  }
  const pendingId = stashId();
  pending.set(pendingId, {
    kind: 'groups',
    groups,
    summary: `compose ${String(data.opportunityId)} · ${groups.length} groups`,
  });
  return {
    paidMicro,
    body: {
      pendingId,
      paidMicro: paidMicro.toString(),
      summary: composeSummary(data, groups.length),
      next: 'Call approve_canix_spend with this pendingId after the user wants this enter. The phone will prompt.',
    },
  };
}

async function executionQuote(ctx: AgentToolContext, args: Record<string, unknown>) {
  const shapeKey = str(args.shapeKey, 'shapeKey');
  const input =
    args.input && typeof args.input === 'object' && !Array.isArray(args.input)
      ? (args.input as Record<string, unknown>)
      : null;
  if (!input) throw new Error('Missing input');
  ctx.onStatus?.('approve on this device');
  const { json, paidMicro } = await canixRequest<unknown>({
    store: ctx.store,
    keyId: ctx.keyId,
    address: ctx.address,
    path: '/execution/quotes',
    method: 'POST',
    body: { quotes: [{ shapeKey, input }] },
  });
  const groups = collectCanixGroups(json);
  if (groups.length === 0) {
    return {
      paidMicro,
      body: { paidMicro: paidMicro.toString(), error: 'Canix returned no unsigned groups' },
    };
  }
  const pendingId = stashId();
  pending.set(pendingId, { kind: 'groups', groups, summary: `quote ${shapeKey} · ${groups.length} groups` });
  return {
    paidMicro,
    body: {
      pendingId,
      paidMicro: paidMicro.toString(),
      shapeKey,
      unsignedGroups: groups.length,
      next: 'Call approve_canix_spend with this pendingId after the user wants this action. The phone will prompt.',
    },
  };
}

async function refreshHayQuote(
  ctx: AgentToolContext,
  quote: Record<string, unknown>,
): Promise<{ quote: Record<string, unknown>; paidMicro: bigint }> {
  const { json, paidMicro } = await canixRequest<unknown>({
    store: ctx.store,
    keyId: ctx.keyId,
    address: ctx.address,
    path: '/swaps/quote',
    method: 'POST',
    body: {
      address: ctx.address,
      fromAssetId: quote.fromAssetId,
      toAssetId: quote.toAssetId,
      amount: quote.amount,
      type: quote.type ?? 'fixed-input',
    },
  });
  return { quote: asRecord(unwrapData(json)), paidMicro };
}

async function approveHay(ctx: AgentToolContext, hold: PendingHay): Promise<{
  paidMicro: bigint;
  txids: string[];
}> {
  let paidMicro = 0n;
  const txids: string[] = [];
  let quote = hold.quote;

  if (!hold.optInsDone) {
    ctx.onStatus?.('checking opt-ins');
    const opt = await canixRequest<unknown>({
      store: ctx.store,
      keyId: ctx.keyId,
      address: ctx.address,
      path: '/swaps/optin',
      method: 'POST',
      body: { address: ctx.address, quote },
    });
    paidMicro += opt.paidMicro;
    const group = parseCanixGroup(unwrapData(opt.json));
    if (group && group.members.length > 0) {
      ctx.onStatus?.('approve on this device');
      const submitted = await signAndSubmitCanixGroup({
        store: ctx.store,
        keyId: ctx.keyId,
        address: ctx.address,
        group,
      });
      txids.push(submitted.txid);
      const fresh = await refreshHayQuote(ctx, quote);
      paidMicro += fresh.paidMicro;
      quote = fresh.quote;
    }
    hold.quote = quote;
    hold.optInsDone = true;
  }

  ctx.onStatus?.('approve on this device');
  const built = await canixRequest<unknown>({
    store: ctx.store,
    keyId: ctx.keyId,
    address: ctx.address,
    path: '/swaps/transactions',
    method: 'POST',
    body: { address: ctx.address, quote, slippage: hold.slippage },
  });
  paidMicro += built.paidMicro;
  const group = parseCanixGroup(unwrapData(built.json));
  if (!group) throw new Error('Canix returned no Hay group');
  ctx.onStatus?.('approve on this device');
  const submitted = await signAndSubmitCanixGroup({
    store: ctx.store,
    keyId: ctx.keyId,
    address: ctx.address,
    group,
  });
  txids.push(submitted.txid);
  return { paidMicro, txids };
}

async function approveGroups(ctx: AgentToolContext, hold: PendingGroups): Promise<{ txids: string[] }> {
  const txids: string[] = [];
  for (let i = 0; i < hold.groups.length; i += 1) {
    const group = hold.groups[i];
    if (!group) continue;
    ctx.onStatus?.('approve on this device');
    const submitted = await signAndSubmitCanixGroup({
      store: ctx.store,
      keyId: ctx.keyId,
      address: ctx.address,
      group,
    });
    txids.push(submitted.txid);
  }
  return { txids };
}

async function approve(ctx: AgentToolContext, args: Record<string, unknown>) {
  const pendingId = str(args.pendingId, 'pendingId');
  const hold = pending.get(pendingId);
  if (!hold) throw new Error('No pending Canix spend for that id. Fetch a quote or compose again.');
  ctx.onStatus?.('approve on this device');
  if (hold.kind === 'hay-quote') {
    const result = await approveHay(ctx, hold);
    pending.delete(pendingId);
    return {
      paidMicro: result.paidMicro,
      body: {
        submitted: true,
        txids: result.txids,
        paidMicro: result.paidMicro.toString(),
        note: 'Signed and submitted on this device after AC2. Canix did not submit.',
      },
    };
  }
  const result = await approveGroups(ctx, hold);
  pending.delete(pendingId);
  return {
    paidMicro: 0n,
    body: {
      submitted: true,
      txids: result.txids,
      summary: hold.summary,
      note: 'Signed and submitted on this device after AC2. Canix did not submit.',
    },
  };
}

export async function runAgentTool(
  name: string,
  rawArgs: string,
  ctx: AgentToolContext,
): Promise<{ output: string; paidMicro: bigint }> {
  let args: Record<string, unknown> = {};
  if (rawArgs.trim()) {
    try {
      const parsed: unknown = JSON.parse(rawArgs);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        args = parsed as Record<string, unknown>;
      }
    } catch {
      return { output: JSON.stringify({ error: 'Tool arguments were not JSON' }), paidMicro: 0n };
    }
  }

  try {
    const run =
      name === 'canix_opportunities'
        ? opportunities
        : name === 'canix_hay_quote'
          ? hayQuote
          : name === 'canix_compose'
            ? compose
            : name === 'canix_execution_quote'
              ? executionQuote
              : name === 'approve_canix_spend'
                ? approve
                : null;
    if (!run) return { output: JSON.stringify({ error: `Unknown tool ${name}` }), paidMicro: 0n };
    const result = await run(ctx, args);
    return { output: JSON.stringify(result.body), paidMicro: result.paidMicro };
  } catch (e) {
    return {
      output: JSON.stringify({ error: e instanceof Error ? e.message : 'Tool failed' }),
      paidMicro: 0n,
    };
  }
}
