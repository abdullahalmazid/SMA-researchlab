import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, type User as FirebaseUser } from "firebase/auth";
import React, { useState } from "react";
import { Button, Field, Notice, Panel, TabHeader, buttonClass, fieldClass, formatDate } from "./ui";

/** 0–4: length, mixed case, digits, symbols. */
const strength = (value: string) =>
  [value.length >= 8, /[a-z]/.test(value) && /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length +
  (value.length >= 14 ? 1 : 0);

const LEVELS = [
  { label: "Too short", color: "#e11d48" },
  { label: "Weak", color: "#e11d48" },
  { label: "Fair", color: "#d97706" },
  { label: "Good", color: "#059669" },
  { label: "Strong", color: "#059669" },
  { label: "Very strong", color: "#059669" },
];

const SecurityTab: React.FC<{ firebaseUser: FirebaseUser; email: string; role: string; onSignOut: () => void }> = ({
  firebaseUser,
  email,
  role,
  onSignOut,
}) => {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const score = form.next ? Math.min(strength(form.next), 5) : 0;
  const mismatch = Boolean(form.confirm) && form.confirm !== form.next;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (form.next.length < 8) return setNotice({ tone: "error", text: "The new password must be at least 8 characters." });
    if (form.next !== form.confirm) return setNotice({ tone: "error", text: "The new passwords don't match." });
    if (form.current === form.next) return setNotice({ tone: "error", text: "Choose a password different from the current one." });
    setSaving(true);
    try {
      await reauthenticateWithCredential(firebaseUser, EmailAuthProvider.credential(email, form.current));
      await updatePassword(firebaseUser, form.next);
      setForm({ current: "", next: "", confirm: "" });
      setNotice({ tone: "success", text: "Password updated." });
    } catch (error) {
      const code = (error as { code?: string })?.code;
      setNotice({
        tone: "error",
        text:
          code === "auth/wrong-password" || code === "auth/invalid-credential"
            ? "Your current password is incorrect."
            : code === "auth/weak-password"
              ? "That password is too weak."
              : code === "auth/too-many-requests"
                ? "Too many attempts. Wait a few minutes and try again."
                : "Couldn't update the password. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const type = show ? "text" : "password";

  return (
    <div className="pb-10">
      <TabHeader title="Security" description="Your sign-in details." />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel
          title="Change password"
          action={
            <Button tone="quiet" onClick={() => setShow((s) => !s)} aria-pressed={show}>
              {show ? "Hide" : "Show"}
            </Button>
          }
        >
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <Field label="Current password" htmlFor="sec-current" className="sm:col-span-2 sm:w-[calc(50%-6px)]">
              <input
                id="sec-current"
                required
                type={type}
                autoComplete="current-password"
                className={fieldClass}
                value={form.current}
                onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
              />
            </Field>
            <Field label="New password" htmlFor="sec-next" hint="8+ characters">
              <input
                id="sec-next"
                required
                type={type}
                autoComplete="new-password"
                className={fieldClass}
                value={form.next}
                onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))}
                aria-describedby="sec-strength"
              />
              {form.next && (
                <div id="sec-strength" className="mt-1.5 flex items-center gap-2">
                  <div className="flex flex-1 gap-1" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((step) => (
                      <span
                        key={step}
                        className="h-1 flex-1 rounded-full"
                        style={{ background: step <= score ? LEVELS[score].color : "var(--site-border)" }}
                      />
                    ))}
                  </div>
                  <span className="w-20 text-right text-[11px] font-semibold" style={{ color: LEVELS[score].color }}>
                    {LEVELS[score].label}
                  </span>
                </div>
              )}
            </Field>
            <Field label="Confirm new password" htmlFor="sec-confirm">
              <input
                id="sec-confirm"
                required
                type={type}
                autoComplete="new-password"
                className={`${fieldClass} ${mismatch ? "border-rose-400" : ""}`}
                value={form.confirm}
                onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                aria-invalid={mismatch}
              />
              {mismatch && <p className="mt-1 text-[11.5px] text-rose-600">Doesn't match the new password.</p>}
            </Field>
            {notice && (
              <div className="sm:col-span-2">
                <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>
                  {notice.text}
                </Notice>
              </div>
            )}
            <button type="submit" disabled={saving} className={buttonClass("primary", "justify-self-start sm:col-span-2")}>
              {saving ? "Updating…" : "Update password"}
            </button>
          </form>
        </Panel>

        <Panel title="Account">
          <dl className="space-y-2.5 text-[12.5px]">
            {[
              ["Email", email],
              ["Role", role.replace("_", " ")],
              ["Member since", formatDate(firebaseUser.metadata.creationTime ? new Date(firebaseUser.metadata.creationTime).toISOString() : undefined)],
              ["Last sign-in", formatDate(firebaseUser.metadata.lastSignInTime ? new Date(firebaseUser.metadata.lastSignInTime).toISOString() : undefined)],
            ].map(([term, value]) => (
              <div key={term} className="flex items-baseline justify-between gap-3">
                <dt className="text-[color:var(--site-muted)]">{term}</dt>
                <dd className={`truncate font-medium text-[color:var(--site-heading)] ${term === "Role" ? "capitalize" : ""}`}>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 border-t border-[color:var(--site-border)] pt-3">
            <Button tone="danger" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default SecurityTab;
