import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { cld } from "../cloudinary";
import AppIcon from "../components/AppIcon";
import EditableText from "../components/EditableText";
import { useThemeContext } from "../context/ThemeContext";
import { useCollaborators, useSiteContent } from "../firebase/hooks";

interface LabHeadData {
  name: string;
  title: string;
  department: string;
  photo: string;
  shortBio: string;
  fullBio: string;
  email: string;
  phone: string;
  linkedin: string;
  scholar: string;
  orcid: string;
  researchgate: string;
  scopus: string;
  researchInterests: string;
}

/* ------------------------------------------------------------------ *
 * Record data
 *
 * The lists below are the defaults — the page is complete on deploy with no
 * data entry. The Lab Head tab of the Content Editor writes the same shapes as
 * JSON, and an admin's rows replace the matching default outright.
 * ------------------------------------------------------------------ */

type Row = Record<string, string>;

/** Falls back whenever the stored value is empty, unparseable, or an empty list. */
function rowsFrom(value: string | undefined, fallback: Row[]): Row[] {
  const raw = (value ?? "").trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const clean = parsed.filter((row): row is Row => Boolean(row) && typeof row === "object");
    return clean.length > 0 ? clean : fallback;
  } catch {
    return fallback;
  }
}

const DEFAULT_APPOINTMENTS: Row[] = [
  { period: "2019 — present", role: "Professor", organisation: "Department of Industrial and Production Engineering, BUET" },
  { period: "2016 — 2019", role: "Associate Professor", organisation: "Department of Industrial and Production Engineering, BUET" },
  { period: "2010 — 2016", role: "Assistant Professor", organisation: "Department of Industrial and Production Engineering, BUET" },
  { period: "2007 — 2010", role: "Lecturer", organisation: "Department of Industrial and Production Engineering, BUET" },
];

const DEFAULT_LEADERSHIP: Row[] = [
  { period: "2023 — 2025", role: "Chairman (Head)", organisation: "Department of Industrial and Production Engineering, BUET" },
  { period: "2022 — 2024", role: "Provost", organisation: "Dr. M. A. Rashid Hall, BUET" },
  { period: "2017 — 2020", role: "Assistant Provost", organisation: "Dr. M. A. Rashid Hall, BUET" },
];

const DEFAULT_EDUCATION: Row[] = [
  { year: "2016", degree: "PhD, Supply Chain Management", institution: "Nagoya Institute of Technology, Japan" },
  { year: "2009", degree: "MSc, Industrial and Production Engineering", institution: "BUET, Dhaka" },
  { year: "2007", degree: "BSc, Industrial and Production Engineering", institution: "BUET, Dhaka" },
];

const DEFAULT_HONOURS: Row[] = [
  { year: "2023", title: "Outstanding Researcher Award", awardedBy: "IEOM Society International" },
  { year: "2022 — present", title: "Listed among the world's top 2% of scientists", awardedBy: "Standardized citation indicator databases" },
  { year: "2021", title: "Forum 86 Research Excellence Award 2020", awardedBy: "Forum '86, BUET" },
  { year: "2012 — 2016", title: "Doctoral Fellowship", awardedBy: "MEXT, Government of Japan" },
  { year: "2002 — 2007", title: "University Merit Scholarship", awardedBy: "BUET" },
  { year: "2002 — 2007", title: "Dean's List Scholarship", awardedBy: "BUET" },
  { year: "", title: "Honours in the BSc and MSc examinations", awardedBy: "BUET" },
];

const DEFAULT_GRANTS: Row[] = [
  {
    year: "2025 — present",
    title: "Technology Business Incubators for Innovation and Commercialization in Bangladesh",
    funder: "HEAT Grant, University Grants Commission",
    amount: "BDT 39.99 million",
  },
  {
    year: "2022 — 2023",
    title: "Framework for Implementing Circular Supply Chain in the Readymade Garment Industry: Implications for Sustainable Development Goals",
    funder: "RISE, BUET",
    amount: "BDT 820,000",
  },
  {
    year: "2017 — 2018",
    title: "Analysis of Supply Chain Risk and Critical Success Factors in the Ready-Made Garments Industry in Bangladesh",
    funder: "BUET",
    amount: "BDT 207,500",
  },
];

const DEFAULT_EDITORIAL: Row[] = [
  { role: "Leading Guest Editor", outlet: "International Journal of Emerging Markets (Emerald)" },
  { role: "Leading Guest Editor", outlet: "Frontiers in Sustainability (Frontiers)" },
  { role: "Guest Editor", outlet: "Sustainability (MDPI)" },
  { role: "Guest Editor", outlet: "Modern Supply Chain Research and Applications (Emerald)" },
  { role: "Assistant Editor", outlet: "Sustainability (MDPI)" },
  { role: "Reviewer", outlet: "International Journal of Production Economics (Elsevier)" },
  { role: "Reviewer", outlet: "Journal of Cleaner Production (Elsevier)" },
  { role: "Reviewer", outlet: "Resources, Conservation & Recycling (Elsevier)" },
  { role: "Reviewer", outlet: "Measurement (Elsevier)" },
  { role: "Reviewer", outlet: "Applied Mathematical Modelling (Elsevier)" },
  { role: "Reviewer", outlet: "International Journal of Medical Informatics (Elsevier)" },
  { role: "Reviewer", outlet: "Annals of Operations Research (Springer)" },
  { role: "Reviewer", outlet: "International Journal of System Assurance Engineering and Management (Springer)" },
  { role: "Reviewer", outlet: "Environmental Science and Pollution Research (Springer)" },
  { role: "Reviewer", outlet: "International Journal of Logistics Management (Emerald)" },
  { role: "Reviewer", outlet: "International Journal of Physical Distribution & Logistics Management (Emerald)" },
  { role: "Reviewer", outlet: "Industrial Management & Data Systems (Emerald)" },
  { role: "Reviewer", outlet: "International Journal of Emerging Markets (Emerald)" },
  { role: "Reviewer", outlet: "Sustainability (MDPI)" },
];

const DEFAULT_SUPERVISION: Row[] = [
  { year: "2026", researcher: "M. A. Haque", thesis: "Development of a sustainable medical waste management network using a combined probabilistic and possibilistic approach" },
  { year: "2025", researcher: "M. G. A. Amio", thesis: "Development of a closed-loop supply chain incorporating solid waste management through the vehicle routing problem" },
  { year: "2025", researcher: "I. Ahmed", thesis: "Enhancing yarn procurement efficiency through automation for a readymade garments firm with dashboard visualization" },
  { year: "2025", researcher: "P. Bhattacharjee", thesis: "A machine learning based ensemble model for predicting risk level of maternal health" },
  { year: "2024", researcher: "S. M. Billah", thesis: "Lean, agile and resilient supplier selection in the leather industry: a case study" },
  { year: "2024", researcher: "R. A. Joy", thesis: "Performance evaluation of an effluent treatment plant in the readymade garment industry: a case study" },
  { year: "2023", researcher: "S. Roy", thesis: "Modelling hierarchical structure for circular supply chain in the readymade garment industry" },
  { year: "2021", researcher: "H. M. M. Taqi", thesis: "Supply chain network design with flexibility, resilience and environmental considerations" },
  { year: "2021", researcher: "K. W. Hasan", thesis: "Development of a multi-objective closed-loop green supply chain model with disruption risk consideration" },
  { year: "2020", researcher: "A. U. Rahman", thesis: "Supply chain performance prediction using a grey-based neural network" },
  { year: "2020", researcher: "M. R. Islam", thesis: "Warehouse performance prediction model using particle swarm optimization-based grey theory" },
  { year: "2020", researcher: "M. R. Sarker", thesis: "Sustainability performance assessment framework based on a hybrid approach: a case of the leather industry" },
  { year: "2020", researcher: "S. Raian", thesis: "Assessing and managing sustainability risk in the supply chain: a case study" },
  { year: "2020", researcher: "S. M. N. Hoq", thesis: "Framework for evaluating factors contributing to failure of IT systems: a case of the banking industry" },
  { year: "2019", researcher: "R. Anzoom", thesis: "Modelling of employee absenteeism rate prediction at the workplace using a Bayesian belief network" },
  { year: "2019", researcher: "A. Banik", thesis: "Critical success factors for implementing green supply chain management in the electronics industry: a case study" },
  { year: "2019", researcher: "T. Nahid", thesis: "Conceptual framework for implementing lean manufacturing in small and medium-sized enterprises: a case study" },
  { year: "2019", researcher: "M. M. Bappy", thesis: "Assessing sustainability in the supply chain using Dempster-Shafer theory" },
  { year: "2018", researcher: "M. N. Haque", thesis: "Improving changeover techniques in apparel manufacturing: a case study" },
  { year: "2018", researcher: "A. Hossain", thesis: "Examining barriers to Lean Six Sigma implementation in the supply chain: a case study" },
  { year: "2018", researcher: "S. Shohan", thesis: "Structural framework for evaluating drivers and barriers to green supply chain management in the chemical industry" },
  { year: "2018", researcher: "A. A. Zubayer", thesis: "Analysis of supply chain risk in the ceramic industry: a case study" },
  { year: "2018", researcher: "A. A. Munny", thesis: "Assessing enablers to social sustainability of the supply chain in the footwear industry: a case study" },
  { year: "2018", researcher: "T. Rahman", thesis: "Analysis of barriers in implementing green supply chain management in the plastic industry" },
  { year: "2017", researcher: "M. S. Uddin", thesis: "Analysis of barriers to green supply chain management in the leather industry: a case study" },
  { year: "2017", researcher: "M. A. Moktadir", thesis: "Identification and analysis of barriers to sustainable supply chain management practices: a case study" },
];

const DEFAULT_COLLABORATIONS: Row[] = [
  { institution: "Inland Norway University", country: "Norway" },
  { institution: "Indian Institute of Technology Delhi", country: "India" },
  { institution: "Vellore Institute of Technology", country: "India" },
  { institution: "Saveetha Institute of Medical and Technical Sciences", country: "India" },
  { institution: "Kalasalingam Academy of Research and Education", country: "India" },
  { institution: "Excelia Business School", country: "France" },
  { institution: "Normandie Business School", country: "France" },
  { institution: "University of Cincinnati", country: "United States" },
  { institution: "University of Arizona", country: "United States" },
  { institution: "North Carolina State University", country: "United States" },
  { institution: "Arkansas State University", country: "United States" },
  { institution: "University of Regina", country: "Canada" },
  { institution: "Université du Québec à Montréal", country: "Canada" },
  { institution: "University of Technology Sydney", country: "Australia" },
  { institution: "Federal University of Paraná", country: "Brazil" },
  { institution: "Integrated Colleges of Taquara (Faccat)", country: "Brazil" },
  { institution: "Aarhus University", country: "Denmark" },
  { institution: "Universidad Católica del Norte", country: "Chile" },
  { institution: "Universidad de Talca", country: "Chile" },
  { institution: "King Abdullah University of Science and Technology", country: "Saudi Arabia" },
  { institution: "International Institute for Applied Systems Analysis", country: "Austria" },
  { institution: "Universiti Teknologi Malaysia", country: "Malaysia" },
];

const DEFAULT_VENUES: Row[] = [
  { name: "Journal of Cleaner Production" },
  { name: "Annals of Operations Research" },
  { name: "International Journal of Production Economics" },
  { name: "International Journal of Production Research" },
  { name: "Resources, Conservation & Recycling" },
  { name: "Computers & Industrial Engineering" },
  { name: "Sustainable Production and Consumption" },
  { name: "Journal of Retailing and Consumer Services" },
  { name: "Industrial Management & Data Systems" },
  { name: "Process Safety and Environmental Protection" },
  { name: "Business Strategy and the Environment" },
  { name: "Business Strategy & Development" },
];

const DEFAULT_INTERESTS =
  "Applied artificial intelligence and machine learning, Logistics and supply chain management, Supply chain risk management, Supply chain sustainability";

const DEFAULT_BIO = `Dr. Syed Mithun Ali is a Professor in the Department of Industrial and Production Engineering at Bangladesh University of Engineering and Technology (BUET). He holds a PhD in supply chain management from the Nagoya Institute of Technology, Japan.

His research enhances both the theoretical and practical understanding of the environmental, social and economic sustainability of organisations and their supply chains. Through mentoring and international partnerships, he works to advance sustainable practices that benefit both industry and the environment.`;

/* Institutional address only — the CV's personal mobile numbers and private
   email are deliberately not published here. */
const DEFAULT_EMAIL = "mithun@ipe.buet.ac.bd";
const DEFAULT_SCHOLAR = "https://scholar.google.com/citations?user=vCkenssAAAAJ&hl=en";
const DEFAULT_RESEARCHGATE = "https://www.researchgate.net/profile/Syed_Mithun_Ali";
const DEFAULT_SCOPUS = "https://www.scopus.com/authid/detail.uri?authorId=57193722242";

/* Figures come from the Google Scholar record in the CV rather than its prose,
   which quotes slightly different numbers. `asOf` is displayed beside them so
   they can't go quietly stale. */
const DEFAULT_METRICS = {
  citations: "12,160",
  hIndex: "60",
  i10Index: "141",
  publications: "152",
  experienceYears: "19+",
  asOf: "August 2026",
};

/* ------------------------------------------------------------------ *
 * Colour utilities
 * ------------------------------------------------------------------ */

const hexToRgb = (hex: string) => {
  const raw = (hex ?? "").replace("#", "").trim();
  const clean =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => char + char)
          .join("")
      : raw;
  if (clean.length !== 6 || /[^0-9a-f]/i.test(clean)) return { r: 255, g: 255, b: 255 };
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
};

const withAlpha = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Proper WCAG relative luminance — the raw-channel version misjudges mid greens and blues. */
const relativeLuminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/* ------------------------------------------------------------------ *
 * Small building blocks
 * ------------------------------------------------------------------ */

/** Fluid rather than a fixed pixel size: ~220px on phones, up to 320px on wide screens. */
const LabHeadAvatar: React.FC<{ photo: string; name: string }> = ({ photo, name }) => {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const shared: React.CSSProperties = {
    width: "clamp(220px, 24vw, 320px)",
    aspectRatio: "1 / 1",
    borderRadius: 28,
    border: "4px solid rgba(255,255,255,0.3)",
    boxShadow: "0 24px 56px rgba(0,0,0,0.28)",
  };

  if (photo && !failed) {
    return (
      <img
        /* Transformed rather than the full-size original — the page renders it
           at 320px at most. */
        src={cld(photo, "portrait")}
        alt={name}
        decoding="async"
        onError={() => setFailed(true)}
        style={{ ...shared, objectFit: "cover" }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-center font-semibold text-white"
      style={{
        ...shared,
        background: "rgba(255,255,255,0.12)",
        fontSize: "clamp(64px, 7vw, 96px)",
        letterSpacing: "0.02em",
      }}
    >
      {initials}
    </div>
  );
};

/**
 * One heading device for the whole page: hairline, small-caps eyebrow, heading.
 * The original used an accent bar plus a second underline rule on every section.
 */
const SectionHeading: React.FC<{
  id: string;
  eyebrow: React.ReactNode;
  tone: { border: string; muted: string };
  as?: "h2" | "h3";
}> = ({ id, eyebrow, tone, as: Tag = "h2" }) => (
  <div className="mb-6">
    <div className="h-px w-10" style={{ background: tone.border }} />
    <Tag
      id={id}
      className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em]"
      style={{ color: tone.muted }}
    >
      {eyebrow}
    </Tag>
  </div>
);

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

const LabHead: React.FC = () => {
  const { content, loading } = useSiteContent();
  const { collaborators, loading: collaboratorsLoading } = useCollaborators();
  const { theme } = useThemeContext();

  const tone = useMemo(() => {
    const isDark = relativeLuminance(theme.backgroundColor ?? "#ffffff") < 0.22;
    return {
      isDark,
      page: `color-mix(in srgb, ${theme.primaryColor} ${isDark ? 6 : 4}%, ${theme.backgroundColor})`,
      surface: theme.backgroundColor,
      surfaceMuted: withAlpha(theme.primaryColor, isDark ? 0.1 : 0.05),
      border: withAlpha(theme.primaryColor, isDark ? 0.2 : 0.13),
      borderStrong: withAlpha(theme.primaryColor, isDark ? 0.36 : 0.26),
      heading: theme.primaryColor,
      body: withAlpha(theme.primaryColor, isDark ? 0.86 : 0.8),
      muted: withAlpha(theme.primaryColor, isDark ? 0.66 : 0.6),
      shadow: isDark ? "0 1px 2px rgba(0,0,0,0.4)" : "0 1px 2px rgba(15,23,42,0.05)",
    };
  }, [theme.backgroundColor, theme.primaryColor]);

  const labHeadUid =
    content["labhead.profileUid"] || String(import.meta.env.VITE_LAB_HEAD_UID || "");
  const canonicalProfile = collaborators.find((profile) => profile.uid === labHeadUid);

  const labHead: LabHeadData = {
    name: canonicalProfile?.name || content["labhead.name"] || "",
    title: canonicalProfile?.designation || content["labhead.title"] || "",
    department: canonicalProfile?.affiliation || content["labhead.department"] || "",
    photo: canonicalProfile?.photo || content["labhead.photo"] || "",
    shortBio: canonicalProfile?.bio || content["labhead.shortBio"] || DEFAULT_BIO,
    fullBio: content["labhead.fullBio"] || canonicalProfile?.bio || "",
    email: canonicalProfile?.email || content["labhead.email"] || DEFAULT_EMAIL,
    phone: content["labhead.phone"] ?? "",
    linkedin: canonicalProfile?.linkedin || content["labhead.linkedin"] || "",
    scholar: canonicalProfile?.scholar || content["labhead.scholar"] || DEFAULT_SCHOLAR,
    orcid: canonicalProfile?.orcid || content["labhead.orcid"] || "",
    researchgate:
      canonicalProfile?.researchgate || content["labhead.researchgate"] || DEFAULT_RESEARCHGATE,
    scopus: content["labhead.scopus"] || DEFAULT_SCOPUS,
    researchInterests:
      canonicalProfile?.researchInterests?.join(", ") ||
      content["labhead.researchInterests"] ||
      DEFAULT_INTERESTS,
  };

  const interests = labHead.researchInterests
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const metrics = {
    citations: content["labhead.metrics.citations"] || DEFAULT_METRICS.citations,
    hIndex: content["labhead.metrics.hIndex"] || DEFAULT_METRICS.hIndex,
    i10Index: content["labhead.metrics.i10Index"] || DEFAULT_METRICS.i10Index,
    publications: content["labhead.metrics.publications"] || DEFAULT_METRICS.publications,
    experienceYears:
      content["labhead.metrics.experienceYears"] || DEFAULT_METRICS.experienceYears,
    asOf: content["labhead.metrics.asOf"] || DEFAULT_METRICS.asOf,
  };

  const appointments = rowsFrom(content["labhead.appointments"], DEFAULT_APPOINTMENTS);
  const leadership = rowsFrom(content["labhead.leadership"], DEFAULT_LEADERSHIP);
  const education = rowsFrom(content["labhead.education"], DEFAULT_EDUCATION);
  const honours = rowsFrom(content["labhead.honours"], DEFAULT_HONOURS);
  const grants = rowsFrom(content["labhead.grants"], DEFAULT_GRANTS);
  const editorial = rowsFrom(content["labhead.editorial"], DEFAULT_EDITORIAL);
  const supervision = rowsFrom(content["labhead.supervision"], DEFAULT_SUPERVISION);
  const collaborations = rowsFrom(content["labhead.collaborations"], DEFAULT_COLLABORATIONS);
  const venues = rowsFrom(content["labhead.venues"], DEFAULT_VENUES);

  const links = [
    { href: labHead.linkedin, label: "LinkedIn", icon: "linkedin" as const },
    { href: labHead.scholar, label: "Google Scholar", icon: "scholar" as const },
    { href: labHead.orcid, label: "ORCID", icon: "orcid" as const },
    { href: labHead.researchgate, label: "ResearchGate", icon: "researchgate" as const },
    { href: labHead.scopus, label: "Scopus", icon: "publications" as const },
  ].filter((link) => link.href);

  const hasSecondBio = Boolean(labHead.fullBio) && labHead.fullBio !== labHead.shortBio;

  const panelStyle: React.CSSProperties = {
    background: tone.surface,
    border: `1px solid ${tone.border}`,
    boxShadow: tone.shadow,
  };

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--focus-offset)]";

  const focusVars = {
    "--focus-ring": theme.accentColor || theme.secondaryColor,
    "--focus-offset": tone.surface,
  } as React.CSSProperties;

  const heroGradient = `linear-gradient(130deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 70%)`;

  /* A timeline row: period on the left, role and organisation on the right. */
  const timeline = (items: Row[], periodKey: string, titleKey: string, subKey: string) => (
    <ol className="grid gap-5">
      {items.map((item, index) => (
        <li
          key={`${item[titleKey]}-${index}`}
          className="grid gap-1 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-5"
        >
          <span
            className="text-[12.5px] font-semibold tabular-nums"
            style={{ color: tone.muted }}
          >
            {item[periodKey]}
          </span>
          <span>
            <span className="block text-[15px] font-semibold" style={{ color: tone.heading }}>
              {item[titleKey]}
            </span>
            {item[subKey] && (
              <span className="mt-0.5 block text-[13.5px] leading-6" style={{ color: tone.muted }}>
                {item[subKey]}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );

  /* Long lists sit behind a disclosure so the page stays scannable — the count
     in the summary is what tells you whether it's worth opening. */
  const disclosure = (label: string, count: number, children: React.ReactNode) => (
    <details className="group">
      <summary
        className={`flex cursor-pointer list-none items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden ${focusRing}`}
        style={{ ...focusVars, borderColor: tone.border, color: tone.body }}
      >
        {label}
        <span className="text-[12px] font-medium tabular-nums" style={{ color: tone.muted }}>
          {count}
        </span>
        <span
          aria-hidden="true"
          className="ml-auto transition-transform group-open:rotate-90"
          style={{ color: tone.muted }}
        >
          ›
        </span>
      </summary>
      <div className="pt-5">{children}</div>
    </details>
  );

  /* ---------------------------------------------------------------- *
   * Loading and empty states
   * ---------------------------------------------------------------- */

  if (loading || collaboratorsLoading) {
    return (
      <main
        className="min-h-screen"
        style={{ background: tone.page }}
        aria-busy="true"
        role="status"
      >
        <span className="sr-only">Loading the lab head profile</span>

        <div
          className="px-4 py-16 motion-safe:animate-pulse md:py-20"
          style={{ background: heroGradient }}
        >
          <div className="mx-auto max-w-6xl">
            <div className="h-3 w-28 rounded-full bg-white/20" />
            <div className="mt-8 flex flex-col items-center gap-8 md:flex-row md:items-center md:gap-12">
              <div
                className="shrink-0 rounded-[28px] bg-white/15"
                style={{ width: "clamp(220px, 24vw, 320px)", aspectRatio: "1 / 1" }}
              />
              <div className="w-full max-w-xl space-y-4">
                <div className="h-6 w-28 rounded-full bg-white/15" />
                <div className="h-10 w-3/4 rounded-lg bg-white/20" />
                <div className="h-4 w-1/2 rounded-full bg-white/15" />
                <div className="h-11 w-40 rounded-xl bg-white/20" />
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-72 rounded-[20px] motion-safe:animate-pulse" style={panelStyle} />
          <div className="h-56 rounded-[20px] motion-safe:animate-pulse" style={panelStyle} />
        </div>
      </main>
    );
  }

  if (!labHead.name) {
    return (
      <main
        className="grid min-h-[70vh] place-items-center px-4 py-16"
        style={{ background: tone.page }}
      >
        <div className="max-w-lg rounded-[20px] p-10 text-center" style={panelStyle}>
          <div
            className="mx-auto mb-5 inline-flex rounded-2xl p-3"
            style={{ background: tone.surfaceMuted }}
          >
            <AppIcon name="admin" size={24} style={{ color: theme.primaryColor }} />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: tone.heading, fontFamily: "var(--font-heading)" }}
          >
            Lab Head Profile
          </h1>
          <p className="mt-3 text-sm leading-6" style={{ color: tone.muted }}>
            No lab head profile has been published yet. Add one from the admin Content Editor
            under the Lab Head tab.
          </p>
          <Link
            to="/"
            style={{ ...focusVars, background: theme.primaryColor, color: theme.backgroundColor }}
            className={`mt-7 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold no-underline transition hover:opacity-90 ${focusRing}`}
          >
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  /* ---------------------------------------------------------------- *
   * Page
   * ---------------------------------------------------------------- */

  return (
    <main style={{ background: tone.page }}>
      {/* Hero — the person, not the page. Name is the H1 and sits above the fold. */}
      <section
        aria-labelledby="labhead-name"
        className="relative overflow-hidden px-4 py-16 md:py-20"
        style={{ background: heroGradient }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `radial-gradient(circle, ${withAlpha(theme.backgroundColor, 0.7)} 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative mx-auto max-w-6xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            <EditableText
              id="labhead.heroTitle"
              defaultValue="Meet the Lab Head"
              className="inline"
            />
          </p>

          <div className="mt-8 flex flex-col items-center gap-8 text-center md:flex-row md:items-center md:gap-12 md:text-left">
            <div className="shrink-0">
              <LabHeadAvatar photo={labHead.photo} name={labHead.name} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: theme.accentColor }}
                />
                <EditableText id="labhead.roleLabel" defaultValue="Lab Head" className="inline" />
              </p>

              <h1
                id="labhead-name"
                className="mt-4 text-[30px] font-bold leading-[1.15] tracking-[-0.02em] text-white md:text-[46px]"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                <EditableText id="labhead.name" defaultValue={labHead.name} className="inline" />
              </h1>

              {(labHead.title || labHead.department) && (
                <p className="mt-4 text-[15px] leading-7 text-white/85">
                  {labHead.title && (
                    <EditableText
                      id="labhead.title"
                      defaultValue={labHead.title}
                      className="inline"
                    />
                  )}
                  {labHead.title && labHead.department && (
                    <span aria-hidden="true" className="mx-2 text-white/40">
                      /
                    </span>
                  )}
                  {labHead.department && (
                    <EditableText
                      id="labhead.department"
                      defaultValue={labHead.department}
                      className="inline"
                    />
                  )}
                </p>
              )}

              <p className="mt-3 max-w-2xl text-[14px] leading-6 text-white/70">
                <EditableText
                  id="labhead.heroSubtitle"
                  defaultValue="Research direction, academic profile, and contact information."
                  className="inline"
                />
              </p>

              {(labHead.email || labHead.phone) && (
                <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
                  {labHead.email && (
                    <a
                      href={`mailto:${labHead.email}`}
                      style={
                        {
                          "--focus-ring": "#ffffff",
                          "--focus-offset": theme.primaryColor,
                          background: theme.backgroundColor,
                          color: theme.primaryColor,
                        } as React.CSSProperties
                      }
                      className={`inline-flex min-h-[44px] items-center rounded-xl px-5 text-sm font-semibold no-underline shadow-lg transition hover:opacity-90 ${focusRing}`}
                    >
                      Email {labHead.name.split(" ")[0]}
                    </a>
                  )}
                  {labHead.phone && (
                    <a
                      href={`tel:${labHead.phone}`}
                      style={
                        {
                          "--focus-ring": "#ffffff",
                          "--focus-offset": theme.primaryColor,
                        } as React.CSSProperties
                      }
                      className={`inline-flex min-h-[44px] items-center rounded-xl border border-white/35 px-5 text-sm font-semibold text-white no-underline transition hover:border-white/70 hover:bg-white/10 ${focusRing}`}
                    >
                      Call {labHead.phone}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Metrics. The "as of" stamp is not decoration — a citation count with
              no date attached is wrong within weeks and nobody notices. */}
          <div className="mt-12 border-t border-white/15 pt-7">
            <dl className="flex flex-wrap gap-x-10 gap-y-5">
              {[
                { value: metrics.citations, label: "Citations" },
                { value: metrics.hIndex, label: "h-index" },
                { value: metrics.i10Index, label: "i10-index" },
                { value: metrics.publications, label: "Journal articles" },
                { value: metrics.experienceYears, label: "Years teaching & research" },
              ]
                .filter((metric) => metric.value)
                .map((metric) => (
                  <div key={metric.label} className="flex items-baseline gap-2.5">
                    <dt className="sr-only">{metric.label}</dt>
                    <dd
                      className="text-[26px] font-bold leading-none tabular-nums"
                      style={{ color: theme.accentColor, fontFamily: "var(--font-heading)" }}
                    >
                      {metric.value}
                    </dd>
                    <span aria-hidden="true" className="text-[12.5px] text-white/60">
                      {metric.label}
                    </span>
                  </div>
                ))}
            </dl>
            {metrics.asOf && (
              <p className="mt-4 text-[11.5px] text-white/45">
                Google Scholar figures, accurate as of {metrics.asOf}.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Body — a single content column plus a record sidebar, on one neutral
          surface. The original stacked four full-bleed tinted bands, which gave
          every section identical weight. */}
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="h-px w-10" style={{ background: tone.border }} />
        <h2
          id="labhead-about"
          className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{ color: tone.muted }}
        >
          <EditableText
            id="labhead.aboutTitle"
            defaultValue="About the Lab Head"
            className="inline"
          />
        </h2>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <section
              aria-labelledby="labhead-bio"
              className="rounded-[20px] p-6 md:p-9"
              style={panelStyle}
            >
              <SectionHeading
                id="labhead-bio"
                tone={tone}
                eyebrow={
                  <EditableText id="labhead.bioTitle" defaultValue="Biography" className="inline" />
                }
              />

              <p
                className="max-w-[68ch] text-[15.5px]"
                style={{ whiteSpace: "pre-line", lineHeight: 1.8, color: tone.body }}
              >
                <EditableText
                  id="labhead.shortBio"
                  defaultValue={labHead.shortBio || labHead.fullBio}
                  wrapperClassName="block"
                />
              </p>

              {hasSecondBio && (
                <div className="mt-8 border-t pt-7" style={{ borderColor: tone.border }}>
                  <h3
                    className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style={{ color: tone.muted }}
                  >
                    <EditableText
                      id="labhead.detailedBioTitle"
                      defaultValue="Detailed Biography"
                      wrapperClassName="block"
                    />
                  </h3>
                  <p
                    className="mt-5 max-w-[68ch] text-[15.5px]"
                    style={{ whiteSpace: "pre-line", lineHeight: 1.8, color: tone.body }}
                  >
                    <EditableText
                      id="labhead.fullBio"
                      defaultValue={labHead.fullBio}
                      wrapperClassName="block"
                    />
                  </p>
                </div>
              )}
            </section>

            <section
              aria-labelledby="labhead-interests"
              className="rounded-[20px] p-6 md:p-9"
              style={panelStyle}
            >
              <SectionHeading
                id="labhead-interests"
                tone={tone}
                eyebrow={
                  <EditableText
                    id="labhead.researchInterestsTitle"
                    defaultValue="Research Interests"
                    className="inline"
                  />
                }
              />

              {interests.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {interests.map((interest) => (
                    <li
                      key={interest}
                      className="rounded-lg px-3 py-2 text-[13px] font-medium"
                      style={{ background: tone.surfaceMuted, color: tone.body }}
                    >
                      {interest}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[15px]" style={{ color: tone.muted }}>
                  <EditableText
                    id="labhead.noResearchInterestsText"
                    defaultValue="Research interests are not available yet."
                    className="inline"
                  />
                </p>
              )}
            </section>

            {appointments.length > 0 && (
              <section
                aria-labelledby="labhead-appointments"
                className="rounded-[20px] p-6 md:p-9"
                style={panelStyle}
              >
                <SectionHeading
                  id="labhead-appointments"
                  tone={tone}
                  eyebrow={
                    <EditableText
                      id="labhead.appointmentsTitle"
                      defaultValue="Academic Appointments"
                      className="inline"
                    />
                  }
                />
                {timeline(appointments, "period", "role", "organisation")}

                {leadership.length > 0 && (
                  <div className="mt-9 border-t pt-8" style={{ borderColor: tone.border }}>
                    <h3
                      className="mb-6 text-[11px] font-semibold uppercase tracking-[0.16em]"
                      style={{ color: tone.muted }}
                    >
                      <EditableText
                        id="labhead.leadershipTitle"
                        defaultValue="Academic & Administrative Leadership"
                        className="inline"
                      />
                    </h3>
                    {timeline(leadership, "period", "role", "organisation")}
                  </div>
                )}
              </section>
            )}

            {education.length > 0 && (
              <section
                aria-labelledby="labhead-education"
                className="rounded-[20px] p-6 md:p-9"
                style={panelStyle}
              >
                <SectionHeading
                  id="labhead-education"
                  tone={tone}
                  eyebrow={
                    <EditableText
                      id="labhead.educationTitle"
                      defaultValue="Education"
                      className="inline"
                    />
                  }
                />
                {timeline(education, "year", "degree", "institution")}
              </section>
            )}

            {honours.length > 0 && (
              <section
                aria-labelledby="labhead-honours"
                className="rounded-[20px] p-6 md:p-9"
                style={panelStyle}
              >
                <SectionHeading
                  id="labhead-honours"
                  tone={tone}
                  eyebrow={
                    <EditableText
                      id="labhead.honoursTitle"
                      defaultValue="Honours & Awards"
                      className="inline"
                    />
                  }
                />
                {timeline(honours, "year", "title", "awardedBy")}
              </section>
            )}

            {grants.length > 0 && (
              <section
                aria-labelledby="labhead-grants"
                className="rounded-[20px] p-6 md:p-9"
                style={panelStyle}
              >
                <SectionHeading
                  id="labhead-grants"
                  tone={tone}
                  eyebrow={
                    <EditableText
                      id="labhead.grantsTitle"
                      defaultValue="Research Funding"
                      className="inline"
                    />
                  }
                />
                <ol className="grid gap-6">
                  {grants.map((grant, index) => (
                    <li key={`${grant.title}-${index}`}>
                      <p className="text-[15px] font-semibold" style={{ color: tone.heading }}>
                        {grant.title}
                      </p>
                      <p className="mt-1 text-[13.5px] leading-6" style={{ color: tone.muted }}>
                        {[grant.funder, grant.year].filter(Boolean).join(" · ")}
                      </p>
                      {grant.amount && (
                        <p
                          className="mt-1.5 text-[13px] font-semibold tabular-nums"
                          style={{ color: theme.secondaryColor }}
                        >
                          {grant.amount}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* The long tail. Behind disclosures so the page stays readable —
                nineteen editorial roles and twenty-six theses would otherwise
                bury the sections above. */}
            <section
              aria-labelledby="labhead-record"
              className="rounded-[20px] p-6 md:p-9"
              style={panelStyle}
            >
              <SectionHeading
                id="labhead-record"
                tone={tone}
                eyebrow={
                  <EditableText
                    id="labhead.recordTitle"
                    defaultValue="Academic Record"
                    className="inline"
                  />
                }
              />

              <div className="grid gap-3">
                {editorial.length > 0 &&
                  disclosure(
                    "Editorial & peer review",
                    editorial.length,
                    <ul className="grid gap-3">
                      {editorial.map((item, index) => (
                        <li
                          key={`${item.outlet}-${index}`}
                          className="grid gap-0.5 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-5"
                        >
                          <span
                            className="text-[12.5px] font-semibold"
                            style={{ color: tone.muted }}
                          >
                            {item.role}
                          </span>
                          <span className="text-[14px] leading-6" style={{ color: tone.body }}>
                            {item.outlet}
                          </span>
                        </li>
                      ))}
                    </ul>,
                  )}

                {supervision.length > 0 &&
                  disclosure(
                    "Supervised graduate research",
                    supervision.length,
                    <ol className="grid gap-4">
                      {supervision.map((item, index) => (
                        <li
                          key={`${item.researcher}-${index}`}
                          className="grid gap-0.5 sm:grid-cols-[70px_minmax(0,1fr)] sm:gap-5"
                        >
                          <span
                            className="text-[12.5px] font-semibold tabular-nums"
                            style={{ color: tone.muted }}
                          >
                            {item.year}
                          </span>
                          <span>
                            <span
                              className="block text-[14px] font-semibold"
                              style={{ color: tone.heading }}
                            >
                              {item.researcher}
                            </span>
                            <span
                              className="mt-0.5 block text-[13.5px] leading-6"
                              style={{ color: tone.body }}
                            >
                              {item.thesis}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ol>,
                  )}

                {collaborations.length > 0 &&
                  disclosure(
                    "International collaborations",
                    collaborations.length,
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {collaborations.map((item, index) => (
                        <li
                          key={`${item.institution}-${index}`}
                          className="rounded-lg px-3 py-2.5"
                          style={{ background: tone.surfaceMuted }}
                        >
                          <span
                            className="block text-[13.5px] font-medium"
                            style={{ color: tone.body }}
                          >
                            {item.institution}
                          </span>
                          {item.country && (
                            <span className="text-[12px]" style={{ color: tone.muted }}>
                              {item.country}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>,
                  )}

                {venues.length > 0 &&
                  disclosure(
                    "Selected journals",
                    venues.length,
                    <ul className="flex flex-wrap gap-2">
                      {venues.map((venue, index) => (
                        <li
                          key={`${venue.name}-${index}`}
                          className="rounded-lg px-3 py-2 text-[13px]"
                          style={{ background: tone.surfaceMuted, color: tone.body }}
                        >
                          {venue.name}
                        </li>
                      ))}
                    </ul>,
                  )}
              </div>

              {/* The Publications page does search, filtering and citations —
                  duplicating the list here would be a second copy to maintain. */}
              <Link
                to="/publications"
                style={{ ...focusVars, borderColor: tone.border, color: tone.body }}
                className={`mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-sm font-semibold no-underline transition hover:border-[color:${tone.borderStrong}] ${focusRing}`}
              >
                <EditableText
                  id="labhead.publicationsCta"
                  defaultValue="Browse all publications"
                  className="inline"
                />
                <span aria-hidden="true">→</span>
              </Link>
            </section>
          </div>

          {/* Record sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:h-fit">
            <section
              aria-labelledby="labhead-links"
              className="rounded-[20px] p-6"
              style={panelStyle}
            >
              <SectionHeading
                id="labhead-links"
                tone={tone}
                eyebrow={
                  <EditableText
                    id="labhead.linksTitle"
                    defaultValue="Academic Profiles"
                    className="inline"
                  />
                }
              />

              {links.length === 0 ? (
                <p className="text-sm" style={{ color: tone.muted }}>
                  <EditableText
                    id="labhead.noLinksText"
                    defaultValue="No profile links yet."
                    className="inline"
                  />
                </p>
              ) : (
                /* Labelled links, not 38px icon-only squares: a title attribute is
                   not a reliable accessible name, and 38px misses the 44px target. */
                <ul className="grid gap-2">
                  {links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        style={
                          {
                            ...focusVars,
                            "--hover-border": tone.borderStrong,
                            borderColor: tone.border,
                            color: tone.body,
                          } as React.CSSProperties
                        }
                        className={`flex min-h-[44px] items-center gap-3 rounded-xl border px-3.5 text-sm font-medium no-underline transition hover:border-[color:var(--hover-border)] ${focusRing}`}
                      >
                        <AppIcon name={link.icon} size={16} />
                        <span className="flex-1">{link.label}</span>
                        <span aria-hidden="true" style={{ color: tone.muted }}>
                          ↗
                        </span>
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {(labHead.email || labHead.phone) && (
              <section
                aria-labelledby="labhead-contact"
                className="rounded-[20px] p-6"
                style={panelStyle}
              >
                <SectionHeading
                  id="labhead-contact"
                  tone={tone}
                  eyebrow={
                    <EditableText
                      id="labhead.contactInfoLabel"
                      defaultValue="Contact Info"
                      className="inline"
                    />
                  }
                />

                <dl className="grid gap-4">
                  {labHead.email && (
                    <div>
                      <dt
                        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: tone.muted }}
                      >
                        <EditableText
                          id="labhead.emailLabel"
                          defaultValue="Email"
                          className="inline"
                        />
                      </dt>
                      <dd className="mt-1.5 break-all text-sm font-medium">
                        <a
                          href={`mailto:${labHead.email}`}
                          style={{ ...focusVars, color: theme.secondaryColor }}
                          className={`rounded-sm underline decoration-transparent underline-offset-4 transition hover:decoration-current ${focusRing}`}
                        >
                          {labHead.email}
                        </a>
                      </dd>
                    </div>
                  )}

                  {labHead.phone && (
                    <div className="border-t pt-4" style={{ borderColor: tone.border }}>
                      <dt
                        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{ color: tone.muted }}
                      >
                        <EditableText
                          id="labhead.phoneLabel"
                          defaultValue="Phone"
                          className="inline"
                        />
                      </dt>
                      <dd className="mt-1.5 text-sm font-medium">
                        <a
                          href={`tel:${labHead.phone}`}
                          style={{ ...focusVars, color: theme.secondaryColor }}
                          className={`rounded-sm underline decoration-transparent underline-offset-4 transition hover:decoration-current ${focusRing}`}
                        >
                          {labHead.phone}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
          </aside>
        </div>
      </div>

      {/* Onward navigation. The self-link to /lab-head is removed — it pointed at
          the page the reader is already on. */}
      <section
        aria-labelledby="labhead-explore"
        className="border-t px-4 py-14"
        style={{ borderColor: tone.border, background: tone.surfaceMuted }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="h-px w-10" style={{ background: tone.borderStrong }} />
          <h2
            id="labhead-explore"
            className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: tone.muted }}
          >
            Continue exploring
          </h2>

          <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                to: "/about",
                icon: "building" as const,
                title: "About",
                desc: "Learn more about the lab and mission.",
                color: theme.secondaryColor,
              },
              {
                to: "/research-ideas",
                icon: "ideas" as const,
                title: "Research Ideas",
                desc: "Discover open questions to collaborate on.",
                color: theme.accentColor,
              },
              {
                to: "/collaborators#collaborator-request",
                icon: "handshake" as const,
                title: "Request Collaboration",
                desc: "Jump directly to the collaborator request form.",
                color: theme.primaryColor,
              },
            ].map((item) => (
              <li key={item.to}>
                {/* Hover is CSS, not onMouseEnter style mutation — so it also
                    responds to keyboard focus and respects reduced motion. */}
                <Link
                  to={item.to}
                  style={
                    {
                      ...focusVars,
                      "--card-accent": item.color,
                      background: tone.surface,
                      borderColor: tone.border,
                      boxShadow: tone.shadow,
                    } as React.CSSProperties
                  }
                  className={`group flex h-full items-start gap-4 rounded-[16px] border p-5 no-underline transition duration-200 hover:border-[color:var(--card-accent)] motion-safe:hover:-translate-y-0.5 ${focusRing}`}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: withAlpha(item.color, 0.12), color: item.color }}
                  >
                    <AppIcon name={item.icon} size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold" style={{ color: tone.heading }}>
                      <EditableText
                        id={`labhead.cardTitle.${item.icon}`}
                        defaultValue={item.title}
                        className="inline"
                      />
                    </span>
                    <span className="mt-1 block text-xs leading-5" style={{ color: tone.muted }}>
                      <EditableText
                        id={`labhead.cardDesc.${item.icon}`}
                        defaultValue={item.desc}
                        className="inline"
                      />
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="ml-auto self-center text-sm transition-transform motion-safe:group-hover:translate-x-0.5"
                    style={{ color: tone.muted }}
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
};

export default LabHead;
