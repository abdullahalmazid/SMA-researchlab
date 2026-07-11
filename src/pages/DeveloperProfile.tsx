import {
  BadgeCheck,
  Code2,
  Laptop,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

// ── Fixed stars — no re-render flicker ───────────────────────
const STARS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  x: (i * 137.508) % 100,
  y: (i * 97.3) % 100,
  size: (i % 3) + 1,
  opacity: 0.12 + (i % 5) * 0.08,
}));

// ── Typewriter hook ───────────────────────────────────────────
function useTypewriter(text: string, speed = 60, start = false) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!start) {
      setDisplayed("");
      setDone(false);
      return;
    }
    setDisplayed("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      setDisplayed(text.slice(0, ++i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, start]);
  return { displayed, done };
}

const DeveloperProfile: React.FC = () => {
  const [lightOn, setLightOn] = useState(false);
  const [phase, setPhase] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const gestureRef = useRef({ startY: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { displayed: typedName, done: nameDone } = useTypewriter(
    "Abdullah",
    55,
    phase === 2,
  );
  const { displayed: typedRole, done: roleDone } = useTypewriter(
    "> AI_Research_Engineer_In_Progress",
    45,
    nameDone,
  );
  const { displayed: typedSub } = useTypewriter(
    "Student (Tech + AI Enthusiast) | Chattogram, Bangladesh",
    35,
    roleDone,
  );

  const triggerLight = () => {
    if (lightOn) {
      setLightOn(false);
      setPhase(0);
      return;
    }
    setPhase(1);
    let count = 0;
    const flicker = () => {
      count++;
      setGlitch(count % 2 === 0);
      if (count < 7) {
        timerRef.current = setTimeout(flicker, 60 + Math.random() * 100);
      } else {
        setGlitch(false);
        setLightOn(true);
        setPhase(2);
      }
    };
    timerRef.current = setTimeout(flicker, 180);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    gestureRef.current.startY = e.clientY;
    setIsDragging(true);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const d = e.clientY - gestureRef.current.startY;
    if (d > 0 && d < 90) setDragY(d);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (dragY > 40) triggerLight();
    setDragY(0);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const skills = useMemo(
    () => [
      { label: "Transformer Architecture", level: 90, color: "#06b6d4" },
      { label: "SAM Internals & Fine-Tuning", level: 92, color: "#22c55e" },
      { label: "LoRA / ConvLoRA / VPT", level: 89, color: "#f59e0b" },
      { label: "Federated Learning Concepts", level: 78, color: "#6366f1" },
      { label: "PyTorch Model Engineering", level: 85, color: "#ec4899" },
      { label: "Full-Stack + Deployment", level: 82, color: "#38bdf8" },
      { label: "ESP32 + IoT Data Systems", level: 80, color: "#14b8a6" },
    ],
    [],
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020408",
        fontFamily: "'Courier New', Courier, monospace",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Share+Tech+Mono&display=swap');
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes pulseGlow { 0%,100%{box-shadow:0 0 24px rgba(245,158,11,0.3),0 0 60px rgba(245,158,11,0.1)} 50%{box-shadow:0 0 50px rgba(245,158,11,0.6),0 0 120px rgba(245,158,11,0.25)} }
        @keyframes revealUp { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes hintPulse { 0%,100%{opacity:0.3;letter-spacing:.35em} 50%{opacity:0.65;letter-spacing:.45em} }
        @keyframes cordSwing { 0%,100%{transform:rotate(0deg)} 25%{transform:rotate(1.5deg)} 75%{transform:rotate(-1.5deg)} }
        @keyframes termBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes rainbow { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes scanline { 0%{top:-2%} 100%{top:102%} }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        .skill-fill { transition: width 1.8s cubic-bezier(0.16,1,0.3,1); }
        .card { transition: transform 0.3s ease, box-shadow 0.3s ease; }
        .card:hover { transform: translateY(-4px) !important; }
        .cord-idle { animation: cordSwing 3.5s ease-in-out infinite; transform-origin: top center; }
        .terminal-cursor { animation: termBlink 1s step-end infinite; }
        .link-btn { transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease; }
        .link-btn:hover { transform: translateY(-3px) scale(1.04); filter: brightness(1.15); }
      `}</style>

      {/* CRT scanline */}
      {lightOn && (
        <div
          className="pointer-events-none fixed left-0 right-0 z-50"
          style={{
            height: 2,
            background:
              "linear-gradient(90deg,transparent,rgba(6,182,212,0.12),transparent)",
            animation: "scanline 7s linear infinite",
          }}
        />
      )}

      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
          opacity: 0.4,
        }}
      />

      {/* Stars */}
      <div className="fixed inset-0 pointer-events-none">
        {STARS.map((s) => (
          <div
            key={s.id}
            className="absolute rounded-full"
            style={{
              width: s.size,
              height: s.size,
              left: `${s.x}%`,
              top: `${s.y}%`,
              background: "white",
              opacity: lightOn ? s.opacity : s.opacity * 0.25,
              transition: "opacity 1.2s ease",
            }}
          />
        ))}
      </div>

      {/* Ambient radial glow */}
      {lightOn && (
        <div
          className="fixed pointer-events-none"
          style={{
            top: "3%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 700,
            height: 500,
            background:
              "radial-gradient(ellipse,rgba(253,224,71,0.07) 0%,transparent 70%)",
            filter: "blur(50px)",
            zIndex: 1,
          }}
        />
      )}

      {/* ══════════════ LIGHTBULB ══════════════ */}
      <div
        className="absolute top-0 left-1/2 z-30"
        style={{
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Wire */}
        <div
          style={{
            width: 3,
            height: 40,
            background: "linear-gradient(180deg,#1a1a1a,#2a2a2a)",
            borderRadius: 99,
          }}
        />
        {/* Socket cap */}
        <div
          style={{
            width: 52,
            height: 14,
            background: "linear-gradient(180deg,#2e2e2e,#1a1a1a)",
            borderRadius: "6px 6px 0 0",
          }}
        />
        {/* Socket body */}
        <div
          style={{
            width: 42,
            height: 30,
            background: "#1c1c1c",
            border: "1px solid #0d0d0d",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-evenly",
            alignItems: "center",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{ width: "88%", height: 1.5, background: "#272727" }}
            />
          ))}
        </div>

        {/* Bulb */}
        <div
          onClick={triggerLight}
          style={{
            width: 84,
            height: 84,
            marginTop: -10,
            borderRadius: "50%",
            cursor: "pointer",
            userSelect: "none",
            background: lightOn
              ? "radial-gradient(circle at 38% 32%, #fffde7, #fef08a 40%, #fde047)"
              : glitch
                ? "radial-gradient(circle,rgba(253,224,71,0.25),transparent)"
                : "radial-gradient(circle,rgba(255,255,255,0.04),transparent)",
            border: `2.5px solid ${lightOn ? "#fef08a" : glitch ? "rgba(253,224,71,0.35)" : "rgba(255,255,255,0.07)"}`,
            boxShadow: lightOn
              ? "0 0 60px 20px rgba(253,224,71,0.38),0 0 120px 40px rgba(253,224,71,0.16),inset 0 0 24px rgba(255,255,255,0.9)"
              : glitch
                ? "0 0 24px 6px rgba(253,224,71,0.22)"
                : "inset 0 0 14px rgba(255,255,255,0.03)",
            transition: "all 0.18s ease",
            animation: lightOn ? "pulseGlow 3s ease-in-out infinite" : "none",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Filament */}
          <div
            style={{
              width: 20,
              height: 28,
              border: `2.5px solid ${lightOn ? "#f59e0b" : "#252525"}`,
              borderTop: "none",
              borderRadius: "0 0 14px 14px",
              transition: "border-color 0.2s",
              marginBottom: 4,
            }}
          />
          {lightOn && (
            <div
              style={{
                position: "absolute",
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "white",
                filter: "blur(5px)",
                opacity: 0.7,
              }}
            />
          )}
        </div>

        {/* Pull cord */}
        <div
          className={isDragging ? "" : "cord-idle"}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginLeft: 28,
          }}
        >
          <div
            style={{
              width: 2,
              background: "linear-gradient(180deg,#3a3a3a,#555)",
              height: isDragging ? `${60 + dragY}px` : "60px",
              transition: isDragging
                ? "none"
                : "height 0.5s cubic-bezier(0.5,2.5,0.4,1)",
            }}
          />
          <div
            style={{
              width: 20,
              height: 34,
              background: "linear-gradient(180deg,#ef4444,#b91c1c)",
              borderRadius: 99,
              border: "2.5px solid #7f1d1d",
              cursor: "grab",
              boxShadow:
                "0 5px 14px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.12)",
              touchAction: "none",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>

        {/* Hint text */}
        <p
          style={{
            position: "absolute",
            top: 230,
            left: "50%",
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "0.38em",
            color: "#3a3a3a",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            opacity: lightOn ? 0 : 1,
            transition: "opacity 0.5s ease",
            animation: lightOn ? "none" : "hintPulse 2.5s ease-in-out infinite",
          }}
        >
          PULL TO ILLUMINATE
        </p>
      </div>

      {/* ══════════════ MAIN CONTENT ══════════════ */}
      <div
        style={{
          opacity: lightOn ? 1 : 0,
          transform: lightOn ? "none" : "translateY(16px)",
          transition: "opacity 0.9s ease 0.25s,transform 0.9s ease 0.25s",
          pointerEvents: lightOn ? "auto" : "none",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            padding: "clamp(180px,22vw,220px) 20px 60px",
          }}
        >
          {/* Secret badge */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 36,
              animation: lightOn ? "revealUp 0.7s ease 0.1s both" : "none",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 20px",
                borderRadius: 99,
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.22)",
                color: "#f59e0b",
                fontSize: 9.5,
                fontWeight: 900,
                letterSpacing: "0.32em",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(90deg,transparent,rgba(245,158,11,0.06),transparent)",
                  backgroundSize: "200% 100%",
                  animation: "rainbow 2.5s linear infinite",
                }}
              />
              <span
                style={{
                  animation: "termBlink 1.5s step-end infinite",
                  fontSize: 7,
                }}
              >
                ●
              </span>
              YOU FOUND A SECRET PAGE
            </div>
          </div>

          {/* ── HERO CARD ── */}
          <div
            className="card"
            style={{
              borderRadius: 28,
              overflow: "hidden",
              marginBottom: 20,
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
              backdropFilter: "blur(28px)",
              animation: lightOn ? "revealUp 0.7s ease 0.2s both" : "none",
            }}
          >
            {/* Rainbow top */}
            <div
              style={{
                height: 3,
                background:
                  "linear-gradient(90deg,#f59e0b,#ec4899,#6366f1,#06b6d4,#10b981,#f59e0b)",
                backgroundSize: "300% 100%",
                animation: "rainbow 5s linear infinite",
              }}
            />
            <div style={{ padding: "clamp(28px,4vw,44px)" }}>
              <div
                style={{
                  display: "flex",
                  gap: 32,
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    animation:
                      "float 4s ease-in-out infinite,pulseGlow 3s ease-in-out infinite",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 124,
                      height: 124,
                      borderRadius: "22%",
                      background:
                        "linear-gradient(135deg,#f59e0b,#ec4899,#6366f1,#06b6d4)",
                      padding: 3,
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "20%",
                        background: "linear-gradient(145deg,#0a0f1e,#1e1b4b)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                      }}
                    >
                      <UserRound size={46} strokeWidth={1.8} />
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#10b981",
                      marginBottom: 8,
                      fontFamily: "'Share Tech Mono',monospace",
                    }}
                  >
                    <span style={{ color: "#6366f1" }}>~/secret</span>
                    <span style={{ color: "#475569" }}> $ </span>
                    <span style={{ color: "#64748b" }}>
                      whoami --deep-profile
                    </span>
                  </div>
                  <h1
                    style={{
                      fontFamily: "'Syne','Share Tech Mono',monospace",
                      fontSize: "clamp(1.6rem,4vw,2.5rem)",
                      fontWeight: 800,
                      color: "white",
                      lineHeight: 1.1,
                      marginBottom: 10,
                      letterSpacing: "-0.5px",
                    }}
                  >
                    {typedName}
                    {!nameDone && (
                      <span
                        className="terminal-cursor"
                        style={{ color: "#f59e0b" }}
                      >
                        ▋
                      </span>
                    )}
                  </h1>
                  {nameDone && (
                    <p
                      style={{
                        fontSize: 13,
                        color: "#06b6d4",
                        fontWeight: 700,
                        marginBottom: 8,
                        fontFamily: "'Share Tech Mono',monospace",
                      }}
                    >
                      {typedRole}
                      <span className="terminal-cursor">▋</span>
                    </p>
                  )}
                  {roleDone && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.45)",
                        marginBottom: 14,
                        fontFamily: "'Share Tech Mono',monospace",
                      }}
                    >
                      // {typedSub}
                    </p>
                  )}
                  <p
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.35)",
                      marginBottom: 20,
                      letterSpacing: "0.04em",
                    }}
                  >
                    Deep technical learner focused on understanding and
                    modifying AI systems from the architecture level.
                  </p>
                  {/* Focus chips */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      {
                        label: "Primary: Artificial Intelligence",
                        bg: "#0ea5e9",
                        icon: Code2,
                      },
                      {
                        label: "Advanced Model Engineering",
                        bg: "#8b5cf6",
                        icon: BadgeCheck,
                      },
                      {
                        label: "IoT + Full-Stack Builder",
                        bg: "#16a34a",
                        icon: Laptop,
                      },
                    ].map(
                      (l: {
                        label: string;
                        bg: string;
                        tc?: string;
                        icon: LucideIcon;
                      }) => (
                        <div
                          key={l.label}
                          className="link-btn"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "7px 14px",
                            borderRadius: 10,
                            background: l.bg,
                            color: l.tc ?? "white",
                            fontSize: 11,
                            fontWeight: 700,
                            boxShadow: `0 4px 14px ${l.bg}40`,
                            letterSpacing: "0.03em",
                          }}
                        >
                          <l.icon size={13} strokeWidth={2.2} />
                          {l.label}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── TERMINAL SKILLS ── */}
          <div
            className="card"
            style={{
              borderRadius: 24,
              overflow: "hidden",
              marginBottom: 20,
              background: "rgba(0,0,0,0.7)",
              border: "1px solid rgba(255,255,255,0.06)",
              animation: lightOn ? "revealUp 0.7s ease 0.35s both" : "none",
            }}
          >
            {/* Mac-style title bar */}
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              {["#ef4444", "#f59e0b", "#22c55e"].map((c, i) => (
                <div
                  key={i}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: c,
                  }}
                />
              ))}
              <span
                style={{
                  marginLeft: 10,
                  fontSize: 11,
                  color: "#475569",
                  fontFamily: "'Share Tech Mono',monospace",
                }}
              >
                <BadgeCheck size={12} color="#06b6d4" /> skills.sh — bash —
                80×24
              </span>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <p
                style={{
                  fontSize: 11,
                  color: "#10b981",
                  marginBottom: 18,
                  fontFamily: "'Share Tech Mono',monospace",
                }}
              >
                <span style={{ color: "#6366f1" }}>$</span>
                <span style={{ color: "#64748b" }}> cat</span>{" "}
                engineering_profile.json
              </p>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {skills.map((s, idx) => (
                  <div key={s.label}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 7,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: s.color,
                          fontFamily: "'Share Tech Mono',monospace",
                          fontWeight: 700,
                        }}
                      >
                        "
                        <span style={{ color: "rgba(255,255,255,0.7)" }}>
                          {s.label}
                        </span>
                        "
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "#f59e0b",
                          fontWeight: 900,
                        }}
                      >
                        {s.level}
                        <span style={{ color: "#475569" }}>%</span>
                      </span>
                    </div>
                    <div
                      style={{
                        height: 5,
                        borderRadius: 99,
                        background: "rgba(255,255,255,0.06)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        className="skill-fill"
                        style={{
                          height: "100%",
                          borderRadius: 99,
                          width: lightOn ? `${s.level}%` : "0%",
                          background: `linear-gradient(90deg,${s.color}80,${s.color})`,
                          boxShadow: `0 0 10px ${s.color}50`,
                          transitionDelay: `${0.5 + idx * 0.1}s`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: "#334155",
                  marginTop: 18,
                  fontFamily: "'Share Tech Mono',monospace",
                }}
              >
                <span style={{ color: "#6366f1" }}>$</span>{" "}
                <span className="terminal-cursor" style={{ color: "#64748b" }}>
                  ▋
                </span>
              </p>
            </div>
          </div>

          {/* ── PROJECT ── */}
          <div
            className="card"
            style={{
              borderRadius: 24,
              overflow: "hidden",
              marginBottom: 20,
              background: "rgba(99,102,241,0.04)",
              border: "1px solid rgba(99,102,241,0.18)",
              animation: lightOn ? "revealUp 0.7s ease 0.45s both" : "none",
            }}
          >
            <div
              style={{
                padding: "12px 20px",
                background: "rgba(99,102,241,0.08)",
                borderBottom: "1px solid rgba(99,102,241,0.12)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Laptop size={14} color="#a5b4fc" />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: "#a5b4fc",
                  letterSpacing: "0.12em",
                }}
              >
                CURRENT PROJECTS
              </span>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <div style={{ display: "grid", gap: 12 }}>
                {[
                  {
                    title: "Sensor Data System",
                    desc: "10+ sensor devices sending data to server, persisted in CSV/MySQL, visualized through dashboard pipelines.",
                    tags: ["ESP32", "Sensors", "MySQL", "Realtime Dashboard"],
                  },
                  {
                    title: "SAM Fine-Tuning Research",
                    desc: "Experimental architecture work with ConvLoRA, U-Net prompt generation, Prompt Adapters, VPT, and RL-based prompt optimization planning.",
                    tags: ["SAM", "ConvLoRA", "VPT", "Prompt Adapters", "RL"],
                  },
                  {
                    title: "Web Dashboard System",
                    desc: "Sidebar-centric data UI with dynamic backend fetching and planned admin/API architecture for robust operations.",
                    tags: ["React", "PHP", "Flask", "API Design", "Deployment"],
                  },
                ].map((project) => (
                  <div
                    key={project.title}
                    style={{
                      borderRadius: 16,
                      padding: 18,
                      background: "rgba(99,102,241,0.05)",
                      border: "1px solid rgba(99,102,241,0.12)",
                    }}
                  >
                    <h3
                      style={{
                        color: "white",
                        fontWeight: 900,
                        fontSize: 15,
                        marginBottom: 8,
                        fontFamily: "'Syne',sans-serif",
                      }}
                    >
                      {project.title}
                    </h3>
                    <p
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.45)",
                        lineHeight: 1.7,
                        marginBottom: 10,
                      }}
                    >
                      {project.desc}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {project.tags.map((t) => (
                        <span
                          key={t}
                          style={{
                            fontSize: 10,
                            padding: "3px 10px",
                            borderRadius: 99,
                            background: "rgba(99,102,241,0.18)",
                            color: "#a5b4fc",
                            fontWeight: 700,
                            border: "1px solid rgba(99,102,241,0.25)",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <div
            style={{
              textAlign: "center",
              animation: lightOn ? "revealUp 0.7s ease 0.55s both" : "none",
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "14px 26px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                marginBottom: 18,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: "#334155",
                  fontFamily: "'Share Tech Mono',monospace",
                  lineHeight: 1.8,
                }}
              >
                <span style={{ color: "#6366f1" }}>// </span>secret:{" "}
                <span style={{ color: "#f59e0b" }}>/secret-developer</span>
                <br />
                <span style={{ color: "#6366f1" }}>// </span>built with{" "}
                <span style={{ color: "#ef4444" }}>❤</span> by Abdullah
                <br />
                <span style={{ color: "#6366f1" }}>// </span>trajectory: AI
                Research Engineer {"->"} Applied ML Engineer {"->"} Systems + AI
                Hybrid
              </p>
            </div>
            <br />
            <a
              href="/"
              className="link-btn no-underline"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 24px",
                borderRadius: 12,
                background: "rgba(245,158,11,0.08)",
                color: "#f59e0b",
                border: "1px solid rgba(245,158,11,0.22)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#f59e0b";
                (e.currentTarget as HTMLElement).style.color = "#1f2937";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "rgba(245,158,11,0.08)";
                (e.currentTarget as HTMLElement).style.color = "#f59e0b";
              }}
            >
              ← BACK TO WEBSITE
            </a>
          </div>
        </div>
      </div>

      {/* Dark overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#020408",
          pointerEvents: "none",
          opacity: lightOn ? 0 : 0.93,
          transition: "opacity 0.7s ease",
          zIndex: 8,
        }}
      />
    </div>
  );
};

export default DeveloperProfile;
