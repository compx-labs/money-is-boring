import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Context, Message } from '@mariozechner/pi-ai';
import { contextToZsBody, contextToZsInput, messageToZsInput, piToolsToZs } from '@/lib/zerosignal/context';

const user = (content: string): Message => ({
  role: 'user',
  content,
  timestamp: 1,
});

describe('zerosignal pi context mapping', () => {
  it('puts the system prompt first, then user and assistant text', () => {
    const context: Context = {
      systemPrompt: 'Be concise.',
      messages: [user('hello'), {
        role: 'assistant',
        content: [{ type: 'text', text: 'hi' }],
        api: 'zerosignal-sealed',
        provider: 'zerosignal',
        model: 'glm-4.7-flash',
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: 'stop',
        timestamp: 2,
      }],
    };
    assert.deepEqual(contextToZsInput(context), [
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
    ]);
  });

  it('maps tool calls and tool results to Responses function items', () => {
    const assistant: Message = {
      role: 'assistant',
      content: [
        { type: 'text', text: 'checking' },
        { type: 'toolCall', id: 'c1', name: 'wallet_holdings', arguments: {} },
      ],
      api: 'zerosignal-sealed',
      provider: 'zerosignal',
      model: 'glm-4.7-flash',
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: 'toolUse',
      timestamp: 3,
    };
    const result: Message = {
      role: 'toolResult',
      toolCallId: 'c1',
      toolName: 'wallet_holdings',
      content: [{ type: 'text', text: '{"holdings":[]}' }],
      isError: false,
      timestamp: 4,
    };
    assert.deepEqual(messageToZsInput(assistant), [
      { role: 'assistant', content: 'checking' },
      {
        type: 'function_call',
        call_id: 'c1',
        name: 'wallet_holdings',
        arguments: '{}',
      },
    ]);
    assert.deepEqual(messageToZsInput(result), [
      { type: 'function_call_output', call_id: 'c1', output: '{"holdings":[]}' },
    ]);
  });

  it('omits tools unless the context still has them', () => {
    const tools = [
      {
        name: 'wallet_holdings',
        description: 'Live balances',
        parameters: { type: 'object', properties: {} },
      },
    ];
    const withTools = contextToZsBody('glm-4.7-flash', { messages: [user('hi')], tools }, 2048);
    assert.equal(withTools.model, 'glm-4.7-flash');
    assert.equal(withTools.stream, true);
    assert.equal(withTools.max_output_tokens, 2048);
    assert.deepEqual(withTools.tool_choice, 'auto');
    assert.deepEqual(piToolsToZs(tools), [
      {
        type: 'function',
        name: 'wallet_holdings',
        description: 'Live balances',
        parameters: { type: 'object', properties: {} },
      },
    ]);

    const without = contextToZsBody('glm-4.7-flash', { messages: [user('hi')] }, 2048);
    assert.equal('tools' in without, false);
  });
});
