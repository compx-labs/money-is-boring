import type {
  AuthenticationOptions,
  KeyStoreAPI,
} from '@algorandfoundation/react-native-keystore';
import { reuseAuth, transactionAuth } from '@/lib/keystore/auth-options';

export function authForTurnSign(
  signIndex: number,
  faceIdAtStart: boolean,
): AuthenticationOptions | undefined {
  if (faceIdAtStart) return signIndex === 0 ? transactionAuth : reuseAuth;
  if (signIndex === 0) return undefined;
  return signIndex === 1 ? transactionAuth : reuseAuth;
}

/** Face ID once per message when anything auto-signs; later hops reuse it. */
export function wrapTurnSigner(
  store: Pick<KeyStoreAPI, 'sign'>,
  faceIdAtStart: boolean,
): Pick<KeyStoreAPI, 'sign'> {
  let signIndex = 0;
  return {
    sign(keyId, data, metadata, options) {
      if (options) return store.sign(keyId, data, metadata, options);
      const auth = authForTurnSign(signIndex, faceIdAtStart);
      signIndex += 1;
      return store.sign(keyId, data, metadata, auth);
    },
  };
}
