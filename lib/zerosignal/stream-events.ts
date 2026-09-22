import type {
  Api,
  AssistantMessage,
  AssistantMessageEvent,
  Model,
  StopReason,
  ToolCall,
  Usage,
} from '@mariozechner/pi-ai';
import { namedFunctionCalls, type FunctionCall } from '@/lib/zerosignal/sse-tools';

const EMPTY_USAGE: Usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

export function emptyAssistant(model: Model<Api>): AssistantMessage {
  return {
    role: 'assistant',
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: { ...EMPTY_USAGE, cost: { ...EMPTY_USAGE.cost } },
    stopReason: 'pending' as StopReason,
    timestamp: Date.now(),
  };
}

function parseArgs(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Keep the model-facing payload even when arguments are not an object.
  }
  return { _raw: raw };
}

function textIndex(output: AssistantMessage): number {
  return output.content.findIndex((block) => block.type === 'text');
}

/** Turn an accumulated ZeroSignal text delta into pi stream events. Mutates `output`. */
export function applyTextDelta(
  output: AssistantMessage,
  soFar: string,
  next: string,
): AssistantMessageEvent[] {
  if (!next || next === soFar) return [];
  const delta = next.startsWith(soFar) ? next.slice(soFar.length) : next;
  if (!delta) return [];

  const events: AssistantMessageEvent[] = [];
  let index = textIndex(output);
  if (index < 0) {
    output.content.push({ type: 'text', text: '' });
    index = output.content.length - 1;
    events.push({ type: 'text_start', contentIndex: index, partial: output });
  }
  const block = output.content[index];
  if (block.type !== 'text') return events;
  if (!next.startsWith(soFar)) {
    block.text = next;
  } else {
    block.text += delta;
  }
  events.push({ type: 'text_delta', contentIndex: index, delta, partial: output });
  return events;
}

export function finalizeRound(
  output: AssistantMessage,
  acc: { text: string; functionCalls: Map<string, FunctionCall> },
  usage?: Partial<Pick<Usage, 'input' | 'output'>>,
): AssistantMessageEvent[] {
  const events: AssistantMessageEvent[] = [];
  if (acc.text) {
    const before = output.content.find((block) => block.type === 'text')?.text ?? '';
    events.push(...applyTextDelta(output, before, acc.text));
    const index = textIndex(output);
    if (index >= 0 && output.content[index]?.type === 'text') {
      events.push({
        type: 'text_end',
        contentIndex: index,
        content: output.content[index].text,
        partial: output,
      });
    }
  }

  const calls = namedFunctionCalls(acc.functionCalls);
  for (const call of calls) {
    const toolCall: ToolCall = {
      type: 'toolCall',
      id: call.call_id,
      name: call.name,
      arguments: parseArgs(call.arguments),
    };
    output.content.push(toolCall);
    const contentIndex = output.content.length - 1;
    events.push({ type: 'toolcall_start', contentIndex, partial: output });
    events.push({
      type: 'toolcall_delta',
      contentIndex,
      delta: call.arguments,
      partial: output,
    });
    events.push({ type: 'toolcall_end', contentIndex, toolCall, partial: output });
  }

  if (usage?.input != null) output.usage.input = usage.input;
  if (usage?.output != null) output.usage.output = usage.output;
  output.usage.totalTokens = output.usage.input + output.usage.output;

  const hasTools = calls.length > 0;
  const reason: Extract<StopReason, 'stop' | 'toolUse'> = hasTools ? 'toolUse' : 'stop';
  output.stopReason = reason;
  events.push({ type: 'done', reason, message: output });
  return events;
}

export function failRound(
  output: AssistantMessage,
  error: unknown,
  aborted: boolean,
): AssistantMessageEvent {
  output.stopReason = aborted ? 'aborted' : 'error';
  output.errorMessage = error instanceof Error ? error.message : String(error);
  return { type: 'error', reason: output.stopReason, error: output };
}
