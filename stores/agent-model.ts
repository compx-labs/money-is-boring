import { Store } from '@tanstack/react-store';
import { prefs } from '@/lib/prefs';
import { ZS_MODEL } from '@/lib/theme';

const KEY = 'agent.model';

function load(): string {
  const raw = prefs.getString(KEY)?.trim();
  return raw || ZS_MODEL;
}

export const agentModelStore = new Store<string>(load());

export function setAgentModel(id: string) {
  const next = id.trim();
  if (!next) return;
  agentModelStore.setState(() => next);
  prefs.set(KEY, next);
}
