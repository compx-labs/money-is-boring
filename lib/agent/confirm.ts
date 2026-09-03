export type AgentConfirmPrefs = {
  confirmTools: boolean;
  confirmInference: boolean;
  hintShown: boolean;
};

export const CONFIRM_HINT =
  'you can turn tool and spend confirmations off in settings, via the cog in the top left';

export const BOTH_OFF_FOOTNOTE =
  'Face ID once at the start of each message, then the agent can lock USDC and run tools without further taps.';

/** Missing prefs keys mean on. */
export function confirmPrefOn(raw: boolean | undefined | null): boolean {
  return raw !== false;
}

export function bothConfirmsOff(
  prefs: Pick<AgentConfirmPrefs, 'confirmTools' | 'confirmInference'>,
): boolean {
  return !prefs.confirmTools && !prefs.confirmInference;
}

export function shouldFaceIdAtTurnStart(
  prefs: Pick<AgentConfirmPrefs, 'confirmTools' | 'confirmInference'>,
): boolean {
  return !prefs.confirmTools || !prefs.confirmInference;
}

export function shouldShowConfirmHint(prefs: AgentConfirmPrefs): boolean {
  return prefs.confirmTools && prefs.confirmInference && !prefs.hintShown;
}
