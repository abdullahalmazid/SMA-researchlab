// src/components/ContentBlocks.tsx
import React from "react";
import { useCollaborators, usePublications } from "../firebase/hooks";
import AppIcon, { type AppIconName } from "./AppIcon";
import EditableText from "./EditableText";
import PageHero from "./PageHero";

// --- Hero Block ---
export const HeroBlock: React.FC<{ blockId: string }> = ({ blockId }) => {
  return (
    <PageHero
      eyebrow={<EditableText id={`${blockId}-eyebrow`} defaultValue="Who we are" className="inline" />}
      title={<EditableText id={`${blockId}-title`} defaultValue="About the Lab" className="inline" />}
      subtitle={
        <EditableText
          id={`${blockId}-subtitle`}
          defaultValue="Advancing impactful research through collaboration, innovation, and responsible scientific practice."
          className="inline"
        />
      }
    />
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
        style={{ borderTop: "1px solid color-mix(in srgb, var(--hero-text) 10%, transparent)" }}
      >
        {stats.map((s, i) => (
          <div
            key={i}
            className="text-center py-6 px-4"
            style={{
              borderRight:
                i < stats.length - 1
                  ? "1px solid color-mix(in srgb, var(--hero-text) 10%, transparent)"
                  : "none",
            }}
          >
            <div className="mb-1 inline-flex text-[color:color-mix(in_srgb,var(--hero-text)_80%,transparent)]">
              <AppIcon name={s.icon} size={20} />
            </div>
            <div
              className="text-3xl font-black leading-none"
              style={{
                color: "var(--hero-accent)",
                fontFamily: "var(--font-heading)",
              }}
            >
              {s.value}
            </div>
            <div
              className="text-xs mt-1.5 font-medium"
              style={{ color: "color-mix(in srgb, var(--hero-text) 55%, transparent)" }}
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
      style={{ background: isEven ? "var(--site-surface)" : "var(--site-surface-alt)" }}
    >
      <div className="max-w-3xl mx-auto">
        <h2
          className="font-black text-2xl mb-4"
          style={{
            color: "var(--primary-ink)",
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
            className="text-[color:var(--hero-text)] font-black text-3xl"
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
              background: "color-mix(in srgb, var(--hero-text) 7%, transparent)",
              border: "1px solid color-mix(in srgb, var(--hero-text) 12%, transparent)",
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
              className="font-black text-xl text-[color:var(--hero-text)] mb-3"
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
              style={{ color: "color-mix(in srgb, var(--hero-text) 70%, transparent)", whiteSpace: "pre-line" }}
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
              background: "color-mix(in srgb, var(--hero-text) 7%, transparent)",
              border: "1px solid color-mix(in srgb, var(--hero-text) 12%, transparent)",
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
              className="font-black text-xl text-[color:var(--hero-text)] mb-3"
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
              style={{ color: "color-mix(in srgb, var(--hero-text) 70%, transparent)", whiteSpace: "pre-line" }}
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
    <section className="py-14 px-4" style={{ background: "var(--site-surface-alt)" }}>
      <div className="max-w-3xl mx-auto text-center">
        <h3
          className="font-black text-2xl mb-3"
          style={{
            color: "var(--primary-ink)",
            fontFamily: "var(--font-heading)",
          }}
        >
          <EditableText
            id={`${blockId}-title`}
            defaultValue="Want to collaborate?"
            className="inline"
          />
        </h3>
        <p className="text-sm mb-6 leading-relaxed text-[color:var(--site-muted)]">
          <EditableText
            id={`${blockId}-text`}
            defaultValue="Description text..."
            className="inline"
          />
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a
            href="/collaborators"
            className="no-underline font-bold text-sm px-7 py-3 rounded-xl shadow-md transition hover:brightness-105"
            style={{ background: "var(--color-accent)", color: "var(--on-accent)" }}
          >
            Meet the Team →
          </a>
        </div>
      </div>
    </section>
  );
};
