import { useEffect, useRef, useState } from "react";
import Panel from "../components/Panel";
import SpectrumAnalyzer from "../components/SpectrumAnalyzer";
import { getAnalyzerStatus, getWaveform } from "../lib/deviceApi";

function WaveformCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loop = async () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      let samples: number[] = [];
      try {
        samples = await getWaveform();
      } catch {
        samples = [];
      }

      if (samples.length) {
        const accent = getComputedStyle(canvas).getPropertyValue("--accent-2").trim() || "#4ade80";
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        samples.forEach((v, i) => {
          const x = (i / (samples.length - 1)) * width;
          const y = height / 2 + (v - 0.5) * height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return <canvas ref={canvasRef} className="canvas-surface" style={{ height: 100 }} aria-label="Forma de onda" />;
}

function Meter({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="meter">
      <div className="meter-head">
        <span className="field-label">{label}</span>
        <span className="num" style={{ fontSize: 11, color: "var(--text)" }}>{Math.round(v * 100)}%</span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${v * 100}%` }} />
      </div>
    </div>
  );
}

export default function AnalyzerPage() {
  const [peak, setPeak] = useState(0);
  const [rms, setRms] = useState(0);
  const [lufs, setLufs] = useState(-70);
  const [sampleRate, setSampleRate] = useState(48000);
  const [capturing, setCapturing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const s = await getAnalyzerStatus();
        if (!alive) return;
        setPeak(s.peak);
        setRms(s.rms);
        setLufs(s.lufs);
        setSampleRate(s.sampleRate);
        setCapturing(s.captureAlive && !s.lastError && s.framesPushed > 0);
        setError(s.lastError);
      } catch {
        /* keep last values */
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const clipping = peak > 0.95;

  return (
    <div className="page">
      <Panel
        title="ANALISADOR EM TEMPO REAL"
        action={
          <span className="num" style={{ fontSize: 10.5, color: "var(--accent-2)" }}>
            FFT 4096 · {sampleRate.toLocaleString("pt-BR")} Hz
          </span>
        }
      >
        <SpectrumAnalyzer />
      </Panel>

      <Panel title="FORMA DE ONDA">
        <WaveformCanvas />
      </Panel>

      <div className="grid grid-2">
        <Panel title="NÍVEIS">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Meter label="Pico" value={peak} />
            <Meter label="RMS" value={rms} />
            <Meter label="Loudness (LUFS)" value={(lufs + 30) / 30} />
          </div>
        </Panel>

        <Panel title="STATUS">
          <div className="grid grid-2">
            <div className={`box ${clipping ? "danger" : ""}`}>
              <div className="box-label">Clipping</div>
              <div className="box-value num" style={{ fontSize: 18 }}>{clipping ? "⚠" : "OK"}</div>
            </div>
            <div className="box">
              <div className="box-label">Captura</div>
              <div className="box-value num" style={{ fontSize: 18, color: capturing ? "var(--accent-2)" : "var(--danger)" }}>
                {capturing ? "ATIVA" : "SILÊNCIO"}
              </div>
            </div>
            <div className="box">
              <div className="box-label">Profundidade de Bits</div>
              <div className="box-value num" style={{ fontSize: 18 }}>float32</div>
            </div>
            <div className="box">
              <div className="box-label">Taxa de Amostragem</div>
              <div className="box-value num" style={{ fontSize: 18 }}>{(sampleRate / 1000).toFixed(1).replace(".", ",")} kHz</div>
            </div>
          </div>
          {error && (
            <div className="box danger" style={{ marginTop: 16 }}>
              <div className="box-label">Erro de captura</div>
              <div className="box-value num" style={{ fontSize: 11, lineHeight: 1.5 }}>{error}</div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
