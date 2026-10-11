import { useCollaborators, useSiteContent } from "../firebase/hooks";

/**
 * The lab head, assembled once for every place that shows him — the Home hero
 * card, the Lab head page and the footer — so they can't disagree.
 *
 * Precedence: Content Editor fields (on-page edits write there), then his
 * collaborator profile, then the built-in defaults.
 *
 * Two text fields with distinct jobs:
 *  - intro (`labhead.shortBio`): one or two sentences for the Home card and the
 *    page header. Derived from the biography when left empty.
 *  - biography (`labhead.fullBio`): the full text, shown once on the page.
 */

export const DEFAULT_BIO = `Dr. Syed Mithun Ali is a Professor in the Department of Industrial and Production Engineering at Bangladesh University of Engineering and Technology (BUET). He holds a PhD in supply chain management from the Nagoya Institute of Technology, Japan.

His research enhances both the theoretical and practical understanding of the environmental, social and economic sustainability of organisations and their supply chains. Through mentoring and international partnerships, he works to advance sustainable practices that benefit both industry and the environment.`;

/* Institutional address only — personal numbers and private email stay out. */
const DEFAULT_EMAIL = "mithun@ipe.buet.ac.bd";
const DEFAULT_SCHOLAR = "https://scholar.google.com/citations?user=vCkenssAAAAJ&hl=en";
const DEFAULT_RESEARCHGATE = "https://www.researchgate.net/profile/Syed_Mithun_Ali";
const DEFAULT_SCOPUS = "https://www.scopus.com/authid/detail.uri?authorId=57193722242";
const DEFAULT_INTERESTS =
  "Applied artificial intelligence and machine learning, Logistics and supply chain management, Supply chain risk management, Supply chain sustainability";

/* From the Google Scholar record; `asOf` is shown beside them so they can't go
   quietly stale. */
const DEFAULT_METRICS = {
  citations: "12,160",
  hIndex: "60",
  i10Index: "141",
  publications: "152",
  experienceYears: "19+",
  asOf: "August 2026",
};

const ENV_UID = String(import.meta.env?.VITE_LAB_HEAD_UID ?? "").trim();

/** Whole sentences from the start of `text`, up to about `limit` characters. */
export const introFrom = (text: string, limit = 220) => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [clean];
  let out = "";
  for (const sentence of sentences) {
    if ((out + sentence).trim().length > limit) break;
    out += sentence;
  }
  return out.trim() || `${clean.slice(0, limit - 1).trimEnd()}…`;
};

export interface LabHeadInfo {
  uid: string;
  name: string;
  title: string;
  department: string;
  photo: string;
  intro: string;
  biography: string;
  email: string;
  phone: string;
  linkedin: string;
  scholar: string;
  orcid: string;
  researchgate: string;
  scopus: string;
  interests: string[];
}

export const useLabHead = () => {
  const { content, loading } = useSiteContent();
  const { collaborators, loading: collaboratorsLoading } = useCollaborators();

  const uid = content["labhead.profileUid"] || ENV_UID;
  const profile = uid ? collaborators.find((person) => person.uid === uid) : undefined;
  const pick = (...values: (string | undefined)[]) => values.find((value) => value && value.trim())?.trim() ?? "";

  const biography = pick(content["labhead.fullBio"], profile?.bio, content["labhead.shortBio"], DEFAULT_BIO);
  const interests = pick(content["labhead.researchInterests"], profile?.researchInterests?.join(", "), DEFAULT_INTERESTS)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const labHead: LabHeadInfo = {
    uid,
    name: pick(content["labhead.name"], profile?.name),
    title: pick(content["labhead.title"], profile?.designation),
    department: pick(content["labhead.department"], profile?.affiliation),
    photo: pick(content["labhead.photo"], profile?.photo),
    intro: pick(content["labhead.shortBio"]) || introFrom(biography),
    biography,
    email: pick(content["labhead.email"], profile?.email, DEFAULT_EMAIL),
    phone: pick(content["labhead.phone"]),
    linkedin: pick(content["labhead.linkedin"], profile?.linkedin),
    scholar: pick(content["labhead.scholar"], profile?.scholar, DEFAULT_SCHOLAR),
    orcid: pick(content["labhead.orcid"], profile?.orcid),
    researchgate: pick(content["labhead.researchgate"], profile?.researchgate, DEFAULT_RESEARCHGATE),
    scopus: pick(content["labhead.scopus"], DEFAULT_SCOPUS),
    interests,
  };

  const metrics = {
    citations: pick(content["labhead.metrics.citations"], DEFAULT_METRICS.citations),
    hIndex: pick(content["labhead.metrics.hIndex"], DEFAULT_METRICS.hIndex),
    i10Index: pick(content["labhead.metrics.i10Index"], DEFAULT_METRICS.i10Index),
    publications: pick(content["labhead.metrics.publications"], DEFAULT_METRICS.publications),
    experienceYears: pick(content["labhead.metrics.experienceYears"], DEFAULT_METRICS.experienceYears),
    asOf: pick(content["labhead.metrics.asOf"], DEFAULT_METRICS.asOf),
  };

  return { labHead, metrics, content, loading: loading || collaboratorsLoading };
};
