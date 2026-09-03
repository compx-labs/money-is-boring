import { isValidAddress } from 'algosdk';

export function isAlgorandAddress(value: string): boolean {
  return isValidAddress(value.trim());
}
