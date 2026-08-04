import { collection, getDocs, limit, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import { useSiteContent } from "../firebase/hooks";
import AppIcon, { type AppIconName } from "./AppIcon";
import EditableText from "./EditableText";

const LAB_HEAD_UID = String(import.meta.env?.VITE_LAB_HEAD_UID ?? "").trim();

/* ── quick links ──────────────────────────────────────────────────────────
   The navbar's NAV list, flattened to destinations in the order it presents
   them. These must stay in step with the navbar by hand.

   Two things to watch when you edit the navbar:
   - `/lab-head` exists in the navbar and was missing from the old footer.
   - The ids are shared with the navbar's EditableText, and one id must mean
     one label. /collaborators is "People" in the navbar; the old footer called
     it "Collaborators" under the same `nav-collaborators` id, so editing
     either surface silently rewrote the other. It says "People" here now.
     The mobile tab bar deliberately uses its own ids for its shorter wording. */

interface FooterLink {
  to: string;
  label: string;
  icon: AppIconName;
  id: string;
}

const DESTINATIONS: FooterLink[] = [
  { to: "/", label: "Home", icon: "home", id: "nav-home" },
  { to: "/about", label: "The lab", icon: "building", id: "nav-about" },
  { to: "/lab-head", label: "Lab head", icon: "admin", id: "nav-lab-head" },
  { to: "/publications", label: "Publications", icon: "publications", id: "nav-publications" },
  { to: "/research-ideas", label: "Research ideas", icon: "ideas", id: "nav-research-ideas" },
  { to: "/gallery", label: "Gallery", icon: "gallery", id: "nav-gallery" },
  { to: "/collaborators", label: "People", icon: "collaborators", id: "nav-collaborators" },
  { to: "/contact", label: "Contact", icon: "contact", id: "nav-contact" },
];

/* ── branding fallbacks ───────────────────────────────────────────────────
   Only used when the CMS value is empty. The name was previously hardcoded in
   three separate spots in this file — the brand line, the copyright, and the
   letter in the logo mark — so a rename left the old initial behind. */

const DEFAULT_LAB_NAME = "DASS Research Lab";
const DEFAULT_INSTITUTION = "Bangladesh University of Engineering and Technology";

/** The mark in the logo tile. Derived, never typed by hand. */
const labInitial = (labName: string): string =>
  (Array.from(labName.trim().split(/\s+/)[0] ?? "")[0] ?? "").toUpperCase();

const HONORIFIC = /^(dr|prof|mr|mrs|ms|md|mohd|engr)\.?$/i;

/** First + last initial, honorifics skipped: "Prof. Dr. Shahidur Rahman" → SR.
 *  charAt(0) on that string returns the P of "Prof." */
function personInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const named = words.filter((word) => !HONORIFIC.test(word));
  const source = named.length > 0 ? named : words;
  const picked = source.length > 1 ? [source[0], source[source.length - 1]] : source.slice(0, 1);
  return picked
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}

/** The subset of a collaborator record the footer reads. */
interface LabHeadDoc {
  name?: string;
  designation?: string;
  photo?: string;
  linkedin?: string;
  scholar?: string;
  orcid?: string;
  researchgate?: string;
}

/* Text levels, named once. The old file used 0.3 / 0.35 / 0.4 for headings and
   legal text, which sits near 2:1 against the footer — well under 4.5:1. */
const FG_STRONG = "text-white";
const FG_MUTED = "text-white/[.62]";
const FG_FAINT = "text-white/[.48]";

/* Hover and focus as CSS, not eight onMouseEnter handlers mutating style.
   Mouse events never fire for keyboard users, so the old footer had no visible
   focus state anywhere in it. */
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-footer)]";

const ROW = `group/row flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13.5px] no-underline transition ${FG_MUTED} hover:bg-white/[.08] hover:text-white ${FOCUS}`;

const ROW_ICON =
  "grid h-7 w-7 flex-none place-items-center rounded-lg bg-white/[.07] text-white/[.62] transition group-hover/row:bg-white/[.14] group-hover/row:text-[color:var(--color-accent)]";

const ColumnHeading: React.FC<{ id?: string; children: React.ReactNode }> = ({ id, children }) => (
  <h2
    id={id}
    className={`mb-4 flex items-center gap-2.5 text-[11px] font-extrabold uppercase tracking-[0.16em] ${FG_MUTED} after:h-px after:flex-1 after:bg-white/10 after:content-['']`}
  >
    {children}
  </h2>
);

const Footer: React.FC = () => {
  const { content } = useSiteContent();
  const { role, appUser } = useAuth();
  const [photoFailed, setPhotoFailed] = useState(false);

  /* Same source the navbar's Brand should read. Two components each holding
     their own copy of the lab's name is how you end up with one name in the
     header and a different one in the footer. */
  const labName = content["branding.labName"] || DEFAULT_LAB_NAME;
  const institution = content["branding.institution"] || DEFAULT_INSTITUTION;

  const signedIn = role === "admin" || role === "collaborator" || role === "lab_head";
  const isAdmin =
    role === "admin" || appUser?.adminLevel === "primary" || appUser?.adminLevel === "moderator";

  /* Offering "Portal login" to someone already signed in is noise. The navbar
     swaps to an account menu in that state; the footer points at the same
     destination that menu would. */
  const portal = !signedIn
    ? {
        to: "/login",
        label: "Portal login",
        icon: "login" as AppIconName,
        id: "footer.portalLoginBtn",
      }
    : isAdmin
      ? {
          to: "/admin",
          label: "Admin dashboard",
          icon: "admin" as AppIconName,
          id: "footer.adminDashboardBtn",
        }
      : {
          to: "/collaborator-portal",
          label: "My portal",
          icon: "portal" as AppIconName,
          id: "footer.myPortalBtn",
        };

  const labHeadHref = LAB_HEAD_UID
    ? `/collaborators/${encodeURIComponent(LAB_HEAD_UID)}`
    : "/lab-head";

  /**
   * The lab head is a collaborator record, not site content. Reading only
   * `content["labhead.*"]` meant that on any install where those keys were
   * never filled in, `labHeadName` was undefined — and since the whole card is
   * wrapped in `{labHeadName && …}`, it silently rendered nothing at all. No
   * error, no empty box, just a missing block.
   *
   * Same query shape the navbar uses to find the signed-in user's photo:
   * collaborators are matched on a `uid` field, not on the document id.
   */
  const [labHeadDoc, setLabHeadDoc] = useState<LabHeadDoc | null>(null);

  useEffect(() => {
    if (!LAB_HEAD_UID) return;
    let live = true;
    getDocs(query(collection(db, "collaborators"), where("uid", "==", LAB_HEAD_UID), limit(1)))
      .then((snap) => {
        if (live && !snap.empty) setLabHeadDoc(snap.docs[0].data() as LabHeadDoc);
      })
      .catch(() => {
        /* Offline, or rules deny the read — the card falls back to whatever
           site content has, and to nothing if that's empty too. */
      });
    return () => {
      live = false;
    };
  }, []);

  /* Site content wins where an admin has set it, so the CMS can still override
     the profile without editing the collaborator record. */
  const labHeadName = content["labhead.name"] || labHeadDoc?.name || "";
  const labHeadTitle = content["labhead.title"] || labHeadDoc?.designation || "";
  const labHeadPhoto = content["labhead.photo"] || labHeadDoc?.photo || "";

  const address = content["contact.address"];
  const email = content["contact.email"];
  const phone = content["contact.phone"];

  /* Same fallback chain — these live on the collaborator record too, so the
     icon row disappeared for exactly the same reason the card did. */
  const socialLinks = (
    [
      {
        href: content["labhead.linkedin"] || labHeadDoc?.linkedin,
        label: "LinkedIn",
        icon: "linkedin",
      },
      {
        href: content["labhead.scholar"] || labHeadDoc?.scholar,
        label: "Google Scholar",
        icon: "scholar",
      },
      { href: content["labhead.orcid"] || labHeadDoc?.orcid, label: "ORCID", icon: "orcid" },
      {
        href: content["labhead.researchgate"] || labHeadDoc?.researchgate,
        label: "ResearchGate",
        icon: "researchgate",
      },
    ] as { href?: string; label: string; icon: AppIconName }[]
  ).filter((social): social is { href: string; label: string; icon: AppIconName } =>
    Boolean(social.href),
  );

  const backToTop = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    /* #main is the navbar's skip-link target, so both agree on where the top of
       the page is. Focus has to travel with the scroll, or the next Tab drops
       the user straight back into the footer they just left. */
    const target =
      document.getElementById("main") ?? document.querySelector("main") ?? document.body;
    target.setAttribute("tabindex", "-1");
    (target as HTMLElement).focus({ preventScroll: true });
  };

  return (
    <footer className="mt-16" style={{ background: "var(--color-footer)" }}>
      <div
        aria-hidden="true"
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, var(--color-accent), var(--color-secondary), var(--color-accent))",
        }}
      />

      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.15fr_1fr_1fr] md:gap-12">
          {/* ------------------------------------------------- branding */}
          <div>
            <div className="mb-[18px] flex items-center gap-3">
              {content["branding.logoUrl"] ? (
                <img
                  src={content["branding.logoUrl"]}
                  alt=""
                  className="h-11 w-11 flex-none rounded-[13px] object-contain"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="grid h-11 w-11 flex-none place-items-center rounded-[13px] text-[19px] font-black"
                  style={{
                    background: "linear-gradient(135deg, var(--color-accent), #f97316)",
                    color: "#1f2937",
                    boxShadow: "0 4px 12px rgba(240,180,41,0.25)",
                  }}
                >
                  {/* Derived from the name. This was a literal "R" here and a
                      literal "S" in the navbar's Brand. */}
                  {labInitial(labName)}
                </div>
              )}
              <div className="min-w-0">
                <div
                  className="text-[19px] font-black leading-tight"
                  style={{ color: "var(--color-accent)", fontFamily: "var(--font-heading)" }}
                >
                  {/* Shared id with the navbar wordmark: rename once, changes both. */}
                  <EditableText id="branding.labName" defaultValue={labName} className="inline" />
                </div>
                <div className={`mt-0.5 text-[11.5px] ${FG_FAINT}`}>
                  <EditableText
                    id="footer.institution"
                    defaultValue={institution}
                    className="inline"
                  />
                </div>
              </div>
            </div>

            <p className={`mb-[22px] max-w-[32ch] text-[13.5px] leading-[1.8] ${FG_MUTED}`}>
              <EditableText
                id="footer.tagline"
                defaultValue={
                  content["footer.tagline"] ??
                  "Advancing the frontiers of artificial intelligence, signal processing and data science at BUET."
                }
                className="inline"
              />
            </p>

            {/* The card looked clickable — rounded, bordered, shaded on hover —
                but led nowhere. It now opens the lab head's profile. */}
            {labHeadName && (
              <Link
                to={labHeadHref}
                aria-label={`View ${labHeadName}'s profile`}
                className={`group flex items-center gap-[13px] rounded-2xl border border-white/10 px-3.5 py-3 no-underline transition hover:border-[color:var(--color-accent)]/40 hover:bg-white/10 motion-safe:hover:-translate-y-px ${FOCUS}`}
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))",
                }}
              >
                <span
                  aria-hidden="true"
                  className="grid h-[52px] w-[52px] flex-none place-items-center overflow-hidden rounded-[15px] text-[17px] font-extrabold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--color-accent), var(--color-secondary))",
                    /* A ring rather than a border, so it doesn't eat into the photo. */
                    boxShadow: "0 0 0 2px rgba(240,180,41,0.34), 0 6px 16px rgba(0,0,0,0.3)",
                  }}
                >
                  {labHeadPhoto && !photoFailed ? (
                    <img
                      src={labHeadPhoto}
                      /* Empty: the name sits right beside it, so alt={name} made
                         a screen reader announce it twice. */
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={() => setPhotoFailed(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    /* charAt(0) on "Prof. Dr. Shahidur Rahman" gives "P". */
                    personInitials(labHeadName)
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    title={labHeadName}
                    className={`block truncate text-[14.5px] font-extrabold ${FG_STRONG}`}
                  >
                    {labHeadName}
                  </span>
                  {labHeadTitle && (
                    <span className={`mt-0.5 block truncate text-[11.5px] ${FG_FAINT}`}>
                      {labHeadTitle}
                    </span>
                  )}
                  <span
                    className="mt-[7px] inline-flex items-center gap-1.5 rounded-full py-[3px] pl-[7px] pr-[9px] text-[10px] font-extrabold uppercase tracking-[0.09em]"
                    style={{ background: "rgba(240,180,41,0.15)", color: "var(--color-accent)" }}
                  >
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-current" />
                    <EditableText
                      id="footer.labDirectorLabel"
                      defaultValue="Lab Director"
                      className="inline"
                    />
                  </span>
                </span>

                <span
                  aria-hidden="true"
                  className={`flex-none transition group-hover:text-[color:var(--color-accent)] motion-safe:group-hover:translate-x-0.5 ${FG_FAINT}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" />
                  </svg>
                </span>
              </Link>
            )}

            {socialLinks.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {socialLinks.map((social) => (
                  <li key={social.label}>
                    {/* Ghost tiles. These were white icons on a white background —
                        the tile colour came from a `color` field set to #ffffff. */}
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${labHeadName ?? labName} on ${social.label}`}
                      className={`grid h-[38px] w-[38px] place-items-center rounded-[11px] border border-white/10 bg-white/[.07] text-white/[.78] no-underline transition hover:border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)] hover:text-[#1f2937] motion-safe:hover:-translate-y-0.5 ${FOCUS}`}
                    >
                      <AppIcon name={social.icon} size={16} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---------------------------------------------- quick links */}
          {/* Rendered from the shared NAV model, so this list can no longer fall
              behind the navbar — /lab-head was missing here entirely. */}
          <nav aria-labelledby="footer-links">
            <ColumnHeading id="footer-links">
              <EditableText
                id="footer.quickLinksTitle"
                defaultValue="Quick Links"
                className="inline"
              />
            </ColumnHeading>

            <ul className="grid grid-cols-1 gap-x-2.5 gap-y-0.5 min-[420px]:grid-cols-2">
              {DESTINATIONS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className={ROW}>
                    <span aria-hidden="true" className={ROW_ICON}>
                      <AppIcon name={link.icon} size={14} />
                    </span>
                    <EditableText id={link.id} defaultValue={link.label} className="inline" />
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              to={portal.to}
              className={`mt-4 inline-flex items-center gap-2 rounded-[10px] px-[18px] py-2.5 text-[12.5px] font-bold no-underline transition motion-safe:hover:-translate-y-px ${FOCUS}`}
              style={{
                background: "var(--color-accent)",
                color: "#1f2937",
                boxShadow: "0 2px 10px rgba(240,180,41,0.28)",
              }}
            >
              <AppIcon name={portal.icon} size={14} />
              <EditableText id={portal.id} defaultValue={portal.label} className="inline" />
            </Link>
          </nav>

          {/* ------------------------------------------------ get in touch */}
          {/* Same row component as Quick Links — identical tile, hover pill and
              rhythm. That likeness is what makes the columns read as siblings. */}
          <div>
            <ColumnHeading id="footer-contact">
              <EditableText
                id="footer.getInTouchTitle"
                defaultValue="Get In Touch"
                className="inline"
              />
            </ColumnHeading>

            <address className="grid not-italic">
              {address && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`${ROW} items-start`}
                >
                  <span aria-hidden="true" className={`${ROW_ICON} mt-px`}>
                    <AppIcon name="location" size={14} />
                  </span>
                  <span className="min-w-0 whitespace-pre-line leading-relaxed">{address}</span>
                </a>
              )}

              {email && (
                <a href={`mailto:${email}`} className={ROW}>
                  <span aria-hidden="true" className={ROW_ICON}>
                    <AppIcon name="contact" size={14} />
                  </span>
                  <span className="min-w-0 break-all">{email}</span>
                </a>
              )}

              {phone && (
                <a href={`tel:${phone.replace(/\s+/g, "")}`} className={ROW}>
                  <span aria-hidden="true" className={ROW_ICON}>
                    <AppIcon name="phone" size={14} />
                  </span>
                  <span className="min-w-0">{phone}</span>
                </a>
              )}
            </address>

            <Link
              to="/contact"
              className={`mt-4 inline-flex w-fit items-center gap-2 rounded-[10px] border border-white/10 bg-white/[.07] px-[18px] py-2.5 text-[12.5px] font-bold text-white/[.78] no-underline transition hover:bg-white/[.14] hover:text-white ${FOCUS}`}
            >
              <EditableText
                id="footer.sendMessageBtn"
                defaultValue="Send a message"
                className="inline"
              />
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------ bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          {/* The year sits outside the editable string. Baked into defaultValue,
              it froze at whatever year an admin last saved the line. */}
          <p className={`text-[11.5px] ${FG_FAINT}`}>
            © {new Date().getFullYear()}{" "}
            <EditableText
              id="footer.copyright"
              defaultValue={`${labName} — ${institution}`}
              className="inline"
            />
          </p>

          <button
            type="button"
            onClick={backToTop}
            className={`inline-flex items-center gap-[7px] rounded-[10px] border border-white/10 bg-white/[.07] px-3.5 py-[7px] text-[11.5px] font-bold transition hover:border-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)] hover:text-[#1f2937] ${FG_MUTED} ${FOCUS}`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
              <path d="M12 19V5M6 11l6-6 6 6" strokeLinecap="round" />
            </svg>
            <EditableText id="footer.backToTopBtn" defaultValue="Back to top" className="inline" />
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
