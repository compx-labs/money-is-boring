import { Store } from '@tanstack/react-store';
import { confirmPrefOn, type AgentConfirmPrefs } from '@/lib/agent/confirm';
import { prefs } from '@/lib/prefs';

const TOOLS_KEY = 'agent.confirmTools';
const INFERENCE_KEY = 'agent.confirmInference';
const HINT_KEY = 'agent.confirmHintShown';

function loadOn(key: string): boolean {
  if (!prefs.contains(key)) return true;
  return confirmPrefOn(prefs.getBoolean(key));
}

function load(): AgentConfirmPrefs {
  return {
    confirmTools: loadOn(TOOLS_KEY),
    confirmInference: loadOn(INFERENCE_KEY),
    hintShown: prefs.getBoolean(HINT_KEY) === true,
  };
}

export const agentConfirmStore = new Store<AgentConfirmPrefs>(load());

export function setConfirmTools(value: boolean) {
  agentConfirmStore.setState((state) => ({ ...state, confirmTools: value }));
  prefs.set(TOOLS_KEY, value);
}

export function setConfirmInference(value: boolean) {
  agentConfirmStore.setState((state) => ({ ...state, confirmInference: value }));
  prefs.set(INFERENCE_KEY, value);
}

export function markConfirmHintShown() {
  agentConfirmStore.setState((state) => ({ ...state, hintShown: true }));
  prefs.set(HINT_KEY, true);
}
