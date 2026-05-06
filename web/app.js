/* ─── WebSocket setup (dashboard / stats) ────────────────────────────────── */
const proto  = location.protocol === "https:" ? "wss://" : "ws://";
const ws     = new WebSocket(proto + location.host);

const wsDot    = document.getElementById("wsDot");
const wsStatus = document.getElementById("wsStatus");

ws.onopen = () => {
  wsDot.className     = "dot connected";
  wsStatus.textContent = "Connected to server";
};
ws.onclose = () => {
  wsDot.className     = "dot error";
  wsStatus.textContent = "Disconnected — reload to reconnect";
};
ws.onerror = () => {
  wsDot.className     = "dot error";
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

/* ─── Dashboard WebSocket message handler ───────────────────────────────── */
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

    // Auto-populate device ID in video controls if not yet filled
    const vidDeviceInput = document.getElementById("vidDevice");
    if (!vidDeviceInput.value) {
      vidDeviceInput.value = msg.deviceId;
      setVidStatus("idle", "Device auto-detected — press Start Stream");
    }
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

  if (msg.type === "stream_status") {
    const { channel, codec, active } = msg.data ?? {};
    const vidChannel = Number(document.getElementById("vidChannel").value);
    const vidDevice  = document.getElementById("vidDevice").value.trim();

    // Only update player status if this event is for the stream we're watching
    if (msg.deviceId === vidDevice && Number(channel) === vidChannel) {
      if (codec === "h265") {
        showH265Warning();
      } else if (codec === "h264") {
        setVidCodecBadge("h264");
      }
      if (active) {
        setVidStatus("connected", "Streaming…");
      }
    }
  }
};

/* ─── Video player (flv.js) ─────────────────────────────────────────────── */
let flvPlayer    = null;
let playerActive = false;

const vidStartBtn  = document.getElementById("vidStartBtn");
const vidStopBtn   = document.getElementById("vidStopBtn");
const vidNoStream  = document.getElementById("vidNoStream");
const vidH265Warn  = document.getElementById("vidH265Warning");
const videoEl      = document.getElementById("videoPlayer");

vidStartBtn.addEventListener("click", () => {
  const deviceId = document.getElementById("vidDevice").value.trim();
  const channel  = Number(document.getElementById("vidChannel").value);

  if (!deviceId) {
    alert("Please enter a Device ID (or wait for a GPS update to auto-detect).");
    return;
  }

  startVideoStream(deviceId, channel);
});

vidStopBtn.addEventListener("click", () => {
  stopVideoStream();
  setVidStatus("idle", "Stopped");
  vidNoStream.style.display = "block";
});

function startVideoStream(deviceId, channel) {
  stopVideoStream(); // clean up previous session

  vidH265Warn.style.display = "none";
  vidNoStream.style.display = "none";
  setVidStatus("connecting", "Connecting…");
  setVidCodecBadge(null);

  if (typeof flvjs === "undefined" || !flvjs.isSupported()) {
    setVidStatus("error", "flv.js not supported in this browser");
    vidNoStream.style.display = "block";
    return;
  }

  const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${wsProto}//${location.host}/ws/video?device=${encodeURIComponent(deviceId)}&channel=${channel}`;

  const player = flvjs.createPlayer(
    { type: "flv", isLive: true, url, hasAudio: false, hasVideo: true },
    { enableWorker: false, enableStashBuffer: false, stashInitialSize: 128, lazyLoad: false }
  );

  player.attachMediaElement(videoEl);
  player.load();
  player.play().catch(() => {
    // Autoplay blocked by browser – user must click play manually
    setVidStatus("connecting", "Waiting for stream (click ▶ to play)…");
  });

  player.on(flvjs.Events.ERROR, (errType, errDetail, errInfo) => {
    console.warn("[flvjs] error", errType, errDetail, errInfo);
    if (errType === "MediaError") {
      setVidStatus("error", `Media error: ${errDetail}`);
    } else if (errType === "NetworkError") {
      setVidStatus("error", "Stream disconnected");
    } else {
      setVidStatus("error", `Error: ${errType} – ${errDetail}`);
    }
  });

  player.on(flvjs.Events.MEDIA_INFO, (info) => {
    setVidStatus("connected", "Playing live stream");
    if (info?.codec) {
      setVidCodecBadge(info.codec.toLowerCase().includes("265") ? "h265" : "h264");
    }
  });

  flvPlayer = player;
  playerActive = true;

  vidStartBtn.style.display = "none";
  vidStopBtn.style.display  = "";

  // Trigger server to send 0x9101 to the device
  fetch(`/api/video/${encodeURIComponent(deviceId)}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channels: [channel], dataType: 1, streamType: 0 })
  })
    .then((r) => r.json())
    .then((d) => {
      if (d.ok) {
        const ok = d.results?.find((r) => r.status === "success");
        if (ok) {
          setVidStatus("connected", `Stream started (${ok.variant})`);
        } else {
          setVidStatus("connecting", "0x9101 sent, waiting for stream…");
        }
      }
    })
    .catch(() => {
      // Non-fatal: device might already be streaming
    });
}

function stopVideoStream() {
  if (flvPlayer) {
    try { flvPlayer.destroy(); } catch { /* */ }
    flvPlayer = null;
  }
  playerActive = false;
  vidStartBtn.style.display = "";
  vidStopBtn.style.display  = "none";
}

/* ─── Video status helpers ───────────────────────────────────────────────── */
function setVidStatus(state, text) {
  const dot  = document.getElementById("vidDot");
  const span = document.getElementById("vidStatusText");
  const dotModifiers = { connected: " connected", error: " error", connecting: " warn" };
  dot.className = "dot" + (dotModifiers[state] || "");
  span.textContent = text;
}

function setVidCodecBadge(codec) {
  const badge = document.getElementById("vidCodecBadge");
  if (!codec) { badge.style.display = "none"; return; }
  badge.textContent = codec.toUpperCase();
  const codecClasses = { h264: "h264", h265: "h265" };
  badge.className = "badge " + (codecClasses[codec] || "unknown");
  badge.style.display = "";
}

function showH265Warning() {
  vidH265Warn.style.display = "block";
  setVidStatus("error", "H.265 codec — browser playback unavailable");
  setVidCodecBadge("h265");
  stopVideoStream();
  vidStartBtn.style.display = "";
  vidStopBtn.style.display  = "none";
}
