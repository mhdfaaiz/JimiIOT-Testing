import { escapeJT808, xorChecksum, parseBcdTimeYYMMDDhhmmss } from "./codec.js";

function toFrame(unescapedWithoutDelimiters) {
  const esc = escapeJT808(unescapedWithoutDelimiters);
  return Buffer.concat([Buffer.from([0x7e]), esc, Buffer.from([0x7e])]);
}

function buildHeaderV2019({ msgId, bodyLen, deviceIdRaw10, msgSeq, protoVer = 0x01 }) {
  const header = Buffer.alloc(17);
  header.writeUInt16BE(msgId & 0xffff, 0);
  header.writeUInt16BE(bodyLen & 0x03ff, 2);
  header.writeUInt8(protoVer & 0xff, 4);

  const dev = deviceIdRaw10 ?? Buffer.alloc(10, 0x00);
  dev.copy(header, 5);

  header.writeUInt16BE(msgSeq & 0xffff, 15);
  return header;
}

export function encodePlatformGeneralResponse8001({ replySeq, respMsgId, result, deviceIdRaw10 }) {
  // Body: replySeq(2) + respMsgId(2) + result(1)
  const body = Buffer.alloc(5);
  body.writeUInt16BE(replySeq & 0xffff, 0);
  body.writeUInt16BE(respMsgId & 0xffff, 2);
  body.writeUInt8(result & 0xff, 4);

  const header = buildHeaderV2019({
    msgId: 0x8001,
    bodyLen: body.length,
    deviceIdRaw10,
    msgSeq: replySeq,
    protoVer: 0x01
  });

  const withoutChk = Buffer.concat([header, body]);
  const chk = Buffer.from([xorChecksum(withoutChk)]);
  return toFrame(Buffer.concat([withoutChk, chk]));
}

/**
 * Encode JT/T 808 v2019 0x9101 Real-Time Audio/Video Transmission Command.
 */
export function encodeRealtimeAv9101({
  deviceIdRaw10,
  msgSeq,
  serverIp,
  tcpPort,
  udpPort,
  channel,
  dataType = 1,
  streamType = 0,
  // When true, the serverIp field is always transmitted as exactly 21 bytes
  // (zero-padded).  Some vendor implementations require a fixed-length field.
  pad21 = false
}) {
  let ipBuf = Buffer.from(String(serverIp), "ascii");
  if (pad21) {
    // Truncate to 21 bytes if necessary, then zero-pad to exactly 21
    const fixed = Buffer.alloc(21, 0);
    ipBuf.subarray(0, 21).copy(fixed);
    ipBuf = fixed;
  } else if (ipBuf.length > 127) {
    throw new Error("serverIp too long (max 127 bytes)");
  }

  const body = Buffer.alloc(1 + ipBuf.length + 2 + 2 + 1 + 1 + 1);
  let o = 0;
  body.writeUInt8(ipBuf.length, o); o += 1;
  ipBuf.copy(body, o); o += ipBuf.length;
  body.writeUInt16BE(tcpPort & 0xffff, o); o += 2;
  body.writeUInt16BE(udpPort & 0xffff, o); o += 2;
  body.writeUInt8(channel & 0xff, o); o += 1;
  body.writeUInt8(dataType & 0xff, o); o += 1;
  body.writeUInt8(streamType & 0xff, o); o += 1;

  const header = buildHeaderV2019({
    msgId: 0x9101,
    bodyLen: body.length,
    deviceIdRaw10,
    msgSeq,
    protoVer: 0x01
  });

  const withoutChk = Buffer.concat([header, body]);
  const chk = Buffer.from([xorChecksum(withoutChk)]);
  return toFrame(Buffer.concat([withoutChk, chk]));
}

/**
 * Encode JT/T 808 v2019 0x9102 Real-time Audio/Video Transmission Control.
 */
export function encodeRealtimeAvCtrl9102({ deviceIdRaw10, msgSeq, channel, cmd = 0, closeType = 2, switchStreamType = 0 }) {
  const body = Buffer.alloc(4);
  body.writeUInt8(channel & 0xff, 0);
  body.writeUInt8(cmd & 0xff, 1);
  body.writeUInt8(closeType & 0xff, 2);
  body.writeUInt8(switchStreamType & 0xff, 3);

  const header = buildHeaderV2019({
    msgId: 0x9102,
    bodyLen: body.length,
    deviceIdRaw10,
    msgSeq,
    protoVer: 0x01
  });

  const withoutChk = Buffer.concat([header, body]);
  const chk = Buffer.from([xorChecksum(withoutChk)]);
  return toFrame(Buffer.concat([withoutChk, chk]));
}

function decodeResultCode(code) {
  switch (code) {
    case 0: return "success";
    case 1: return "failure";
    case 2: return "message_error";
    case 3: return "unsupported";
    case 4: return "alarm_ack";
    default: return `unknown(${code})`;
  }
}

// ─── Message dispatcher ───────────────────────────────────────────────────────

export function handleJT808Message(pkt, { onLocation, onLog, onGeneralResponse } = {}) {
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

  // 0x0001 — General terminal response
  if (msgId === 0x0001) {
    // Body: replySeq(2) + replyMsgId(2) + result(1)
    if (body.length >= 5) {
      const replySeq = body.readUInt16BE(0);
      const replyMsgId = body.readUInt16BE(2);
      const result = body.readUInt8(4);
      const resultName = decodeResultCode(result);

      onLog?.(
        `generalRsp device=${deviceId} seq=${msgSeq} replySeq=${replySeq} replyMsg=0x${replyMsgId
          .toString(16)
          .padStart(4, "0")} result=${result}(${resultName})`
      );

      onGeneralResponse?.({ deviceId, msgSeq, replySeq, replyMsgId, result, resultName });
    } else {
      onLog?.(`generalRsp device=${deviceId} seq=${msgSeq} (short body len=${body.length})`);
    }
    // Ack the 0x0001 itself
    return { ack8001: ack(0) };
  }

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
 */
function parse0200Body(body) {
  const alarm  = body.readUInt32BE(0);
  const status = body.readUInt32BE(4);
  const latRaw = body.readInt32BE(8);
  const lngRaw = body.readInt32BE(12);
  const alt    = body.readUInt16BE(16);
  const speed  = body.readUInt16BE(18);
  const heading = body.readUInt16BE(20);
  const timeBcd = body.subarray(22, 28);

  const lat = latRaw / 1e6;
  const lng = lngRaw / 1e6;

  const accOn = (status & 0x00000001) !== 0;
  const gpsFix = (status & 0x00000002) !== 0;

  return {
    alarm,
    status,
    lat,
    lng,
    altitude: alt,
    speedKmh: speed / 10,
    heading,
    ts: parseBcdTimeYYMMDDhhmmss(timeBcd),
    accOn,
    gpsFix
  };
}
