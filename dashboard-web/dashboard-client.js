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
  if (!pre) return;
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

/* ─── Map setup ─────────────────────────────────────────────────────── */
let map = null;
let deviceMarker = null;
const GPS_INIT_LAT = 37.7749;
const GPS_INIT_LNG = -122.4194;
const GPS_INIT_ZOOM = 13;

function initMap() {
  if (map) return;
  try {
    map = L.map('mapContainer').setView([GPS_INIT_LAT, GPS_INIT_LNG], GPS_INIT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
      className: 'map-tile'
    }).addTo(map);
  } catch (e) {
    console.error("Map init error:", e);
  }
}

function updateMapMarker(lat, lng, speed, heading) {
  if (!map) {
    initMap();
    // After initializing the map, ensure it renders properly by invalidating size
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 100);
  }
  
  if (deviceMarker) {
    map.removeLayer(deviceMarker);
  }
  
  const iconHtml = `
    <div style="
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 20px;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      border: 3px solid white;
      transform: rotate(${heading || 0}deg);
    ">📍</div>
  `;
  
  const customIcon = L.divIcon({
    html: iconHtml,
    iconSize: [40, 40],
    className: 'custom-marker'
  });
  
  deviceMarker = L.marker([lat, lng], { icon: customIcon })
    .bindPopup(`
      <div style="font-weight: 600; margin-bottom: 6px;">Device Location</div>
      <div style="font-size: 0.9rem;">
        <div>Lat: ${lat.toFixed(6)}</div>
        <div>Lng: ${lng.toFixed(6)}</div>
        <div>Speed: ${speed || 0} km/h</div>
        <div>Heading: ${heading || 0}°</div>
      </div>
    `)
    .addTo(map);
  
  map.setView([lat, lng], GPS_INIT_ZOOM);
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

  const player = flvjs.createPlayer(
    { type: "flv", isLive: true, url },
    {
      enableWorker: false,
      lazyLoad: false,
      enableStashBuffer: false,
      stashInitialSize: 128,
      autoCleanupSourceBuffer: true,
      autoCleanupMaxBackwardDuration: 3,
      autoCleanupMinBackwardDuration: 1,
      fixAudioTimestampGap: false,
      liveBufferLatencyChasing: true,
      liveBufferLatencyMaxLatency: 1.5,
      liveBufferLatencyMinRemain: 0.4
    }
  );
  player.attachMediaElement(el);
  player.load();

  player.on(flvjs.Events.ERROR, (errType, errDetail) => {
    console.error("[video] flv.js error:", errType, errDetail, { deviceId, channel });
    document.getElementById("videoStatus").textContent = `⚠ Player Error (${errType}) - see console`;
  });

  player.play().catch(() => {});

  // Keep playback near the live edge without triggering the loading spinner.
  // Use playbackRate to gently catch up for small lag; hard-seek only for severe lag
  // (leaving a 400 ms safety margin so the buffer is never instantly exhausted).
  const lowLatencyTick = setInterval(() => {
    if (!el || !el.buffered || el.buffered.length === 0) return;
    const end = el.buffered.end(el.buffered.length - 1);
    const lag = end - el.currentTime;
    if (lag > 3.0) {
      // Severe lag — hard seek, but keep 400 ms of safety buffer
      try { el.currentTime = Math.max(0, end - 0.4); } catch {}
      el.playbackRate = 1.0;
    } else if (lag > 0.8) {
      // Moderate lag — speed up slightly to catch up without a seek stall
      el.playbackRate = 1.15;
    } else if (lag > 0.4) {
      el.playbackRate = 1.07;
    } else {
      el.playbackRate = 1.0;
    }
  }, 200);

  player.on(flvjs.Events.DESTROYING, () => clearInterval(lowLatencyTick));
  videoPlayers[key] = player;

  console.log("[video] player started", { deviceId, channel, url });
}

function destroyVideoPlayer(deviceId, channel) {
  const key = `${deviceId}:${channel}`;
  const p = videoPlayers[key];
  if (!p) return;
  try { p.destroy(); } catch { /* ignore */ }
  delete videoPlayers[key];
}

/* ─── Start Video button ────────────────────────────────────────────────── */
let currentVideoDeviceId = null;

// Note: Map is initialized when first GPS data arrives, not on page load,
// because the container is initially hidden (display:none).

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

    // Show GPS data panel
    document.getElementById("nodata").style.display  = "none";
    document.getElementById("gpsData").style.display = "";
    
    // Initialize map on first GPS data (when container is now visible)
    if (!map) {
      setTimeout(() => {
        initMap();
        if (map) map.invalidateSize();
      }, 50);
    }

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

    // Update map with real-time location
    if (d.lat != null && d.lng != null) {
      updateMapMarker(d.lat, d.lng, d.speedKmh || 0, d.heading || 0);
    }

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
