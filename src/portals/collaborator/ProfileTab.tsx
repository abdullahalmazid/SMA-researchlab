import { doc, updateDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import AppIcon, { type AppIconName } from "../../components/AppIcon";
import CloudinaryUpload from "../../components/CloudinaryUpload";
import CollaboratorCard from "../../components/CollaboratorCard";
import { db } from "../../firebase/config";
import type { CloudinaryUploadResult, CollaboratorProfile } from "../../types";
import { Avatar, Button, Field, Notice, Panel, TabHeader, areaClass, fieldClass } from "./ui";

const LINKS: { key: "linkedin" | "orcid" | "scholar" | "researchgate" | "facebook"; label: string; icon: AppIconName; placeholder: string }[] = [
  { key: "scholar", label: "Google Scholar", icon: "scholar", placeholder: "https://scholar.google.com/citations?user=…" },
  { key: "orcid", label: "ORCID", icon: "orcid", placeholder: "https://orcid.org/0000-…" },
  { key: "researchgate", label: "ResearchGate", icon: "researchgate", placeholder: "https://www.researchgate.net/profile/…" },
  { key: "linkedin", label: "LinkedIn", icon: "linkedin", placeholder: "https://www.linkedin.com/in/…" },
  { key: "facebook", label: "Facebook", icon: "facebook", placeholder: "https://facebook.com/…" },
];

const BIO_LIMIT = 600;

/** Only the fields this form edits — so "unsaved changes" ignores everything else on the doc. */
const editable = (p: CollaboratorProfile) => ({
  name: p.name ?? "",
  designation: p.designation ?? "",
  affiliation: p.affiliation ?? "",
  bio: p.bio ?? "",
  photo: p.photo ?? "",
  researchInterests: p.researchInterests ?? [],
  linkedin: p.linkedin ?? "",
  orcid: p.orcid ?? "",
  scholar: p.scholar ?? "",
  researchgate: p.researchgate ?? "",
  facebook: p.facebook ?? "",
});
type Draft = ReturnType<typeof editable>;

const ProfileTab: React.FC<{
  profile: CollaboratorProfile;
  onSaved: (profile: CollaboratorProfile) => void;
}> = ({ profile, onSaved }) => {
  const [draft, setDraft] = useState<Draft>(() => editable(profile));
  const [interestInput, setInterestInput] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  useEffect(() => setDraft(editable(profile)), [profile]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(editable(profile)), [draft, profile]);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  /* Leaving with unsaved edits asks first. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const addInterest = (raw: string) => {
    const parts = raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!parts.length) return;
    set("researchInterests", Array.from(new Set([...draft.researchInterests, ...parts])).slice(0, 12));
    setInterestInput("");
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setNotice({ tone: "error", text: "Your name can't be empty." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const payload = { ...draft, name: draft.name.trim(), bio: draft.bio.trim() };
      await updateDoc(doc(db, "collaborators", profile.id), payload);
      onSaved({ ...profile, ...payload });
      setNotice({ tone: "success", text: "Profile saved — it's live on your public page." });
    } catch (error) {
      console.error("Profile save failed", error);
      setNotice({ tone: "error", text: "Couldn't save your profile. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const preview: CollaboratorProfile = { ...profile, ...draft };

  return (
    <div className="pb-20">
      <TabHeader title="Profile" description="How you appear on the Collaborators page and your public profile." />

      {notice && (
        <div className="mb-3">
          <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </Notice>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_264px]">
        <div className="space-y-4">
          <Panel title="Identity">
            {/* Photo: a single compact row; the uploader opens only when asked for. */}
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={draft.name || profile.name} photo={draft.photo} size={52} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[color:var(--site-heading)]">Profile photo</p>
                <p className="text-[11.5px] text-[color:var(--site-muted)]">Square crop works best. Shown on your card and profile.</p>
              </div>
              <Button onClick={() => setPhotoOpen((open) => !open)} aria-expanded={photoOpen}>
                {photoOpen ? "Close" : draft.photo ? "Change" : "Upload"}
              </Button>
              {draft.photo && (
                <Button tone="quiet" onClick={() => set("photo", "")}>
                  Remove
                </Button>
              )}
            </div>
            {photoOpen && (
              <div className="mt-3 rounded-lg border border-[color:var(--site-border)] bg-[color:var(--site-surface-alt)] p-3">
                <CloudinaryUpload
                  label=""
                  currentUrl={draft.photo}
                  aspectHint="JPG, PNG or WEBP."
                  maxEdge={800}
                  onUpload={(result: CloudinaryUploadResult) => {
                    set("photo", result.secure_url);
                    setPhotoOpen(false);
                  }}
                />
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Full name" htmlFor="pf-name" className="sm:col-span-2">
                <input id="pf-name" className={fieldClass} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Dr. Jane Smith" />
              </Field>
              <Field label="Designation" htmlFor="pf-designation">
                <input
                  id="pf-designation"
                  className={fieldClass}
                  value={draft.designation}
                  onChange={(e) => set("designation", e.target.value)}
                  placeholder="PhD Student"
                />
              </Field>
              <Field label="Affiliation" htmlFor="pf-affiliation">
                <input
                  id="pf-affiliation"
                  className={fieldClass}
                  value={draft.affiliation}
                  onChange={(e) => set("affiliation", e.target.value)}
                  placeholder="BUET, Dept. of IPE"
                />
              </Field>
              <Field label="Bio" htmlFor="pf-bio" hint={`${draft.bio.length}/${BIO_LIMIT}`} className="sm:col-span-2">
                <textarea
                  id="pf-bio"
                  rows={4}
                  maxLength={BIO_LIMIT}
                  className={areaClass}
                  value={draft.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  placeholder="Two or three sentences about your research."
                />
              </Field>
              <Field label="Research interests" htmlFor="pf-interests" hint="Enter or comma to add" className="sm:col-span-2">
                <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-2 py-1 focus-within:border-[color:var(--color-secondary)]">
                  {draft.researchInterests.map((interest) => (
                    <span
                      key={interest}
                      className="inline-flex items-center gap-1 rounded-md bg-[color:var(--site-surface-alt)] px-2 py-0.5 text-[12px] font-medium text-[color:var(--site-text)]"
                    >
                      {interest}
                      <button
                        type="button"
                        aria-label={`Remove ${interest}`}
                        onClick={() => set("researchInterests", draft.researchInterests.filter((item) => item !== interest))}
                        className="text-[color:var(--site-muted)] hover:text-rose-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    id="pf-interests"
                    value={interestInput}
                    onChange={(e) => {
                      if (e.target.value.includes(",")) addInterest(e.target.value);
                      else setInterestInput(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addInterest(interestInput);
                      } else if (e.key === "Backspace" && !interestInput && draft.researchInterests.length) {
                        set("researchInterests", draft.researchInterests.slice(0, -1));
                      }
                    }}
                    onBlur={() => addInterest(interestInput)}
                    placeholder={draft.researchInterests.length ? "" : "e.g. Supply chain, Optimisation"}
                    className="h-7 min-w-[120px] flex-1 border-0 bg-transparent px-1 text-[13px] text-[color:var(--site-heading)] outline-none"
                  />
                </div>
              </Field>
            </div>
          </Panel>

          <Panel title="Academic & social links" description="Shown as icons on your card. Leave blank to hide.">
            <div className="grid gap-3 sm:grid-cols-2">
              {LINKS.map((link) => (
                <Field key={link.key} label={link.label} htmlFor={`pf-${link.key}`}>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--site-muted)]" aria-hidden="true">
                      <AppIcon name={link.icon} size={14} />
                    </span>
                    <input
                      id={`pf-${link.key}`}
                      type="url"
                      inputMode="url"
                      className={`${fieldClass} pl-8`}
                      value={draft[link.key]}
                      onChange={(e) => set(link.key, e.target.value.trim())}
                      placeholder={link.placeholder}
                    />
                  </div>
                </Field>
              ))}
            </div>
          </Panel>
        </div>

        {/* Live preview — exactly the card visitors see. */}
        <aside className="lg:sticky lg:top-[calc(var(--nav-offset)+16px)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--site-muted)]">Live preview</p>
            <a
              href={`/collaborators/${profile.uid}`}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] font-semibold no-underline hover:underline"
              style={{ color: "var(--secondary-ink)" }}
            >
              Public page ↗
            </a>
          </div>
          <div className="pointer-events-none">
            <CollaboratorCard collaborator={preview} previewMode />
          </div>
        </aside>
      </div>

      {/* Save bar: only while there is something to save. */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+68px)] z-40 px-4 lg:bottom-4">
          <div className="mx-auto flex max-w-xl items-center gap-2 rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)] px-3 py-2 shadow-[0_12px_32px_rgba(15,23,42,0.18)]">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
            <p className="flex-1 text-[12.5px] font-semibold text-[color:var(--site-heading)]">Unsaved changes</p>
            <Button tone="quiet" disabled={saving} onClick={() => setDraft(editable(profile))}>
              Discard
            </Button>
            <Button tone="primary" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileTab;
