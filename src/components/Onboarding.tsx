import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppStore";
import { IconCamera } from "./icons";

type AccentKey = "verde" | "ambar" | "azul";

const ACCENTS: Record<AccentKey, { label: string; hex: string }> = {
  verde: { label: "Verde Sinal", hex: "#22c55e" },
  ambar: { label: "Âmbar Vinil", hex: "#F2B84B" },
  azul: { label: "Azul Onda", hex: "#4EA1F2" },
};

const STEPS = [
  { key: "welcome", label: "Bem-vindo", ch: "CH.01" },
  { key: "library", label: "Biblioteca", ch: "CH.02" },
  { key: "prefs", label: "Perfil", ch: "CH.03" },
  { key: "ready", label: "Pronto", ch: "CH.04" },
] as const;

const TIPS = [
  "Clique com o botão direito em qualquer faixa para mais opções",
  "Arraste faixas na fila para reordená-las",
  "Confira o Audio Lab e os perfis de equalização",
  "A calibração ajusta o som ao ambiente da sala",
];

function IconCheck(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2.2} stroke="currentColor" {...p}>
      <path d="M5 12.5 10 17l9-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrow(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" {...p}>
      <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconX(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" {...p}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

function IconFolder(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" {...p}>
      <path
        d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlus(p: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" {...p}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------- medidor VU (rail) ------------------------- */

function VURail({
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
        const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "idle";
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
            <div className="flex items-end gap-[3px] h-6 shrink-0">
              {Array.from({ length: 5 }).map((_, bar) => {
                const lit = state === "done" || (state === "active" && bar <= 2);
                const h = 6 + bar * 3.5;
                return (
                  <span
                    key={bar}
                    style={{
                      height: h,
                      background: lit ? accentHex : "rgba(255,255,255,0.12)",
                      boxShadow:
                        lit && state === "active" ? `0 0 8px ${accentHex}` : "none",
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
                style={{ color: state === "idle" ? "rgba(255,255,255,0.3)" : accentHex }}
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
              <IconCheck className="ml-auto h-4 w-4 shrink-0" style={{ color: accentHex }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ branding ------------------------------ */

function BrandHeader() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-end gap-[3px] h-6">
        {[10, 18, 14, 22, 12].map((h, i) => (
          <span
            key={i}
            className="w-[4px] rounded-full bg-[var(--accentColor)]"
            style={{ height: h, boxShadow: "0 0 10px var(--accentColor)" }}
          />
        ))}
      </div>
      <div>
        <div className="text-lg font-bold tracking-wide text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          SOUND<span className="text-[var(--accentColor)]">CORE</span>
        </div>
        <div className="text-[10px] tracking-[0.3em] text-white/35">AUDIO ENGINE</div>
      </div>
    </div>
  );
}

/* ------------------------------ steps ------------------------------ */

function StepWelcome({ goNext }: { goNext: () => void }) {
  return (
    <div className="text-center">
      <BrandHeader />
      <h1
        className="mt-8 text-3xl sm:text-4xl font-bold text-white"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        Bem-vindo ao Soundcore
      </h1>
      <p className="mt-3 text-white/45 text-sm sm:text-base">
        Beleza 🎧, simplicidade 📻 e performance 🔊 para a sua biblioteca de música.
      </p>

      <div className="mt-8 flex items-end justify-center gap-[4px] h-16">
        {Array.from({ length: 24 }).map((_, i) => {
          const h = 20 + Math.abs(Math.sin(i * 0.85)) * 75;
          return (
            <span
              key={i}
              style={{
                height: `${h}%`,
                background: "var(--accentColor)",
                opacity: 0.3 + (i % 5) * 0.14,
                animationDelay: `${i * 45}ms`,
              }}
              className="w-1.5 rounded-sm animate-pulse"
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={goNext}
        className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-[#0A0C0F] transition-all hover:brightness-110"
        style={{ background: "var(--accentColor)" }}
      >
        Começar
        <IconArrow className="h-4 w-4" />
      </button>
    </div>
  );
}

function StepLibrary({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  const { addLibraryFolder, appSettings, saveAppSettings, scanning } = useApp();
  const [removing, setRemoving] = useState<string | null>(null);

  const removePath = async (path: string) => {
    setRemoving(path);
    await saveAppSettings({ libraryPaths: appSettings.libraryPaths.filter((p) => p !== path) });
    setRemoving(null);
  };

  const hasFolders = appSettings.libraryPaths.length > 0;

  return (
    <div>
      <h2
        className="text-2xl font-semibold text-white"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        Onde estão suas músicas?
      </h2>
      <p className="mt-1 text-sm text-white/40">
        Aponte a(s) pasta(s) da sua biblioteca — nós escaneamos e organizamos o resto.
      </p>

      <div className="mt-6 flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
        {appSettings.libraryPaths.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-center text-sm text-white/30">
            Nenhuma pasta adicionada ainda.
          </div>
        )}
        {appSettings.libraryPaths.map((path) => (
          <div
            key={path}
            className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.07] px-4 py-2.5"
          >
            <IconFolder className="h-4 w-4 shrink-0 text-white/40" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-white/85">{path.replace(/(.*)[/\\]/, "")}</div>
              <div className="truncate text-[11px] text-white/30">{path}</div>
            </div>
            <button
              type="button"
              disabled={removing === path}
              onClick={() => removePath(path)}
              className="rounded-lg p-1.5 text-white/30 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
              title="Remover pasta"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={addLibraryFolder}
          disabled={scanning}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white/85 bg-white/[0.06] hover:bg-white/[0.1] transition-colors disabled:opacity-50"
        >
          {scanning ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          ) : (
            <IconPlus className="h-4 w-4" />
          )}
          {scanning ? "Escaneando..." : "Adicionar pasta"}
        </button>
        <button
          type="button"
          onClick={onNext}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[#0A0C0F] transition-all hover:brightness-110 ${
            hasFolders ? "" : "opacity-40"
          }`}
          style={{ background: "var(--accentColor)" }}
        >
          Continuar
          <IconArrow className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="mt-3 text-xs text-white/30 hover:text-white/60 transition-colors"
      >
        Pular por enquanto
      </button>
    </div>
  );
}

function StepPrefs() {
  const { appSettings, saveAppSettings } = useApp();
  const accentKey: AccentKey =
    (Object.entries(ACCENTS).find(([, a]) => a.hex === appSettings.accent)?.[0] as AccentKey) ?? "verde";
  const fileRef = useRef<HTMLInputElement>(null);

  const setAccent = (hex: string) => saveAppSettings({ accent: hex });

  const setTheme = (theme: string) => saveAppSettings({ theme });

  const setUsername = (username: string) => saveAppSettings({ username });

  const handleAvatarFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => saveAppSettings({ avatar: reader.result as string });
      reader.readAsDataURL(file);
    },
    [saveAppSettings],
  );

  const initial = (appSettings.username || "?").trim().charAt(0).toUpperCase();

  return (
    <div>
      <h2
        className="text-2xl font-semibold text-white"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        Este é o seu perfil
      </h2>
      <p className="mt-1 text-sm text-white/40">
        Foto, nome e cor de destaque — tudo guardado neste dispositivo, sem contas nem nuvem.
      </p>

      <div className="mt-6 space-y-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="onboard-avatar-btn"
          >
            {appSettings.avatar ? (
              <img src={appSettings.avatar} alt="Sua foto" />
            ) : (
              <>
                <span className="onboard-avatar-fallback">{initial}</span>
                <span className="onboard-avatar-hint">
                  <IconCamera size={16} />
                </span>
              </>
            )}
          </button>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-sm font-medium text-white/80 hover:text-white transition-colors underline decoration-white/20 underline-offset-4"
            >
              {appSettings.avatar ? "Trocar foto" : "Adicionar foto de perfil"}
            </button>
            <p className="text-xs text-white/30 mt-1">PNG ou JPG · fica só no seu computador</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleAvatarFile(e.target.files?.[0])}
          />
        </div>

        <div>
          <span className="text-xs font-mono tracking-widest text-white/35">COR DE DESTAQUE</span>
          <div className="mt-2 flex gap-3">
            {(Object.keys(ACCENTS) as AccentKey[]).map((k) => {
              const a = ACCENTS[k];
              const active = k === accentKey;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAccent(a.hex)}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <span
                    className="h-9 w-9 rounded-full transition-transform group-hover:scale-105"
                    style={{
                      background: a.hex,
                      boxShadow: active ? `0 0 0 3px #101317, 0 0 0 5px ${a.hex}` : "none",
                    }}
                  />
                  <span className={`text-[11px] ${active ? "text-white/80" : "text-white/35"}`}>
                    {a.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="text-xs font-mono tracking-widest text-white/35">TEMA</span>
          <div className="mt-2 flex gap-2">
            {(["dark", "light"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium border transition-colors capitalize ${
                  appSettings.theme === t
                    ? "border-white/30 bg-white/[0.08] text-white"
                    : "border-white/[0.06] text-white/40 hover:text-white/60"
                }`}
              >
                {t === "dark" ? "Escuro" : "Claro"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-xs font-mono tracking-widest text-white/35">NOME DE USUÁRIO</span>
          <input
            value={appSettings.username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ex: aquilesgoncalves"
            className="mt-2 w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 text-white placeholder-white/25 outline-none focus:border-white/25 focus:ring-2 focus:ring-white/10 transition-all"
          />
        </div>
      </div>
    </div>
  );
}

function StepReady({ data, onDone }: { data: { username: string; folders: number }; onDone: () => void }) {
  const [tip, setTip] = useState(0);
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accentColor").trim() || "#22c55e";

  useEffect(() => {
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-center">
      <div
        className="mx-auto h-16 w-16 rounded-full flex items-center justify-center"
        style={{ background: `${accent}22`, boxShadow: `0 0 0 1px ${accent}44` }}
      >
        <IconCheck className="h-7 w-7" style={{ color: accent }} />
      </div>
      <h2
        className="mt-5 text-2xl font-semibold text-white"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        Tudo pronto, {data.username.trim() || "amigo"}.
      </h2>
      <p className="mt-1 text-sm text-white/40">
        {data.folders > 0
          ? `${data.folders} pasta(s) de música configurada(s).`
          : "Você pode adicionar pastas de música depois em Configurações."}
      </p>

      <div className="mt-8 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 inline-flex items-center gap-2 text-sm text-white/60">
        <span className="text-[var(--accentColor)]">💡</span>
        <span key={tip} className="animate-[fadeIn_0.4s_var(--ease-flb)]">
          {TIPS[tip]}
        </span>
      </div>

      <button
        type="button"
        onClick={onDone}
        className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-[#0A0C0F] transition-all hover:brightness-110"
        style={{ background: "var(--accentColor)" }}
      >
        Começar a usar
        <IconArrow className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ------------------------------- wizard ------------------------------- */

export default function Onboarding({ onDone }: { onDone?: () => void }) {
  const { appSettings, saveAppSettings, library } = useApp();
  const [step, setStep] = useState(0);
  const accentHex = appSettings.accent || "#22c55e";

  const finish = useCallback(async () => {
    await saveAppSettings({ onboarded: true });
    onDone?.();
  }, [saveAppSettings, onDone]);

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  const goNext = () => {
    if (step >= STEPS.length - 1) {
      finish();
      return;
    }
    setStep((s) => s + 1);
  };

  const canAdvance =
    step === 0 ||
    step === 1 ||
    step === 2 ||
    step === 3;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8"
      style={{
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className="relative w-full max-w-4xl rounded-[28px] border border-white/[0.07] overflow-hidden"
        style={{
          background: "rgba(13,16,19,0.82)",
          boxShadow: "0 40px 100px -40px rgba(0,0,0,0.9)",
          fontFamily: "'Roboto', system-ui, sans-serif",
        }}
      >
        {/* barra de progresso mobile */}
        <div className="lg:hidden h-1 w-full bg-white/[0.06]">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: accentHex }}
          />
        </div>

        <div className="grid lg:grid-cols-[220px_1fr]">
          {/* trilho */}
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
            <VURail currentIndex={step} accentHex={accentHex} onJump={setStep} />
            <div className="mt-auto px-3 pt-4">
              <div className="text-[11px] text-white/25">
                {library.length} faixas na biblioteca
              </div>
            </div>
          </div>

          {/* conteúdo */}
          <div className="p-6 sm:p-10 flex flex-col">
            <div className="flex-1" key={step}>
              {step === 0 && <StepWelcome goNext={goNext} />}
              {step === 1 && <StepLibrary onNext={goNext} onSkip={skip} />}
              {step === 2 && <StepPrefs />}
              {step === 3 && (
                <StepReady
                  data={{ username: appSettings.username, folders: appSettings.libraryPaths.length }}
                  onDone={goNext}
                />
              )}
            </div>

            {step > 0 && step < 3 && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  className="text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  Voltar
                </button>
                {step === 2 && (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canAdvance}
                    className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-[#0A0C0F] transition-all hover:brightness-110"
                    style={{ background: "var(--accentColor)" }}
                  >
                    Continuar
                    <IconArrow className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}