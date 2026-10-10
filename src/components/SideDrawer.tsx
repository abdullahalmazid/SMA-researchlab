import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Right-hand drawer: full width on small screens, 75% of the viewport on large
 * ones. A modal dialog — Escape and the backdrop close it, focus is trapped
 * inside while open and handed back to the trigger on close, and the page
 * behind stops scrolling.
 *
 * Sits above the chat launcher but below the toast viewport, so a form inside
 * can still raise toasts that are visible.
 */
interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name, and the visible heading in the drawer's top bar. */
  title: React.ReactNode;
  /** Small label above the title. */
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SideDrawer: React.FC<SideDrawerProps> = ({ open, onClose, title, eyebrow, children }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const returnFocusTo = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null,
      );
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusTo?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 flex justify-end" style={{ zIndex: 2147481000 }}>
      <div
        aria-hidden="true"
        className="sd-backdrop absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onMouseDown={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="sd-panel relative flex h-full w-full flex-col bg-slate-50 shadow-2xl focus:outline-none lg:w-[75vw]"
      >
        <div className="flex shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-5 py-4 md:px-8">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</p>
            )}
            <h2
              id={titleId}
              className="truncate text-base font-bold text-slate-900 md:text-lg"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .sd-backdrop { animation: sd-fade .2s ease-out; }
          .sd-panel { animation: sd-slide .28s cubic-bezier(.22,.8,.3,1); }
        }
        @keyframes sd-fade { from { opacity: 0 } }
        @keyframes sd-slide { from { transform: translateX(100%) } }
      `}</style>
    </div>,
    document.body,
  );
};

export default SideDrawer;
