import { useEffect, useRef } from "react";
import { getSpectrum } from "../lib/deviceApi";

const BARS = 48;
const COLORS = ["#0a9e83", "#00e0b2", "#e8eaf0"];

export default function SpectrumAnalyzer({ running }: { running: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const runningRef = useRef(running);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let fallback = Array.from({ length: BARS }, () => 0.05);

    const draw = (bins: number[]) => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, width, height);

      const barW = (width - (BARS - 1) * 2) / BARS;
      for (let i = 0; i < BARS; i++) {
        const idx = Math.floor((i / BARS) * bins.length);
        let v = bins[idx] ?? 0;
        // smooth toward target
        const prev = fallback[i];
        v = prev + (v - prev) * 0.15;
        fallback[i] = v;

        const h = Math.max(4, v * (height - 8));
        const x = i * (barW + 2);
        const y = height - h;

        const color = COLORS[Math.min(2, Math.floor((i / BARS) * 3))];
        const grad = ctx.createLinearGradient(0, y, 0, height);
        grad.addColorStop(0, color);
        grad.addColorStop(1, "rgba(18,21,26,0.4)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, 2);
        ctx.fill();
      }
    };

    const loop = async () => {
      if (runningRef.current) {
        try {
          const bins = await getSpectrum();
          draw(bins);
        } catch {
          draw(fallback);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="h-32 w-full rounded-lg bg-surface"
      aria-label="Real-time spectrum analyzer"
    />
  );
}
