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

/* ─── Audio players (Web Audio API over /ws/audio) ──────────────────────── */
const audioPlayers = {};   // "deviceId:channel" → { audioCtx, ws, muted, nextPlayTime }

const AUDIO_SAMPLE_RATE = 16000;  // must match server-side FFmpeg output rate

function initAudioPlayer(deviceId, channel) {
  const key = `${deviceId}:${channel}`;
  if (audioPlayers[key]) return;

  const wsProto = location.protocol === "https:" ? "wss" : "ws";
  const url = `${wsProto}://${location.host}/ws/audio?device=${encodeURIComponent(deviceId)}&channel=${channel}`;

  let audioCtx = null;
  let nextPlayTime = 0;
  let resetSchedule = true;

  const audioWs = new WebSocket(url);
  audioWs.binaryType = "arraybuffer";

  audioWs.onopen  = () => {
    _setAudioStatus(channel, "ready - click speaker button to hear");
    const btn = document.getElementById(`speakerBtn${channel}`);
    if (btn) btn.disabled = false;
  };
  audioWs.onclose = () => {
    _setAudioStatus(channel, "disconnected");
    const btn = document.getElementById(`speakerBtn${channel}`);
    if (btn) btn.disabled = true;
  };
  audioWs.onerror = () => _setAudioStatus(channel, "error");

  audioWs.onmessage = (ev) => {
    const player = audioPlayers[key];
    if (!player || player.muted || !ev.data?.byteLength) return;

    // Lazily create AudioContext on first unmuted message (needs prior user gesture)
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: AUDIO_SAMPLE_RATE });
        player.audioCtx = audioCtx;
      } catch (e) {
        console.warn("[audio] AudioContext create failed:", e);
        return;
      }
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
      return;
    }

    // Decode 16-bit signed LE PCM → Float32 and schedule playback
    const pcm = new Int16Array(ev.data);
    const floats = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) floats[i] = pcm[i] / 32768.0;

    const buf = audioCtx.createBuffer(1, floats.length, AUDIO_SAMPLE_RATE);
    buf.copyToChannel(floats, 0);

    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    // Reset scheduling edge when unmuting/reconnecting so old buffered timeline is dropped.
    if (resetSchedule) {
      nextPlayTime = now + 0.03;
      resetSchedule = false;
    }
    // Hard-clamp queue depth to keep audio near real-time.
    if (nextPlayTime - now > 0.35) nextPlayTime = now + 0.03;
    if (nextPlayTime < now + 0.02) nextPlayTime = now + 0.02;
    src.start(nextPlayTime);
    nextPlayTime += buf.duration;
  };

  audioPlayers[key] = { audioCtx, ws: audioWs, muted: true, nextPlayTime: 0 };
  _setAudioStatus(channel, "connecting…");

  // Expose a tiny control surface used by mute toggle.
  audioPlayers[key].markScheduleReset = () => {
    resetSchedule = true;
  };
}

function toggleAudioMute(deviceId, channel) {
  const key = `${deviceId}:${channel}`;
  const player = audioPlayers[key];
  if (!player) return;

  player.muted = !player.muted;
  const btn = document.getElementById(`speakerBtn${channel}`);
  if (btn) {
    btn.textContent = player.muted ? "🔇 Speaker" : "🔊 Speaker";
    btn.setAttribute("aria-pressed", player.muted ? "false" : "true");
  }

  if (!player.muted) {
    _setAudioStatus(channel, "playing");
    // Resume or create context in the user gesture handler for autoplay policy compliance.
    if (!player.audioCtx) {
      try {
        player.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: AUDIO_SAMPLE_RATE });
      } catch (e) {
        console.warn("[audio] AudioContext create failed:", e);
        _setAudioStatus(channel, "audio init failed");
        player.muted = true;
        if (btn) {
          btn.textContent = "🔇 Speaker";
          btn.setAttribute("aria-pressed", "false");
        }
        return;
      }
    }
    if (player.audioCtx?.state === "suspended") player.audioCtx.resume().catch(() => {});
    player.markScheduleReset?.();
  } else {
    _setAudioStatus(channel, "muted");
    player.markScheduleReset?.();
  }
}

function toggleVideoView(channel) {
  const shell = document.getElementById(`videoShell${channel}`);
  const btn = document.getElementById(`viewBtn${channel}`);
  if (!shell || !btn) return;

  const isFs = document.fullscreenElement === shell;
  const isMax = shell.classList.contains("maximized");

  if (isFs || isMax) {
    if (isFs) {
      document.exitFullscreen?.().catch(() => {});
    }
    shell.classList.remove("maximized");
    btn.textContent = "⤢ Maximize";
    return;
  }

  if (shell.requestFullscreen) {
    shell.requestFullscreen().then(() => {
      btn.textContent = "🗗 Minimize";
    }).catch(() => {
      shell.classList.add("maximized");
      btn.textContent = "🗗 Minimize";
    });
    return;
  }

  shell.classList.add("maximized");
  btn.textContent = "🗗 Minimize";
}

document.addEventListener("fullscreenchange", () => {
  [1, 2].forEach((ch) => {
    const shell = document.getElementById(`videoShell${ch}`);
    const btn = document.getElementById(`viewBtn${ch}`);
    if (!shell || !btn) return;
    const active = document.fullscreenElement === shell || shell.classList.contains("maximized");
    btn.textContent = active ? "🗗 Minimize" : "⤢ Maximize";
  });
});

function _setAudioStatus(channel, text) {
  const el = document.getElementById(`audioStatus${channel}`);
  if (el) el.textContent = text;
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

  // Clear any prior stream mode (e.g., stale audio-only session) before starting.
  fetch(`/api/video/${encodeURIComponent(deviceId)}/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channels: [1, 2] })
  }).catch(() => null).finally(() => fetch(`/api/video/${encodeURIComponent(deviceId)}/start`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    // Keep video start on the known-good profile for this device.
    body:    JSON.stringify({ channels: [1, 2], dataType: 1, streamType: 0 })
  })
    .then((r) => r.json())
    .then((d) => {
      console.log("[video] start result", d);
      const ok = d.results?.some((r) => r.result === 0 || r.status === "success");
      document.getElementById("videoStatus").textContent = ok
        ? "✅ 0x9101 accepted — connecting players…"
        : "⚠ 0x9101 failed — see console";
      [1, 2].forEach((ch) => {
        initVideoPlayer(deviceId, ch);
        initAudioPlayer(deviceId, ch);
      });
    })
    .catch((err) => {
      console.error("[video] start error", err);
      document.getElementById("videoStatus").textContent = "❌ API error — see console";
    }));
});

/* ─── In-video control wiring ────────────────────────────────────────────── */
[1, 2].forEach((ch) => {
  document.getElementById(`speakerBtn${ch}`)?.addEventListener("click", () => {
    const deviceId = currentVideoDeviceId
                  || document.getElementById("gDevice")?.textContent?.trim();
    if (!deviceId || deviceId === "-") return;
    toggleAudioMute(deviceId, ch);
  });

  document.getElementById(`viewBtn${ch}`)?.addEventListener("click", () => {
    toggleVideoView(ch);
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

/* ─── AI Plant Health Analysis ──────────────────────────────────────────── */

let selectedAnalysisChannel = 1;  // Track which video channel to capture from
let liveAnalysisRunning = false;  // Live analysis state
let liveAnalysisInterval = null;  // Interval ID
let analysisInFlight = false;     // Prevent concurrent requests

/**
 * Capture a frame from the selected video element and convert to base64 JPEG
 */
function captureVideoFrameAsBase64Jpeg(channel = 1) {
  const videoEl = document.getElementById(`videoEl${channel}`);
  if (!videoEl) {
    console.warn(`Video element not found for channel ${channel}`);
    return null;
  }

  // Create a canvas matching the video dimensions
  const canvas = document.createElement('canvas');
  canvas.width = videoEl.videoWidth || 1280;
  canvas.height = videoEl.videoHeight || 720;

  if (canvas.width === 0 || canvas.height === 0) {
    console.warn(`Invalid video dimensions: ${canvas.width}x${canvas.height}`);
    return null;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Failed to get canvas context');
    return null;
  }

  // Draw the current video frame onto the canvas
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  // Convert to base64 JPEG (quality 0.92 for balance between size and quality)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  
  // Extract base64 part (remove "data:image/jpeg;base64," prefix)
  const base64Image = dataUrl.split(',')[1];
  
  return base64Image;
}

/**
 * Display AI analysis results in the UI
 */
function displayAnalysisResult(analysis) {
  const resultDiv = document.getElementById('aiAnalysisResult');
  const noDataDiv = document.getElementById('aiNoData');

  if (!resultDiv) return;

  // Determine health badge color based on rating
  function getHealthBadgeClass(rating) {
    if (rating >= 70) return 'on';      // green - good
    if (rating >= 50) return 'fix';     // blue - fair
    if (rating >= 30) return 'nofix';   // orange - poor
    return 'error';                      // red - critical
  }

  // Update plant information
  document.getElementById('aiPlantName').textContent = analysis.plantName || '-';
  document.getElementById('aiScientificName').textContent = analysis.scientificName || '-';
  document.getElementById('aiSoilCondition').textContent = analysis.soilCondition || '-';

  // Update health status and rating
  const healthStatus = analysis.healthStatus || 'Unknown';
  const healthRating = Math.max(0, Math.min(100, analysis.plantHealthRating || 0));
  
  const badge = document.getElementById('aiHealthBadge');
  badge.textContent = healthStatus;
  badge.className = `badge ${getHealthBadgeClass(healthRating)}`;

  // Update health bar
  const healthBar = document.getElementById('aiHealthBar');
  healthBar.style.width = healthRating + '%';
  document.getElementById('aiHealthRating').textContent = healthRating + '%';

  // Update detailed analysis
  const analysis_text = analysis.detailedAnalysis || 'No analysis available';
  document.getElementById('aiDetailedAnalysis').textContent = analysis_text;

  // Update care advice
  const careAdviceList = document.getElementById('aiCareAdvice');
  careAdviceList.innerHTML = '';
  
  if (Array.isArray(analysis.careAdvice) && analysis.careAdvice.length > 0) {
    analysis.careAdvice.forEach(advice => {
      if (advice && String(advice).trim()) {
        const li = document.createElement('li');
        li.style.margin = '8px 0';
        li.style.color = '#555';
        li.textContent = String(advice).trim();
        careAdviceList.appendChild(li);
      }
    });
  } else {
    const li = document.createElement('li');
    li.style.color = '#aaa';
    li.style.margin = '8px 0';
    li.textContent = 'No care advice available';
    careAdviceList.appendChild(li);
  }

  // Update timestamp
  const now = new Date();
  document.getElementById('aiTimestamp').textContent = now.toISOString();

  // Show result, hide no-data message
  noDataDiv.style.display = 'none';
  resultDiv.style.display = '';
}

/**
 * Send frame to API for analysis (core function used by both manual and live)
 */
async function analyzeFrameAPI(base64Image, isLive = false) {
  try {
    const response = await fetch('/api/analyze-plant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error('[AI] API error:', data);
      return null;
    }

    return data.analysis;
  } catch (err) {
    console.error('[AI] Error during analysis:', err);
    return null;
  }
}

/**
 * Manual single-frame analysis
 */
async function analyzeCurrentFrame() {
  const btn = document.getElementById('analyzePlantBtn');
  const status = document.getElementById('analyzeStatus');

  if (!btn || !status) return;

  try {
    // Disable button and show loading status
    btn.disabled = true;
    status.textContent = 'Capturing frame...';

    // Capture frame from the selected video channel
    const base64Image = captureVideoFrameAsBase64Jpeg(selectedAnalysisChannel);

    if (!base64Image) {
      status.textContent = '⚠ Failed to capture frame from video';
      btn.disabled = false;
      return;
    }

    status.textContent = 'Sending to AI for analysis...';

    const analysis = await analyzeFrameAPI(base64Image, false);

    if (!analysis) {
      status.textContent = '⚠ Analysis failed';
      btn.disabled = false;
      return;
    }

    // Display the analysis result
    displayAnalysisResult(analysis);
    status.textContent = '✅ Analysis complete';

    // Re-enable button after a short delay
    setTimeout(() => {
      btn.disabled = false;
      status.textContent = '';
    }, 2000);

  } catch (err) {
    console.error('[AI] Error during analysis:', err);
    status.textContent = `❌ Error: ${err.message}`;
    btn.disabled = false;
  }
}

/**
 * Live analysis loop - captures and analyzes continuously
 */
async function liveAnalysisLoop() {
  // Skip if already processing or if live mode is off
  if (analysisInFlight || !liveAnalysisRunning) {
    return;
  }

  analysisInFlight = true;

  try {
    // Capture frame from the selected video channel
    const base64Image = captureVideoFrameAsBase64Jpeg(selectedAnalysisChannel);

    if (!base64Image) {
      console.warn('[AI Live] Failed to capture frame');
      analysisInFlight = false;
      return;
    }

    // Send to API
    const analysis = await analyzeFrameAPI(base64Image, true);

    if (analysis && document.getElementById('autoUpdateUI')?.checked) {
      displayAnalysisResult(analysis);
    }

  } catch (err) {
    console.error('[AI Live] Error in analysis loop:', err);
  } finally {
    analysisInFlight = false;
  }
}

/**
 * Start live continuous analysis
 */
function startLiveAnalysis() {
  if (liveAnalysisRunning) return;

  const btn = document.getElementById('liveAnalysisToggle');
  const interval = parseInt(document.getElementById('analysisInterval')?.value || 3000);

  liveAnalysisRunning = true;
  
  // Update button UI
  btn.textContent = '🟢 Live Analysis ON';
  btn.style.opacity = '1';
  btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
  btn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';

  // Show settings
  const settings = document.getElementById('liveAnalysisSettings');
  if (settings) settings.style.display = '';

  // Update status
  const status = document.getElementById('analyzeStatus');
  if (status) status.textContent = `🔴 Live (${interval / 1000}s interval)`;

  // Start interval-based capture
  liveAnalysisInterval = setInterval(() => {
    liveAnalysisLoop();
  }, interval);

  console.log('[AI] Live analysis started with', interval, 'ms interval');
}

/**
 * Stop live continuous analysis
 */
function stopLiveAnalysis() {
  if (!liveAnalysisRunning) return;

  liveAnalysisRunning = false;
  
  if (liveAnalysisInterval) {
    clearInterval(liveAnalysisInterval);
    liveAnalysisInterval = null;
  }

  const btn = document.getElementById('liveAnalysisToggle');
  btn.textContent = '🔴 Live Analysis OFF';
  btn.style.opacity = '0.6';
  btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  btn.style.boxShadow = '';

  // Hide settings
  const settings = document.getElementById('liveAnalysisSettings');
  if (settings) settings.style.display = 'none';

  const status = document.getElementById('analyzeStatus');
  if (status) status.textContent = '';

  console.log('[AI] Live analysis stopped');
}

/**
 * Toggle live analysis on/off
 */
function toggleLiveAnalysis() {
  if (liveAnalysisRunning) {
    stopLiveAnalysis();
  } else {
    startLiveAnalysis();
  }
}

/**
 * Handle interval change during live analysis
 */
function handleIntervalChange() {
  if (!liveAnalysisRunning) return;

  // Restart with new interval
  stopLiveAnalysis();
  startLiveAnalysis();
}

/**
 * Handle channel selector changes
 */
function setupChannelSelector() {
  [1, 2].forEach(ch => {
    const radioId = `ch${ch}Radio`;
    const radio = document.querySelector(`input[name="analysisChannel"][value="${ch}"]`);
    
    if (radio) {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedAnalysisChannel = ch;
        }
      });
    }
  });
}

/**
 * Initialize AI analysis UI
 */
function initializeAIAnalysis() {
  const btn = document.getElementById('analyzePlantBtn');
  if (btn) {
    btn.addEventListener('click', analyzeCurrentFrame);
  }

  const liveBtn = document.getElementById('liveAnalysisToggle');
  if (liveBtn) {
    liveBtn.addEventListener('click', toggleLiveAnalysis);
  }

  const intervalSelect = document.getElementById('analysisInterval');
  if (intervalSelect) {
    intervalSelect.addEventListener('change', handleIntervalChange);
  }

  // Setup channel selection
  setupChannelSelector();

  console.log('[AI] Plant health analysis initialized');
}

// Initialize AI analysis when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAIAnalysis);
} else {
  initializeAIAnalysis();
}

// Enable analyze button when video is playing
setInterval(() => {
  const btn = document.getElementById('analyzePlantBtn');
  const liveBtn = document.getElementById('liveAnalysisToggle');
  if (btn || liveBtn) {
    const videoEl = document.getElementById(`videoEl${selectedAnalysisChannel}`);
    const hasVideo = videoEl && videoEl.readyState >= 2;  // HAVE_CURRENT_DATA or better
    if (btn) btn.disabled = !hasVideo;
    if (liveBtn) liveBtn.disabled = !hasVideo;
  }
}, 1000);
