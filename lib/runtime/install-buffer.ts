/**
 * Side-effect: installs `global.Buffer`. Hermes does not provide it.
 * Pattern from perawallet/ac2-wallet (see VENDORED.md).
 */
import { Buffer } from 'buffer';

if (typeof (globalThis as { Buffer?: unknown }).Buffer === 'undefined') {
  (globalThis as { Buffer?: unknown }).Buffer = Buffer;
}
