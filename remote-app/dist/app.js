// SoundCore Remote — vanilla JS PWA client.
// Talks to the desktop app's local WebSocket (`/ws?t=<token>`) using the
// protocol defined in src-tauri/src/remote/protocol.rs. No build step: this
// file is served as-is by the axum static handler in remote/server.rs.
(function () {
  "use strict";

  const token = new URLSearchParams(location.search).get("t") || "";

  const els = {
    connDot: document.getElementById("connDot"),
    deviceName: document.getElementById("deviceName"),
    statusView: document.getElementById("statusView"),
    statusSpinner: document.getElementById("statusSpinner"),
    statusTitle: document.getElementById("statusTitle"),
    statusSub: document.getElementById("statusSub"),
    playerView: document.getElementById("playerView"),
    art: document.querySelector(".art"),
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
  };

  let ws = null;
  let everConnected = false;
  let localTicker = null;
  let toastTimer = null;

  let state = {
    playing: false,
    positionSecs: 0,
    durationSecs: 0,
    volume: 50,
    muted: false,
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
    els.statusView.classList.remove("hidden");
    els.playerView.classList.add("hidden");
    els.statusTitle.textContent = title;
    els.statusSub.textContent = sub || "";
    els.statusSpinner.classList.toggle("done", variant === "done");
    els.connDot.classList.remove("live", "error");
    if (variant === "error") els.connDot.classList.add("error");
  }

  function showPlayer() {
    els.statusView.classList.add("hidden");
    els.playerView.classList.remove("hidden");
    els.connDot.classList.add("live");
    els.connDot.classList.remove("error");
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

  function applySnapshot(snap) {
    if (snap.device) {
      els.deviceName.textContent = snap.device.name;
    }
    state.volume = snap.volume;
    state.muted = snap.muted;
    applyPlayback(snap.playback);
    renderVolume();
  }

  function applyPlayback(p) {
    state.playing = p.playing;
    state.title = p.title;
    state.artist = p.artist;
    state.durationSecs = p.durationSecs;
    state.positionSecs = p.positionSecs;
    renderPlayback();
  }

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
      setStatus("Conexão perdida", "Tentando reconectar…");
      setTimeout(connect, 2000);
    };
  }

  function handleEvent(msg) {
    switch (msg.type) {
      case "event.paired":
        everConnected = true;
        showPlayer();
        break;
      case "state.snapshot":
        everConnected = true;
        showPlayer();
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
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => { });
  }

  connect();
})();
