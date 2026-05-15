import express from "express";
import http from "http";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { WebSocketServer, WebSocket } from "ws";
import { fileURLToPath } from "url";

import { startJT808Server } from "./protocol-jt808/tcp-gateway.js";
import { startJT1078Udp }   from "./protocol-jt1078/udp-stream-receiver.js";
import { startJT1078Tcp }   from "./protocol-jt1078/tcp-stream-receiver.js";
import { encodeRealtimeAv9101, encodeRealtimeAvCtrl9102 } from "./protocol-jt808/message-handlers.js";
import { JT1078Reassembler } from "./protocol-jt1078/frame-reassembler.js";
// flv-muxer removed

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app    = express();
app.use(express.json());

const server = http.createServer(app);

// Two separate WebSocket servers — dashboard clients on "/" and video clients on "/ws/video".
const wss      = new WebSocketServer({ noServer: true });
const wssVideo = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/ws/video") {
    wssVideo.handleUpgrade(req, socket, head, (ws) => wssVideo.emit("connection", ws, req));
  } else {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  }
});

// Single global reassembler — maintains per-(device,channel) fragmentation state internally.
const reassembler = new JT1078Reassembler();

// ── Application state ─────────────────────────────────────────────────────────

const state = {
  gps:             new Map(),   // full deviceId → { latest, history }
  videoStats:      new Map(),   // canonical (12-char) deviceId → { bytes, packets, lastTs, perChannel }
  jt808Sessions:   new Map(),   // full 20-char deviceId → session
  sessionsByShortId: new Map(), // canonical 12-char deviceId → session  (alias index)
  // "deviceId:channel" → { subs: Set<{ws}>, lastSps: Buffer|null, lastPps: Buffer|null }
  videoChannels:   new Map(),
  clients:         new Set()    // dashboard WebSocket clients
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Canonical 12-char device ID — the first 6 bytes of the JT808 10-byte field,
 * which matches the 6-byte SIM field in JT1078 packets.
 */
function canonicalId(deviceId) {
  return String(deviceId).toLowerCase().slice(0, 12);
}

function normalizeVideoCodec(value) {
  const codec = String(value ?? "").trim().toLowerCase();
  if (codec === "h264" || codec === "avc") return "h264";
  if (codec === "h265" || codec === "hevc" || codec === "hvc1") return "hevc";
  return null;
}

function alternateVideoCodec(codec) {
  return codec === "h264" ? "hevc" : "h264";
}

function nextInputCandidate(currentFormat, ch) {
  if (ch?.lastFrameHasAnnexB) {
    if (currentFormat === "h264") return { inputFormat: "hevc", codecHint: "hevc" };
    return { inputFormat: "h264", codecHint: "h264" };
  }
  if (currentFormat === "h264") return { inputFormat: "hevc", codecHint: "hevc" };
  if (currentFormat === "hevc") return { inputFormat: "mpeg", codecHint: null };
  return { inputFormat: "h264", codecHint: "h264" };
}

function ffmpegInputFormatForCodec(codec) {
  return codec === "h264" ? "h264" : "hevc";
}

const PRE_ROLL_MAX_FRAMES = Math.max(10, Number(process.env.VIDEO_PREROLL_FRAMES ?? 40) || 40);
const PRE_ROLL_MAX_BYTES = Math.max(256 * 1024, Number(process.env.VIDEO_PREROLL_BYTES ?? (2 * 1024 * 1024)) || (2 * 1024 * 1024));

function createVideoChannelState() {
  return {
    subs: new Set(),
    ffmpeg: null,
    ffmpegStarting: false,
    codecHint: null,
    inputFormatHint: null,
    codecLocked: false,
    lockedCodecHint: null,
    lockedInputFormatHint: null,
    ffmpegProbeTimer: null,
    ffmpegHasOutput: false,
    ffmpegKilledForRetry: false,
    ffmpegKilledForRestart: false,
    waitingForBootstrapSince: 0,
    lastFrameLooksMpeg: false,
    lastFrameHasAnnexB: false,
    decoderErrorPendingRestart: false,
    lastDecoderErrorAt: 0,
    preRollFrames: [],
    preRollBytes: 0,
    preRollNeedsFlush: false,
    lastVps: null,
    lastSps: null,
    lastPps: null
  };
}

function looksLikeMpegPs(data) {
  if (!Buffer.isBuffer(data) || data.length < 4) return false;
  const sample = data.subarray(0, Math.min(data.length, 256));
  for (let i = 0; i < sample.length - 4; i += 1) {
    if (
      sample[i] === 0x00 &&
      sample[i + 1] === 0x00 &&
      sample[i + 2] === 0x01 &&
      (sample[i + 3] === 0xba || sample[i + 3] === 0xbb || sample[i + 3] === 0xbc)
    ) {
      return true;
    }
  }
  return false;
}

function guessVideoCodec(data) {
  if (!Buffer.isBuffer(data) || data.length < 4) return null;

  let h264Score = 0;
  let hevcScore = 0;
  const sample = data.subarray(0, Math.min(data.length, 512));

  for (let i = 0; i < sample.length - 4; i += 1) {
    const isShortStart = sample[i] === 0x00 && sample[i + 1] === 0x00 && sample[i + 2] === 0x01;
    const isLongStart = sample[i] === 0x00 && sample[i + 1] === 0x00 && sample[i + 2] === 0x00 && sample[i + 3] === 0x01;
    if (!isShortStart && !isLongStart) continue;

    const nalOffset = isShortStart ? i + 3 : i + 4;
    if (nalOffset >= sample.length) break;

    const firstByte = sample[nalOffset];
    const h264Type = firstByte & 0x1f;
    const hevcType = (firstByte >> 1) & 0x3f;

    if (firstByte === 0x67 || firstByte === 0x68 || firstByte === 0x65 || firstByte === 0x61) h264Score += 3;
    if (h264Type >= 1 && h264Type <= 23) h264Score += 1;

    if (firstByte === 0x40 || firstByte === 0x42 || firstByte === 0x44 || firstByte === 0x26 || firstByte === 0x27 || firstByte === 0x28) hevcScore += 3;
    if (hevcType === 32 || hevcType === 33 || hevcType === 34 || hevcType === 19 || hevcType === 20 || hevcType === 39 || hevcType === 40) hevcScore += 1;
  }

  if (h264Score > hevcScore + 1) return "h264";
  if (hevcScore > h264Score + 1) return "hevc";
  return null;
}

function hasAnnexBStartCode(data) {
  if (!Buffer.isBuffer(data) || data.length < 4) return false;
  for (let i = 0; i < data.length - 3; i += 1) {
    if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x01) return true;
    if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x00 && data[i + 3] === 0x01) return true;
  }
  return false;
}

function convertLengthPrefixedToAnnexB(data) {
  if (!Buffer.isBuffer(data) || data.length < 6) return null;
  let off = 0;
  const chunks = [];
  while (off + 4 <= data.length) {
    const naluLen = data.readUInt32BE(off);
    off += 4;
    if (naluLen <= 0 || off + naluLen > data.length) return null;
    chunks.push(Buffer.from([0x00, 0x00, 0x00, 0x01]));
    chunks.push(data.subarray(off, off + naluLen));
    off += naluLen;
  }
  if (off !== data.length || chunks.length === 0) return null;
  return Buffer.concat(chunks);
}

function extractAnnexBNalus(data) {
  const nalus = [];
  let i = 0;
  while (i < data.length - 3) {
    let startLen = 0;
    if (data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x01) startLen = 3;
    else if (i < data.length - 4 && data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x00 && data[i + 3] === 0x01) startLen = 4;
    if (!startLen) {
      i += 1;
      continue;
    }

    const nalStart = i + startLen;
    let j = nalStart;
    while (j < data.length - 3) {
      if (data[j] === 0x00 && data[j + 1] === 0x00 && data[j + 2] === 0x01) break;
      if (j < data.length - 4 && data[j] === 0x00 && data[j + 1] === 0x00 && data[j + 2] === 0x00 && data[j + 3] === 0x01) break;
      j += 1;
    }

    if (nalStart < j) nalus.push(data.subarray(nalStart, j));
    i = j;
  }
  return nalus;
}

function normalizeFrameForCodec(ch, frameData, codec) {
  if (!Buffer.isBuffer(frameData) || frameData.length < 2) return frameData;

  let data = frameData;
  if (!hasAnnexBStartCode(data)) {
    const converted = convertLengthPrefixedToAnnexB(data);
    if (converted) data = converted;
  }
  if (!hasAnnexBStartCode(data)) return data;

  const nalus = extractAnnexBNalus(data);
  if (nalus.length === 0) return data;

  if (codec === "h264") {
    let hasSps = false;
    let hasPps = false;
    let hasIdr = false;
    for (const nal of nalus) {
      const t = nal[0] & 0x1f;
      if (t === 7) {
        hasSps = true;
        ch.lastSps = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x01]), nal]);
      } else if (t === 8) {
        hasPps = true;
        ch.lastPps = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x01]), nal]);
      } else if (t === 5) {
        hasIdr = true;
      }
    }
    if (hasIdr && (!hasSps || !hasPps) && ch.lastSps && ch.lastPps) {
      return Buffer.concat([ch.lastSps, ch.lastPps, data]);
    }
    return data;
  }

  if (codec === "hevc") {
    let hasVps = false;
    let hasSps = false;
    let hasPps = false;
    let hasIdr = false;
    for (const nal of nalus) {
      const t = (nal[0] >> 1) & 0x3f;
      if (t === 32) {
        hasVps = true;
        ch.lastVps = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x01]), nal]);
      } else if (t === 33) {
        hasSps = true;
        ch.lastSps = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x01]), nal]);
      } else if (t === 34) {
        hasPps = true;
        ch.lastPps = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x01]), nal]);
      } else if (t === 19 || t === 20) {
        hasIdr = true;
      }
    }
    if (hasIdr && (!hasVps || !hasSps || !hasPps) && ch.lastVps && ch.lastSps && ch.lastPps) {
      return Buffer.concat([ch.lastVps, ch.lastSps, ch.lastPps, data]);
    }
    return data;
  }

  return data;
}

function inspectFrameNalState(data, codec) {
  const out = {
    hasAnnexB: false,
    hasKeyframe: false,
    hasSps: false,
    hasPps: false,
    hasVps: false
  };
  if (!Buffer.isBuffer(data) || data.length < 2) return out;

  let buf = data;
  if (!hasAnnexBStartCode(buf)) {
    const converted = convertLengthPrefixedToAnnexB(buf);
    if (converted) buf = converted;
  }
  if (!hasAnnexBStartCode(buf)) return out;

  out.hasAnnexB = true;
  const nalus = extractAnnexBNalus(buf);
  for (const nal of nalus) {
    if (!nal || nal.length < 1) continue;
    if (codec === "h264") {
      const t = nal[0] & 0x1f;
      if (t === 7) out.hasSps = true;
      else if (t === 8) out.hasPps = true;
      else if (t === 5) out.hasKeyframe = true;
    } else if (codec === "hevc") {
      const t = (nal[0] >> 1) & 0x3f;
      if (t === 32) out.hasVps = true;
      else if (t === 33) out.hasSps = true;
      else if (t === 34) out.hasPps = true;
      else if (t === 19 || t === 20) out.hasKeyframe = true;
    }
  }
  return out;
}

function isFrameBootstrapReady(ch, frameData, codec, payloadType) {
  if (!codec) return true;

  const state = inspectFrameNalState(frameData, codec);
  const isIframe = payloadType === "video-I" || state.hasKeyframe;

  if (codec === "h264") {
    const hasParams = (state.hasSps && state.hasPps) || (!!ch.lastSps && !!ch.lastPps);
    return isIframe && hasParams;
  }
  if (codec === "hevc") {
    const hasParams = (state.hasVps && state.hasSps && state.hasPps) || (!!ch.lastVps && !!ch.lastSps && !!ch.lastPps);
    return isIframe && hasParams;
  }
  return true;
}

function setInputHintIfMissing(ch, frameData) {
  if (ch.codecLocked && ch.lockedInputFormatHint) {
    ch.inputFormatHint = ch.lockedInputFormatHint;
    ch.codecHint = ch.lockedCodecHint;
    return;
  }
  if (ch.inputFormatHint) return;

  const configuredCodec = normalizeVideoCodec(process.env.VIDEO_CODEC);
  const envInputFormat = String(process.env.VIDEO_INPUT_FORMAT ?? "").trim().toLowerCase();

  if (envInputFormat === "h264" || envInputFormat === "hevc" || envInputFormat === "mpeg") {
    ch.inputFormatHint = envInputFormat;
    ch.codecHint = envInputFormat === "mpeg" ? null : envInputFormat;
    return;
  }

  if (configuredCodec) {
    ch.codecHint = configuredCodec;
    ch.inputFormatHint = ffmpegInputFormatForCodec(configuredCodec);
    return;
  }

  if (looksLikeMpegPs(frameData)) {
    ch.inputFormatHint = "mpeg";
    ch.codecHint = null;
    return;
  }

  const guessed = ch.codecHint ?? guessVideoCodec(frameData) ?? "h264";
  ch.codecHint = guessed;
  ch.inputFormatHint = ffmpegInputFormatForCodec(guessed);
}

function isLikelyDecoderError(text) {
  const err = String(text ?? "").toLowerCase();
  if (!err) return false;
  return (
    err.includes("non-existing pps") ||
    err.includes("decode_slice_header") ||
    err.includes("no frame") ||
    err.includes("missing picture") ||
    err.includes("error while decoding") ||
    err.includes("invalid data found")
  );
}

function pushPreRollFrame(ch, frameData, isKeyframe) {
  if (!Buffer.isBuffer(frameData) || frameData.length === 0) return;

  if (isKeyframe) {
    ch.preRollFrames = [];
    ch.preRollBytes = 0;
  }

  const copy = Buffer.from(frameData);
  ch.preRollFrames.push(copy);
  ch.preRollBytes += copy.length;

  while (ch.preRollFrames.length > PRE_ROLL_MAX_FRAMES || ch.preRollBytes > PRE_ROLL_MAX_BYTES) {
    const dropped = ch.preRollFrames.shift();
    if (!dropped) break;
    ch.preRollBytes -= dropped.length;
  }
  if (ch.preRollBytes < 0) ch.preRollBytes = 0;
}

function flushPreRollToTranscoder(key, ch) {
  if (!ch.ffmpeg || !ch.ffmpeg.stdin || !ch.ffmpeg.stdin.writable) return false;
  if (!ch.preRollNeedsFlush) return false;

  let wrote = false;
  for (const frame of ch.preRollFrames) {
    try {
      ch.ffmpeg.stdin.write(frame);
      wrote = true;
    } catch (e) {
      console.error("[FFmpeg] Pre-roll write error:", e);
      break;
    }
  }
  ch.preRollNeedsFlush = false;
  if (wrote) {
    console.log(`[FFmpeg] ${key} pre-roll flushed`, { frames: ch.preRollFrames.length, bytes: ch.preRollBytes });
  }
  return wrote;
}

function killTranscoderForRestart(key, ch, reason) {
  if (!ch.ffmpeg) return;
  if (ch.ffmpegKilledForRestart) return;
  ch.ffmpegKilledForRestart = true;
  ch.ffmpegKilledForRetry = false;
  console.log(`[FFmpeg] ${key} restarting on next keyframe`, { reason });
  try { ch.ffmpeg.kill("SIGKILL"); } catch {}
}

function ensureVideoTranscoder(key, ch, frameData) {
  if (ch.ffmpeg || ch.ffmpegStarting) return;
  if (!ch.subs || ch.subs.size === 0) return;

  const configuredCodec = normalizeVideoCodec(process.env.VIDEO_CODEC);
  const envInputFormat = String(process.env.VIDEO_INPUT_FORMAT ?? "").trim().toLowerCase();

  setInputHintIfMissing(ch, frameData);

  const codec = ch.codecHint;
  const inputFormat = ch.inputFormatHint ?? ffmpegInputFormatForCodec(codec ?? "h264");
  ch.ffmpegStarting = true;
  ch.ffmpegHasOutput = false;
  ch.ffmpegKilledForRetry = false;
  ch.ffmpegKilledForRestart = false;
  ch.preRollNeedsFlush = true;

  console.log(`[FFmpeg] Starting transcoder for channel ${key}`, { codec, inputFormat });

  ch.ffmpeg = spawn("ffmpeg", [
    "-hide_banner",
    "-loglevel", "warning",
    "-f", inputFormat,
    "-i", "pipe:0",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-tune", "zerolatency",
    "-f", "flv",
    "pipe:1"
  ]);
  const ff = ch.ffmpeg;

  ff.stdout.on("data", (data) => {
    ch.ffmpegHasOutput = true;
    if (!ch.codecLocked) {
      ch.codecLocked = true;
      ch.lockedCodecHint = codec;
      ch.lockedInputFormatHint = inputFormat;
      console.log(`[FFmpeg] ${key} codec/input locked`, { codec: ch.lockedCodecHint, inputFormat: ch.lockedInputFormatHint });
    }
    for (const s of ch.subs) {
      if (s.ws.readyState === WebSocket.OPEN) {
        try { s.ws.send(data, { binary: true }); } catch {}
      }
    }
  });

  // If ffmpeg never emits any FLV bytes, it likely started with the wrong codec.
  if (!configuredCodec && !envInputFormat && !ch.codecLocked) {
    const probeMs = Math.max(3000, Number(process.env.VIDEO_PROBE_MS ?? 12000) || 12000);
    ch.ffmpegProbeTimer = setTimeout(() => {
      if (!ch.ffmpeg || ch.ffmpeg !== ff || ch.ffmpegHasOutput) return;
      const next = nextInputCandidate(inputFormat, ch);
      ch.codecHint = next.codecHint;
      ch.inputFormatHint = next.inputFormat;
      console.log(`[FFmpeg] ${key} produced no output, retrying with alternate input`, next);
      ch.ffmpegKilledForRetry = true;
      try { ff.kill("SIGKILL"); } catch {}
    }, probeMs);
  }

  ff.stderr.on("data", (data) => {
    const text = data.toString().trim();
    console.error(`[FFmpeg] ${key} (${codec}) error:`, text);
    if (isLikelyDecoderError(text)) {
      ch.decoderErrorPendingRestart = true;
      ch.lastDecoderErrorAt = Date.now();
    }
  });

  ff.on("close", (code) => {
    console.log(`[FFmpeg] ${key} transcoder exited with code ${code}`, { codec, inputFormat });
    if (ch.ffmpegProbeTimer) {
      clearTimeout(ch.ffmpegProbeTimer);
      ch.ffmpegProbeTimer = null;
    }
    if (state.videoChannels.get(key)?.ffmpeg === ff) {
      state.videoChannels.get(key).ffmpeg = null;
    }
    ch.ffmpegStarting = false;
    const killedForRetry = !!ch.ffmpegKilledForRetry;
    const killedForRestart = !!ch.ffmpegKilledForRestart;
    ch.ffmpegKilledForRetry = false;
    ch.ffmpegKilledForRestart = false;

    const configured = normalizeVideoCodec(process.env.VIDEO_CODEC);
    if (!killedForRetry && !killedForRestart && code !== 0 && !configured && !envInputFormat && ch.subs.size > 0 && !ch.codecLocked) {
      const next = nextInputCandidate(inputFormat, ch);
      ch.codecHint = next.codecHint;
      ch.inputFormatHint = next.inputFormat;
      console.log(`[FFmpeg] ${key} will retry with alternate input`, next);
    }
  });
}

function localIpGuess() {
  if (process.env.PUBLIC_IP) return process.env.PUBLIC_IP;
  const ifs = os.networkInterfaces();
  for (const entries of Object.values(ifs)) {
    for (const inf of entries ?? []) {
      if (!inf || inf.internal) continue;
      if (inf.family === "IPv4") return inf.address;
    }
  }
  return "127.0.0.1";
}

function getOrInitSession(deviceId, socket) {
  let s = state.jt808Sessions.get(deviceId);
  if (!s) {
    s = {
      socket,
      deviceIdRaw:    Buffer.from(deviceId, "hex"),
      deviceIdShort:  canonicalId(deviceId),
      nextSeq:        1,
      registered:     false,
      authenticated:  false,
      lastGeneralResponseByMsgId: new Map(),
      pendingByReplySeq:          new Map()
    };
    state.jt808Sessions.set(deviceId, s);
    state.sessionsByShortId.set(s.deviceIdShort, s);
  } else {
    s.socket = socket;
    state.sessionsByShortId.set(s.deviceIdShort, s);  // re-register alias
  }
  return s;
}

/** Resolve a session by full or partial device ID. */
function resolveSession(deviceId) {
  if (state.jt808Sessions.has(deviceId)) return state.jt808Sessions.get(deviceId);
  const short = canonicalId(deviceId);
  if (state.sessionsByShortId.has(short)) return state.sessionsByShortId.get(short);
  for (const [k, v] of state.jt808Sessions) {
    if (k.startsWith(short)) return v;
  }
  return null;
}

function wsSend(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch { /* ignore */ }
}

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of state.clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

// ── Dashboard WebSocket ───────────────────────────────────────────────────────

wss.on("connection", (ws, req) => {
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()
           || req.socket.remoteAddress;
  console.log("[WS] client connected", { ip });
  state.clients.add(ws);

  ws.on("close", (code, reason) => {
    console.log("[WS] client disconnected", { ip, code, reason: reason?.toString() });
    state.clients.delete(ws);
  });

  wsSend(ws, { type: "hello", data: { ok: true } });

  // Replay latest GPS and video stats to new dashboard clients
  for (const [deviceId, rec] of state.gps.entries()) {
    if (rec?.latest) wsSend(ws, { type: "gps", deviceId, data: rec.latest });
  }
  for (const [deviceId, s] of state.videoStats.entries()) {
    const per = s?.perChannel;
    if (!per) continue;
    for (const [channel, cs] of per.entries()) {
      wsSend(ws, { type: "video_stats", deviceId, data: { channel, ...cs } });
    }
  }
});

// ── Video streaming WebSocket: /ws/video?device=<id>&channel=<1|2> ───

wssVideo.on("connection", (ws, req) => {
  const url      = new URL(req.url ?? "/", "http://localhost");
  const rawDevice = url.searchParams.get("device") ?? "";
  const deviceId  = canonicalId(rawDevice);
  const channel   = Number(url.searchParams.get("channel") ?? 1);

  if (!deviceId) { ws.close(1008, "Missing device param"); return; }

  const key = `${deviceId}:${channel}`;
  let ch = state.videoChannels.get(key);
  if (!ch) {
    ch = createVideoChannelState();
    state.videoChannels.set(key, ch);
  }

  const sub = { ws };
  ch.subs.add(sub);
  console.log(`[WS/video] subscriber connected { deviceId: '${deviceId}', channel: ${channel}, raw: '${rawDevice}' }`);

  const removeSub = () => {
    ch.subs.delete(sub);
    console.log(`[WS/video] subscriber left`, { deviceId, channel });
    
    // Stop FFmpeg if no more subscribers
    if (ch.subs.size === 0 && ch.ffmpeg) {
      console.log(`[FFmpeg] Stopping transcoder for channel ${key} (0 subscribers)`);
      ch.ffmpeg.kill("SIGKILL");
      ch.ffmpeg = null;
    }
    if (ch.subs.size === 0 && ch.ffmpegProbeTimer) {
      clearTimeout(ch.ffmpegProbeTimer);
      ch.ffmpegProbeTimer = null;
    }
  };

  ws.on("close", removeSub);
  ws.on("error", removeSub);
});

// ── Static files ──────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, "dashboard-web")));

// ── REST APIs ─────────────────────────────────────────────────────────────────

/** List all known JT808 sessions and their current state. */
app.get("/api/devices", (_req, res) => {
  const list = [];
  for (const [deviceId, s] of state.jt808Sessions) {
    list.push({
      deviceId,
      shortId:       s.deviceIdShort,
      connected:     !!(s.socket && !s.socket.destroyed),
      registered:    s.registered,
      authenticated: s.authenticated
    });
  }
  res.json(list);
});

/** List JT1078 stream activity per device+channel. */
app.get("/api/video/streams", (_req, res) => {
  const list = [];
  for (const [deviceId, vs] of state.videoStats) {
    const per = vs?.perChannel;
    if (!per) continue;
    for (const [ch, cs] of per.entries()) {
      const secsAgo = cs.lastTs ? Math.round((Date.now() - cs.lastTs) / 1000) : null;
      list.push({
        deviceId,
        channel:        ch,
        bytes:          cs.bytes,
        packets:        cs.packets,
        lastTs:         cs.lastTs,
        activeSecondsAgo: secsAgo,
        active:         secsAgo != null && secsAgo < 10
      });
    }
  }
  res.json(list);
});

app.post("/api/video/:deviceId/start", async (req, res) => {
  const { deviceId } = req.params;
  const channels   = Array.isArray(req.body?.channels)    ? req.body.channels    : [1, 2];
  const streamType = req.body?.streamType != null ? Number(req.body.streamType) : 0;
  const dataType   = req.body?.dataType   != null ? Number(req.body.dataType)   : 1;
  try {
    const results = await startRealtimeVideoAuto({ deviceId, channels, dataType, streamType });
    res.json({ ok: true, deviceId, channels, dataType, streamType, results });
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.post("/api/video/:deviceId/stop", (req, res) => {
  const { deviceId } = req.params;
  const channels = Array.isArray(req.body?.channels) ? req.body.channels : [1, 2];
  try {
    stopRealtimeVideo({ deviceId, channels });
    res.json({ ok: true, deviceId, channels });
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

// ── JT1078 packet handling ────────────────────────────────────────────────────

function updateVideoStats({ deviceId, channel, payloadType, dataBody }) {
  const cid = canonicalId(deviceId);
  let s = state.videoStats.get(cid);
  if (!s) s = { bytes: 0, packets: 0, lastTs: Date.now(), perChannel: new Map() };
  s.bytes   += dataBody.length;
  s.packets += 1;
  s.lastTs   = Date.now();
  const ch = Number(channel);
  let cs = s.perChannel.get(ch);
  if (!cs) cs = { bytes: 0, packets: 0, lastTs: 0, lastBroadcast: 0 };
  cs.bytes   += dataBody.length;
  cs.packets += 1;
  cs.lastTs   = Date.now();
  s.perChannel.set(ch, cs);
  state.videoStats.set(cid, s);

  // Throttle websocket broadcasts to prevent frontend UI freeze
  const now = Date.now();
  if (now - cs.lastBroadcast > 500) {
    cs.lastBroadcast = now;
    broadcast({ type: "video",       deviceId: cid, data: { channel: ch, payloadType, size: dataBody.length } });
    broadcast({ type: "video_stats", deviceId: cid, data: { channel: ch, bytes: cs.bytes, packets: cs.packets, lastTs: cs.lastTs } });
  }
}

function handleJT1078Packet(packet) {
  updateVideoStats(packet);

  if (!packet.payloadType.startsWith("video")) return;

  const frame = reassembler.push(packet);
  if(frame) console.log(`[Reassembler] FRAME COMPLETE ch=${frame.channel} size=${frame.data.length}`);
  if (!frame) return;

  const cid = canonicalId(frame.deviceId);
  const key = `${cid}:${frame.channel}`;
  let ch = state.videoChannels.get(key);
  if (!ch) {
    ch = createVideoChannelState();
    state.videoChannels.set(key, ch);
  }

  ch.lastFrameLooksMpeg = looksLikeMpegPs(frame.data);
  ch.lastFrameHasAnnexB = hasAnnexBStartCode(frame.data);

  setInputHintIfMissing(ch, frame.data);

  const codecForNormalize = ch.inputFormatHint === "hevc" ? "hevc" : (ch.inputFormatHint === "h264" ? "h264" : null);
  const normalizedFrame = codecForNormalize ? normalizeFrameForCodec(ch, frame.data, codecForNormalize) : frame.data;
  const nalState = codecForNormalize ? inspectFrameNalState(normalizedFrame, codecForNormalize) : { hasKeyframe: false };
  const isKeyframe = frame.payloadType === "video-I" || !!nalState.hasKeyframe;

  pushPreRollFrame(ch, normalizedFrame, isKeyframe);

  if (ch.decoderErrorPendingRestart && ch.ffmpeg && isKeyframe) {
    ch.decoderErrorPendingRestart = false;
    killTranscoderForRestart(key, ch, "decoder_error");
    return;
  }

  if (!ch.ffmpeg && !ch.ffmpegStarting && codecForNormalize) {
    const ready = isFrameBootstrapReady(ch, normalizedFrame, codecForNormalize, frame.payloadType);
    if (!ready) {
      const now = Date.now();
      if (!ch.waitingForBootstrapSince || now - ch.waitingForBootstrapSince > 5000) {
        ch.waitingForBootstrapSince = now;
        console.log(`[FFmpeg] ${key} waiting for keyframe/parameter sets`, {
          codec: codecForNormalize,
          payloadType: frame.payloadType
        });
      }
      return;
    }
    ch.waitingForBootstrapSince = 0;
  }

  ensureVideoTranscoder(key, ch, normalizedFrame);

  // Feed raw video data into FFmpeg transcoder
  if (ch.ffmpeg && ch.ffmpeg.stdin && ch.ffmpeg.stdin.writable) {
    try {
      if (flushPreRollToTranscoder(key, ch)) return;
      ch.ffmpeg.stdin.write(normalizedFrame);
    } catch (e) {
      console.error("[FFmpeg] Stdin write error:", e);
    }
  }
}

// ── JT808 command helpers ─────────────────────────────────────────────────────

function send9101Variant(sess, { deviceId, channel, dataType, streamType, serverIp, tcpPort, udpPort, pad21 }) {
  const msgSeq = sess.nextSeq++;
  const pkt = encodeRealtimeAv9101({
    deviceIdRaw: sess.deviceIdRaw,
    msgSeq,
    serverIp,
    tcpPort,
    udpPort,
    channel: Number(channel),
    dataType,
    streamType,
    pad21: !!pad21
  });
  sess.socket.write(pkt);
  console.log("[JT808] sent 0x9101", {
    deviceId, channel: Number(channel), dataType, streamType,
    serverIp, udpPort, tcpPort, pad21: !!pad21, msgSeq
  });
  return msgSeq;
}

function awaitGeneralResponse(sess, replySeq, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      sess.pendingByReplySeq.delete(replySeq);
      resolve({ ok: false, timeout: true });
    }, timeoutMs);

    sess.pendingByReplySeq.set(replySeq, {
      resolve: (gr) => {
        clearTimeout(t);
        sess.pendingByReplySeq.delete(replySeq);
        resolve({ ok: true, gr });
      },
      timeout: t
    });
  });
}

/**
 * Build variant list for 0x9101 retry.
 * Tries spec-compliant variable-length IP and fixed-21-byte-padded IP,
 * each with UDP-only, TCP-only, and both-ports combinations.
 *
 * Filtering:
 * - If udpPort is 0, UDP-only variants (var_udp, pad_udp) are excluded.
 * - If tcpPort is 0, TCP-only variants (var_tcp, pad_tcp) are excluded.
 * - JT808_9101_ALLOW_ZERO_PORTS=0: additionally restrict to variants where
 *   both tcpPort and udpPort are non-zero (var_both and pad_both).
 *
 * Ordering:
 * - TCP variants come first when JT1078_PREFER_TCP=1 or udpPort is 0.
 */
function buildVariants({ tcpPort, udpPort }) {
  const preferTcp = process.env.JT1078_PREFER_TCP === "1" || udpPort === 0;

  // Two orderings: TCP-first vs UDP-first (original order)
  const tcpFirst = [
    { name: "var_tcp",  tcpPort,       udpPort: 0, pad21: false },
    { name: "pad_tcp",  tcpPort,       udpPort: 0, pad21: true  },
    { name: "var_both", tcpPort,       udpPort,    pad21: false },
    { name: "pad_both", tcpPort,       udpPort,    pad21: true  },
    { name: "var_udp",  tcpPort: 0,    udpPort,    pad21: false },
    { name: "pad_udp",  tcpPort: 0,    udpPort,    pad21: true  },
  ];
  const udpFirst = [
    { name: "var_udp",  tcpPort: 0,    udpPort,    pad21: false },
    { name: "var_tcp",  tcpPort,       udpPort: 0, pad21: false },
    { name: "var_both", tcpPort,       udpPort,    pad21: false },
    { name: "pad_udp",  tcpPort: 0,    udpPort,    pad21: true  },
    { name: "pad_tcp",  tcpPort,       udpPort: 0, pad21: true  },
    { name: "pad_both", tcpPort,       udpPort,    pad21: true  },
  ];

  let variants = preferTcp ? tcpFirst : udpFirst;

  // Filter out UDP-only variants when no UDP port is configured
  if (udpPort === 0) {
    variants = variants.filter(v => v.name !== "var_udp" && v.name !== "pad_udp");
  }
  // Filter out TCP-only variants when no TCP port is configured
  if (tcpPort === 0) {
    variants = variants.filter(v => v.name !== "var_tcp" && v.name !== "pad_tcp");
  }

  // Legacy: restrict to both-port variants only
  if (process.env.JT808_9101_ALLOW_ZERO_PORTS === "0") {
    variants = variants.filter(v => v.tcpPort !== 0 && v.udpPort !== 0);
  }

  return variants;
}

// 0x9101 generalRsp result codes
const RESULT_SUCCESS     = 0;
const RESULT_FAILURE     = 1;
const RESULT_MSG_ERROR   = 2;
const RESULT_UNSUPPORTED = 3;

async function startRealtimeVideoAuto({ deviceId, channels = [1, 2], dataType = 1, streamType = 0 }) {
  const sess = resolveSession(deviceId);
  if (!sess?.socket || sess.socket.destroyed) {
    throw new Error(`No active JT808 session for device ${deviceId}`);
  }

  const serverIp = process.env.VIDEO_SERVER_IP || process.env.PUBLIC_IP || localIpGuess();
  const tcpPort  = Number(process.env.JT1078_TCP_PORT ?? 7001);
  const udpPort  = Number(process.env.JT1078_UDP_PORT ?? 7001);
  // Some strict terminals reject 0x9101 if udpPort is 0, even if they stream via TCP.
  const cmdUdpPort = udpPort === 0 ? tcpPort : udpPort;
  const variants = buildVariants({ tcpPort, udpPort: cmdUdpPort });
  console.log("[JT808] 0x9101 variants to try", { deviceId, channels, tcpPort, udpPort: cmdUdpPort, variantNames: variants.map(v => v.name) });
  const results  = [];

  for (const ch of channels) {
    let channelOk = false;

    for (const v of variants) {
      console.log("[JT808] 0x9101 trying variant", { deviceId, channel: Number(ch), variant: v.name, tcpPort: v.tcpPort, udpPort: v.udpPort, pad21: v.pad21 });
      const replySeq = send9101Variant(sess, {
        deviceId,
        channel: ch,
        dataType,
        streamType,
        serverIp,
        tcpPort:  v.tcpPort,
        udpPort:  v.udpPort,
        pad21:    v.pad21
      });

      const r = await awaitGeneralResponse(sess, replySeq, 3500);

      if (!r.ok) {
        console.log("[JT808] 0x9101 timeout", { deviceId, channel: Number(ch), variant: v.name, replySeq });
        results.push({ channel: Number(ch), variant: v.name, status: "timeout" });
        continue;
      }

      const gr = r.gr;
      results.push({ channel: Number(ch), variant: v.name, status: gr.resultName, result: gr.result });

      if (gr.result === RESULT_SUCCESS) {
        // Guard against false-positive: device ACK'd a UDP-only variant but
        // udpPort is 0 (no UDP server), or a TCP-only variant but tcpPort is 0.
        // The device will try to stream to a port we're not listening on.
        const isUdpOnly = v.tcpPort === 0 && v.udpPort !== 0;
        const isTcpOnly = v.udpPort === 0 && v.tcpPort !== 0;
        if ((isUdpOnly && udpPort === 0) || (isTcpOnly && tcpPort === 0)) {
          console.log("[JT808] 0x9101 accepted but transport port is 0 — skipping", { deviceId, channel: Number(ch), variant: v.name });
          continue;
        }
        console.log("[JT808] 0x9101 accepted", { deviceId, channel: Number(ch), variant: v.name, tcpPort: v.tcpPort, udpPort: v.udpPort });
        channelOk = true;
        break;
      }

      // result=RESULT_UNSUPPORTED means device doesn't recognise 0x9101 — no value in more variants
      if (gr.result === RESULT_UNSUPPORTED) {
        console.log("[JT808] 0x9101 unsupported — aborting variants", { deviceId, channel: Number(ch) });
        break;
      }

      console.log("[JT808] 0x9101 rejected", { deviceId, channel: Number(ch), variant: v.name, result: gr.resultName });
    }

    if (!channelOk) {
      console.log("[JT808] 0x9101 failed for channel", { deviceId, channel: Number(ch) });
    }
  }

  return results;
}

function stopRealtimeVideo({ deviceId, channels = [1, 2], closeType = 2 }) {
  const sess = resolveSession(deviceId);
  if (!sess?.socket || sess.socket.destroyed) {
    throw new Error(`No active JT808 session for device ${deviceId}`);
  }
  for (const ch of channels) {
    const msgSeq = sess.nextSeq++;
    const pkt = encodeRealtimeAvCtrl9102({
      deviceIdRaw: sess.deviceIdRaw,
      msgSeq,
      channel: Number(ch),
      cmd: 0,
      closeType,
      switchStreamType: 0
    });
    sess.socket.write(pkt);
    console.log("[JT808] sent 0x9102 stop", { deviceId, channel: Number(ch), closeType, msgSeq });
  }
}

// ── JT808 server ──────────────────────────────────────────────────────────────

startJT808Server({
  port: Number(process.env.JT808_PORT ?? 6808),

  onLocation: (deviceId, loc) => {
    let rec = state.gps.get(deviceId);
    if (!rec) rec = { latest: null, history: [] };
    rec.latest = loc;
    rec.history.push(loc);
    if (rec.history.length > 200) rec.history.shift();
    state.gps.set(deviceId, rec);
    broadcast({ type: "gps", deviceId, data: loc });
  },

  onSocket: ({ deviceId, socket }) => {
    getOrInitSession(deviceId, socket);
    console.log("[JT808] device connected", { deviceId });
  },

  onRegister: ({ deviceId }) => {
    const sess = resolveSession(deviceId);
    if (sess) {
      sess.registered = true;
      console.log("[JT808] registered", { deviceId });
    }
  },

  onAuth: ({ deviceId }) => {
    const sess = resolveSession(deviceId);
    if (sess) {
      sess.authenticated = true;
      console.log("[JT808] authenticated", { deviceId });

      if (process.env.REGISTER_ON_AUTH === "1") {
        sess.registered = true;
        console.log("[JT808] REGISTER_ON_AUTH: inferring registration from auth", { deviceId });
      }

      if (process.env.AUTO_START_VIDEO === "1") {
        // Small delay so the auth ACK is flushed to the device before we push 0x9101
        setTimeout(() => {
          startRealtimeVideoAuto({ deviceId, channels: [1, 2], dataType: 1, streamType: 0 })
            .catch((e) => console.log("[JT808] auto-start video failed", { deviceId, error: e?.message ?? String(e) }));
        }, 500);
      }
    }
  },

  onClose: ({ deviceId }) => {
    const sess = state.jt808Sessions.get(deviceId);
    if (sess) {
      sess.socket        = null;
      sess.registered    = false;
      sess.authenticated = false;
      // Immediately reject any pending reply-await promises so they don't hang
      for (const [, p] of sess.pendingByReplySeq) {
        clearTimeout(p.timeout);
        p.resolve({ ok: false, timeout: true, closed: true });
      }
      sess.pendingByReplySeq.clear();
    }
    console.log("[JT808] device disconnected", { deviceId });
  },

  onGeneralResponse: (gr) => {
    // Look up by full ID first, then by short ID
    const sess = state.jt808Sessions.get(gr.deviceId)
              ?? state.sessionsByShortId.get(canonicalId(gr.deviceId));
    if (sess) {
      sess.lastGeneralResponseByMsgId.set(gr.replyMsgId, gr);
      const pending = sess.pendingByReplySeq.get(gr.replySeq);
      if (pending) pending.resolve(gr);
    }
    if (gr.replyMsgId === 0x9101) {
      console.log("[JT808] 0x9101 generalRsp", gr);
      broadcast({ type: "jt808_general_rsp", deviceId: gr.deviceId, data: gr });
    }
  },

  onLog: (line) => console.log("[JT808]", line)
});

// ── JT1078 receivers ──────────────────────────────────────────────────────────

startJT1078Udp({
  port:     Number(process.env.JT1078_UDP_PORT ?? 7001),
  onPacket: handleJT1078Packet,
  onLog:    (line) => console.log("[JT1078/UDP]", line)
});

startJT1078Tcp({
  port:     Number(process.env.JT1078_TCP_PORT ?? 7001),
  onPacket: handleJT1078Packet,
  onLog:    (line) => console.log("[JT1078/TCP]", line)
});

// ── HTTP listener ─────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3008);
server.listen(PORT, () => {
  const ip = process.env.VIDEO_SERVER_IP || process.env.PUBLIC_IP || localIpGuess();
  console.log(`Web app running at http://localhost:${PORT}`);
  console.log(`JT808 TCP gateway on port ${process.env.JT808_PORT ?? 6808}`);
  console.log(`JT1078 UDP receiver on port ${process.env.JT1078_UDP_PORT ?? 7001}`);
  console.log(`JT1078 TCP receiver on port ${process.env.JT1078_TCP_PORT ?? 7001}`);
  console.log(`VIDEO_SERVER_IP resolved as ${ip}`);
  if (ip === "127.0.0.1" && !process.env.VIDEO_SERVER_IP && !process.env.PUBLIC_IP) {
    console.warn("[WARN] No PUBLIC_IP or VIDEO_SERVER_IP set — device may not be able to reach this server");
  }
});
