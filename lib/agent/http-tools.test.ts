import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  compileHttpTools,
  formatLoadedToolsMessage,
  MAX_HTTP_TOOLS,
  runCompiledHttpTool,
  suiteFromResources,
  type CompiledHttpTool,
} from '@/lib/agent/http-tools';
import type { AgentToolContext } from '@/lib/agent/types';
import type { CatalogedResource } from '@/lib/x402/resources';

const CANIX_MERCHANT_ID = 'M1kyVjZPRFVWVUdNNFRYT0VYWTY1WUxN';

const ctx: AgentToolContext = {
  store: { sign: async () => new Uint8Array() },
  keyId: 'k',
  address: 'ADDR',
};

const merchant = { id: CANIX_MERCHANT_ID, name: 'canix402', logo: 'https://example.com/canix.png' };

function byName(tools: CompiledHttpTool[], name: string): CompiledHttpTool {
  const tool = tools.find((row) => row.name === name);
  assert.ok(tool, `missing ${name}`);
  return tool;
}

describe('compileHttpTools', () => {
  it('maps HTTP resources to method+path slugs and bazaar params', () => {
    const tools = compileHttpTools([
      {
        resourceUrl: 'https://api.example.com/opportunities',
        method: 'GET',
        description: 'List opportunities',
        discoveryInfo: { input: { type: 'http', method: 'GET' } },
      },
      {
        resourceUrl: 'https://api.example.com/swaps/quote',
        method: 'POST',
        description: 'Quote a swap',
        discoveryInfo: {
          input: { type: 'http', method: 'POST', bodyType: 'json', body: { amount: '1', fromAssetId: 0 } },
        },
      },
      {
        resourceUrl: 'https://api.example.com/tweets/search',
        method: 'GET',
        description: 'Search tweets',
        discoveryInfo: {
          input: { type: 'http', method: 'GET', queryParams: { words: 'bitcoin', minLikes: '100' } },
        },
      },
    ]);
    assert.deepEqual(
      tools.map((tool) => tool.name).sort(),
      ['get_opportunities', 'get_tweets_search', 'post_swaps_quote'],
    );
    assert.deepEqual(byName(tools, 'get_opportunities').parameters, {
      type: 'object',
      properties: {},
      additionalProperties: false,
    });
    assert.equal(byName(tools, 'post_swaps_quote').wrapBody, undefined);
    assert.deepEqual((byName(tools, 'post_swaps_quote').parameters.properties as object), {
      amount: { type: 'string' },
      fromAssetId: { type: 'number' },
    });
    assert.deepEqual((byName(tools, 'get_tweets_search').parameters.properties as object), {
      words: { type: 'string' },
      minLikes: { type: 'string' },
    });
  });

  it('uses a body object when a POST has no schema', () => {
    const [tool] = compileHttpTools([
      {
        resourceUrl: 'https://api.example.com/sessions',
        method: 'POST',
        description: 'Open a session',
        discoveryInfo: { input: { type: 'http', method: 'POST' } },
      },
    ]);
    assert.equal(tool?.name, 'post_sessions');
    assert.equal(tool?.wrapBody, true);
    assert.deepEqual(tool?.parameters.properties, {
      body: { type: 'object', additionalProperties: true },
    });
  });

  it('drops MCP resources', () => {
    const tools = compileHttpTools([
      {
        resourceUrl: 'https://api.example.com/weather',
        method: 'GET',
        description: 'Weather',
        discoveryInfo: { input: { type: 'http', method: 'GET' } },
      },
      {
        resourceUrl: 'https://api.example.com/mcp',
        method: 'POST',
        description: 'An MCP tool',
        discoveryInfo: { input: { type: 'mcp', toolName: 'lookup' } },
      },
    ]);
    assert.deepEqual(
      tools.map((tool) => tool.name),
      ['get_weather'],
    );
  });

  it('caps at 24 and prefers described or schema-bearing routes', () => {
    const resources: CatalogedResource[] = [];
    for (let i = 0; i < 20; i += 1) {
      resources.push({
        resourceUrl: `https://api.example.com/bare/${i}`,
        method: 'GET',
        discoveryInfo: { input: { type: 'http', method: 'GET' } },
      });
    }
    for (let i = 0; i < 10; i += 1) {
      resources.push({
        resourceUrl: `https://api.example.com/named/${i}`,
        method: 'GET',
        description: `named ${i}`,
        discoveryInfo: { input: { type: 'http', method: 'GET' } },
      });
    }
    const tools = compileHttpTools(resources);
    assert.equal(tools.length, MAX_HTTP_TOOLS);
    const names = tools.map((tool) => tool.name);
    for (let i = 0; i < 10; i += 1) {
      assert.ok(names.includes(`get_named_${i}`));
    }
    assert.equal(names.filter((name) => name.startsWith('get_bare_')).length, 14);
  });

  it('uses the same mapper for a Canix merchant id as any other fixture', () => {
    const tools = compileHttpTools([
      {
        resourceUrl: 'https://canix402-api.compx.io/opportunities',
        method: 'GET',
        description: 'canix402 paid DeFi data endpoint',
        merchantId: CANIX_MERCHANT_ID,
        discoveryInfo: { input: { type: 'http', method: 'GET' } },
      },
      {
        resourceUrl: 'https://canix402-api.compx.io/swaps/quote',
        method: 'POST',
        description: 'canix402 swap quote',
        merchantId: CANIX_MERCHANT_ID,
        discoveryInfo: { input: { type: 'http', method: 'POST' } },
      },
    ]);
    assert.deepEqual(
      tools.map((tool) => tool.name),
      ['get_opportunities', 'post_swaps_quote'],
    );
    assert.ok(!tools.some((tool) => tool.name.startsWith('canix_')));
  });
});

describe('suiteFromResources', () => {
  it('fails load when the compiled suite is empty', () => {
    assert.throws(
      () => suiteFromResources(merchant, []),
      (err: unknown) => err instanceof Error && err.message === 'no tools listed',
    );
    assert.throws(
      () =>
        suiteFromResources(merchant, [
          {
            resourceUrl: 'https://api.example.com/mcp',
            method: 'POST',
            description: 'MCP only',
            discoveryInfo: { input: { type: 'mcp', toolName: 'lookup' } },
          },
        ]),
      (err: unknown) => err instanceof Error && err.message === 'no tools listed',
    );
  });
});

describe('runCompiledHttpTool', () => {
  it('sends GET args as query through paidRequest', async () => {
    const calls: Array<{ url: string; method?: string; body?: unknown }> = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method, body: init?.body });
      return new Response(JSON.stringify({ hits: 1 }), { status: 200 });
    }) as typeof fetch;
    try {
      const result = await runCompiledHttpTool(
        {
          name: 'get_tweets_search',
          description: 'Search',
          method: 'GET',
          url: 'https://example.com/tweets/search',
          parameters: { type: 'object', properties: { words: { type: 'string' } } },
        },
        { words: 'algo' },
        ctx,
      );
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.method, 'GET');
      assert.equal(calls[0]?.url, 'https://example.com/tweets/search?words=algo');
      assert.equal(calls[0]?.body, undefined);
      assert.deepEqual(result.body, { hits: 1 });
      assert.equal(result.paidMicro, 0n);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it('sends POST args as a JSON body through paidRequest', async () => {
    const calls: Array<{ url: string; method?: string; body?: unknown; headers?: HeadersInit }> = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method, body: init?.body, headers: init?.headers });
      return new Response(JSON.stringify({ quoted: true }), { status: 200 });
    }) as typeof fetch;
    try {
      const result = await runCompiledHttpTool(
        {
          name: 'post_swaps_quote',
          description: 'Quote',
          method: 'POST',
          url: 'https://example.com/swaps/quote',
          parameters: { type: 'object', properties: { amount: { type: 'string' } } },
        },
        { amount: '1000' },
        ctx,
      );
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.method, 'POST');
      assert.equal(calls[0]?.url, 'https://example.com/swaps/quote');
      assert.equal(calls[0]?.body, JSON.stringify({ amount: '1000' }));
      assert.deepEqual(result.body, { quoted: true });
    } finally {
      globalThis.fetch = orig;
    }
  });
});

describe('formatLoadedToolsMessage', () => {
  it('formats the loaded suite as a glanceable system message', () => {
    const text = formatLoadedToolsMessage({
      name: 'canix402',
      tools: [
        { name: 'get_opportunities', description: 'List opportunities' },
        { name: 'post_swaps_quote', description: '  Quote a swap  ' },
        { name: 'get_health', description: 'get_health' },
        { name: 'head_ping', description: '   ' },
      ],
    });
    assert.equal(
      text,
      [
        'canix402 · 4 tools',
        '',
        'get_opportunities — List opportunities',
        'post_swaps_quote — Quote a swap',
        'get_health',
        'head_ping',
      ].join('\n'),
    );
  });

  it('uses a singular header for one tool', () => {
    assert.equal(
      formatLoadedToolsMessage({
        name: 'canix402',
        tools: [{ name: 'get_health', description: 'ok' }],
      }),
      'canix402 · 1 tool\n\nget_health — ok',
    );
  });
});
