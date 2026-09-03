import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { humanPayError } from '@/lib/zerosignal/errors';
import { isSignStep, payStepAction, payStepLabel, reducePayEvent, type PayStepRow } from '@/lib/zerosignal/pay';

describe('pay step labels', () => {
  it('uses human copy, not protocol jargon', () => {
    assert.equal(payStepLabel('discover'), 'finding a node');
    assert.equal(payStepLabel('reserve'), 'approve this call');
    assert.equal(payStepLabel('fundPool'), 'deposit 0.5 ALGO for the ticket pool');
    assert.equal(payStepAction('fundPool'), 'deposit 0.5 ALGO');
    assert.equal(payStepLabel('openEscrow'), 'lock up to 0.10 USDC');
    assert.equal(payStepLabel('openEscrow', '0.002'), 'lock up to 0.002 USDC');
    assert.equal(payStepLabel('think'), 'thinking');
    assert.equal(payStepLabel('settle'), 'charging');
    assert.equal(payStepLabel('tool:wallet_holdings'), 'wallet_holdings');
    assert.equal(isSignStep('reserve'), true);
    assert.equal(isSignStep('settle'), false);
    assert.equal(isSignStep('think'), false);
  });
});

describe('human pay errors', () => {
  it('maps known protocol failures to short lines', () => {
    assert.equal(humanPayError(new Error('No live ZeroSignal node serving glm-4.7-flash')), 'no live node right now');
    assert.equal(humanPayError(new Error('ZeroSignal ticket is expired or too close to expiry')), 'the quote expired. try again');
    assert.equal(
      humanPayError(new Error('ZeroSignal quote 200000 microUSDC exceeds the 0.10 USDC cap')),
      'this call is over the 0.10 USDC cap',
    );
    assert.equal(humanPayError(new Error('logic eval error: no mbr deposit')), 'add ALGO for the ticket pool');
    assert.equal(humanPayError(new Error('transaction underflow on asset 31566704')), 'not enough USDC for this call');
    assert.equal(humanPayError(new Error('User canceled authentication')), 'sign cancelled');
    assert.equal(
      humanPayError(
        new Error(
          'failed to open sealed reserve request: open sealed reserve envelope: age decrypt: failed to read header: parsing age header: unexpected EOF reading intro: "[object ReadableStream" (400)',
        ),
      ),
      'could not seal this call. try again',
    );
    assert.equal(humanPayError(new Error('ZeroSignal returned no text')), 'no reply. try again');
    assert.equal(humanPayError(new Error('commit_k mismatch')), 'this call could not be opened. try again');
    assert.equal(humanPayError(new Error('reserve missing presigned_open_txn')), 'this call could not be opened. try again');
  });

  it('does not dump long raw messages', () => {
    const long = new Error(`x${'y'.repeat(120)}`);
    assert.equal(humanPayError(long), 'this call failed. try again');
  });
});

describe('pay event reducer', () => {
  it('appends the active step and completes the previous one', () => {
    let steps: PayStepRow[] = [];
    steps = reducePayEvent(steps, { type: 'step', step: 'discover' }).steps;
    steps = reducePayEvent(steps, { type: 'step', step: 'reserve' }).steps;
    assert.deepEqual(
      steps.map((row) => [row.step, row.state]),
      [
        ['discover', 'done'],
        ['reserve', 'active'],
      ],
    );
  });

  it('marks the active step as error', () => {
    let steps: PayStepRow[] = [];
    steps = reducePayEvent(steps, { type: 'step', step: 'discover' }).steps;
    const failed = reducePayEvent(steps, { type: 'error', step: 'discover', message: 'no live node right now' });
    assert.equal(failed.error, 'no live node right now');
    assert.equal(failed.steps[0]?.state, 'error');
  });

  it('keeps a settle warning without changing steps', () => {
    const steps: PayStepRow[] = [{ step: 'think', state: 'active' }];
    const warned = reducePayEvent(steps, {
      type: 'warning',
      step: 'settle',
      message: 'charge will finish on-chain',
    });
    assert.equal(warned.warning, 'charge will finish on-chain');
    assert.equal(warned.steps[0]?.state, 'active');
  });
});
