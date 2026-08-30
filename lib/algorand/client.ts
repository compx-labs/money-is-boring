import { Algodv2 } from 'algosdk';
import { ALGOD_URL } from '@/lib/theme';

export function algod(): Algodv2 {
  return new Algodv2('', ALGOD_URL, '');
}
