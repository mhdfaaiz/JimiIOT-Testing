"# JimiIoT / JC371 — GPS Tracking & Live Video Monitor

A minimal Node.js demo application that integrates a **JC371 (Jimi IoT)** device for:

- 📍 **GPS tracking** via the [JT/T 808-2019](https://www.transport.gov.cn/) protocol (TCP).
- 📹 **Live video stream reception** via the JT/T 1078 protocol (UDP).
- 🖥️ A real-time **web dashboard** pushed over WebSocket.

---

## Requirements

- **Node.js 18+** (ES Modules / `node --version` should be ≥ 18)
- A public IP address (or port-forwarded host) that your JC371 device can reach.

---

## Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start
```

Open your browser at **http://localhost:3000**.

### Custom ports (optional)

| Environment variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Web app HTTP + WebSocket |
| `JT808_PORT` | `6808` | JT/T 808 TCP server (GPS) |
| `JT1078_UDP_PORT` | `7001` | JT/T 1078 UDP server (video) |
| `PUBLIC_IP` | _(auto-detect)_ | Public IP sent to device in 0x9101 |
| `VIDEO_SERVER_IP` | _(falls back to PUBLIC_IP)_ | Override IP for video server in 0x9101 |
| `REGISTER_ON_AUTH` | `0` | Set to `1` to mark device as registered on successful auth (for devices that skip 0x0100) |
| `JT808_9101_ALLOW_ZERO_PORTS` | `1` | Set to `0` to only send 0x9101 variants with non-zero TCP and UDP ports |

```bash
PORT=8080 JT808_PORT=6808 JT1078_UDP_PORT=7001 npm start
```

---

## Ports to expose to the device

| Port | Protocol | Purpose |
|---|---|---|
| `6808` (or `$JT808_PORT`) | **TCP** | JT/T 808 gateway — GPS, heartbeat, auth |
| `7001` (or `$JT1078_UDP_PORT`) | **UDP** | JT/T 1078 stream receiver — live video packets |

Configure the same IP address and ports in your Jimi IoT / JC371 device settings.

---

## Project structure

```
.
├── server.js               # Express + WebSocket hub + wires up JT808 & JT1078 servers
├── package.json
├── jt808/
│   ├── codec.js            # Frame unescaping, XOR checksum, BCD time helpers
│   ├── jt808-server.js     # TCP listener, frame extraction, dispatch
│   └── handlers.js         # Message handlers (0x0002, 0x0102, 0x0200) + 0x8001 encoder
├── jt1078/
│   └── jt1078-udp.js       # UDP listener, JT/T 1078 packet parser
└── web/
    ├── index.html          # Dashboard UI
    └── app.js              # WebSocket client, DOM updates
```

---

## What's implemented

### JT/T 808 TCP gateway (GPS)

| Message ID | Direction | Handled |
|---|---|---|
| `0x0002` Heartbeat | Device → Server | ✅ Reply `0x8001` success |
| `0x0102` Authentication | Device → Server | ✅ Reply `0x8001` success (accept-all) |
| `0x0200` Location report | Device → Server | ✅ Parse GPS fields + TLVs; broadcast to UI; reply `0x8001` |

**Protocol details:**
- Frame delimiters: `0x7E … 0x7E`
- Unescape: `0x7D 0x01` → `0x7D`, `0x7D 0x02` → `0x7E`
- Checksum: XOR over header + body (verified on receive, applied on send)
- Header: v2019 layout — msgId(2) + attr(2) + protoVer(1) + deviceId(10) + msgSeq(2)

### JT/T 1078 UDP receiver (video packets)

- Identifies packets by header magic `0x30 0x31 0x63 0x64` ("01cd").
- Extracts: sequence number, BCD[6] device ID, logical channel, payload type, subpacket flag, body length, data body.
- Broadcasts packet metadata (device, channel, payload type, size) to the web dashboard over WebSocket.

### Web dashboard

- Real-time GPS: device ID, UTC time, lat/lng, speed, heading, altitude, ACC status, GPS fix.
- GPS history log (last 20 entries).
- Video packet log (device, channel, type, byte size).
- WebSocket connection indicator.

---

## Limitations & next steps

### Current limitations

1. **Video is not decoded or played back.** The JT/T 1078 receiver captures and logs raw UDP packets but does not reassemble H.264/H.265 frames or deliver a playable stream to the browser.
2. **No device registration (0x0100).** Authentication is accept-all; no auth-code database is maintained.
3. **No persistence.** GPS history is in-memory only and lost on restart.
4. **Single-server, single-process.** Not suitable for production scale.

### Recommended next steps for live video playback

| Approach | Latency | Complexity |
|---|---|---|
| **WebRTC** via mediasoup / Janus | ~100–300 ms | High |
| **FLV over WebSocket** (flv.js) — H.264 only | ~500 ms–1 s | Medium |
| **HLS** via FFmpeg segmenter | 2–10 s | Low |

The recommended path for JC371 is:
1. Reassemble JT/T 1078 sub-packets into complete NAL units.
2. Wrap H.264 in an FLV container and push over WebSocket → play with **flv.js** in browser.
3. For H.265 or lower latency: transcode to H.264 WebRTC with GStreamer/FFmpeg + mediasoup.

### Other improvements
- Persist GPS tracks to a database (PostgreSQL / Redis).
- Implement `0x9101` downlink command to start/stop live video on demand.
- Implement `0x0100` registration with auth-code management.
- Add authentication to the web UI.
- Add a proper map view (Leaflet / Google Maps).

---

## License

MIT

---

## Troubleshooting

### Device authenticates (0x0102) but does not send registration (0x0100)

Some Jimi IoT / JC371 firmware versions skip the registration step and go straight to authentication.
This causes `/api/devices` to show `registered:false`, and many firmwares will then reject the
`0x9101` realtime A/V start command with `result=1 (failure)`.

**Fix:** Set the `REGISTER_ON_AUTH=1` environment variable to infer registration from a successful auth.

```bash
REGISTER_ON_AUTH=1 npm start
# or in PM2 ecosystem.config.js: env: { REGISTER_ON_AUTH: "1" }
```

When enabled, the server will log:
```
[JT808] REGISTER_ON_AUTH: inferring registration from auth { deviceId: '...' }
```

---

### 0x9101 realtime video start fails with result=1 (failure)

1. **Set your public IP** so the device can reach the video server:

   ```bash
   PUBLIC_IP=1.2.3.4 npm start
   # or set VIDEO_SERVER_IP=1.2.3.4 for a separate video server address
   ```

2. **Enable registration-from-auth** if the device skips 0x0100 (see above):

   ```bash
   REGISTER_ON_AUTH=1 PUBLIC_IP=1.2.3.4 npm start
   ```

3. **Restrict 0x9101 to non-zero port variants.** By default all six port combination variants
   are tried, including those with `tcpPort=0` or `udpPort=0`. Some firmware rejects these.
   To only send variants where both ports are non-zero (`var_both` and `pad_both`), set:

   ```bash
   JT808_9101_ALLOW_ZERO_PORTS=0 npm start
   ```

   The default value (`1`) preserves the original behaviour of trying all six variants." 
