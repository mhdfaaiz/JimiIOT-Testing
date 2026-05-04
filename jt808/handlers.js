import { escapeJT808, xorChecksum, parseBcdTimeYYMMDDhhmmss } from "./codec.js";

// ─── Frame helpers ────────────────────────────────────────────────────────────

/**
 * Wrap an already-built payload (header + body + checksum) in 0x7E delimiters
 * after applying JT808 escape rules.
 */
function toFrame(raw) {
  const escaped = escapeJT808(raw);
  return Buffer.concat([Buffer.from([0x7e]), escaped, Buffer.from([0x7e])]);
}

// ─── 0x8001 Platform General Response encoder ────────────────────────────────

/**
 * Build a complete framed 0x8001 platform general response.
 *
 * @param {object} opts
 * @param {number}  opts.replySeq     - Sequence number of the message being acknowledged.
 * @param {number}  opts.respMsgId    - Message ID being acknowledged.
 * @param {number}  opts.result       - 0=success, 1=failure, 2=wrong message, 3=unsupported.
 * @param {Buffer}  [opts.deviceIdRaw10] - 10-byte device ID field (echoed back). Defaults to zeros.
 */
export function encodePlatformGeneralResponse8001({ replySeq, respMsgId, result, deviceIdRaw10 }) {
  // Body: replySeq(2) + respMsgId(2) + result(1)
  const body = Buffer.alloc(5);
  body.writeUInt16BE(replySeq & 0xffff, 0);
  body.writeUInt16BE(respMsgId & 0xffff, 2);
  body.writeUInt8(result & 0xff, 4);

  // v2019 header layout (Table 3-3):
  //   msgId(2) + attr(2) + protoVer(1) + deviceId(10) + msgSeq(2)  =  17 bytes
  const header = Buffer.alloc(17);
  header.writeUInt16BE(0x8001, 0);                    // message ID
  header.writeUInt16BE(body.length & 0x03ff, 2);      // attr: body length in low 10 bits
  header.writeUInt8(0x01, 4);                         // protocol version = 1 (v2019)

  const dev = deviceIdRaw10 ?? Buffer.alloc(10, 0x00);
  dev.copy(header, 5);                                // device ID (10 bytes)

  header.writeUInt16BE(replySeq & 0xffff, 15);        // platform uses same seq for simplicity

  const withoutChk = Buffer.concat([header, body]);
  const chk = Buffer.from([xorChecksum(withoutChk)]);
  return toFrame(Buffer.concat([withoutChk, chk]));
}

// ─── Message dispatcher ───────────────────────────────────────────────────────

/**
 * Dispatch a fully verified, unescaped JT808 packet to the appropriate handler.
 *
 * @param {Buffer} pkt          - Unescaped packet including checksum byte at the end.
 * @param {object} callbacks
 * @param {Function} callbacks.onLocation
 * @param {Function} callbacks.onLog
 * @returns {{ ack8001: Buffer } | null}
 */
export function handleJT808Message(pkt, { onLocation, onLog }) {
  // v2019 header layout (17 bytes):
  //   msgId(2) attr(2) protoVer(1) deviceId(10) msgSeq(2)
  if (pkt.length < 18) throw new Error("packet too short for v2019 header");

  const msgId        = pkt.readUInt16BE(0);
  const attr         = pkt.readUInt16BE(2);
  const bodyLen      = attr & 0x03ff;
  const protoVer     = pkt.readUInt8(4);
  const deviceIdRaw10 = Buffer.from(pkt.subarray(5, 15));
  const deviceId     = deviceIdRaw10.toString("hex");
  const msgSeq       = pkt.readUInt16BE(15);

  const headerLen = 17;
  const body      = pkt.subarray(headerLen, headerLen + bodyLen);

  const ack = (r = 0) =>
    encodePlatformGeneralResponse8001({ replySeq: msgSeq, respMsgId: msgId, result: r, deviceIdRaw10 });

  // 0x0002 — Heartbeat
  if (msgId === 0x0002) {
    onLog?.(`heartbeat  device=${deviceId}  seq=${msgSeq}`);
    return { ack8001: ack(0) };
  }

  // 0x0102 — Authentication (accept-all for demo)
  if (msgId === 0x0102) {
    onLog?.(`auth       device=${deviceId}  seq=${msgSeq}  protoVer=${protoVer}`);
    return { ack8001: ack(0) };
  }

  // 0x0200 — Location report
  if (msgId === 0x0200) {
    const loc = parse0200Body(body);
    loc.deviceId = deviceId;
    loc.seq      = msgSeq;
    onLog?.(`location   device=${deviceId}  lat=${loc.lat}  lng=${loc.lng}  speed=${loc.speedKmh}km/h  ts=${loc.ts}`);
    onLocation?.(deviceId, loc);
    return { ack8001: ack(0) };
  }

  // Unknown message — reply "unsupported"
  onLog?.(`unknown msg 0x${msgId.toString(16).padStart(4, "0")}  device=${deviceId}  seq=${msgSeq}`);
  return { ack8001: ack(3) };
}

// ─── 0x0200 location body parser ─────────────────────────────────────────────

/**
 * Parse the body of a JT/T 808 0x0200 location report.
 * Fixed part (28 bytes): alarm(4) status(4) lat(4) lng(4) alt(2) speed(2) heading(2) time(6)
 * Followed by variable-length supplementary TLV items.
 */
function parse0200Body(body) {
  if (body.length < 28) throw new Error(`0x0200 body too short: ${body.length} bytes`);

  const alarm      = body.readUInt32BE(0);
  const status     = body.readUInt32BE(4);
  const latRaw     = body.readUInt32BE(8);
  const lngRaw     = body.readUInt32BE(12);
  const altitude   = body.readUInt16BE(16);
  const speedTenth = body.readUInt16BE(18); // unit: 1/10 km/h
  const heading    = body.readUInt16BE(20);
  const timeBcd    = body.subarray(22, 28);

  // Status word bit meanings (from JT/T 808 spec)
  const accOn  = (status & 0x00000001) !== 0; // bit 0: ACC on
  const gpsFix = (status & 0x00000002) !== 0; // bit 1: location is fixed

  // Supplementary TLV items after byte 28
  const extra = {};
  let i = 28;
  while (i + 2 <= body.length) {
    const id  = body.readUInt8(i);
    const len = body.readUInt8(i + 1);
    i += 2;
    if (i + len > body.length) break;
    extra[`0x${id.toString(16).padStart(2, "0")}`] = body.subarray(i, i + len).toString("hex");
    i += len;
  }

  return {
    ts:       parseBcdTimeYYMMDDhhmmss(timeBcd),
    alarm,
    status,
    accOn,
    gpsFix,
    lat:      latRaw / 1e6,
    lng:      lngRaw / 1e6,
    altitude,
    speedKmh: speedTenth / 10,
    heading,
    extra
  };
}
