import { addDoc, collection } from "firebase/firestore";
import React, { useState } from "react";
import { db } from "../firebase/config";
import AppIcon from "./AppIcon";
import CloudinaryUpload from "./CloudinaryUpload";
import EditableText from "./EditableText";

const inputClassName =
  "w-full px-3 py-2 text-sm rounded-lg border outline-none";

const inputStyle: React.CSSProperties = {
  borderColor: "#d1d5db",
};

const LabeledInput: React.FC<{
  id: string; // Added ID for editable label
  label: string;
  children: React.ReactNode;
}> = ({ id, label, children }) => (
  <label className="block">
    <span
      className="block text-xs font-semibold mb-1"
      style={{ color: "#64748b" }}
    >
      <EditableText id={label} defaultValue={label} className="inline" />
    </span>
    {children}
  </label>
);

const CollaboratorRequestForm: React.FC = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    affiliation: "",
    designation: "",
    bio: "",
    photo: "",
    linkedin: "",
    orcid: "",
    scholar: "",
    researchgate: "",
    facebook: "",
    researchInterests: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [error, setError] = useState("");

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.email || !form.bio) {
      setError("Please fill all required fields.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const request = await addDoc(collection(db, "pendingRequests"), {
        ...form,
        researchInterests: form.researchInterests
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        status: "pending",
        submittedAt: new Date().toISOString(),
      });
      setRequestId(request.id);
      setDone(true);
    } catch {
      setError("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-[2147483400] grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="request-success-title">
        <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-2xl">
          <div className="px-6 py-6 text-white" style={{ background: "linear-gradient(135deg,var(--color-primary),var(--color-secondary))" }}><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15"><AppIcon name="check" size={24} /></div><h3 id="request-success-title" className="mt-4 text-2xl font-black">Request submitted successfully</h3><p className="mt-1 text-sm text-white/75">Your collaborator application is now waiting for administrative review.</p></div>
          <div className="space-y-5 p-6">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-black text-amber-900">What happens next?</p><ol className="mt-3 grid gap-2 text-sm leading-6 text-amber-900/80"><li><strong>1.</strong> The lab administrator will review your submitted information.</li><li><strong>2.</strong> Approval may take some time. You do not need to submit another request.</li><li><strong>3.</strong> After approval, Firebase will email you a secure password-reset link.</li><li><strong>4.</strong> Open that link and use it to create the password for your collaborator account.</li></ol></div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><p className="text-sm font-black text-sky-900">Important email notice</p><p className="mt-1 text-sm leading-6 text-sky-800">The Firebase email may use the words <strong>“Reset password.”</strong> For a newly approved account, use that link to set your first password. Check your Inbox, Spam, Junk and Promotions folders.</p></div>
            <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Request reference</p><div className="mt-2 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2"><code className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">{requestId}</code><button type="button" onClick={() => void navigator.clipboard?.writeText(requestId)} className="rounded-lg bg-white px-3 py-1.5 text-xs font-black text-slate-600 shadow-sm">Copy</button></div><p className="mt-2 text-xs text-slate-400">Save this reference for future communication with the lab administrator.</p></div>
            <button type="button" onClick={() => { window.location.href = "/collaborators"; }} className="w-full rounded-xl py-3 text-sm font-black text-white" style={{ background: "var(--color-primary)" }}>Understood — return to collaborators</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div
        className="rounded-xl p-3 text-xs text-blue-700"
        style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}
      >
        <span className="inline-flex items-center gap-1.5">
          <AppIcon name="about" size={12} />
          {/* Split into editable parts to preserve the mailto link functionality */}
          <EditableText
            id="collab-form-info-1"
            defaultValue="After approval, Firebase will send a secure password-reset email. Use that link to create your collaborator password. Please enter the correct email address and check your Inbox, Spam, Junk and Promotions folders. For questions, contact"
            className="inline"
          />
          &nbsp;
          <a
            href="mailto:rahmanlab@gmail.com"
            className="text-blue-600 hover:underline"
          >
            rahmanlab@gmail.com
          </a>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LabeledInput id="collab-form-label-name" label="Full Name *">
          <input
            required
            className={inputClassName}
            style={inputStyle}
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Dr. Jane Smith"
          />
        </LabeledInput>
        <LabeledInput id="collab-form-label-email" label="Email *">
          <input
            required
            type="email"
            className={inputClassName}
            style={inputStyle}
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            placeholder="jane@buet.ac.bd"
          />
        </LabeledInput>
        <LabeledInput id="collab-form-label-designation" label="Designation *">
          <input
            required
            className={inputClassName}
            style={inputStyle}
            value={form.designation}
            onChange={(e) => updateField("designation", e.target.value)}
            placeholder="Professor, PhD Student..."
          />
        </LabeledInput>
        <LabeledInput id="collab-form-label-affiliation" label="Affiliation *">
          <input
            required
            className={inputClassName}
            style={inputStyle}
            value={form.affiliation}
            onChange={(e) => updateField("affiliation", e.target.value)}
            placeholder="BUET, Dept. of CSE"
          />
        </LabeledInput>
      </div>

      <CloudinaryUpload
        label="Profile Photo"
        currentUrl={form.photo}
        onUpload={(r) => updateField("photo", r.secure_url)}
      />

      <LabeledInput id="collab-form-label-bio" label="Bio *">
        <textarea
          required
          rows={4}
          className={inputClassName}
          style={{ ...inputStyle, resize: "vertical" }}
          value={form.bio}
          onChange={(e) => updateField("bio", e.target.value)}
          placeholder="Brief description of your background..."
        />
      </LabeledInput>

      <LabeledInput
        id="collab-form-label-interests"
        label="Research Interests (comma separated)"
      >
        <input
          className={inputClassName}
          style={inputStyle}
          value={form.researchInterests}
          onChange={(e) => updateField("researchInterests", e.target.value)}
          placeholder="Machine Learning, NLP, Computer Vision"
        />
      </LabeledInput>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(
          ["linkedin", "orcid", "scholar", "researchgate", "facebook"] as const
        ).map((key) => (
          <LabeledInput
            key={key}
            id={`collab-form-label-${key}`}
            label={key.charAt(0).toUpperCase() + key.slice(1)}
          >
            <input
              className={inputClassName}
              style={inputStyle}
              value={form[key]}
              onChange={(e) => updateField(key, e.target.value)}
              placeholder="https://..."
            />
          </LabeledInput>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="text-sm font-bold px-6 py-2 rounded-lg text-white disabled:opacity-60"
          style={{
            background: "var(--color-primary)",
            border: "none",
            cursor: "pointer",
          }}
        >
          {submitting ? (
            "Submitting..."
          ) : (
            <EditableText
              id="collab-form-btn-submit"
              defaultValue="Submit Request"
              className="inline"
            />
          )}
        </button>
      </div>
    </form>
  );
};

export default CollaboratorRequestForm;
