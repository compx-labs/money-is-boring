import { sha512 } from '@noble/hashes/sha2.js';
import * as ed25519 from '@noble/ed25519';

ed25519.hashes.sha512 = sha512;

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function b64Encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function b64Decode(s: string): Uint8Array {
  return Uint8Array.from(Buffer.from(s, 'base64'));
}

export function verifyEd25519(sig: Uint8Array, message: Uint8Array, pub: Uint8Array): boolean {
  return ed25519.verify(sig, message, pub);
}
