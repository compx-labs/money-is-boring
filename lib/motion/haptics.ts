import * as Haptics from 'expo-haptics';

function run(play: () => Promise<unknown>): void {
  void play().catch(() => {
    // OS haptic-off and missing hardware are silent no-ops.
  });
}

/** Light tick when a control seats (press / toggle that lands). */
export function tick(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Soft thud when a bottom card docks. */
export function thud(): void {
  run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
}
