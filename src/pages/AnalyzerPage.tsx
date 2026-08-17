import { useEffect, useRef, useState } from "react";
import Panel from "../components/Panel";
import SpectrumAnalyzer from "../components/SpectrumAnalyzer";
import { getAnalyzerStatus, getStereoField, getWaveform, type StereoField } from "../lib/deviceApi";

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

function Meter({
  label,
  value,
  max = 1,
  format,
}: {
  label: string;
  value: number;
  max?: number;
  format?: (v: number) => string;
}) {
  const v = Math.max(0, Math.min(max, value));
  const pct = (v / max) * 100;
  return (
    <div className="meter">
      <div className="meter-head">
        <span className="field-label">{label}</span>
        <span className="num" style={{ fontSize: 11, color: "var(--text)" }}>
          {format ? format(v) : `${Math.round(pct)}%`}
        </span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Centered meter for signed metrics (-1..+1): correlation, balance. */
function BipolarMeter({
  label,
  value,
  leftLabel,
  rightLabel,
}: {
  label: string;
  value: number;
  leftLabel: string;
  rightLabel: string;
}) {
  const v = Math.max(-1, Math.min(1, value));
  const pct = ((v + 1) / 2) * 100;
  return (
    <div className="meter">
      <div className="meter-head">
        <span className="field-label">{label}</span>
        <span className="num" style={{ fontSize: 11, color: "var(--text)" }}>{v.toFixed(2)}</span>
      </div>
      <div className="meter-track" style={{ position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 1,
            background: "var(--border)",
          }}
        />
        <div
          className="meter-fill"
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${Math.min(50, pct)}%`,
            width: `${Math.abs(pct - 50)}%`,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 9.5,
          color: "var(--text-faint)",
          marginTop: 4,
        }}
      >
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
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
  const [stereoField, setStereoField] = useState<StereoField>({
    correlation: 1,
    balance: 0,
    width: 0,
    mono: true,
  });

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
      try {
        const f = await getStereoField();
        if (!alive) return;
        setStereoField(f);
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

        <Panel title="CAMPO ESTÉREO">
          {stereoField.mono ? (
            <p style={{ padding: "28px 0", textAlign: "center", fontSize: 12.5, color: "var(--text-faint)" }}>
              Fonte mono ou sem áudio capturado ainda.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <BipolarMeter
                label="Correlação de Fase"
                value={stereoField.correlation}
                leftLabel="FORA DE FASE"
                rightLabel="EM FASE"
              />
              <BipolarMeter
                label="Balanço"
                value={stereoField.balance}
                leftLabel="ESQUERDA"
                rightLabel="DIREITA"
              />
              <Meter
                label="Largura Estéreo"
                value={stereoField.width}
                max={2}
                format={(v) => v.toFixed(2)}
              />
            </div>
          )}
        </Panel>
      </div>

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
  );
}
