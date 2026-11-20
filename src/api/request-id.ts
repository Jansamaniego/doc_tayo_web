const HEX = (byte: number): string => byte.toString(16).padStart(2, '0');

/** A UUID version 7 (time-ordered). The API honours a client X-Request-Id only if canonical. */
export function newRequestId({ now = Date.now() }: { now?: number } = {}): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // 48-bit millisecond timestamp, big-endian.
  let time = BigInt(now);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(time & 0xffn);
    time >>= 8n;
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70; // version 7
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, HEX).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
