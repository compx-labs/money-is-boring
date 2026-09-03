import { signAndSubmitWalletGroup } from '@/lib/algorand/submit';
import { canixRequest } from '@/lib/canix/client';
import { collectCanixGroups, parseCanixGroup, type CanixGroup } from '@/lib/canix/groups';
import { HAY_SLIPPAGE_PCT } from '@/lib/theme';
import type { AgentToolContext, AgentToolProvider, AgentToolResult } from '@/lib/agent/types';

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

async function submitGroups(
  ctx: AgentToolContext,
  groups: CanixGroup[],
): Promise<{ txids: string[] }> {
  const txids: string[] = [];
  for (const group of groups) {
    if (group.members.length === 0) continue;
    ctx.onStatus?.('signing');
    const submitted = await signAndSubmitWalletGroup({
      store: ctx.store,
      keyId: ctx.keyId,
      address: ctx.address,
      group,
    });
    txids.push(submitted.txid);
  }
  return { txids };
}

async function opportunities(ctx: AgentToolContext, args: Record<string, unknown>): Promise<AgentToolResult> {
  const limit = Math.min(20, Math.max(1, typeof args.limit === 'number' ? args.limit : 8));
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

async function hayQuote(ctx: AgentToolContext, args: Record<string, unknown>): Promise<AgentToolResult> {
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
  return {
    paidMicro,
    body: {
      paidMicro: paidMicro.toString(),
      quote: quoteSummary(quote),
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

async function haySwap(ctx: AgentToolContext, args: Record<string, unknown>): Promise<AgentToolResult> {
  const slippage = typeof args.slippage === 'number' ? args.slippage : HAY_SLIPPAGE_PCT;
  const first = await canixRequest<unknown>({
    store: ctx.store,
    keyId: ctx.keyId,
    address: ctx.address,
    path: '/swaps/quote',
    method: 'POST',
    body: {
      address: ctx.address,
      fromAssetId: num(args.fromAssetId, 'fromAssetId'),
      toAssetId: num(args.toAssetId, 'toAssetId'),
      amount: str(args.amount, 'amount'),
      type: 'fixed-input',
    },
  });
  let paidMicro = first.paidMicro;
  let quote = asRecord(unwrapData(first.json));

  const txids: string[] = [];
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
  const optGroup = parseCanixGroup(unwrapData(opt.json));
  if (optGroup && optGroup.members.length > 0) {
    ctx.onStatus?.('signing');
    const submitted = await signAndSubmitWalletGroup({
      store: ctx.store,
      keyId: ctx.keyId,
      address: ctx.address,
      group: optGroup,
    });
    txids.push(submitted.txid);
    const fresh = await refreshHayQuote(ctx, quote);
    paidMicro += fresh.paidMicro;
    quote = fresh.quote;
  }

  ctx.onStatus?.('building swap');
  const built = await canixRequest<unknown>({
    store: ctx.store,
    keyId: ctx.keyId,
    address: ctx.address,
    path: '/swaps/transactions',
    method: 'POST',
    body: { address: ctx.address, quote, slippage },
  });
  paidMicro += built.paidMicro;
  const group = parseCanixGroup(unwrapData(built.json));
  if (!group) throw new Error('Canix returned no Hay group');
  ctx.onStatus?.('signing');
  const submitted = await signAndSubmitWalletGroup({
    store: ctx.store,
    keyId: ctx.keyId,
    address: ctx.address,
    group,
  });
  txids.push(submitted.txid);
  return {
    paidMicro,
    body: {
      submitted: true,
      txids,
      paidMicro: paidMicro.toString(),
      quote: quoteSummary(quote),
    },
  };
}

async function compose(ctx: AgentToolContext, args: Record<string, unknown>): Promise<AgentToolResult> {
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
  const { txids } = await submitGroups(ctx, groups);
  return {
    paidMicro,
    body: {
      submitted: true,
      txids,
      paidMicro: paidMicro.toString(),
      summary: composeSummary(data, groups.length),
    },
  };
}

function trimPosition(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== 'object') return null;
  const o = row as Record<string, unknown>;
  return {
    protocol: o.protocol,
    type: o.type ?? o.positionType ?? o.opportunityType,
    pair: o.assetPair ?? o.pair,
    valueUsd: o.valueUsd ?? o.usdValue,
    amounts: o.amounts ?? o.tokens,
  };
}

async function positions(ctx: AgentToolContext): Promise<AgentToolResult> {
  const { json, paidMicro } = await canixRequest<unknown>({
    store: ctx.store,
    keyId: ctx.keyId,
    address: ctx.address,
    path: `/positions?address=${encodeURIComponent(ctx.address)}`,
  });
  const data = unwrapData(json);
  const rows = Array.isArray(data)
    ? data
    : json && typeof json === 'object' && Array.isArray((json as { positions?: unknown }).positions)
      ? (json as { positions: unknown[] }).positions
      : [];
  return {
    paidMicro,
    body: {
      fetched: 'now',
      paidMicro: paidMicro.toString(),
      positions: rows.map(trimPosition).filter((r): r is Record<string, unknown> => !!r),
    },
  };
}

async function execute(ctx: AgentToolContext, args: Record<string, unknown>): Promise<AgentToolResult> {
  const shapeKey = str(args.shapeKey, 'shapeKey');
  const input =
    args.input && typeof args.input === 'object' && !Array.isArray(args.input)
      ? (args.input as Record<string, unknown>)
      : null;
  if (!input) throw new Error('Missing input');
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
  const { txids } = await submitGroups(ctx, groups);
  return {
    paidMicro,
    body: {
      submitted: true,
      txids,
      paidMicro: paidMicro.toString(),
      shapeKey,
      groups: groups.length,
    },
  };
}

const handlers: Record<string, (ctx: AgentToolContext, args: Record<string, unknown>) => Promise<AgentToolResult>> = {
  canix_opportunities: opportunities,
  canix_hay_quote: hayQuote,
  canix_hay_swap: haySwap,
  canix_compose: compose,
  canix_execute: execute,
  canix_positions: positions,
};

export const canixProvider: AgentToolProvider = {
  id: 'canix',
  tools: [
    {
      type: 'function',
      name: 'canix_opportunities',
      description:
        'List DeFi opportunities (APY, TVL, shape keys). May charge a research fee in USDC from this wallet. Does not submit transactions.',
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
        'Fetch a Haystack swap quote. Amount is integer base units. Does not submit. Call canix_hay_swap to execute.',
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
      name: 'canix_hay_swap',
      description:
        'Swap via Haystack. This wallet signs and submits. Amount is integer base units. Never claim a swap landed unless this returns a transaction id.',
      parameters: {
        type: 'object',
        required: ['fromAssetId', 'toAssetId', 'amount'],
        properties: {
          fromAssetId: { type: 'integer', minimum: 0, description: 'Input ASA id; 0 is ALGO.' },
          toAssetId: { type: 'integer', minimum: 0, description: 'Output ASA id; 0 is ALGO.' },
          amount: { type: 'string', description: 'Input amount in base units, integer string.' },
          slippage: { type: 'number', minimum: 0, maximum: 100, description: 'Percent. Default 1.' },
        },
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'canix_compose',
      description:
        'Enter an opportunity (opt-in → swap → enter). This wallet signs and submits. Never claim it landed unless this returns a transaction id.',
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
      name: 'canix_positions',
      description:
        'Live DeFi positions for this wallet right now from Canix. Do not treat notebook notes as positions or balances.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    {
      type: 'function',
      name: 'canix_execute',
      description:
        'Run one execution shape. This wallet signs and submits. Never claim it landed unless this returns a transaction id.',
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
  ],
  async run(name, args, ctx) {
    const handler = handlers[name];
    if (!handler) return null;
    return handler(ctx, args);
  },
};
