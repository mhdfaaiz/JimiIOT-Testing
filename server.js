import express from "express";
import http from "http";
import path from "path";
import os from "os";
import { WebSocketServer, WebSocket } from "ws";
import { fileURLToPath } from "url";

import { startJT808Server } from "./jt808/jt808-server.js";
import { startJT1078Udp } from "./jt1078/jt1078-udp.js";
import { startJT1078Tcp } from "./jt1078/jt1078-tcp.js";
import { encodeRealtimeAv9101, encodeRealtimeAvCtrl9102 } from "./jt808/handlers.js";
import { FrameReassembler } from "./jt1078/jt1078-reassembler.js";
import {
  makeFLVHeader,
  makeAVCSequenceHeaderTag,
  makeAVCNALUTag,
  splitAnnexBNalUnits,
  detectCodec,
  extractSPSPPS,
  isH264Keyframe
} from "./jt1078/flv-muxer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const server = http.createServer(app);

// ─── WebSocket servers ────────────────────────────────────────────────────────
// Two separate WSS instances, both in noServer mode so we can route upgrades.

// Dashboard / stats WebSocket (existing, any path except /ws/video)
const wss = new WebSocketServer({ noServer: true });

// Video streaming WebSocket (/ws/video?device=xxx&channel=1)
const videoWss = new WebSocketServer({ noServer: true });

// Route HTTP upgrade requests to the correct WSS
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/ws/video") {
    videoWss.handleUpgrade(req, socket, head, (ws) => {
      videoWss.emit("connection", ws, req);
    });
  } else {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  }
});

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  gps: new Map(),
  videoStats: new Map(),
  jt808Sessions: new Map(),
  clients: new Set()     // dashboard WebSocket clients
};

// Per-(deviceId, channel) live video stream state
// key: `${deviceId}-${channel}`
const videoStreams = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      deviceIdRaw10: Buffer.from(deviceId, "hex"),
      nextSeq: 1,
      lastGeneralResponseByMsgId: new Map(),
      pendingByReplySeq: new Map()
    };
    state.jt808Sessions.set(deviceId, s);
  } else {
    s.socket = socket;
  }
  return s;
}

function wsSend(ws, obj) {
  try { ws.send(JSON.stringify(obj)); } catch { /* ignore */ }
}

// ─── Dashboard WebSocket ──────────────────────────────────────────────────────

wss.on("connection", (ws, req) => {
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress;
  console.log("[WS] client connected", { ip });

  state.clients.add(ws);
  ws.on("close", (code, reason) => {
    console.log("[WS] client disconnected", { ip, code, reason: reason?.toString() });
    state.clients.delete(ws);
  });

  wsSend(ws, { type: "hello", data: { ok: true } });

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

  // Send current stream statuses
  for (const [, vs] of videoStreams.entries()) {
    wsSend(ws, {
      type: "stream_status",
      deviceId: vs.deviceId,
      data: {
        channel: vs.channel,
        codec: vs.codec,
        active: vs.lastPktTs ? Date.now() - vs.lastPktTs < 10_000 : false
      }
    });
  }
});

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of state.clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

// ─── Video stream state management ───────────────────────────────────────────

function getVideoStream(deviceId, channel) {
  const key = `${deviceId}-${channel}`;
  let s = videoStreams.get(key);
  if (!s) {
    s = {
      deviceId,
      channel: Number(channel),
      codec: null,   // 'h264' | 'h265' | 'unknown' | null
      sps: null,     // Buffer or null
      pps: null,     // Buffer or null
      startTs: null, // Date.now() when stream started
      lastPktTs: null,
      clients: new Set(),
      // Track per-client whether the AVC sequence header has been sent
      clientSeqSent: new Map()
    };
    videoStreams.set(key, s);
  }
  return s;
}

function sendToVideoClient(ws, buf) {
  try {
    if (ws.readyState === WebSocket.OPEN) ws.send(buf);
  } catch { /* ignore */ }
}

function sendH265ErrorAndClose(ws) {
  try { ws.send(JSON.stringify({ error: "h265", message: "H.265/HEVC detected – not supported for browser playback" })); } catch { /* */ }
  try { ws.close(4000, "h265-unsupported"); } catch { /* */ }
}

// ─── Video WebSocket server ───────────────────────────────────────────────────

videoWss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://x");
  const deviceId = url.searchParams.get("device") || "";
  const channel  = Number(url.searchParams.get("channel") || 1);
  const clientIp = req.socket.remoteAddress;

  console.log("[VideoWS] client connected", { deviceId, channel, ip: clientIp });

  if (!deviceId) {
    ws.close(1008, "missing device param");
    return;
  }

  const stream = getVideoStream(deviceId, channel);
  stream.clients.add(ws);

  // Send FLV file header immediately
  sendToVideoClient(ws, makeFLVHeader());

  if (stream.codec === "h265") {
    // Already know it's H.265 – reject immediately
    sendH265ErrorAndClose(ws);
    stream.clients.delete(ws);
    stream.clientSeqSent.delete(ws);
    return;
  }

  // If we already have SPS/PPS cached, send sequence header right away so the
  // client can decode frames from the next IDR onward.
  if (stream.codec === "h264" && stream.sps && stream.pps) {
    try {
      sendToVideoClient(ws, makeAVCSequenceHeaderTag(stream.sps, stream.pps, 0));
      stream.clientSeqSent.set(ws, true);
    } catch (e) {
      console.log("[VideoWS] failed to send cached seq header", e.message);
      stream.clientSeqSent.set(ws, false);
    }
  } else {
    stream.clientSeqSent.set(ws, false);
  }

  ws.on("close", () => {
    stream.clients.delete(ws);
    stream.clientSeqSent.delete(ws);
    console.log("[VideoWS] client disconnected", { deviceId, channel, ip: clientIp });
  });

  ws.on("error", () => {
    stream.clients.delete(ws);
    stream.clientSeqSent.delete(ws);
  });
});

// ─── JT1078 → FLV pipeline ────────────────────────────────────────────────────

const reassembler = new FrameReassembler({
  onLog: (msg) => console.log("[JT1078-reassembler]", msg)
});

/**
 * Process a reassembled JT1078 video frame and push FLV data to all connected
 * WebSocket clients for the matching (deviceId, channel) stream.
 */
function processVideoFrame({ deviceId, channel, payloadType, data }) {
  const stream = getVideoStream(deviceId, channel);
  stream.lastPktTs = Date.now();
  if (!stream.startTs) {
    stream.startTs = Date.now();
    console.log("[JT1078] stream started", { deviceId, channel });
  }

  const tsMs = Date.now() - stream.startTs;

  // ── Codec detection (once per stream) ──
  if (!stream.codec) {
    stream.codec = detectCodec(data);
    console.log("[JT1078] codec detected", { deviceId, channel, codec: stream.codec });
    broadcast({
      type: "stream_status",
      deviceId,
      data: { channel, codec: stream.codec, active: true }
    });

    if (stream.codec === "h265") {
      // Close any already-connected video clients
      for (const ws of [...stream.clients]) {
        sendH265ErrorAndClose(ws);
        stream.clients.delete(ws);
        stream.clientSeqSent.delete(ws);
      }
      return;
    }
  }

  if (stream.codec !== "h264") return;

  // ── Parse NAL units ──
  const nalUnits = splitAnnexBNalUnits(data);
  if (nalUnits.length === 0) return;

  // ── Update SPS/PPS cache ──
  const { sps, pps } = extractSPSPPS(nalUnits);
  if (sps) stream.sps = sps;
  if (pps) stream.pps = pps;

  // ── Build AVC sequence-header tag (needed once, or when SPS/PPS change) ──
  let seqHeaderTag = null;
  if (stream.sps && stream.pps) {
    try {
      seqHeaderTag = makeAVCSequenceHeaderTag(stream.sps, stream.pps, 0);
    } catch (e) {
      console.log("[JT1078] failed to build AVC seq header", e.message);
    }
  }

  // ── Filter slice NALs (strip SPS=7, PPS=8, AUD=9 – they're in the seq header) ──
  const sliceNals = nalUnits.filter((nal) => {
    const t = nal[0] & 0x1f;
    return t !== 7 && t !== 8 && t !== 9;
  });
  if (sliceNals.length === 0) return;

  const isKF = payloadType === "video-I" || isH264Keyframe(sliceNals);

  let naluTag;
  try {
    naluTag = makeAVCNALUTag(sliceNals, isKF, tsMs);
  } catch (e) {
    console.log("[JT1078] failed to build AVC NALU tag", e.message);
    return;
  }

  // ── Distribute to connected WebSocket clients ──
  for (const ws of stream.clients) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    try {
      // Send sequence header before first NALU tag
      if (!stream.clientSeqSent.get(ws) && seqHeaderTag) {
        ws.send(seqHeaderTag);
        stream.clientSeqSent.set(ws, true);
      }
      if (stream.clientSeqSent.get(ws)) {
        ws.send(naluTag);
      }
    } catch { /* ignore write errors */ }
  }
}

// ─── Existing video stats helper ──────────────────────────────────────────────

function updateVideoStats({ deviceId, channel, payloadType, dataBody }) {
  let s = state.videoStats.get(deviceId);
  if (!s) s = { bytes: 0, packets: 0, lastTs: Date.now(), perChannel: new Map() };

  s.bytes += dataBody.length;
  s.packets += 1;
  s.lastTs = Date.now();

  const ch = Number(channel);
  let cs = s.perChannel.get(ch);
  if (!cs) cs = { bytes: 0, packets: 0, lastTs: 0 };
  cs.bytes += dataBody.length;
  cs.packets += 1;
  cs.lastTs = Date.now();
  s.perChannel.set(ch, cs);

  state.videoStats.set(deviceId, s);

  broadcast({ type: "video", deviceId, data: { channel: ch, payloadType, size: dataBody.length } });
  broadcast({ type: "video_stats", deviceId, data: { channel: ch, ...cs } });
}

// ─── 0x9101 start/stop helpers ────────────────────────────────────────────────

function send9101Variant(sess, { deviceId, channel, dataType, streamType, serverIp, tcpPort, udpPort, pad21 }) {
  const msgSeq = sess.nextSeq++;
  const pkt = encodeRealtimeAv9101({
    deviceIdRaw10: sess.deviceIdRaw10,
    msgSeq,
    serverIp,
    tcpPort,
    udpPort,
    channel: Number(channel),
    dataType,
    streamType,
    pad21: pad21 ?? false
  });

  sess.socket.write(pkt);
  console.log("[JT808] sent 0x9101 start realtime A/V", {
    deviceId, channel: Number(channel), dataType, streamType, serverIp, udpPort, tcpPort, pad21, msgSeq
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

function buildVariants({ serverIp, tcpPort, udpPort }) {
  return [
    // Standard variants – variable-length IP/domain field
    { name: "udp_only",       tcpPort: 0,     udpPort,    pad21: false },
    { name: "tcp_only",       tcpPort,         udpPort: 0, pad21: false },
    { name: "both",           tcpPort,         udpPort,    pad21: false },
    // Same variants with a fixed 21-byte padded IP field (required by some vendors)
    { name: "udp_only_pad21", tcpPort: 0,     udpPort,    pad21: true  },
    { name: "tcp_only_pad21", tcpPort,         udpPort: 0, pad21: true  },
    { name: "both_pad21",     tcpPort,         udpPort,    pad21: true  }
  ];
}

async function startRealtimeVideoAuto({ deviceId, channels = [1, 2], dataType = 1, streamType = 0 }) {
  const sess = state.jt808Sessions.get(deviceId);
  if (!sess?.socket) throw new Error(`No active JT808 session for device ${deviceId}`);

  // VIDEO_SERVER_DOMAIN takes highest priority (try domain first if set)
  const serverIp = process.env.VIDEO_SERVER_DOMAIN || process.env.VIDEO_SERVER_IP || process.env.PUBLIC_IP || localIpGuess();
  const tcpPort = Number(process.env.JT1078_TCP_PORT ?? 7001);
  const udpPort = Number(process.env.JT1078_UDP_PORT ?? 7001);

  const variants = buildVariants({ serverIp, tcpPort, udpPort });
  const results = [];

  for (const ch of channels) {
    let channelOk = false;

    for (const v of variants) {
      const replySeq = send9101Variant(sess, {
        deviceId,
        channel: ch,
        dataType,
        streamType,
        serverIp,
        tcpPort: v.tcpPort,
        udpPort: v.udpPort,
        pad21: v.pad21
      });

      const r = await awaitGeneralResponse(sess, replySeq, 3500);

      if (!r.ok) {
        console.log("[JT808] 0x9101 no generalRsp (timeout)", { deviceId, channel: Number(ch), variant: v.name, replySeq });
        results.push({ channel: Number(ch), variant: v.name, status: "timeout" });
        continue;
      }

      const gr = r.gr;
      results.push({ channel: Number(ch), variant: v.name, status: gr.resultName, result: gr.result });

      if (gr.result === 0) {
        console.log("[JT808] 0x9101 accepted", { deviceId, channel: Number(ch), variant: v.name });
        channelOk = true;
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
  const sess = state.jt808Sessions.get(deviceId);
  if (!sess?.socket) throw new Error(`No active JT808 session for device ${deviceId}`);

  for (const ch of channels) {
    const msgSeq = sess.nextSeq++;
    const pkt = encodeRealtimeAvCtrl9102({
      deviceIdRaw10: sess.deviceIdRaw10,
      msgSeq,
      channel: Number(ch),
      cmd: 0,
      closeType,
      switchStreamType: 0
    });

    sess.socket.write(pkt);
    console.log("[JT808] sent 0x9102 stop realtime A/V", { deviceId, channel: Number(ch), closeType, msgSeq });
  }
}

// ─── REST API ─────────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, "web")));

app.post("/api/video/:deviceId/start", async (req, res) => {
  const deviceId = req.params.deviceId;
  const channels = Array.isArray(req.body?.channels) ? req.body.channels : [1, 2];
  const streamType = req.body?.streamType != null ? Number(req.body.streamType) : 0;
  const dataType = req.body?.dataType != null ? Number(req.body.dataType) : 1;

  try {
    const results = await startRealtimeVideoAuto({ deviceId, channels, dataType, streamType });
    res.json({ ok: true, deviceId, channels, dataType, streamType, results });
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.post("/api/video/:deviceId/stop", (req, res) => {
  const deviceId = req.params.deviceId;
  const channels = Array.isArray(req.body?.channels) ? req.body.channels : [1, 2];

  try {
    stopRealtimeVideo({ deviceId, channels });
    res.json({ ok: true, deviceId, channels });
  } catch (e) {
    res.status(400).json({ ok: false, error: e?.message ?? String(e) });
  }
});

app.get("/api/video/streams", (req, res) => {
  const streams = [];
  for (const [key, vs] of videoStreams.entries()) {
    streams.push({
      key,
      deviceId: vs.deviceId,
      channel: vs.channel,
      codec: vs.codec,
      active: vs.lastPktTs ? Date.now() - vs.lastPktTs < 10_000 : false,
      clients: vs.clients.size
    });
  }
  res.json({ streams });
});

app.get("/api/devices", (req, res) => {
  const devices = [];
  for (const [deviceId] of state.jt808Sessions.entries()) {
    devices.push({ deviceId });
  }
  res.json({ devices });
});

// ─── Protocol servers ─────────────────────────────────────────────────────────

// JT808 server
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
    console.log("[JT808] session ready", { deviceId });

    if (process.env.AUTO_START_VIDEO === "1") {
      startRealtimeVideoAuto({ deviceId, channels: [1, 2], dataType: 1, streamType: 0 }).catch((e) => {
        console.log("[JT808] auto-start video failed", { deviceId, error: e?.message ?? String(e) });
      });
    }
  },
  onGeneralResponse: (gr) => {
    const sess = state.jt808Sessions.get(gr.deviceId);
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

// JT1078 packet handler – shared by both TCP and UDP receivers
function onJT1078Packet(p) {
  updateVideoStats(p);

  // Feed into reassembler; only process complete frames
  const frame = reassembler.process(p);
  if (frame) {
    processVideoFrame(frame);
  }
}

// JT1078 UDP receiver
startJT1078Udp({
  port: Number(process.env.JT1078_UDP_PORT ?? 7001),
  onPacket: onJT1078Packet,
  onLog: (line) => console.log("[JT1078]", line)
});

// JT1078 TCP receiver
startJT1078Tcp({
  port: Number(process.env.JT1078_TCP_PORT ?? 7001),
  onPacket: onJT1078Packet,
  onLog: (line) => console.log("[JT1078]", line)
});

// ─── HTTP server ──────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3008);
server.listen(PORT, () => {
  console.log(`Web app running at http://localhost:${PORT}`);
  console.log(`JT808 TCP gateway on port ${process.env.JT808_PORT ?? 6808}`);
  console.log(`JT1078 UDP receiver on port ${process.env.JT1078_UDP_PORT ?? 7001}`);
  console.log(`JT1078 TCP receiver on port ${process.env.JT1078_TCP_PORT ?? 7001}`);
  console.log(`Video WebSocket at ws://localhost:${PORT}/ws/video?device=<id>&channel=1`);
  if (process.env.VIDEO_SERVER_DOMAIN) {
    console.log(`0x9101 server address: ${process.env.VIDEO_SERVER_DOMAIN}`);
  }
});
