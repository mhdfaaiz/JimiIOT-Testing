/**
 * JT/T 808 codec helpers: unescape, escape, XOR checksum, BCD utilities.
 */

/**
 * Unescape a raw JT808 frame body (content between the 0x7E delimiters).
 * Rules:  0x7D 0x01 → 0x7D
 *         0x7D 0x02 → 0x7E
 */
export function unescapeJT808(buf) {
  const out = [];
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x7d && i + 1 < buf.length) {
      const n = buf[i + 1];
      if (n === 0x01) { out.push(0x7d); i++; continue; }
      if (n === 0x02) { out.push(0x7e); i++; continue; }
    }
    out.push(buf[i]);
  }
  return Buffer.from(out);
}

/**
 * Escape a buffer for transmission inside a JT808 frame.
 * Rules:  0x7E → 0x7D 0x02
 *         0x7D → 0x7D 0x01
 */
export function escapeJT808(buf) {
  const out = [];
  for (const b of buf) {
    if (b === 0x7e) { out.push(0x7d, 0x02); }
    else if (b === 0x7d) { out.push(0x7d, 0x01); }
    else out.push(b);
  }
  return Buffer.from(out);
}

/**
 * XOR checksum over all bytes in buf.
 */
export function xorChecksum(buf) {
  let c = 0;
  for (const b of buf) c ^= b;
  return c & 0xff;
}

/**
 * Convert a BCD buffer to a hex string of digits.
 * E.g. Buffer [0x24, 0x05, 0x01, 0x12, 0x30, 0x00] → "240501123000"
 */
export function bcdToString(bcdBuf) {
  return Array.from(bcdBuf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Parse a 6-byte BCD timestamp (YYMMDDhhmmss, UTC) and return an ISO string.
 */
export function parseBcdTimeYYMMDDhhmmss(bcd6) {
  const s = bcdToString(bcd6); // "YYMMDDhhmmss"
  const year = 2000 + Number(s.slice(0, 2));
  const mo   = Number(s.slice(2, 4));
  const dd   = Number(s.slice(4, 6));
  const hh   = Number(s.slice(6, 8));
  const mm   = Number(s.slice(8, 10));
  const ss   = Number(s.slice(10, 12));
  return new Date(Date.UTC(year, mo - 1, dd, hh, mm, ss)).toISOString();
}
