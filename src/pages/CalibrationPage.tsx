import { useState } from "react";
import { useApp } from "../context/AppStore";
import Panel from "../components/Panel";
import { EQ_BANDS } from "../types/audio";

const STEPS = [
  "Signal → test sweep",
  "Microphone capture",
  "Frequency analysis",
  "Resonance detection",
  "Correction curve",
];

export default function CalibrationPage() {
  const { runCalibration, calibrating, calibration, selectedId, notify } = useApp();
  const [step, setStep] = useState(0);

  const start = async () => {
    setStep(0);
    for (let i = 0; i < STEPS.length; i++) {
      setStep(i);
      await new Promise((r) => setTimeout(r, 600));
    }
    await runCalibration();
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <Panel title="Auto Calibration">
        <p className="mb-4 max-w-lg text-xs leading-relaxed text-text-dim">
          The software plays frequency test tones through the soundbar and captures them with the
          device microphone, measuring the room's acoustic response. It then computes an EQ
          correction curve for your environment.
        </p>
        <button
          onClick={start}
          disabled={!selectedId || calibrating}
          className="rounded-lg border border-accent px-6 py-3 text-sm font-semibold tracking-widest text-accent transition-colors hover:bg-accent hover:text-black disabled:opacity-40"
        >
          {calibrating ? "CALIBRATING…" : "CALIBRATE"}
        </button>
        {!selectedId && (
          <p className="mt-2 text-[10px] text-text-dim">Connect a device to calibrate.</p>
        )}
      </Panel>

      {(calibrating || step > 0) && (
        <Panel title="Process">
          <div className="space-y-2">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`flex items-center gap-3 text-xs ${
                  i < step || (i === step && calibrating)
                    ? "text-text"
                    : "text-text-dim/50"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                    i < step ? "border-accent text-accent" : "border-border"
                  }`}
                >
                  {i < step ? "✓" : i === step && calibrating ? "…" : i + 1}
                </span>
                {s}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {calibration && (
        <>
          <Panel title={`Room Profile · ${calibration.name}`}>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-surface-2/50 px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-text-dim">Bass resonance</p>
                <p className="mt-1 font-mono text-lg text-text">{calibration.bassResonanceHz} Hz</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-2/50 px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-text-dim">Correction</p>
                <p className="mt-1 font-mono text-lg text-accent">{calibration.correctionDb} dB</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-2/50 px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-text-dim">Stereo imbalance</p>
                <p className="mt-1 font-mono text-lg text-text">{calibration.stereoImbalanceDb} dB</p>
              </div>
            </div>
          </Panel>

          <Panel title="Correction Curve">
            <div className="flex h-32 items-end gap-1">
              {calibration.curve.map((g, i) => {
                const h = ((g + 4) / 12) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-accent/70"
                    style={{ height: `${Math.max(4, h)}%` }}
                    title={`${EQ_BANDS[i]?.label}: ${g} dB`}
                  />
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-text-dim">
              <span>{EQ_BANDS[0]?.label}</span>
              <span>{EQ_BANDS[EQ_BANDS.length - 1]?.label}</span>
            </div>
          </Panel>

          <button
            onClick={() => notify("Calibration curve applied to Audio Lab EQ.")}
            className="rounded-lg border border-accent bg-accent/10 px-4 py-2 text-xs font-semibold tracking-widest text-accent transition-colors hover:bg-accent hover:text-black"
          >
            APPLY CALIBRATION
          </button>
        </>
      )}
    </div>
  );
}