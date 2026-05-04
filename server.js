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

wss.on("connection", (ws) => {
  state.clients.add(ws);
  ws.on("close", () => state.clients.delete(ws));
  ws.send(JSON.stringify({ type: "hello", data: { ok: true } }));
});

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of state.clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
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

const PORT = Number(process.env.PORT ?? 3000);
server.listen(PORT, () => {
  console.log(`Web app running at http://localhost:${PORT}`);
  console.log(`JT808 TCP gateway on port ${process.env.JT808_PORT ?? 6808}`);
  console.log(`JT1078 UDP receiver on port ${process.env.JT1078_UDP_PORT ?? 7001}`);
});
