import React, { useCallback, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  OnboardingWizard.tsx                                              */
/*  Configuração inicial — une o painel "medidor de nível" verde do   */
/*  SoundCore com os cards de capa/biblioteca do player de música.    */
/*  Requer Tailwind configurado no projeto. Sem dependências externas.*/
/* ------------------------------------------------------------------ */

type AccentKey = "verde" | "ambar" | "azul";
type AudioFormat = "flac" | "mp3" | "wav";

interface OnboardingData {
  avatarUrl: string | null;
  username: string;
  musicFolder: string;
  includeSubfolders: boolean;
  autoScan: boolean;
  accent: AccentKey;
  audioFormat: AudioFormat;
}

interface OnboardingWizardProps {
  onComplete?: (data: OnboardingData) => void;
}

const ACCENTS: Record<AccentKey, { label: string; hex: string; glow: string }> =
  {
    verde: {
      label: "Verde Sinal",
      hex: "#2ED8A7",
      glow: "rgba(46,216,167,0.35)",
    },
    ambar: {
      label: "Âmbar Vinil",
      hex: "#F2B84B",
      glow: "rgba(242,184,75,0.35)",
    },
    azul: { label: "Azul Onda", hex: "#4EA1F2", glow: "rgba(78,161,242,0.35)" },
  };

const STEPS = [
  { key: "perfil", label: "Perfil", ch: "CH.01" },
  { key: "biblioteca", label: "Biblioteca", ch: "CH.02" },
  { key: "preferencias", label: "Preferências", ch: "CH.03" },
  { key: "pronto", label: "Pronto", ch: "CH.04" },
] as const;

const DEFAULT_DATA: OnboardingData = {
  avatarUrl: null,
  username: "",
  musicFolder: "",
  includeSubfolders: true,
  autoScan: true,
  accent: "verde",
  audioFormat: "flac",
};

/* --------------------------- ícones --------------------------- */

const IconCamera = (p: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    stroke="currentColor"
    {...p}
  >
    <path
      d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="13.2" r="3.4" />
  </svg>
);

const IconFolder = (p: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={1.6}
    stroke="currentColor"
    {...p}
  >
    <path
      d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"
      strokeLinejoin="round"
    />
  </svg>
);

const IconCheck = (p: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2.2}
    stroke="currentColor"
    {...p}
  >
    <path d="M5 12.5 10 17l9-10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconArrow = (p: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth={2}
    stroke="currentColor"
    {...p}
  >
    <path
      d="M5 12h13M13 6l6 6-6 6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ------------------------ medidor de nível ------------------------ */

function LevelRail({
  currentIndex,
  accentHex,
  onJump,
}: {
  currentIndex: number;
  accentHex: string;
  onJump: (i: number) => void;
}) {
  return (
    <div className="flex lg:flex-col gap-2 lg:gap-1">
      {STEPS.map((step, i) => {
        const state =
          i < currentIndex ? "done" : i === currentIndex ? "active" : "idle";
        const clickable = i <= currentIndex;
        return (
          <button
            key={step.key}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onJump(i)}
            className={`group flex flex-1 lg:flex-none items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors
              ${state === "active" ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}
              ${clickable ? "cursor-pointer" : "cursor-default"}`}
          >
            {/* barras estilo medidor de VU */}
            <div className="flex items-end gap-[3px] h-6 shrink-0">
              {Array.from({ length: 5 }).map((_, bar) => {
                const lit =
                  state === "done" || (state === "active" && bar <= 2);
                const h = 6 + bar * 3.5;
                return (
                  <span
                    key={bar}
                    style={{
                      height: h,
                      background: lit ? accentHex : "rgba(255,255,255,0.12)",
                      boxShadow:
                        lit && state === "active"
                          ? `0 0 8px ${accentHex}`
                          : "none",
                      transitionDelay: `${bar * 40}ms`,
                    }}
                    className="w-[3px] rounded-full transition-all duration-300"
                  />
                );
              })}
            </div>
            <div className="min-w-0">
              <div
                className="font-mono text-[10px] tracking-widest"
                style={{
                  color: state === "idle" ? "rgba(255,255,255,0.3)" : accentHex,
                }}
              >
                {step.ch}
              </div>
              <div
                className={`text-sm font-medium truncate ${
                  state === "idle" ? "text-white/35" : "text-white/90"
                }`}
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {step.label}
              </div>
            </div>
            {state === "done" && (
              <IconCheck
                className="ml-auto h-4 w-4 shrink-0"
                style={{ color: accentHex }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ preview ------------------------------ */

function PreviewCard({ data }: { data: OnboardingData }) {
  const accent = ACCENTS[data.accent];
  return (
    <div
      className="rounded-2xl border border-white/[0.06] bg-[#101317] p-5 flex flex-col gap-5"
      style={{
        boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 20px 60px -20px ${accent.glow}`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-widest text-white/35">
          PRÉ-VISUALIZAÇÃO
        </span>
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse"
          style={{ background: accent.hex, boxShadow: `0 0 8px ${accent.hex}` }}
        />
      </div>

      <div className="flex items-center gap-3">
        <div
          className="h-14 w-14 rounded-full overflow-hidden shrink-0 border-2 flex items-center justify-center bg-white/[0.04]"
          style={{ borderColor: accent.hex }}
        >
          {data.avatarUrl ? (
            <img
              src={data.avatarUrl}
              alt="Avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className="text-white/25 text-lg"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {data.username.trim().charAt(0).toUpperCase() || "?"}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div
            className="text-base font-semibold text-white truncate"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {data.username.trim() || "Seu usuário"}
          </div>
          <div className="text-xs text-white/40">
            {data.audioFormat.toUpperCase()} · Premium
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-2.5">
        <div className="text-[10px] font-mono tracking-widest text-white/35 mb-1">
          PASTA DA BIBLIOTECA
        </div>
        <div className="flex items-center gap-2 text-sm text-white/80 truncate">
          <IconFolder className="h-4 w-4 shrink-0 text-white/40" />
          <span className="truncate">
            {data.musicFolder || "não selecionada"}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-white/30">
          {data.includeSubfolders ? "Inclui subpastas" : "Somente pasta raiz"}
          {" · "}
          {data.autoScan ? "monitoramento ativo" : "monitoramento manual"}
        </div>
      </div>

      {/* mini analisador */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-3">
        <div className="text-[10px] font-mono tracking-widest text-white/35 mb-2">
          ANALISADOR
        </div>
        <div className="flex items-end gap-[3px] h-10">
          {Array.from({ length: 28 }).map((_, i) => {
            const h = 20 + Math.abs(Math.sin(i * 0.9)) * 70;
            return (
              <span
                key={i}
                style={{
                  height: `${h}%`,
                  background: accent.hex,
                  opacity: 0.35 + (i % 5) * 0.12,
                  animationDelay: `${i * 45}ms`,
                }}
                className="flex-1 rounded-sm animate-pulse"
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
          <span
            key={k}
            className="h-3 w-3 rounded-full"
            style={{
              background: ACCENTS[k].hex,
              outline:
                data.accent === k ? "2px solid rgba(255,255,255,0.5)" : "none",
              outlineOffset: 2,
            }}
          />
        ))}
        <span className="text-[11px] text-white/30 ml-1">
          {ACCENTS[data.accent].label}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------- passos ------------------------------- */

function StepPerfil({
  data,
  update,
}: {
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => update({ avatarUrl: reader.result as string });
      reader.readAsDataURL(file);
    },
    [update],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold text-white"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Vamos te conhecer
        </h2>
        <p className="text-sm text-white/40 mt-1">
          Uma foto e um nome — é o suficiente para começar.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative h-20 w-20 rounded-full border-2 border-dashed border-white/15 hover:border-white/30 transition-colors flex items-center justify-center overflow-hidden bg-white/[0.03] shrink-0"
        >
          {data.avatarUrl ? (
            <img
              src={data.avatarUrl}
              alt="Avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <IconCamera className="h-6 w-6 text-white/30" />
          )}
        </button>
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-sm font-medium text-white/80 hover:text-white transition-colors underline decoration-white/20 underline-offset-4"
          >
            {data.avatarUrl ? "Trocar foto" : "Enviar foto"}
          </button>
          <p className="text-xs text-white/30 mt-1">PNG ou JPG, até 5MB</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      <label className="block">
        <span className="text-xs font-mono tracking-widest text-white/35">
          NOME DE USUÁRIO
        </span>
        <input
          value={data.username}
          onChange={(e) => update({ username: e.target.value })}
          placeholder="ex: aquilesgoncalves"
          className="mt-2 w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-white placeholder-white/25 outline-none focus:border-white/25 focus:ring-2 focus:ring-white/10 transition-all"
        />
      </label>
    </div>
  );
}

function StepBiblioteca({
  data,
  update,
}: {
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
}) {
  const folderRef = useRef<HTMLInputElement>(null);

  const handleFolder = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const first = files[0] as File & { webkitRelativePath?: string };
      const root = first.webkitRelativePath
        ? first.webkitRelativePath.split("/")[0]
        : first.name;
      update({ musicFolder: root });
    },
    [update],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold text-white"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Onde estão suas músicas?
        </h2>
        <p className="text-sm text-white/40 mt-1">
          Aponte a pasta principal — organizamos o resto.
        </p>
      </div>

      <label className="block">
        <span className="text-xs font-mono tracking-widest text-white/35">
          PASTA DA BIBLIOTECA
        </span>
        <div className="mt-2 flex gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
            <IconFolder className="h-4 w-4 text-white/30 shrink-0" />
            <input
              value={data.musicFolder}
              onChange={(e) => update({ musicFolder: e.target.value })}
              placeholder="C:\Usuários\você\Músicas"
              className="w-full bg-transparent text-white placeholder-white/25 outline-none text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => folderRef.current?.click()}
            className="rounded-xl px-4 py-3 text-sm font-medium bg-white/[0.06] hover:bg-white/[0.1] text-white/80 transition-colors shrink-0"
          >
            Procurar
          </button>
        </div>
        <input
          ref={folderRef}
          type="file"
          className="hidden"
          // @ts-expect-error -- atributos não padronizados para seleção de pasta
          webkitdirectory=""
          directory=""
          onChange={(e) => handleFolder(e.target.files)}
        />
      </label>

      <div className="space-y-3">
        <ToggleRow
          label="Incluir subpastas"
          hint="Busca faixas dentro de pastas aninhadas"
          checked={data.includeSubfolders}
          onChange={(v) => update({ includeSubfolders: v })}
        />
        <ToggleRow
          label="Monitorar novas faixas"
          hint="Atualiza a biblioteca automaticamente"
          checked={data.autoScan}
          onChange={(v) => update({ autoScan: v })}
        />
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
      <div>
        <div className="text-sm text-white/85">{label}</div>
        <div className="text-xs text-white/35 mt-0.5">{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
          checked ? "bg-[#2ED8A7]" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function StepPreferencias({
  data,
  update,
}: {
  data: OnboardingData;
  update: (patch: Partial<OnboardingData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold text-white"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Deixe com a sua cara
        </h2>
        <p className="text-sm text-white/40 mt-1">
          Cor de destaque, tema e formato preferido.
        </p>
      </div>

      <div>
        <span className="text-xs font-mono tracking-widest text-white/35">
          COR DE DESTAQUE
        </span>
        <div className="mt-2 flex gap-3">
          {(Object.keys(ACCENTS) as AccentKey[]).map((k) => {
            const a = ACCENTS[k];
            const active = data.accent === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => update({ accent: k })}
                className="flex flex-col items-center gap-1.5 group"
              >
                <span
                  className="h-9 w-9 rounded-full transition-transform group-hover:scale-105"
                  style={{
                    background: a.hex,
                    boxShadow: active
                      ? `0 0 0 3px #101317, 0 0 0 5px ${a.hex}`
                      : "none",
                  }}
                />
                <span
                  className={`text-[11px] ${active ? "text-white/80" : "text-white/35"}`}
                >
                  {a.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="text-xs font-mono tracking-widest text-white/35">
          FORMATO PREFERIDO
        </span>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(["flac", "mp3", "wav"] as AudioFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => update({ audioFormat: f })}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium border transition-colors uppercase ${
                data.audioFormat === f
                  ? "border-white/30 bg-white/[0.08] text-white"
                  : "border-white/[0.06] text-white/40 hover:text-white/60"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepPronto({ data }: { data: OnboardingData }) {
  const accent = ACCENTS[data.accent];
  return (
    <div className="space-y-6 text-center py-4">
      <div
        className="mx-auto h-16 w-16 rounded-full flex items-center justify-center"
        style={{
          background: `${accent.hex}22`,
          boxShadow: `0 0 0 1px ${accent.hex}44`,
        }}
      >
        <IconCheck className="h-7 w-7" style={{ color: accent.hex }} />
      </div>
      <div>
        <h2
          className="text-xl font-semibold text-white"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Tudo pronto, {data.username.trim() || "amigo"}.
        </h2>
        <p className="text-sm text-white/40 mt-1">
          Sua biblioteca em{" "}
          <span className="text-white/70">{data.musicFolder || "—"}</span> já
          pode ser escaneada.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------- wizard ------------------------------- */

export default function OnboardingWizard({
  onComplete,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(DEFAULT_DATA);

  const update = useCallback((patch: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const canAdvance =
    (step === 0 && data.username.trim().length > 0) ||
    (step === 1 && data.musicFolder.trim().length > 0) ||
    step === 2 ||
    step === 3;

  const isLast = step === STEPS.length - 1;
  const accent = ACCENTS[data.accent];

  const goNext = () => {
    if (isLast) {
      onComplete?.(data);
      return;
    }
    if (canAdvance) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  return (
    <div className="min-h-full w-full bg-[#0A0C0F] flex items-center justify-center p-4 sm:p-8">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');
      `}</style>
      <div
        className="w-full max-w-5xl rounded-[28px] border border-white/[0.06] bg-[#0D1013] overflow-hidden"
        style={{
          fontFamily: "'Inter', sans-serif",
          boxShadow: "0 40px 100px -40px rgba(0,0,0,0.8)",
        }}
      >
        {/* barra de progresso mobile */}
        <div className="lg:hidden h-1 w-full bg-white/[0.06]">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${((step + 1) / STEPS.length) * 100}%`,
              background: accent.hex,
            }}
          />
        </div>

        <div className="grid lg:grid-cols-[220px_1fr_300px]">
          {/* trilho de nível / navegação */}
          <div className="hidden lg:flex flex-col gap-1 p-5 border-r border-white/[0.06] bg-white/[0.015]">
            <div className="mb-4 px-3">
              <div
                className="text-white font-semibold text-sm tracking-wide"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                CONFIGURAÇÃO
              </div>
              <div className="text-[11px] text-white/30 mt-0.5">
                Passo {step + 1} de {STEPS.length}
              </div>
            </div>
            <LevelRail
              currentIndex={step}
              accentHex={accent.hex}
              onJump={setStep}
            />
          </div>

          {/* conteúdo do passo */}
          <div className="p-6 sm:p-10 flex flex-col">
            <div className="flex-1">
              {step === 0 && <StepPerfil data={data} update={update} />}
              {step === 1 && <StepBiblioteca data={data} update={update} />}
              {step === 2 && <StepPreferencias data={data} update={update} />}
              {step === 3 && <StepPronto data={data} />}
            </div>

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="text-sm text-white/40 hover:text-white/70 disabled:opacity-0 transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvance}
                className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-[#0A0C0F] disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:brightness-110"
                style={{ background: accent.hex }}
              >
                {isLast ? "Começar a usar" : "Continuar"}
                <IconArrow className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* preview lateral */}
          <div className="hidden lg:block p-5 border-l border-white/[0.06] bg-white/[0.015]">
            <PreviewCard data={data} />
          </div>
        </div>
      </div>
    </div>
  );
}
