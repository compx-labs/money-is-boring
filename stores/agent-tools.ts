import { Store } from '@tanstack/react-store';
import type { CompiledHttpTool } from '@/lib/agent/http-tools';
import { prefs } from '@/lib/prefs';

const KEY = 'agent.tools';

export type LoadedSuite = {
  merchantId: string;
  name: string;
  logo: string;
  toolCount: number;
  tools: CompiledHttpTool[];
} | null;

function isTool(value: unknown): value is CompiledHttpTool {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const tool = value as Record<string, unknown>;
  return (
    typeof tool.name === 'string' &&
    typeof tool.description === 'string' &&
    typeof tool.method === 'string' &&
    typeof tool.url === 'string' &&
    !!tool.parameters &&
    typeof tool.parameters === 'object' &&
    !Array.isArray(tool.parameters)
  );
}

function parse(raw: string | undefined): LoadedSuite {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const row = parsed as Record<string, unknown>;
    if (typeof row.merchantId !== 'string' || !row.merchantId) return null;
    if (typeof row.name !== 'string' || !row.name) return null;
    if (typeof row.logo !== 'string') return null;
    if (!Array.isArray(row.tools) || !row.tools.every(isTool)) return null;
    return {
      merchantId: row.merchantId,
      name: row.name,
      logo: row.logo,
      toolCount: row.tools.length,
      tools: row.tools,
    };
  } catch {
    return null;
  }
}

function load(): LoadedSuite {
  return parse(prefs.getString(KEY));
}

export const agentToolsStore = new Store<LoadedSuite>(load());

export function setLoadedSuite(suite: LoadedSuite) {
  agentToolsStore.setState(() => suite);
  if (suite) prefs.set(KEY, JSON.stringify(suite));
  else prefs.remove(KEY);
}
