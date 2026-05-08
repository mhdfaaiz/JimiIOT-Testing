import dgram from "dgram";

// JT/T 1078 packet header identifier: 0x30 0x31 0x63 0x64 (ASCII "01cd")
const HEADER_ID = Buffer.from([0x30, 0x31, 0x63, 0x64]);

/**
 * Payload type nibble values (high nibble of byte 15):
 *   0=I-frame, 1=P-frame, 2=B-frame, 3=audio, 4=passthrough
 */
const PAYLOAD_TYPE_NAMES = {
  0x0: "video-I",
  0x1: "video-P",
  0x2: "video-B",
  0x3: "audio",
  0x4: "passthrough"
};

/**
 * Start the JT/T 1078 UDP receiver.
 *
 * @param {object} opts
 * @param {number}   opts.port      - UDP port to listen on (default 7001).
 * @param {Function} opts.onPacket  - Called with parsed packet metadata.
 * @param {Function} opts.onLog     - Called with a log string.
 */
export function startJT1078Udp({ port, onPacket, onLog }) {
  const sock = dgram.createSocket("udp4");

  sock.on("message", (msg, rinfo) => {
    try {
      // Minimum packet size: 4 (header id) + 2 (reserved) + 2 (seq) + 6 (SIM) +
      //                      1 (channel) + 1 (type/flag) + 8 (timestamp) + 2 (len) = 26 bytes
      if (msg.length < 26) return;

      // Check header identifier "01cd"
      if (!msg.subarray(0, 4).equals(HEADER_ID)) return;

      // Bytes 4–5: reserved (skip)
      const seq       = msg.readUInt16BE(6);                  // sequence number
      const bcd6      = msg.subarray(8, 14);                  // SIM / device ID (BCD[6])
      const deviceId  = Array.from(bcd6).map((b) => b.toString(16).padStart(2, "0")).join("");
      const channel   = msg.readUInt8(14);                    // logical channel number

      const typeByte      = msg.readUInt8(15);
      const payloadNibble = (typeByte >> 4) & 0x0f;          // high nibble = payload type
      const subFlag       = typeByte & 0x0f;                 // low  nibble = subpacket flag

      const payloadType = PAYLOAD_TYPE_NAMES[payloadNibble] ?? `0x${payloadNibble.toString(16)}`;

      // JT/T 1078-2016 structure: if video/audio, body length is at offset 28. If passthrough, offset 24.
      let bodyLenOffset = 28;
      let bodyOffset = 30;
      if (payloadNibble === 4) {
        bodyLenOffset = 24;
        bodyOffset = 26;
      }
      
      if (msg.length < bodyLenOffset + 2) return;
      const bodyLen = msg.readUInt16BE(bodyLenOffset);
      
      if (msg.length < bodyOffset + bodyLen) return;
      const dataBody = msg.subarray(bodyOffset, bodyOffset + bodyLen);

      onLog?.(
        `pkt seq=${seq} device=${deviceId} ch=${channel} type=${payloadType} subFlag=${subFlag} size=${dataBody.length}`
      );

      onPacket?.({ deviceId, channel, payloadType, subFlag, seq, dataBody });
    } catch (e) {
      onLog?.(`parse error from ${rinfo.address}:${rinfo.port}: ${e.message}`);
    }
  });

  sock.on("listening", () => {
    const a = sock.address();
    onLog?.(`JT1078 UDP listening on ${a.address}:${a.port}`);
  });

  sock.on("error", (e) => onLog?.(`UDP socket error: ${e.message}`));

  sock.bind(port);
  return sock;
}
