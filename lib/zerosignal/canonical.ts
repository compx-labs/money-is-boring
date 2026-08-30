import { concatBytes, utf8 } from '@/lib/zerosignal/bytes';

/** Big-endian length-prefixed strings and integers for ZeroSignal signatures. */
export class CanonicalWriter {
  private chunks: Uint8Array[] = [];

  str(s: string): this {
    this.chunks.push(utf8(s));
    return this;
  }

  u64(v: number | bigint): this {
    const buf = new Uint8Array(8);
    new DataView(buf.buffer).setBigUint64(0, BigInt(v), false);
    this.chunks.push(buf);
    return this;
  }

  u8(v: number): this {
    this.chunks.push(new Uint8Array([v & 0xff]));
    return this;
  }

  i64(v: number | bigint): this {
    const buf = new Uint8Array(8);
    new DataView(buf.buffer).setBigUint64(0, BigInt.asUintN(64, BigInt(v)), false);
    this.chunks.push(buf);
    return this;
  }

  lenStr(s: string): this {
    const body = utf8(s);
    const lenBuf = new Uint8Array(4);
    new DataView(lenBuf.buffer).setUint32(0, body.length, false);
    this.chunks.push(lenBuf, body);
    return this;
  }

  bool(v: boolean): this {
    this.chunks.push(new Uint8Array([v ? 1 : 0]));
    return this;
  }

  finish(): Uint8Array {
    return concatBytes(...this.chunks);
  }
}
