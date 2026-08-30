import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';

/**
 * On-device approval for a Canix spend. `authenticationValidityDuration: 0`
 * asks iOS to prompt again instead of reusing the app-wide 30s window.
 * Android bakes duration into the master-key item at creation; the distinct
 * prompt still marks this as a spend, not a chat-ticket unlock.
 */
export async function signWithAc2(
  store: Pick<KeyStoreAPI, 'sign'>,
  keyId: string,
  data: Uint8Array,
  prompt = 'Approve this Canix spend',
): Promise<Uint8Array> {
  return store.sign(keyId, data, undefined, {
    biometrics: true,
    prompt,
    authenticationValidityDuration: 0,
  });
}
