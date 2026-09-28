"use client";

import { useEffect, useRef } from "react";

export default function AdminConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  const actionRef = useRef({ busy, onCancel });

  useEffect(() => {
    actionRef.current = { busy, onCancel };
  }, [busy, onCancel]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !actionRef.current.busy) actionRef.current.onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    cancelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="admin-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title" aria-describedby="admin-confirm-message" onMouseDown={(event) => event.stopPropagation()}>
        <p className="eyebrow">Confirm action</p>
        <h2 id="admin-confirm-title">{title}</h2>
        <p id="admin-confirm-message">{message}</p>
        <div className="admin-modal-actions">
          <button ref={cancelRef} type="button" className="button button-outline" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="button button-danger" onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
