import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Model } from '@mariozechner/pi-ai';
import { applyTextDelta, emptyAssistant, failRound, finalizeRound } from '@/lib/zerosignal/stream-events';

const model: Model<'zerosignal-sealed'> = {
  id: 'glm-4.7-flash',
  name: 'glm-4.7-flash',
  api: 'zerosignal-sealed',
  provider: 'zerosignal',
  baseUrl: '',
  reasoning: false,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 2048,
};

describe('zerosignal pi stream events', () => {
  it('streams text deltas then completes with stop', () => {
    const output = emptyAssistant(model);
    const start = applyTextDelta(output, '', 'Hel');
    assert.equal(start[0]?.type, 'text_start');
    assert.equal(start[1]?.type, 'text_delta');
    const more = applyTextDelta(output, 'Hel', 'Hello');
    assert.equal(more[0]?.type, 'text_delta');
    if (more[0]?.type !== 'text_delta') throw new Error('expected text_delta');
    assert.equal(more[0].delta, 'lo');

    const done = finalizeRound(output, { text: 'Hello', functionCalls: new Map() });
    assert.equal(done.at(-1)?.type, 'done');
    assert.equal(output.stopReason, 'stop');
    assert.equal(output.content[0]?.type, 'text');
    if (output.content[0]?.type === 'text') assert.equal(output.content[0].text, 'Hello');
  });

  it('emits toolcall events and toolUse when ZeroSignal returns function calls', () => {
    const output = emptyAssistant(model);
    const calls = new Map([
      ['c1', { call_id: 'c1', name: 'wallet_holdings', arguments: '{}' }],
    ]);
    const events = finalizeRound(output, { text: '', functionCalls: calls });
    const types = events.map((event) => event.type);
    assert.deepEqual(types, ['toolcall_start', 'toolcall_delta', 'toolcall_end', 'done']);
    assert.equal(output.stopReason, 'toolUse');
    assert.equal(output.content[0]?.type, 'toolCall');
    if (output.content[0]?.type === 'toolCall') {
      assert.equal(output.content[0].name, 'wallet_holdings');
      assert.equal(output.content[0].id, 'c1');
    }
    const done = events.at(-1);
    if (done?.type !== 'done') throw new Error('expected done');
    assert.equal(done.reason, 'toolUse');
  });

  it('encodes failures as stream errors instead of throwing', () => {
    const output = emptyAssistant(model);
    const event = failRound(output, new Error('reserve failed'), false);
    assert.equal(event.type, 'error');
    assert.equal(output.stopReason, 'error');
    assert.equal(output.errorMessage, 'reserve failed');
  });
});
