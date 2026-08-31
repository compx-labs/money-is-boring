import { useStore } from '@tanstack/react-store';
import { nicknamesStore } from '@/stores/nicknames';

export function useNickname(address: string): string | null {
  return useStore(nicknamesStore, (state) => (address ? (state[address] ?? null) : null));
}
