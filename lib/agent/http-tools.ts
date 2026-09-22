import { paidRequest } from '@/lib/x402/request';
import { listMerchantResources, type CatalogedResource } from '@/lib/x402/resources';
import type { AgentToolContext, AgentToolProvider, AgentToolResult, AgentToolSchema } from '@/lib/agent/types';

export const MAX_HTTP_TOOLS = 24;

export type CompiledHttpTool = {
  name: string;
  description: string;
  method: string;
  url: string;
  parameters: Record<string, unknown>;
  wrapBody?: boolean;
};

export type CompiledSuite = {
  merchantId: string;
  name: string;
  logo: string;
  toolCount: number;
  tools: CompiledHttpTool[];
};

type DiscoveryInput = {
  type?: unknown;
  method?: unknown;
  queryParams?: unknown;
  body?: unknown;
  pathParams?: unknown;
  schema?: unknown;
  inputSchema?: unknown;
};

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function discoveryInput(resource: CatalogedResource): DiscoveryInput {
  const info = asRecord(resource.discoveryInfo);
  const input = asRecord(info?.input);
  return input ?? {};
}

function isMcp(resource: CatalogedResource): boolean {
  if (text(resource.type)?.toLowerCase() === 'mcp') return true;
  return text(discoveryInput(resource).type)?.toLowerCase() === 'mcp';
}

function httpMethod(resource: CatalogedResource): string | null {
  const raw = text(resource.method) ?? text(discoveryInput(resource).method) ?? 'GET';
  const method = raw.toUpperCase();
  return HTTP_METHODS.has(method) ? method : null;
}

function resourceUrl(resource: CatalogedResource): URL | null {
  const raw = text(resource.resourceUrl);
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function exampleKeys(value: unknown): Record<string, unknown> | null {
  const rec = asRecord(value);
  if (!rec || Object.keys(rec).length === 0) return null;
  return rec;
}

function jsonSchemaType(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) return { type: 'array' };
  if (value && typeof value === 'object') return { type: 'object', additionalProperties: true };
  if (typeof value === 'number') return { type: 'number' };
  if (typeof value === 'boolean') return { type: 'boolean' };
  return { type: 'string' };
}

function propertiesFromExample(example: Record<string, unknown>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(example)) {
    properties[key] = jsonSchemaType(value);
  }
  return properties;
}

function objectSchema(properties: Record<string, unknown>, extra = false): Record<string, unknown> {
  return { type: 'object', properties, additionalProperties: extra };
}

function looksLikeSchema(value: unknown): value is Record<string, unknown> {
  const rec = asRecord(value);
  return rec != null && rec.type === 'object';
}

function hasInputSchema(resource: CatalogedResource): boolean {
  const input = discoveryInput(resource);
  if (looksLikeSchema(input.schema) || looksLikeSchema(input.inputSchema)) return true;
  return exampleKeys(input.queryParams) != null || exampleKeys(input.body) != null || exampleKeys(input.pathParams) != null;
}

function parametersFor(resource: CatalogedResource, method: string): { parameters: Record<string, unknown>; wrapBody?: boolean } {
  const input = discoveryInput(resource);
  if (looksLikeSchema(input.schema)) return { parameters: input.schema };
  if (looksLikeSchema(input.inputSchema)) return { parameters: input.inputSchema };

  const properties: Record<string, unknown> = {
    ...propertiesFromExample(exampleKeys(input.pathParams) ?? {}),
    ...propertiesFromExample(exampleKeys(input.queryParams) ?? {}),
    ...propertiesFromExample(exampleKeys(input.body) ?? {}),
  };
  if (Object.keys(properties).length > 0) return { parameters: objectSchema(properties) };

  if (method === 'GET' || method === 'HEAD') {
    return { parameters: objectSchema({}) };
  }
  return {
    parameters: objectSchema({ body: { type: 'object', additionalProperties: true } }),
    wrapBody: true,
  };
}

function pathSlug(pathname: string): string {
  return pathname
    .split('/')
    .filter(Boolean)
    .map((seg) => seg.replace(/^\{|\}$/g, '').replace(/[^a-zA-Z0-9]+/g, '_'))
    .map((seg) => seg.replace(/^_+|_+$/g, '').toLowerCase())
    .filter(Boolean)
    .join('_');
}

function toolSlug(method: string, url: URL): string {
  const path = pathSlug(url.pathname);
  const base = path ? `${method.toLowerCase()}_${path}` : method.toLowerCase();
  return base.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64) || method.toLowerCase();
}

function uniqueName(base: string, used: Set<string>): string {
  let name = base.slice(0, 64);
  if (!used.has(name)) return name;
  let i = 2;
  while (true) {
    const suffix = `_${i}`;
    name = `${base.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`;
    if (!used.has(name)) return name;
    i += 1;
  }
}

function richness(resource: CatalogedResource): number {
  const described = text(resource.description) ? 2 : 0;
  const schema = hasInputSchema(resource) ? 1 : 0;
  return described + schema;
}

function httpResources(resources: readonly CatalogedResource[]): CatalogedResource[] {
  return resources.filter((resource) => {
    if (isMcp(resource)) return false;
    if (!resourceUrl(resource)) return false;
    return httpMethod(resource) != null;
  });
}

/** Map bazaar HTTP resources into host tools. MCP is dropped. Cap 24. */
export function compileHttpTools(resources: readonly CatalogedResource[]): CompiledHttpTool[] {
  const http = httpResources(resources).slice();
  http.sort((a, b) => richness(b) - richness(a));
  const picked = http.slice(0, MAX_HTTP_TOOLS);
  const used = new Set<string>();
  const tools: CompiledHttpTool[] = [];

  for (const resource of picked) {
    const url = resourceUrl(resource);
    const method = httpMethod(resource);
    if (!url || !method) continue;
    const name = uniqueName(toolSlug(method, url), used);
    used.add(name);
    const { parameters, wrapBody } = parametersFor(resource, method);
    tools.push({
      name,
      description: text(resource.description) ?? `${method} ${url.pathname}`,
      method,
      url: url.toString(),
      parameters,
      ...(wrapBody ? { wrapBody: true } : {}),
    });
  }

  return tools;
}

export function suiteFromResources(
  merchant: { id: string; name: string; logo: string },
  resources: readonly CatalogedResource[],
): CompiledSuite {
  const tools = compileHttpTools(resources);
  if (tools.length === 0) throw new Error('no tools listed');
  return {
    merchantId: merchant.id,
    name: merchant.name,
    logo: merchant.logo,
    toolCount: tools.length,
    tools,
  };
}

export async function compileMerchantSuite(merchant: {
  id: string;
  name: string;
  logo: string;
  url?: string | null;
}): Promise<CompiledSuite> {
  const resources = await listMerchantResources(merchant);
  return suiteFromResources(merchant, resources);
}

/** Chat copy for the loaded suite. Name + description; no schema dump. */
export function formatLoadedToolsMessage(suite: {
  name: string;
  tools: readonly { name: string; description: string }[];
}): string {
  const count = suite.tools.length;
  const header = `${suite.name} · ${count} tool${count === 1 ? '' : 's'}`;
  const lines = suite.tools.map((tool) => {
    const desc = tool.description.trim();
    if (!desc || desc === tool.name) return tool.name;
    return `${tool.name} — ${desc}`;
  });
  return [header, '', ...lines].join('\n');
}

function applyPathParams(url: string, args: Record<string, unknown>): { url: string; rest: Record<string, unknown> } {
  const rest = { ...args };
  let next = url;
  for (const [key, value] of Object.entries(args)) {
    const token = `{${key}}`;
    if (!next.includes(token) || value == null) continue;
    next = next.split(token).join(encodeURIComponent(String(value)));
    delete rest[key];
  }
  return { url: next, rest };
}

function withQuery(url: string, args: Record<string, unknown>): string {
  const next = new URL(url);
  for (const [key, value] of Object.entries(args)) {
    if (value == null || value === '') continue;
    next.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
  return next.toString();
}

function jsonBody(tool: CompiledHttpTool, args: Record<string, unknown>): unknown {
  if (tool.wrapBody && 'body' in args) return args.body;
  return args;
}

export async function runCompiledHttpTool(
  tool: CompiledHttpTool,
  args: Record<string, unknown>,
  ctx: AgentToolContext,
): Promise<AgentToolResult> {
  const applied = applyPathParams(tool.url, args);
  const method = tool.method.toUpperCase();
  const query = method === 'GET' || method === 'HEAD';
  const { json, paidMicro } = await paidRequest<unknown>({
    store: ctx.store,
    keyId: ctx.keyId,
    address: ctx.address,
    url: query ? withQuery(applied.url, applied.rest) : applied.url,
    method,
    body: query ? undefined : jsonBody(tool, applied.rest),
  });
  return { paidMicro, body: json };
}

export function httpSuiteProvider(tools: CompiledHttpTool[]): AgentToolProvider {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const schemas: AgentToolSchema[] = tools.map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
  return {
    id: 'suite',
    tools: schemas,
    async run(name, args, ctx) {
      const tool = byName.get(name);
      if (!tool) return null;
      return runCompiledHttpTool(tool, args, ctx);
    },
  };
}
