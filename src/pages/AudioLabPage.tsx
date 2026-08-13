import type { ReactNode } from "react";
import { useApp } from "../context/AppStore";
import Equalizer from "../components/Equalizer";
import Panel from "../components/Panel";
import Slider from "../components/Slider";
import Toggle from "../components/Toggle";

function LabRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/50 px-4 py-3">
      <p className="mb-3 text-[10px] uppercase tracking-widest text-text-dim">{label}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export default function AudioLabPage() {
  const { audioLab, setAudioLab, selectedId } = useApp();
  const disabled = !selectedId;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <Panel title="Equalizer">
        <Equalizer gains={audioLab.eq} onChange={(gains) => setAudioLab({ eq: gains })} disabled={disabled} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <LabRow label="Tone">
          <Slider
            label="Bass"
            value={audioLab.bass}
            min={0}
            max={12}
            unit="dB"
            onChange={(bass) => setAudioLab({ bass })}
            disabled={disabled}
          />
          <Slider
            label="Treble"
            value={audioLab.treble}
            min={0}
            max={12}
            unit="dB"
            onChange={(treble) => setAudioLab({ treble })}
            disabled={disabled}
          />
          <Slider
            label="Balance"
            value={audioLab.balance}
            min={-100}
            max={100}
            unit="%"
            onChange={(balance) => setAudioLab({ balance })}
            disabled={disabled}
          />
        </LabRow>

        <LabRow label="Gain Staging">
          <Slider
            label="Preamp"
            value={audioLab.preamp}
            min={-12}
            max={12}
            unit="dB"
            onChange={(preamp) => setAudioLab({ preamp })}
            disabled={disabled}
          />
          <Slider
            label="Gain"
            value={audioLab.gain}
            min={-12}
            max={12}
            unit="dB"
            onChange={(gain) => setAudioLab({ gain })}
            disabled={disabled}
          />
          <Slider
            label="Stereo Width"
            value={audioLab.stereoWidth}
            min={0}
            max={200}
            unit="%"
            onChange={(stereoWidth) => setAudioLab({ stereoWidth })}
            disabled={disabled}
          />
        </LabRow>

        <LabRow label="Enhance">
          <Slider
            label="Noise Reduction"
            value={audioLab.noiseReduction}
            min={0}
            max={100}
            unit="%"
            onChange={(noiseReduction) => setAudioLab({ noiseReduction })}
            disabled={disabled}
          />
          <Slider
            label="Crossfeed"
            value={audioLab.crossfeed}
            min={0}
            max={100}
            unit="%"
            onChange={(crossfeed) => setAudioLab({ crossfeed })}
            disabled={disabled}
          />
          <Toggle
            label="Loudness"
            checked={audioLab.loudness}
            onChange={(loudness) => setAudioLab({ loudness })}
            disabled={disabled}
          />
        </LabRow>
      </div>

      <Panel title="Dynamics">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-3 rounded-lg border border-border bg-surface-2/50 px-4 py-3">
            <Toggle
              label="Compressor"
              checked={audioLab.compressor}
              onChange={(compressor) => setAudioLab({ compressor })}
              disabled={disabled}
            />
            <p className="text-[10px] leading-relaxed text-text-dim">
              Tames peaks. Feed-forward envelope, ratio 4:1.
            </p>
          </div>
          <div className="space-y-3 rounded-lg border border-border bg-surface-2/50 px-4 py-3">
            <Toggle
              label="Limiter"
              checked={audioLab.limiter}
              onChange={(limiter) => setAudioLab({ limiter })}
              disabled={disabled}
            />
            <p className="text-[10px] leading-relaxed text-text-dim">
              Brickwall at −1 dB. Protects the soundbar from clipping.
            </p>
          </div>
          <div className="space-y-3 rounded-lg border border-border bg-surface-2/50 px-4 py-3">
            <Toggle
              label="Spatial Audio"
              checked={audioLab.spatial}
              onChange={(spatial) => setAudioLab({ spatial })}
              disabled={disabled}
            />
            <p className="text-[10px] leading-relaxed text-text-dim">
              Widens the stage. Forwarded to the hardware when supported.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}