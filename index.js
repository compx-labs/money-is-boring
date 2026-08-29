import 'react-native-gesture-handler';

// Polyfills MUST run before expo-router evaluates any route module.
// The keystore / wallet-provider import chain captures globalThis.crypto
// (via @noble/hashes) at module-eval time.
import './lib/runtime/install-crypto';
import './lib/runtime/install-buffer';

import 'expo-router/entry';
