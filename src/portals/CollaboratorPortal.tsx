import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import AppIcon from "../components/AppIcon";
import CloudinaryUpload from "../components/CloudinaryUpload";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import type {
  CloudinaryUploadResult,
  CollaboratorProfile,
  CollaboratorPublication,
  GalleryItem,
  Publication,
  PublicationAuthorEntry,
  ResearchIdea,
} from "../types";

type Tab = "profile" | "ideas" | "gallery" | "security";

const CollaboratorPortal: React.FC = () => {
  const { appUser, logout, firebaseUser } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<CollaboratorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser?.uid) { setLoading(false); return; }
    const load = async () => {
      const snap = await getDocs(
        query(collection(db, "collaborators"), where("uid", "==", appUser.uid)),
      );
      if (!snap.empty) {
        setProfile({
          id: snap.docs[0].id,
          ...snap.docs[0].data(),
        } as CollaboratorProfile);
      }
      setLoading(false);
    };
    load().catch((error) => { console.error("Portal profile error:", error); setLoading(false); });
  }, [appUser?.uid]);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div
          className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
          style={{
            borderColor: "var(--color-primary)",
            borderTopColor: "transparent",
          }}
        />
      </div>
    );

  const tabStyle = (active: boolean) => ({
    padding: "10px 20px",
    border: "none",
    borderBottom: active
      ? "3px solid var(--color-primary)"
      : "3px solid transparent",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: active ? 700 : 500,
    color: active ? "var(--color-primary)" : "#6b7280",
    background: "transparent",
  });

  const displayName = profile?.name || appUser?.name || "";
  const displayPhoto = profile?.photo || "";

  return (
    <div>
      {/* Header */}
      <div
        className="py-10 px-4"
        style={{ background: "var(--color-primary)" }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {displayPhoto ? (
              <img
                src={displayPhoto}
                alt={displayName}
                className="rounded-full object-cover border-4 border-white"
                style={{ width: 64, height: 64 }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center text-white font-black text-2xl border-4 border-white"
                style={{
                  width: 64,
                  height: 64,
                  background: "var(--color-secondary)",
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-white font-black text-xl">{displayName}</h1>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                {profile?.designation}
                {profile?.designation && profile?.affiliation ? " · " : ""}
                {profile?.affiliation}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-xs font-semibold px-4 py-2 rounded-xl border cursor-pointer"
            style={{
              color: "white",
              borderColor: "rgba(255,255,255,0.4)",
              background: "transparent",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* Tabs */}
        <div className="flex border-b mb-8" style={{ borderColor: "#e5e7eb" }}>
          <button
            style={tabStyle(tab === "profile")}
            onClick={() => setTab("profile")}
          >
            Edit My Profile
          </button>
          <button
            style={tabStyle(tab === "ideas")}
            onClick={() => setTab("ideas")}
          >
            My Research Ideas
          </button>
          <button
            style={tabStyle(tab === "gallery")}
            onClick={() => setTab("gallery")}
          >
            My Gallery Uploads
          </button>
          <button
            style={tabStyle(tab === "security")}
            onClick={() => setTab("security")}
          >
            Security
          </button>
          <a
            href="/"
            className="ml-auto self-center text-xs font-semibold no-underline"
            style={{ color: "var(--color-secondary)" }}
          >
            ← View Website
          </a>
        </div>

        {tab === "profile" && profile && (
          <EditProfile profile={profile} onSaved={setProfile} />
        )}
        {tab === "ideas" && appUser && (
          <MyIdeas
            authorId={appUser.uid}
            authorName={displayName}
            authorPhoto={displayPhoto}
          />
        )}
        {tab === "gallery" && appUser && (
          <MyGalleryUploads
            firebaseUser={firebaseUser}
            uploaderName={displayName}
            uploaderEmail={appUser.email}
          />
        )}
        {tab === "security" && firebaseUser && (
          <ChangePassword
            firebaseUser={firebaseUser}
            userEmail={appUser?.email ?? ""}
          />
        )}
      </div>
    </div>
  );
};

// ── Change Password ────────────────────────────────────────────
import type { User as FirebaseUser } from "firebase/auth";

const ChangePassword: React.FC<{
  firebaseUser: FirebaseUser;
  userEmail: string;
}> = ({ firebaseUser, userEmail }) => {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (form.newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (form.currentPassword === form.newPassword) {
      setError("New password must be different from current password.");
      return;
    }

    setSaving(true);
    try {
      // Re-authenticate first (Firebase requires this before password change)
      const credential = EmailAuthProvider.credential(
        userEmail,
        form.currentPassword,
      );
      await reauthenticateWithCredential(firebaseUser, credential);

      // Now update password
      await updatePassword(firebaseUser, form.newPassword);

      setSuccess(true);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setError("Current password is incorrect.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Use at least 8 characters.");
      } else {
        setError("Failed to update password. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl border outline-none";
  const inpStyle = { borderColor: "#e5e7eb" };

  return (
    <div className="pb-16 max-w-md">
      <h2
        className="text-xl font-black mb-6"
        style={{ color: "var(--color-primary)" }}
      >
        Change Password
      </h2>

      <div
        className="bg-white rounded-2xl p-6 shadow-sm border"
        style={{ borderColor: "#e5e7eb" }}
      >
        {success && (
          <div
            className="rounded-xl p-3 mb-4 text-sm font-semibold text-green-700"
            style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
          >
            Password updated successfully.
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Current Password *
            </label>
            <input
              required
              type="password"
              className={inp}
              style={inpStyle}
              value={form.currentPassword}
              onChange={(e) =>
                setForm((p) => ({ ...p, currentPassword: e.target.value }))
              }
              placeholder="Enter your current password"
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              New Password *{" "}
              <span className="text-gray-400 font-normal">
                (min. 8 characters)
              </span>
            </label>
            <input
              required
              type="password"
              className={inp}
              style={inpStyle}
              value={form.newPassword}
              onChange={(e) =>
                setForm((p) => ({ ...p, newPassword: e.target.value }))
              }
              placeholder="Enter new password"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Confirm New Password *
            </label>
            <input
              required
              type="password"
              className={inp}
              style={{
                ...inpStyle,
                borderColor:
                  form.confirmPassword &&
                  form.confirmPassword !== form.newPassword
                    ? "#ef4444"
                    : form.confirmPassword &&
                        form.confirmPassword === form.newPassword
                      ? "#22c55e"
                      : "#e5e7eb",
              }}
              value={form.confirmPassword}
              onChange={(e) =>
                setForm((p) => ({ ...p, confirmPassword: e.target.value }))
              }
              placeholder="Re-enter new password"
              autoComplete="new-password"
            />
            {form.confirmPassword &&
              form.confirmPassword !== form.newPassword && (
                <p className="text-xs text-red-500 mt-1">
                  Passwords do not match
                </p>
              )}
            {form.confirmPassword &&
              form.confirmPassword === form.newPassword && (
                <p className="text-xs text-green-600 mt-1">✓ Passwords match</p>
              )}
          </div>

          {error && (
            <div
              className="rounded-xl p-3 text-sm text-red-700"
              style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="font-bold px-6 py-2.5 rounded-xl text-white text-sm disabled:opacity-60 border-none cursor-pointer"
            style={{ background: "var(--color-primary)" }}
          >
            {saving ? "Updating..." : "Update Password"}
          </button>
        </form>

        <div
          className="mt-5 pt-4 border-t text-xs text-gray-400"
          style={{ borderColor: "#f0f0f0" }}
        >
          <p>Tips for a strong password:</p>
          <ul className="mt-1 list-disc list-inside space-y-0.5">
            <li>At least 8 characters long</li>
            <li>Mix of uppercase and lowercase letters</li>
            <li>Include numbers and symbols (@, #, $, !)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// ── Edit Profile ──────────────────────────────────────────────
const EditProfile: React.FC<{
  profile: CollaboratorProfile;
  onSaved: (p: CollaboratorProfile) => void;
}> = ({ profile, onSaved }) => {
  const [form, setForm] = useState<CollaboratorProfile>({ ...profile });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openSection, setOpenSection] = useState<
    "photo" | "basic" | "social" | "publications"
  >("photo");
  const [collaboratorChoices, setCollaboratorChoices] = useState<
    CollaboratorProfile[]
  >([]);
  const [mySharedPapers, setMySharedPapers] = useState<Publication[]>([]);
  const [paperSubmitting, setPaperSubmitting] = useState(false);
  const [paperError, setPaperError] = useState("");
  const [unlinkingPaperId, setUnlinkingPaperId] = useState<string | null>(null);
  const [deletingPaperId, setDeletingPaperId] = useState<string | null>(null);
  const [editingPaperId, setEditingPaperId] = useState<string | null>(null);
  const [openPaperMenuId, setOpenPaperMenuId] = useState<string | null>(null);
  const [paperForm, setPaperForm] = useState({
    title: "",
    journal: "",
    year: new Date().getFullYear(),
    abstract: "",
    doi: "",
    url: "",
    type: "published" as "ongoing" | "published",
    tags: "",
    hasLabHeadAuthorship: "yes" as "yes" | "no",
    authors: [
      {
        mode: "linked" as "linked" | "external",
        uid: profile.uid,
        name: profile.name,
        affiliation: profile.affiliation ?? "",
      },
    ],
  });

  const set = (k: keyof CollaboratorProfile, v: any) =>
    setForm((p) => ({ ...p, [k]: v }));

  const updatePub = (
    i: number,
    k: keyof CollaboratorPublication,
    v: string | number,
  ) => {
    const pubs = [...(form.publications ?? [])];
    pubs[i] = { ...pubs[i], [k]: v };
    set("publications", pubs);
  };

  const addPub = () =>
    set("publications", [
      ...(form.publications ?? []),
      {
        id: Date.now().toString(),
        title: "",
        journal: "",
        year: new Date().getFullYear(),
        url: "",
      },
    ]);

  const removePub = (i: number) =>
    set(
      "publications",
      (form.publications ?? []).filter((_, idx) => idx !== i),
    );

  const save = async () => {
    setSaving(true);
    try {
      const { id, ...data } = form;
      await updateDoc(doc(db, "collaborators", id), data as any);
      onSaved(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl border outline-none";
  const inpStyle = { borderColor: "#e5e7eb" };

  const normalizeDoi = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
      .replace(/^doi:/, "")
      .trim();

  const normalizeText = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const buildPaperKey = () => {
    const title = normalizeText(paperForm.title);
    const journal = normalizeText(paperForm.journal || "unknown");
    return `${title}-${paperForm.year}-${journal}`;
  };

  const buildDocId = (normalizedDoi: string, paperKey: string) => {
    if (normalizedDoi) return `doi_${normalizeText(normalizedDoi)}`;
    return `key_${paperKey}`;
  };

  const loadPublicationContext = async () => {
    const [collabSnap, paperSnap] = await Promise.all([
      getDocs(collection(db, "collaborators")),
      getDocs(
        query(
          collection(db, "publications"),
          where("contributorUids", "array-contains", profile.uid),
        ),
      ),
    ]);

    setCollaboratorChoices(
      collabSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as CollaboratorProfile,
      ),
    );

    setMySharedPapers(
      paperSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Publication)
        .sort((a, b) => b.year - a.year),
    );
  };

  useEffect(() => {
    loadPublicationContext();
  }, [profile.uid]);

  const setPaperField = (k: string, v: any) =>
    setPaperForm((p) => ({ ...p, [k]: v }));

  const updatePaperAuthor = (
    index: number,
    key: "mode" | "uid" | "name" | "affiliation",
    value: string,
  ) => {
    setPaperForm((prev) => {
      const nextAuthors = [...prev.authors];
      const current = { ...nextAuthors[index], [key]: value };

      if (key === "uid" && current.mode === "linked") {
        const linked = collaboratorChoices.find((c) => c.uid === value);
        if (linked) {
          current.name = linked.name;
          current.affiliation = linked.affiliation ?? "";
        }
      }

      if (key === "mode" && value === "external") {
        current.uid = "";
      }

      nextAuthors[index] = current;
      return { ...prev, authors: nextAuthors };
    });
  };

  const addPaperAuthor = () => {
    setPaperForm((prev) => ({
      ...prev,
      authors: [
        ...prev.authors,
        { mode: "external", uid: "", name: "", affiliation: "" },
      ],
    }));
  };

  const removePaperAuthor = (index: number) => {
    setPaperForm((prev) => ({
      ...prev,
      authors: prev.authors.filter((_, i) => i !== index),
    }));
  };

  const toAuthorEntries = (): PublicationAuthorEntry[] =>
    paperForm.authors
      .filter((a) => a.name.trim())
      .map((a) => {
        if (a.mode === "linked" && a.uid) {
          const linked = collaboratorChoices.find((c) => c.uid === a.uid);
          return {
            type: "linked" as const,
            uid: a.uid,
            name: linked?.name || a.name,
            photo: linked?.photo || "",
            role: "collaborator",
            affiliation: linked?.affiliation || a.affiliation || "",
          };
        }
        return {
          type: "external" as const,
          name: a.name.trim(),
          affiliation: a.affiliation.trim(),
          role: "external",
        };
      });

  const submitSharedPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaperError("");

    const title = paperForm.title.trim();
    if (!title) {
      setPaperError("Paper title is required.");
      return;
    }

    const authorEntries = toAuthorEntries();
    if (authorEntries.length === 0) {
      setPaperError("Add at least one author.");
      return;
    }

    setPaperSubmitting(true);
    try {
      const normalizedDoi = normalizeDoi(paperForm.doi);
      const paperKey = buildPaperKey();
      const now = new Date().toISOString();

      const linkedContributorUids = authorEntries
        .filter((a) => a.type === "linked" && a.uid)
        .map((a) => a.uid as string);

      const joinAuthors = (entries: PublicationAuthorEntry[]) =>
        entries.map((a) => a.name).join(", ");

      const uniqueAuthorEntries = (entries: PublicationAuthorEntry[]) => {
        const byKey = new Map<string, PublicationAuthorEntry>();
        entries.forEach((entry) => {
          const key =
            entry.type === "linked" && entry.uid
              ? `linked:${entry.uid}`
              : `external:${normalizeText(entry.name)}:${normalizeText(entry.affiliation ?? "")}`;
          if (!byKey.has(key)) byKey.set(key, entry);
        });
        return Array.from(byKey.values());
      };

      if (editingPaperId) {
        await updateDoc(doc(db, "publications", editingPaperId), {
          title,
          authors: joinAuthors(authorEntries),
          authorEntries,
          journal: paperForm.journal.trim(),
          year: Number(paperForm.year) || new Date().getFullYear(),
          abstract: paperForm.abstract.trim(),
          url: paperForm.url.trim(),
          doi: normalizedDoi,
          type: paperForm.type,
          tags: paperForm.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          paperKey,
          hasLabHeadAuthorship: paperForm.hasLabHeadAuthorship === "yes",
          contributorUids: Array.from(new Set(linkedContributorUids)),
          updatedAt: now,
        });
      } else {
        const docId = buildDocId(normalizedDoi, paperKey);
        const ref = doc(db, "publications", docId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          await setDoc(ref, {
            title,
            authors: joinAuthors(authorEntries),
            authorEntries,
            journal: paperForm.journal.trim(),
            year: Number(paperForm.year) || new Date().getFullYear(),
            abstract: paperForm.abstract.trim(),
            url: paperForm.url.trim(),
            doi: normalizedDoi,
            type: paperForm.type,
            tags: paperForm.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            paperKey,
            hasLabHeadAuthorship: paperForm.hasLabHeadAuthorship === "yes",
            contributorUids: Array.from(new Set(linkedContributorUids)),
            createdByUid: profile.uid,
            createdAt: now,
            updatedAt: now,
          });
        } else {
          const existing = snap.data() as Publication;
          const mergedAuthorEntries = uniqueAuthorEntries([
            ...(existing.authorEntries ?? []),
            ...authorEntries,
          ]);
          const mergedContributorUids = Array.from(
            new Set([
              ...(existing.contributorUids ?? []),
              ...linkedContributorUids,
            ]),
          );

          await setDoc(
            ref,
            {
              title: existing.title || title,
              authors: joinAuthors(mergedAuthorEntries),
              authorEntries: mergedAuthorEntries,
              journal: existing.journal || paperForm.journal.trim(),
              year:
                existing.year ||
                Number(paperForm.year) ||
                new Date().getFullYear(),
              abstract: existing.abstract || paperForm.abstract.trim(),
              url: existing.url || paperForm.url.trim(),
              doi: existing.doi || normalizedDoi,
              type: existing.type || paperForm.type,
              tags: existing.tags?.length
                ? existing.tags
                : paperForm.tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
              paperKey: existing.paperKey || paperKey,
              hasLabHeadAuthorship:
                (existing.hasLabHeadAuthorship ?? false) ||
                paperForm.hasLabHeadAuthorship === "yes",
              contributorUids: mergedContributorUids,
              updatedAt: now,
            },
            { merge: true },
          );
        }
      }

      setPaperForm({
        title: "",
        journal: "",
        year: new Date().getFullYear(),
        abstract: "",
        doi: "",
        url: "",
        type: "published",
        tags: "",
        hasLabHeadAuthorship: "yes",
        authors: [
          {
            mode: "linked",
            uid: profile.uid,
            name: profile.name,
            affiliation: profile.affiliation ?? "",
          },
        ],
      });
      setEditingPaperId(null);

      await loadPublicationContext();
    } catch (err) {
      console.error("Shared paper submit failed", err);
      setPaperError("Could not save paper. Please try again.");
    } finally {
      setPaperSubmitting(false);
    }
  };

  const startEditPaper = (paper: Publication) => {
    const mappedAuthors =
      paper.authorEntries && paper.authorEntries.length > 0
        ? paper.authorEntries.map((entry) => {
            if (entry.type === "linked" && entry.uid) {
              return {
                mode: "linked" as const,
                uid: entry.uid,
                name: entry.name,
                affiliation: entry.affiliation || "",
              };
            }
            return {
              mode: "external" as const,
              uid: "",
              name: entry.name,
              affiliation: entry.affiliation || "",
            };
          })
        : [
            {
              mode: "linked" as const,
              uid: profile.uid,
              name: profile.name,
              affiliation: profile.affiliation ?? "",
            },
          ];

    setPaperForm({
      title: paper.title || "",
      journal: paper.journal || "",
      year: paper.year || new Date().getFullYear(),
      abstract: paper.abstract || "",
      doi: paper.doi || "",
      url: paper.url || "",
      type: paper.type || "published",
      tags: (paper.tags ?? []).join(", "),
      hasLabHeadAuthorship: paper.hasLabHeadAuthorship ? "yes" : "no",
      authors: mappedAuthors,
    });
    setEditingPaperId(paper.id);
    setPaperError("");
    setOpenPaperMenuId(null);
  };

  const deleteOwnedPaper = async (paper: Publication) => {
    const confirmed = window.confirm(
      `Delete this paper for everyone?\n\n${paper.title}`,
    );
    if (!confirmed) return;

    setDeletingPaperId(paper.id);
    setOpenPaperMenuId(null);
    setPaperError("");

    try {
      await deleteDoc(doc(db, "publications", paper.id));
      if (editingPaperId === paper.id) setEditingPaperId(null);
      await loadPublicationContext();
    } catch (err) {
      console.error("Delete paper failed", err);
      setPaperError("Could not delete this paper right now. Please try again.");
    } finally {
      setDeletingPaperId(null);
    }
  };

  const unlinkSharedPaper = async (paper: Publication) => {
    const confirmed = window.confirm(
      `Remove this paper from your linked list?\n\n${paper.title}`,
    );
    if (!confirmed) return;

    setPaperError("");
    setUnlinkingPaperId(paper.id);
    setOpenPaperMenuId(null);

    try {
      const currentAuthorEntries = paper.authorEntries ?? [];
      const nextAuthorEntries = currentAuthorEntries.filter(
        (entry) => !(entry.type === "linked" && entry.uid === profile.uid),
      );
      const nextContributorUids = (paper.contributorUids ?? []).filter(
        (uid) => uid !== profile.uid,
      );

      if (currentAuthorEntries.length > 0 && nextAuthorEntries.length === 0) {
        setPaperError(
          "This paper has no other author entries. Ask admin to delete it globally.",
        );
        return;
      }

      const payload: Record<string, unknown> = {
        contributorUids: nextContributorUids,
        updatedAt: new Date().toISOString(),
      };

      if (currentAuthorEntries.length > 0) {
        payload.authorEntries = nextAuthorEntries;
        payload.authors = nextAuthorEntries
          .map((entry) => entry.name)
          .join(", ");
      }

      await updateDoc(doc(db, "publications", paper.id), payload);
      await loadPublicationContext();
    } catch (err) {
      console.error("Unlink paper failed", err);
      setPaperError("Could not remove this paper right now. Please try again.");
    } finally {
      setUnlinkingPaperId(null);
    }
  };

  const sectionRail = [
    {
      id: "photo" as const,
      title: "Profile Photo",
      subtitle: "Quick actions",
      hint: "Change or remove your profile photo.",
      icon: "gallery" as const,
    },
    {
      id: "basic" as const,
      title: "Basic Info",
      subtitle: "Identity details",
      hint: "Edit name, designation, affiliation, bio.",
      icon: "user" as const,
    },
    {
      id: "social" as const,
      title: "Social Links",
      subtitle: "Professional profiles",
      hint: "Add LinkedIn, ORCID, scholar and more.",
      icon: "linkedin" as const,
    },
    {
      id: "publications" as const,
      title: "Publications",
      subtitle: "Academic work",
      hint: "Manage publication entries.",
      icon: "publications" as const,
    },
  ];

  const renderSectionContent = (
    sectionId: "photo" | "basic" | "social" | "publications",
  ) => {
    switch (sectionId) {
      case "photo":
        return (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-3">
                {form.photo ? (
                  <img
                    src={form.photo}
                    alt="Profile preview"
                    className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white shadow-sm"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-black text-[var(--color-primary)] shadow-sm">
                    {String(form.name ?? profile.name ?? "A")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-black text-gray-900">
                    Photo Preview
                  </p>
                  <p className="text-xs text-gray-500">
                    Visible on your profile and portal.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => set("photo", "")}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white"
              >
                Remove current photo
              </button>
            </div>
            <div>
              <CloudinaryUpload
                label=""
                currentUrl={form.photo}
                aspectHint=""
                onUpload={(r: CloudinaryUploadResult) =>
                  set("photo", r.secure_url)
                }
              />
            </div>
          </div>
        );
      case "basic":
        return (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                Full Name
              </label>
              <input
                className={inp}
                style={inpStyle}
                value={form.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Dr. Jane Smith"
              />
            </div>
            {(
              [
                ["designation", "Designation"],
                ["affiliation", "Affiliation"],
              ] as const
            ).map(([k, label]) => (
              <div key={k}>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                  {label}
                </label>
                <input
                  className={inp}
                  style={inpStyle}
                  value={(form as any)[k] ?? ""}
                  onChange={(e) => set(k, e.target.value)}
                />
              </div>
            ))}
            <div className="md:col-span-2 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Bio
                </label>
                <textarea
                  rows={4}
                  className={inp}
                  style={{ ...inpStyle, resize: "vertical" }}
                  value={form.bio ?? ""}
                  onChange={(e) => set("bio", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                  Research Interests (comma separated)
                </label>
                <textarea
                  rows={4}
                  className={inp}
                  style={{ ...inpStyle, resize: "vertical" }}
                  value={(form.researchInterests ?? []).join(", ")}
                  onChange={(e) =>
                    set(
                      "researchInterests",
                      e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="NLP, ML, AM, SCR"
                />
              </div>
            </div>
          </div>
        );
      case "social":
        return (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {(
              [
                ["linkedin", "LinkedIn"],
                ["orcid", "ORCID"],
                ["scholar", "Google Scholar"],
                ["researchgate", "ResearchGate"],
                ["facebook", "Facebook"],
              ] as const
            ).map(([k, label]) => (
              <div key={k}>
                <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                  {label}
                </label>
                <input
                  className={inp}
                  style={inpStyle}
                  value={(form as any)[k] ?? ""}
                  onChange={(e) => set(k, e.target.value)}
                  placeholder="https://..."
                />
              </div>
            ))}
          </div>
        );
      case "publications":
        return (
          <div>
            <form
              onSubmit={submitSharedPaper}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-5"
            >
              <p className="text-sm font-semibold text-gray-600 mb-3">
                {editingPaperId
                  ? "Editing your uploaded paper. Save to apply changes."
                  : "Add a shared paper. If the paper already exists, your co-author links will be merged."}
              </p>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input
                  className={inp}
                  style={inpStyle}
                  placeholder="Paper title *"
                  value={paperForm.title}
                  onChange={(e) => setPaperField("title", e.target.value)}
                />
                <input
                  className={inp}
                  style={inpStyle}
                  placeholder="Journal / Venue"
                  value={paperForm.journal}
                  onChange={(e) => setPaperField("journal", e.target.value)}
                />
                <input
                  className={inp}
                  style={inpStyle}
                  type="number"
                  placeholder="Year"
                  value={paperForm.year}
                  onChange={(e) =>
                    setPaperField("year", Number(e.target.value))
                  }
                />
                <input
                  className={inp}
                  style={inpStyle}
                  placeholder="DOI (or doi.org link)"
                  value={paperForm.doi}
                  onChange={(e) => setPaperField("doi", e.target.value)}
                />
                <input
                  className="md:col-span-2 w-full px-3 py-2.5 text-sm rounded-xl border outline-none"
                  style={inpStyle}
                  placeholder="Paper URL (DOI target)"
                  value={paperForm.url}
                  onChange={(e) => setPaperField("url", e.target.value)}
                />
                <textarea
                  className="md:col-span-2 w-full px-3 py-2.5 text-sm rounded-xl border outline-none"
                  style={{ ...inpStyle, resize: "vertical" }}
                  rows={4}
                  placeholder="Abstract"
                  value={paperForm.abstract}
                  onChange={(e) => setPaperField("abstract", e.target.value)}
                />
                <input
                  className={inp}
                  style={inpStyle}
                  placeholder="Tags (comma separated)"
                  value={paperForm.tags}
                  onChange={(e) => setPaperField("tags", e.target.value)}
                />
                <select
                  className={inp}
                  style={inpStyle}
                  value={paperForm.type}
                  onChange={(e) => setPaperField("type", e.target.value)}
                >
                  <option value="published">Published</option>
                  <option value="ongoing">Ongoing</option>
                </select>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                    Does the lab head have authorship? *
                  </label>
                  <select
                    className={inp}
                    style={inpStyle}
                    value={paperForm.hasLabHeadAuthorship}
                    onChange={(e) =>
                      setPaperField("hasLabHeadAuthorship", e.target.value)
                    }
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
                    Authors
                  </p>
                  <button
                    type="button"
                    onClick={addPaperAuthor}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600"
                  >
                    + Add author
                  </button>
                </div>

                <div className="space-y-2">
                  {paperForm.authors.map((author, i) => (
                    <div
                      key={`${author.mode}-${i}`}
                      className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[120px_minmax(240px,1fr)_minmax(0,1fr)_auto]"
                    >
                      <select
                        className={inp}
                        style={inpStyle}
                        value={author.mode}
                        onChange={(e) =>
                          updatePaperAuthor(i, "mode", e.target.value)
                        }
                      >
                        <option value="linked">Lab member</option>
                        <option value="external">External</option>
                      </select>

                      {author.mode === "linked" ? (
                        <CollaboratorSearchSelect
                          collaborators={collaboratorChoices}
                          value={author.uid}
                          onChange={(uid) => updatePaperAuthor(i, "uid", uid)}
                        />
                      ) : (
                        <input
                          className={inp}
                          style={inpStyle}
                          placeholder="Author name"
                          value={author.name}
                          onChange={(e) =>
                            updatePaperAuthor(i, "name", e.target.value)
                          }
                        />
                      )}

                      <input
                        className={inp}
                        style={inpStyle}
                        placeholder="Affiliation (optional)"
                        value={author.affiliation}
                        onChange={(e) =>
                          updatePaperAuthor(i, "affiliation", e.target.value)
                        }
                      />

                      <button
                        type="button"
                        onClick={() => removePaperAuthor(i)}
                        disabled={paperForm.authors.length === 1}
                        className="rounded-full border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-500 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {paperError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {paperError}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                {editingPaperId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPaperId(null);
                      setPaperError("");
                      setPaperForm({
                        title: "",
                        journal: "",
                        year: new Date().getFullYear(),
                        abstract: "",
                        doi: "",
                        url: "",
                        type: "published",
                        tags: "",
                        hasLabHeadAuthorship: "yes",
                        authors: [
                          {
                            mode: "linked",
                            uid: profile.uid,
                            name: profile.name,
                            affiliation: profile.affiliation ?? "",
                          },
                        ],
                      });
                    }}
                    className="mr-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={paperSubmitting}
                  className="rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {paperSubmitting
                    ? editingPaperId
                      ? "Updating..."
                      : "Saving paper..."
                    : editingPaperId
                      ? "Update Paper"
                      : "Save Paper"}
                </button>
              </div>
            </form>

            <div>
              <p className="mb-3 text-sm font-semibold text-gray-600">
                My linked papers
              </p>
              {mySharedPapers.length === 0 ? (
                <p className="text-sm text-gray-400">No shared papers yet.</p>
              ) : (
                <div className="space-y-2">
                  {mySharedPapers.map((paper) => (
                    <div
                      key={paper.id}
                      className="rounded-xl border border-slate-200 bg-white p-3"
                      onMouseLeave={() =>
                        setOpenPaperMenuId((current) =>
                          current === paper.id ? null : current,
                        )
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 line-clamp-1">
                            {paper.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {paper.journal} · {paper.year}
                          </p>
                        </div>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenPaperMenuId((current) =>
                                current === paper.id ? null : paper.id,
                              )
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                            aria-label="Paper actions"
                          >
                            <AppIcon name="more" size={16} />
                          </button>

                          {openPaperMenuId === paper.id && (
                            <div className="absolute right-0 top-10 z-20 min-w-[190px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                              {paper.createdByUid === profile.uid ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEditPaper(paper)}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    <AppIcon name="about" size={14} />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteOwnedPaper(paper)}
                                    disabled={deletingPaperId === paper.id}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    <AppIcon name="logout" size={14} />
                                    {deletingPaperId === paper.id
                                      ? "Removing..."
                                      : "Remove Paper"}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => unlinkSharedPaper(paper)}
                                  disabled={unlinkingPaperId === paper.id}
                                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                >
                                  <AppIcon name="logout" size={14} />
                                  {unlinkingPaperId === paper.id
                                    ? "Removing..."
                                    : "Disclaim My Authorship"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="pb-16">
      <div
        className="mb-6 flex flex-col gap-4 rounded-3xl border bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "#e5e7eb" }}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
            Profile Studio
          </p>
          <h2
            className="mt-1 text-xl font-black"
            style={{ color: "var(--color-primary)" }}
          >
            My Profile
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Use the section rail on the left. The plus badge means open/edit.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="self-start text-sm font-bold px-5 py-2.5 rounded-full text-white disabled:opacity-60 border-none cursor-pointer sm:self-auto"
          style={{ background: saved ? "#22c55e" : "var(--color-primary)" }}
        >
          {saved ? "✓ Saved!" : saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="space-y-4 lg:hidden">
        {sectionRail.map((section) => {
          const active = openSection === section.id;

          return (
            <div
              key={section.id}
              className="overflow-hidden rounded-3xl border bg-white shadow-sm"
              style={{
                borderColor: active ? "var(--color-primary)" : "#e5e7eb",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenSection(active ? section.id : section.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
                  style={{
                    borderColor: active ? "var(--color-primary)" : "#dbe5dd",
                    background: active ? "#f0fdf4" : "#f8fafc",
                    color: "var(--color-primary)",
                  }}
                >
                  <AppIcon name={section.icon} size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                    {section.subtitle}
                  </p>
                  <h3 className="mt-1 text-lg font-black text-gray-900">
                    {section.title}
                  </h3>
                </div>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg font-black"
                  style={{
                    borderColor: active ? "var(--color-primary)" : "#dbe5dd",
                    background: active ? "var(--color-primary)" : "#f8fafc",
                    color: active ? "white" : "var(--color-primary)",
                  }}
                >
                  +
                </div>
              </button>

              {active && (
                <div
                  className="border-t px-5 py-5"
                  style={{ borderColor: "#eef2f7" }}
                >
                  <div className="mb-4 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    {section.id === "photo"
                      ? "Preview and update photo"
                      : section.id === "basic"
                        ? "Edit identity details"
                        : section.id === "social"
                          ? "Update professional links"
                          : "Manage publications"}
                  </div>
                  {renderSectionContent(section.id)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden gap-5 lg:grid lg:grid-cols-[290px_minmax(0,1fr)]">
        <div className="space-y-3">
          {sectionRail.map((section) => {
            const active = openSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setOpenSection(section.id)}
                className="w-full rounded-3xl border bg-white px-5 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5"
                style={{
                  borderColor: active ? "var(--color-primary)" : "#e5e7eb",
                  boxShadow: active
                    ? "0 10px 24px rgba(15,23,42,0.08)"
                    : "0 6px 18px rgba(15,23,42,0.04)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
                      style={{
                        borderColor: active
                          ? "var(--color-primary)"
                          : "#dbe5dd",
                        background: active ? "#f0fdf4" : "#f8fafc",
                        color: "var(--color-primary)",
                      }}
                    >
                      <AppIcon name={section.icon} size={22} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                        {section.subtitle}
                      </p>
                      <h3 className="mt-1 text-lg font-black text-gray-900">
                        {section.title}
                      </h3>
                      <p className="mt-2 text-sm text-gray-500">
                        {section.hint}
                      </p>
                    </div>
                  </div>
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg font-black transition-all"
                    style={{
                      borderColor: active ? "var(--color-primary)" : "#dbe5dd",
                      background: active ? "var(--color-primary)" : "#f8fafc",
                      color: active ? "white" : "var(--color-primary)",
                    }}
                  >
                    +
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div
          className="rounded-3xl border bg-white p-5 shadow-sm"
          style={{ borderColor: "#e5e7eb" }}
        >
          <div
            className="mb-5 flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: "#eef2f7" }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                {
                  sectionRail.find((section) => section.id === openSection)
                    ?.subtitle
                }
              </p>
              <div className="mt-1 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-[var(--color-primary)]">
                  <AppIcon
                    name={
                      sectionRail.find((section) => section.id === openSection)
                        ?.icon ?? "user"
                    }
                    size={20}
                  />
                </div>
                <h3 className="text-xl font-black text-gray-900">
                  {
                    sectionRail.find((section) => section.id === openSection)
                      ?.title
                  }
                </h3>
              </div>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {openSection === "photo"
                ? "Preview and update photo"
                : openSection === "basic"
                  ? "Edit identity details"
                  : openSection === "social"
                    ? "Update professional links"
                    : "Manage publications"}
            </div>
          </div>

          {renderSectionContent(openSection)}
        </div>
      </div>
    </div>
  );
};

const CollaboratorSearchSelect: React.FC<{
  collaborators: CollaboratorProfile[];
  value: string;
  onChange: (uid: string) => void;
}> = ({ collaborators, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const selected = useMemo(
    () => collaborators.find((c) => c.uid === value) ?? null,
    [collaborators, value],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return collaborators;
    return collaborators.filter((c) => c.name.toLowerCase().includes(q));
  }, [collaborators, search]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = filtered.findIndex((c) => c.uid === value);
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, filtered, value]);

  const selectByIndex = (index: number) => {
    const selectedOption = filtered[index];
    if (!selectedOption) return;
    onChange(selectedOption.uid);
    setOpen(false);
    setSearch("");
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) =>
        Math.min(prev + 1, Math.max(filtered.length - 1, 0)),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectByIndex(highlightedIndex);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) setTimeout(() => inputRef.current?.focus(), 0);
            return next;
          });
        }}
        className="flex h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-sm"
      >
        {selected ? (
          <span className="inline-flex min-w-0 items-center gap-2">
            {selected.photo ? (
              <img
                src={selected.photo}
                alt={selected.name}
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                {selected.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate font-medium text-slate-800">
              {selected.name}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              Collaborator
            </span>
          </span>
        ) : (
          <span className="text-gray-400">Search and select collaborator</span>
        )}
        <span className="text-gray-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full min-w-[280px] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search collaborator..."
            className="mb-2 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none"
            onKeyDown={onInputKeyDown}
            autoFocus
          />
          <div className="max-h-64 overflow-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-2 text-xs text-gray-400">No matches.</p>
            ) : (
              filtered.map((c, index) => {
                const active = c.uid === value;
                const isHighlighted = highlightedIndex === index;
                return (
                  <button
                    key={c.uid}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectByIndex(index)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                    style={{
                      background: isHighlighted
                        ? "#eaf2ff"
                        : active
                          ? "#eff6ff"
                          : "transparent",
                    }}
                  >
                    {c.photo ? (
                      <img
                        src={c.photo}
                        alt={c.name}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {c.name}
                      </span>
                      <span className="mt-0.5 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        Collaborator
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── My Gallery Uploads ────────────────────────────────────────
const MyGalleryUploads: React.FC<{
  firebaseUser: FirebaseUser | null;
  uploaderName: string;
  uploaderEmail: string;
}> = ({ firebaseUser, uploaderName, uploaderEmail }) => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    imageUrl: "",
  });
  const activeUploaderId = firebaseUser?.uid ?? "";

  const load = async () => {
    if (!activeUploaderId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "gallery"),
          where("uploaderUid", "==", activeUploaderId),
        ),
      );
      setItems(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as GalleryItem)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [activeUploaderId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.imageUrl.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      if (!firebaseUser) {
        setError("Your session expired. Please sign in again.");
        return;
      }

      await firebaseUser.getIdToken(true);

      await addDoc(collection(db, "gallery"), {
        title: form.title.trim(),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim(),
        uploaderUid: firebaseUser.uid,
        uploaderName,
        uploaderEmail,
        order: Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isVisible: true,
        moderationStatus: "approved",
      });

      setForm({ title: "", description: "", imageUrl: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      console.error("Gallery upload failed:", err);
      const code = (err as any)?.code;
      if (code === "permission-denied") {
        setError(
          "Upload blocked by permissions. Please sign in and try again.",
        );
      } else {
        setError("Upload failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (item: GalleryItem) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    await deleteDoc(doc(db, "gallery", item.id));
    setOpenMenuId(null);
    load();
  };

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl border outline-none";
  const inpStyle = { borderColor: "#e5e7eb" };

  return (
    <div className="pb-16">
      <div className="mb-6">
        <div>
          <h2
            className="text-xl font-black"
            style={{ color: "var(--color-primary)" }}
          >
            My Gallery Uploads
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Tap the first + tile to upload a new image.
          </p>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="bg-white rounded-3xl p-6 shadow-sm border mb-6"
          style={{ borderColor: "#e5e7eb" }}
        >
          <h3
            className="font-bold text-base mb-4"
            style={{ color: "var(--color-primary)" }}
          >
            New Gallery Photo
          </h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Photo Title *
              </label>
              <input
                required
                className={inp}
                style={inpStyle}
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
                placeholder="e.g. Robotics Workshop 2026"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Description
              </label>
              <textarea
                rows={3}
                className={inp}
                style={{ ...inpStyle, resize: "vertical" }}
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Add a short caption for this image"
              />
            </div>

            <CloudinaryUpload
              label="Photo *"
              currentUrl={form.imageUrl}
              aspectHint="JPG, PNG, WEBP. Keep the image clear and relevant to the lab."
              onUpload={(r: CloudinaryUploadResult) =>
                setForm((p) => ({ ...p, imageUrl: r.secure_url }))
              }
            />

            <button
              type="submit"
              disabled={submitting}
              className="self-end text-sm font-bold px-6 py-2.5 rounded-xl text-white disabled:opacity-60 border-none cursor-pointer"
              style={{ background: "var(--color-primary)" }}
            >
              {submitting ? "Uploading..." : "Publish to Gallery"}
            </button>

            {error && (
              <div
                className="rounded-xl p-3 text-sm text-red-700"
                style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
              >
                {error}
              </div>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div
            className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin"
            style={{
              borderColor: "var(--color-primary)",
              borderTopColor: "transparent",
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="group relative aspect-square overflow-hidden rounded-2xl border-2 border-dashed transition-all"
            style={{
              borderColor: showForm ? "var(--color-primary)" : "#cbd5e1",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(238,245,241,0.98) 100%)",
            }}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-md"
                style={{ background: "var(--color-primary)" }}
              >
                <span className="text-4xl leading-none">+</span>
              </div>
              <p className="mt-4 text-sm font-black text-gray-900">
                {showForm ? "Close Uploader" : "Add Photo"}
              </p>
            </div>
          </button>

          {items.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-square overflow-hidden rounded-2xl border bg-white shadow-sm"
              style={{ borderColor: "#e5e7eb" }}
              onMouseLeave={() =>
                setOpenMenuId((current) =>
                  current === item.id ? null : current,
                )
              }
            >
              <img
                src={item.imageUrl}
                alt={item.title}
                className="h-full w-full object-cover"
              />

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-10">
                <p className="text-sm font-black text-white line-clamp-1">
                  {item.title}
                </p>
              </div>

              <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/25 bg-black/45 px-3 py-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <p className="text-xs text-white/90 line-clamp-3">
                  {item.description || "No description"}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setOpenMenuId((current) =>
                    current === item.id ? null : item.id,
                  )
                }
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white opacity-0 transition-all duration-200 hover:bg-black/50 group-hover:opacity-100"
                aria-label="Open item menu"
              >
                <AppIcon name="more" size={18} />
              </button>

              {openMenuId === item.id && (
                <div className="absolute right-3 top-14 z-10 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    <AppIcon name="logout" size={14} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── My Ideas ──────────────────────────────────────────────────
const MyIdeas: React.FC<{
  authorId: string;
  authorName: string;
  authorPhoto: string;
}> = ({ authorId, authorName, authorPhoto }) => {
  const [ideas, setIdeas] = useState<ResearchIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    shortDescription: "",
    fullDescription: "",
    tags: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const snap = await getDocs(
      query(collection(db, "researchIdeas"), where("authorId", "==", authorId)),
    );
    setIdeas(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as ResearchIdea)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [authorId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.shortDescription || !form.fullDescription) return;
    setSubmitting(true);
    await addDoc(collection(db, "researchIdeas"), {
      title: form.title.trim(),
      shortDescription: form.shortDescription.trim(),
      fullDescription: form.fullDescription.trim(),
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      authorId,
      authorName,
      authorPhoto,
      commentCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setShowForm(false);
    setForm({ title: "", shortDescription: "", fullDescription: "", tags: "" });
    setSubmitting(false);
    load();
  };

  const deleteIdea = async (idea: ResearchIdea) => {
    if (!window.confirm(`Delete "${idea.title}"?`)) return;
    await deleteDoc(doc(db, "researchIdeas", idea.id));
    load();
  };

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl border outline-none";
  const inpStyle = { borderColor: "#e5e7eb" };

  return (
    <div className="pb-16">
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-xl font-black"
          style={{ color: "var(--color-primary)" }}
        >
          My Research Ideas
        </h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm font-bold px-5 py-2.5 rounded-xl text-white border-none cursor-pointer"
          style={{ background: "var(--color-primary)" }}
        >
          {showForm ? "Cancel" : "+ Post New Idea"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="bg-white rounded-2xl p-6 shadow-sm border mb-6"
          style={{ borderColor: "#e5e7eb" }}
        >
          <h3
            className="font-bold text-base mb-4"
            style={{ color: "var(--color-primary)" }}
          >
            New Research Idea
          </h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Title *
              </label>
              <input
                required
                className={inp}
                style={inpStyle}
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Short Description *{" "}
                <span className="text-gray-400 font-normal">
                  (shown on card)
                </span>
              </label>
              <textarea
                required
                rows={2}
                className={inp}
                style={{ ...inpStyle, resize: "none" }}
                value={form.shortDescription}
                onChange={(e) =>
                  setForm((p) => ({ ...p, shortDescription: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Full Description *{" "}
                <span className="text-gray-400 font-normal">
                  (shown on detail page)
                </span>
              </label>
              <textarea
                required
                rows={6}
                className={inp}
                style={{ ...inpStyle, resize: "vertical" }}
                value={form.fullDescription}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fullDescription: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Tags{" "}
                <span className="text-gray-400 font-normal">
                  (comma separated)
                </span>
              </label>
              <input
                className={inp}
                style={inpStyle}
                value={form.tags}
                onChange={(e) =>
                  setForm((p) => ({ ...p, tags: e.target.value }))
                }
                placeholder="AI, NLP, healthcare"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="self-end text-sm font-bold px-6 py-2.5 rounded-xl text-white disabled:opacity-60 border-none cursor-pointer"
              style={{ background: "var(--color-primary)" }}
            >
              {submitting ? "Posting..." : "Post Idea"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div
            className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin"
            style={{
              borderColor: "var(--color-primary)",
              borderTopColor: "transparent",
            }}
          />
        </div>
      ) : ideas.length === 0 ? (
        <div className="text-center py-16">
          <div className="mb-3 inline-flex text-gray-400">
            <AppIcon name="ideas" size={36} />
          </div>
          <p className="text-gray-400">You haven't posted any ideas yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {ideas.map((idea) => (
            <div
              key={idea.id}
              className="bg-white rounded-2xl p-4 shadow-sm border flex items-start gap-4"
              style={{ borderColor: "#e5e7eb" }}
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{idea.title}</p>
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                  {idea.shortDescription}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(idea.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {idea.commentCount ?? 0} comments
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <a
                  href={`/research-ideas/${idea.id}`}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg no-underline"
                  style={{ background: "#eff6ff", color: "#1d4ed8" }}
                >
                  View
                </a>
                <button
                  onClick={() => deleteIdea(idea)}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg text-white cursor-pointer border-none"
                  style={{ background: "#ef4444" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CollaboratorPortal;
