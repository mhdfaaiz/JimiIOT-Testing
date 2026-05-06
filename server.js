import express from "express";
import http from "http";
import path from "path";
import os from "os";
import { WebSocketServer, WebSocket } from "ws";
import { fileURLToPath } from "url";

import { startJT808Server } from "./jt808/jt808-server.js";
import { startJT1078Udp } from "./jt1078/jt1078-udp.js";
import { encodeRealtimeAv9101, encodeRealtimeAvCtrl9102 } from "./jt808/handlers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const state = {
  // deviceId -> { latest, history: [] }
  gps: new Map(),

  // deviceId -> { bytes, packets, lastTs, perChannel: Map<channel, stats> }
  videoStats: new Map(),

  // deviceId -> { socket, deviceIdRaw10, nextSeq }
  jt808Sessions: new Map(),

  // connected WebSocket clients
  clients: new Set()
};

function localIpGuess() {
  // If you set PUBLIC_IP, we use that.
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
      nextSeq: 1
    };
    state.jt808Sessions.set(deviceId, s);
  } else {
    s.socket = socket;
  }
  return s;
}

function wsSend(ws, obj) {
  try {
    ws.send(JSON.stringify(obj));
  } catch {
    // ignore
  }
}

wss.on("connection", (ws, req) => {
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress;
  console.log("[WS] client connected", { ip });

  state.clients.add(ws);
  ws.on("close", (code, reason) => {
    console.log("[WS] client disconnected", { ip, code, reason: reason?.toString() });
    state.clients.delete(ws);
  });
  ws.on("error", (err) => {
    console.log("[WS] client error", { ip, message: err?.message });
  });

  // Always send hello immediately.
  wsSend(ws, { type: "hello", data: { ok: true } });

  // Hydrate UI on connect with the latest known GPS for each device.
  for (const [deviceId, rec] of state.gps.entries()) {
    if (rec?.latest) wsSend(ws, { type: "gps", deviceId, data: rec.latest });
  }

  // Hydrate UI on connect with latest known video stats per device/channel.
  for (const [deviceId, s] of state.videoStats.entries()) {
    const per = s?.perChannel;
    if (!per) continue;
    for (const [channel, cs] of per.entries()) {
      wsSend(ws, { type: "video_stats", deviceId, data: { channel, ...cs } });
    }
  }
});

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  let ok = 0;
  let skipped = 0;
  for (const ws of state.clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
      ok++;
    } else {
      skipped++;
    }
  }
  if (obj?.type === "gps" || obj?.type === "video" || obj?.type === "video_stats") {
    console.log(`[WS] broadcast type=${obj.type} to open=${ok} skipped=${skipped}`);
  }
}

// Serve static UI
app.use(express.static(path.join(__dirname, "web")));

// Simple REST APIs
app.get("/api/devices", (req, res) => {
  res.json({ devices: Array.from(state.gps.keys()) });
});

app.get("/api/gps/:deviceId/latest", (req, res) => {
  const d = state.gps.get(req.params.deviceId);
  res.json({ deviceId: req.params.deviceId, latest: d?.latest ?? null });
});

app.get("/api/gps/:deviceId/history", (req, res) => {
  const d = state.gps.get(req.params.deviceId);
  res.json({ deviceId: req.params.deviceId, history: d?.history ?? [] });
});

app.get("/api/video/:deviceId/stats", (req, res) => {
  const s = state.videoStats.get(req.params.deviceId);
  if (!s?.perChannel) return res.json({ deviceId: req.params.deviceId, perChannel: {} });

  const perChannel = {};
  for (const [ch, cs] of s.perChannel.entries()) perChannel[String(ch)] = cs;
  res.json({ deviceId: req.params.deviceId, perChannel });
});

function startRealtimeVideo({ deviceId, channels = [1, 2], dataType = 1, streamType = 0 }) {
  const sess = state.jt808Sessions.get(deviceId);
  if (!sess?.socket) throw new Error(`No active JT808 session for device ${deviceId}`);

  const serverIp = process.env.VIDEO_SERVER_IP || process.env.PUBLIC_IP || localIpGuess();
  const tcpPort = Number(process.env.JT1078_TCP_PORT ?? process.env.JT1078_PORT ?? 7001);
  const udpPort = Number(process.env.JT1078_UDP_PORT ?? 7001);

  for (const ch of channels) {
    const msgSeq = sess.nextSeq++;
    const pkt = encodeRealtimeAv9101({
      deviceIdRaw10: sess.deviceIdRaw10,
      msgSeq,
      serverIp,
      tcpPort,
      udpPort,
      channel: Number(ch),
      dataType,
      streamType
    });

    sess.socket.write(pkt);
    console.log("[JT808] sent 0x9101 start realtime A/V", { deviceId, channel: Number(ch), dataType, streamType, serverIp, udpPort });
  }
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
    console.log("[JT808] sent 0x9102 stop realtime A/V", { deviceId, channel: Number(ch), closeType });
  }
}

// Start/Stop endpoints
app.post("/api/video/:deviceId/start", (req, res) => {
  const deviceId = req.params.deviceId;
  const channels = Array.isArray(req.body?.channels) ? req.body.channels : [1, 2];
  const streamType = req.body?.streamType != null ? Number(req.body.streamType) : 0;
  const dataType = req.body?.dataType != null ? Number(req.body.dataType) : 1;

  try {
    startRealtimeVideo({ deviceId, channels, dataType, streamType });
    res.json({ ok: true, deviceId, channels, dataType, streamType });
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

// Start JT808 TCP gateway
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
    const sess = getOrInitSession(deviceId, socket);
    console.log("[JT808] session ready", { deviceId });

    if (process.env.AUTO_START_VIDEO === "1") {
      try {
        startRealtimeVideo({ deviceId, channels: [1, 2], dataType: 1, streamType: 0 });
      } catch (e) {
        console.log("[JT808] auto-start video failed", { deviceId, error: e?.message ?? String(e) });
      }
    }
  },
  onLog: (line) => console.log("[JT808]", line)
});

// Start JT1078 UDP receiver (demo stats + raw forwarding)
startJT1078Udp({
  port: Number(process.env.JT1078_UDP_PORT ?? 7001),
  onPacket: ({ deviceId, channel, payloadType, dataBody }) => {
    // Total stats per device
    let s = state.videoStats.get(deviceId);
    if (!s) s = { bytes: 0, packets: 0, lastTs: Date.now(), perChannel: new Map() };

    s.bytes += dataBody.length;
    s.packets += 1;
    s.lastTs = Date.now();

    // Per-channel stats
    const ch = Number(channel);
    let cs = s.perChannel.get(ch);
    if (!cs) cs = { bytes: 0, packets: 0, lastTs: 0 };
    cs.bytes += dataBody.length;
    cs.packets += 1;
    cs.lastTs = Date.now();
    s.perChannel.set(ch, cs);

    state.videoStats.set(deviceId, s);

    // Broadcast packet metadata to all connected browsers
    broadcast({
      type: "video",
      deviceId,
      data: {
        channel: ch,
        payloadType,
        size: dataBody.length
      }
    });

    // Broadcast per-channel stats too (for CH1/CH2 panels)
    broadcast({
      type: "video_stats",
      deviceId,
      data: { channel: ch, ...cs }
    });
  },
  onLog: (line) => console.log("[JT1078]", line)
});

const PORT = Number(process.env.PORT ?? 3008);
server.listen(PORT, () => {
  console.log(`Web app running at http://localhost:${PORT}`);
  console.log(`JT808 TCP gateway on port ${process.env.JT808_PORT ?? 6808}`);
  console.log(`JT1078 UDP receiver on port ${process.env.JT1078_UDP_PORT ?? 7001}`);
});
