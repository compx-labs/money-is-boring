import type { Context, Message, Tool } from '@mariozechner/pi-ai';

export const ZS_API = 'zerosignal-sealed';
export const ZS_PROVIDER = 'zerosignal';

export type ZsResponseInput =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | { type: 'function_call'; call_id: string; name: string; arguments: string }
  | { type: 'function_call_output'; call_id: string; output: string };

export type ZsFunctionTool = {
  type: 'function';
  name: string;
  description: string;
  parameters: unknown;
};

function textOf(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === 'string') return content;
  return content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text ?? '')
    .join('');
}

function toolArgs(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value ?? {});
}

/** Map a pi-ai Context into ZeroSignal's Responses-shaped request body. */
export function contextToZsInput(context: Context): ZsResponseInput[] {
  const input: ZsResponseInput[] = [];
  if (context.systemPrompt) {
    input.push({ role: 'system', content: context.systemPrompt });
  }
  for (const message of context.messages) {
    input.push(...messageToZsInput(message));
  }
  return input;
}

export function messageToZsInput(message: Message): ZsResponseInput[] {
  if (message.role === 'user') {
    return [{ role: 'user', content: textOf(message.content) }];
  }
  if (message.role === 'assistant') {
    const items: ZsResponseInput[] = [];
    const text = textOf(message.content);
    if (text) items.push({ role: 'assistant', content: text });
    for (const block of message.content) {
      if (block.type !== 'toolCall') continue;
      items.push({
        type: 'function_call',
        call_id: block.id,
        name: block.name,
        arguments: toolArgs(block.arguments),
      });
    }
    return items;
  }
  return [
    {
      type: 'function_call_output',
      call_id: message.toolCallId,
      output: textOf(message.content),
    },
  ];
}

export function piToolsToZs(tools: Tool[] | undefined): ZsFunctionTool[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

export function contextToZsBody(
  modelId: string,
  context: Context,
  maxOutput: number,
): Record<string, unknown> {
  const tools = piToolsToZs(context.tools);
  const body: Record<string, unknown> = {
    model: modelId,
    input: contextToZsInput(context),
    stream: true,
    max_output_tokens: maxOutput,
  };
  if (tools) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }
  return body;
}
