import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { genieClose, genieOpen, takeOrigin } from "../lib/genie";

/**
 * A modal panel that adapts to the screen:
 *
 *  - Desktop: slides in from the right, 75% of the viewport wide.
 *  - Phones/tablets: a bottom sheet. Drag its handle to resize it between half
 *    and nearly full height; drag it down past a third to close.
 *
 * Either way: Escape and the backdrop close it, focus is trapped inside while
 * open and handed back to the trigger on close, and the page behind stops
 * scrolling. Sits above the chat launcher but below the toast viewport.
 */
interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name, and the visible heading in the drawer's top bar. */
  title: React.ReactNode;
  /** Small label above the title. */
  eyebrow?: React.ReactNode;
  /** Starting height of the mobile sheet, as a % of the viewport. */
  mobileHeight?: number;
  children: React.ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Resting heights for the mobile sheet (% of viewport height). */
const SNAPS = [52, 92];
const CLOSE_BELOW = 30;

const SideDrawer: React.FC<SideDrawerProps> = ({ open, onClose, title, eyebrow, mobileHeight = 88, children }) => {
  const isDesktop = useIsDesktop();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [height, setHeight] = useState(mobileHeight);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startY: number; startHeight: number; startT: number } | null>(null);

  useEffect(() => {
    if (open) setHeight(mobileHeight);
  }, [open, mobileHeight]);

  /* ── Genie: pour out of the clicked element, and back into it on close.
     While closing, the drawer stays mounted showing its last content. */
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  const origin = useRef<DOMRect | null>(null);
  const lastContent = useRef({ title, eyebrow, children });
  if (open) lastContent.current = { title, eyebrow, children };

  useLayoutEffect(() => {
    if (!open) return;
    setRendered(true);
    setClosing(false);
    origin.current = takeOrigin();
  }, [open]);

  useLayoutEffect(() => {
    if (open && rendered && !closing) genieOpen(panelRef.current, origin.current);
    // Only on the transition into the open state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rendered]);

  useEffect(() => {
    if (open || !rendered) return;
    let cancelled = false;
    setClosing(true);
    genieClose(panelRef.current, origin.current).then(() => {
      if (cancelled) return;
      setRendered(false);
      setClosing(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const returnFocusTo = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.dataset.drawer = "open";
    panelRef.current?.focus({ preventScroll: true });

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
      delete document.body.dataset.drawer;
      returnFocusTo?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open && !rendered) return null;
  const shown = open ? { title, eyebrow, children } : lastContent.current;

  /* ── mobile sheet drag ── */
  const onPointerDown = (event: React.PointerEvent) => {
    if (isDesktop || (event.pointerType === "mouse" && event.button !== 0)) return;
    if ((event.target as HTMLElement).closest("button, a")) return;
    drag.current = { startY: event.clientY, startHeight: height, startT: performance.now() };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current) return;
    const delta = ((drag.current.startY - event.clientY) / window.innerHeight) * 100;
    setHeight(Math.max(10, Math.min(96, drag.current.startHeight + delta)));
  };
  const onPointerUp = (event: React.PointerEvent) => {
    const start = drag.current;
    drag.current = null;
    setDragging(false);
    if (!start) return;
    const velocity = (start.startY - event.clientY) / Math.max(1, performance.now() - start.startT); // px/ms, + = up
    if (height < CLOSE_BELOW || velocity < -0.8) {
      onCloseRef.current();
      return;
    }
    if (velocity > 0.5) return setHeight(SNAPS[SNAPS.length - 1]);
    if (velocity < -0.5) return setHeight(SNAPS[0]);
    setHeight(SNAPS.reduce((best, snap) => (Math.abs(snap - height) < Math.abs(best - height) ? snap : best)));
  };

  const sheetStyle: React.CSSProperties | undefined = isDesktop
    ? undefined
    : { height: `${height}dvh`, transition: dragging ? "none" : "height .3s cubic-bezier(.32,.72,0,1)" };

  return createPortal(
    <div
      className={`fixed inset-0 flex ${isDesktop ? "justify-end" : "items-end"} ${closing ? "pointer-events-none" : ""}`}
      style={{ zIndex: 2147481000 }}
    >
      <div
        aria-hidden="true"
        className="sd-backdrop absolute inset-0 bg-slate-950/55 backdrop-blur-[2px] transition-opacity duration-300"
        style={{ opacity: closing ? 0 : 1 }}
        onMouseDown={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={sheetStyle}
        className={`relative flex flex-col bg-[color:var(--color-bg)] shadow-2xl focus:outline-none ${
          isDesktop ? "sd-panel h-full w-[75vw]" : "sd-sheet w-full overflow-hidden rounded-t-[22px]"
        }`}
      >
        <div
          className={`flex shrink-0 items-center gap-3 border-b border-[color:var(--site-border)] bg-[color:var(--site-surface)] ${
            isDesktop ? "px-8 py-4" : "relative touch-none px-4 pb-3 pt-5"
          }`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {!isDesktop && (
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-2 h-[5px] w-10 -translate-x-1/2 rounded-full bg-[color:var(--site-border)]"
            />
          )}
          <div className="min-w-0 flex-1">
            {shown.eyebrow && (
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[color:var(--site-muted)]">{shown.eyebrow}</p>
            )}
            <h2
              id={titleId}
              className="truncate text-base font-bold text-[color:var(--site-heading)] md:text-lg"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {shown.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--site-surface-alt)] text-[color:var(--site-muted)] transition hover:text-[color:var(--site-heading)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{shown.children}</div>
      </div>

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .sd-backdrop { animation: sd-fade .2s ease-out; }
          .sd-panel { animation: sd-slide .28s cubic-bezier(.22,.8,.3,1); }
          .sd-sheet { animation: sd-rise .32s cubic-bezier(.32,.72,0,1); }
        }
        @keyframes sd-fade { from { opacity: 0 } }
        @keyframes sd-slide { from { transform: translateX(100%) } }
        @keyframes sd-rise { from { transform: translateY(100%) } }
        body[data-drawer] .chat-launcher { opacity: 0; pointer-events: none; }
      `}</style>
    </div>,
    document.body,
  );
};

export default SideDrawer;
