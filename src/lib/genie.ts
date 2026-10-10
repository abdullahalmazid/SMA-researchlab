/**
 * A macOS-style "genie" effect: a panel pours out of the thing you clicked —
 * starting at that element's size and position, pinched into a funnel on the
 * side facing it — and pours back into it when closed.
 *
 * The click origin is recorded globally (capture phase, so it runs before any
 * React handler opens a panel). A panel that opens shortly after a click picks
 * it up with takeOrigin(). Keyboard activation fires `click` too, so it works
 * from the keyboard as well.
 */

let lastOrigin: { rect: DOMRect; at: number } | null = null;

if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    (event) => {
      const element = (event.target as Element | null)?.closest?.("a, button, [role=button], article, li");
      if (element) lastOrigin = { rect: element.getBoundingClientRect(), at: performance.now() };
    },
    true,
  );
}

/** The rect of the element clicked in the last moment, consumed once. */
export const takeOrigin = (maxAgeMs = 1500): DOMRect | null => {
  const origin = lastOrigin;
  lastOrigin = null;
  return origin && performance.now() - origin.at < maxAgeMs ? origin.rect : null;
};

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Keyframes from the origin rect (progress 0) to the panel's own box (1). */
const frames = (panel: DOMRect, origin: DOMRect) => {
  const dx = origin.left + origin.width / 2 - (panel.left + panel.width / 2);
  const dy = origin.top + origin.height / 2 - (panel.top + panel.height / 2);
  const sx = Math.min(1, Math.max(0.05, origin.width / panel.width));
  const sy = Math.min(1, Math.max(0.05, origin.height / panel.height));
  const horizontal = Math.abs(dx) / panel.width >= Math.abs(dy) / panel.height;

  /* The funnel: the edge facing the origin is pinched by `pinch`% from each end. */
  const funnel = (pinch: number) => {
    const a = pinch;
    const b = 100 - pinch;
    if (horizontal) {
      return dx < 0
        ? `polygon(0% ${a}%, 100% 0%, 100% 100%, 0% ${b}%)`
        : `polygon(0% 0%, 100% ${a}%, 100% ${b}%, 0% 100%)`;
    }
    return dy < 0
      ? `polygon(${a}% 0%, ${b}% 0%, 100% 100%, 0% 100%)`
      : `polygon(0% 0%, 100% 0%, ${b}% 100%, ${a}% 100%)`;
  };

  return [
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, clipPath: funnel(44), opacity: 0.25, offset: 0 },
    {
      transform: `translate(${dx * 0.42}px, ${dy * 0.42}px) scale(${sx + (1 - sx) * (horizontal ? 0.45 : 0.75)}, ${
        sy + (1 - sy) * (horizontal ? 0.75 : 0.45)
      })`,
      clipPath: funnel(26),
      opacity: 0.85,
      offset: 0.42,
    },
    { transform: "none", clipPath: funnel(0), opacity: 1, offset: 1 },
  ];
};

/** Pours `element` out of `origin`. Returns false when it didn't animate. */
export const genieOpen = (element: HTMLElement | null, origin: DOMRect | null): boolean => {
  if (!element || !origin || !element.animate || reducedMotion()) return false;
  const panel = element.getBoundingClientRect();
  if (!panel.width || !panel.height) return false;
  element.animate(frames(panel, origin), { duration: 560, easing: "cubic-bezier(.22,.8,.22,1)" });
  return true;
};

/** Pours `element` back into `origin`; resolves when done (immediately if it can't animate). */
export const genieClose = (element: HTMLElement | null, origin: DOMRect | null): Promise<void> => {
  if (!element || !origin || !element.animate || reducedMotion()) return Promise.resolve();
  const panel = element.getBoundingClientRect();
  if (!panel.width || !panel.height) return Promise.resolve();
  const animation = element.animate([...frames(panel, origin)].reverse().map((frame, i, all) => ({ ...frame, offset: i === 1 ? 0.58 : i / (all.length - 1) })), {
    duration: 420,
    easing: "cubic-bezier(.55,0,.75,.2)",
    fill: "forwards",
  });
  return animation.finished.then(
    () => undefined,
    () => undefined,
  );
};
