import { doc, setDoc } from "./core/auditedFirestore";
import React, { useEffect, useMemo, useState } from "react";
import CloudinaryUpload from "../components/CloudinaryUpload";
import { db } from "../firebase/config";
import { useSiteContent } from "../firebase/hooks";
import type { CloudinaryUploadResult } from "../types";

type FieldType = "text" | "textarea" | "image" | "list";

interface ListColumn {
  key: string;
  label: string;
  /** Relative share of the row's width. Columns wrap on narrow screens. */
  width?: string;
}

interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  columns?: ListColumn[];
  addLabel?: string;
  /** Explicit grouping. Without it the section is guessed from the key. */
  section?: string;
}

interface FieldGroup {
  tab: string;
  fields: FieldConfig[];
}

/* ------------------------------------------------------------------ *
 * List rows
 *
 * The CV-style content on the Lab Head page is lists — appointments, degrees,
 * awards, grants, supervised theses. A single textarea can only hold those as
 * delimited text, where one stray comma silently breaks a row. This stores an
 * array of objects as JSON inside the same { value: string } document, so
 * Firestore's shape, useSiteContent and EditableText are all unchanged.
 * ------------------------------------------------------------------ */

type ListRow = Record<string, string>;

/** Rows collapse to one line each past this many — 26 supervised theses open at
 *  once buries every other field on the tab. */
const COLLAPSE_THRESHOLD = 6;

function parseRows(value: string): { rows: ListRow[]; malformed: boolean } {
  const raw = (value ?? "").trim();
  if (!raw) return { rows: [], malformed: false };
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { rows: [], malformed: true };
    return {
      rows: parsed.map((row) =>
        row && typeof row === "object" ? (row as ListRow) : {},
      ),
      malformed: false,
    };
  } catch {
    return { rows: [], malformed: true };
  }
}

/** "1.4fr" → 1.4. Used as a flex-grow, so columns share space on a wide screen
 *  and stack on a narrow one without needing a media query. */
const growOf = (width?: string) => Number.parseFloat(width ?? "1") || 1;

const summarise = (row: ListRow, columns: ListColumn[]) =>
  columns
    .slice(0, 2)
    .map((column) => (row[column.key] ?? "").trim())
    .filter(Boolean)
    .join("  ·  ");

const ROW_BTN =
  "rounded-lg px-2 py-1 text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed";

const ListEditor: React.FC<{
  columns: ListColumn[];
  value: string;
  onChange: (next: string) => void;
  addLabel?: string;
  compact?: boolean;
}> = ({ columns, value, onChange, addLabel = "row", compact }) => {
  const { rows, malformed } = parseRows(value);
  const [openRows, setOpenRows] = useState<Record<number, boolean>>({});

  const collapsible = rows.length > COLLAPSE_THRESHOLD;
  const isOpen = (index: number) => !collapsible || Boolean(openRows[index]);

  /* Any structural change reshuffles indices, so the open map is discarded
     rather than left pointing at whatever now sits at that position. */
  const write = (next: ListRow[], nextOpen: Record<number, boolean> = {}) => {
    setOpenRows(nextOpen);
    onChange(JSON.stringify(next));
  };

  const update = (index: number, key: string, next: string) =>
    onChange(
      JSON.stringify(
        rows.map((row, i) => (i === index ? { ...row, [key]: next } : row)),
      ),
    );

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    write(next, { [target]: true });
  };

  /* Rather than silently replacing content it can't read, show the raw text so
     nothing is lost and the damage is visible. */
  if (malformed) {
    return (
      <div>
        <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          This field isn&apos;t valid list data, so it&apos;s shown as raw text. Fix or clear it to
          get the row editor back — nothing has been overwritten.
        </p>
        <textarea
          rows={5}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border px-4 py-2.5 font-mono text-xs outline-none"
          style={{ borderColor: "#e5e7eb", resize: "vertical" }}
        />
      </div>
    );
  }

  const addRow = () =>
    write(
      [...rows, Object.fromEntries(columns.map((c) => [c.key, ""]))],
      { [rows.length]: true },
    );

  return (
    <div className="rounded-xl border" style={{ borderColor: "#eef2f7" }}>
      {/* Toolbar. The count is the point: it tells you what you're about to
          open without opening it. */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-t-xl border-b px-3 py-2"
        style={{ borderColor: "#eef2f7", background: "#f8fafc" }}
      >
        <span className="text-xs font-bold text-slate-600">
          {rows.length} {rows.length === 1 ? "entry" : "entries"}
        </span>

        {collapsible && (
          <>
            <button
              type="button"
              onClick={() =>
                setOpenRows(Object.fromEntries(rows.map((_, i) => [i, true])))
              }
              className={`${ROW_BTN} bg-white text-slate-600 ring-1 ring-slate-200`}
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={() => setOpenRows({})}
              className={`${ROW_BTN} bg-white text-slate-600 ring-1 ring-slate-200`}
            >
              Collapse all
            </button>
          </>
        )}

        <button
          type="button"
          onClick={addRow}
          className={`${ROW_BTN} ml-auto bg-indigo-600 text-white`}
        >
          + Add {addLabel}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-7 text-center text-xs text-gray-400">
          Nothing added yet. The website shows its built-in content until you add entries here.
        </p>
      ) : (
        <ol className={`flex flex-col ${compact ? "gap-1.5" : "gap-2"} p-3`}>
          {rows.map((row, index) => (
            <li
              key={index}
              className="rounded-lg border"
              style={{
                borderColor: isOpen(index) ? "#dbeafe" : "#eef2f7",
                background: isOpen(index) ? "#fbfcfe" : "white",
              }}
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="w-5 shrink-0 text-[11px] font-bold tabular-nums text-gray-400">
                  {index + 1}
                </span>

                {collapsible ? (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenRows((prev) => ({ ...prev, [index]: !prev[index] }))
                    }
                    aria-expanded={isOpen(index)}
                    className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-slate-700 hover:text-slate-900"
                  >
                    {summarise(row, columns) || (
                      <span className="text-gray-400">Empty entry</span>
                    )}
                  </button>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-500">
                    {summarise(row, columns)}
                  </span>
                )}

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move entry ${index + 1} up`}
                    className={`${ROW_BTN} bg-slate-100 text-slate-600`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === rows.length - 1}
                    aria-label={`Move entry ${index + 1} down`}
                    className={`${ROW_BTN} bg-slate-100 text-slate-600`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => write(rows.filter((_, i) => i !== index))}
                    aria-label={`Remove entry ${index + 1}`}
                    className={`${ROW_BTN} bg-rose-50 text-rose-700`}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {isOpen(index) && (
                /* Flex rather than a fixed grid: the widths act as flex-grow, so
                   columns share a wide row and wrap on a narrow one — a 4-column
                   grid on a phone gives you four unusable slivers. */
                <div className="flex flex-wrap gap-2 border-t px-3 py-3" style={{ borderColor: "#eef2f7" }}>
                  {columns.map((column) => (
                    <label
                      key={column.key}
                      className="block min-w-[170px]"
                      style={{ flex: `${growOf(column.width)} 1 170px` }}
                    >
                      <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-gray-400">
                        {column.label}
                      </span>
                      <input
                        type="text"
                        value={row[column.key] ?? ""}
                        onChange={(e) => update(index, column.key, e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                        style={{ borderColor: "#e5e7eb", background: "white" }}
                      />
                    </label>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Fields
 * ------------------------------------------------------------------ */

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
    /* Explicit sections here. Derived from the key, every one of these landed
       in a single "General" bucket of fourteen fields. */
    tab: "Lab Head",
    fields: [
      { section: "Identity", key: "labhead.name", label: "Full Name", type: "text" },
      { section: "Identity", key: "labhead.title", label: "Title / Position", type: "text" },
      {
        section: "Identity",
        key: "labhead.department",
        label: "Department & University",
        type: "text",
      },
      {
        section: "Identity",
        key: "labhead.photo",
        label: "Profile Photo",
        type: "image",
        hint: "Square, at least 400×400px. Shown at up to 320px on the profile page.",
      },

      {
        section: "Biography",
        key: "labhead.shortBio",
        label: "Short intro",
        type: "textarea",
        hint: "One or two sentences (about 200 characters). Shown on the Home page lab head card and under his name on the Lab head page. Leave empty to use the first sentences of the Biography.",
      },
      {
        section: "Biography",
        key: "labhead.fullBio",
        label: "Biography",
        type: "textarea",
        hint: "The full biography — shown once, in the Biography section of the Lab head page. Leave a blank line between paragraphs. If empty, his collaborator profile bio is used.",
      },
      {
        section: "Biography",
        key: "labhead.researchInterests",
        label: "Research Interests",
        type: "text",
        hint: "Comma separated. Each becomes a chip on the profile page.",
      },

      { section: "Contact & profiles", key: "labhead.email", label: "Email", type: "text" },
      { section: "Contact & profiles", key: "labhead.phone", label: "Phone", type: "text" },
      { section: "Contact & profiles", key: "labhead.linkedin", label: "LinkedIn URL", type: "text" },
      { section: "Contact & profiles", key: "labhead.scholar", label: "Google Scholar URL", type: "text" },
      { section: "Contact & profiles", key: "labhead.orcid", label: "ORCID URL", type: "text" },
      { section: "Contact & profiles", key: "labhead.researchgate", label: "ResearchGate URL", type: "text" },
      { section: "Contact & profiles", key: "labhead.scopus", label: "Scopus URL", type: "text" },

      /* Metrics — separate from the lists because these are the numbers that go
         stale, and the "as of" date is what stops them going stale silently. */
      {
        section: "Metrics",
        key: "labhead.metrics.citations",
        label: "Citations",
        type: "text",
        hint: "Google Scholar total, e.g. 12,160",
      },
      { section: "Metrics", key: "labhead.metrics.hIndex", label: "h-index", type: "text" },
      { section: "Metrics", key: "labhead.metrics.i10Index", label: "i10-index", type: "text" },
      {
        section: "Metrics",
        key: "labhead.metrics.publications",
        label: "Journal Articles",
        type: "text",
      },
      {
        section: "Metrics",
        key: "labhead.metrics.experienceYears",
        label: "Years in Teaching & Research",
        type: "text",
      },
      {
        section: "Metrics",
        key: "labhead.metrics.asOf",
        label: "Figures Accurate As Of",
        type: "text",
        hint: "Printed beside the metrics, e.g. August 2026. Update it whenever you update a number.",
      },

      {
        section: "Academic record",
        key: "labhead.appointments",
        label: "Academic Appointments",
        type: "list",
        addLabel: "appointment",
        columns: [
          { key: "period", label: "Period", width: "0.8" },
          { key: "role", label: "Role", width: "1" },
          { key: "organisation", label: "Organisation", width: "1.6" },
        ],
      },
      {
        section: "Academic record",
        key: "labhead.leadership",
        label: "Leadership Positions",
        type: "list",
        addLabel: "position",
        columns: [
          { key: "period", label: "Period", width: "0.8" },
          { key: "role", label: "Role", width: "1" },
          { key: "organisation", label: "Organisation", width: "1.6" },
        ],
      },
      {
        section: "Academic record",
        key: "labhead.education",
        label: "Education",
        type: "list",
        addLabel: "degree",
        columns: [
          { key: "year", label: "Year", width: "0.4" },
          { key: "degree", label: "Degree", width: "1.2" },
          { key: "institution", label: "Institution", width: "1.5" },
        ],
      },
      {
        section: "Academic record",
        key: "labhead.honours",
        label: "Honours & Awards",
        type: "list",
        addLabel: "honour",
        columns: [
          { key: "year", label: "Year", width: "0.4" },
          { key: "title", label: "Award", width: "1.6" },
          { key: "awardedBy", label: "Awarded by", width: "1.2" },
        ],
      },
      {
        section: "Academic record",
        key: "labhead.grants",
        label: "Research Funding",
        type: "list",
        addLabel: "grant",
        columns: [
          { key: "year", label: "Year", width: "0.5" },
          { key: "title", label: "Project", width: "2" },
          { key: "funder", label: "Funder", width: "1" },
          { key: "amount", label: "Amount", width: "0.7" },
        ],
      },
      {
        section: "Academic record",
        key: "labhead.editorial",
        label: "Editorial & Peer Review",
        type: "list",
        addLabel: "role",
        columns: [
          { key: "role", label: "Role", width: "1" },
          { key: "outlet", label: "Journal / Publisher", width: "2.2" },
        ],
      },
      {
        section: "Academic record",
        key: "labhead.supervision",
        label: "Graduate Supervision",
        type: "list",
        addLabel: "thesis",
        columns: [
          { key: "year", label: "Year", width: "0.4" },
          { key: "researcher", label: "Researcher", width: "1" },
          { key: "thesis", label: "Thesis", width: "2.6" },
        ],
      },
      {
        section: "Academic record",
        key: "labhead.collaborations",
        label: "International Collaborations",
        type: "list",
        addLabel: "institution",
        columns: [
          { key: "institution", label: "Institution", width: "2" },
          { key: "country", label: "Country", width: "1" },
        ],
      },
      {
        section: "Academic record",
        key: "labhead.venues",
        label: "Selected Journals",
        type: "list",
        addLabel: "journal",
        columns: [{ key: "name", label: "Journal" }],
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
    /* New: the Announcements page reads these and nothing could set them. */
    tab: "Announcements",
    fields: [
      { key: "announcements.pageTitle", label: "Page Title", type: "text" },
      {
        key: "announcements.pageSubtitle",
        label: "Page Subtitle",
        type: "text",
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
  {
    /* New: the Footer reads all four and there was no way to edit them. */
    tab: "Branding",
    fields: [
      { key: "branding.labName", label: "Lab Name", type: "text" },
      {
        key: "branding.institution",
        label: "Institution",
        type: "text",
        hint: "Shown under the lab name in the footer",
      },
      {
        key: "branding.logoUrl",
        label: "Logo",
        type: "image",
        hint: "Square, at least 128×128px. Without one, the lab's initial is used.",
      },
      { key: "footer.tagline", label: "Footer Tagline", type: "textarea" },
    ],
  },
];

/** Fallback only — fields can declare `section` instead. */
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

const sectionOf = (field: FieldConfig) => field.section ?? sectionTitleFromKey(field.key);

const ContentEditor: React.FC = () => {
  const { content } = useSiteContent();
  const [activeTab, setActiveTab] = useState("Home");
  const [activeSection, setActiveSection] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [baselineValues, setBaselineValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

    /* With nothing modified this used to fall through to writing *every* field
       from local state — which, before content had loaded, wrote empty strings
       over live values. */
    if (dirtyKeys.length === 0) {
      setNotice({ type: "success", text: "Nothing to publish — every field on this page is already saved." });
      return;
    }

    setSavingAll(true);
    setNotice(null);
    try {
      for (const key of dirtyKeys) {
        await saveField(key);
      }
      setNotice({ type: "success", text: `${dirtyKeys.length} field${dirtyKeys.length === 1 ? "" : "s"} published.` });
    } catch {
      // The field-level error contains the exact Firestore failure.
    } finally {
      setSavingAll(false);
    }
  };

  const resetFields = (groupFields: FieldConfig[]) => {
    setValues((prev) => {
      const next = { ...prev };
      groupFields.forEach((f) => (next[f.key] = baselineValues[f.key] ?? ""));
      return next;
    });
    setDirty((prev) => {
      const next = { ...prev };
      groupFields.forEach((f) => (next[f.key] = false));
      return next;
    });
  };

  const setFieldValue = (key: string, value: string) => {
    setValues((p) => ({ ...p, [key]: value }));
    setDirty((p) => ({ ...p, [key]: value !== (baselineValues[key] ?? "") }));
  };

  /* No non-null assertion: an unknown activeTab would have crashed the page. */
  const activeGroup = FIELD_GROUPS.find((g) => g.tab === activeTab) ?? FIELD_GROUPS[0];

  const sectionsOf = (group: FieldGroup) => {
    const grouped: [string, FieldConfig[]][] = [];
    group.fields.forEach((field) => {
      const section = sectionOf(field);
      const bucket = grouped.find(([name]) => name === section);
      if (bucket) bucket[1].push(field);
      else grouped.push([section, [field]]);
    });
    return grouped;
  };

  const activeSections = useMemo(() => sectionsOf(activeGroup), [activeGroup]);
  const currentSection =
    activeSections.find(([name]) => name === activeSection) ?? activeSections[0] ?? ["", []];

  const dirtyIn = (fields: FieldConfig[]) => fields.filter((f) => dirty[f.key]).length;
  const totalDirty = FIELD_GROUPS.reduce((sum, group) => sum + dirtyIn(group.fields), 0);
  const pageDirty = dirtyIn(activeGroup.fields);

  /* Search spans every page, so you don't have to know where a field lives. */
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return FIELD_GROUPS.flatMap((group) =>
      group.fields
        .filter(
          (field) =>
            field.label.toLowerCase().includes(q) ||
            field.key.toLowerCase().includes(q) ||
            (values[field.key] ?? "").toLowerCase().includes(q),
        )
        .map((field) => ({ group: group.tab, section: sectionOf(field), field })),
    );
  }, [searchQuery, values]);

  const selectPage = (tab: string) => {
    setActiveTab(tab);
    setActiveSection("");
    setSearchQuery("");
  };

  /* ── One field: label column + editor column, no nested cards. ── */
  const renderField = (field: FieldConfig, context?: string) => {
    const isDirty = Boolean(dirty[field.key]);
    return (
      <div key={field.key} className="grid gap-2 border-b border-slate-200 py-4 last:border-b-0 md:grid-cols-[220px_minmax(0,1fr)] md:gap-6">
        <div className="min-w-0">
          {context && <p className="m-0 mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{context}</p>}
          <label htmlFor={`field-${field.key}`} className="block text-[13.5px] font-semibold text-slate-800">
            {field.label}
          </label>
          <p className="m-0 mt-0.5 font-mono text-[11px] text-slate-400">{field.key}</p>
          {field.hint && <p className="m-0 mt-1.5 text-[12px] leading-relaxed text-slate-500">{field.hint}</p>}
        </div>

        <div className="min-w-0">
          {field.type === "image" ? (
            <div>
              <CloudinaryUpload
                currentUrl={values[field.key]}
                aspectHint={field.hint}
                onUpload={(r: CloudinaryUploadResult) => {
                  setFieldValue(field.key, r.secure_url);
                  void persistFieldValue(field.key, r.secure_url);
                }}
              />
              {values[field.key] && (
                <button
                  type="button"
                  onClick={() => {
                    setFieldValue(field.key, "");
                    void persistFieldValue(field.key, "");
                  }}
                  className="mt-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700"
                >
                  Remove image
                </button>
              )}
            </div>
          ) : field.type === "list" ? (
            <ListEditor
              columns={field.columns ?? [{ key: "value", label: "Value" }]}
              value={values[field.key] ?? ""}
              onChange={(next) => setFieldValue(field.key, next)}
              addLabel={field.addLabel}
              compact
            />
          ) : field.type === "textarea" ? (
            <>
              <textarea
                id={`field-${field.key}`}
                rows={4}
                value={values[field.key] ?? ""}
                onChange={(e) => setFieldValue(field.key, e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                style={{ resize: "vertical", fontFamily: "var(--font-body)" }}
                placeholder={`Enter ${field.label.toLowerCase()}…`}
              />
              <p className="m-0 mt-1 text-right text-[11px] text-slate-400">{(values[field.key] ?? "").length} chars</p>
            </>
          ) : (
            <input
              id={`field-${field.key}`}
              type="text"
              value={values[field.key] ?? ""}
              onChange={(e) => setFieldValue(field.key, e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder={`Enter ${field.label.toLowerCase()}…`}
            />
          )}

          {field.type !== "image" && (isDirty || saved[field.key]) && (
            <div className="mt-2 flex items-center gap-2">
              {isDirty && <span className="text-[12px] font-semibold text-amber-700">Unsaved</span>}
              {isDirty && (
                <button
                  type="button"
                  onClick={() => resetFields([field])}
                  className="rounded-md px-2 py-1 text-[12px] font-semibold text-slate-500 hover:text-slate-800"
                >
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={() => void saveField(field.key)}
                disabled={saving[field.key] || !isDirty}
                className="ml-auto rounded-md px-3 py-1 text-[12px] font-semibold text-white disabled:opacity-60"
                style={{ background: saved[field.key] ? "#16a34a" : "var(--color-primary)" }}
              >
                {saved[field.key] ? "✓ Saved" : saving[field.key] ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {notice && (
        <div
          role="status"
          className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-[13px] font-semibold ${
            notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-current opacity-60 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      {/* Toolbar: global search, unsaved count, page actions. */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search every field — label, key or current text…"
          aria-label="Search all content fields"
          className="h-9 min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
        />
        {totalDirty > 0 && (
          <span className="text-[12px] font-semibold text-amber-700">
            {totalDirty} unsaved across all pages
          </span>
        )}
        <button
          type="button"
          onClick={() => resetFields(activeGroup.fields)}
          disabled={pageDirty === 0}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600 disabled:opacity-40"
        >
          Discard page changes
        </button>
        <button
          type="button"
          onClick={() => void saveAll(activeGroup.fields)}
          disabled={savingAll || pageDirty === 0}
          className="h-9 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white disabled:opacity-40"
        >
          {savingAll ? "Publishing…" : pageDirty ? `Publish ${pageDirty} change${pageDirty === 1 ? "" : "s"}` : "All saved"}
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Page → section tree. On phones it's a horizontal strip. */}
        <nav aria-label="Pages and sections" className="lg:sticky lg:top-0 lg:self-start">
          <ul className="m-0 flex list-none gap-1 overflow-x-auto p-0 lg:flex-col lg:overflow-visible">
            {FIELD_GROUPS.map((group) => {
              const active = group.tab === activeGroup.tab && !searchResults;
              const pending = dirtyIn(group.fields);
              return (
                <li key={group.tab} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => selectPage(group.tab)}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] font-semibold transition ${
                      active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    <span className="flex-1 truncate">{group.tab}</span>
                    {pending > 0 ? (
                      <span className="text-[11px] font-bold text-amber-700">{pending}</span>
                    ) : (
                      <span className="hidden text-[11px] text-slate-400 lg:inline">{group.fields.length}</span>
                    )}
                  </button>
                  {active && (
                    <ul className="m-0 mb-1 ml-3 hidden list-none border-l border-slate-200 p-0 pl-2 lg:block">
                      {activeSections.map(([section, fields]) => {
                        const current = section === currentSection[0];
                        return (
                          <li key={section}>
                            <button
                              type="button"
                              onClick={() => setActiveSection(section)}
                              aria-current={current ? "true" : undefined}
                              className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[12.5px] ${
                                current ? "font-semibold text-indigo-700" : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              <span className="flex-1 truncate">{section}</span>
                              {dirtyIn(fields) > 0 ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="Unsaved" />
                              ) : (
                                <span className="text-[11px] text-slate-400">{fields.length}</span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white">
          {searchResults ? (
            <>
              <header className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5">
                <h3 className="m-0 text-[13.5px] font-semibold text-slate-800">
                  {searchResults.length} field{searchResults.length === 1 ? "" : "s"} match “{searchQuery.trim()}”
                </h3>
                <button type="button" onClick={() => setSearchQuery("")} className="ml-auto text-[12px] font-semibold text-slate-500 hover:text-slate-800">
                  Clear search
                </button>
              </header>
              <div className="px-4">
                {searchResults.length === 0 ? (
                  <p className="m-0 py-10 text-center text-sm text-slate-500">No field matches that search.</p>
                ) : (
                  searchResults.map(({ group, section, field }) => renderField(field, `${group} › ${section}`))
                )}
              </div>
            </>
          ) : (
            <>
              {/* Section tabs for phones (the tree covers desktop). */}
              <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 py-2 lg:hidden">
                {activeSections.map(([section]) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setActiveSection(section)}
                    className={`shrink-0 rounded-md px-2.5 py-1 text-[12.5px] font-semibold ${
                      section === currentSection[0] ? "bg-indigo-50 text-indigo-700" : "text-slate-500"
                    }`}
                  >
                    {section}
                  </button>
                ))}
              </div>
              <header className="flex flex-wrap items-baseline gap-x-2 border-b border-slate-200 px-4 py-2.5">
                <h3 className="m-0 text-[14px] font-semibold text-slate-800">
                  {activeGroup.tab} <span className="text-slate-400">›</span> {currentSection[0]}
                </h3>
                <span className="text-[12px] text-slate-500">
                  {currentSection[1].length} field{currentSection[1].length === 1 ? "" : "s"}
                </span>
              </header>
              <div className="px-4">{currentSection[1].map((field) => renderField(field))}</div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default ContentEditor;
