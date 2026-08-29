# Money is Boring

Money is boring. This isn’t.

MIB is a CompX Algorand wallet. This pass is a small Expo app: passkey-style device unlock, one normal Ed25519 account, a sitting gray cube, ALGO + USDC.

It is **not** a fork of Rocca, AC2 Wallet, or Pera. See [VENDORED.md](VENDORED.md) for the Foundation/AC2 plumbing we adapted.

## What this pass does

1. Builds as an Expo / React Native app (native keystore — **physical device**, not Expo Go).
2. First open: cube, “money is boring.”, **Create with passkey**.
3. Create path: biometric / PIN unlocks the vault → sealed CSPRNG seed (never shown as 24 words) → XHD `m/44'/283'/0'/0/0` → `hd-derived-ed25519`.
4. Home: cube, address, ALGO + USDC (ASA `31566704` on mainnet). Junk ASAs are omitted.
5. Keys stay in the device Keychain/MMKV via `@algorandfoundation/react-native-keystore`. CompX never holds keys. The app does not log seeds or private keys.

Recovery copy is a one-liner: a second passkey / iCloud restore comes later. This device holds the key.

## What this pass does not do

Falcon-1024 / native PQ accounts, Canix, ZeroSignal, in-app agent, AC2 approvals, seed-phrase backup UI, Liquid Auth.

OS WebAuthn passkeys in the Foundation stack are deterministic P-256. They cannot parent an Ed25519 Algorand key. “Create with passkey” means biometric unlock of the vault, then HD derivation from a sealed seed.

## Run on a physical Android device

Emulators often fail with `react-native-quick-crypto` and the Foundation keystore. Use a real phone.

```bash
pnpm install
pnpm prebuild
pnpm android
```

Requirements:

- Node 22+, pnpm 10
- Android SDK / platform tools
- Device authorized with `adb devices`
- `expo prebuild` (this repo gitignores generated `android/` and `ios/`)

iOS: `pnpm ios` on a Mac after prebuild. Face ID usage string is in `app.config.js`.

Do not use Expo Go. Native modules must be compiled into a dev client.

## Stack (pinned)

npm `latest` tags for several `@algorandfoundation/*` packages are empty placeholders. This app pins canaries:

| Package | Version |
| --- | --- |
| Expo / RN | 54 / 0.81.5 |
| `@algorandfoundation/wallet-provider` | `1.0.0-canary.5` |
| `@algorandfoundation/react-native-keystore` | `1.0.0-canary.19` |
| `@algorandfoundation/accounts-store` | `1.0.0-canary.2` |
| `@algorandfoundation/accounts-keystore-extension` | `1.0.0-canary.10` |
| `algosdk` | `3.7.0` |

`patches/react-native-keychain+10.0.0.patch` is required (BouncyCastle vs quick-crypto, biometric reuse window). Applied by `patch-package` on install.

License: Apache-2.0.

## Verified in this repo (no device attached here)

- `pnpm install` + keychain patch applies.
- `pnpm type-check` (`tsc --noEmit`) succeeds against the canary APIs above.
- Create path types: `importSeed` → `generate({ type: "hd-root-key" })` → `deriveFromSeed("m/44'/283'/0'/0/0")`.
- Algorand address is `algosdk.encodeAddress(publicKey)`. The accounts-keystore bridge stores a base64 pubkey in `account.address`; we do not use that as the on-chain address.

Not verified here: biometric prompt and `expo run:android` on hardware. That needs your phone.
