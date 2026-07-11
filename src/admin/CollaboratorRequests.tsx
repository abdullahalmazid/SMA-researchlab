import {
  collection,
  doc,
  getDocs,
  increment,
  setDoc,
  writeBatch,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import AppIcon from "../components/AppIcon";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import type { PendingRequest } from "../types";

// ── Generate a strong random password ─────────────────────────
function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "@#$!";
  const all = upper + lower + digits + symbols;

  // Guarantee at least one of each required type
  const rand = (str: string) => str[Math.floor(Math.random() * str.length)];
  const base = [rand(upper), rand(lower), rand(digits), rand(symbols)];

  // Fill remaining 6 characters from full set
  for (let i = 0; i < 6; i++) base.push(rand(all));

  // Shuffle
  return base.sort(() => Math.random() - 0.5).join("");
}

// ══════════════════════════════════════════════════════════════
const CollaboratorRequests: React.FC = () => {
  const { createCollaboratorAccount, sendPasswordSetupEmail } = useAuth();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const load = async () => {
    const snap = await getDocs(collection(db, "pendingRequests"));
    const all = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as PendingRequest)
      .filter((r) => r.status === "pending");
    setRequests(all);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (req: PendingRequest) => {
    setProcessing(req.id);
    try {
      // 1. Generate password
      const password = generatePassword();

      // 2. Create Firebase Auth account with generated password
      const uid = req.approvedUid || await createCollaboratorAccount(req.email, password, req.name);
      await setDoc(doc(db, "pendingRequests", req.id), { approvedUid: uid, approvalStage: "auth_created" }, { merge: true });

      // 3. Create collaborator profile in Firestore
      const collabSnap = await getDocs(collection(db, "collaborators"));
      const maxOrder = collabSnap.docs.reduce(
        (m, d) => Math.max(m, d.data().order ?? 0),
        0,
      );

      const now = new Date().toISOString();
      const batch = writeBatch(db);
      batch.set(doc(db, "users", uid), {
        uid, email: req.email, name: req.name, role: "collaborator",
        adminLevel: "none", adminPermissions: [], accountStatus: "active",
        collaboratorProfileId: uid, createdAt: now, updatedAt: now,
      }, { merge: true });
      batch.set(doc(db, "collaborators", uid), {
        uid,
        name: req.name,
        email: req.email,
        photo: req.photo ?? "",
        affiliation: req.affiliation ?? "",
        designation: req.designation ?? "",
        bio: req.bio ?? "",
        researchInterests: req.researchInterests ?? [],
        linkedin: req.linkedin ?? "",
        orcid: req.orcid ?? "",
        scholar: req.scholar ?? "",
        researchgate: req.researchgate ?? "",
        facebook: req.facebook ?? "",
        publications: [],
        isActive: true,
        order: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      }, { merge: true });
      batch.set(doc(db, "pendingRequests", req.id), {
        status: "approved", approvalStage: "completed", approvedUid: uid,
        approvedAt: now, emailDeliveryStatus: "pending",
      }, { merge: true });
      await batch.commit();

      // 5. Use Firebase Authentication's free password-reset email as the
      // secure first-time password setup flow. No password is emailed.
      try {
        await sendPasswordSetupEmail(req.email);
        await setDoc(doc(db, "pendingRequests", req.id), { emailDeliveryStatus: "sent", emailAttempts: increment(1), emailLastError: "" }, { merge: true });
        showToast(`${req.name} approved. Firebase sent the password setup email.`);
      } catch (emailErr) {
        // Email failed but account was created — still show success with warning
        console.error("Email send failed:", emailErr);
        await setDoc(doc(db, "pendingRequests", req.id), { emailDeliveryStatus: "failed", emailAttempts: increment(1), emailLastError: String((emailErr as Error)?.message || emailErr) }, { merge: true });
        showToast(
          `${req.name} was approved, but Firebase could not send the password setup email. The account is safe; use “Forgot password” on the login page with ${req.email} to resend it.`,
          "error",
        );
      }

      setRequests((p) => p.filter((r) => r.id !== req.id));
    } catch (err: any) {
      showToast(`Error: ${err.message}`, "error");
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (req: PendingRequest) => {
    if (!window.confirm(`Reject request from ${req.name}?`)) return;
    setProcessing(req.id);
    await updateDoc(doc(db, "pendingRequests", req.id), { status: "rejected" });
    setRequests((p) => p.filter((r) => r.id !== req.id));
    setProcessing(null);
    showToast(`${req.name}'s request rejected.`);
  };

  if (loading)
    return (
      <div className="flex justify-center py-16">
        <div
          className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin"
          style={{
            borderColor: "var(--color-primary)",
            borderTopColor: "transparent",
          }}
        />
      </div>
    );

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{
            background: toast.type === "success" ? "#22c55e" : "#ef4444",
            maxWidth: 380,
            animation: "slideIn 0.25s ease",
          }}
        >
          <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }`}</style>
          {toast.msg}
        </div>
      )}

      <div className="mb-6">
        <h2
          className="text-2xl font-black"
          style={{ color: "var(--color-primary)" }}
        >
          Collaborator Requests
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {requests.length} pending request{requests.length !== 1 ? "s" : ""}
        </p>
      </div>

      {requests.length === 0 ? (
        <div
          className="text-center py-20 bg-white rounded-2xl border"
          style={{ borderColor: "#e5e7eb" }}
        >
          <div className="mb-3 inline-flex text-emerald-600">
            <AppIcon name="check" size={34} />
          </div>
          <p className="text-gray-500">No pending requests.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-2xl shadow-sm border overflow-hidden"
              style={{
                borderColor: "#e5e7eb",
                borderLeft: "4px solid var(--color-accent)",
              }}
            >
              {/* Summary row */}
              <div className="p-5 flex items-center gap-4">
                {req.photo ? (
                  <img
                    src={req.photo}
                    alt={req.name}
                    className="rounded-full object-cover flex-shrink-0"
                    style={{ width: 52, height: 52 }}
                  />
                ) : (
                  <div
                    className="rounded-full flex items-center justify-center text-white font-black text-lg flex-shrink-0"
                    style={{
                      width: 52,
                      height: 52,
                      background: "var(--color-primary)",
                    }}
                  >
                    {req.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-900 truncate">
                    {req.name}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{req.email}</p>
                  <p className="text-xs text-gray-400">
                    {req.designation} · {req.affiliation}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() =>
                      setExpanded((p) => (p === req.id ? null : req.id))
                    }
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer"
                    style={{
                      borderColor: "#d1d5db",
                      background: "white",
                      color: "#374151",
                    }}
                  >
                    {expanded === req.id ? "Less" : "Details"}
                  </button>
                  <button
                    onClick={() => reject(req)}
                    disabled={processing === req.id}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-60 cursor-pointer border-none"
                    style={{ background: "#ef4444" }}
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => approve(req)}
                    disabled={processing === req.id}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-60 cursor-pointer border-none"
                    style={{ background: "#22c55e" }}
                  >
                    {processing === req.id ? "Processing..." : "Approve"}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {expanded === req.id && (
                <div
                  className="px-5 pb-5 border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-5"
                  style={{ borderColor: "#f0f0f0" }}
                >
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Bio
                    </p>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {req.bio}
                    </p>
                    {req.researchInterests?.length > 0 && (
                      <>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-2">
                          Research Interests
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {req.researchInterests.map((r) => (
                            <span
                              key={r}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: "#eff6ff",
                                color: "#1d4ed8",
                              }}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      Links
                    </p>
                    <div className="flex flex-col gap-1 text-sm">
                      {[
                        ["LinkedIn", req.linkedin],
                        ["ORCID", req.orcid],
                        ["Scholar", req.scholar],
                        ["ResearchGate", req.researchgate],
                      ]
                        .filter(([, v]) => v)
                        .map(([label, url]) => (
                          <a
                            key={label}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="no-underline font-medium hover:underline"
                            style={{ color: "var(--color-secondary)" }}
                          >
                            {label} ↗
                          </a>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CollaboratorRequests;
