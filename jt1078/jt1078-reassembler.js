/**
 * JT/T 1078 subpacket reassembler.
 *
 * JT1078 subpacket flag (low nibble of the type byte):
 *   0x0 – atomic packet (complete frame, no subpackets)
 *   0x1 – first subpacket of a multi-part frame
 *   0x3 – middle subpacket
 *   0x2 – last subpacket (frame complete)
 *
 * Multiple physical JT1078 packets with flag=1/3/2 together form one logical video frame.
 * This class reassembles them and emits a complete frame when all parts have arrived.
 */

const MAX_BUFFER_BYTES = 2 * 1024 * 1024; // 2 MB safety cap per channel
const STALE_TIMEOUT_MS = 5_000;            // discard incomplete frames after 5 s

export class FrameReassembler {
  /**
   * @param {object} [opts]
   * @param {Function} [opts.onLog] - optional log callback
   */
  constructor({ onLog } = {}) {
    this._onLog = onLog;
    // key: `${deviceId}-${channel}` → { bufs: Buffer[], startTs: number, payloadType: string }
    this._pending = new Map();

    this._timer = setInterval(() => this._cleanup(), 10_000);
    // Allow process to exit even if timer is active
    if (this._timer.unref) this._timer.unref();
  }

  /**
   * Process one parsed JT1078 packet.
   * Returns a complete-frame descriptor when the frame is ready, or null if more data is needed.
   *
   * @param {{ deviceId, channel, subFlag, payloadType, dataBody: Buffer }} packet
   * @returns {{ deviceId, channel, payloadType, data: Buffer } | null}
   */
  process(packet) {
    const { deviceId, channel, subFlag, payloadType, dataBody } = packet;
    const key = `${deviceId}-${channel}`;

    // Atomic (no subpackets) – pass straight through
    if (subFlag === 0) {
      return { deviceId, channel, payloadType, data: dataBody };
    }

    // First subpacket – start a new accumulation buffer
    if (subFlag === 1) {
      this._pending.set(key, {
        bufs: [dataBody],
        startTs: Date.now(),
        payloadType
      });
      return null;
    }

    // Middle (3) or last (2) subpacket
    if (subFlag === 3 || subFlag === 2) {
      const p = this._pending.get(key);
      if (!p) {
        // Middle/last arrived without a preceding first – discard
        this._onLog?.(`reassembler: orphan subpkt(${subFlag}) for ${key}, discarding`);
        return null;
      }

      p.bufs.push(dataBody);

      // Safety cap: drop the frame if it grows too large
      const total = p.bufs.reduce((s, b) => s + b.length, 0);
      if (total > MAX_BUFFER_BYTES) {
        this._onLog?.(`reassembler: buffer cap exceeded for ${key} (${total} bytes), dropping frame`);
        this._pending.delete(key);
        return null;
      }

      // Last subpacket – emit the complete frame
      if (subFlag === 2) {
        const data = Buffer.concat(p.bufs);
        this._pending.delete(key);
        return { deviceId, channel, payloadType: p.payloadType, data };
      }

      return null;
    }

    this._onLog?.(`reassembler: unknown subFlag=${subFlag} for ${key}`);
    return null;
  }

  /** Clean up stale incomplete frames. */
  _cleanup() {
    const now = Date.now();
    for (const [key, p] of this._pending.entries()) {
      if (now - p.startTs > STALE_TIMEOUT_MS) {
        this._onLog?.(`reassembler: stale incomplete frame for ${key}, discarding`);
        this._pending.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this._timer);
    this._pending.clear();
  }
}
