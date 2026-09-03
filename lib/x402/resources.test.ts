import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { listMerchantResources, resourceHost } from '@/lib/x402/resources';

describe('resourceHost', () => {
  it('reads a hostname from a url or bare domain', () => {
    assert.equal(resourceHost('https://canix402-api.compx.io/opportunities'), 'canix402-api.compx.io');
    assert.equal(resourceHost('canix402-api.compx.io'), 'canix402-api.compx.io');
    assert.equal(resourceHost(null), null);
  });
});

describe('listMerchantResources', () => {
  it('does not use the Explore data id as a bazaar merchantId', async () => {
    const calls: string[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/discovery/resources?search=')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                resourceUrl: 'https://canix402-api.compx.io/opportunities',
                method: 'GET',
                description: 'opportunities',
                discoveryInfo: { input: { type: 'http', method: 'GET' } },
              },
              {
                resourceUrl: 'https://other.example/x',
                method: 'GET',
                description: 'noise',
              },
            ],
            pagination: { limit: 100, offset: 0, total: 2 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    try {
      const resources = await listMerchantResources({
        id: '276665b676c37fd3',
        url: 'https://canix402-api.compx.io',
      });
      assert.equal(resources.length, 1);
      assert.equal(resources[0]?.resourceUrl, 'https://canix402-api.compx.io/opportunities');
      assert.ok(calls.every((url) => !url.includes('merchantId=276665b676c37fd3')));
      assert.ok(calls.some((url) => url.includes('search=canix402-api.compx.io')));
    } finally {
      globalThis.fetch = orig;
    }
  });

  it('falls back to the data merchant resources list', async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/discovery/resources?search=')) {
        return new Response(JSON.stringify({ items: [], pagination: { limit: 100, offset: 0, total: 0 } }), {
          status: 200,
        });
      }
      if (url.includes('/data/merchants/abc')) {
        return new Response(
          JSON.stringify({
            website: 'https://echo.example',
            resources: [
              { url: 'https://echo.example/api/echo', method: null },
              { url: 'https://echo.example/api/echo', method: 'GET' },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    try {
      const resources = await listMerchantResources({ id: 'abc', url: 'https://echo.example' });
      assert.deepEqual(
        resources.map((row) => ({ url: row.resourceUrl, method: row.method })),
        [{ url: 'https://echo.example/api/echo', method: 'GET' }],
      );
    } finally {
      globalThis.fetch = orig;
    }
  });
});
