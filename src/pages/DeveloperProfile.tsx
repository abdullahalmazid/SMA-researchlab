import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";

/* ══════════════════════════════════════════════════════
 * CONFIG
 * ══════════════════════════════════════════════════════ */

/** Fallback when there is no history to go back to. */
const HOME_URL = "/";
/** Your photo. Anything square-ish works; it gets mirrored and cooled. */
const PORTRAIT = "https://i.pravatar.cc/500?img=68";
/** Must equal the `perspective` value on .rp-viewport in the stylesheet. */
const EYE = 900;

/* Rope simulation. REST is the hanging length; K is spring stiffness and
   DAMP the energy retained per frame — 0.965 gives a long, lazy swing. */
const ROPE = { anchorX: 120, rest: 78, k: 0.045, damp: 0.965, maxLen: 155, pullToFire: 38 };

const SKILLS: [string, number][] = [
  ["SAM internals & fine-tuning", 9],
  ["Transformer architecture", 9],
  ["LoRA / ConvLoRA / VPT", 9],
  ["PyTorch model engineering", 8],
  ["Full-stack & deployment", 8],
  ["ESP32 & IoT data systems", 8],
  ["Federated learning", 7],
];

const PROJECTS: [string, string, string][] = [
  [
    "SAM fine-tuning research",
    "How far can a frozen backbone go on adapters alone? ConvLoRA, visual prompt tuning, U-Net prompt generation, and an RL loop for prompt selection.",
    "SAM · CONVLORA · VPT · RL",
  ],
  [
    "Distributed sensor network",
    "Ten-plus ESP32 nodes streaming to a server, written to MySQL with CSV fallback. Built assuming the connection drops, not that it holds.",
    "ESP32 · MYSQL · TELEMETRY",
  ],
  [
    "Operations dashboard",
    "Sidebar-driven data UI over Flask and PHP. The API contract was designed before any screen was drawn.",
    "REACT · FLASK · API DESIGN",
  ],
];

const TURNS: [string, number][] = [
  ["WHO", 0],
  ["SKILLS", -90],
  ["WORK", 180],
  ["DOOR", 90],
];

const LIMITS = { outside: [-3400, -1400], inside: [-460, 360] } as const;
const ISO = { rotY: -38, rotX: -26, zoom: -2650 };

/* ══════════════════════════════════════════════════════
 * Decorative bits — deterministic so they don't reshuffle on re-render
 * ══════════════════════════════════════════════════════ */

const Drips: React.FC<{ count: number }> = ({ count }) => (
  <span className="rp-drips">
    {Array.from({ length: count }, (_, i) => (
      <i
        key={i}
        style={{
          left: `${((i * 137.5) % 96) + 1}%`,
          height: `${24 + ((i * 53) % 110)}px`,
          transitionDelay: `${(1 + (i % 7) * 0.14).toFixed(2)}s`,
        }}
      />
    ))}
  </span>
);

const Scratches: React.FC<{ seed: number }> = ({ seed }) => (
  <>
    {Array.from({ length: 9 }, (_, i) => (
      <div
        key={i}
        className="rp-scratch"
        style={{
          left: `${(i * 151 + seed * 67) % 90}%`,
          top: `${(i * 211 + seed * 97) % 88}%`,
          width: `${30 + ((i * 47) % 180)}px`,
          transform: `rotate(${-60 + ((i * 97) % 120)}deg)`,
        }}
      />
    ))}
  </>
);

/* ══════════════════════════════════════════════════════
 * Component
 * ══════════════════════════════════════════════════════ */

const DeveloperProfile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<HTMLDivElement>(null);
  const ropePathRef = useRef<SVGPathElement>(null);
  const knobRef = useRef<HTMLButtonElement>(null);

  const [lit, setLit] = useState(false);
  const [flicker, setFlicker] = useState(false);
  const [inside, setInside] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [whiteout, setWhiteout] = useState(false);
  const [looked, setLooked] = useState(false);
  const [facing, setFacing] = useState(0);

  /* Camera and rope live in refs — they update every frame and must never
     trigger a React render. */
  const cam = useRef({
    rotY: ISO.rotY, rotX: ISO.rotX, zoom: ISO.zoom,
    tY: ISO.rotY, tX: ISO.rotX, tZoom: ISO.zoom,
    velY: 0, flying: false, mode: "outside" as "outside" | "inside",
  });
  const rope = useRef({
    x: 0, y: ROPE.rest, vx: 0, vy: 0,
    dragging: false, grabX: 0, grabY: 0, fromX: 0, fromY: 0, peak: 0, moved: 0,
  });
  const litRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };

  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── page takeover: escape the app layout, stop the body scrolling ──
     The route renders inside your Navbar/Footer wrapper, so position:fixed
     alone still leaves the footer as a competing sibling. */
  useEffect(() => {
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevOverscroll = body.style.overscrollBehavior;
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      body.style.overflow = prevOverflow;
      body.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  const clampZoom = useCallback((v: number) => {
    const [lo, hi] = LIMITS[cam.current.mode];
    return Math.max(lo, Math.min(hi, v));
  }, []);

  const apply = useCallback(() => {
    const c = cam.current;
    if (roomRef.current) {
      roomRef.current.style.transform =
        `translateZ(${(EYE + c.zoom).toFixed(1)}px) translateY(140px) ` +
        `rotateX(${c.rotX.toFixed(2)}deg) rotateY(${c.rotY.toFixed(2)}deg)`;
    }
    // Specular tracks the camera, so the highlight slides across the glass as
    // you turn. That motion is what reads as a mirror rather than a picture.
    const spec = 50 + Math.sin((c.rotY * Math.PI) / 180) * 46;
    rootRef.current?.style.setProperty("--rp-spec", `${spec.toFixed(1)}%`);
  }, []);

  /* ── light ───────────────────────────────────────── */
  const lightUp = useCallback(() => {
    if (litRef.current) return;
    litRef.current = true;
    setLit(true);
  }, []);

  const toggleLight = useCallback(() => {
    if (litRef.current) {
      litRef.current = false;
      setLit(false);
      setFlicker(false);
      return;
    }
    if (reduce) return lightUp();
    let n = 0;
    const flick = () => {
      n += 1;
      setFlicker(n % 2 === 0);
      if (n < 9) later(flick, 55 + Math.random() * 130);
      else { setFlicker(false); lightUp(); }
    };
    later(flick, 60);
  }, [lightUp, reduce]);

  /* ── render loop: camera + rope ──────────────────── */
  useEffect(() => {
    let raf = 0;
    const dragging = { on: false };

    const drawRope = (t: number) => {
      const r = rope.current;

      if (!r.dragging) {
        // Spring back toward the rest point, losing a little energy each frame.
        r.vx += -r.x * ROPE.k;
        r.vy += (ROPE.rest - r.y) * ROPE.k;
        r.vx *= ROPE.damp;
        r.vy *= ROPE.damp;
        // A whisper of drift so the rope is never perfectly still.
        r.vx += Math.sin(t / 1700) * 0.006;
        r.x += r.vx;
        r.y += r.vy;
      }

      const ax = ROPE.anchorX;
      const ex = ax + r.x;
      const ey = r.y;
      const dist = Math.hypot(r.x, r.y);
      // Slack rope sags; a taut rope straightens. That relationship is the
      // whole trick — a fixed curve reads as a drawn line, not a rope.
      const sag = Math.max(0, ROPE.rest - dist) * 0.85 + 9;
      const cx = ax + r.x * 0.42;
      const cy = ey * 0.5 + sag;

      ropePathRef.current?.setAttribute("d", `M${ax} 0 Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);

      if (knobRef.current) {
        const angle = (Math.atan2(ex - cx, ey - cy) * 180) / Math.PI;
        knobRef.current.style.transform =
          `translate(${(ex - ax).toFixed(1)}px, ${ey.toFixed(1)}px) rotate(${(-angle).toFixed(1)}deg)`;
      }
    };

    const loop = (t: number) => {
      const c = cam.current;
      if (!c.flying) {
        if (!dragging.on) {
          c.tY += c.velY;
          c.velY *= 0.93;
          if (Math.abs(c.velY) < 0.01) c.velY = 0;
        }
        c.rotY += (c.tY - c.rotY) * 0.11;
        c.rotX += (c.tX - c.rotX) * 0.11;
        c.zoom += (c.tZoom - c.zoom) * 0.1;
        apply();
      }

      if (!reduce) drawRope(t);

      const cur = ((c.rotY % 360) + 360) % 360;
      let best = 0, bestD = 999;
      TURNS.forEach(([, deg]) => {
        const want = ((deg % 360) + 360) % 360;
        const d = Math.abs(((((want - cur) % 360) + 540) % 360) - 180);
        if (d < bestD) { bestD = d; best = deg; }
      });
      setFacing((f) => (f === best ? f : best));

      raf = requestAnimationFrame(loop);
    };

    apply();
    if (reduce) {
      ropePathRef.current?.setAttribute("d", `M${ROPE.anchorX} 0 Q${ROPE.anchorX} ${ROPE.rest / 2} ${ROPE.anchorX} ${ROPE.rest}`);
      knobRef.current?.style.setProperty("transform", `translate(0px, ${ROPE.rest}px)`);
    }
    raf = requestAnimationFrame(loop);

    /* ── camera drag ── */
    const vp = viewportRef.current!;
    let lastX = 0, lastY = 0;
    const pts = new Map<number, PointerEvent>();
    let pinchStart = 0, pinchZoom = 0;

    const onDown = (e: PointerEvent) => {
      pts.set(e.pointerId, e);
      const t = e.target as HTMLElement;
      if (cam.current.flying || t.closest(".rp-lamp,.rp-hud,button,a")) return;
      dragging.on = true;
      lastX = e.clientX; lastY = e.clientY;
      cam.current.velY = 0;
      vp.classList.add("rp-dragging");
      vp.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, e);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (!pinchStart) { pinchStart = d; pinchZoom = cam.current.tZoom; dragging.on = false; }
        else cam.current.tZoom = clampZoom(pinchZoom + (d - pinchStart) * 2.2);
        return;
      }
      if (!dragging.on) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      cam.current.tY += dx * 0.2;
      cam.current.velY = dx * 0.2;
      cam.current.tX = Math.max(-34, Math.min(34, cam.current.tX - dy * 0.13));
      if (Math.abs(dx) > 6) setLooked(true);
    };

    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinchStart = 0;
      if (!dragging.on) return;
      dragging.on = false;
      vp.classList.remove("rp-dragging");
      try { vp.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    };

    /* Wheel must be native and non-passive — React's onWheel cannot
       preventDefault, so the page would scroll behind the room. */
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (cam.current.flying) return;
      // Line-mode wheels report ~3, pixel-mode ~100. Unnormalised, the same
      // gesture zooms at wildly different rates per browser.
      const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
      cam.current.tZoom = clampZoom(cam.current.tZoom - e.deltaY * unit * 0.55);
    };

    const onKey = (e: KeyboardEvent) => {
      const c = cam.current;
      if (e.key === "ArrowLeft")  { c.tY += 12; e.preventDefault(); }
      if (e.key === "ArrowRight") { c.tY -= 12; e.preventDefault(); }
      if (e.key === "ArrowUp")    { c.tX = Math.min(34, c.tX + 6); e.preventDefault(); }
      if (e.key === "ArrowDown")  { c.tX = Math.max(-34, c.tX - 6); e.preventDefault(); }
      if (e.key === "+" || e.key === "=") c.tZoom = clampZoom(c.tZoom + 130);
      if (e.key === "-" || e.key === "_") c.tZoom = clampZoom(c.tZoom - 130);
    };

    vp.addEventListener("pointerdown", onDown);
    vp.addEventListener("pointermove", onMove);
    vp.addEventListener("pointerup", onUp);
    vp.addEventListener("pointercancel", onUp);
    vp.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);

    const stash = timers.current;
    return () => {
      cancelAnimationFrame(raf);
      vp.removeEventListener("pointerdown", onDown);
      vp.removeEventListener("pointermove", onMove);
      vp.removeEventListener("pointerup", onUp);
      vp.removeEventListener("pointercancel", onUp);
      vp.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      stash.forEach(clearTimeout);
    };
  }, [apply, clampZoom, reduce]);

  /* ── rope drag: free in both axes ────────────────── */
  const ropeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const r = rope.current;
    r.dragging = true;
    r.grabX = e.clientX; r.grabY = e.clientY;
    r.fromX = r.x; r.fromY = r.y;
    r.peak = r.y; r.moved = 0;
    r.vx = 0; r.vy = 0;

    const move = (ev: PointerEvent) => {
      if (!r.dragging) return;
      ev.preventDefault();
      const dx = ev.clientX - r.grabX;
      const dy = ev.clientY - r.grabY;
      r.moved = Math.max(r.moved, Math.hypot(dx, dy));

      let nx = r.fromX + dx;
      let ny = r.fromY + dy;
      // The rope cannot stretch past its length, and it cannot push upward.
      const len = Math.hypot(nx, ny);
      if (len > ROPE.maxLen) { nx *= ROPE.maxLen / len; ny *= ROPE.maxLen / len; }
      if (ny < 18) ny = 18;

      // Velocity comes from the hand, so releasing mid-swing throws the rope.
      r.vx = nx - r.x;
      r.vy = ny - r.y;
      r.x = nx;
      r.y = ny;
      r.peak = Math.max(r.peak, ny);
    };

    const up = () => {
      if (!r.dragging) return;
      r.dragging = false;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      // A real pull, or a plain click for anyone who doesn't think to drag.
      if (r.peak - ROPE.rest > ROPE.pullToFire || r.moved < 6) toggleLight();
    };

    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  /* ── camera moves ────────────────────────────────── */
  const flyTo = useCallback((toY: number, toX: number, toZ: number, ms: number) => {
    const c = cam.current;
    if (reduce) {
      c.rotY = c.tY = toY; c.rotX = c.tX = toX; c.zoom = c.tZoom = toZ;
      apply();
      return;
    }
    c.flying = true;
    const fY = c.rotY, fX = c.rotX, fZ = c.zoom, t0 = performance.now();
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms), e = ease(p);
      c.rotY = fY + (toY - fY) * e;
      c.rotX = fX + (toX - fX) * e;
      c.zoom = fZ + (toZ - fZ) * e;
      apply();
      if (p < 1) requestAnimationFrame(step);
      else { c.tY = toY; c.tX = toX; c.tZoom = toZ; c.flying = false; }
    };
    requestAnimationFrame(step);
  }, [apply, reduce]);

  const enterRoom = useCallback(() => {
    if (cam.current.mode === "inside") return;
    cam.current.mode = "inside";
    setInside(true);
    flyTo(0, 0, 0, 2300);
  }, [flyTo]);

  const goIsometric = useCallback(() => {
    cam.current.mode = "outside";
    setInside(false);
    flyTo(ISO.rotY, ISO.rotX, ISO.zoom, 1800);
  }, [flyTo]);

  const turnTo = useCallback((deg: number) => {
    if (cam.current.mode !== "inside") enterRoom();
    const cur = ((cam.current.tY % 360) + 360) % 360;
    cam.current.tY += ((((deg - cur) % 360) + 540) % 360) - 180;
    cam.current.velY = 0;
  }, [enterRoom]);

  /* ── door ────────────────────────────────────────── */
  const openDoor = () => {
    if (leaving) return;
    setLeaving(true);
    turnTo(90);                                   // face the door so the swing shows
    later(() => setWhiteout(true), 900);
    later(() => {
      // Back to wherever they came from. location.key is "default" only when
      // this page was opened directly, with no history to return to.
      if (location.key === "default") navigate(HOME_URL);
      else navigate(-1);
    }, 2300);
  };

  const cls = [
    "rp",
    inside && "rp-inside",
    lit && "rp-lit",
    flicker && "rp-flicker",
    leaving && "rp-open",
    looked && "rp-looked",
  ].filter(Boolean).join(" ");

  const ui = (
    <div className={cls} ref={rootRef}>
      <style>{CSS}</style>

      <button
        className="rp-skip"
        onClick={() => { enterRoom(); later(lightUp, reduce ? 0 : 600); }}
      >
        Skip the intro, enter the room and turn on the light
      </button>

      <div className="rp-viewport" ref={viewportRef}>
        <div className="rp-room" ref={roomRef}>

          <section className="rp-face rp-wall rp-front">
            <div className="rp-panel">
              <p className="rp-eyebrow">YOU FOUND A SECRET PAGE</p>
              <h1 className="rp-title rp-blood">ABDULLAH<Drips count={14} /></h1>
              <p className="rp-role rp-blood">AI Research Engineer, in progress</p>
              <p className="rp-sub">Student · Chattogram, Bangladesh</p>
              <p className="rp-blurb">
                I work one layer below the API — reading model internals,
                changing them, and finding out what breaks.
              </p>
            </div>
            <Scratches seed={0} /><div className="rp-skirt" /><div className="rp-dim" />
          </section>

          <section className="rp-face rp-wall rp-right">
            <div className="rp-panel">
              <h2 className="rp-head rp-blood">what I know<Drips count={9} /></h2>
              <div className="rp-tally">
                {SKILLS.map(([name, marks], r) => (
                  <div className="rp-tally-row" key={name}>
                    <span className="rp-tally-name">{name}</span>
                    <span className="rp-tally-marks">
                      {Array.from({ length: marks }, (_, i) => (
                        <b key={i} style={{ transitionDelay: `${(1.2 + r * 0.13 + i * 0.05).toFixed(2)}s` }} />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <Scratches seed={1} /><div className="rp-skirt" /><div className="rp-dim" />
          </section>

          <section className="rp-face rp-wall rp-back">
            <div className="rp-panel">
              <h2 className="rp-head rp-blood">what I&rsquo;m building<Drips count={11} /></h2>
              <div className="rp-notes">
                {PROJECTS.map(([title, desc, tags]) => (
                  <div className="rp-note" key={title}>
                    <h3 className="rp-blood">{title}</h3>
                    <p>{desc}</p>
                    <p className="rp-tags">{tags}</p>
                  </div>
                ))}
              </div>
            </div>
            <Scratches seed={2} /><div className="rp-skirt" /><div className="rp-dim" />
          </section>

          <section className="rp-face rp-wall rp-left rp-exit">
            <div className="rp-panel">
              {/* One button covers the whole door. The jamb, doorway and slab
                  are decorative siblings with pointer-events disabled — as
                  clickable layers they sat over the handle and ate the click. */}
              <div className="rp-door">
                <span className="rp-sign rp-blood">the way out</span>
                <button className="rp-door-btn" onClick={openDoor} aria-label="Open the door and go back">
                  <span className="rp-jamb" />
                  <span className="rp-doorway" />
                  <span className="rp-slab"><i /><i /></span>
                  <span className="rp-handle" />
                  <span className="rp-handle-hint">TURN THE HANDLE</span>
                </button>
              </div>

              <div className="rp-mirror">
                <div className="rp-mframe" />
                <div className="rp-glass">
                  <div className="rp-ghost">ABDULLAH</div>
                  <div className="rp-reflect">
                    <img
                      src={PORTRAIT}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                  <div className="rp-smudge" />
                  <div className="rp-crack" />
                  <div className="rp-spec" />
                </div>
                <span className="rp-mlabel">someone has to look back</span>
              </div>
            </div>
            <Scratches seed={3} /><div className="rp-skirt" /><div className="rp-dim" />
          </section>

          <div className="rp-face rp-horiz rp-floor"><div className="rp-dim" /></div>
          <div className="rp-face rp-horiz rp-ceil"><div className="rp-dim" /></div>
        </div>
      </div>

      {/* ── lamp: rope is an SVG curve driven by a spring, so it can be
              dragged in any direction and swings back on release ── */}
      <div className="rp-lamp">
        <div className="rp-wire" />
        <div className="rp-shade" />
        <button
          className="rp-bulb-btn"
          onClick={toggleLight}
          aria-pressed={lit}
          aria-label="Turn on the light"
        >
          <span className="rp-bulb" />
        </button>

        <div className="rp-rig">
          <svg className="rp-rope" viewBox="0 0 240 200" aria-hidden="true">
            <path ref={ropePathRef} d="M120 0 Q120 48 120 78" />
          </svg>
          <button
            ref={knobRef}
            className="rp-knob-hit"
            onPointerDown={ropeDown}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleLight(); }
            }}
            aria-label="Pull the cord to turn on the light"
          >
            <span className="rp-knob" />
          </button>
        </div>
      </div>

      <p className="rp-msg rp-enter-msg">A ROOM. SOMEONE HAS BEEN WRITING ON THE WALLS.</p>
      <button className="rp-enter" onClick={enterRoom}>STEP INSIDE</button>
      <p className="rp-msg rp-cord-msg">PULL THE CORD</p>
      <p className="rp-msg rp-look-msg">
        DRAG TO LOOK &nbsp;·&nbsp; SCROLL TO MOVE &nbsp;·&nbsp; FIND THE DOOR
      </p>

      <nav className="rp-hud">
        {TURNS.map(([label, deg]) => (
          <button key={label} className={facing === deg ? "rp-on" : undefined} onClick={() => turnTo(deg)}>
            {label}
          </button>
        ))}
        <span className="rp-sep" />
        <button onClick={() => { cam.current.tZoom = clampZoom(cam.current.tZoom + 130); }} aria-label="Move forward">+</button>
        <button onClick={() => { cam.current.tZoom = clampZoom(cam.current.tZoom - 130); }} aria-label="Move back">−</button>
        <button onClick={goIsometric}>ISOMETRIC</button>
      </nav>

      <div className={`rp-whiteout${whiteout ? " rp-on" : ""}`} />
    </div>
  );

  /* Portalled to <body>: the route renders inside your Navbar/Footer layout,
     and position:fixed does not lift it out of that stacking context. */
  return typeof document === "undefined" ? ui : createPortal(ui, document.body);
};

/* ══════════════════════════════════════════════════════
 * Styles, scoped under .rp so nothing leaks into the app
 * ══════════════════════════════════════════════════════ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rock+Salt&family=Caveat:wght@500;700&family=JetBrains+Mono:wght@400;700&display=swap');

.rp{
  --blood:#a01020; --blood-lit:#d4152b; --blood-deep:#4d060d;
  --wall:#2b2825; --rp-spec:50%;
  --scrawl:'Rock Salt',cursive; --hand:'Caveat',cursive;
  --mono:'JetBrains Mono',ui-monospace,monospace;
  position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:#050403;
  font-family:var(--mono);color:#c9c2b8;user-select:none;-webkit-font-smoothing:antialiased;
}
.rp *{margin:0;padding:0;box-sizing:border-box}

/* perspective MUST equal the EYE constant in the component */
.rp-viewport{position:absolute;inset:0;perspective:900px;perspective-origin:50% 50%;
  cursor:grab;touch-action:none}
.rp-viewport.rp-dragging{cursor:grabbing}
.rp-room{position:absolute;top:50%;left:50%;width:0;height:0;transform-style:preserve-3d}

.rp-face{position:absolute;left:50%;top:50%;overflow:hidden;transform-style:preserve-3d;
  backface-visibility:hidden;-webkit-backface-visibility:hidden}
.rp-wall{width:1800px;height:1040px;margin-left:-900px;margin-top:-520px;
  background:radial-gradient(ellipse 900px 700px at 50% 30%,rgba(255,214,170,.09),transparent 62%),
             linear-gradient(180deg,var(--wall) 0%,#232019 58%,#100e0c 100%);
  box-shadow:inset 0 0 200px rgba(0,0,0,.95)}
.rp-horiz{width:1800px;height:1800px;margin-left:-900px;margin-top:-900px}

/* rotateX(90deg) maps local +Z to world UP, so that pair is the FLOOR */
.rp-front{transform:rotateY(0deg) translateZ(-900px)}
.rp-right{transform:rotateY(90deg) translateZ(-900px)}
.rp-back {transform:rotateY(180deg) translateZ(-900px)}
.rp-left {transform:rotateY(270deg) translateZ(-900px)}
.rp-floor{transform:rotateX(90deg) translateZ(-520px);
  background:radial-gradient(ellipse 700px 700px at 50% 50%,#262220,#0b0a09 72%)}
.rp-ceil {transform:rotateX(-90deg) translateZ(-520px);
  background:radial-gradient(ellipse 420px 420px at 50% 50%,#35302a,#090807 66%)}

.rp-face::before{content:'';position:absolute;inset:0;opacity:.5;pointer-events:none;z-index:2;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.13'/%3E%3C/svg%3E")}
.rp-wall::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:3;opacity:.6;
  background:radial-gradient(ellipse 280px 400px at 10% 82%,rgba(0,0,0,.6),transparent 70%),
             radial-gradient(ellipse 220px 280px at 90% 16%,rgba(0,0,0,.45),transparent 70%),
             radial-gradient(ellipse 170px 460px at 66% 100%,rgba(0,0,0,.55),transparent 72%)}

/* darkness is an overlay, never filter:brightness — a filter forces its own
   render group and can flatten the element out of the 3D context */
.rp-dim{position:absolute;inset:0;z-index:9;pointer-events:none;background:#050403;
  opacity:.92;transition:opacity 1.8s ease}
.rp-lit .rp-dim{opacity:0}
.rp-lit .rp-floor .rp-dim{opacity:.12}

.rp-skirt{position:absolute;left:0;right:0;bottom:0;height:58px;z-index:4;pointer-events:none;
  transform:translateZ(14px);background:linear-gradient(180deg,#1d1a16,#0b0a08);
  box-shadow:0 -6px 18px rgba(0,0,0,.7)}
.rp-scratch{position:absolute;background:rgba(255,255,255,.05);height:1px;
  transform-origin:left;z-index:4;pointer-events:none}

.rp-panel{position:absolute;inset:0 130px 58px 130px;z-index:5;
  display:flex;flex-direction:column;justify-content:center}
.rp-blood{color:var(--blood);text-shadow:0 0 1px rgba(0,0,0,.9),0 2px 5px rgba(0,0,0,.75);
  transition:color 1.8s ease,text-shadow 1.8s ease}
.rp-lit .rp-blood{color:var(--blood-lit);
  text-shadow:0 0 1px rgba(0,0,0,.9),0 2px 6px rgba(0,0,0,.7),0 0 34px rgba(212,21,43,.4)}

.rp-title{font-family:var(--scrawl);font-size:104px;line-height:1.15;position:relative;
  display:inline-block;transform:rotate(-1.6deg)}
.rp-drips{position:absolute;left:0;right:0;top:100%;height:220px;pointer-events:none}
.rp-drips i{position:absolute;top:-6px;width:3px;border-radius:0 0 3px 3px;
  background:linear-gradient(180deg,var(--blood-lit),var(--blood-deep) 68%,transparent);
  opacity:0;transform:scaleY(0);transform-origin:top;
  transition:transform 1.7s cubic-bezier(.3,0,.2,1),opacity .9s ease}
.rp-lit .rp-drips i{opacity:.85;transform:scaleY(1)}

.rp-eyebrow{font-size:18px;letter-spacing:.42em;font-weight:700;color:#6a615a;margin-bottom:32px}
.rp-lit .rp-eyebrow{color:#9c8e82}
.rp-role{font-family:var(--hand);font-size:50px;font-weight:700;margin-top:52px;transform:rotate(-.7deg)}
.rp-sub{font-family:var(--hand);font-size:34px;color:#8d8177;margin-top:12px}
.rp-blurb{font-family:var(--hand);font-size:33px;line-height:1.55;color:#a1958a;
  max-width:24ch;margin-top:38px}
.rp-head{font-family:var(--scrawl);font-size:60px;margin-bottom:50px;position:relative;
  display:inline-block;transform:rotate(-1.1deg)}

.rp-tally{display:grid;gap:28px;max-width:1000px}
.rp-tally-row{display:flex;align-items:baseline;gap:26px}
.rp-tally-name{font-family:var(--hand);font-size:37px;color:#b0a498;min-width:500px}
.rp-tally-marks{display:flex;gap:11px;align-items:flex-end}
.rp-tally-marks b{width:5px;height:36px;border-radius:2px;background:var(--blood);
  opacity:0;transform:scaleY(.2);transform-origin:bottom;
  transition:transform .5s cubic-bezier(.3,1.4,.5,1),opacity .4s ease}
.rp-lit .rp-tally-marks b{opacity:.92;transform:scaleY(1)}

.rp-notes{display:grid;gap:46px;max-width:1000px}
.rp-note h3{font-family:var(--scrawl);font-size:32px;margin-bottom:16px}
.rp-note p{font-family:var(--hand);font-size:32px;line-height:1.5;color:#a1958a;max-width:34ch}
.rp-tags{font-family:var(--mono)!important;font-size:16px!important;letter-spacing:.14em;
  color:#6f645b!important;margin-top:14px}

/* ── exit wall ── */
.rp-exit .rp-panel{flex-direction:row;align-items:center;gap:90px;justify-content:center}
.rp-door{position:relative;width:420px;height:760px;flex-shrink:0;
  transform-style:preserve-3d;transform:translateZ(18px)}
.rp-sign{position:absolute;left:50%;top:-96px;transform:translateX(-50%);
  font-family:var(--scrawl);font-size:34px;white-space:nowrap;pointer-events:none}

/* the ONLY interactive element on the door */
.rp-door-btn{position:absolute;inset:0;z-index:7;padding:0;border:0;background:transparent;
  cursor:pointer;transform-style:preserve-3d;display:block}
.rp-door-btn:focus-visible{outline:3px solid var(--blood-lit);outline-offset:14px}
.rp-door-btn>*{pointer-events:none}

.rp-jamb{position:absolute;inset:-22px;border:22px solid;
  border-color:#241f19 #1a1611 #14110d #1a1611;
  box-shadow:0 0 60px rgba(0,0,0,.9),inset 0 0 40px rgba(0,0,0,.8)}
.rp-doorway{position:absolute;inset:0;background:#0a0806;overflow:hidden}
.rp-doorway::after{content:'';position:absolute;inset:0;opacity:0;
  background:radial-gradient(ellipse at 50% 60%,#fff8e6,#f6d99b 45%,#c99a4c 80%);
  transition:opacity 1.1s ease}
.rp-open .rp-doorway::after{opacity:1}
.rp-slab{position:absolute;inset:0;transform-origin:left center;transform-style:preserve-3d;
  background:linear-gradient(100deg,#231e18,#191510 55%,#100d0a);
  box-shadow:inset 0 0 40px rgba(0,0,0,.8),0 0 30px rgba(0,0,0,.6);
  transition:transform 1.7s cubic-bezier(.5,0,.2,1)}
.rp-open .rp-slab{transform:rotateY(-96deg)}
.rp-slab i{position:absolute;display:block;border:3px solid rgba(0,0,0,.55);
  box-shadow:inset 0 0 22px rgba(0,0,0,.55),0 1px 0 rgba(255,255,255,.03)}
.rp-slab i:nth-of-type(1){left:44px;right:44px;top:52px;height:280px}
.rp-slab i:nth-of-type(2){left:44px;right:44px;bottom:52px;height:300px}
.rp-handle{position:absolute;right:34px;top:50%;margin-top:-26px;z-index:8;
  width:54px;height:54px;border-radius:50%;display:block;
  background:radial-gradient(circle at 34% 30%,#f3e2b4,#9c8248 45%,#4e3f21);
  box-shadow:0 0 0 5px #1a1611,0 8px 22px rgba(0,0,0,.85),inset 0 -4px 8px rgba(0,0,0,.5);
  transform:translateZ(20px);transition:transform .3s ease,box-shadow .3s ease}
.rp-door-btn:hover .rp-handle{transform:translateZ(28px) scale(1.08);
  box-shadow:0 0 0 5px #1a1611,0 0 34px rgba(243,226,180,.5),0 8px 22px rgba(0,0,0,.85)}
.rp-handle-hint{position:absolute;right:-6px;top:calc(50% + 46px);width:150px;text-align:center;
  font-size:13px;letter-spacing:.24em;color:#6a615a;opacity:0;transition:opacity .3s;z-index:8}
.rp-door-btn:hover .rp-handle-hint{opacity:1}

/* ── mirror ── */
.rp-mirror{position:relative;width:400px;height:560px;flex-shrink:0;
  transform-style:preserve-3d;transform:translateZ(16px);pointer-events:none}
.rp-mframe{position:absolute;inset:-26px;border-radius:6px;
  background:linear-gradient(140deg,#4a3f2a,#2a2318 40%,#57492f 70%,#221c12);
  box-shadow:0 26px 60px rgba(0,0,0,.9),inset 0 2px 3px rgba(255,235,180,.14),
             inset 0 -3px 6px rgba(0,0,0,.7)}
.rp-glass{position:absolute;inset:0;overflow:hidden;border-radius:2px;
  background:linear-gradient(168deg,#0d1114,#141a1e 45%,#0a0d0f);
  box-shadow:inset 0 0 60px rgba(0,0,0,.95),inset 0 3px 10px rgba(160,190,210,.1)}
.rp-reflect{position:absolute;inset:0;opacity:0;transition:opacity 2.4s ease .5s}
.rp-lit .rp-reflect{opacity:.72}
.rp-reflect img{width:100%;height:100%;object-fit:cover;display:block;transform:scaleX(-1);
  filter:grayscale(.55) brightness(.62) contrast(1.15) blur(.6px);mix-blend-mode:screen}
.rp-reflect::after{content:'';position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(12,18,22,.25),rgba(6,9,11,.75) 78%)}
.rp-ghost{position:absolute;inset:0;opacity:0;transition:opacity 2.4s ease .3s;
  font-family:var(--scrawl);font-size:44px;color:rgba(212,21,43,.18);
  transform:scaleX(-1) rotate(-1deg);display:flex;align-items:flex-start;
  justify-content:center;padding-top:38px;filter:blur(1.6px)}
.rp-lit .rp-ghost{opacity:1}
/* highlight position is driven by camera angle in JS */
.rp-spec{position:absolute;inset:0;mix-blend-mode:screen;
  background:linear-gradient(104deg,transparent calc(var(--rp-spec) - 26%),
    rgba(226,240,255,.11) calc(var(--rp-spec) - 7%),
    rgba(255,255,255,.2) var(--rp-spec),
    rgba(226,240,255,.09) calc(var(--rp-spec) + 7%),
    transparent calc(var(--rp-spec) + 26%))}
.rp-smudge{position:absolute;inset:0;opacity:.5;filter:blur(3px);
  background:radial-gradient(ellipse 120px 90px at 24% 74%,rgba(200,220,235,.05),transparent 70%),
             radial-gradient(ellipse 80px 140px at 80% 28%,rgba(200,220,235,.045),transparent 70%)}
.rp-crack{position:absolute;left:62%;top:18%;width:2px;height:190px;
  background:linear-gradient(180deg,transparent,rgba(255,255,255,.22),transparent);
  transform:rotate(9deg);box-shadow:0 0 8px rgba(255,255,255,.14)}
.rp-crack::before,.rp-crack::after{content:'';position:absolute;width:1px;background:rgba(255,255,255,.15)}
.rp-crack::before{height:70px;top:52px;left:0;transform:rotate(-36deg);transform-origin:top}
.rp-crack::after{height:52px;top:120px;left:0;transform:rotate(28deg);transform-origin:top}
.rp-mlabel{position:absolute;left:50%;bottom:-74px;transform:translateX(-50%);
  font-family:var(--hand);font-size:30px;color:#8d8177;white-space:nowrap}

/* ── lamp ── */
.rp-lamp{position:absolute;top:0;left:50%;transform:translateX(-50%);z-index:45;
  display:flex;flex-direction:column;align-items:center;pointer-events:none;
  opacity:0;transition:opacity .9s ease}
.rp-inside .rp-lamp{opacity:1}
.rp-lamp>*{pointer-events:auto}
.rp-wire{width:2px;height:58px;background:linear-gradient(180deg,#0c0b0a,#1d1a17)}
.rp-shade{width:0;height:0;border-left:52px solid transparent;border-right:52px solid transparent;
  border-top:44px solid #17140f;filter:drop-shadow(0 6px 10px rgba(0,0,0,.8))}
.rp-bulb-btn{background:none;border:0;padding:8px;cursor:pointer;margin-top:-14px;border-radius:50%}
.rp-bulb-btn:focus-visible{outline:2px solid var(--blood-lit);outline-offset:5px}
.rp-bulb{display:block;width:46px;height:46px;border-radius:50%;transition:all .18s ease;
  background:radial-gradient(circle at 38% 32%,rgba(255,255,255,.05),transparent);
  border:2px solid rgba(255,255,255,.07)}
.rp-flicker .rp-bulb{background:radial-gradient(circle,rgba(255,214,150,.35),transparent);
  border-color:rgba(255,214,150,.4);box-shadow:0 0 30px 8px rgba(255,196,120,.3)}
.rp-lit .rp-bulb{background:radial-gradient(circle at 38% 32%,#fffdf4,#ffe9b0 45%,#ffca6a);
  border-color:#ffe9b0;animation:rpBreathe 4.2s ease-in-out infinite;
  box-shadow:0 0 90px 30px rgba(255,190,110,.3),0 0 200px 70px rgba(255,170,80,.12)}
@keyframes rpBreathe{0%,100%{filter:brightness(1)}50%{filter:brightness(1.12)}}

/* rope rig: the SVG is the rope, the knob is absolutely placed at its end */
.rp-rig{position:relative;width:240px;height:200px;margin-left:68px;margin-top:-6px;
  pointer-events:none}
.rp-rope{position:absolute;inset:0;width:240px;height:200px;overflow:visible}
.rp-rope path{fill:none;stroke:#4a453e;stroke-width:1.8;stroke-linecap:round;
  filter:drop-shadow(0 1px 2px rgba(0,0,0,.9))}
.rp-lit .rp-rope path{stroke:#6b6459}
.rp-knob-hit{position:absolute;left:calc(120px - 21px);top:-13px;
  padding:13px 21px;border:0;background:transparent;cursor:grab;touch-action:none;
  pointer-events:auto;display:block;will-change:transform}
.rp-knob-hit:active{cursor:grabbing}
.rp-knob-hit:focus-visible{outline:2px solid var(--blood-lit);outline-offset:2px}
.rp-knob{display:block;width:14px;height:30px;border-radius:99px;pointer-events:none;
  background:linear-gradient(180deg,#a3182a,#8a1220 40%,#4a0810);
  border:1.5px solid #2c060b;box-shadow:0 4px 12px rgba(0,0,0,.8),
  inset 0 2px 3px rgba(255,255,255,.12)}

/* ── HUD ── */
.rp-msg{position:absolute;left:50%;transform:translateX(-50%);z-index:50;white-space:nowrap;
  font-size:11px;letter-spacing:.34em;color:#6a615a;pointer-events:none;transition:opacity .6s ease}
.rp-enter-msg{top:50%;margin-top:-6px}
.rp-cord-msg{top:300px;opacity:0}
.rp-inside .rp-cord-msg{opacity:1;animation:rpPulse 2.6s ease-in-out infinite}
.rp-lit .rp-cord-msg{opacity:0;animation:none}
.rp-look-msg{bottom:86px;opacity:0}
.rp-lit .rp-look-msg{opacity:1}
.rp-looked .rp-look-msg{opacity:0!important}
@keyframes rpPulse{0%,100%{opacity:.4}50%{opacity:.85}}

.rp-enter{position:absolute;left:50%;top:50%;transform:translate(-50%,28px);z-index:51;
  font-family:var(--mono);font-size:12px;font-weight:700;letter-spacing:.3em;
  padding:16px 34px;cursor:pointer;color:#c9c2b8;background:rgba(8,7,6,.6);
  border:1px solid rgba(201,194,184,.22);backdrop-filter:blur(6px);transition:all .3s ease}
.rp-enter:hover{color:var(--blood-lit);border-color:rgba(212,21,43,.5)}
.rp-enter:focus-visible{outline:2px solid var(--blood-lit);outline-offset:3px}
.rp-inside .rp-enter,.rp-inside .rp-enter-msg{opacity:0;pointer-events:none}

.rp-hud{position:absolute;left:0;right:0;bottom:26px;z-index:52;display:flex;
  justify-content:center;gap:8px;flex-wrap:wrap;padding:0 14px;
  opacity:0;pointer-events:none;transition:opacity .9s ease}
.rp-lit .rp-hud{opacity:1;pointer-events:auto}
.rp-hud button{font-family:var(--mono);font-size:10px;letter-spacing:.18em;font-weight:700;
  padding:10px 14px;border:1px solid rgba(201,194,184,.16);background:rgba(8,7,6,.72);
  color:#6f665e;cursor:pointer;backdrop-filter:blur(6px);transition:all .25s ease}
.rp-hud button:hover,.rp-hud button.rp-on{color:var(--blood-lit);border-color:rgba(212,21,43,.42)}
.rp-hud button:focus-visible{outline:2px solid var(--blood-lit);outline-offset:2px}
.rp-sep{width:1px;background:rgba(201,194,184,.14);margin:0 4px}

.rp-whiteout{position:absolute;inset:0;z-index:99;pointer-events:none;opacity:0;
  background:radial-gradient(ellipse at 50% 55%,#fffaf0,#f3dda8 55%,#d9b978);
  transition:opacity 1.3s ease}
.rp-whiteout.rp-on{opacity:1}

.rp-skip{position:absolute;left:-9999px}
.rp-skip:focus{left:50%;top:14px;transform:translateX(-50%);z-index:120;padding:10px 18px;
  background:var(--blood-lit);color:#fff;font-size:11px;font-weight:700;letter-spacing:.1em;
  border:0;cursor:pointer}

@media (prefers-reduced-motion:reduce){.rp *{animation:none!important}}
`;

export default DeveloperProfile;
