/* ─── WebSocket setup ────────────────────────────────────────────────────── */
const proto  = location.protocol === "https:" ? "wss://" : "ws://";
const ws     = new WebSocket(proto + location.host);

const wsDot    = document.getElementById("wsDot");
const wsStatus = document.getElementById("wsStatus");

ws.onopen = () => {
  wsDot.className    = "dot connected";
  wsStatus.textContent = "Connected to server";
};
ws.onclose = () => {
  wsDot.className    = "dot error";
  wsStatus.textContent = "Disconnected — reload to reconnect";
};
ws.onerror = () => {
  wsDot.className    = "dot error";
  wsStatus.textContent = "WebSocket error";
};

/* ─── DOM helpers ───────────────────────────────────────────────────────── */
const gpsLog   = document.getElementById("gpsLog");
const videoLog = document.getElementById("videoLog");

function prependLine(pre, line) {
  const lines = pre.textContent === "—" ? [] : pre.textContent.split("\n");
  lines.unshift(line);
  pre.textContent = lines.slice(0, 20).join("\n");
}

function fmtTs(msOrIso) {
  if (!msOrIso) return "-";
  const d = typeof msOrIso === "number" ? new Date(msOrIso) : new Date(msOrIso);
  if (Number.isNaN(d.getTime())) return String(msOrIso);
  return d.toISOString();
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setVideoStats(channel, stats) {
  const ch = Number(channel);
  if (ch !== 1 && ch !== 2) return;

  const prefix = ch === 1 ? "ch1" : "ch2";
  setText(`${prefix}Bytes`,   stats.bytes   != null ? String(stats.bytes)   : "-");
  setText(`${prefix}Packets`, stats.packets != null ? String(stats.packets) : "-");
  setText(`${prefix}Last`,    stats.lastTs  ? fmtTs(stats.lastTs)           : "-");
}

/* ─── Video player ──────────────────────────────────────────────────────── */
const videoPlayers = {};   // "deviceId:channel" → flvjs.Player

function initVideoPlayer(deviceId, channel) {
  if (typeof flvjs === "undefined" || !flvjs.isSupported()) {
    console.warn("flv.js not supported in this browser");
    return;
  }

  const key = `${deviceId}:${channel}`;
  if (videoPlayers[key]) return;               // already running

  const elId = `videoEl${channel}`;
  const el   = document.getElementById(elId);
  if (!el) return;

  const wsProto = location.protocol === "https:" ? "wss" : "ws";
  const url     = `${wsProto}://${location.host}/ws/video?device=${encodeURIComponent(deviceId)}&channel=${channel}`;

  const player = new JMuxer({
    node: el,
    mode: 'video',
    flv: false,
    debug: false,
    codec: 'avc',
    onError: function(data) {
      console.error("[video] jMuxer error:", data, { deviceId, channel });
      document.getElementById("videoStatus").textContent = `⚠ Player Error - see console`;
    }
  });
  
  videoPlayers[key] = player;

  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";
  ws.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      const data = new Uint8Array(event.data);
      player.feed({ video: data });
    }
  };
  
  // Store the ws so we can close it if needed
  player.ws = ws;

  console.log("[video] player started", { deviceId, channel, url });
}

function destroyVideoPlayer(deviceId, channel) {
  const key = `${deviceId}:${channel}`;
  const p = videoPlayers[key];
  if (!p) return;
  try { p.destroy(); } catch { /* ignore */ }
  if (p.ws) {
    try { p.ws.close(); } catch { /* ignore */ }
  }
  delete videoPlayers[key];
}

/* ─── Start Video button ────────────────────────────────────────────────── */
let currentVideoDeviceId = null;

document.getElementById("startVideoBtn")?.addEventListener("click", () => {
  const deviceId = currentVideoDeviceId
                || document.getElementById("gDevice")?.textContent?.trim();
  if (!deviceId || deviceId === "-" || deviceId === "") {
    document.getElementById("videoStatus").textContent = "⚠ No device connected yet";
    return;
  }

  document.getElementById("videoStatus").textContent = "Sending 0x9101…";

  fetch(`/api/video/${encodeURIComponent(deviceId)}/start`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ channels: [1, 2], dataType: 1, streamType: 0 })
  })
    .then((r) => r.json())
    .then((d) => {
      console.log("[video] start result", d);
      const ok = d.results?.some((r) => r.result === 0 || r.status === "success");
      document.getElementById("videoStatus").textContent = ok
        ? "✅ 0x9101 accepted — connecting players…"
        : "⚠ 0x9101 failed — see console";
      [1, 2].forEach((ch) => initVideoPlayer(deviceId, ch));
    })
    .catch((err) => {
      console.error("[video] start error", err);
      document.getElementById("videoStatus").textContent = "❌ API error — see console";
    });
});

/* ─── Message handler ────────────────────────────────────────────────────── */
ws.onmessage = (ev) => {
  let msg;
  try { msg = JSON.parse(ev.data); } catch { return; }

  if (msg.type === "gps") {
    const d = msg.data;

    document.getElementById("nodata").style.display  = "none";
    document.getElementById("gpsData").style.display = "";

    document.getElementById("gDevice").textContent  = msg.deviceId;
    document.getElementById("gTime").textContent    = d.ts ?? "-";
    document.getElementById("gLat").textContent     = d.lat  != null ? d.lat.toFixed(6)  + "°" : "-";
    document.getElementById("gLng").textContent     = d.lng  != null ? d.lng.toFixed(6)  + "°" : "-";
    document.getElementById("gSpeed").textContent   = d.speedKmh != null ? d.speedKmh.toFixed(1) + " km/h" : "-";
    document.getElementById("gHeading").textContent = d.heading != null ? d.heading + "°" : "-";
    document.getElementById("gAlt").textContent     = d.altitude != null ? d.altitude + " m" : "-";

    const accEl = document.getElementById("gACC");
    accEl.textContent = d.accOn ? "ON" : "OFF";
    accEl.className   = "badge " + (d.accOn ? "on" : "off");

    const fixEl = document.getElementById("gFix");
    fixEl.textContent = d.gpsFix ? "FIX" : "NO FIX";
    fixEl.className   = "badge " + (d.gpsFix ? "fix" : "nofix");

    prependLine(
      gpsLog,
      `[${d.ts ?? "?"}]  ${d.lat?.toFixed(6)},${d.lng?.toFixed(6)}  ` +
      `${d.speedKmh?.toFixed(1)}km/h  acc=${d.accOn ? "on" : "off"}`
    );

    // Track most-recently-seen GPS device for the Start Video button
    if (msg.deviceId && msg.deviceId !== "-") currentVideoDeviceId = msg.deviceId;
  }

  if (msg.type === "video") {
    const v = msg.data;
    document.getElementById("vDevice").textContent  = msg.deviceId;
    document.getElementById("vChannel").textContent = v.channel;
    document.getElementById("vType").textContent    = v.payloadType;
    document.getElementById("vSize").textContent    = v.size + " bytes";

    prependLine(
      videoLog,
      `dev=${msg.deviceId}  ch=${v.channel}  type=${v.payloadType}  size=${v.size}B`
    );
  }

  if (msg.type === "video_stats") {
    setVideoStats(msg.data?.channel, msg.data);
  }
};
