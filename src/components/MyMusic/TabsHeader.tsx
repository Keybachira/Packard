import { useEffect, useRef, useState } from "react";
import { IconCheck, IconSearch, IconSort, IconX } from "../icons";

export type SortKey = "title" | "artist" | "album" | "date";

interface Props {
  search: string;
  onSearch: (v: string) => void;
  sort: SortKey;
  onSort: (k: SortKey) => void;
  multiSelect: boolean;
  onToggleMultiSelect: () => void;
  selectedCount: number;
  onClearSelection: () => void;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Ordem de adição" },
  { key: "title", label: "Título" },
  { key: "artist", label: "Artista" },
  { key: "album", label: "Álbum" },
];

export default function TabsHeader({
  search,
  onSearch,
  sort,
  onSort,
  multiSelect,
  onToggleMultiSelect,
  selectedCount,
  onClearSelection,
}: Props) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  const activeLabel = SORT_OPTIONS.find((o) => o.key === sort)?.label ?? "";

  return (
    <div className="tabs-pane-header">
      <div className="tabs-search">
        <IconSearch size={16} />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Pesquisar na sua biblioteca…"
        />
        {search && (
          <button
            className="tabs-search-clear"
            onClick={() => onSearch("")}
            title="Limpar"
          >
            <IconX size={14} />
          </button>
        )}
      </div>

      <div className="tabs-sort" ref={sortRef}>
        <button className="tabs-sort-toggle" onClick={() => setSortOpen((o) => !o)}>
          <IconSort size={15} />
          {activeLabel}
        </button>
        {sortOpen && (
          <div className="tabs-sort-menu">
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.key}
                className={`tabs-sort-option${sort === o.key ? " active" : ""}`}
                onClick={() => {
                  onSort(o.key);
                  setSortOpen(false);
                }}
              >
                {o.label}
                {sort === o.key && <IconCheck size={14} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {multiSelect ? (
        <button
          className="tabs-select-btn on"
          onClick={onClearSelection}
        >
          <IconX size={14} />
          Cancelar ({selectedCount})
        </button>
      ) : (
        <button className="tabs-select-btn" onClick={onToggleMultiSelect}>
          <IconCheck size={14} />
          Selecionar
        </button>
      )}
    </div>
  );
}