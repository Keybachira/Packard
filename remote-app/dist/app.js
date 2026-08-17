// SoundCore Remote — vanilla JS PWA client.
// Talks to the desktop app's local WebSocket (`/ws?t=<token>`) using the
// protocol defined in src-tauri/src/remote/protocol.rs. No build step: this
// file is served as-is by the axum static handler in remote/server.rs.
(function () {
  "use strict";

  const token = new URLSearchParams(location.search).get("t") || "";

  const els = {
    main: document.getElementById("main"),
    connDot: document.getElementById("connDot"),
    deviceName: document.getElementById("deviceName"),
    statusView: document.getElementById("statusView"),
    statusSpinner: document.getElementById("statusSpinner"),
    statusTitle: document.getElementById("statusTitle"),
    statusSub: document.getElementById("statusSub"),
    playerView: document.getElementById("playerView"),
    art: document.querySelector(".art"),
    artWrap: document.querySelector(".art-wrap"),
    trackTitle: document.getElementById("trackTitle"),
    trackArtist: document.getElementById("trackArtist"),
    posTime: document.getElementById("posTime"),
    durTime: document.getElementById("durTime"),
    progressFill: document.getElementById("progressFill"),
    progressTrack: document.getElementById("progressTrack"),
    btnPrev: document.getElementById("btnPrev"),
    btnPlay: document.getElementById("btnPlay"),
    btnNext: document.getElementById("btnNext"),
    iconPlay: document.getElementById("iconPlay"),
    iconPause: document.getElementById("iconPause"),
    btnMute: document.getElementById("btnMute"),
    iconVol: document.getElementById("iconVol"),
    iconVolMuted: document.getElementById("iconVolMuted"),
    volumeSlider: document.getElementById("volumeSlider"),
    volNum: document.getElementById("volNum"),
    toast: document.getElementById("toast"),
    footNote: document.getElementById("footNote"),
    tabs: document.getElementById("tabs"),
    eqView: document.getElementById("eqView"),
    eqBands: document.getElementById("eqBands"),
    eqUnsupported: document.getElementById("eqUnsupported"),
    presetChips: document.getElementById("presetChips"),
    devicesView: document.getElementById("devicesView"),
    deviceList: document.getElementById("deviceList"),
    analyzerView: document.getElementById("analyzerView"),
    analyzerCanvas: document.getElementById("analyzerCanvas"),
    analyzerIdle: document.getElementById("analyzerIdle"),
  };

  let ws = null;
  let everConnected = false;
  let localTicker = null;
  let toastTimer = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let wakeLock = null;

  let state = {
    playing: false,
    positionSecs: 0,
    durationSecs: 0,
    volume: 50,
    muted: false,
    // V2 — equalizer / devices / analyzer
    currentTab: "player",
    eqGains: new Array(EQ_BAND_COUNT).fill(0),
    eqPreset: "FLAT",
    eqCustom: false,
    supportsEq: false,
    devices: [],
  };

  // The 10 peaking-band labels, left→right, matching
  // src-tauri/src/audio/equalizer.rs BAND_FREQUENCIES.
  const EQ_BAND_COUNT = 10;
  const EQ_LABELS = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
  // Local mirror of the backend preset curves so the sliders react instantly;
  // the authoritative snapshot is applied right after.
  const PRESET_CURVES = {
    FLAT: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    CINEMA: [3, 4, 3, 1, -1, -1, 1, 2, 3, 3],
    MUSIC: [0, 1, 2, 3, 2, 0, -1, 0, 1, 2],
    GAME: [-2, 0, 2, 4, 5, 4, 3, 2, 1, 0],
  };

  // A pending local volume drag, so incoming snapshots don't fight the finger
  // mid-gesture.
  let draggingVolume = false;

  function fmtTime(total) {
    const s = Math.max(0, Math.floor(total || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 2600);
  }

  function setStatus(title, sub, variant) {
    hideAllViews();
    els.tabs.classList.add("hidden");
    els.statusView.classList.remove("hidden");
    els.statusTitle.textContent = title;
    els.statusSub.textContent = sub || "";
    els.statusSpinner.classList.toggle("done", variant === "done");
    els.connDot.classList.remove("live", "error");
    if (variant === "error") els.connDot.classList.add("error");
  }

  function hideAllViews() {
    els.statusView.classList.add("hidden");
    els.playerView.classList.add("hidden");
    els.eqView.classList.add("hidden");
    els.devicesView.classList.add("hidden");
    els.analyzerView.classList.add("hidden");
    stopAnalyzer();
  }

  // Connected: show the tab bar and the last-viewed tab.
  function showConnected() {
    els.statusView.classList.add("hidden");
    els.tabs.classList.remove("hidden");
    els.connDot.classList.add("live");
    els.connDot.classList.remove("error");
    requestWakeLock();
    showView(state.currentTab, { silent: true });
  }

  // Show one of the four views and sync the tab bar. `silent` skips the
  // haptic/analyser restart used for genuine user navigation.
  function showView(tab) {
    state.currentTab = tab;
    hideAllViews();
    els.main.classList.toggle("viewing-panel", tab !== "player");

    if (tab === "player") {
      els.playerView.classList.remove("hidden");
      renderPlayback();
    } else if (tab === "eq") {
      els.eqView.classList.remove("hidden");
    } else if (tab === "devices") {
      els.devicesView.classList.remove("hidden");
    } else if (tab === "analyzer") {
      els.analyzerView.classList.remove("hidden");
      startAnalyzer();
    }

    for (const btn of els.tabs.querySelectorAll(".tab")) {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    }
  }

  function renderPlayback() {
    els.trackTitle.textContent = state.title || "Nada tocando";
    els.trackArtist.textContent = state.artist || "—";
    els.art.classList.toggle("playing", !!state.playing);
    els.iconPlay.classList.toggle("hidden", !!state.playing);
    els.iconPause.classList.toggle("hidden", !state.playing);

    const dur = state.durationSecs || 0;
    const pos = Math.min(state.positionSecs || 0, dur || Infinity);
    els.posTime.textContent = fmtTime(pos);
    els.durTime.textContent = fmtTime(dur);
    const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;
    els.progressFill.style.width = `${pct}%`;
  }

  function renderVolume() {
    if (!draggingVolume) {
      els.volumeSlider.value = String(Math.round(state.muted ? 0 : state.volume));
    }
    els.volNum.textContent = state.muted ? "0" : String(Math.round(state.volume));
    els.btnMute.classList.toggle("muted", !!state.muted);
    els.iconVol.classList.toggle("hidden", !!state.muted);
    els.iconVolMuted.classList.toggle("hidden", !state.muted);
    paintVolumeTrack(els.volumeSlider.value);
  }

  // Paints the filled portion of the volume slider's track (Safari/Chrome
  // don't support ::-webkit-slider-runnable-track fill from CSS alone).
  function paintVolumeTrack(value) {
    const pct = Math.max(0, Math.min(100, Number(value)));
    els.volumeSlider.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--panel-2) ${pct}%, var(--panel-2) 100%)`;
  }

  // Short tap buzz on real devices — no-op (and silent) everywhere else.
  function haptic() {
    try {
      navigator.vibrate && navigator.vibrate(8);
    } catch { }
  }

  // Keep the phone's screen from dimming while the remote is the active tab.
  // The browser releases the lock automatically on hide; re-acquired in the
  // visibilitychange handler below.
  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        wakeLock = await navigator.wakeLock.request("screen");
      }
    } catch {
      // Unsupported, denied, or battery saver — the remote still works, the
      // screen just might sleep on its own.
    }
  }

  function applySnapshot(snap) {
    if (snap.device) {
      els.deviceName.textContent = snap.device.name;
    }
    state.volume = snap.volume;
    state.muted = snap.muted;
    applyPlayback(snap.playback);
    renderVolume();

    if (snap.eq) {
      state.supportsEq = !!snap.eq.supportsEq;
      state.eqPreset = snap.eq.preset || "FLAT";
      const gains = snap.eq.gains || [];
      for (let i = 0; i < EQ_BAND_COUNT; i++) {
        state.eqGains[i] = gains[i] == null ? 0 : gains[i];
      }
      // A snapshot whose gains don't match the reported preset means the
      // curve was hand-tuned (backend keeps the last preset name around).
      const curve = PRESET_CURVES[state.eqPreset];
      state.eqCustom = !(
        curve &&
        curve.every((g, i) => Math.abs(g - state.eqGains[i]) < 0.01)
      );
      renderEq();
    }
    if (snap.devices) {
      state.devices = snap.devices;
      renderDevices();
    }
  }

  function applyPlayback(p) {
    state.playing = p.playing;
    state.title = p.title;
    state.artist = p.artist;
    state.durationSecs = p.durationSecs;
    state.positionSecs = p.positionSecs;
    renderPlayback();
  }

  // --- Equalizer ------------------------------------------------------------

  // Paints the filled portion of a vertical EQ fader. Value maps -12..+12 dB
  // onto 0..100% bottom→top (min sits at the bottom of the slider).
  function paintEqTrack(slider, value) {
    const pct = Math.max(0, Math.min(100, ((Number(value) + 12) / 24) * 100));
    slider.style.background = `linear-gradient(to top, var(--accent) 0%, var(--accent) ${pct}%, var(--panel-2) ${pct}%, var(--panel-2) 100%)`;
  }

  function buildEq() {
    els.eqBands.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (let i = 0; i < EQ_BAND_COUNT; i++) {
      const band = document.createElement("div");
      band.className = "eq-band";

      const value = document.createElement("span");
      value.className = "eq-value";
      value.dataset.idx = i;

      const slider = document.createElement("input");
      slider.type = "range";
      slider.className = "eq-slider";
      slider.min = "-12";
      slider.max = "12";
      slider.step = "1";
      slider.value = "0";
      slider.dataset.idx = i;
      slider.setAttribute("aria-label", `${EQ_LABELS[i]} Hz`);

      const label = document.createElement("span");
      label.className = "eq-label";
      label.textContent = EQ_LABELS[i];

      band.append(value, slider, label);
      frag.appendChild(band);
    }
    els.eqBands.appendChild(frag);
    bindEqEvents();
  }

  function bindEqEvents() {
    els.eqBands.querySelectorAll(".eq-slider").forEach((slider) => {
      slider.addEventListener("input", () => onEqInput(slider));
    });
    els.presetChips.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => onPresetClick(chip));
    });
  }

  function onEqInput(slider) {
    const idx = Number(slider.dataset.idx);
    const value = Number(slider.value);
    state.eqGains[idx] = value;
    // A manual tweak overrides whatever preset was active.
    state.eqPreset = "CUSTOM";
    state.eqCustom = true;
    renderEq();
    scheduleEqSend();
  }

  let eqSendTimer = null;
  function scheduleEqSend() {
    clearTimeout(eqSendTimer);
    eqSendTimer = setTimeout(() => {
      send({ type: "cmd.eq.set", gains: state.eqGains.slice() });
    }, 120);
  }

  function onPresetClick(chip) {
    const name = chip.dataset.preset;
    if (name === state.eqPreset) return;
    haptic();
    state.eqPreset = name;
    state.eqCustom = false;
    state.eqGains = PRESET_CURVES[name].slice();
    renderEq();
    send({ type: "cmd.preset.apply", name });
  }

  function renderEq() {
    const disabled = !state.supportsEq;
    els.eqUnsupported.classList.toggle("hidden", disabled === false);
    els.eqBands.querySelectorAll(".eq-band").forEach((band, idx) => {
      const value = band.querySelector(".eq-value");
      const slider = band.querySelector(".eq-slider");
      slider.value = String(state.eqGains[idx]);
      slider.disabled = disabled;
      value.textContent = `${state.eqGains[idx] > 0 ? "+" : ""}${state.eqGains[idx]}`;
      paintEqTrack(slider, state.eqGains[idx]);
    });
    els.presetChips.querySelectorAll(".chip").forEach((chip) => {
      chip.disabled = disabled;
      chip.classList.toggle(
        "active",
        !state.eqCustom && chip.dataset.preset === state.eqPreset,
      );
    });
  }

  // --- Device switcher -------------------------------------------------------

  function renderDevices() {
    els.deviceList.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (const dev of state.devices) {
      const row = document.createElement("button");
      row.className = "device-row" + (dev.active ? " active" : "");
      row.type = "button";

      const icon = document.createElement("span");
      icon.className = "dev-icon";
      icon.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M12 18v.01"/></svg>';

      const info = document.createElement("span");
      info.className = "dev-info";
      const name = document.createElement("p");
      name.className = "dev-name";
      name.textContent = dev.name || "Dispositivo";
      const sub = document.createElement("p");
      sub.className = "dev-sub";
      const conn =
        dev.connection === "usb" ? "USB" : dev.connection === "bluetooth" ? "Bluetooth" : "Sem conexão";
      sub.textContent = dev.connected ? `${conn} · conectado` : conn;
      info.append(name, sub);

      const check = document.createElement("span");
      check.className = "dev-check";
      check.innerHTML =
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

      row.append(icon, info, check);
      row.addEventListener("click", () => {
        if (dev.active) return;
        haptic();
        // Optimistically mark this one active until the snapshot lands.
        state.devices.forEach((d) => (d.active = d.id === dev.id));
        renderDevices();
        send({ type: "cmd.device.set", deviceId: dev.id });
      });

      frag.appendChild(row);
    }
    els.deviceList.appendChild(frag);
  }

  // --- Live analyzer ---------------------------------------------------------

  let analyzerRaf = null;
  let analyzerTarget = new Array(48).fill(0);
  let analyzerSmooth = new Array(48).fill(0);
  let analyzerLastSeen = 0;
  const ANALYZER_IDLE_MS = 700;

  function applyAnalyzerBins(bins) {
    if (!Array.isArray(bins)) return;
    analyzerTarget = bins;
    analyzerLastSeen = performance.now();
    els.analyzerIdle.classList.add("hidden");
  }

  function startAnalyzer() {
    if (analyzerRaf) return;
    sizeAnalyzer();
    analyzerRaf = requestAnimationFrame(analyzerLoop);
  }

  function stopAnalyzer() {
    if (analyzerRaf) {
      cancelAnimationFrame(analyzerRaf);
      analyzerRaf = null;
    }
  }

  function sizeAnalyzer() {
    const canvas = els.analyzerCanvas;
    const box = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (w === 0 || h === 0) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function analyzerLoop(now) {
    if (now - analyzerLastSeen > ANALYZER_IDLE_MS) {
      analyzerTarget = new Array(48).fill(0);
      els.analyzerIdle.classList.remove("hidden");
    }
    const ctx = els.analyzerCanvas.getContext("2d");
    const canvas = els.analyzerCanvas;
    const box = canvas.parentElement;
    const w = box.clientWidth;
    const h = box.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const gap = 3;
    const barW = Math.max(2, (w - gap * (analyzerTarget.length - 1)) / analyzerTarget.length);
    const baseY = h - 12;
    const maxH = h - 24;
    for (let i = 0; i < analyzerTarget.length; i++) {
      const target = Math.max(0, Math.min(1, analyzerTarget[i] || 0));
      analyzerSmooth[i] += (target - analyzerSmooth[i]) * 0.3;
      const barH = Math.max(2, analyzerSmooth[i] * maxH);
      const t = i / (analyzerTarget.length - 1);
      // Green → blue across the spectrum, echoing the ambient blobs.
      const r = Math.round(34 + (59 - 34) * t);
      const g = Math.round(197 - (197 - 130) * t);
      const b = Math.round(94 + (246 - 94) * t);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.beginPath();
      ctx.roundRect(i * (barW + gap), baseY - barH, barW, barH, barW / 2);
      ctx.fill();
    }
    analyzerRaf = requestAnimationFrame(analyzerLoop);
  }

  // Canvas sizing depends on the (sometimes hidden) analyzer panel's box.
  window.addEventListener("resize", () => {
    if (state.currentTab === "analyzer") sizeAnalyzer();
  });

  // Between the desktop's 1s position pushes, nudge the bar forward locally
  // so it doesn't look frozen.
  function startLocalTicker() {
    stopLocalTicker();
    localTicker = setInterval(() => {
      if (!state.playing) return;
      state.positionSecs = (state.positionSecs || 0) + 1;
      renderPlayback();
    }, 1000);
  }

  function stopLocalTicker() {
    if (localTicker) clearInterval(localTicker);
    localTicker = null;
  }

  function send(cmd) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(cmd));
  }

  function connect() {
    if (!token) {
      setStatus(
        "Link inválido",
        "Escaneie o QR Code exibido no SoundCore para abrir o controle remoto.",
        "error",
      );
      return;
    }

    clearTimeout(reconnectTimer);
    setStatus("Conectando…", "Aguardando o SoundCore no computador.");

    const scheme = location.protocol === "https:" ? "wss" : "ws";
    const url = `${scheme}://${location.host}/ws?t=${encodeURIComponent(token)}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      // Real confirmation comes from `event.paired`; this just means the TCP
      // handshake succeeded.
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      handleEvent(msg);
    };

    ws.onerror = () => { };

    ws.onclose = () => {
      stopLocalTicker();
      if (!everConnected) {
        setStatus(
          "Sessão expirada",
          "Abra o SoundCore no computador e gere um novo QR Code.",
          "error",
        );
        return;
      }
      // Exponential backoff (1s, 2s, 4s… capped at 10s) instead of hammering
      // the desktop every 2s while it's e.g. restarting.
      const delay = Math.min(1000 * 2 ** reconnectAttempts, 10000);
      reconnectAttempts += 1;
      setStatus("Conexão perdida", "Tentando reconectar…");
      reconnectTimer = setTimeout(connect, delay);
    };
  }

  function handleEvent(msg) {
    switch (msg.type) {
      case "event.paired":
        everConnected = true;
        reconnectAttempts = 0;
        showConnected();
        break;
      case "state.snapshot":
        everConnected = true;
        showConnected();
        applySnapshot(msg.state);
        startLocalTicker();
        break;
      case "state.playback":
        applyPlayback(msg.playback);
        break;
      case "state.volume":
        state.volume = msg.value;
        renderVolume();
        break;
      case "state.muted":
        state.muted = msg.value;
        renderVolume();
        break;
      case "state.analyzer":
        applyAnalyzerBins(msg.bins);
        break;
      case "error":
        showToast(msg.message || "Erro no comando.");
        break;
      case "system.disconnect":
        everConnected = false;
        setStatus(
          "Desconectado pelo PC",
          "O SoundCore encerrou esta sessão. Gere um novo QR Code para reconectar.",
          "error",
        );
        try {
          ws.close();
        } catch { }
        break;
      default:
        break;
    }
  }

  // --- Controls --------------------------------------------------------------

  els.btnPlay.addEventListener("click", () => {
    haptic();
    send({ type: state.playing ? "cmd.player.pause" : "cmd.player.play" });
  });
  els.btnNext.addEventListener("click", () => {
    haptic();
    send({ type: "cmd.player.next" });
  });
  els.btnPrev.addEventListener("click", () => {
    haptic();
    send({ type: "cmd.player.previous" });
  });
  els.btnMute.addEventListener("click", () => {
    haptic();
    send({ type: state.muted ? "cmd.volume.unmute" : "cmd.volume.mute" });
  });

  // Swipe the album art left/right for next/previous — a quicker gesture
  // than reaching for the transport buttons with one hand.
  if (els.artWrap) {
    let touchStartX = 0;
    let touchStartY = 0;
    els.artWrap.addEventListener(
      "touchstart",
      (e) => {
        const t = e.changedTouches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
      },
      { passive: true },
    );
    els.artWrap.addEventListener(
      "touchend",
      (e) => {
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        haptic();
        send({ type: dx < 0 ? "cmd.player.next" : "cmd.player.previous" });
      },
      { passive: true },
    );
  }

  let volumeSendTimer = null;
  els.volumeSlider.addEventListener("input", (e) => {
    draggingVolume = true;
    const value = Number(e.target.value);
    els.volNum.textContent = String(value);
    paintVolumeTrack(value);
    clearTimeout(volumeSendTimer);
    volumeSendTimer = setTimeout(() => {
      send({ type: "cmd.volume.set", value });
    }, 60);
  });
  els.volumeSlider.addEventListener("change", () => {
    draggingVolume = false;
  });

  // --- Tab bar navigation ---
  els.tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    haptic();
    showView(btn.dataset.tab);
  });

  // Keep the socket alive and detect silent drops on mobile browsers that
  // suspend background tabs.
  setInterval(() => send({ type: "cmd.system.ping" }), 20000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        connect();
      } else {
        send({ type: "cmd.state.request" });
      }
      // The OS releases the wake lock on hide; grab it back if we're
      // already showing the remote (any tab).
      if (!els.tabs.classList.contains("hidden")) requestWakeLock();
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => { });
  }

  buildEq();
  connect();
})();
