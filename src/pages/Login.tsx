import { sendPasswordResetEmail } from "firebase/auth";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import EditableText from "../components/EditableText";
import { useAuth } from "../context/AuthContext";
import { useThemeContext } from "../context/ThemeContext";
import { auth } from "../firebase/config";
import { useSiteContent } from "../firebase/hooks";
const hexToRgb = (hex: string) => {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return null;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b };
};

const withAlpha = (hex: string, alpha: number, fallbackVar: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return `color-mix(in srgb, ${fallbackVar} ${Math.round(alpha * 100)}%, transparent)`;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const Login: React.FC<{ forceShow?: boolean; portal?: "team" | "admin" }> = ({ forceShow = false, portal = "team" }) => {
  const { login, role, authError } = useAuth();
  const { theme } = useThemeContext();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginStage, setLoginStage] = useState("");

  const { content } = useSiteContent();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoginStage("Contacting Firebase Authentication…");
    setLoading(true);
    try {
      const resolvedRole = await login(form.email, form.password);
      setLoginStage(`Authenticated. Firestore role: ${resolvedRole}. Opening portal…`);
      if (portal === "admin" && resolvedRole !== "admin") {
        setError("This account does not have administrator access.");
        setLoginStage("");
        return;
      }
      const destination = resolvedRole === "admin" ? "/admin" : "/collaborator-portal";
      navigate(destination, { replace: true });
      window.setTimeout(() => {
        if (window.location.pathname !== destination) window.location.assign(destination);
      }, 300);
    } catch (err: any) {
      const code = String(err?.code || err?.message || "");
      if (
        code.includes("auth/invalid-credential") ||
        code.includes("auth/wrong-password")
      ) {
        setError("Invalid email or password.");
      } else if (code.includes("auth/too-many-requests")) {
        setError(
          "Too many failed attempts. Try again later or reset your password.",
        );
      } else if (code.includes("auth/user-disabled")) {
        setError("This account is disabled. Contact admin.");
      } else if (code.includes("auth/network-request-failed")) {
        setError("Network error. Check your connection and try again.");
      } else if (code.includes("firebase/not-configured")) {
        setError("Firebase is not configured yet. Public preview mode is still available.");
      } else if (code.includes("auth/profile-not-found")) {
        setError("Login succeeded, but users/" + auth.currentUser?.uid + " does not exist in Firestore.");
      } else if (code.includes("auth/invalid-profile-role")) {
        setError("The Firestore user profile has an invalid role. Use admin, lab_head, or collaborator.");
      } else if (code.includes("auth/profile-permission-denied")) {
        setError("Firestore denied access to this user profile. Redeploy the supplied Firestore rules.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = form.email.trim();
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }

    setResetLoading(true);
    setError("");
    setResetSent(false);

    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError("");
    } catch (err: any) {
      const code = String(err?.code || err?.message || "");
      if (code.includes("auth/invalid-email")) {
        setError("Please enter a valid email address.");
      } else if (code.includes("auth/too-many-requests")) {
        setError("Too many attempts. Please wait and try again.");
      } else if (code.includes("auth/network-request-failed")) {
        setError(
          "Network error. Check your internet connection and try again.",
        );
      } else if (code.includes("auth/operation-not-allowed")) {
        setError(
          "Password reset is not enabled in Firebase Authentication settings.",
        );
      } else {
        setError("Could not send reset email. Please try again.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  React.useEffect(() => {
    if (!forceShow) {
      if (role === "admin") navigate("/admin", { replace: true });
      else if (role === "collaborator" || role === "lab_head")
        navigate("/collaborator-portal", { replace: true });
    }
  }, [role, forceShow]);

  React.useEffect(() => {
    if (authError.includes("profile-not-found")) setError("Your Authentication account has no matching users/{UID} Firestore document.");
    else if (authError.includes("invalid-profile-role")) setError("Your Firestore user document has an invalid role value.");
    else if (authError.includes("profile-permission-denied")) setError("Firestore denied access to your user profile.");
  }, [authError]);
  const pageBg = "var(--color-bg)";
  const cardBg = withAlpha(theme.backgroundColor, 0.92, "var(--color-bg)");
  const textStrong = "var(--color-primary)";
  const textMuted = withAlpha(theme.primaryColor, 0.62, "var(--color-primary)");
  const textSoft = withAlpha(theme.primaryColor, 0.78, "var(--color-primary)");
  const borderColor = withAlpha(
    theme.primaryColor,
    0.2,
    "var(--color-primary)",
  );
  const raisedShadow = `10px 10px 20px ${withAlpha(theme.primaryColor, 0.2, "var(--color-primary)")}, -10px -10px 20px ${withAlpha(theme.backgroundColor, 0.55, "var(--color-bg)")}`;
  const insetShadow = `inset 6px 6px 10px ${withAlpha(theme.primaryColor, 0.18, "var(--color-primary)")}, inset -6px -6px 10px ${withAlpha(theme.backgroundColor, 0.82, "var(--color-bg)")}`;
  const successFg = "var(--color-secondary)";
  const successBg = withAlpha(
    theme.secondaryColor,
    0.14,
    "var(--color-secondary)",
  );
  const successBorder = withAlpha(
    theme.secondaryColor,
    0.28,
    "var(--color-secondary)",
  );
  const errorFg = "var(--color-accent)";
  const errorBg = withAlpha(theme.accentColor, 0.14, "var(--color-accent)");
  const errorBorder = withAlpha(theme.accentColor, 0.3, "var(--color-accent)");
  const emailFilled = form.email.trim().length > 0;
  const passwordFilled = form.password.length > 0;

  return (
    <div
      className="min-h-[80vh] flex items-center justify-center px-4 py-8"
      style={{ background: pageBg }}
    >
      <div
        className="w-full max-w-md rounded-[28px] px-8 py-10"
        style={{ background: cardBg, boxShadow: raisedShadow }}
      >
        <div className="flex justify-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: cardBg, boxShadow: raisedShadow }}
          >
            {content?.["branding.logoUrl"] ? <img src={content["branding.logoUrl"]} alt="Lab logo" className="h-12 w-12 rounded-full object-contain" /> : <User size={28} color={textMuted} strokeWidth={2.2} />}
          </div>
        </div>

        <div className="text-center mt-6 mb-7">
          <h1
            className="font-black text-[2rem] leading-none"
            style={{ color: textStrong, fontFamily: "var(--font-heading)" }}
          >
            <EditableText
              id="login.pageTitle"
              defaultValue={portal === "admin" ? "Administrator Login" : (content?.["login.pageTitle"] ?? "Team Portal Login")}
              className="font-black text-[2rem] leading-none"
              block
            />
          </h1>
          <p className="text-sm mt-2" style={{ color: textMuted }}>
            <EditableText
              id="login.pageSubtitle"
              defaultValue={
                portal === "admin" ? "Restricted administration and monitoring access" :
                (content?.["login.pageSubtitle"] ?? "Lab head and collaborator access")
              }
              className="text-sm mt-2"
              block
            />
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: textSoft }}
            >
              Email
            </label>
            <div className="relative">
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none"
                style={{ color: textMuted }}
              >
                <Mail size={16} strokeWidth={2.2} />
              </span>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl outline-none"
                style={{
                  color: textStrong,
                  background: cardBg,
                  border: `1px solid ${borderColor}`,
                  boxShadow: emailFilled ? raisedShadow : insetShadow,
                  transition: "box-shadow 220ms ease, border-color 220ms ease",
                }}
                placeholder="Email address"
              />
            </div>
          </div>

          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: textSoft }}
            >
              Password
            </label>
            <div className="relative">
              <span
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center pointer-events-none"
                style={{ color: textMuted }}
              >
                <Lock size={16} strokeWidth={2.2} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={form.password}
                onChange={(e) =>
                  setForm((p) => ({ ...p, password: e.target.value }))
                }
                className="w-full pl-10 pr-14 py-3 text-sm rounded-2xl outline-none hide-password-reveal"
                style={{
                  color: textStrong,
                  background: cardBg,
                  border: `1px solid ${borderColor}`,
                  boxShadow: passwordFilled ? raisedShadow : insetShadow,
                  transition: "box-shadow 220ms ease, border-color 220ms ease",
                }}
                placeholder="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center p-0 leading-none"
                style={{
                  background: "transparent",
                  border: "none",
                  boxShadow: "none",
                  cursor: "pointer",
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff size={16} color={textSoft} strokeWidth={2.2} />
                ) : (
                  <Eye size={16} color={textSoft} strokeWidth={2.2} />
                )}
              </button>
            </div>
            <div className="text-right mt-2">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="text-xs font-semibold hover:underline disabled:opacity-60"
                style={{
                  color: "var(--color-secondary)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {resetLoading ? "Sending..." : "Forgot password?"}
              </button>
            </div>
          </div>

          {resetSent && (
            <p
              className="text-sm px-4 py-2.5 rounded-xl"
              style={{
                color: successFg,
                background: successBg,
                border: `1px solid ${successBorder}`,
              }}
            >
              Reset request submitted. If this email is registered in Firebase
              Authentication, you will receive a password reset email shortly.
              Check inbox and spam.
            </p>
          )}

          {error && (
            <p
              className="text-sm px-4 py-2.5 rounded-xl"
              style={{
                color: errorFg,
                background: errorBg,
                border: `1px solid ${errorBorder}`,
              }}
            >
              {error}
            </p>
          )}

          {loginStage && !error && (
            <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-800" role="status" aria-live="polite">
              {loginStage}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-black py-3 rounded-2xl text-sm disabled:opacity-60 mt-1"
            style={{
              color: textStrong,
              background: cardBg,
              border: `1px solid ${borderColor}`,
              boxShadow: raisedShadow,
              cursor: "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="text-center text-xs mt-2" style={{ color: textMuted }}>
            Not a collaborator yet?{" "}
            <a
              href="/collaborators"
              className="font-semibold no-underline hover:underline"
              style={{ color: "var(--color-secondary)" }}
            >
              <EditableText
                id="login.submitRequest"
                defaultValue={
                  content?.["login.submitRequest"] ?? "Submit a request"
                }
                className="font-semibold"
                block={false}
              />
            </a>{" "}
            <EditableText
              id="login.collaboratorsPage"
              defaultValue={
                content?.["login.collaboratorsPage"] ??
                "on the Collaborators page."
              }
              className="inline"
              block={false}
            />
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
