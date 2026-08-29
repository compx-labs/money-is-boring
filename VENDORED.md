# Vendored / copied provenance

This app is a new Expo project. It is **not** a fork of Rocca, AC2 Wallet, or Pera.

Patterns (not wholesale product screens) were adapted from:

| Source | Commit | What we took |
| --- | --- | --- |
| [perawallet/ac2-wallet](https://github.com/perawallet/ac2-wallet) | `c0b15d7ceb865374f2cd1c17bb69f5f461322b2a` | Provider + keystore bootstrap shape (`WithKeyStore` / `WithAccountStore` / `WithAccountsKeystore`), `install-crypto` / `install-buffer` entry polyfills, Metro `crypto` → `react-native-quick-crypto`, XHD derive path (`importSeed` → `hd-root-key` → `m/44'/283'/0'/0/0`), biometric `AuthenticationOptions`, `patches/react-native-keychain+10.0.0.patch` (BouncyCastle ordering + `authenticationValidityDuration`) |

**Not copied:** Aura/DID/24-word onboarding, Liquid Auth native module, passkey Autofill, identities, Sentry, NativeWind, Falcon bindings.

Direction is one-way: read upstream, rewrite here. Do not submodule those repos as this product.
