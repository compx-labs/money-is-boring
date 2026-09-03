import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { runAgentLoop } from '@mariozechner/pi-agent-core';
import type { AgentMessage, AgentToolResult } from '@mariozechner/pi-agent-core';
import type { AssistantMessage, Message } from '@mariozechner/pi-ai';
import { AGENT_SYSTEM_PROMPT } from '@/lib/agent/host';
import { createWalletInference } from '@/lib/agent/inference';
import { hostToolsAsPi, type HostToolDetails } from '@/lib/agent/pi-tools';
import { replyFromToolResults } from '@/lib/agent/tool-reply';
import { formatNotebookPreamble, lastTurns, loadNotebookContext } from '@/lib/notebook';
import { ZS_MODEL } from '@/lib/theme';
import { MAX_OUTPUT, type ChatTurn } from '@/lib/zerosignal/chat';
import { ZS_API, ZS_PROVIDER } from '@/lib/zerosignal/context';
import { discoverZsNode } from '@/lib/zerosignal/discover';
import type { PayListener } from '@/lib/zerosignal/pay';

export type { ChatTurn };

const MAX_TOOL_ROUNDS = 4;

const EMPTY_USAGE = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

function convertToLlm(messages: AgentMessage[]): Message[] {
  return messages.filter(
    (message): message is Message =>
      message.role === 'user' || message.role === 'assistant' || message.role === 'toolResult',
  );
}

function priorAssistant(text: string, modelId: string): AssistantMessage {
  return {
    role: 'assistant',
    content: [{ type: 'text', text }],
    api: ZS_API,
    provider: ZS_PROVIDER,
    model: modelId,
    usage: { ...EMPTY_USAGE, cost: { ...EMPTY_USAGE.cost } },
    stopReason: 'stop',
    timestamp: Date.now(),
  };
}

function historyToPi(history: ChatTurn[], modelId: string): { prior: Message[]; prompt: Message } {
  const turns = lastTurns(history);
  const last = turns[turns.length - 1];
  if (!last || last.role !== 'user') {
    throw new Error('Agent turn needs a user message');
  }
  const prior: Message[] = turns.slice(0, -1).map((turn) =>
    turn.role === 'user'
      ? { role: 'user' as const, content: turn.text, timestamp: Date.now() }
      : priorAssistant(turn.text, modelId),
  );
  return {
    prior,
    prompt: { role: 'user', content: last.text, timestamp: Date.now() },
  };
}

function assistantText(message: AgentMessage): string {
  if (message.role !== 'assistant') return '';
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

function collectAssistantText(messages: AgentMessage[]): string {
  return messages
    .map(assistantText)
    .filter(Boolean)
    .join('\n')
    .trim();
}

function toolResultText(message: AgentMessage): string {
  if (message.role !== 'toolResult') return '';
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

function paidMicroOf(result: unknown): bigint {
  if (!result || typeof result !== 'object') return 0n;
  const details = (result as AgentToolResult<HostToolDetails>).details;
  return typeof details?.paidMicro === 'bigint' ? details.paidMicro : 0n;
}

/**
 * One in-wallet chat turn. Pi owns the session, tool loop, streaming, and
 * dispatch. ZeroSignal is inference only — sealed pay-per-call, no zs-proxy.
 */
export async function sendAgentMessage(input: {
  store: Pick<KeyStoreAPI, 'sign'>;
  keyId: string;
  address: string;
  history: ChatTurn[];
  onPay?: PayListener;
  awaitSign?: () => Promise<void>;
  onDelta?: (text: string) => void;
}): Promise<{ text: string; chargedMicro: number; toolsMicro: bigint }> {
  const { store, keyId, address } = input;
  const latestUser = [...input.history].reverse().find((turn) => turn.role === 'user')?.text ?? '';
  input.onPay?.({ type: 'step', step: 'discover' });
  const [node, notebook] = await Promise.all([
    discoverZsNode(ZS_MODEL),
    loadNotebookContext(latestUser),
  ]);

  const session = {
    node,
    store,
    keyId,
    address,
    onPay: input.onPay,
    awaitSign: input.awaitSign,
    chargedMicro: 0,
  };
  const inference = createWalletInference('zerosignal', session);
  const { prior, prompt } = historyToPi(input.history, node.model);
  const preamble = formatNotebookPreamble(notebook.profile, notebook.hits);

  let llmCalls = 0;
  let spoken = '';
  let toolsMicro = 0n;
  let currentPartial = '';

  const messages = await runAgentLoop(
    [prompt],
    {
      systemPrompt: `${AGENT_SYSTEM_PROMPT}\n\n${preamble}`,
      messages: prior,
      tools: hostToolsAsPi({ store, keyId, address }),
    },
    {
      model: inference.model,
      convertToLlm,
      toolExecution: 'sequential',
      maxTokens: MAX_OUTPUT,
      shouldStopAfterTurn: () => llmCalls >= MAX_TOOL_ROUNDS,
    },
    (event) => {
      if (event.type === 'turn_start') {
        currentPartial = '';
      }
      if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
        currentPartial += event.assistantMessageEvent.delta;
        input.onDelta?.(spoken ? `${spoken}\n${currentPartial}` : currentPartial);
      }
      if (event.type === 'message_end' && event.message.role === 'assistant') {
        const text = assistantText(event.message);
        if (text) spoken = spoken ? `${spoken}\n${text}` : text;
        currentPartial = '';
      }
      if (event.type === 'tool_execution_start') {
        input.onPay?.({ type: 'step', step: `tool:${event.toolName}` });
      }
      if (event.type === 'tool_execution_end' && !event.isError) {
        toolsMicro += paidMicroOf(event.result);
      }
    },
    undefined,
    (model, context, options) => {
      llmCalls += 1;
      const next = llmCalls >= MAX_TOOL_ROUNDS ? { ...context, tools: undefined } : context;
      return inference.streamFn(model, next, options);
    },
  );

  const last = [...messages].reverse().find((message) => message.role === 'assistant');
  if (last?.role === 'assistant' && (last.stopReason === 'error' || last.stopReason === 'aborted')) {
    throw new Error(last.errorMessage || 'ZeroSignal inference failed');
  }

  const text =
    collectAssistantText(messages) ||
    replyFromToolResults(
      messages.flatMap((message) =>
        message.role === 'toolResult'
          ? [{ toolName: message.toolName, text: toolResultText(message), isError: message.isError }]
          : [],
      ),
    );
  if (!text) throw new Error('ZeroSignal returned no text');
  return { text, chargedMicro: session.chargedMicro, toolsMicro };
}
