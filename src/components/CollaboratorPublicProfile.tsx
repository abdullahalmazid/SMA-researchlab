import React, { useMemo, useState } from "react";
import type { CollaboratorProfile, CollaboratorPublication, GalleryItem } from "../types";
import AppIcon, { type AppIconName } from "./AppIcon";

const CollaboratorPublicProfile: React.FC<{
  c: CollaboratorProfile;
  linkedPublications: CollaboratorPublication[];
  galleryItems?: GalleryItem[];
  onBack: () => void;
}> = ({ c, linkedPublications, galleryItems = [], onBack }) => {
  const [imgErr, setImgErr] = useState(false);
  const mergedPublications = useMemo(() => {
    const all = [...(c.publications ?? []), ...(linkedPublications ?? [])];
    const seen = new Set<string>();

    const unique = all.filter((item) => {
      const key = `${item.id ?? ""}::${String(item.title ?? "Untitled publication").trim().toLowerCase()}::${
        item.year ?? 0
      }::${(item.url ?? "").trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  }, [c.publications, linkedPublications]);

  const initials = (c.name || "Unknown")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div>
      <div
        className="relative overflow-hidden px-4 py-16 text-center md:py-20"
        style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))" }}
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative z-10">
        {c.photo && !imgErr ? (
          <img
            src={c.photo}
            alt={c.name}
            onError={() => setImgErr(true)}
            className="w-32 h-32 rounded-full object-cover border-4 border-white mx-auto mb-4"
          />
        ) : (
          <div
            className="w-32 h-32 rounded-full flex items-center justify-center text-white text-4xl font-black border-4 border-white mx-auto mb-4"
            style={{ background: "var(--color-secondary)" }}
          >
            {initials}
          </div>
        )}
        <h1 className="text-white font-black text-3xl">{c.name}</h1>
        <p
          className="mt-1"
          style={{ color: "var(--color-accent)", fontWeight: 700 }}
        >
          {c.designation}
        </p>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>
          {c.affiliation}
        </p>
        <div className="mx-auto mt-6 grid max-w-xl grid-cols-3 overflow-hidden rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm">
          {[{ value: mergedPublications.length, label: "Publications" }, { value: c.researchInterests?.length ?? 0, label: "Research areas" }, { value: galleryItems.length, label: "Gallery" }].map((stat) => (
            <div key={stat.label} className="px-2 py-3 text-white [&:not(:last-child)]:border-r [&:not(:last-child)]:border-white/15">
              <p className="text-xl font-black">{stat.value}</p><p className="text-[10px] font-bold uppercase tracking-wider text-white/65">{stat.label}</p>
            </div>
          ))}
        </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
        <button
          onClick={onBack}
          className="mb-8 flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm shadow-sm border bg-white hover:bg-gray-100 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent transition-all"
          style={{
            borderColor: "var(--color-navbar)",
            color: "var(--color-primary)",
            fontFamily: "var(--font-heading)",
            fontWeight: 700,
            width: "fit-content",
          }}
        >
          <AppIcon name="back" size={18} style={{ marginRight: 2 }} />
          Back to Collaborators
        </button>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <h2
              className="font-black text-xl mb-3"
              style={{ color: "var(--color-primary)" }}
            >
              About
            </h2>
            <p
              className="text-gray-700 leading-relaxed mb-8"
              style={{ whiteSpace: "pre-line" }}
            >
              {c.bio}
            </p>
            {c.researchInterests?.length > 0 && (
              <>
                <h3
                  className="font-bold text-base mb-3"
                  style={{ color: "var(--color-primary)" }}
                >
                  Research Interests
                </h3>
                <div className="flex flex-wrap gap-2 mb-8">
                  {c.researchInterests.map((r) => (
                    <span
                      key={r}
                      className="text-xs px-3 py-1 rounded-full font-medium"
                      style={{ background: "#eff6ff", color: "#1d4ed8" }}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </>
            )}
            {mergedPublications.length > 0 && (
              <>
                <h3
                  className="font-bold text-base mb-4"
                  style={{ color: "var(--color-primary)" }}
                >
                  Publications
                </h3>
                <div className="flex flex-col gap-3">
                  {mergedPublications.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white rounded-xl p-4 shadow-sm border-l-4"
                      style={{ borderColor: "var(--color-secondary)" }}
                    >
                      {p.url ? (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-sm no-underline hover:underline"
                          style={{ color: "var(--color-primary)" }}
                        >
                          {p.title}
                        </a>
                      ) : (
                        <p
                          className="font-bold text-sm"
                          style={{ color: "var(--color-primary)" }}
                        >
                          {p.title}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {p.journal} · {p.year}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
            <h3
              className="font-bold text-base mb-4"
              style={{ color: "var(--color-primary)" }}
            >
              Links
            </h3>
            <div className="flex flex-col gap-2">
              {[
                {
                  href: c.linkedin,
                  label: "LinkedIn",
                  icon: "linkedin" as AppIconName,
                },
                {
                  href: c.scholar,
                  label: "Google Scholar",
                  icon: "scholar" as AppIconName,
                },
                {
                  href: c.orcid,
                  label: "ORCID",
                  icon: "orcid" as AppIconName,
                },
                {
                  href: c.researchgate,
                  label: "ResearchGate",
                  icon: "researchgate" as AppIconName,
                },
                {
                  href: c.facebook,
                  label: "Facebook",
                  icon: "facebook" as AppIconName,
                },
              ]
                .filter((l) => l.href)
                .map((l) => (
                  <div key={l.label}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 no-underline transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm"
                      style={{
                        background: "#fff",
                        color: "#111827",
                      }}
                    >
                      <AppIcon name={l.icon} size={18} />
                      <span>{l.label}</span>
                    </a>
                  </div>
                ))}
            </div>
            {c.email && <a href={`mailto:${c.email}`} className="mt-5 flex items-center justify-center rounded-xl px-4 py-3 text-sm font-black text-white no-underline" style={{ background: "var(--color-primary)" }}>Contact researcher</a>}
          </aside>
        </div>
        {galleryItems.length > 0 && <section className="mt-12 border-t border-slate-200 pt-8">
          <div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-sky-600">Contributor gallery</p><h2 className="mt-1 text-2xl font-black text-slate-900">Research moments by {c.name}</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{galleryItems.length} images</span></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {galleryItems.slice(0, 9).map((item) => <a key={item.id} href={item.imageUrl} target="_blank" rel="noreferrer" className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 shadow-sm"><img src={item.imageUrl} alt={item.title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-8 text-xs font-bold text-white">{item.title}</span></a>)}
          </div>
        </section>}
      </div>
    </div>
  );
};

export default CollaboratorPublicProfile;
