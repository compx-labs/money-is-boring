import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { replyFromToolResults } from '@/lib/agent/tool-reply';

describe('reply from tool results', () => {
  it('formats wallet_holdings when the model never spoke', () => {
    assert.equal(
      replyFromToolResults([
        {
          toolName: 'wallet_holdings',
          text: JSON.stringify({
            holdings: [
              { unit: 'ALGO', amount: 1.5, assetId: 0, decimals: 6 },
              { unit: 'USDC', amount: 12, assetId: 31566704, decimals: 6 },
            ],
          }),
        },
      ]),
      'ALGO 1.5\nUSDC 12',
    );
  });

  it('says empty when there are no amounts', () => {
    assert.equal(
      replyFromToolResults([
        { toolName: 'wallet_holdings', text: JSON.stringify({ holdings: [] }) },
      ]),
      'this wallet is empty',
    );
  });
});
