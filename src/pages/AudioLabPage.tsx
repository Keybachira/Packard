import type { ReactNode } from "react";
import { useApp } from "../context/AppStore";
import Equalizer, { isFlatEq } from "../components/Equalizer";
import Panel from "../components/Panel";
import Slider from "../components/Slider";
import Toggle from "../components/Toggle";

function LabRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="box">
      <div className="box-label">{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
}

export default function AudioLabPage() {
  const { audioLab, setAudioLab, selectedId } = useApp();
  const disabled = !selectedId;

  return (
    <div className="page">
      <Panel
        title="EQUALIZADOR"
        action={
          <button className="btn-ghost" onClick={() => setAudioLab({ eq: audioLab.eq.map(() => 0) })} disabled={disabled}>
            {isFlatEq(audioLab.eq) ? "FLAT" : "Redefinir"}
          </button>
        }
      >
        <Equalizer gains={audioLab.eq} onChange={(eq) => setAudioLab({ eq })} disabled={disabled} />
      </Panel>

      <div className="grid grid-cols-3">
        <LabRow label="Tom">
          <Slider
            label="Graves"
            value={audioLab.bass}
            min={0}
            max={12}
            unit="dB"
            onChange={(bass) => setAudioLab({ bass })}
            disabled={disabled}
          />
          <Slider
            label="Agudos"
            value={audioLab.treble}
            min={0}
            max={12}
            unit="dB"
            onChange={(treble) => setAudioLab({ treble })}
            disabled={disabled}
          />
          <Slider
            label="Balanço"
            value={audioLab.balance}
            min={-100}
            max={100}
            unit="%"
            onChange={(balance) => setAudioLab({ balance })}
            disabled={disabled}
          />
        </LabRow>

        <LabRow label="Estágio de Ganho">
          <Slider
            label="Pré-amplificador"
            value={audioLab.preamp}
            min={-12}
            max={12}
            unit="dB"
            onChange={(preamp) => setAudioLab({ preamp })}
            disabled={disabled}
          />
          <Slider
            label="Ganho"
            value={audioLab.gain}
            min={-12}
            max={12}
            unit="dB"
            onChange={(gain) => setAudioLab({ gain })}
            disabled={disabled}
          />
          <Slider
            label="Largura Estéreo"
            value={audioLab.stereoWidth}
            min={0}
            max={200}
            unit="%"
            onChange={(stereoWidth) => setAudioLab({ stereoWidth })}
            disabled={disabled}
          />
        </LabRow>

        <LabRow label="Aprimoramento">
          <Slider
            label="Redução de Ruído"
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

      <Panel title="DINÂMICA">
        <div className="grid grid-cols-3">
          <div className="box">
            <Toggle
              label="Compressor"
              checked={audioLab.compressor}
              onChange={(compressor) => setAudioLab({ compressor })}
              disabled={disabled}
            />
            <p className="box-note">Domina picos. Envelope feed-forward, proporção 4:1.</p>
          </div>
          <div className="box">
            <Toggle
              label="Limiter"
              checked={audioLab.limiter}
              onChange={(limiter) => setAudioLab({ limiter })}
              disabled={disabled}
            />
            <p className="box-note">Teto rígido em −1 dB. Protege a soundbar contra clipping.</p>
          </div>
          <div className="box">
            <Toggle
              label="Áudio Espacial"
              checked={audioLab.spatial}
              onChange={(spatial) => setAudioLab({ spatial })}
              disabled={disabled}
            />
            <p className="box-note">Amplia o palco sonoro. Repassado ao hardware quando suportado.</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
