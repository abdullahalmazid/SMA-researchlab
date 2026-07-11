// src/components/ContentBlocks.tsx
import React from "react";
import { useCollaborators, usePublications } from "../firebase/hooks";
import AppIcon, { type AppIconName } from "./AppIcon";
import EditableText from "./EditableText";

// --- Hero Block ---
export const HeroBlock: React.FC<{ blockId: string }> = ({ blockId }) => {
  return (
    <section
      className="relative min-h-[320px] overflow-hidden px-4 py-20 text-center flex items-center justify-center"
      style={{ background: "var(--color-primary)" }}
    >
      <div className="relative z-10">
        <h1
          className="font-black text-white mb-4"
          style={{
            fontSize: "clamp(2.2rem, 4.5vw, 3.5rem)",
            fontFamily: "var(--font-heading)",
          }}
        >
          <EditableText
            id={`${blockId}-title`}
            defaultValue="About the Lab"
            className="inline"
          />
        </h1>
        <div
          className="mx-auto mb-5 h-1 w-16 rounded-full"
          style={{ background: "var(--color-accent)" }}
        />
        <p
          className="text-base max-w-2xl mx-auto leading-relaxed"
          style={{ color: "rgba(255,255,255,0.72)" }}
        >
          <EditableText
            id={`${blockId}-subtitle`}
            defaultValue="Advancing impactful research through collaboration, innovation, and responsible scientific practice."
            className="inline"
          />
        </p>
      </div>
    </section>
  );
};

// --- Stats Block ---
export const StatsBlock: React.FC<{ blockId: string }> = ({ blockId }) => {
  const { collaborators } = useCollaborators();
  const { ongoing, published } = usePublications();

  const stats = [
    {
      value: collaborators.length,
      label: "Collaborators",
      icon: "collaborators" as AppIconName,
    },
    {
      value: published.length,
      label: "Publications",
      icon: "paper" as AppIconName,
    },
    {
      value: ongoing.length,
      label: "Ongoing Projects",
      icon: "lab" as AppIconName,
    },
  ];

  return (
    <section style={{ background: "var(--color-primary)" }}>
      <div
        className="max-w-3xl mx-auto px-4 grid grid-cols-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}
      >
        {stats.map((s, i) => (
          <div
            key={i}
            className="text-center py-6 px-4"
            style={{
              borderRight:
                i < stats.length - 1
                  ? "1px solid rgba(255,255,255,0.1)"
                  : "none",
            }}
          >
            <div className="mb-1 inline-flex text-white/80">
              <AppIcon name={s.icon} size={20} />
            </div>
            <div
              className="text-3xl font-black leading-none"
              style={{
                color: "var(--color-accent)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {s.value}
            </div>
            <div
              className="text-xs mt-1.5 font-medium"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// --- Text Section Block ---
export const TextBlock: React.FC<{ blockId: string; index: number }> = ({
  blockId,
  index,
}) => {
  const isEven = index % 2 === 1;
  return (
    <section
      className="px-4 py-10 md:py-12"
      style={{ background: isEven ? "#ffffff" : "#f8fafc" }}
    >
      <div className="max-w-3xl mx-auto">
        <h2
          className="font-black text-2xl mb-4"
          style={{
            color: "var(--color-primary)",
            fontFamily: "var(--font-heading)",
          }}
        >
          <EditableText
            id={`${blockId}-title`}
            defaultValue="Who We Are"
            className="inline"
          />
        </h2>
        <p
          className="text-gray-600 leading-relaxed text-base"
          style={{ whiteSpace: "pre-line" }}
        >
          <EditableText
            id={`${blockId}-text`}
            defaultValue="We are a collaborative research group connecting researchers, students, and academic partners to investigate meaningful problems and translate ideas into useful knowledge."
            className="inline"
          />
        </p>
      </div>
    </section>
  );
};

// --- Mission & Vision Block ---
export const MissionVisionBlock: React.FC<{ blockId: string }> = ({
  blockId,
}) => {
  return (
    <section
      className="py-16 px-4"
      style={{
        background: "var(--color-primary)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-10">
          <h2
            className="text-white font-black text-3xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <EditableText
              id={`${blockId}-mainTitle`}
              defaultValue="Mission & Vision"
              className="inline"
            />
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Mission */}
          <div
            className="rounded-3xl p-8 relative overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
              style={{
                background:
                  "linear-gradient(90deg, var(--color-accent), #f97316)",
              }}
            />
            <h3
              className="font-black text-xl text-white mb-3"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <EditableText
                id={`${blockId}-missionTitle`}
                defaultValue="Our Mission"
                className="inline"
              />
            </h3>
            <p
              className="leading-relaxed text-sm"
              style={{ color: "rgba(255,255,255,0.7)", whiteSpace: "pre-line" }}
            >
              <EditableText
                id={`${blockId}-missionText`}
                defaultValue="To conduct rigorous, collaborative research that addresses real challenges, develops researchers, and contributes valuable knowledge to academia and society."
                className="inline"
              />
            </p>
          </div>

          {/* Vision */}
          <div
            className="rounded-3xl p-8 relative overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-1 rounded-t-3xl"
              style={{
                background:
                  "linear-gradient(90deg, var(--color-secondary), #6366f1)",
              }}
            />
            <h3
              className="font-black text-xl text-white mb-3"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <EditableText
                id={`${blockId}-visionTitle`}
                defaultValue="Our Vision"
                className="inline"
              />
            </h3>
            <p
              className="leading-relaxed text-sm"
              style={{ color: "rgba(255,255,255,0.7)", whiteSpace: "pre-line" }}
            >
              <EditableText
                id={`${blockId}-visionText`}
                defaultValue="To grow into a trusted, multidisciplinary research community recognized for quality, integrity, innovation, and positive impact."
                className="inline"
              />
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

// --- CTA Block ---
export const CTABlock: React.FC<{ blockId: string }> = ({ blockId }) => {
  return (
    <section className="py-14 px-4" style={{ background: "#f1f5f9" }}>
      <div className="max-w-3xl mx-auto text-center">
        <h3
          className="font-black text-2xl mb-3"
          style={{
            color: "var(--color-primary)",
            fontFamily: "var(--font-heading)",
          }}
        >
          <EditableText
            id={`${blockId}-title`}
            defaultValue="Want to collaborate?"
            className="inline"
          />
        </h3>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          <EditableText
            id={`${blockId}-text`}
            defaultValue="Description text..."
            className="inline"
          />
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a
            href="/collaborators"
            className="no-underline font-bold text-sm px-7 py-3 rounded-xl text-white"
            style={{ background: "var(--color-primary)" }}
          >
            Meet the Team →
          </a>
        </div>
      </div>
    </section>
  );
};
