import { useState } from "react";
import { useApp } from "../context/AppStore";
import Panel from "../components/Panel";
import { IconArrowRight } from "../components/icons";
import { EQ_BANDS } from "../types/audio";

const STEPS = [
  "Sinal → varredura de teste",
  "Captura do microfone",
  "Análise de frequência",
  "Detecção de ressonância",
  "Curva de correção",
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
    <div className="page">
      <Panel title="CALIBRAÇÃO AUTOMÁTICA">
        <p className="page-lead" style={{ marginBottom: 16 }}>
          O software reproduz tons de teste de frequência pela soundbar e os captura com o
          microfone do dispositivo, medindo a resposta acústica do ambiente. Em seguida, calcula
          uma curva de correção de EQ para o seu ambiente.
        </p>
        <button className="btn-cta" style={{ width: "auto" }} onClick={start} disabled={!selectedId || calibrating}>
          {calibrating ? "CALIBRANDO…" : "CALIBRAR"}
          <span className="btn-nested-icon">
            <IconArrowRight size={13} />
          </span>
        </button>
        {!selectedId && (
          <p style={{ marginTop: 10, fontSize: 11, color: "var(--text-faint)" }}>Conecte um dispositivo para calibrar.</p>
        )}
      </Panel>

      {(calibrating || step > 0) && (
        <Panel title="PROCESSO">
          <div>
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`step-row ${i < step ? "done" : i === step && calibrating ? "active" : ""}`}
              >
                <span className="step-dot">{i < step ? "✓" : i === step && calibrating ? "…" : i + 1}</span>
                {s}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {calibration && (
        <>
          <Panel title={`PERFIL DO AMBIENTE · ${calibration.name}`}>
            <div className="grid grid-cols-3">
              <div className="box">
                <div className="box-label">Ressonância de Graves</div>
                <div className="box-value num" style={{ fontSize: 18 }}>{calibration.bassResonanceHz} Hz</div>
              </div>
              <div className="box accent">
                <div className="box-label">Correção</div>
                <div className="box-value num" style={{ fontSize: 18 }}>{calibration.correctionDb} dB</div>
              </div>
              <div className="box">
                <div className="box-label">Desequilíbrio Estéreo</div>
                <div className="box-value num" style={{ fontSize: 18 }}>{calibration.stereoImbalanceDb} dB</div>
              </div>
            </div>
          </Panel>

          <Panel title="CURVA DE CORREÇÃO">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 130 }}>
              {calibration.curve.map((g, i) => {
                const h = ((g + 4) / 12) * 100;
                return (
                  <div
                    key={i}
                    className="abar"
                    style={{ height: `${Math.max(4, h)}%` }}
                    title={`${EQ_BANDS[i]?.label}: ${g} dB`}
                  />
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10.5, color: "var(--text-faint)" }}>
              <span>{EQ_BANDS[0]?.label}</span>
              <span>{EQ_BANDS[EQ_BANDS.length - 1]?.label}</span>
            </div>
          </Panel>

          <button className="btn-solid" style={{ alignSelf: "flex-start" }} onClick={() => notify("Curva de calibração aplicada ao EQ do Audio Lab.")}>
            Aplicar Calibração
          </button>
        </>
      )}
    </div>
  );
}
