import type { KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import { CANIX_URL } from '@/lib/theme';
import { paidRequest, type PaidResponse } from '@/lib/x402/request';

export type CanixResponse<T> = PaidResponse<T>;

/** Call Canix over x402. This wallet pays and signs; Canix does not submit. */
export async function canixRequest<T>(input: {
  store: Pick<KeyStoreAPI, 'sign'>;
  keyId: string;
  address: string;
  path: string;
  method?: string;
  body?: unknown;
}): Promise<CanixResponse<T>> {
  return paidRequest<T>({
    store: input.store,
    keyId: input.keyId,
    address: input.address,
    url: `${CANIX_URL}${input.path}`,
    method: input.method,
    body: input.body,
  });
}
