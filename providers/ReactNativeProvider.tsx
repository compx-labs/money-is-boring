import { createContext, type ReactNode } from 'react';
import { Provider } from '@algorandfoundation/wallet-provider';
import { WithKeyStore } from '@algorandfoundation/react-native-keystore';
import type { Key, KeyStoreAPI } from '@algorandfoundation/react-native-keystore';
import {
  type Account,
  type AccountStoreExtension,
  WithAccountStore,
} from '@algorandfoundation/accounts-store';
import {
  type KeystoreAccount,
  WithAccountsKeystore,
} from '@algorandfoundation/accounts-keystore-extension';
import type { keyStoreHooks } from '@/stores/before-after';

export class ReactNativeProvider extends Provider<typeof ReactNativeProvider.EXTENSIONS> {
  static EXTENSIONS = [WithKeyStore, WithAccountStore, WithAccountsKeystore] as const;

  keys!: Key[];
  accounts!: Account[];
  status!: string;

  account!: AccountStoreExtension<Account | KeystoreAccount>['account'];

  key!: {
    store: KeyStoreAPI & {
      clear: () => Promise<void>;
      hooks: typeof keyStoreHooks;
      ready: Promise<void>;
    };
  };
}

export const WalletProviderContext = createContext<ReactNativeProvider | null>(null);

export function WalletProvider({
  children,
  provider,
}: {
  children: ReactNode;
  provider: ReactNativeProvider;
}) {
  return (
    <WalletProviderContext.Provider value={provider}>{children}</WalletProviderContext.Provider>
  );
}
