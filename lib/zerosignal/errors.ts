const MAX_SHEET_LINE = 80;

function rawMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Short sheet line. Never dump protocol field names. */
export function humanPayError(err: unknown): string {
  const raw = rawMessage(err);
  const lower = raw.toLowerCase();

  if (lower.includes('no live zerosignal node')) return 'no live node right now';
  if (lower.includes('expired or too close')) return 'the quote expired. try again';
  if (lower.includes('exceeds the 0.10') || lower.includes('exceeds the 0.10 usdc')) {
    return 'this call is over the 0.10 USDC cap';
  }
  if (lower.includes('mbr deposit') || lower.includes('no mbr')) {
    return 'add ALGO for the ticket pool';
  }
  if (
    lower.includes('underflow') ||
    lower.includes('under-spend') ||
    lower.includes('underspend') ||
    lower.includes('overspend') ||
    lower.includes('insufficient') ||
    lower.includes('balance too low')
  ) {
    if (lower.includes('asset') || lower.includes('usdc') || lower.includes('axfer')) {
      return 'not enough USDC for this call';
    }
    return 'not enough ALGO for fees';
  }
  if (
    lower.includes('sign cancelled') ||
    lower.includes('user canceled') ||
    lower.includes('user cancelled') ||
    lower.includes('authentication canceled') ||
    lower.includes('authentication cancelled') ||
    lower.includes('canceled by the user') ||
    lower.includes('cancelled by the user')
  ) {
    return 'sign cancelled';
  }
  if (lower.includes('readablestream') || lower.includes('parsing age header')) {
    return 'could not seal this call. try again';
  }
  if (lower.includes('returned no text')) return 'no reply. try again';
  if (lower.includes('inference failed')) return 'the node did not answer. try again';
  if (
    lower.includes('commit_k') ||
    lower.includes('presigned') ||
    lower.includes('wrapped_response_key') ||
    lower.includes('open group') ||
    lower.includes('ticket is for a different') ||
    lower.includes('ticket model') ||
    lower.includes('ticket output') ||
    lower.includes('signature failed')
  ) {
    return 'this call could not be opened. try again';
  }

  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (!trimmed) return 'this call failed. try again';
  if (trimmed.length > MAX_SHEET_LINE) return 'this call failed. try again';
  return trimmed.toLowerCase();
}
