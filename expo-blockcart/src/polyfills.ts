import { Buffer } from "buffer";

if (typeof globalThis.Buffer === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Buffer = Buffer;
}
