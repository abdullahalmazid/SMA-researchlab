import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/config";
import AppIcon from "./AppIcon";
import CloudinaryUpload from "./CloudinaryUpload";
import EditableText from "./EditableText";

/* ------------------------------------------------------------------ model */

const LINK_FIELDS = [
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/…" },
  { key: "scholar", label: "Google Scholar", placeholder: "scholar.google.com/citations?user=…" },
  { key: "orcid", label: "ORCID", placeholder: "0000-0002-1825-0097" },
  { key: "researchgate", label: "ResearchGate", placeholder: "researchgate.net/profile/…" },
  { key: "facebook", label: "Facebook", placeholder: "facebook.com/…" },
] as const;

type LinkKey = (typeof LINK_FIELDS)[number]["key"];

const REQUIRED = ["name", "email", "designation", "affiliation", "bio"] as const;
type RequiredKey = (typeof REQUIRED)[number];
type FieldKey = RequiredKey | LinkKey;

interface FormState extends Record<RequiredKey | LinkKey, string> {
  photo: string;
}

const EMPTY: FormState = {
  name: "",
  email: "",
  designation: "",
  affiliation: "",
  bio: "",
  photo: "",
  linkedin: "",
  scholar: "",
  orcid: "",
  researchgate: "",
  facebook: "",
};

const LABELS: Record<RequiredKey, string> = {
  name: "Full name",
  email: "Institutional email",
  designation: "Designation",
  affiliation: "University or institute",
  bio: "Short bio",
};

/**
 * Errors name the fix, not the failure. "Please fill all required fields" tells
 * someone that something is wrong and nothing about which thing or what to do.
 */
const RULES: Record<RequiredKey, (value: string) => string> = {
  name: (v) => (!v ? "Enter your full name." : v.length < 2 ? "That looks too short." : ""),
  email: (v) =>
    !v
      ? "Enter the email an administrator can reach you at."
      : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
        ? "That doesn't look like an email address."
        : "",
  designation: (v) => (!v ? "Enter your role — Professor, PhD student, and so on." : ""),
  affiliation: (v) => (!v ? "Enter the university or institute you're with." : ""),
  bio: (v) =>
    !v
      ? "Write a sentence or two about your work."
      : v.length < 30
        ? "A little more — one full sentence at least."
        : "",
};

const BIO_TARGET = 240;
const DRAFT_KEY = "collaborator-request:draft";

/** Domains worth catching a typo in. The whole flow dies if this bounces. */
const KNOWN_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "buet.ac.bd",
  "du.ac.bd",
];

function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...Array<number>(b.length).fill(0),
  ]);
  for (let j = 0; j <= b.length; j += 1) d[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return d[a.length][b.length];
}

function suggestEmail(value: string): string {
  const v = value.trim().toLowerCase();
  const at = v.lastIndexOf("@");
  if (at < 1) return "";
  const domain = v.slice(at + 1);
  if (!domain || KNOWN_DOMAINS.includes(domain)) return "";
  const match = KNOWN_DOMAINS.find((d) => editDistance(domain, d) <= 2);
  return match ? `${v.slice(0, at + 1)}${match}` : "";
}

/** Accept what people actually paste and repair it, rather than rejecting it. */
function normalizeUrl(key: LinkKey, raw: string): { value: string; error: string } {
  let v = raw.trim();
  if (!v) return { value: "", error: "" };
  if (key === "orcid" && /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(v)) v = `https://orcid.org/${v}`;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    new URL(v);
    return { value: v, error: "" };
  } catch {
    return { value: raw.trim(), error: "That doesn't look like a web address." };
  }
}

/* ------------------------------------------------------------- primitives */

const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2";
const INPUT_INVALID =
  "border-red-600 focus-visible:ring-red-600";

const Field: React.FC<{
  /** CMS key. Was previously the label *text*, so renaming a label orphaned its own entry. */
  contentId: string;
  htmlFor: string;
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}> = ({ contentId, htmlFor, label, optional, hint, error, trailing, children }) => (
  <div>
    <div className="mb-1.5 flex items-baseline gap-2">
      <label htmlFor={htmlFor} className="text-[12.5px] font-semibold text-slate-600">
        <EditableText id={contentId} defaultValue={label} className="inline" />
        {optional && <span className="ml-1.5 font-medium text-slate-400">optional</span>}
      </label>
      {trailing && <span className="ml-auto">{trailing}</span>}
    </div>
    {children}
    {hint && (
      <p id={`${htmlFor}-hint`} className="mt-1.5 text-[11.5px] leading-normal text-slate-400">
        {hint}
      </p>
    )}
    {error && (
      <p id={`${htmlFor}-error`} className="mt-1.5 text-[12px] font-medium text-red-700">
        {error}
      </p>
    )}
  </div>
);

const TagInput: React.FC<{
  id: string;
  values: string[];
  onChange: (next: string[]) => void;
  describedBy?: string;
}> = ({ id, values, onChange, describedBy }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const next = [...values];
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((tag) => {
        if (tag.length <= 40 && !next.some((v) => v.toLowerCase() === tag.toLowerCase())) {
          next.push(tag);
        }
      });
    if (next.length !== values.length) onChange(next);
    setDraft("");
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 p-1.5 focus-within:ring-2 focus-within:ring-[color:var(--color-secondary)] focus-within:ring-offset-2"
    >
      {values.map((tag, index) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 py-1 pl-2.5 pr-1.5 text-[12px] font-medium text-slate-600"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={(event) => {
              event.stopPropagation();
              onChange(values.filter((_, i) => i !== index));
              inputRef.current?.focus();
            }}
            className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition hover:bg-slate-300 hover:text-slate-700"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      ))}
      <input
        id={id}
        ref={inputRef}
        value={draft}
        autoComplete="off"
        aria-describedby={describedBy}
        placeholder="Type an interest, press Enter"
        onChange={(e) => setDraft(e.target.value)}
        /* Blur commits too — otherwise a typed-but-unsubmitted tag is silently
           dropped on submit, and people don't notice until their card is live. */
        onBlur={(e) => e.target.value.trim() && commit(e.target.value)}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (text.includes(",")) {
            e.preventDefault();
            commit(text);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(e.currentTarget.value);
          } else if (e.key === "Backspace" && !e.currentTarget.value && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        className="min-w-[140px] flex-1 border-0 px-1.5 py-1 text-[13.5px] outline-none placeholder:text-slate-400"
      />
    </div>
  );
};

/* ------------------------------------------------------------------- form */

const CollaboratorRequestForm: React.FC = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [interests, setInterests] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [emailHint, setEmailHint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [copied, setCopied] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const startedAt = useRef(Date.now());

  const done = Boolean(requestId);

  /* ------------------------------------------------------------- drafts */

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { form?: Partial<FormState>; interests?: string[] };
      if (saved.form) setForm((prev) => ({ ...prev, ...saved.form }));
      if (saved.interests) setInterests(saved.interests);
      setDraftRestored(true);
    } catch {
      /* corrupt draft is not worth surfacing — start clean */
    }
  }, []);

  const isDirty = useMemo(
    () => interests.length > 0 || Object.values(form).some(Boolean),
    [form, interests],
  );

  useEffect(() => {
    if (done || !isDirty) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, interests }));
      } catch {
        /* private mode / quota — the form still works, it just won't survive a reload */
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [form, interests, isDirty, done]);

  /** A long form and a stray Cmd-W is a bad combination. */
  useEffect(() => {
    if (done || !isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, done]);

  /* ---------------------------------------------------------- validation */

  const setField = useCallback(
    (key: keyof FormState, value: string) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      /* Re-validate only what is already showing an error, so nobody gets
         scolded mid-word on a field they haven't finished typing. */
      setErrors((prev) => {
        if (!prev[key as FieldKey]) return prev;
        const rule = RULES[key as RequiredKey];
        if (!rule) return prev;
        const next = { ...prev };
        const message = rule(value.trim());
        if (message) next[key as FieldKey] = message;
        else delete next[key as FieldKey];
        return next;
      });
    },
    [],
  );

  const validateOnBlur = useCallback(
    (key: RequiredKey) => {
      const message = RULES[key](form[key].trim());
      setErrors((prev) => {
        const next = { ...prev };
        if (message) next[key] = message;
        else delete next[key];
        return next;
      });
      if (key === "email") setEmailHint(message ? "" : suggestEmail(form.email));
    },
    [form],
  );

  const blurLink = useCallback((key: LinkKey) => {
    setForm((prev) => {
      const { value } = normalizeUrl(key, prev[key]);
      return prev[key] === value ? prev : { ...prev, [key]: value };
    });
    setErrors((prev) => {
      const { error } = normalizeUrl(key, form[key]);
      const next = { ...prev };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
  }, [form]);

  const focusField = (key: FieldKey) => {
    document.getElementById(key)?.focus();
  };

  /* -------------------------------------------------------------- submit */

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    /* Bots fill hidden fields and submit instantly. Neither stops a determined
       attacker — that needs Firestore rules and App Check — but both are free. */
    if (honeypotRef.current?.value) return;
    if (Date.now() - startedAt.current < 3000) return;

    const found: Partial<Record<FieldKey, string>> = {};
    REQUIRED.forEach((key) => {
      const message = RULES[key](form[key].trim());
      if (message) found[key] = message;
    });
    LINK_FIELDS.forEach(({ key }) => {
      const { error } = normalizeUrl(key, form[key]);
      if (error) found[key] = error;
    });

    setErrors(found);
    if (Object.keys(found).length > 0) {
      setSubmitError("");
      /* Focus the summary rather than the first field: it tells you how many
         problems there are before dropping you into one of them. */
      window.requestAnimationFrame(() => {
        summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        summaryRef.current?.focus();
      });
      return;
    }

    setSubmitError("");
    setSubmitting(true);
    try {
      const request = await addDoc(collection(db, "pendingRequests"), {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        designation: form.designation.trim(),
        affiliation: form.affiliation.trim(),
        bio: form.bio.trim(),
        photo: form.photo,
        ...Object.fromEntries(LINK_FIELDS.map(({ key }) => [key, form[key].trim()])),
        researchInterests: interests,
        status: "pending",
        /* Kept as an ISO string for whatever already reads it, with a server
           clock alongside it for anything that needs to sort reliably. */
        submittedAt: new Date().toISOString(),
        createdAt: serverTimestamp(),
      });
      window.localStorage.removeItem(DRAFT_KEY);
      setRequestId(request.id);
    } catch {
      setSubmitError(
        "The request didn't reach the server. Your answers are still here — check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (done) successRef.current?.focus();
  }, [done]);

  /* ------------------------------------------------------------- success */

  if (done) {
    return (
      /* Inline, not a modal. The form is gone, so there is nothing behind this
         to trap focus from — and the old dialog had no trap, no focus move and
         no Escape handler anyway. */
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div
          className="px-6 py-7 text-white"
          style={{ background: "linear-gradient(135deg,var(--color-primary),var(--color-secondary))" }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <AppIcon name="check" size={24} />
          </div>
          <h3
            ref={successRef}
            tabIndex={-1}
            className="mt-4 text-2xl font-black focus:outline-none"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Request submitted
          </h3>
          <p className="mt-1.5 text-sm text-white/75">
            Your application is now waiting for administrative review.
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-black text-amber-900">What happens next</p>
            {/* Numbered because this genuinely is a sequence — the order is the
                information, not decoration. */}
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-amber-900/80">
              <li>An administrator reviews the information you submitted.</li>
              <li>Review takes a few days. You don&apos;t need to submit again.</li>
              <li>Once approved, you&apos;ll get an email with a secure link.</li>
              <li>Open that link to set the password for your account.</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm font-black text-sky-900">About that email</p>
            <p className="mt-1 text-sm leading-6 text-sky-800">
              It arrives from Firebase and says <strong>&ldquo;Reset password&rdquo;</strong> — for
              a new account, that same link sets your first one. Check Spam, Junk and Promotions if
              it hasn&apos;t appeared within an hour.
            </p>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Request reference
            </p>
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
              <code className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">
                {requestId}
              </code>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(requestId);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  } catch {
                    /* No clipboard access (or an insecure origin) — the text is
                       selectable, so say so rather than failing silently. */
                    setSubmitError("Couldn't copy automatically — select the reference and copy it.");
                  }
                }}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm transition hover:text-slate-900"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Quote this if you need to follow up with the administrator.
            </p>
            {submitError && <p className="mt-2 text-xs text-red-700">{submitError}</p>}
          </div>

          {/* navigate(), not window.location.href — the old one hard-reloaded
              the whole SPA, on the page it was already on. */}
          <button
            type="button"
            onClick={() => navigate("/collaborators")}
            className="w-full rounded-xl py-3 text-sm font-black text-white transition hover:brightness-110"
            style={{ background: "var(--color-primary)" }}
          >
            Back to collaborators
          </button>
        </div>
      </div>
    );
  }

  const failures = REQUIRED.filter((key) => errors[key]).concat(
    LINK_FIELDS.map(({ key }) => key).filter((key) => errors[key]) as never[],
  );
  const linkCount = LINK_FIELDS.filter(({ key }) => form[key]).length;

  return (
    /* noValidate: native validation fires first and shows browser-styled
       bubbles that can't be restyled, translated or pointed at by an error
       summary. One validation path, one presentation. */
    <form onSubmit={submit} noValidate>
      <div className="mb-6 flex gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-[12.5px] leading-relaxed text-blue-800">
        <span className="mt-0.5 shrink-0">
          <AppIcon name="about" size={13} />
        </span>
        <span>
          <EditableText
            id="collab-form-info-1"
            defaultValue="Approval is followed by an automated email containing a secure link to set your password. Double-check your address below — a typo there is the one mistake we can't recover from. Questions:"
            className="inline"
          />{" "}
          <a href="mailto:rahmanlab@gmail.com" className="font-medium text-blue-700 underline">
            rahmanlab@gmail.com
          </a>
        </span>
      </div>

      {draftRestored && (
        <p className="mb-5 text-[12px] text-slate-500">
          Picked up where you left off.{" "}
          <button
            type="button"
            onClick={() => {
              setForm(EMPTY);
              setInterests([]);
              setErrors({});
              setDraftRestored(false);
              window.localStorage.removeItem(DRAFT_KEY);
            }}
            className="font-semibold text-slate-700 underline"
          >
            Start over
          </button>
        </p>
      )}

      {failures.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 focus:outline-none"
        >
          <p className="text-[13px] font-bold text-red-700">
            {failures.length === 1
              ? "One field needs attention"
              : `${failures.length} fields need attention`}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {failures.map((key) => (
              <li key={key} className="text-[12.5px] leading-relaxed">
                <button
                  type="button"
                  onClick={() => focusField(key)}
                  className="text-left text-red-700 underline"
                >
                  {LABELS[key as RequiredKey] ??
                    LINK_FIELDS.find((l) => l.key === key)?.label}{" "}
                  — {errors[key]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hidden from people, irresistible to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Company
          <input ref={honeypotRef} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {/* ------------------------------------------------------ about you */}
      <fieldset className="mb-7 border-0 p-0">
        <legend className="mb-0.5 text-[15px] font-bold text-slate-900">
          <EditableText id="collab-form-group-about" defaultValue="About you" className="inline" />
        </legend>
        <p className="mb-3.5 text-[12.5px] leading-relaxed text-slate-500">
          This is what appears on your card in the directory.
        </p>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {(
            [
              { key: "name", autoComplete: "name", placeholder: "Jane Smith" },
              { key: "email", autoComplete: "email", placeholder: "jane@buet.ac.bd", type: "email" },
              {
                key: "designation",
                autoComplete: "organization-title",
                placeholder: "Professor, PhD Student…",
              },
              { key: "affiliation", autoComplete: "organization", placeholder: "BUET, Dept. of IPE" },
            ] as const
          ).map((field) => (
            <Field
              key={field.key}
              contentId={`collab-form-label-${field.key}`}
              htmlFor={field.key}
              label={LABELS[field.key]}
              error={errors[field.key]}
            >
              <input
                id={field.key}
                type={"type" in field ? field.type : "text"}
                autoComplete={field.autoComplete}
                placeholder={field.placeholder}
                value={form[field.key]}
                aria-invalid={errors[field.key] ? "true" : "false"}
                aria-describedby={errors[field.key] ? `${field.key}-error` : undefined}
                onChange={(e) => setField(field.key, e.target.value)}
                onBlur={() => validateOnBlur(field.key)}
                className={`${INPUT} ${errors[field.key] ? INPUT_INVALID : ""}`}
              />
              {field.key === "email" && emailHint && (
                <p className="mt-1.5 text-[12px] text-slate-600">
                  Did you mean{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setField("email", emailHint);
                      setEmailHint("");
                    }}
                    className="font-bold underline"
                    style={{ color: "var(--color-secondary)" }}
                  >
                    {emailHint}
                  </button>
                  ?
                </p>
              )}
            </Field>
          ))}
        </div>
      </fieldset>

      {/* -------------------------------------------------- photo and bio */}
      <fieldset className="mb-7 border-0 p-0">
        <legend className="mb-0.5 text-[15px] font-bold text-slate-900">
          <EditableText id="collab-form-group-profile" defaultValue="Photo and bio" className="inline" />
        </legend>
        <p className="mb-3.5 text-[12.5px] leading-relaxed text-slate-500">
          Cards crop photos to 4:3 from the centre, so keep your face away from the edges. Without
          one, your initials are used instead.
        </p>

        <CloudinaryUpload
          label="Profile photo (optional)"
          currentUrl={form.photo}
          onUpload={(r) => setField("photo", r.secure_url)}
        />

        <div className="mt-4">
          <Field
            contentId="collab-form-label-bio"
            htmlFor="bio"
            label={LABELS.bio}
            error={errors.bio}
            hint="Cards show the first three lines. Around 240 characters fits without cutting off — longer is fine, it just gets trimmed on the card."
            trailing={
              <span
                className={`text-[11.5px] tabular-nums ${
                  form.bio.length > BIO_TARGET ? "font-semibold text-red-700" : "text-slate-400"
                }`}
              >
                {form.bio.length} / {BIO_TARGET}
              </span>
            }
          >
            <textarea
              id="bio"
              rows={4}
              placeholder="One or two sentences on what you work on."
              value={form.bio}
              aria-invalid={errors.bio ? "true" : "false"}
              aria-describedby={`bio-hint${errors.bio ? " bio-error" : ""}`}
              onChange={(e) => setField("bio", e.target.value)}
              onBlur={() => validateOnBlur("bio")}
              className={`${INPUT} resize-y leading-relaxed ${errors.bio ? INPUT_INVALID : ""}`}
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field
            contentId="collab-form-label-interests"
            htmlFor="interests"
            label="Research interests"
            optional
            hint="Enter or comma adds one. Your card shows the first two, the rest appear on your profile."
          >
            <TagInput
              id="interests"
              values={interests}
              onChange={setInterests}
              describedBy="interests-hint"
            />
          </Field>
        </div>
      </fieldset>

      {/* ----------------------------------------------------------- links */}
      <fieldset className="mb-7 border-0 p-0">
        <legend className="mb-0.5 text-[15px] font-bold text-slate-900">
          <EditableText id="collab-form-group-links" defaultValue="Profile links" className="inline" />
        </legend>
        <p className="mb-3.5 text-[12.5px] leading-relaxed text-slate-500">
          All optional — each one becomes an icon on your card.
        </p>

        {/* Collapsed by default: five optional fields shouldn't take up as much
            of the form as the five required ones. */}
        <details className="overflow-hidden rounded-xl border border-slate-200 [&[open]_.chev]:rotate-90">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-3 text-[13px] font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
            Add profile links
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {linkCount === 0 ? "none added" : `${linkCount} added`}
            </span>
            <span className="chev ml-auto text-slate-400 transition-transform">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" />
              </svg>
            </span>
          </summary>
          <div className="grid grid-cols-1 gap-3.5 border-t border-slate-100 p-3.5 md:grid-cols-2">
            {LINK_FIELDS.map(({ key, label, placeholder }) => (
              <Field
                key={key}
                contentId={`collab-form-label-${key}`}
                htmlFor={key}
                label={label}
                error={errors[key]}
              >
                <input
                  id={key}
                  type="url"
                  inputMode="url"
                  placeholder={placeholder}
                  value={form[key]}
                  aria-invalid={errors[key] ? "true" : "false"}
                  aria-describedby={errors[key] ? `${key}-error` : undefined}
                  onChange={(e) => setField(key, e.target.value)}
                  onBlur={() => blurLink(key)}
                  className={`${INPUT} ${errors[key] ? INPUT_INVALID : ""}`}
                />
              </Field>
            ))}
          </div>
        </details>
      </fieldset>

      {submitError && (
        <p role="alert" className="mb-4 text-[13px] font-medium text-red-700">
          {submitError}
        </p>
      )}

      <div className="flex items-center gap-3.5 border-t border-slate-100 pt-5">
        {/* Not disabled while submitting: a disabled button loses focus and stops
            being announced. aria-busy says the same thing without that cost, and
            the guard at the top of submit() blocks the double send. */}
        <button
          type="submit"
          aria-busy={submitting}
          className="rounded-xl px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-secondary)] focus-visible:ring-offset-2 aria-busy:cursor-progress aria-busy:opacity-70"
          style={{ background: "var(--color-primary)" }}
        >
          {submitting ? (
            "Submitting…"
          ) : (
            <EditableText id="collab-form-btn-submit" defaultValue="Submit request" className="inline" />
          )}
        </button>
        {isDirty && <span className="text-[12px] text-slate-400">Draft saved as you type</span>}
      </div>
    </form>
  );
};

export default CollaboratorRequestForm;
