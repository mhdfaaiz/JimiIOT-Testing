/**
 * JT/T 1078 subpacket reassembler.
 *
 * subFlag (low nibble of type byte at offset 15 in each JT1078 packet):
 *   0x00 = complete packet (no fragmentation)
 *   0x01 = first sub-packet of a fragmented series
 *   0x02 = last  sub-packet of a fragmented series
 *   0x03 = middle sub-packet of a fragmented series
 */
export class JT1078Reassembler {
  constructor() {
    // key: "deviceId:channel" → { buffers: Buffer[], payloadType: string }
    this._pending = new Map();
  }

  /**
   * Push a parsed JT1078 packet.
   *
   * @param {{ deviceId: string, channel: number, subFlag: number,
   *           payloadType: string, seq: number, dataBody: Buffer }} packet
   * @returns {{ deviceId: string, channel: number, payloadType: string, data: Buffer } | null}
   *   A complete assembled frame, or null if more sub-packets are needed.
   */
  push(packet) {
    const { deviceId, channel, subFlag, payloadType, dataBody } = packet;
    const key = `${deviceId}:${channel}`;

    switch (subFlag) {
      case 0x00: {                                          // complete — no fragmentation
        this._pending.delete(key);
        return { deviceId, channel, payloadType, data: Buffer.from(dataBody) };
      }
      case 0x01: {                                          // first sub-packet
        this._pending.set(key, { buffers: [Buffer.from(dataBody)], payloadType });
        return null;
      }
      case 0x03: {                                          // middle sub-packet
        const st = this._pending.get(key);
        if (!st) return null;                               // orphaned — discard
        st.buffers.push(Buffer.from(dataBody));
        return null;
      }
      case 0x02: {                                          // last sub-packet
        const st = this._pending.get(key);
        if (!st) return null;                               // orphaned — discard
        st.buffers.push(Buffer.from(dataBody));
        const data = Buffer.concat(st.buffers);
        this._pending.delete(key);
        return { deviceId, channel, payloadType: st.payloadType, data };
      }
      default:
        return null;
    }
  }
}
