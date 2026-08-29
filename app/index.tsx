import { Redirect } from 'expo-router';
import { useProvider } from '@/hooks/useProvider';
import { findWalletAccount } from '@/lib/keystore/wallet-account';
import { LoadingScreen } from '@/components/LoadingScreen';

export default function Index() {
  const { keys, accounts, status } = useProvider();

  if (status === 'loading') return <LoadingScreen />;

  const wallet = findWalletAccount(accounts, keys);
  if (wallet) return <Redirect href="/home" />;
  return <Redirect href="/onboarding" />;
}
