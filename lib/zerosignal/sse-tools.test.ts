import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  emptySseFields,
  finalizeSseAcc,
  ingestSseObject,
  namedFunctionCalls,
  parseGlmToolCalls,
} from '@/lib/zerosignal/sse-tools';

function acc() {
  return { ...emptySseFields() };
}

describe('zerosignal sse tool ingest', () => {
  it('reads a Responses function_call item with a top-level name', () => {
    const next = acc();
    ingestSseObject(
      {
        type: 'response.output_item.added',
        item: {
          type: 'function_call',
          id: 'fc_1',
          call_id: 'call_1',
          name: 'wallet_holdings',
          arguments: '',
        },
      },
      next,
    );
    const calls = namedFunctionCalls(next.functionCalls);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.name, 'wallet_holdings');
    assert.equal(calls[0]?.call_id, 'call_1');
    assert.equal(calls[0]?.arguments, '{}');
  });

  it('reads a nested function.name the old parser skipped', () => {
    const next = acc();
    ingestSseObject(
      {
        type: 'response.output_item.done',
        item: {
          type: 'function_call',
          call_id: 'call_1',
          id: 'fc_1',
          function: { name: 'wallet_holdings', arguments: '{}' },
        },
      },
      next,
    );
    assert.equal(namedFunctionCalls(next.functionCalls)[0]?.name, 'wallet_holdings');
  });

  it('joins argument deltas onto the added item even when ids differ', () => {
    const next = acc();
    ingestSseObject(
      {
        type: 'response.output_item.added',
        item: {
          type: 'function_call',
          id: 'fc_1',
          call_id: 'call_1',
          name: 'wallet_holdings',
          arguments: '',
        },
      },
      next,
    );
    ingestSseObject(
      { type: 'response.function_call_arguments.delta', item_id: 'fc_1', delta: '{"x":' },
      next,
    );
    ingestSseObject(
      {
        type: 'response.function_call_arguments.done',
        item_id: 'fc_1',
        arguments: '{"x":1}',
      },
      next,
    );
    const calls = namedFunctionCalls(next.functionCalls);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.arguments, '{"x":1}');
  });

  it('keeps a function_call that is itself the decrypted frame', () => {
    const next = acc();
    ingestSseObject(
      { type: 'function_call', call_id: 'c1', name: 'wallet_holdings', arguments: '{}' },
      next,
    );
    assert.equal(namedFunctionCalls(next.functionCalls)[0]?.name, 'wallet_holdings');
  });

  it('parses GLM XML tool calls out of reasoning and strips them from text', () => {
    const next = acc();
    next.reasoning = '<tool_call>wallet_holdings\n</tool_call>';
    next.text = 'checking\n<tool_call>wallet_holdings\n</tool_call>';
    finalizeSseAcc(next);
    assert.equal(namedFunctionCalls(next.functionCalls)[0]?.name, 'wallet_holdings');
    assert.equal(next.text, 'checking');
  });

  it('parses GLM JSON tool XML', () => {
    const calls = parseGlmToolCalls(
      '<tool_call>{"name":"wallet_holdings","arguments":{}}</tool_call>',
    );
    assert.equal(calls[0]?.name, 'wallet_holdings');
    assert.equal(calls[0]?.arguments, '{}');
  });

  it('collects output_text from a completed message when no deltas arrived', () => {
    const next = acc();
    ingestSseObject(
      {
        type: 'response.completed',
        response: {
          output: [
            {
              type: 'message',
              role: 'assistant',
              content: [{ type: 'output_text', text: 'hello' }],
            },
          ],
        },
      },
      next,
    );
    assert.equal(next.text, 'hello');
  });
});
