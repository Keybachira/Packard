import type { PresetName } from "../types/audio";
import { makePreset } from "../types/audio";

const PRESET_NAMES: PresetName[] = ["FLAT", "CINEMA", "MUSIC", "GAME"];

interface Props {
  active: PresetName;
  onSelect: (name: PresetName) => void;
  disabled?: boolean;
}

export default function PresetBar({ active, onSelect, disabled }: Props) {
  return (
    <div className="flex gap-2">
      {PRESET_NAMES.map((name) => {
        const preset = makePreset(name);
        const isActive = active === name;
        return (
          <button
            key={name}
            onClick={() => onSelect(name)}
            disabled={disabled}
            className={`rounded-lg border px-4 py-2 text-xs font-semibold tracking-wider transition-colors ${
              isActive
                ? "border-accent bg-accent text-black"
                : "border-border bg-surface-2 text-text-dim hover:text-text"
            }`}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
