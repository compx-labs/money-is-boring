import type { ChatTurn, NotebookHit, ProfilePref } from '@/lib/notebook/types';
import { NOTEBOOK_HIT_LIMIT, NOTEBOOK_LAST_TURNS } from '@/lib/notebook/types';

const LIVE_REMINDER =
  'Live balances, prices, and positions are not stored here. Fetch them now with tools.';

const LABELS: Record<string, string> = {
  preferred_asset: 'preferred asset',
  risk: 'risk',
  slippage: 'slippage',
  nickname: 'nickname',
  language: 'language',
  timezone: 'timezone',
};

function oneLine(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Short standing-pref lines plus 3–5 note hits. Not a JSON blob. */
export function formatNotebookPreamble(profile: ProfilePref[], hits: NotebookHit[]): string {
  const lines: string[] = [];
  const prefs = profile.slice(0, 8);
  if (prefs.length > 0) {
    lines.push('Standing prefs:');
    for (const pref of prefs) {
      const label = LABELS[pref.key] ?? pref.key;
      lines.push(`${label}: ${oneLine(pref.value, 80)}`);
    }
  }

  const notes = hits.slice(0, NOTEBOOK_HIT_LIMIT);
  if (notes.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push('Related notes:');
    for (const note of notes) {
      const tags = note.tags.trim();
      const suffix = tags ? ` (${oneLine(tags, 40)})` : '';
      lines.push(`- ${oneLine(note.body, 200)}${suffix}`);
    }
  }

  if (lines.length === 0) {
    return `No standing prefs or notes. ${LIVE_REMINDER}`;
  }
  return `${lines.join('\n')}\n\n${LIVE_REMINDER}`;
}

export function lastTurns(history: ChatTurn[], k = NOTEBOOK_LAST_TURNS): ChatTurn[] {
  if (k <= 0) return [];
  const max = k * 2;
  return history.length <= max ? history : history.slice(-max);
}

export function composeAgentInput(args: {
  system: string;
  profile: ProfilePref[];
  hits: NotebookHit[];
  history: ChatTurn[];
  lastTurns?: number;
}): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const preamble = formatNotebookPreamble(args.profile, args.hits);
  const turns = lastTurns(args.history, args.lastTurns ?? NOTEBOOK_LAST_TURNS);
  return [
    { role: 'system', content: `${args.system}\n\n${preamble}` },
    ...turns.map((turn) => ({ role: turn.role, content: turn.text })),
  ];
}
