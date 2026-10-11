import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cld } from "../cloudinary";
import AppIcon from "../components/AppIcon";
import EditableText from "../components/EditableText";
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
 * Building blocks
 *
 * Every colour comes from the Theme Control tokens (--site-*, --hero-*,
 * --*-ink). The previous version tinted all text with the primary colour,
 * which vanished on dark themes.
 * ------------------------------------------------------------------ */

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--site-surface)]";

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
    width: "clamp(168px, 18vw, 240px)",
    aspectRatio: "4 / 5",
    borderRadius: 24,
    boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
    border: "1px solid color-mix(in srgb, var(--hero-text) 22%, transparent)",
  };
  return photo && !failed ? (
    <img src={cld(photo, "portrait")} alt={name} decoding="async" onError={() => setFailed(true)} style={{ ...shared, objectFit: "cover" }} />
  ) : (
    <div
      aria-hidden="true"
      className="grid place-items-center font-bold"
      style={{ ...shared, background: "color-mix(in srgb, var(--hero-text) 12%, transparent)", color: "var(--hero-text)", fontSize: "clamp(52px, 6vw, 76px)" }}
    >
      {initials}
    </div>
  );
};

/** A titled card. */
const Card: React.FC<{ id: string; title: React.ReactNode; action?: React.ReactNode; className?: string; children: React.ReactNode }> = ({
  id,
  title,
  action,
  className = "",
  children,
}) => (
  <section aria-labelledby={id} className={`rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] ${className}`}>
    <header className="flex items-center gap-3 border-b border-[color:var(--site-border)] px-5 py-3.5 md:px-6">
      <h3 id={id} className="flex-1 text-[15px] font-bold text-[color:var(--site-heading)]" style={{ fontFamily: "var(--font-heading)" }}>
        {title}
      </h3>
      {action}
    </header>
    <div className="p-5 md:p-6">{children}</div>
  </section>
);

/** Vertical timeline: a dot and rail on the left, period above the entry. */
const Timeline: React.FC<{ items: Row[]; periodKey: string; titleKey: string; subKey: string }> = ({ items, periodKey, titleKey, subKey }) => (
  <ol className="relative ml-1.5 border-l-2 border-[color:var(--site-border)]">
    {items.map((item, index) => (
      <li key={`${item[titleKey]}-${index}`} className="relative pb-5 pl-5 last:pb-0">
        <span
          aria-hidden="true"
          className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-[color:var(--site-surface)]"
          style={{ background: index === 0 ? "var(--color-secondary)" : "var(--site-border)" }}
        />
        {item[periodKey] && <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] tabular-nums text-[color:var(--site-muted)]">{item[periodKey]}</p>}
        <p className="mt-0.5 text-[14.5px] font-semibold leading-snug text-[color:var(--site-heading)]">{item[titleKey]}</p>
        {item[subKey] && <p className="mt-0.5 text-[13px] leading-6 text-[color:var(--site-text)]">{item[subKey]}</p>}
      </li>
    ))}
  </ol>
);

type RecordTab = "editorial" | "supervision" | "collaborations" | "venues";

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "career", label: "Career" },
  { id: "honours", label: "Honours & funding" },
  { id: "record", label: "Academic record" },
] as const;

const LabHead: React.FC = () => {
  const { content, loading } = useSiteContent();
  const { collaborators, loading: collaboratorsLoading } = useCollaborators();
  const [recordTab, setRecordTab] = useState<RecordTab>("editorial");
  const [activeSection, setActiveSection] = useState<string>("overview");

  const labHeadUid = content["labhead.profileUid"] || String(import.meta.env.VITE_LAB_HEAD_UID || "");
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
    researchgate: canonicalProfile?.researchgate || content["labhead.researchgate"] || DEFAULT_RESEARCHGATE,
    scopus: content["labhead.scopus"] || DEFAULT_SCOPUS,
    researchInterests: canonicalProfile?.researchInterests?.join(", ") || content["labhead.researchInterests"] || DEFAULT_INTERESTS,
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
    experienceYears: content["labhead.metrics.experienceYears"] || DEFAULT_METRICS.experienceYears,
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
    { href: labHead.scholar, label: "Google Scholar", icon: "scholar" as const },
    { href: labHead.researchgate, label: "ResearchGate", icon: "researchgate" as const },
    { href: labHead.scopus, label: "Scopus", icon: "publications" as const },
    { href: labHead.orcid, label: "ORCID", icon: "orcid" as const },
    { href: labHead.linkedin, label: "LinkedIn", icon: "linkedin" as const },
  ].filter((link) => link.href);

  const hasSecondBio = Boolean(labHead.fullBio) && labHead.fullBio !== labHead.shortBio;
  const firstName = labHead.name.split(" ").find((part) => !/^(dr|prof)\.?$/i.test(part)) ?? labHead.name;

  /* Highlight the section in view in the sticky bar. */
  useEffect(() => {
    if (!labHead.name || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveSection(visible.target.id.replace("lh-", ""));
      },
      { rootMargin: "-140px 0px -55% 0px" },
    );
    NAV.forEach((item) => {
      const el = document.getElementById(`lh-${item.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [labHead.name]);

  const jump = (id: string) => {
    const el = document.getElementById(`lh-${id}`);
    if (!el) return;
    const offset = (parseFloat(getComputedStyle(document.body).getPropertyValue("--nav-offset")) || 0) + 64;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
  };

  /* ---------------------------------------------------------------- *
   * Loading and empty states
   * ---------------------------------------------------------------- */

  if (loading || collaboratorsLoading) {
    return (
      <main aria-busy="true" role="status" className="bg-[color:var(--color-bg)]">
        <span className="sr-only">Loading the lab head profile</span>
        <div className="px-4 py-12 motion-safe:animate-pulse" style={{ background: "var(--color-primary)" }}>
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 md:flex-row">
            <div className="rounded-3xl" style={{ width: "clamp(168px, 18vw, 240px)", aspectRatio: "4 / 5", background: "color-mix(in srgb, var(--hero-text) 12%, transparent)" }} />
            <div className="w-full max-w-xl space-y-4">
              <div className="h-9 w-3/4 rounded-lg" style={{ background: "color-mix(in srgb, var(--hero-text) 16%, transparent)" }} />
              <div className="h-4 w-1/2 rounded-full" style={{ background: "color-mix(in srgb, var(--hero-text) 12%, transparent)" }} />
            </div>
          </div>
        </div>
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="h-72 rounded-2xl bg-[color:var(--site-surface-alt)] motion-safe:animate-pulse" />
          <div className="h-56 rounded-2xl bg-[color:var(--site-surface-alt)] motion-safe:animate-pulse" />
        </div>
      </main>
    );
  }

  if (!labHead.name) {
    return (
      <main className="grid min-h-[70vh] place-items-center bg-[color:var(--color-bg)] px-4 py-16">
        <div className="max-w-lg rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-10 text-center">
          <h1 className="text-2xl font-bold text-[color:var(--site-heading)]" style={{ fontFamily: "var(--font-heading)" }}>
            Lab Head Profile
          </h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--site-muted)]">
            No lab head profile has been published yet. Add one from the admin Content Editor under the Lab Head tab.
          </p>
          <Link to="/" className={`mt-7 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold no-underline ${FOCUS}`} style={{ background: "var(--color-primary)", color: "var(--hero-text)" }}>
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  const recordTabs: { id: RecordTab; label: string; count: number }[] = [
    { id: "editorial" as const, label: "Editorial & review", count: editorial.length },
    { id: "supervision" as const, label: "Supervision", count: supervision.length },
    { id: "collaborations" as const, label: "Collaborations", count: collaborations.length },
    { id: "venues" as const, label: "Journals", count: venues.length },
  ].filter((tab) => tab.count > 0);
  const currentRecord = recordTabs.some((tab) => tab.id === recordTab) ? recordTab : recordTabs[0]?.id;

  const metricTiles = [
    { value: metrics.citations, label: "Citations" },
    { value: metrics.hIndex, label: "h-index" },
    { value: metrics.i10Index, label: "i10-index" },
    { value: metrics.publications, label: "Journal articles" },
    { value: metrics.experienceYears, label: "Years of research" },
  ].filter((metric) => metric.value);

  /* ---------------------------------------------------------------- *
   * Page
   * ---------------------------------------------------------------- */

  return (
    <main className="bg-[color:var(--color-bg)]">
      {/* ── Hero: the person, then the numbers ── */}
      <section
        aria-labelledby="labhead-name"
        className="relative overflow-hidden px-4 pb-8 pt-10 md:pb-10 md:pt-14"
        style={{
          background: "linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 72%, var(--color-secondary)) 100%)",
          color: "var(--hero-text)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "color-mix(in srgb, var(--color-accent) 30%, transparent)" }}
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-end md:text-left">
            <div className="shrink-0">
              <LabHeadAvatar photo={labHead.photo} name={labHead.name} />
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--hero-accent)" }}>
                <EditableText id="labhead.heroTitle" defaultValue="Meet the Lab Head" className="inline" />
              </p>
              <h1
                id="labhead-name"
                className="mt-2 text-[30px] font-bold leading-[1.1] tracking-[-0.02em] md:text-[44px]"
                style={{ fontFamily: "var(--font-heading)", color: "var(--hero-text)" }}
              >
                <EditableText id="labhead.name" defaultValue={labHead.name} className="inline" />
              </h1>
              {(labHead.title || labHead.department) && (
                <p className="mt-3 text-[15px] leading-7" style={{ color: "color-mix(in srgb, var(--hero-text) 88%, transparent)" }}>
                  {labHead.title && (
                    <span className="font-semibold">
                      <EditableText id="labhead.title" defaultValue={labHead.title} className="inline" />
                    </span>
                  )}
                  {labHead.title && labHead.department && <span aria-hidden="true" className="mx-2 opacity-50">·</span>}
                  {labHead.department && <EditableText id="labhead.department" defaultValue={labHead.department} className="inline" />}
                </p>
              )}
              <p className="mx-auto mt-2 max-w-2xl text-[14px] leading-6 md:mx-0" style={{ color: "color-mix(in srgb, var(--hero-text) 72%, transparent)" }}>
                <EditableText id="labhead.heroSubtitle" defaultValue="Research direction, academic profile, and contact information." className="inline" />
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-2.5 md:justify-start">
                {labHead.email && (
                  <a
                    href={`mailto:${labHead.email}`}
                    className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13.5px] font-bold no-underline shadow-lg transition hover:brightness-105 ${FOCUS}`}
                    style={{ background: "var(--color-accent)", color: "var(--on-accent)" }}
                  >
                    <AppIcon name="contact" size={15} /> Email {firstName}
                  </a>
                )}
                {labHead.phone && (
                  <a
                    href={`tel:${labHead.phone}`}
                    className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-[13.5px] font-semibold no-underline transition ${FOCUS}`}
                    style={{ borderColor: "color-mix(in srgb, var(--hero-text) 35%, transparent)", color: "var(--hero-text)" }}
                  >
                    <AppIcon name="phone" size={15} /> {labHead.phone}
                  </a>
                )}
                {links.slice(0, 3).map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    title={link.label}
                    aria-label={`${link.label} (opens in a new tab)`}
                    className={`grid h-10 w-10 place-items-center rounded-xl transition ${FOCUS}`}
                    style={{ background: "color-mix(in srgb, var(--hero-text) 12%, transparent)", color: "var(--hero-text)" }}
                  >
                    <AppIcon name={link.icon} size={16} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Metrics — dated, because a citation count with no date is wrong within weeks. */}
          {metricTiles.length > 0 && (
            <div className="mt-8">
              <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                {metricTiles.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl px-4 py-3 backdrop-blur-sm"
                    style={{ background: "color-mix(in srgb, var(--hero-text) 9%, transparent)", border: "1px solid color-mix(in srgb, var(--hero-text) 14%, transparent)" }}
                  >
                    <dd className="text-[24px] font-bold leading-none tabular-nums" style={{ color: "var(--hero-accent)", fontFamily: "var(--font-heading)" }}>
                      {metric.value}
                    </dd>
                    <dt className="mt-1.5 text-[11.5px] font-medium" style={{ color: "color-mix(in srgb, var(--hero-text) 75%, transparent)" }}>
                      {metric.label}
                    </dt>
                  </div>
                ))}
              </dl>
              {metrics.asOf && (
                <p className="mt-2.5 text-[11.5px]" style={{ color: "color-mix(in srgb, var(--hero-text) 60%, transparent)" }}>
                  Google Scholar figures, accurate as of {metrics.asOf}.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Sticky section bar ── */}
      <nav
        aria-label="Sections"
        className="sticky z-30 border-b border-[color:var(--site-border)] bg-[color:color-mix(in_srgb,var(--site-surface)_92%,transparent)] backdrop-blur-md"
        style={{ top: "var(--nav-offset)" }}
      >
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 [scrollbar-width:none]">
          {NAV.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => jump(item.id)}
                aria-current={active ? "true" : undefined}
                className={`h-11 shrink-0 border-b-2 px-3 text-[13px] font-semibold transition ${
                  active
                    ? "border-[color:var(--color-secondary)] text-[color:var(--site-heading)]"
                    : "border-transparent text-[color:var(--site-muted)] hover:text-[color:var(--site-heading)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          {/* ── Overview ── */}
          <div id="lh-overview" className="scroll-mt-32 space-y-5">
            <Card id="labhead-bio" title={<EditableText id="labhead.bioTitle" defaultValue="Biography" className="inline" />}>
              <div className="max-w-[70ch] whitespace-pre-line text-[15px] leading-[1.8] text-[color:var(--site-text)]">
                <EditableText id="labhead.shortBio" defaultValue={labHead.shortBio || labHead.fullBio} wrapperClassName="block" />
              </div>
              {hasSecondBio && (
                <details className="group mt-5 border-t border-[color:var(--site-border)] pt-4">
                  <summary className={`flex cursor-pointer list-none items-center gap-2 text-[13px] font-semibold [&::-webkit-details-marker]:hidden ${FOCUS}`} style={{ color: "var(--secondary-ink)" }}>
                    <EditableText id="labhead.detailedBioTitle" defaultValue="Detailed Biography" className="inline" />
                    <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
                  </summary>
                  <div className="mt-3 max-w-[70ch] whitespace-pre-line text-[15px] leading-[1.8] text-[color:var(--site-text)]">
                    <EditableText id="labhead.fullBio" defaultValue={labHead.fullBio} wrapperClassName="block" />
                  </div>
                </details>
              )}
            </Card>

            <Card id="labhead-interests" title={<EditableText id="labhead.researchInterestsTitle" defaultValue="Research Interests" className="inline" />}>
              {interests.length > 0 ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {interests.map((interest) => (
                    <li key={interest} className="flex items-center gap-3 rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface-alt)] px-3.5 py-2.5">
                      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--color-accent)" }} />
                      <span className="text-[13.5px] font-medium text-[color:var(--site-heading)]">{interest}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] text-[color:var(--site-muted)]">
                  <EditableText id="labhead.noResearchInterestsText" defaultValue="Research interests are not available yet." className="inline" />
                </p>
              )}
            </Card>
          </div>

          {/* ── Career ── */}
          <div id="lh-career" className="scroll-mt-32 grid gap-5 md:grid-cols-2">
            <Card id="labhead-appointments" title={<EditableText id="labhead.appointmentsTitle" defaultValue="Academic Appointments" className="inline" />}>
              <Timeline items={appointments} periodKey="period" titleKey="role" subKey="organisation" />
            </Card>
            <div className="space-y-5">
              {leadership.length > 0 && (
                <Card id="labhead-leadership" title={<EditableText id="labhead.leadershipTitle" defaultValue="Academic & Administrative Leadership" className="inline" />}>
                  <Timeline items={leadership} periodKey="period" titleKey="role" subKey="organisation" />
                </Card>
              )}
              <Card id="labhead-education" title={<EditableText id="labhead.educationTitle" defaultValue="Education" className="inline" />}>
                <Timeline items={education} periodKey="year" titleKey="degree" subKey="institution" />
              </Card>
            </div>
          </div>

          {/* ── Honours & funding ── */}
          <div id="lh-honours" className="scroll-mt-32 space-y-5">
            <Card id="labhead-honours" title={<EditableText id="labhead.honoursTitle" defaultValue="Honours & Awards" className="inline" />}>
              <ul className="grid gap-2.5">
                {honours.map((item, index) => (
                  <li key={`${item.title}-${index}`} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums"
                      style={{ background: "color-mix(in srgb, var(--color-accent) 18%, transparent)", color: "var(--accent-ink)", minWidth: 64, textAlign: "center" }}
                    >
                      {item.year || "—"}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold leading-snug text-[color:var(--site-heading)]">{item.title}</span>
                      {item.awardedBy && <span className="block text-[12.5px] text-[color:var(--site-muted)]">{item.awardedBy}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            {grants.length > 0 && (
              <Card id="labhead-grants" title={<EditableText id="labhead.grantsTitle" defaultValue="Research Funding" className="inline" />}>
                <ul className="grid gap-3">
                  {grants.map((grant, index) => (
                    <li key={`${grant.title}-${index}`} className="rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface-alt)] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {grant.amount && (
                          <span className="rounded-md px-2 py-0.5 text-[12px] font-bold" style={{ background: "color-mix(in srgb, var(--color-secondary) 14%, transparent)", color: "var(--secondary-ink)" }}>
                            {grant.amount}
                          </span>
                        )}
                        {grant.year && <span className="text-[12px] font-semibold tabular-nums text-[color:var(--site-muted)]">{grant.year}</span>}
                      </div>
                      <p className="mt-2 text-[14px] font-semibold leading-snug text-[color:var(--site-heading)]">{grant.title}</p>
                      {grant.funder && <p className="mt-1 text-[12.5px] text-[color:var(--site-text)]">{grant.funder}</p>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {/* ── Academic record: tabs instead of four collapsed boxes ── */}
          {recordTabs.length > 0 && (
            <div id="lh-record" className="scroll-mt-32">
              <Card
                id="labhead-record"
                title={<EditableText id="labhead.recordTitle" defaultValue="Academic Record" className="inline" />}
                action={
                  <Link to="/publications" className="text-[12.5px] font-semibold no-underline hover:underline" style={{ color: "var(--secondary-ink)" }}>
                    <EditableText id="labhead.publicationsCta" defaultValue="Browse all publications" className="inline" /> →
                  </Link>
                }
              >
                <div role="tablist" aria-label="Academic record" className="-mt-1 mb-4 flex gap-1 overflow-x-auto rounded-xl bg-[color:var(--site-surface-alt)] p-1 [scrollbar-width:none]">
                  {recordTabs.map((tab) => {
                    const on = tab.id === currentRecord;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => setRecordTab(tab.id)}
                        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition ${
                          on ? "bg-[color:var(--site-surface)] text-[color:var(--site-heading)] shadow-sm" : "text-[color:var(--site-muted)] hover:text-[color:var(--site-heading)]"
                        }`}
                      >
                        {tab.label}
                        <span className="tabular-nums opacity-60">{tab.count}</span>
                      </button>
                    );
                  })}
                </div>

                <div role="tabpanel" className="max-h-[440px] overflow-y-auto pr-1">
                  {currentRecord === "editorial" && (
                    <ul className="divide-y divide-[color:var(--site-border)]">
                      {editorial.map((item, index) => (
                        <li key={`${item.outlet}-${index}`} className="grid gap-0.5 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
                          <span className="text-[12px] font-semibold text-[color:var(--site-muted)]">{item.role}</span>
                          <span className="text-[13.5px] text-[color:var(--site-heading)]">{item.outlet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {currentRecord === "supervision" && (
                    <ol className="divide-y divide-[color:var(--site-border)]">
                      {supervision.map((item, index) => (
                        <li key={`${item.researcher}-${index}`} className="grid gap-0.5 py-2.5 sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-4">
                          <span className="text-[12px] font-semibold tabular-nums text-[color:var(--site-muted)]">{item.year}</span>
                          <span>
                            <span className="block text-[13.5px] font-semibold text-[color:var(--site-heading)]">{item.researcher}</span>
                            <span className="block text-[13px] leading-6 text-[color:var(--site-text)]">{item.thesis}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {currentRecord === "collaborations" && (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {collaborations.map((item, index) => (
                        <li key={`${item.institution}-${index}`} className="rounded-lg border border-[color:var(--site-border)] px-3 py-2.5">
                          <span className="block text-[13.5px] font-medium text-[color:var(--site-heading)]">{item.institution}</span>
                          {item.country && <span className="text-[12px] text-[color:var(--site-muted)]">{item.country}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {currentRecord === "venues" && (
                    <ul className="flex flex-wrap gap-2">
                      {venues.map((venue, index) => (
                        <li key={`${venue.name}-${index}`} className="rounded-lg border border-[color:var(--site-border)] bg-[color:var(--site-surface-alt)] px-3 py-1.5 text-[13px] text-[color:var(--site-heading)]">
                          {venue.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-5 lg:sticky lg:top-[calc(var(--nav-offset)+64px)] lg:h-fit">
          <Card id="labhead-links" title={<EditableText id="labhead.linksTitle" defaultValue="Academic Profiles" className="inline" />}>
            {links.length === 0 ? (
              <p className="text-sm text-[color:var(--site-muted)]">
                <EditableText id="labhead.noLinksText" defaultValue="No profile links yet." className="inline" />
              </p>
            ) : (
              <ul className="grid gap-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex h-10 items-center gap-3 rounded-xl border border-[color:var(--site-border)] px-3 text-[13.5px] font-medium text-[color:var(--site-heading)] no-underline transition hover:border-[color:var(--color-secondary)] ${FOCUS}`}
                    >
                      <AppIcon name={link.icon} size={16} />
                      <span className="flex-1">{link.label}</span>
                      <span aria-hidden="true" className="text-[color:var(--site-muted)]">↗</span>
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {(labHead.email || labHead.phone) && (
            <Card id="labhead-contact" title={<EditableText id="labhead.contactInfoLabel" defaultValue="Contact Info" className="inline" />}>
              <dl className="grid gap-3">
                {labHead.email && (
                  <div>
                    <dt className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[color:var(--site-muted)]">
                      <EditableText id="labhead.emailLabel" defaultValue="Email" className="inline" />
                    </dt>
                    <dd className="mt-1 break-all text-[13.5px] font-semibold">
                      <a href={`mailto:${labHead.email}`} className="no-underline hover:underline" style={{ color: "var(--secondary-ink)" }}>
                        {labHead.email}
                      </a>
                    </dd>
                  </div>
                )}
                {labHead.phone && (
                  <div className="border-t border-[color:var(--site-border)] pt-3">
                    <dt className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[color:var(--site-muted)]">
                      <EditableText id="labhead.phoneLabel" defaultValue="Phone" className="inline" />
                    </dt>
                    <dd className="mt-1 text-[13.5px] font-semibold">
                      <a href={`tel:${labHead.phone}`} className="no-underline hover:underline" style={{ color: "var(--secondary-ink)" }}>
                        {labHead.phone}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </Card>
          )}
        </aside>
      </div>

      {/* ── Continue exploring ── */}
      <section aria-labelledby="labhead-explore" className="border-t border-[color:var(--site-border)] bg-[color:var(--site-surface-alt)] px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <h2 id="labhead-explore" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--site-muted)]">
            <EditableText id="labhead.exploreTitle" defaultValue="Continue exploring" className="inline" />
          </h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { to: "/about", icon: "building" as const, title: "About", desc: "Learn more about the lab and mission.", ink: "var(--secondary-ink)", tint: "var(--color-secondary)" },
              { to: "/research-ideas", icon: "ideas" as const, title: "Research Ideas", desc: "Discover open questions to collaborate on.", ink: "var(--accent-ink)", tint: "var(--color-accent)" },
              { to: "/collaborators#collaborator-request", icon: "handshake" as const, title: "Request Collaboration", desc: "Jump directly to the collaborator request form.", ink: "var(--primary-ink)", tint: "var(--color-primary)" },
            ].map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`group flex h-full items-start gap-3.5 rounded-2xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] p-4 no-underline transition hover:border-[color:var(--color-secondary)] motion-safe:hover:-translate-y-0.5 ${FOCUS}`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${item.tint} 14%, transparent)`, color: item.ink }}>
                    <AppIcon name={item.icon} size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-[color:var(--site-heading)]">
                      <EditableText id={`labhead.cardTitle.${item.icon}`} defaultValue={item.title} className="inline" />
                    </span>
                    <span className="mt-0.5 block text-[12.5px] leading-5 text-[color:var(--site-muted)]">
                      <EditableText id={`labhead.cardDesc.${item.icon}`} defaultValue={item.desc} className="inline" />
                    </span>
                  </span>
                  <span aria-hidden="true" className="self-center text-[color:var(--site-muted)] transition-transform motion-safe:group-hover:translate-x-0.5">
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
