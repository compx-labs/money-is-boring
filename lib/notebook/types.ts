export type ChatTurn = { role: 'user' | 'assistant'; text: string };

export type ProfilePref = { key: string; value: string };

export type NotebookHit = {
  id: number;
  body: string;
  tags: string;
};

export type NotebookContext = {
  profile: ProfilePref[];
  hits: NotebookHit[];
};

/** Standing prefs injected on every call. A handful, not a dump. */
export const PROFILE_KEYS = [
  'preferred_asset',
  'risk',
  'slippage',
  'nickname',
  'language',
  'timezone',
] as const;

export type ProfileKey = (typeof PROFILE_KEYS)[number];

export function isProfileKey(value: string): value is ProfileKey {
  return (PROFILE_KEYS as readonly string[]).includes(value);
}

/** Caps: 3–5 FTS hits, last K user/assistant turns. */
export const NOTEBOOK_HIT_LIMIT = 5;
export const NOTEBOOK_LAST_TURNS = 6;

/** Skip live-chain-shaped keys even if they were written somehow. */
export const BLOCKED_MEMORY_KEY =
  /\b(balance|price|prices|position|positions|holdings|seed|mnemonic|private|pin|passcode)\b/i;
