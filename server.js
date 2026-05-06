import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { fileURLToPath } from "url";

import { startJT808Server } from "./jt808/jt808-server.js";
import { startJT1078Udp } from "./jt1078/jt1078-udp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const state = {
  // deviceId -> { latest, history: [] }
  gps: new Map(),
  // deviceId -> { bytes, packets, lastTs }
  videoStats: new Map(),
  // connected WebSocket clients
  clients: new Set()
};

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
  ws.send(JSON.stringify({ type: "hello", data: { ok: true } }));

  // Hydrate UI on connect with the latest known GPS for each device.
  // This avoids a "stuck" UI when a device only reports location infrequently.
  for (const [deviceId, rec] of state.gps.entries()) {
    if (rec?.latest) {
      ws.send(JSON.stringify({ type: "gps", deviceId, data: rec.latest }));
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
  // Keep this lightweight; GPS can be frequent.
  if (obj?.type === "gps" || obj?.type === "video") {
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
  onLog: (line) => console.log("[JT808]", line)
});

// Start JT1078 UDP receiver (demo stats + raw forwarding)
startJT1078Udp({
  port: Number(process.env.JT1078_UDP_PORT ?? 7001),
  onPacket: ({ deviceId, channel, payloadType, dataBody }) => {
    const s = state.videoStats.get(deviceId) ?? { bytes: 0, packets: 0, lastTs: Date.now() };
    s.bytes += dataBody.length;
    s.packets += 1;
    s.lastTs = Date.now();
    state.videoStats.set(deviceId, s);

    // Broadcast packet metadata to all connected browsers
    // NOTE: dataBody is NOT decoded/played back yet — that requires a WebRTC/FLV pipeline.
    broadcast({
      type: "video",
      deviceId,
      data: {
        channel,
        payloadType,
        size: dataBody.length
      }
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
