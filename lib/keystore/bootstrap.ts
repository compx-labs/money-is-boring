import { keyStore } from '@/stores/keystore';

let activeBootstrap: Promise<void> | null = null;

async function runBootstrap() {
  keyStore.setState((state) => ({ ...state, status: 'loading' }));
  try {
    const { provider } = await import('@/app/_layout');
    await provider.key.store.ready;
    const keys = keyStore.state.keys;
    keyStore.setState((state) => ({
      ...state,
      status: keys.length > 0 ? 'ready' : 'idle',
    }));
  } catch {
    keyStore.setState((state) => ({ ...state, status: 'error' }));
  }
}

/** Wait for the keystore engine to hydrate metadata (no private keys in JS state). */
export async function bootstrap() {
  if (activeBootstrap) return activeBootstrap;
  activeBootstrap = runBootstrap().finally(() => {
    activeBootstrap = null;
  });
  return activeBootstrap;
}
