# TCP Integration Documentation (Beginner Friendly)

This document explains how JT/T 808 and JT/T 1078 are integrated in this project.
It is written in simple words for freshers.

If you only want quick setup, read README first.
If you want deep understanding, continue here.

---

## 1. Integration Goal

We need one server that can do all of these at the same time:
- Receive GPS, heartbeat, auth over JT808 TCP
- Send command 0x9101 to start live stream
- Receive live media packets from device over JT1078 UDP/TCP
- Reassemble fragmented media payloads
- Decode/transcode via FFmpeg
- Push playable FLV stream to browser

---

## 2. End-to-End Data Pipeline

## Step A: Device to JT808 TCP server
- Device opens TCP connection to JT808 port.
- It sends 0x0002, 0x0102, 0x0200 and other messages.
- Server validates checksum and parses message.
- Server replies using 0x8001 or 0x8100 where applicable.

Used code:
- protocol-jt808/tcp-gateway.js
- protocol-jt808/message-handlers.js
- protocol-jt808/protocol-codec.js

## Step B: User triggers video start
- Browser calls POST /api/video/:deviceId/start.
- Server sends JT808 0x9101 variants (udp/tcp combinations).
- Device responds with general response for 0x9101.
- Server detects accepted variant and waits for media packets.

Used code:
- server.js
- protocol-jt808/message-handlers.js encodeRealtimeAv9101

## Step C: Device sends JT1078 media packets
- Packets arrive to UDP and/or TCP JT1078 receiver.
- Parser extracts deviceId, channel, payloadType, subFlag, body.
- Reassembler joins segments into full frame.

Used code:
- protocol-jt1078/udp-stream-receiver.js
- protocol-jt1078/tcp-stream-receiver.js
- protocol-jt1078/frame-reassembler.js

## Step D: Frame to FFmpeg
- Server detects codec and input format.
- It normalizes frame data (Annex-B conversion and parameter set injection).
- It waits until first valid decode bootstrap (keyframe + SPS/PPS or VPS/SPS/PPS).
- Then FFmpeg starts and receives frame bytes through stdin.

Used code:
- server.js helper functions around normalizeFrameForCodec and ensureVideoTranscoder

## Step E: FFmpeg output to browser
- FFmpeg outputs FLV stream on stdout.
- Server sends FLV chunks through /ws/video WebSocket.
- Browser flv.js player consumes and renders video.

Used code:
- server.js WebSocket video path
- dashboard-web/dashboard-client.js
- dashboard-web/index.html

---

## 3. JT808 TCP Handling Explained

JT808 frames are wrapped with 0x7E delimiters.
Before parse:
- unescape 0x7D 0x01 -> 0x7D
- unescape 0x7D 0x02 -> 0x7E
- validate XOR checksum

Important message IDs handled:
- 0x0001: terminal general response
- 0x0002: heartbeat
- 0x0100: register
- 0x0102: auth
- 0x0200: location

Commands sent from server:
- 0x8001: platform general response
- 0x8100: registration response
- 0x9101: start live stream
- 0x9102: stop live stream

---

## 4. JT1078 Packet and Reassembly Logic

Packet identifier:
- Magic bytes: 0x30 0x31 0x63 0x64 (ASCII 01cd)

subFlag values used for reassembly:
- 0x00: full frame in one packet
- 0x01: first fragment
- 0x03: middle fragment
- 0x02: last fragment

Reassembly key:
- deviceId + channel

Output of reassembler:
- complete frame buffer
- payload type and timestamp context

---

## 5. Video Decode Reliability Strategy (Current Working Version)

To avoid blank video and errors like non-existing PPS:

1. Parameter set caching
- H264: cache SPS/PPS
- HEVC: cache VPS/SPS/PPS

2. Bootstrap gate
- FFmpeg start is delayed until first safe frame is available
- Safe means keyframe + required parameter sets

3. Pre-roll buffer
- Recent frames are cached per channel
- On FFmpeg start/restart, pre-roll is flushed first
- This improves first-frame decode and refresh behavior

4. Decoder-error restart policy
- If decoder errors are detected, restart is not immediate
- Restart happens on next keyframe only

5. Codec lock
- Once FLV output starts successfully, codec/input format is locked
- Prevents unstable h264/hevc/mpeg switching loops

---

## 6. Libraries and Tools Required

Mandatory:
- Node.js 18+
- npm
- FFmpeg available in PATH
- NPM packages: express, ws

Frontend playback:
- flv.js from CDN in dashboard-web/index.html

Optional but recommended:
- PM2 for process management

---

## 7. Clean Setup from Zero

## 7.1 Clone and install

```bash
git clone <your-repo-url>
cd JimiIOT-Testing-1
npm install
```

## 7.2 Install FFmpeg

Ubuntu:

```bash
sudo apt update
sudo apt install -y ffmpeg
```

Windows:
- Install FFmpeg package
- Add ffmpeg binary folder to PATH
- Test with ffmpeg -version

## 7.3 Start app

```bash
npm start
```

Open browser:
- http://localhost:3008

---

## 8. Production Run with PM2

```bash
npm install -g pm2
pm2 start server.js --name FleetManagement
pm2 restart FleetManagement --update-env
pm2 logs FleetManagement --lines 200
```

---

## 9. Environment Variable Reference

Core:
- PORT
- JT808_PORT
- JT1078_UDP_PORT
- JT1078_TCP_PORT

Video transport behavior:
- JT1078_PREFER_TCP
- VIDEO_CODEC
- VIDEO_INPUT_FORMAT
- VIDEO_PROBE_MS

Video reliability behavior:
- VIDEO_PREROLL_FRAMES
- VIDEO_PREROLL_BYTES

Device routing and registration:
- PUBLIC_IP
- VIDEO_SERVER_IP
- REGISTER_ON_AUTH
- AUTO_START_VIDEO
- JT808_9101_ALLOW_ZERO_PORTS

---

## 10. Recommended Known-Good Config

For most deployments:

```bash
PORT=3008
JT808_PORT=6808
JT1078_TCP_PORT=7001
JT1078_UDP_PORT=7001
REGISTER_ON_AUTH=1
VIDEO_CODEC=h264
```

For forced TCP (when UDP is blocked):

```bash
JT1078_UDP_PORT=0
JT1078_TCP_PORT=7001
JT1078_PREFER_TCP=1
```

---

## 11. Functional Validation Checklist

1. JT808 connect log appears.
2. Auth and GPS logs appear.
3. API /api/devices returns device.
4. Start Video sends 0x9101.
5. 0x9101 response result is success.
6. JT1078 packets arrive.
7. Reassembler logs FRAME COMPLETE.
8. FFmpeg starts channel transcoder.
9. Browser shows video.

---

## 12. Common Problems and Fixes

Problem: 0x9101 success but no packets
- Check firewall and cloud inbound rules.
- Confirm device media server IP and ports.
- Try TCP-only mode.

Problem: Packets arrive but blank video
- Force VIDEO_CODEC=h264.
- Verify ffmpeg is available.
- Check logs for decoder errors.

Problem: Device sends auth but start command fails
- Set REGISTER_ON_AUTH=1.
- Set proper PUBLIC_IP or VIDEO_SERVER_IP.

Problem: Stream appears and disappears
- Network instability.
- Prefer TCP and verify mobile uplink quality.

---

## 13. Learning Path for Freshers

Day 1:
- Read README sections 1 to 6
- Run app locally

Day 2:
- Read protocol-jt808/protocol-codec.js and protocol-jt808/tcp-gateway.js
- Follow one heartbeat packet end-to-end

Day 3:
- Read jt1078 parsers and reassembler
- Observe FRAME COMPLETE logs while streaming

Day 4:
- Read FFmpeg pipeline functions in server.js
- Understand codec detection, bootstrap, and pre-roll

---

## 14. Final Notes

This integration is now stable and practical for real JT808/JT1078 onboarding.
It is still a demo architecture (in-memory state, no auth, no persistence).
For enterprise use, add:
- authentication and authorization
- database and retention policy
- metrics and alerting
- TLS and reverse proxy
