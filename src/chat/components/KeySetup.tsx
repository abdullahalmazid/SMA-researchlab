import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import {
  createKeyBackup,
  keysWithoutBackup,
  unlockKeyBackup,
  type ChatKeyStatus,
  type ReadyKeys,
} from "../keyStore";
import { useChatFeedback } from "./ChatFeedback";

const MIN_PASSPHRASE = 8;

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[14px] text-slate-900 outline-none transition focus:border-slate-300 focus:ring-4 focus:ring-slate-100";

/**
 * Shown in place of the conversation until this browser holds the member's
 * chat key. The passphrase never leaves the browser; it only encrypts the
 * backup copy of the key.
 */
const KeySetup: React.FC<{
  uid: string;
  status: Exclude<ChatKeyStatus, { state: "ready" } | { state: "loading" }>;
  onReady: (keys: ReadyKeys, hasBackup: boolean) => void;
  onRetry: () => void;
}> = ({ uid, status, onReady, onRetry }) => {
  const { notify, confirm } = useChatFeedback();
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [startFresh, setStartFresh] = useState(false);

  const creating = status.state === "setup" || status.state === "create-backup" || startFresh;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (creating) {
      if (passphrase.length < MIN_PASSPHRASE) return setError(`Use at least ${MIN_PASSPHRASE} characters.`);
      if (passphrase !== confirmPassphrase) return setError("The two passphrases don't match.");
    }
    setBusy(true);
    try {
      if (status.state === "unlock" && !startFresh) {
        onReady(await unlockKeyBackup(uid, status.backup, passphrase), true);
      } else {
        const existing = status.state === "create-backup" ? status.bundle : undefined;
        onReady(await createKeyBackup(uid, passphrase, existing), true);
        notify("Secure messaging is set up on this device.", "success");
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message === "wrong-passphrase"
          ? "That passphrase didn't work. Check it and try again."
          : "Something went wrong saving your key. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const skipBackup = async () => {
    if (status.state !== "create-backup") return;
    onReady(await keysWithoutBackup(status.bundle), false);
  };

  const chooseStartFresh = async () => {
    const ok = await confirm({
      title: "Start fresh with a new key?",
      body: "Messages sent to your old key can't be read on any device after this. Only do this if you've forgotten your passphrase.",
      confirmLabel: "Start fresh",
      danger: true,
    });
    if (ok) {
      setStartFresh(true);
      setPassphrase("");
      setConfirmPassphrase("");
      setError("");
    }
  };

  if (status.state === "error") {
    return (
      <Shell icon={<LockKeyhole size={22} />} title="Couldn't load your chat key">
        <p className="m-0 text-[13.5px] leading-relaxed text-slate-500">{status.message}</p>
        <button type="button" onClick={onRetry} className={primaryButton} style={{ background: "var(--chat-accent)" }}>
          Try again
        </button>
      </Shell>
    );
  }

  const copy =
    status.state === "unlock" && !startFresh
      ? {
          icon: <LockKeyhole size={22} />,
          title: "Unlock your messages",
          body: "Enter your chat passphrase to use secure messaging on this device.",
          action: "Unlock",
        }
      : status.state === "create-backup" && !startFresh
        ? {
            icon: <KeyRound size={22} />,
            title: "Protect your chat key",
            body: "Create a chat passphrase. You'll enter it once on each new device to read your messages there — without it, a new device or a cleared browser can't open your chats.",
            action: "Create passphrase",
          }
        : {
            icon: <ShieldCheck size={22} />,
            title: "Set up secure messaging",
            body: "Messages are end-to-end encrypted. Choose a chat passphrase — you'll use it to unlock chat on other devices.",
            action: "Set up",
          };

  return (
    <Shell icon={copy.icon} title={copy.title}>
      <p className="m-0 text-[13.5px] leading-relaxed text-slate-500">{copy.body}</p>

      {(startFresh || (status.state === "setup" && status.replacesKey)) && (
        <p className="m-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-amber-900">
          Chat was used before with a different key. Messages sent to that key can't be read with the new one.
        </p>
      )}

      <form onSubmit={submit} className="grid gap-2.5">
        <input
          type="password"
          autoComplete={creating ? "new-password" : "current-password"}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Chat passphrase"
          aria-label="Chat passphrase"
          className={inputClass}
          autoFocus
        />
        {creating && (
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassphrase}
            onChange={(e) => setConfirmPassphrase(e.target.value)}
            placeholder="Repeat passphrase"
            aria-label="Repeat passphrase"
            className={inputClass}
          />
        )}
        {error && (
          <p role="alert" className="m-0 text-[12.5px] font-medium text-rose-600">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || !passphrase} className={primaryButton} style={{ background: "var(--chat-accent)" }}>
          {busy ? "Working…" : copy.action}
        </button>
      </form>

      {creating && (
        <p className="m-0 text-[12px] leading-relaxed text-slate-400">
          This passphrase can't be recovered — not even by an admin. Keep it somewhere safe.
        </p>
      )}

      {status.state === "create-backup" && !startFresh && (
        <button type="button" onClick={() => void skipBackup()} className={linkButton}>
          Not now
        </button>
      )}
      {status.state === "unlock" && !startFresh && (
        <button type="button" onClick={() => void chooseStartFresh()} className={linkButton}>
          Forgot your passphrase?
        </button>
      )}
    </Shell>
  );
};

const primaryButton =
  "h-11 w-full rounded-xl border-0 text-[14px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50";
const linkButton =
  "mx-auto border-0 bg-transparent text-[12.5px] font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline";

const Shell: React.FC<React.PropsWithChildren<{ icon: React.ReactNode; title: string }>> = ({ icon, title, children }) => (
  <div className="grid h-full place-items-center overflow-y-auto p-6">
    <div className="grid w-full max-w-sm gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: "var(--chat-accent)" }}>
        {icon}
      </span>
      <h2 className="m-0 text-lg font-bold text-slate-900">{title}</h2>
      {children}
    </div>
  </div>
);

export default KeySetup;
