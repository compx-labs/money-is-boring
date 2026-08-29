/**
 * Side-effect: installs `global.crypto` (react-native-quick-crypto). MUST be
 * imported before any module pulling in `@noble/hashes` — which captures
 * `globalThis.crypto` at module-eval time.
 *
 * Pattern from perawallet/ac2-wallet (see VENDORED.md).
 */
import { install } from 'react-native-quick-crypto';

install();
