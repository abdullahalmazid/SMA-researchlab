import React, { useState } from "react";

/**
 * The one hero every listing page uses, so they share height, type scale,
 * backdrop and spacing. Pages pass their own editable text as nodes; anything
 * page-specific (a CTA, a row of figures) goes in `children` below the subtitle.
 */
interface PageHeroProps {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Optional photo behind the hero. A gradient scrim keeps the text legible. */
  bannerUrl?: string;
  children?: React.ReactNode;
}

const PageHero: React.FC<PageHeroProps> = ({ title, eyebrow, subtitle, bannerUrl, children }) => {
  const [bannerErr, setBannerErr] = useState(false);
  const showBanner = Boolean(bannerUrl) && !bannerErr;

  return (
    <section
      className="relative flex min-h-[260px] items-center justify-center overflow-hidden px-4 py-14 text-center"
      style={{ background: "var(--color-primary)" }}
    >
      {showBanner && (
        <>
          <img
            src={bannerUrl}
            alt=""
            fetchPriority="high"
            decoding="async"
            onError={() => setBannerErr(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 60%, transparent) 0%, color-mix(in srgb, var(--color-primary) 88%, black) 100%)",
            }}
          />
        </>
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--hero-text) 60%, transparent) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute bottom-0 right-0 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--color-accent)", transform: "translate(30%, 40%)" }}
      />

      <div className="relative z-10 mx-auto w-full max-w-3xl">
        {eyebrow && (
          <div
            className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[color:color-mix(in_srgb,var(--hero-text)_80%,transparent)]"
            style={{ borderColor: "color-mix(in srgb, var(--hero-text) 20%, transparent)", background: "color-mix(in srgb, var(--hero-text) 7%, transparent)" }}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full motion-safe:animate-pulse"
              style={{ background: "var(--color-accent)" }}
            />
            {eyebrow}
          </div>
        )}

        <h1
          className="font-black leading-tight text-[color:var(--hero-text)]"
          style={{
            fontSize: "clamp(2rem, 4vw, 2.9rem)",
            fontFamily: "var(--font-heading)",
            letterSpacing: "-1px",
          }}
        >
          {title}
        </h1>

        <div className="mx-auto mt-4 h-1 w-16 rounded-full" style={{ background: "var(--color-accent)" }} />

        {subtitle && (
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-[color:color-mix(in_srgb,var(--hero-text)_75%,transparent)]">{subtitle}</p>
        )}

        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
};

export default PageHero;
