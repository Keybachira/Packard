import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppStore";
import Panel from "../components/Panel";
import SpectrumAnalyzer from "../components/SpectrumAnalyzer";
import { getWaveform } from "../lib/deviceApi";

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
        ctx.strokeStyle = "var(--color-accent)";
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

  return (
    <canvas ref={canvasRef} className="h-24 w-full rounded-lg bg-surface-2/40" aria-label="Waveform" />
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-text-dim">{label}</span>
        <span className="font-mono text-[10px] text-text">{Math.round(v * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${v * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function AnalyzerPage() {
  const { playback } = useApp();
  const [peak, setPeak] = useState(0);
  const [rms, setRms] = useState(0);
  const [lufs, setLufs] = useState(-23);

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now() / 1000;
      setPeak(0.5 + 0.4 * Math.abs(Math.sin(t * 1.3)));
      setRms(0.3 + 0.2 * Math.abs(Math.sin(t * 0.9)));
      setLufs(-26 + 5 * Math.abs(Math.sin(t * 0.6)));
    }, 200);
    return () => clearInterval(id);
  }, []);

  const clipping = peak > 0.95;

  return (
    <div className="flex h-full flex-col gap-4">
      <Panel title="Realtime Analyzer">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] text-text-dim">20 Hz — 20 kHz</span>
          <span className="font-mono text-[10px] text-accent">FFT 4096 · 48 kHz</span>
        </div>
        <SpectrumAnalyzer running={playback.playing} />
      </Panel>

      <Panel title="Waveform">
        <WaveformCanvas />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Levels">
          <div className="space-y-4">
            <Meter label="Peak" value={peak} />
            <Meter label="RMS" value={rms} />
            <Meter label="Loudness (LUFS)" value={(lufs + 30) / 30} />
          </div>
        </Panel>

        <Panel title="Status">
          <div className="grid grid-cols-2 gap-3">
            <div
              className={`rounded-lg border px-4 py-3 ${
                clipping ? "border-red-500 bg-red-500/10" : "border-border bg-surface-2/50"
              }`}
            >
              <p className="text-[10px] uppercase tracking-widest text-text-dim">Clipping</p>
              <p className={`mt-1 font-mono text-lg ${clipping ? "text-red-400" : "text-text"}`}>
                {clipping ? "⚠" : "OK"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2/50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-text-dim">Stereo Field</p>
              <p className="mt-1 font-mono text-lg text-text">
                {Math.abs(peak - rms) > 0.15 ? "WIDE" : "CENTER"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2/50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-text-dim">Bit Depth</p>
              <p className="mt-1 font-mono text-lg text-text">24-bit</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2/50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-text-dim">Sample Rate</p>
              <p className="mt-1 font-mono text-lg text-text">48 kHz</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}