import { useCallback, useState, type ReactNode } from "react";
import { useT } from "./store";

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const t = useT();
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn ghost small" onClick={onClose}>{t("common.close")}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <p style={{ fontSize: 17, margin: "0 0 6px", color: "var(--text)" }}>{title}</p>
      {hint && <p style={{ margin: "0 0 14px" }}>{hint}</p>}
      {action}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<{ id: number; text: string; error?: boolean }[]>([]);
  const push = useCallback((text: string, error = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, error }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  const view = (
    <div className="toast">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-item${t.error ? " error" : ""}`}>{t.text}</div>
      ))}
    </div>
  );
  return { push, view };
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}

export function Confirm({ title, text, onOk, onCancel, okLabel }: { title?: string; text: string; onOk: () => void; onCancel: () => void; okLabel?: string }) {
  const t = useT();
  return (
    <Modal title={title ?? t("common.confirmTitle")} onClose={onCancel}>
      <p>{text}</p>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn ghost" onClick={onCancel}>{t("common.cancel")}</button>
        <button className="btn danger solid" onClick={onOk}>{okLabel ?? t("common.confirm")}</button>
      </div>
    </Modal>
  );
}

export function Progress({ value, max }: { value: number; max?: number }) {
  const pct = max && max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress" title={`${pct} %`}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Switch({ checked, onChange, label, iconOn, iconOff }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  iconOn?: ReactNode;
  iconOff?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      className={`switch${checked ? " on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob">{checked ? iconOn : iconOff}</span>
    </button>
  );
}
