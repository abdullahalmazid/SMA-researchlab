import { doc, setDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import CloudinaryUpload from "../components/CloudinaryUpload";
import { db } from "../firebase/config";
import { useSiteContent } from "../firebase/hooks";
import type { CloudinaryUploadResult } from "../types";

type FieldType = "text" | "textarea" | "image";

interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
}

interface FieldGroup {
  tab: string;
  fields: FieldConfig[];
}

// All editable fields grouped by tab
const FIELD_GROUPS: FieldGroup[] = [
  {
    tab: "Home",
    fields: [
      { key: "home.heroTitle", label: "Hero Title", type: "text" },
      { key: "home.heroSubtitle", label: "Hero Subtitle", type: "text" },
      { key: "home.heroCta", label: "Hero CTA Button Text", type: "text" },
      {
        key: "home.bannerUrl",
        label: "Banner Image",
        type: "image",
        hint: "Recommended: 1600×600px, landscape",
      },
      {
        key: "home.introTitle",
        label: "Lab Intro Section Title",
        type: "text",
      },
      { key: "home.introText", label: "Lab Intro Text", type: "textarea" },
      {
        key: "home.announcementsTitle",
        label: "Announcements Section Title",
        type: "text",
      },
      {
        key: "home.statsLabel1",
        label: "Stats Label 1 (Collaborators)",
        type: "text",
      },
      {
        key: "home.statsLabel2",
        label: "Stats Label 2 (Publications)",
        type: "text",
      },
      {
        key: "home.statsLabel3",
        label: "Stats Label 3 (Ongoing)",
        type: "text",
      },
      { key: "home.statsLabel4", label: "Stats Label 4 (Ideas)", type: "text" },
    ],
  },
  {
    tab: "Lab Head",
    fields: [
      { key: "labhead.name", label: "Full Name", type: "text" },
      { key: "labhead.title", label: "Title / Position", type: "text" },
      {
        key: "labhead.department",
        label: "Department & University",
        type: "text",
      },
      {
        key: "labhead.photo",
        label: "Profile Photo",
        type: "image",
        hint: "Recommended: square, at least 400×400px",
      },
      {
        key: "labhead.shortBio",
        label: "Short Bio (shown on Home page)",
        type: "textarea",
      },
      {
        key: "labhead.fullBio",
        label: "Full Bio (shown on profile page)",
        type: "textarea",
      },
      { key: "labhead.email", label: "Email", type: "text" },
      { key: "labhead.phone", label: "Phone", type: "text" },
      { key: "labhead.linkedin", label: "LinkedIn URL", type: "text" },
      { key: "labhead.scholar", label: "Google Scholar URL", type: "text" },
      { key: "labhead.orcid", label: "ORCID URL", type: "text" },
      { key: "labhead.researchgate", label: "ResearchGate URL", type: "text" },
      {
        key: "labhead.researchInterests",
        label: "Research Interests (comma separated)",
        type: "text",
      },
    ],
  },
  {
    tab: "About",
    fields: [
      { key: "about.pageTitle", label: "Page Title", type: "text" },
      { key: "about.pageSubtitle", label: "Page Subtitle", type: "text" },
      { key: "about.section1Title", label: "Section 1 Title", type: "text" },
      { key: "about.section1Text", label: "Section 1 Text", type: "textarea" },
      { key: "about.section2Title", label: "Section 2 Title", type: "text" },
      { key: "about.section2Text", label: "Section 2 Text", type: "textarea" },
      { key: "about.section3Title", label: "Section 3 Title", type: "text" },
      { key: "about.section3Text", label: "Section 3 Text", type: "textarea" },
      { key: "about.missionTitle", label: "Mission Card Title", type: "text" },
      {
        key: "about.missionText",
        label: "Mission Card Text",
        type: "textarea",
      },
      { key: "about.visionTitle", label: "Vision Card Title", type: "text" },
      { key: "about.visionText", label: "Vision Card Text", type: "textarea" },
      {
        key: "about.bannerUrl",
        label: "Banner Image",
        type: "image",
        hint: "Recommended: 1600×400px, landscape",
      },
    ],
  },
  {
    tab: "Collaborators",
    fields: [
      { key: "collaborators.pageTitle", label: "Page Title", type: "text" },
      {
        key: "collaborators.pageSubtitle",
        label: "Page Subtitle",
        type: "text",
      },
      {
        key: "collaborators.requestTitle",
        label: "Join CTA Title",
        type: "text",
      },
      {
        key: "collaborators.requestSubtitle",
        label: "Join CTA Subtitle",
        type: "textarea",
      },
      {
        key: "collaborators.requestCta",
        label: "Join CTA Button Text",
        type: "text",
      },
      {
        key: "collaborators.bannerUrl",
        label: "Banner Image",
        type: "image",
        hint: "Recommended: 1600×400px, landscape",
      },
    ],
  },
  {
    tab: "Publications",
    fields: [
      { key: "publications.pageTitle", label: "Page Title", type: "text" },
      {
        key: "publications.pageSubtitle",
        label: "Page Subtitle",
        type: "text",
      },
      {
        key: "publications.ongoingTitle",
        label: "Ongoing Section Title",
        type: "text",
      },
      {
        key: "publications.ongoingSubtitle",
        label: "Ongoing Section Subtitle",
        type: "text",
      },
      {
        key: "publications.publishedTitle",
        label: "Published Section Title",
        type: "text",
      },
      {
        key: "publications.publishedSubtitle",
        label: "Published Section Subtitle",
        type: "text",
      },
      {
        key: "publications.bannerUrl",
        label: "Banner Image",
        type: "image",
        hint: "Recommended: 1600×400px, landscape",
      },
    ],
  },
  {
    tab: "Research Ideas",
    fields: [
      { key: "ideas.pageTitle", label: "Page Title", type: "text" },
      { key: "ideas.pageSubtitle", label: "Page Subtitle", type: "text" },
      { key: "ideas.postCta", label: "Post Button Text", type: "text" },
      { key: "ideas.emptyText", label: "Empty State Text", type: "text" },
      {
        key: "ideas.bannerUrl",
        label: "Banner Image",
        type: "image",
        hint: "Recommended: 1600×400px, landscape",
      },
    ],
  },
  {
    tab: "Gallery",
    fields: [
      { key: "gallery.pageTitle", label: "Page Title", type: "text" },
      { key: "gallery.pageSubtitle", label: "Page Subtitle", type: "text" },
      {
        key: "gallery.bannerUrl",
        label: "Banner Image",
        type: "image",
        hint: "Recommended: 1600×400px, landscape",
      },
    ],
  },
  {
    tab: "Contact",
    fields: [
      { key: "contact.pageTitle", label: "Page Title", type: "text" },
      { key: "contact.pageSubtitle", label: "Page Subtitle", type: "text" },
      { key: "contact.formTitle", label: "Form Section Title", type: "text" },
      { key: "contact.address", label: "Address", type: "textarea" },
      { key: "contact.email", label: "Contact Email", type: "text" },
      { key: "contact.phone", label: "Phone Number", type: "text" },
      { key: "contact.mapEmbed", label: "Google Maps Embed URL", type: "text" },
      {
        key: "contact.successMessage",
        label: "Form Success Message",
        type: "text",
      },
      {
        key: "contact.bannerUrl",
        label: "Banner Image",
        type: "image",
        hint: "Recommended: 1600×400px, landscape",
      },
    ],
  },
];

const sectionTitleFromKey = (key: string) => {
  const [, subKey = ""] = key.split(".");

  if (subKey.startsWith("hero")) return "Hero";
  if (subKey.startsWith("intro")) return "Intro";
  if (subKey.startsWith("stats")) return "Stats";
  if (subKey.startsWith("request")) return "Join CTA";
  if (subKey.startsWith("ongoing")) return "Ongoing";
  if (subKey.startsWith("published")) return "Published";
  if (subKey.startsWith("section1")) return "Section 1";
  if (subKey.startsWith("section2")) return "Section 2";
  if (subKey.startsWith("section3")) return "Section 3";
  if (subKey.startsWith("mission")) return "Mission";
  if (subKey.startsWith("vision")) return "Vision";
  if (subKey.includes("banner")) return "Banner";
  return "General";
};

const ContentEditor: React.FC = () => {
  const { content } = useSiteContent();
  const [activeTab, setActiveTab] = useState("Home");
  const [values, setValues] = useState<Record<string, string>>({});
  const [baselineValues, setBaselineValues] = useState<Record<string, string>>(
    {},
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [compactMode, setCompactMode] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Sync values from Firestore content
  useEffect(() => {
    const safeContent = Object.fromEntries(
      Object.entries(content).filter(([, v]) => v !== undefined),
    ) as Record<string, string>;

    setBaselineValues((prev) => ({ ...prev, ...safeContent }));
    setValues((prev) => ({ ...safeContent, ...prev }));
  }, [content]);

  const persistFieldValue = async (key: string, value: string) => {
    setSaving((p) => ({ ...p, [key]: true }));
    try {
      await setDoc(doc(db, "siteContent", key), { value }, { merge: true });
      setBaselineValues((p) => ({ ...p, [key]: value }));
      setDirty((p) => ({ ...p, [key]: false }));
      setSaved((p) => ({ ...p, [key]: true }));
      setTimeout(() => setSaved((p) => ({ ...p, [key]: false })), 2000);
    } catch (error) {
      setNotice({ type: "error", text: `Could not save ${key}: ${String((error as Error).message || error)}` });
      throw error;
    } finally {
      setSaving((p) => ({ ...p, [key]: false }));
    }
  };

  const saveField = async (key: string) => {
    await persistFieldValue(key, values[key] ?? "");
  };

  const saveAll = async (groupFields: FieldConfig[]) => {
    const dirtyKeys = groupFields.filter((f) => dirty[f.key]).map((f) => f.key);
    const keysToSave = dirtyKeys.length
      ? dirtyKeys
      : groupFields.map((f) => f.key);

    setSavingAll(true);
    setNotice(null);
    try {
      for (const key of keysToSave) {
        await saveField(key);
      }
      setNotice({ type: "success", text: `${keysToSave.length} field${keysToSave.length === 1 ? "" : "s"} saved successfully.` });
    } catch {
      // The field-level error contains the exact Firestore failure.
    } finally {
      setSavingAll(false);
    }
  };

  const resetTab = (groupFields: FieldConfig[]) => {
    setValues((prev) => {
      const next = { ...prev };
      groupFields.forEach((f) => {
        next[f.key] = baselineValues[f.key] ?? "";
      });
      return next;
    });
    setDirty((prev) => {
      const next = { ...prev };
      groupFields.forEach((f) => {
        next[f.key] = false;
      });
      return next;
    });
    setSaved((prev) => {
      const next = { ...prev };
      groupFields.forEach((f) => {
        next[f.key] = false;
      });
      return next;
    });
  };

  const setFieldValue = (key: string, value: string) => {
    setValues((p) => ({ ...p, [key]: value }));
    setDirty((p) => ({
      ...p,
      [key]: value !== (baselineValues[key] ?? ""),
    }));
  };

  const activeGroup = FIELD_GROUPS.find((g) => g.tab === activeTab)!;
  const activeDirtyCount = activeGroup.fields.filter(
    (f) => dirty[f.key],
  ).length;

  const fieldsBySection = useMemo(() => {
    const grouped: Record<string, FieldConfig[]> = {};
    activeGroup.fields.forEach((field) => {
      const section = sectionTitleFromKey(field.key);
      grouped[section] = [...(grouped[section] ?? []), field];
    });
    return Object.entries(grouped);
  }, [activeGroup]);

  useEffect(() => {
    setOpenSections((prev) => {
      const next: Record<string, boolean> = {};
      fieldsBySection.forEach(([section, fields]) => {
        const key = `${activeTab}:${section}`;
        const hasUnsaved = fields.some((field) => dirty[field.key]);
        next[key] = hasUnsaved ? true : (prev[key] ?? true);
      });
      return next;
    });
  }, [activeTab, fieldsBySection, dirty]);

  const tabDirtyCount = (tab: string) => {
    const group = FIELD_GROUPS.find((g) => g.tab === tab);
    if (!group) return 0;
    return group.fields.filter((f) => dirty[f.key]).length;
  };

  const sectionDirtyCount = (fields: FieldConfig[]) =>
    fields.filter((field) => dirty[field.key]).length;

  const toggleSection = (section: string) => {
    const key = `${activeTab}:${section}`;
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSections = (expanded: boolean) => {
    setOpenSections((prev) => {
      const next = { ...prev };
      fieldsBySection.forEach(([section]) => {
        next[`${activeTab}:${section}`] = expanded;
      });
      return next;
    });
  };

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return fieldsBySection;

    return fieldsBySection
      .map(([section, fields]) => {
        const matchedFields = fields.filter(
          (field) =>
            field.label.toLowerCase().includes(q) ||
            field.key.toLowerCase().includes(q),
        );
        return [section, matchedFields] as [string, FieldConfig[]];
      })
      .filter(([, fields]) => fields.length > 0);
  }, [fieldsBySection, searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim()) return;
    setOpenSections((prev) => {
      const next = { ...prev };
      filteredSections.forEach(([section]) => {
        next[`${activeTab}:${section}`] = true;
      });
      return next;
    });
  }, [activeTab, filteredSections, searchQuery]);

  const jumpToSection = (section: string) => {
    const key = `${activeTab}:${section}`;
    setOpenSections((prev) => ({ ...prev, [key]: true }));
    const el = sectionRefs.current[key];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      {notice && <div role="status" className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{notice.text}</div>}
      <section className="mb-6 overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-700 p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em]">Visual content studio</span>
          <h2 className="mt-4 text-3xl font-black tracking-tight">Edit the website by page</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-cyan-50/75">Choose a page, open a content card, preview its purpose, and publish only the fields you changed.</p>
        </div>
        <button
          onClick={() => saveAll(activeGroup.fields)}
          disabled={savingAll || activeDirtyCount === 0}
          className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-900 shadow-lg disabled:opacity-50"
        >
          {savingAll ? "Publishing…" : activeDirtyCount ? `Publish ${activeDirtyCount} change${activeDirtyCount === 1 ? "" : "s"}` : "Everything saved"}
        </button>
        </div>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {FIELD_GROUPS.map((group) => { const changed = tabDirtyCount(group.tab); const selected = group.tab === activeTab; return <button type="button" key={`page-card-${group.tab}`} onClick={() => setActiveTab(group.tab)} className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${selected ? "border-indigo-400 bg-indigo-50 ring-4 ring-indigo-100" : "border-slate-200 bg-white hover:border-indigo-200"}`}><span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black ${selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>{group.tab.slice(0, 1)}</span><span className="block text-sm font-black text-slate-900">{group.tab}</span><span className={`mt-1 block text-[11px] font-bold ${changed ? "text-amber-600" : "text-slate-400"}`}>{changed ? `${changed} unsaved` : `${group.fields.length} fields`}</span></button>; })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div
            className="sticky top-4 rounded-[22px] border border-slate-200 bg-slate-950 p-3 text-white shadow-xl"
          >
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
              Sections
            </p>
            <div className="flex flex-col gap-1.5">
              {FIELD_GROUPS.map((g) => (
                <button
                  key={g.tab}
                  onClick={() => setActiveTab(g.tab)}
                  className="flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-bold transition-colors"
                  style={{
                    background: activeTab === g.tab ? "linear-gradient(135deg,#4f46e5,#0891b2)" : "transparent",
                    color: activeTab === g.tab ? "white" : "#cbd5e1",
                    borderColor:
                      activeTab === g.tab ? "#6366f1" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    {g.tab}
                    {g.tab === "Lab Head" && (
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded-full"
                        style={{
                          background:
                            activeTab === g.tab
                              ? "rgba(255,255,255,0.2)"
                              : "var(--color-accent)",
                          color: activeTab === g.tab ? "white" : "#1f2937",
                        }}
                      >
                        New
                      </span>
                    )}
                  </span>
                  {tabDirtyCount(g.tab) > 0 && (
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded-full"
                      style={{
                        background:
                          activeTab === g.tab
                            ? "rgba(255,255,255,0.2)"
                            : "#fee2e2",
                        color: activeTab === g.tab ? "white" : "#991b1b",
                      }}
                    >
                      {tabDirtyCount(g.tab)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div>
          {/* Mobile tab pills */}
          <div className="flex flex-wrap gap-2 mb-8 lg:hidden">
            {FIELD_GROUPS.map((g) => (
              <button
                key={g.tab}
                onClick={() => setActiveTab(g.tab)}
                className="text-sm font-bold px-4 py-2 rounded-xl border transition-colors"
                style={{
                  background:
                    activeTab === g.tab ? "var(--color-primary)" : "white",
                  color: activeTab === g.tab ? "white" : "#374151",
                  borderColor:
                    activeTab === g.tab ? "var(--color-primary)" : "#e5e7eb",
                  cursor: "pointer",
                }}
              >
                {g.tab}
                {tabDirtyCount(g.tab) > 0 && (
                  <span
                    className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full"
                    style={{
                      background:
                        activeTab === g.tab
                          ? "rgba(255,255,255,0.2)"
                          : "#fee2e2",
                      color: activeTab === g.tab ? "white" : "#991b1b",
                    }}
                  >
                    {tabDirtyCount(g.tab)}
                  </span>
                )}
                {g.tab === "Lab Head" && (
                  <span
                    className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      background: "var(--color-accent)",
                      color: "#1f2937",
                    }}
                  >
                    New
                  </span>
                )}
              </button>
            ))}
          </div>

          <div
            className="mb-5 rounded-2xl border bg-white p-4 flex flex-wrap items-center justify-between gap-3"
            style={{ borderColor: "#e5e7eb" }}
          >
            <div>
              <p className="text-sm font-bold text-gray-800">
                {activeTab} Content
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {activeDirtyCount > 0
                  ? `${activeDirtyCount} unsaved field${activeDirtyCount > 1 ? "s" : ""}`
                  : "All fields saved"}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setCompactMode((v) => !v)}
                className="text-xs font-bold px-4 py-2 rounded-lg border"
                style={{
                  borderColor: compactMode ? "var(--color-primary)" : "#d1d5db",
                  background: compactMode ? "#eff6ff" : "white",
                  color: compactMode ? "var(--color-primary)" : "#374151",
                }}
              >
                {compactMode ? "Comfortable" : "Compact"}
              </button>
              <button
                type="button"
                onClick={() => setAllSections(false)}
                className="text-xs font-bold px-4 py-2 rounded-lg border"
                style={{
                  borderColor: "#d1d5db",
                  background: "white",
                  color: "#374151",
                }}
              >
                Collapse All
              </button>
              <button
                type="button"
                onClick={() => setAllSections(true)}
                className="text-xs font-bold px-4 py-2 rounded-lg border"
                style={{
                  borderColor: "#d1d5db",
                  background: "white",
                  color: "#374151",
                }}
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={() => resetTab(activeGroup.fields)}
                disabled={activeDirtyCount === 0}
                className="text-xs font-bold px-4 py-2 rounded-lg border disabled:opacity-50"
                style={{
                  borderColor: "#d1d5db",
                  background: "white",
                  color: "#374151",
                }}
              >
                Reset Changes
              </button>
              <button
                type="button"
                onClick={() => saveAll(activeGroup.fields)}
                disabled={savingAll}
                className="text-xs font-bold px-4 py-2 rounded-lg text-white disabled:opacity-60"
                style={{ background: "var(--color-primary)", border: "none" }}
              >
                {savingAll ? "Saving..." : "Save Tab"}
              </button>
            </div>
          </div>

          <div
            className="mb-4 rounded-2xl border bg-white p-3"
            style={{ borderColor: "#e5e7eb" }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search field by label or key (e.g. hero, banner, contact.email)..."
                className="min-w-[260px] flex-1 rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "#e5e7eb" }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-xs font-bold px-3 py-2 rounded-lg border"
                  style={{
                    borderColor: "#d1d5db",
                    background: "white",
                    color: "#374151",
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {filteredSections.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {filteredSections.map(([section, fields]) => (
                  <button
                    key={`jump-${section}`}
                    type="button"
                    onClick={() => jumpToSection(section)}
                    className="rounded-full border px-3 py-1 text-xs font-semibold"
                    style={{
                      borderColor: "#d1d5db",
                      background: "white",
                      color: "#374151",
                    }}
                  >
                    {section} ({fields.length})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-5">
            {filteredSections.map(([section, fields]) => (
              <div
                key={section}
                ref={(el) => {
                  sectionRefs.current[`${activeTab}:${section}`] = el;
                }}
                className={`overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm transition hover:shadow-md ${compactMode ? "p-3" : "p-5"}`}
              >
                <button
                  type="button"
                  onClick={() => toggleSection(section)}
                  className="mb-1 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/60 px-4 py-3 text-left hover:border-indigo-200"
                >
                  <span>
                    <span className="text-sm font-black text-gray-900">
                      {section}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {fields.length} editable field
                      {fields.length > 1 ? "s" : ""}
                      {sectionDirtyCount(fields) > 0
                        ? ` · ${sectionDirtyCount(fields)} unsaved`
                        : ""}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-gray-500">
                    {openSections[`${activeTab}:${section}`] ? "−" : "+"}
                  </span>
                </button>

                {openSections[`${activeTab}:${section}`] && (
                  <div
                    className={`mt-4 flex flex-col ${compactMode ? "gap-2" : "gap-4"}`}
                  >
                    {fields.map((field) => (
                      <div
                        key={field.key}
                        className={`rounded-xl border ${compactMode ? "p-3" : "p-4"}`}
                        style={{ borderColor: "#eef2f7" }}
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <label className="text-sm font-bold text-gray-800">
                              {field.label}
                            </label>
                            {!compactMode && (
                              <p className="text-xs text-gray-400 mt-0.5 font-mono">
                                {field.key}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {dirty[field.key] && (
                              <span
                                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                                style={{
                                  background: "#fff7ed",
                                  color: "#9a3412",
                                }}
                              >
                                Unsaved
                              </span>
                            )}
                            <button
                              onClick={() => saveField(field.key)}
                              disabled={saving[field.key]}
                              className="text-xs font-bold px-4 py-1.5 rounded-lg text-white disabled:opacity-60"
                              style={{
                                background: saved[field.key]
                                  ? "#22c55e"
                                  : "var(--color-primary)",
                                border: "none",
                                cursor: "pointer",
                                minWidth: 74,
                              }}
                            >
                              {saved[field.key]
                                ? "✓ Saved"
                                : saving[field.key]
                                  ? "..."
                                  : "Save"}
                            </button>
                          </div>
                        </div>

                        {field.type === "image" ? (
                          <div>
                            <CloudinaryUpload
                              currentUrl={values[field.key]}
                              aspectHint={field.hint}
                              onUpload={(r: CloudinaryUploadResult) => {
                                const nextValue = r.secure_url;
                                setFieldValue(field.key, nextValue);
                                void persistFieldValue(field.key, nextValue);
                              }}
                            />
                            {values[field.key] && (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextValue = "";
                                  setFieldValue(field.key, nextValue);
                                  void persistFieldValue(field.key, nextValue);
                                }}
                                className="mt-2 text-xs font-bold px-4 py-1.5 rounded-lg border-none cursor-pointer"
                                style={{
                                  background: "#fee2e2",
                                  color: "#991b1b",
                                }}
                              >
                                Remove Image
                              </button>
                            )}
                          </div>
                        ) : field.type === "textarea" ? (
                          <div>
                            <textarea
                              rows={5}
                              value={values[field.key] ?? ""}
                              onChange={(e) =>
                                setFieldValue(field.key, e.target.value)
                              }
                              className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none"
                              style={{
                                borderColor: "#e5e7eb",
                                resize: "vertical",
                                fontFamily: "var(--font-body)",
                              }}
                              placeholder={`Enter ${field.label.toLowerCase()}...`}
                            />
                            <p className="text-[11px] text-gray-400 mt-1 text-right">
                              {(values[field.key] ?? "").length} chars
                            </p>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={values[field.key] ?? ""}
                            onChange={(e) =>
                              setFieldValue(field.key, e.target.value)
                            }
                            className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none"
                            style={{ borderColor: "#e5e7eb" }}
                            placeholder={`Enter ${field.label.toLowerCase()}...`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {filteredSections.length === 0 && (
              <div
                className="rounded-2xl border bg-white p-8 text-center"
                style={{ borderColor: "#e5e7eb" }}
              >
                <p className="text-sm font-semibold text-gray-700">
                  No matching fields found.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Try a different keyword like hero, title, banner, or
                  contact.email.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentEditor;
