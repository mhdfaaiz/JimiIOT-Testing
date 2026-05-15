# JC371 / JimiIoT GPS + Live Video Monitor

This project receives data from JC371 devices and shows it on a browser dashboard.

It supports:
- JT/T 808 over TCP for GPS and device control
- JT/T 1078 over UDP/TCP for live video packets
- Real-time web dashboard via WebSocket
- Live video playback in browser using FLV over WebSocket

This guide is written for freshers and explains everything from scratch.

---

## 1. What You Will Build

After setup is complete, you will have:
- A backend server listening for device data
- A browser dashboard showing GPS and video channel activity
- Start Video button that sends JT808 message 0x9101
- Working live stream (Channel 1 and Channel 2 video players)

---

## 2. Tech Stack and Libraries

## Runtime
- Node.js 18 or newer
- FFmpeg installed on system PATH

## NPM packages (installed by npm install)
- express: HTTP server and APIs
- ws: WebSocket server and client communication

## Browser library (loaded from CDN)
- flv.js 1.6.2 in dashboard-web/index.html

## Built-in Node modules used in code
- http
- path
- os
- child_process
- url
- net
- dgram

---

## 3. Project Structure

- server.js: Main app, API, JT808/JT1078 wiring, FFmpeg pipeline, WebSocket hub
- protocol-jt808/protocol-codec.js: JT808 escape/unescape, checksum, BCD time parsing
- protocol-jt808/message-handlers.js: JT808 message parser + encoder for 0x8001, 0x8100, 0x9101, 0x9102
- protocol-jt808/tcp-gateway.js: TCP server for JT808 frames
- protocol-jt1078/udp-stream-receiver.js: JT1078 UDP packet parser
- protocol-jt1078/tcp-stream-receiver.js: JT1078 TCP packet parser
- protocol-jt1078/frame-reassembler.js: Reassembles fragmented JT1078 payloads into complete frames
- dashboard-web/index.html: Dashboard UI + players
- dashboard-web/dashboard-client.js: Browser-side WebSocket + video player logic
- JT808-JT1078-TCP-Integration-Guide.md: Detailed TCP/JT808/JT1078 workflow documentation

---

## 4. End-to-End Workflow (Simple)

1. Device connects to JT808 TCP port and sends heartbeat/auth/location.
2. Server parses JT808 frame and acknowledges with 0x8001.
3. On dashboard, GPS updates are pushed over WebSocket.
4. User clicks Start Video.
5. Server sends JT808 0x9101 to ask device to start stream.
6. Device starts sending JT1078 packets (UDP or TCP depending on accepted variant).
7. JT1078 reassembler joins fragmented payloads into full frames.
8. Server starts FFmpeg and feeds normalized video frames.
9. FFmpeg outputs FLV bytes.
10. FLV bytes are forwarded to browser via /ws/video.
11. flv.js plays stream in Channel 1 and Channel 2 video elements.

---

## 5. Video Stability Fixes Already Included

The current code includes these reliability improvements:
- Wait for keyframe + SPS/PPS (and VPS for HEVC) before first decode start
- Automatic Annex-B normalization and parameter set injection
- Codec lock after first successful output (prevents unstable codec flipping)
- Decoder-error restart on next keyframe (safe restart timing)
- Per-channel pre-roll buffering for smooth player refresh/reconnect
- Better fallback behavior between h264/hevc/mpeg input formats

This is why your video is now working reliably.

---

## 6. Install from Scratch

## Windows
1. Install Node.js 18+ from official Node.js website.
2. Install FFmpeg and add ffmpeg.exe to PATH.
3. Open PowerShell in project folder.
4. Run:

```bash
npm install
npm start
```

## Ubuntu / Debian
1. Install Node.js 18+.
2. Install FFmpeg:

```bash
sudo apt update
sudo apt install -y ffmpeg
```

3. Install dependencies and run:

```bash
npm install
npm start
```

You should see startup logs for:
- Web app port
- JT808 TCP port
- JT1078 UDP port
- JT1078 TCP port

---

## 7. Required Ports

Open these ports in firewall / cloud security group:

- PORT (default 3008): Web dashboard + APIs
- JT808_PORT (default 6808, TCP): GPS/auth/control
- JT1078_UDP_PORT (default 7001, UDP): Video stream (UDP mode)
- JT1078_TCP_PORT (default 7001, TCP): Video stream (TCP mode)

If device is remote, set public address correctly.

---

## 8. Environment Variables

All supported variables in current implementation:

| Variable | Default | Meaning |
|---|---:|---|
| PORT | 3008 | Web app port |
| JT808_PORT | 6808 | JT808 TCP server port |
| JT1078_UDP_PORT | 7001 | JT1078 UDP port (set 0 to disable UDP) |
| JT1078_TCP_PORT | 7001 | JT1078 TCP port (set 0 to disable TCP) |
| JT1078_PREFER_TCP | 0 | Use TCP-first variant ordering for 0x9101 |
| VIDEO_CODEC | auto | Force h264 or hevc |
| VIDEO_INPUT_FORMAT | auto | Force ffmpeg demux format: h264 / hevc / mpeg |
| VIDEO_PROBE_MS | 12000 | Probe timeout before fallback retry |
| VIDEO_PREROLL_FRAMES | 40 | Max pre-roll frames kept per channel |
| VIDEO_PREROLL_BYTES | 2097152 | Max pre-roll bytes kept per channel |
| PUBLIC_IP | auto | Public IP sent in 0x9101 if VIDEO_SERVER_IP missing |
| VIDEO_SERVER_IP | fallback PUBLIC_IP | Explicit IP used in 0x9101 |
| REGISTER_ON_AUTH | 0 | Mark device registered when 0x0102 auth succeeds |
| AUTO_START_VIDEO | 0 | Auto send 0x9101 after auth |
| JT808_9101_ALLOW_ZERO_PORTS | 1 | Allow 0-port variant trials |

## Example (Linux)

```bash
PORT=3008 \
JT808_PORT=6808 \
JT1078_TCP_PORT=7001 \
JT1078_UDP_PORT=7001 \
REGISTER_ON_AUTH=1 \
VIDEO_CODEC=h264 \
npm start
```

---

## 9. Device Setup Checklist

Configure your JC371 platform/device with:
- Server IP: your public server IP
- JT808 port: 6808 (or your custom JT808_PORT)
- Media server IP: same public server IP
- Media TCP/UDP ports: 7001 (or your custom ports)
- Protocol mode: JT808-2019 + JT1078 enabled

If UDP is blocked in network:
- Set JT1078_UDP_PORT=0
- Keep JT1078_TCP_PORT=7001
- Set JT1078_PREFER_TCP=1

---

## 10. Running with PM2 (Production)

Install PM2 globally:

```bash
npm install -g pm2
```

Start app:

```bash
pm2 start server.js --name FleetManagement
```

Restart with updated env:

```bash
pm2 restart FleetManagement --update-env
```

Read logs:

```bash
pm2 logs FleetManagement --lines 200
```

---

## 11. API Endpoints

- GET /api/devices
  - List known JT808 sessions and status
- GET /api/video/streams
  - Per-device/per-channel stream stats
- POST /api/video/:deviceId/start
  - Send 0x9101 start for channels
- POST /api/video/:deviceId/stop
  - Send 0x9102 stop for channels

Example start request body:

```json
{
  "channels": [1, 2],
  "dataType": 1,
  "streamType": 0
}
```

---

## 12. First-Time Testing Flow

1. Start server.
2. Open browser at http://localhost:3008.
3. Wait for device auth and location updates.
4. Confirm GPS block is updating.
5. Click Start Video.
6. Confirm logs show 0x9101 accepted.
7. Confirm JT1078 packets and FRAME COMPLETE logs.
8. Confirm FFmpeg started for channel 1/2.
9. Confirm video appears in both players.

---

## 13. Troubleshooting

## A) Video blank but packets are coming
- Set VIDEO_CODEC=h264 and restart.
- Confirm ffmpeg is installed and reachable:

```bash
ffmpeg -version
```

- Confirm browser supports MSE and flv.js.

## B) 0x9101 accepted but no video packets
- Network/firewall issue likely.
- Open UDP/TCP 7001.
- Try TCP-only mode:
  - JT1078_UDP_PORT=0
  - JT1078_PREFER_TCP=1

## C) 0x9101 result is failure
- Set REGISTER_ON_AUTH=1.
- Set PUBLIC_IP or VIDEO_SERVER_IP correctly.
- If needed set JT808_9101_ALLOW_ZERO_PORTS=0.

## D) Frequent reconnects
- Check mobile network quality.
- Keep TCP preferred if UDP unstable.
- Keep pre-roll defaults unless memory pressure exists.

---

## 14. Fresher-Friendly Code Reading Order

Read files in this order:
1. server.js
2. protocol-jt808/tcp-gateway.js
3. protocol-jt808/message-handlers.js
4. protocol-jt1078/tcp-stream-receiver.js and protocol-jt1078/udp-stream-receiver.js
5. protocol-jt1078/frame-reassembler.js
6. dashboard-web/dashboard-client.js

This order matches runtime flow and is easiest for beginners.

---

## 15. Important Notes

- This project stores runtime data in memory only.
- It is a practical integration reference, not a complete fleet production platform.
- Use reverse proxy, HTTPS, auth, and persistence for enterprise deployment.

---

## 16. License

MIT
