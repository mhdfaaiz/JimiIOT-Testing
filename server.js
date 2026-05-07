import express from "express";
import http from "http";
import path from "path";
import os from "os";
import { WebSocketServer, WebSocket } from "ws";
import { fileURLToPath } from "url";

import { startJT808Server } from "./jt808/jt808-server.js";
import { startJT1078Udp }   from "./jt1078/jt1078-udp.js";
import { startJT1078Tcp }   from "./jt1078/jt1078-tcp.js";
import { encodeRealtimeAv9101, encodeRealtimeAvCtrl9102 } from "./jt808/handlers.js";
import { JT1078Reassembler } from "./jt1078/reassembler.js";
import { FlvMuxer, parseAnnexB } from "./jt1078/flv-muxer.js";

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
  // "deviceId:channel" → { subs: Set<{ws, mux}>, lastSps: Buffer|null, lastPps: Buffer|null }
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
      deviceIdRaw10:  Buffer.from(deviceId, "hex"),
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

// ── Video streaming WebSocket: /ws/video?device=<id>&channel=<1|2> ────────────

wssVideo.on("connection", (ws, req) => {
  const url      = new URL(req.url ?? "/", "http://localhost");
  const rawDevice = url.searchParams.get("device") ?? "";
  const deviceId  = canonicalId(rawDevice);
  const channel   = Number(url.searchParams.get("channel") ?? 1);

  if (!deviceId) { ws.close(1008, "Missing device param"); return; }

  console.log("[WS/video] subscriber connected", { deviceId, channel, raw: rawDevice });

  const key = `${deviceId}:${channel}`;
  let ch = state.videoChannels.get(key);
  if (!ch) {
    ch = { subs: new Set(), lastSps: null, lastPps: null };
    state.videoChannels.set(key, ch);
  }

  const mux = new FlvMuxer();
  const sub = { ws, mux };

  // Send FLV file header immediately
  try {
    ws.send(mux.header(), { binary: true });
  } catch {
    return;
  }

  // Prime with cached SPS/PPS so playback starts at the next data NAL
  // (rather than waiting for the device to re-send SPS/PPS)
  if (ch.lastSps && ch.lastPps) {
    mux.prime(ch.lastSps, ch.lastPps);
    const seqChunks = mux.getSeqHeader();
    seqChunks.forEach(c => { try { ws.send(c, { binary: true }); } catch {} });
  }

  ch.subs.add(sub);

  ws.on("close", () => {
    ch.subs.delete(sub);
    console.log("[WS/video] subscriber left", { deviceId, channel });
  });
  ws.on("error", () => ch.subs.delete(sub));
});

// ── Static files ──────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, "web")));

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
  if (!cs) cs = { bytes: 0, packets: 0, lastTs: 0 };
  cs.bytes   += dataBody.length;
  cs.packets += 1;
  cs.lastTs   = Date.now();
  s.perChannel.set(ch, cs);
  state.videoStats.set(cid, s);
  broadcast({ type: "video",       deviceId: cid, data: { channel: ch, payloadType, size: dataBody.length } });
  broadcast({ type: "video_stats", deviceId: cid, data: { channel: ch, ...cs } });
}

function handleJT1078Packet(packet) {
  updateVideoStats(packet);

  if (!packet.payloadType.startsWith("video")) return;

  const frame = reassembler.push(packet);
  if (!frame) return;

  const cid = canonicalId(frame.deviceId);
  const key = `${cid}:${frame.channel}`;
  let ch = state.videoChannels.get(key);
  if (!ch) {
    ch = { subs: new Set(), lastSps: null, lastPps: null };
    state.videoChannels.set(key, ch);
  }

  // Cache SPS/PPS at the channel level for priming late-joining subscribers
  if (frame.payloadType === "video-I") {
    const nalus = parseAnnexB(frame.data);
    for (const n of nalus) {
      const t = n[0] & 0x1f;
      if (t === 7) ch.lastSps = n;
      if (t === 8) ch.lastPps = n;
    }
  }

  if (ch.subs.size === 0) return;

  for (const sub of ch.subs) {
    if (sub.ws.readyState !== WebSocket.OPEN) continue;
    try {
      const chunks = sub.mux.push(frame);
      for (const c of chunks) sub.ws.send(c, { binary: true });
    } catch { /* closed WS — will be removed on next close event */ }
  }
}

// ── JT808 command helpers ─────────────────────────────────────────────────────

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
 */
function buildVariants({ tcpPort, udpPort }) {
  return [
    { name: "var_udp",  tcpPort: 0,    udpPort,    pad21: false },
    { name: "var_tcp",  tcpPort,       udpPort: 0, pad21: false },
    { name: "var_both", tcpPort,       udpPort,    pad21: false },
    { name: "pad_udp",  tcpPort: 0,    udpPort,    pad21: true  },
    { name: "pad_tcp",  tcpPort,       udpPort: 0, pad21: true  },
    { name: "pad_both", tcpPort,       udpPort,    pad21: true  }
  ];
}

async function startRealtimeVideoAuto({ deviceId, channels = [1, 2], dataType = 1, streamType = 0 }) {
  const sess = resolveSession(deviceId);
  if (!sess?.socket || sess.socket.destroyed) {
    throw new Error(`No active JT808 session for device ${deviceId}`);
  }

  const serverIp = process.env.VIDEO_SERVER_IP || process.env.PUBLIC_IP || localIpGuess();
  const tcpPort  = Number(process.env.JT1078_TCP_PORT ?? 7001);
  const udpPort  = Number(process.env.JT1078_UDP_PORT ?? 7001);
  const variants = buildVariants({ tcpPort, udpPort });
  const results  = [];

  for (const ch of channels) {
    let channelOk = false;

    for (const v of variants) {
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

      if (gr.result === 0) {
        console.log("[JT808] 0x9101 accepted", { deviceId, channel: Number(ch), variant: v.name });
        channelOk = true;
        break;
      }

      // result=3 "unsupported" — no value in trying more variants for this channel
      if (gr.result === 3) {
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
      deviceIdRaw10: sess.deviceIdRaw10,
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
