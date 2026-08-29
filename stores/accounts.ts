import type { Account, AccountStoreState } from '@algorandfoundation/accounts-store';
import type { KeystoreAccount } from '@algorandfoundation/accounts-keystore-extension';
import { Store } from '@tanstack/react-store';

export const accountsStore = new Store<AccountStoreState<Account | KeystoreAccount>>({
  accounts: [],
});
