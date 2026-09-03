export type FunctionCall = { call_id: string; name: string; arguments: string };

export type SseAcc = {
  text: string;
  reasoning: string;
  functionCalls: Map<string, FunctionCall>;
  eventTypes: string[];
};

export function emptySseFields(): Pick<SseAcc, 'text' | 'reasoning' | 'functionCalls' | 'eventTypes'> {
  return {
    text: '',
    reasoning: '',
    functionCalls: new Map(),
    eventTypes: [],
  };
}

/** One entry per call even when the stream keyed the same object under call_id and item_id. */
export function namedFunctionCalls(calls: Map<string, FunctionCall>): FunctionCall[] {
  const seen = new Set<FunctionCall>();
  const out: FunctionCall[] = [];
  for (const call of calls.values()) {
    if (seen.has(call) || !call.name) continue;
    seen.add(call);
    if (!call.arguments.trim()) call.arguments = '{}';
    out.push(call);
  }
  return out;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function argsOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function upsertCall(
  calls: Map<string, FunctionCall>,
  patch: {
    keys: string[];
    call_id?: string;
    name?: string;
    arguments?: string;
    appendArgs?: string;
  },
): void {
  const keys = [...new Set(patch.keys.filter(Boolean))];
  let call: FunctionCall | undefined;
  for (const key of keys) {
    call = calls.get(key);
    if (call) break;
  }
  if (!call) {
    const id = patch.call_id || keys[0];
    if (!id && !patch.name) return;
    call = {
      call_id: id || patch.name || 'call',
      name: patch.name ?? '',
      arguments: patch.arguments ?? '',
    };
  }
  if (patch.call_id) call.call_id = patch.call_id;
  if (patch.name) call.name = patch.name;
  if (patch.arguments != null && patch.arguments !== '') call.arguments = patch.arguments;
  if (patch.appendArgs) call.arguments += patch.appendArgs;
  const allKeys = new Set(keys);
  allKeys.add(call.call_id);
  for (const key of allKeys) {
    if (key) calls.set(key, call);
  }
}

function considerFunctionItem(item: unknown, calls: Map<string, FunctionCall>): void {
  const rec = asRecord(item);
  if (!rec) return;
  const nested = asRecord(rec.function);
  const type = str(rec.type);
  const name = str(rec.name) || str(nested?.name);
  const isCall =
    type === 'function_call' ||
    type === 'tool_call' ||
    (Boolean(nested) && (type === 'function' || type === ''));
  if (!isCall && !name) return;
  if (!isCall && type && type !== 'function') return;
  upsertCall(calls, {
    keys: [str(rec.call_id), str(rec.id), str(rec.item_id), str(nested?.id)],
    call_id: str(rec.call_id) || undefined,
    name: name || undefined,
    arguments: argsOf(rec.arguments ?? nested?.arguments),
  });
}

function textFromMessageItem(item: unknown): string {
  const rec = asRecord(item);
  if (!rec) return '';
  if (rec.type !== 'message' && rec.role !== 'assistant') return '';
  if (!Array.isArray(rec.content)) return '';
  let text = '';
  for (const part of rec.content) {
    const p = asRecord(part);
    if (!p) continue;
    if ((p.type === 'output_text' || p.type === 'text') && typeof p.text === 'string') {
      text += p.text;
    }
  }
  return text;
}

function deltaText(delta: unknown): string {
  if (typeof delta === 'string') return delta;
  const rec = asRecord(delta);
  return rec && typeof rec.text === 'string' ? rec.text : '';
}

function collectDelta(rec: Record<string, unknown>, soFar: string): string {
  const type = str(rec.type);
  if (type === 'response.output_text.delta') return soFar + deltaText(rec.delta);
  if (type === 'response.output_text.done' && typeof rec.text === 'string' && !soFar) {
    return rec.text;
  }
  if (type === 'response.content_part.added') {
    const part = asRecord(rec.part);
    if (part && (part.type === 'output_text' || part.type === 'text') && typeof part.text === 'string') {
      return soFar + part.text;
    }
  }
  return soFar;
}

function ingestChoices(rec: Record<string, unknown>, acc: SseAcc): void {
  if (!Array.isArray(rec.choices)) return;
  for (const choice of rec.choices) {
    const row = asRecord(choice);
    const delta = asRecord(row?.delta) ?? asRecord(row?.message);
    if (!delta) continue;
    if (typeof delta.content === 'string') acc.text += delta.content;
    const toolCalls = delta.tool_calls;
    if (!Array.isArray(toolCalls)) continue;
    for (const toolCall of toolCalls) {
      const tc = asRecord(toolCall);
      if (!tc) continue;
      const fn = asRecord(tc.function) ?? tc;
      considerFunctionItem(
        {
          type: 'function_call',
          call_id: str(tc.id) || str(fn.id),
          id: str(tc.id),
          name: str(fn.name) || str(tc.name),
          arguments: fn.arguments ?? tc.arguments,
        },
        acc.functionCalls,
      );
    }
  }
}

export function ingestSseObject(obj: unknown, acc: SseAcc): void {
  if (obj == null) return;
  if (Array.isArray(obj)) {
    for (const item of obj) ingestSseObject(item, acc);
    return;
  }
  if (typeof obj === 'string') {
    ingestPlain(obj, acc);
    return;
  }
  const rec = asRecord(obj);
  if (!rec) return;
  const type = str(rec.type);
  if (type) acc.eventTypes.push(type);

  if (type === 'response.output_item.added' || type === 'response.output_item.done') {
    considerFunctionItem(rec.item, acc.functionCalls);
    const fromItem = textFromMessageItem(rec.item);
    if (fromItem && !acc.text) acc.text = fromItem;
  }
  if (type === 'response.function_call_arguments.delta') {
    upsertCall(acc.functionCalls, {
      keys: [str(rec.call_id), str(rec.item_id), str(rec.id)],
      appendArgs: deltaText(rec.delta),
      name: str(rec.name) || undefined,
      call_id: str(rec.call_id) || undefined,
    });
  }
  if (type === 'response.function_call_arguments.done') {
    upsertCall(acc.functionCalls, {
      keys: [str(rec.call_id), str(rec.item_id), str(rec.id)],
      arguments: typeof rec.arguments === 'string' ? rec.arguments : argsOf(rec.arguments),
      name: str(rec.name) || undefined,
      call_id: str(rec.call_id) || undefined,
    });
  }
  if (type === 'response.completed') {
    const response = asRecord(rec.response);
    const output = response?.output;
    if (Array.isArray(output)) {
      for (const item of output) {
        considerFunctionItem(item, acc.functionCalls);
        const fromItem = textFromMessageItem(item);
        if (fromItem && !acc.text) acc.text = fromItem;
      }
    }
  }
  if (type === 'function_call' || type === 'tool_call') {
    considerFunctionItem(rec, acc.functionCalls);
  }
  if (type === 'response.reasoning_text.delta') {
    acc.reasoning += deltaText(rec.delta);
  }

  ingestChoices(rec, acc);
  acc.text = collectDelta(rec, acc.text);
}

function jsonOrString(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function parseGlmToolCalls(source: string): FunctionCall[] {
  if (!source) return [];
  const out: FunctionCall[] = [];
  const re = /<tool_call>\s*([\s\S]*?)<\/tool_call>/gi;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(source))) {
    const inner = match[1]?.trim() ?? '';
    if (!inner) continue;
    const parsed = parseGlmInner(inner, index);
    index += 1;
    if (parsed) out.push(parsed);
  }
  return out;
}

function parseGlmInner(inner: string, index: number): FunctionCall | null {
  if (inner.startsWith('{')) {
    try {
      const obj = JSON.parse(inner) as Record<string, unknown>;
      const name = str(obj.name) || str(obj.tool);
      if (!name) return null;
      return {
        call_id: `glm_${name}_${index}`,
        name,
        arguments: argsOf(obj.arguments ?? obj.parameters ?? {}),
      };
    } catch {
      return null;
    }
  }
  const nameMatch = inner.match(/^([A-Za-z0-9_.-]+)/);
  if (!nameMatch) return null;
  const name = nameMatch[1];
  const rest = inner.slice(name.length).trim();
  const args: Record<string, unknown> = {};
  const pair = /<arg_key>\s*([\s\S]*?)\s*<\/arg_key>\s*<arg_value>\s*([\s\S]*?)\s*<\/arg_value>/gi;
  let had = false;
  let m: RegExpExecArray | null;
  while ((m = pair.exec(rest))) {
    had = true;
    args[m[1].trim()] = jsonOrString(m[2].trim());
  }
  if (had) {
    return { call_id: `glm_${name}_${index}`, name, arguments: JSON.stringify(args) };
  }
  if (rest.startsWith('{')) {
    return { call_id: `glm_${name}_${index}`, name, arguments: rest };
  }
  return { call_id: `glm_${name}_${index}`, name, arguments: '{}' };
}

export function stripGlmToolCalls(text: string): string {
  return text.replace(/<tool_call>\s*[\s\S]*?<\/tool_call>/gi, '').trim();
}

function ingestPlain(raw: string, acc: SseAcc): void {
  acc.reasoning += raw;
  for (const call of parseGlmToolCalls(raw)) {
    upsertCall(acc.functionCalls, {
      keys: [call.call_id],
      call_id: call.call_id,
      name: call.name,
      arguments: call.arguments,
    });
  }
  if (!namedFunctionCalls(acc.functionCalls).length && !acc.text) {
    acc.text += raw;
  }
}

export function ingestFrame(plaintext: Uint8Array, acc: SseAcc): void {
  const raw = new TextDecoder().decode(plaintext).trim();
  if (!raw) return;
  try {
    ingestSseObject(JSON.parse(raw), acc);
  } catch {
    ingestPlain(raw, acc);
  }
}

export function failedResponseMessage(obj: unknown): string | null {
  const rec = asRecord(obj);
  if (!rec || rec.type !== 'response.failed') return null;
  const response = asRecord(rec.response);
  const error = asRecord(response?.error);
  return str(error?.message) || null;
}

export function finalizeSseAcc(acc: SseAcc): void {
  for (const source of [acc.reasoning, acc.text]) {
    for (const call of parseGlmToolCalls(source)) {
      upsertCall(acc.functionCalls, {
        keys: [call.call_id],
        call_id: call.call_id,
        name: call.name,
        arguments: call.arguments,
      });
    }
  }
  if (namedFunctionCalls(acc.functionCalls).length) {
    acc.text = stripGlmToolCalls(acc.text);
  }
}
