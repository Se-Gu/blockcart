import { Buffer } from "buffer";
import * as Crypto from "expo-crypto";

// Polyfill crypto.getRandomValues for tweetnacl
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.getRandomValues) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = {
    getRandomValues: (arr: Uint8Array): Uint8Array => {
      const randomBytes = Crypto.getRandomBytes(arr.length);
      arr.set(randomBytes);
      return arr;
    },
  };
}

if (typeof globalThis.Buffer === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Buffer = Buffer;
}
