import net from "net";

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

function parsePacket(msg) {
  // Minimum packet size in our current parser layout.
  if (msg.length < 26) return null;

  // Check header identifier "01cd"
  if (!msg.subarray(0, 4).equals(HEADER_ID)) return null;

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
  
  // Make sure we have enough data to read the body length
  if (msg.length < bodyLenOffset + 2) return null;

  const bodyLen = msg.readUInt16BE(bodyLenOffset);
  if (msg.length < bodyOffset + bodyLen) return null;
  const dataBody = msg.subarray(bodyOffset, bodyOffset + bodyLen);

  let timestampMs = null;
  if (payloadNibble !== 4 && msg.length >= 24) {
    timestampMs = Number(msg.readBigUInt64BE(16));
  }

  return { deviceId, channel, payloadType, subFlag, seq, dataBody, timestampMs };
}

/**
 * Start the JT/T 1078 TCP receiver.
 *
 * Some terminals stream over TCP even if UDP is provided.
 * This receiver accepts a TCP stream and extracts JT1078 packets using the "01cd" header.
 *
 * @param {object} opts
 * @param {number}   opts.port      - TCP port to listen on.
 * @param {Function} opts.onPacket  - Called with parsed packet metadata.
 * @param {Function} opts.onLog     - Called with a log string.
 */
export function startJT1078Tcp({ port, onPacket, onLog }) {
  const server = net.createServer((socket) => {
    onLog?.(`JT1078 TCP client connected from ${socket.remoteAddress}:${socket.remotePort}`);
    let buf = Buffer.alloc(0);

    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);

      // Extract packets by scanning for HEADER_ID and then using the bodyLen field.
      while (true) {
        const start = buf.indexOf(HEADER_ID);
        if (start < 0) {
          // keep last few bytes in case header splits across chunks
          buf = buf.subarray(Math.max(0, buf.length - 3));
          break;
        }

        if (buf.length < start + 26) {
          // need more data
          if (start > 0) buf = buf.subarray(start);
          break;
        }

        // We need to determine the packet length. First check if we have enough to read the typeByte
        if (buf.length < start + 16) {
          if (start > 0) buf = buf.subarray(start);
          break;
        }

        const typeByte = buf.readUInt8(start + 15);
        const payloadNibble = (typeByte >> 4) & 0x0f;
        
        let bodyLenOffset = 28;
        let bodyOffset = 30;
        if (payloadNibble === 4) {
          bodyLenOffset = 24;
          bodyOffset = 26;
        }

        if (buf.length < start + bodyLenOffset + 2) {
          if (start > 0) buf = buf.subarray(start);
          break;
        }

        const bodyLen = buf.readUInt16BE(start + bodyLenOffset);
        const pktLen = bodyOffset + bodyLen;

        if (buf.length < start + pktLen) {
          // wait for more
          if (start > 0) buf = buf.subarray(start);
          break;
        }

        const pktBuf = buf.subarray(start, start + pktLen);
        buf = buf.subarray(start + pktLen);

        const parsed = parsePacket(pktBuf);
        if (!parsed) continue;

        onLog?.(
          `pkt(tcp) seq=${parsed.seq} device=${parsed.deviceId} ch=${parsed.channel} type=${parsed.payloadType} subFlag=${parsed.subFlag} size=${parsed.dataBody.length}`
        );

        onPacket?.(parsed);
      }
    });

    socket.on("close", () => onLog?.("JT1078 TCP client disconnected"));
    socket.on("error", (e) => onLog?.(`JT1078 TCP socket error: ${e.message}`));
  });

  server.listen(port, () => onLog?.(`JT1078 TCP listening on 0.0.0.0:${port}`));
  return server;
}
