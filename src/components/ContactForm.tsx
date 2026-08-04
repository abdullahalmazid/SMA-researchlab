import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import React, { useRef, useState } from "react";
import { useThemeContext } from "../context/ThemeContext";
import { db } from "../firebase/config";
import { useSiteContent } from "../firebase/hooks";
import AppIcon from "./AppIcon";

const ContactForm: React.FC = () => {
  const { content } = useSiteContent();
  const { theme } = useThemeContext();
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  /* Free bot filters. Neither stops a determined attacker — App Check does
     that — but both cost nothing and catch the lazy ones before Firestore. */
  const honeypotRef = useRef<HTMLInputElement>(null);
  const startedAt = useRef(Date.now());

  const hexToRgb = (hex: string) => {
    const clean = (hex ?? "").replace("#", "").trim();
    if (clean.length !== 6) return { r: 0, g: 0, b: 0 };
    return {
      r: Number.parseInt(clean.slice(0, 2), 16),
      g: Number.parseInt(clean.slice(2, 4), 16),
      b: Number.parseInt(clean.slice(4, 6), 16),
    };
  };

  const withAlpha = (hex: string, alpha: number, fallback = hex) => {
    const rgb = hexToRgb(hex);
    return rgb.r === 0 && rgb.g === 0 && rgb.b === 0 && hex !== "#000000"
      ? fallback
      : `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
  };

  const isDarkTheme = React.useMemo(() => {
    const clean = (theme.backgroundColor ?? "").replace("#", "").trim();
    if (clean.length !== 6) return false;
    const r = Number.parseInt(clean.slice(0, 2), 16);
    const g = Number.parseInt(clean.slice(2, 4), 16);
    const b = Number.parseInt(clean.slice(4, 6), 16);
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance < 140;
  }, [theme.backgroundColor]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    // Hidden from people, irresistible to bots.
    if (honeypotRef.current?.value) return;
    // Nobody writes a message in under three seconds.
    if (Date.now() - startedAt.current < 3000) return;

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const message = form.message.trim();

    /* These three checks mirror the Firestore rules exactly. Without that,
       a value the rules reject fails server-side and the person only sees
       "Failed to send message" with no idea which field was wrong. */
    if (!name || !email || !message) {
      setError("Name, email and message are all needed.");
      return;
    }
    if (name.length < 2) {
      setError("That name looks too short.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setError("That doesn't look like an email address.");
      return;
    }
    if (message.length < 20) {
      setError("A little more detail — one full sentence at least.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await addDoc(collection(db, "contactMessages"), {
        name,
        email,
        subject: form.subject.trim(),
        message,
        isRead: false,
        // Kept for whatever already reads it.
        submittedAt: new Date().toISOString(),
        // The server clock. A client timestamp is trivially forged and can't
        // be trusted for ordering, so the rules pin this to request.time.
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
      setForm({ name: "", email: "", subject: "", message: "" });
      startedAt.current = Date.now();
    } catch {
      setError("Failed to send message. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-10">
        <div
          className="mb-4 inline-flex"
          style={{ color: "var(--color-secondary)" }}
        >
          <AppIcon name="check" size={44} />
        </div>
        <h3
          className="font-black text-xl mb-2"
          style={{ color: "var(--color-primary)" }}
        >
          Message Sent!
        </h3>
        <p style={{ color: withAlpha(theme.primaryColor!, 0.7, "#6b7280") }}>
          {content["contact.successMessage"] ??
            "Thank you for reaching out. We'll get back to you soon."}
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-4 text-sm font-semibold"
          style={{
            color: "var(--color-secondary)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Send another message
        </button>
      </div>
    );
  }

  const labelText = withAlpha(theme.primaryColor!, 0.65, "#5f6986");
  const inputBgLight = withAlpha(theme.primaryColor!, 0.08, "#e7edf6");
  const inputBgDark = withAlpha(
    theme.backgroundColor!,
    0.6,
    "rgba(20,30,50,0.6)",
  );
  const inputBg = isDarkTheme ? inputBgDark : inputBgLight;

  const inputBorderLight = withAlpha(theme.primaryColor!, 0.1, "#d4dceb");
  const inputBorderDark = withAlpha(
    theme.primaryColor!,
    0.2,
    "rgba(100,120,160,0.2)",
  );
  const inputBorder = isDarkTheme ? inputBorderDark : inputBorderLight;

  const inputTextLight = withAlpha(theme.primaryColor!, 0.8, "#2f3a5b");
  const inputTextDark = withAlpha(theme.backgroundColor!, 0.9, "#e5e7eb");
  const inputText = isDarkTheme ? inputTextDark : inputTextLight;

  const shadowLightInset = `inset 6px 6px 10px ${withAlpha(theme.primaryColor!, 0.12, "#c9d1dc")}, inset -6px -6px 10px ${withAlpha(theme.backgroundColor!, 0.95, "#f8feff")}`;
  const shadowDarkInset = `inset 6px 6px 10px ${withAlpha(theme.backgroundColor!, 0.3, "rgba(10,15,30,0.3)")}, inset -6px -6px 10px ${withAlpha(theme.primaryColor!, 0.1, "rgba(80,120,180,0.1)")}`;
  const inputShadow = isDarkTheme ? shadowDarkInset : shadowLightInset;

  const shadowLightRaised = `10px 10px 20px ${withAlpha(theme.primaryColor!, 0.15, "#c5cdd7")}, -10px -10px 20px ${withAlpha(theme.backgroundColor!, 0.95, "#f5fbff")}`;
  const shadowDarkRaised = `10px 10px 20px ${withAlpha(theme.backgroundColor!, 0.4, "rgba(5,10,20,0.4)")}, -10px -10px 20px ${withAlpha(theme.primaryColor!, 0.15, "rgba(60,100,160,0.15)")}`;
  const buttonShadow = isDarkTheme ? shadowDarkRaised : shadowLightRaised;

  const inputClass =
    "w-full px-4 py-3 text-sm rounded-2xl border outline-none transition-colors";
  const inputStyle = {
    borderColor: inputBorder,
    background: inputBg,
    color: inputText,
    boxShadow: inputShadow,
    fontFamily: "var(--font-body)",
  } as const;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {/* Hidden from people, irresistible to bots. */}
      <div aria-hidden="true" style={{ position: "absolute", left: -9999 }}>
        <label>
          Company
          <input ref={honeypotRef} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            className="block text-xs font-semibold mb-1.5"
            style={{ color: labelText }}
            htmlFor="cf-name"
          >
            Name *
          </label>
          <input
            id="cf-name"
            type="text"
            required
            autoComplete="name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className={inputClass}
            style={inputStyle}
            placeholder="Dr. Jane Smith"
          />
        </div>
        <div>
          <label
            className="block text-xs font-semibold mb-1.5"
            style={{ color: labelText }}
            htmlFor="cf-email"
          >
            Email *
          </label>
          <input
            id="cf-email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className={inputClass}
            style={inputStyle}
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div>
        <label
          className="block text-xs font-semibold mb-1.5"
          style={{ color: labelText }}
          htmlFor="cf-subject"
        >
          Subject
        </label>
        <input
          id="cf-subject"
          type="text"
          maxLength={200}
          value={form.subject}
          onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
          className={inputClass}
          style={inputStyle}
          placeholder="Research collaboration inquiry"
        />
      </div>

      <div>
        <label
          className="block text-xs font-semibold mb-1.5"
          style={{ color: labelText }}
          htmlFor="cf-message"
        >
          Message *
        </label>
        <textarea
          id="cf-message"
          required
          rows={5}
          maxLength={5000}
          value={form.message}
          onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
          className={inputClass}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder="Tell us about your research interests or inquiry..."
        />
      </div>

      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="font-black py-3 px-8 rounded-2xl text-sm disabled:opacity-60 transition-opacity"
        style={{
          color: inputText,
          background: inputBg,
          border: `1px solid ${inputBorder}`,
          boxShadow: buttonShadow,
          cursor: "pointer",
        }}
      >
        {submitting ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
};

export default ContactForm;
