import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BOTH_OFF_FOOTNOTE,
  bothConfirmsOff,
  confirmPrefOn,
  CONFIRM_HINT,
  shouldFaceIdAtTurnStart,
  shouldShowConfirmHint,
} from '@/lib/agent/confirm';
import { spokenHistory } from '@/lib/agent/history';

describe('agent confirm prefs', () => {
  it('treats missing keys as on', () => {
    assert.equal(confirmPrefOn(undefined), true);
    assert.equal(confirmPrefOn(null), true);
    assert.equal(confirmPrefOn(true), true);
    assert.equal(confirmPrefOn(false), false);
  });

  it('shows the both-off footnote only when tools and inference are off', () => {
    assert.equal(bothConfirmsOff({ confirmTools: false, confirmInference: false }), true);
    assert.equal(bothConfirmsOff({ confirmTools: true, confirmInference: false }), false);
    assert.equal(bothConfirmsOff({ confirmTools: false, confirmInference: true }), false);
    assert.equal(bothConfirmsOff({ confirmTools: true, confirmInference: true }), false);
    assert.match(BOTH_OFF_FOOTNOTE, /Face ID once/);
  });

  it('Face IDs at turn start when either confirm is off', () => {
    assert.equal(shouldFaceIdAtTurnStart({ confirmTools: true, confirmInference: true }), false);
    assert.equal(shouldFaceIdAtTurnStart({ confirmTools: false, confirmInference: true }), true);
    assert.equal(shouldFaceIdAtTurnStart({ confirmTools: true, confirmInference: false }), true);
    assert.equal(shouldFaceIdAtTurnStart({ confirmTools: false, confirmInference: false }), true);
  });
});

describe('confirm hint', () => {
  it('shows once while confirms are still default-on', () => {
    assert.equal(
      shouldShowConfirmHint({ confirmTools: true, confirmInference: true, hintShown: false }),
      true,
    );
    assert.equal(
      shouldShowConfirmHint({ confirmTools: true, confirmInference: true, hintShown: true }),
      false,
    );
    assert.equal(
      shouldShowConfirmHint({ confirmTools: false, confirmInference: true, hintShown: false }),
      false,
    );
  });

  it('omits system hints from ZeroSignal history', () => {
    const history = [
      { role: 'user' as const, text: 'hi' },
      { role: 'assistant' as const, text: 'hello' },
      { role: 'system' as const, text: CONFIRM_HINT },
      { role: 'user' as const, text: 'again' },
    ];
    assert.deepEqual(
      spokenHistory(history).map((turn) => turn.text),
      ['hi', 'hello', 'again'],
    );
  });
});
