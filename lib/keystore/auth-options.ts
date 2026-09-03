import type {
  AuthenticationOptions,
  ReactKeystoreOptions,
} from '@algorandfoundation/react-native-keystore';

export const biometricOptions: ReactKeystoreOptions['keystore']['authentication'] = {
  biometrics: true,
  prompt: 'Authenticate to access your wallet',
  authenticationValidityDuration: 30,
};

/**
 * Fresh Face ID/passcode for a chain signature. Duration 0 drops the iOS reuse
 * window so the prompt always shows; cancel/fail must abort before submit.
 */
export const transactionAuth: AuthenticationOptions = {
  biometrics: true,
  authenticationValidityDuration: 0,
  prompt: 'Authenticate to sign this transaction',
};

/**
 * Reuse a recent Face ID instead of prompting again. Settle runs after the
 * reply is already on screen; a second overlay there crashes native.
 */
export const reuseAuth: AuthenticationOptions = {
  biometrics: true,
  authenticationValidityDuration: 300,
  prompt: 'Authenticate to sign this transaction',
};

export function isAuthCanceled(err: unknown): boolean {
  const lower = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    lower.includes('user canceled') ||
    lower.includes('user cancelled') ||
    lower.includes('authentication canceled') ||
    lower.includes('authentication cancelled') ||
    lower.includes('canceled by the user') ||
    lower.includes('cancelled by the user') ||
    lower.includes('authentication failed') ||
    lower.includes('sign cancelled')
  );
}
