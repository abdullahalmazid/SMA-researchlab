import { doc, setDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
        label: "Short Bio",
        type: "textarea",
        hint: "Also used on the Home page hero card, where it clamps to four lines — keep it to roughly 60 words.",
      },
      {
        section: "Biography",
        key: "labhead.fullBio",
        label: "Full Bio",
        type: "textarea",
        hint: "Shown on the profile page beneath the short bio. Leave a blank line between paragraphs.",
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

    /* Previously, with nothing modified this fell through to writing *every*
       field on the tab from local state — which, if it ran before content had
       loaded, wrote empty strings over live values. */
    if (dirtyKeys.length === 0) {
      setNotice({ type: "success", text: "Nothing to publish — every field on this tab is already saved." });
      return;
    }

    setSavingAll(true);
    setNotice(null);
    try {
      for (const key of dirtyKeys) {
        await saveField(key);
      }
      setNotice({ type: "success", text: `${dirtyKeys.length} field${dirtyKeys.length === 1 ? "" : "s"} saved successfully.` });
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

  /* No non-null assertion: an unknown activeTab would have crashed the page. */
  const activeGroup =
    FIELD_GROUPS.find((g) => g.tab === activeTab) ?? FIELD_GROUPS[0];
  const activeDirtyCount = activeGroup.fields.filter(
    (f) => dirty[f.key],
  ).length;

  const fieldsBySection = useMemo(() => {
    const grouped: Record<string, FieldConfig[]> = {};
    activeGroup.fields.forEach((field) => {
      const section = sectionOf(field);
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

  /** Shared by the field header and, for lists, repeated at the bottom — a
   *  26-row list puts the header's Save button several screens away. */
  const saveButton = (field: FieldConfig) => (
    <button
      type="button"
      onClick={() => saveField(field.key)}
      disabled={saving[field.key]}
      className="text-xs font-bold px-4 py-1.5 rounded-lg text-white disabled:opacity-60"
      style={{
        background: saved[field.key] ? "#22c55e" : "var(--color-primary)",
        border: "none",
        cursor: "pointer",
        minWidth: 74,
      }}
    >
      {saved[field.key] ? "✓ Saved" : saving[field.key] ? "..." : "Save"}
    </button>
  );

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
              Pages
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
                    {(g.tab === "Announcements" || g.tab === "Branding") && (
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

            {/* Section jump list. On a tab with five sections and twenty-nine
                fields, scrolling to find one is the slowest part of the job. */}
            {fieldsBySection.length > 1 && (
              <>
                <p className="mt-4 px-2 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                  {activeTab} sections
                </p>
                <div className="flex flex-col gap-1">
                  {fieldsBySection.map(([section, fields]) => (
                    <button
                      key={`side-${section}`}
                      type="button"
                      onClick={() => jumpToSection(section)}
                      className="flex items-center justify-between rounded-lg px-3 py-1.5 text-left text-[12.5px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
                    >
                      <span className="truncate">{section}</span>
                      <span className="ml-2 shrink-0 text-[11px] tabular-nums text-slate-500">
                        {sectionDirtyCount(fields) > 0
                          ? `${sectionDirtyCount(fields)} ●`
                          : fields.length}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
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
              <label htmlFor="content-search" className="sr-only">
                Search fields
              </label>
              <input
                id="content-search"
                type="search"
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
                style={{ scrollMarginTop: 16 }}
              >
                <button
                  type="button"
                  onClick={() => toggleSection(section)}
                  aria-expanded={Boolean(openSections[`${activeTab}:${section}`])}
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
                            {saveButton(field)}
                          </div>
                        </div>

                        {field.hint && (
                          <p className="mb-3 text-xs leading-relaxed text-gray-400">
                            {field.hint}
                          </p>
                        )}

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
                        ) : field.type === "list" ? (
                          <>
                            <ListEditor
                              columns={field.columns ?? [{ key: "value", label: "Value" }]}
                              value={values[field.key] ?? ""}
                              onChange={(next) => setFieldValue(field.key, next)}
                              addLabel={field.addLabel}
                              compact={compactMode}
                            />
                            {dirty[field.key] && (
                              <div className="mt-3 flex items-center gap-3">
                                <span className="text-xs font-semibold text-amber-700">
                                  Unsaved changes to this list
                                </span>
                                <span className="ml-auto">{saveButton(field)}</span>
                              </div>
                            )}
                          </>
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
