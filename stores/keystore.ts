import { Store } from '@tanstack/react-store';
import type { KeyStoreState } from '@algorandfoundation/react-native-keystore';

export const keyStore = new Store<KeyStoreState>({
  keys: [],
  status: 'loading',
});
