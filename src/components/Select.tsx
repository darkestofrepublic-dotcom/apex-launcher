import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useT } from "./store";
import { IconChevron, IconSearch, IconCheck } from "./icons";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  width?: number | string;
  label?: string;
}

/** Liste déroulante personnalisée (remplace les <select> natifs dans toute l'interface). */
export default function Select({ value, options, onChange, placeholder, searchable, disabled, width, label }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const visible = query.trim()
    ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  // Positionnement intelligent : la liste s'ancre au bouton en position fixe
  // (jamais rognée par les conteneurs à défilement) et s'ouvre vers le haut
  // quand la place manque en dessous.
  const [popStyle, setPopStyle] = useState<CSSProperties>({});
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const btn = ref.current?.querySelector(".cselect-btn");
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const estimated = Math.min(300, 70 + visible.length * 44);
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      const up = spaceBelow < estimated && spaceAbove > spaceBelow;
      setPopStyle({
        position: "fixed",
        left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 200) - 8)),
        width: Math.max(r.width, 200),
        ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, visible.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      // La liste est un enfant du conteneur : un clic dedans ne ferme pas.
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div ref={ref} className="cselect" style={{ width }}>
      {label && <span className="cselect-label">{label}</span>}
      <button
        type="button"
        className="cselect-btn"
        disabled={disabled}
        onClick={() => {
          setQuery("");
          setOpen((o) => !o);
        }}
      >
        <span className="cselect-value">{selected ? selected.label : (placeholder ?? "—")}</span>
        <IconChevron />
      </button>
      {open && (
        <div className="cselect-pop" style={popStyle}>
          {searchable && options.length > 6 && (
            <div className="cselect-search">
              <IconSearch />
              <input autoFocus placeholder={t("common.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          )}
          <div className="cselect-list">
            {!visible.length && <div className="cselect-empty">{t("content.noResults")}</div>}
            {visible.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`cselect-item${o.value === value ? " selected" : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span style={{ flex: 1 }}>
                  <span className="cselect-item-label">{o.label}</span>
                  {o.hint && <span className="cselect-item-hint">{o.hint}</span>}
                </span>
                {o.value === value && <IconCheck />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
