/** If the model called tools and never spoke, show the tool result instead of failing. */
export function replyFromToolResults(
  results: Array<{ toolName: string; text: string; isError?: boolean }>,
): string {
  const chunks: string[] = [];
  for (const result of results) {
    if (result.isError || !result.text) continue;
    if (result.toolName === 'wallet_holdings') chunks.push(formatHoldingsReply(result.text));
  }
  return chunks.join('\n').trim();
}

function formatHoldingsReply(raw: string): string {
  try {
    const body = JSON.parse(raw) as {
      error?: unknown;
      holdings?: Array<{ unit?: unknown; amount?: unknown }>;
    };
    if (body.error) return String(body.error);
    const rows = (body.holdings ?? []).filter((row) => row.amount != null);
    if (!rows.length) return 'this wallet is empty';
    return rows.map((row) => `${String(row.unit ?? '?')} ${String(row.amount)}`).join('\n');
  } catch {
    return raw.trim();
  }
}
