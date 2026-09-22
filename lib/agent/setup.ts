import { prefs } from '@/lib/prefs';

const LEGACY_KEY = 'agent.setupDone';
const PREFIX = 'agent.setupDone.';

function keyFor(address: string): string {
  return `${PREFIX}${address}`;
}

/** Drop the leftover global flag so this wallet can run setup again. */
function forgetLegacy(): void {
  prefs.remove(LEGACY_KEY);
}

export function isSetupDone(address: string): boolean {
  forgetLegacy();
  if (!address) return false;
  return prefs.getBoolean(keyFor(address)) === true;
}

export function markSetupDone(address: string): void {
  forgetLegacy();
  if (!address) return;
  prefs.set(keyFor(address), true);
}
