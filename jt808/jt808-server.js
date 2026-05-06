import net from "net";
import { unescapeJT808, xorChecksum } from "./codec.js";
import { handleJT808Message, encodePlatformGeneralResponse8001 } from "./handlers.js";

/**
 * Locate the first complete 0x7E...0x7E frame inside `buffer`.
 * Returns { frame (inner bytes, not including delimiters), rest (remaining buffer) }
 * or null if no complete frame is available yet.
 */
function findFrame(buffer) {
  const start = buffer.indexOf(0x7e);
  if (start < 0) return null;
  const end = buffer.indexOf(0x7e, start + 1);
  if (end < 0) return null;
  const frame = buffer.subarray(start + 1, end);
  const rest  = buffer.subarray(end + 1);
  return { frame, rest };
}

/**
 * Start the JT/T 808 TCP server.
 *
 * @param {object} opts
 * @param {number} opts.port         - TCP port to listen on (default 6808).
 * @param {Function} opts.onLocation - Called with (deviceId, locObject) on 0x0200.
 * @param {Function} opts.onLog      - Called with a log string.
 * @param {Function} opts.onSocket   - Called with ({ deviceId, socket }) when a device is identified.
 */
export function startJT808Server({ port, onLocation, onLog, onSocket }) {
  const server = net.createServer((socket) => {
    onLog?.(`client connected from ${socket.remoteAddress}:${socket.remotePort}`);
    let buf = Buffer.alloc(0);

    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);

      // Drain all complete frames from the buffer
      while (true) {
        const fr = findFrame(buf);
        if (!fr) break;
        buf = fr.rest;

        const raw = fr.frame;
        if (raw.length < 2) continue;

        const pkt = unescapeJT808(raw);

        // Verify XOR checksum: all bytes except last byte (the checksum itself)
        const chk  = pkt[pkt.length - 1];
        const calc = xorChecksum(pkt.subarray(0, pkt.length - 1));
        if (chk !== calc) {
          onLog?.(`checksum mismatch: got=0x${chk.toString(16)} calc=0x${calc.toString(16)}`);
          continue;
        }

        try {
          // Identify deviceId from v2019 header (msgId + attr + protoVer + deviceId(10) + seq)
          if (pkt.length >= 18) {
            const deviceIdRaw10 = Buffer.from(pkt.subarray(5, 15));
            const deviceId = deviceIdRaw10.toString("hex");
            if (deviceId && socket.__deviceId !== deviceId) {
              socket.__deviceId = deviceId;
              onSocket?.({ deviceId, socket });
            }
          }

          const result = handleJT808Message(pkt, { onLocation, onLog });
          if (result?.ack8001) {
            socket.write(result.ack8001);
          }
        } catch (e) {
          onLog?.(`handler error: ${e?.stack ?? e}`);
          // Send a "message error" general response as best-effort
          try {
            const msgId  = pkt.readUInt16BE(0);
            const msgSeq = pkt.readUInt16BE(15); // v2019 offset
            const ack = encodePlatformGeneralResponse8001({
              replySeq:  msgSeq,
              respMsgId: msgId,
              result:    2 // failure
            });
            socket.write(ack);
          } catch (_) { /* swallow */ }
        }
      }
    });

    socket.on("close", () => onLog?.("client disconnected"));
    socket.on("error", (e) => onLog?.(`socket error: ${e.message}`));
  });

  server.listen(port, () => onLog?.(`JT808 TCP listening on port ${port}`));
  return server;
}
