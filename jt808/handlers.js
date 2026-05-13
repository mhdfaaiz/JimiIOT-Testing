import { escapeJT808, xorChecksum, parseBcdTimeYYMMDDhhmmss } from "./codec.js";


function toFrame(unescapedWithoutDelimiters) {
  const esc = escapeJT808(unescapedWithoutDelimiters);
  return Buffer.concat([Buffer.from([0x7e]), esc, Buffer.from([0x7e])]);
}

function buildHeader({ msgId, bodyLen, deviceIdRaw, msgSeq }) {
  const isV2019 = deviceIdRaw && deviceIdRaw.length === 10;
  
  if (isV2019) {
    const header = Buffer.alloc(17);
    header.writeUInt16BE(msgId & 0xffff, 0);
    header.writeUInt16BE((bodyLen & 0x03ff) | 0x4000, 2);
    header.writeUInt8(0x01, 4);
    deviceIdRaw.copy(header, 5);
    header.writeUInt16BE(msgSeq & 0xffff, 15);
    return header;
  } else {
    const header = Buffer.alloc(12);
    header.writeUInt16BE(msgId & 0xffff, 0);
    header.writeUInt16BE(bodyLen & 0x03ff, 2);
    const dev = deviceIdRaw ?? Buffer.alloc(6, 0x00);
    dev.copy(header, 4);
    header.writeUInt16BE(msgSeq & 0xffff, 10);
    return header;
  }
}

export function encodePlatformGeneralResponse8001({ replySeq, respMsgId, result, deviceIdRaw }) {
  // Body: replySeq(2) + respMsgId(2) + result(1)
  const body = Buffer.alloc(5);
  body.writeUInt16BE(replySeq & 0xffff, 0);
  body.writeUInt16BE(respMsgId & 0xffff, 2);
  body.writeUInt8(result & 0xff, 4);

  const header = buildHeader({
    msgId: 0x8001,
    bodyLen: body.length,
    deviceIdRaw,
    msgSeq: replySeq
  });

  const withoutChk = Buffer.concat([header, body]);
  const chk = Buffer.from([xorChecksum(withoutChk)]);
  return toFrame(Buffer.concat([withoutChk, chk]));
}

/**
 * Encode JT/T 808 v2019 0x8100 Terminal Registration Reply.
 * @param {object} opts
 * @param {number} opts.replySeq       Serial number of the 0x0100 message being acknowledged.
 * @param {number} [opts.result=0]     0=success, 1=already registered, 2=no vehicle, 3=already in DB, 4=blocked.
 * @param {string} [opts.authCode]     Auth token returned to the terminal (only when result === 0).
 * @param {Buffer} opts.deviceIdRaw  Device ID buffer.
 */
export function encode8100RegistrationResponse({ replySeq, result = 0, authCode = "JT808", deviceIdRaw }) {
  const codeBuf = result === 0 ? Buffer.from(String(authCode), "ascii") : Buffer.alloc(0);
  const body    = Buffer.alloc(3 + codeBuf.length);
  body.writeUInt16BE(replySeq & 0xffff, 0);
  body.writeUInt8(result & 0xff, 2);
  if (codeBuf.length > 0) codeBuf.copy(body, 3);

  const header = buildHeader({
    msgId:        0x8100,
    bodyLen:      body.length,
    deviceIdRaw,
    msgSeq:       replySeq
  });

  const withoutChk = Buffer.concat([header, body]);
  const chk = Buffer.from([xorChecksum(withoutChk)]);
  return toFrame(Buffer.concat([withoutChk, chk]));
}

/**
 * Encode JT/T 808 v2019 0x9101 Real-Time Audio/Video Transmission Command.
 *
 * @param {boolean} [opts.pad21=false]
 *   When false (default / spec-compliant) the serverIp field is variable-length:
 *     1-byte length + N bytes.
 *   When true (fixed-field / common vendor extension) the field is always 21 bytes:
 *     1-byte length + 20-byte null-padded content.
 */
export function encodeRealtimeAv9101({
  deviceIdRaw,
  msgSeq,
  serverIp,
  tcpPort,
  udpPort,
  channel,
  dataType = 1,
  streamType = 0,
  pad21 = false
}) {
  const ipRaw = String(serverIp);
  if (ipRaw.length > 20) throw new Error("serverIp too long (max 20 bytes)");
  const ipStr = Buffer.from(ipRaw, "ascii");
  const fieldLen = pad21 ? 20 : ipStr.length;
  const ipField  = Buffer.alloc(fieldLen, 0x00);
  ipStr.copy(ipField, 0);

  const body = Buffer.alloc(1 + fieldLen + 2 + 2 + 1 + 1 + 1);
  let o = 0;
  body.writeUInt8(ipStr.length, o); o += 1;   // actual string length (not padded length)
  ipField.copy(body, o); o += fieldLen;
  body.writeUInt16BE(tcpPort & 0xffff, o); o += 2;
  body.writeUInt16BE(udpPort & 0xffff, o); o += 2;
  body.writeUInt8(channel & 0xff, o); o += 1;
  body.writeUInt8(dataType & 0xff, o); o += 1;
  body.writeUInt8(streamType & 0xff, o); o += 1;

  const header = buildHeader({
    msgId: 0x9101,
    bodyLen: body.length,
    deviceIdRaw,
    msgSeq
  });

  const withoutChk = Buffer.concat([header, body]);
  const chk = Buffer.from([xorChecksum(withoutChk)]);
  return toFrame(Buffer.concat([withoutChk, chk]));
}

/**
 * Encode JT/T 808 v2019 0x9102 Real-time Audio/Video Transmission Control.
 */
export function encodeRealtimeAvCtrl9102({ deviceIdRaw, msgSeq, channel, cmd = 0, closeType = 2, switchStreamType = 0 }) {
  const body = Buffer.alloc(4);
  body.writeUInt8(channel & 0xff, 0);
  body.writeUInt8(cmd & 0xff, 1);
  body.writeUInt8(closeType & 0xff, 2);
  body.writeUInt8(switchStreamType & 0xff, 3);

  const header = buildHeader({
    msgId: 0x9102,
    bodyLen: body.length,
    deviceIdRaw,
    msgSeq
  });

  const withoutChk = Buffer.concat([header, body]);
  const chk = Buffer.from([xorChecksum(withoutChk)]);
  return toFrame(Buffer.concat([withoutChk, chk]));
}

/**
 * Encode JT/T 808 0x8900 Pass-Through (transparent) message.
 * @param {object} opts
 * @param {Buffer}  opts.deviceIdRaw  - raw device ID buffer
 * @param {number}  opts.msgSeq       - message sequence number
 * @param {number}  opts.msgType      - transparent message type (e.g. 0xF0 for online command)
 * @param {Buffer|string} opts.content - transparent message content
 */
export function encode8900PassThrough({ deviceIdRaw, msgSeq, msgType = 0xF0, content }) {
  const contentBuf = Buffer.isBuffer(content) ? content : Buffer.from(String(content), "ascii");
  const body = Buffer.alloc(1 + contentBuf.length);
  body.writeUInt8(msgType & 0xff, 0);
  contentBuf.copy(body, 1);

  const header = buildHeader({ msgId: 0x8900, bodyLen: body.length, deviceIdRaw, msgSeq });
  const withoutChk = Buffer.concat([header, body]);
  const chk = Buffer.from([xorChecksum(withoutChk)]);
  return toFrame(Buffer.concat([withoutChk, chk]));
}

/**
 * Encode JT/T 808 0x8103 Terminal Parameter Setup.
 * @param {object} opts
 * @param {Buffer}  opts.deviceIdRaw  - raw device ID buffer
 * @param {number}  opts.msgSeq       - message sequence number
 * @param {Array<{id:number, value:number|string}>} opts.params - parameter items
 *   Each param: { id (DWORD), value (DWORD number) }
 */
export function encode8103ParamSetup({ deviceIdRaw, msgSeq, params }) {
  // Each param item: 4-byte ID + 1-byte length + N-byte value
  // For DWORD params: length=4, value is 4-byte big-endian uint
  const items = [];
  for (const p of params) {
    const valBuf = Buffer.alloc(4);
    valBuf.writeUInt32BE(p.value >>> 0, 0);
    const item = Buffer.alloc(4 + 1 + 4);
    item.writeUInt32BE(p.id >>> 0, 0);
    item.writeUInt8(4, 4);
    valBuf.copy(item, 5);
    items.push(item);
  }

  const paramsBuf = Buffer.concat(items);
  const body = Buffer.alloc(1 + paramsBuf.length);
  body.writeUInt8(params.length & 0xff, 0);
  paramsBuf.copy(body, 1);

  const header = buildHeader({ msgId: 0x8103, bodyLen: body.length, deviceIdRaw, msgSeq });
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

export function handleJT808Message(pkt, { onLocation, onLog, onGeneralResponse, onRegister, onAuth } = {}) {
  if (pkt.length < 12) throw new Error("packet too short");

  const msgId        = pkt.readUInt16BE(0);
  const attr         = pkt.readUInt16BE(2);
  const bodyLen      = attr & 0x03ff;
  const isV2019      = (attr & 0x4000) !== 0;

  let headerLen = 12;
  let deviceIdRaw;
  let msgSeq;
  let protoVer = 0;

  if (isV2019) {
    if (pkt.length < 17) throw new Error("packet too short for v2019 header");
    headerLen = 17;
    protoVer = pkt.readUInt8(4);
    deviceIdRaw = Buffer.from(pkt.subarray(5, 15));
    msgSeq = pkt.readUInt16BE(15);
  } else {
    deviceIdRaw = Buffer.from(pkt.subarray(4, 10));
    msgSeq = pkt.readUInt16BE(10);
  }

  const hasSubpackage = (attr & 0x2000) !== 0;
  if (hasSubpackage) {
    headerLen += 4;
  }

  const deviceId = deviceIdRaw.toString("hex");
  const body = pkt.subarray(headerLen, headerLen + bodyLen);

  const ack = (r = 0) =>
    encodePlatformGeneralResponse8001({ replySeq: msgSeq, respMsgId: msgId, result: r, deviceIdRaw });

  // 0x0100 — Terminal registration
  if (msgId === 0x0100) {
    onLog?.(`register   device=${deviceId}  seq=${msgSeq}`);
    onRegister?.({ deviceId, msgSeq, deviceIdRaw });
    return {
      reg8100: encode8100RegistrationResponse({ replySeq: msgSeq, result: 0, authCode: "JT808", deviceIdRaw })
    };
  }

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
    onAuth?.({ deviceId, msgSeq });
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

  // Lat/Lng are DWORD (unsigned) in the spec, scaled by 1e6.
  // Status bit 1 = GPS fix acquired; bit 2 = North (1) / South (0); bit 3 = East (1) / West (0)
  const latRaw = body.readUInt32BE(8);
  const lngRaw = body.readUInt32BE(12);
  const alt    = body.readUInt16BE(16);
  const speed  = body.readUInt16BE(18);
  const heading = body.readUInt16BE(20);
  const timeBcd = body.subarray(22, 28);

  const accOn  = (status & 0x00000001) !== 0;
  const gpsFix = (status & 0x00000002) !== 0;
  // bit2: 1=North, 0=South; bit3: 1=East (positive), 0=West (negative)
  const isNorth = (status & 0x00000004) !== 0;
  const isEast  = (status & 0x00000008) !== 0;

  // Apply hemisphere sign. If no fix, coordinates may be 0.
  let lat = latRaw / 1e6;
  let lng = lngRaw / 1e6;
  if (!isNorth) lat = -lat;
  if (!isEast)  lng = -lng;

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
    gpsFix,
    isNorth,
    isEast
  };
}
