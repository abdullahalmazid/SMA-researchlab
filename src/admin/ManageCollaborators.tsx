import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import AppIcon from "../components/AppIcon";
import CloudinaryUpload from "../components/CloudinaryUpload";
import { db } from "../firebase/config";
import type {
  CloudinaryUploadResult,
  CollaboratorProfile,
  CollaboratorPublication,
} from "../types";

const createEmptyCollaborator = (nextOrder: number): CollaboratorProfile => ({
  id: "",
  uid: "",
  name: "",
  email: "",
  photo: "",
  affiliation: "",
  designation: "",
  bio: "",
  researchInterests: [],
  linkedin: "",
  orcid: "",
  scholar: "",
  researchgate: "",
  facebook: "",
  publications: [],
  isActive: true,
  order: nextOrder,
  createdAt: new Date().toISOString(),
});

const ManageCollaborators: React.FC = () => {
  const [collaborators, setCollaborators] = useState<CollaboratorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CollaboratorProfile | null>(null);
  const [editorMode, setEditorMode] = useState<"add" | "edit">("edit");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = async () => {
    const snap = await getDocs(
      query(collection(db, "collaborators"), orderBy("order", "asc")),
    );
    setCollaborators(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CollaboratorProfile),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (c: CollaboratorProfile) => {
    await updateDoc(doc(db, "collaborators", c.id), { isActive: !c.isActive });
    load();
  };

  const remove = async (c: CollaboratorProfile) => {
    if (
      !window.confirm(
        `Remove ${c.name} from collaborators? This cannot be undone.`,
      )
    )
      return;
    setDeletingId(c.id);
    await deleteDoc(doc(db, "collaborators", c.id));
    setDeletingId(null);
    load();
  };

  const reorder = async (
    item: CollaboratorProfile,
    direction: "up" | "down",
  ) => {
    const idx = collaborators.findIndex((c) => c.id === item.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= collaborators.length) return;
    const swap = collaborators[swapIdx];
    await updateDoc(doc(db, "collaborators", item.id), {
      order: swap.order ?? 0,
    });
    await updateDoc(doc(db, "collaborators", swap.id), {
      order: item.order ?? 0,
    });
    load();
  };

  const startAdd = () => {
    const nextOrder =
      collaborators.reduce((max, c) => Math.max(max, c.order ?? 0), 0) + 1;
    setEditorMode("add");
    setEditing(createEmptyCollaborator(nextOrder));
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      alert("Please enter a collaborator name.");
      return;
    }
    setSaving(true);
    try {
      const { id, ...data } = editing;
      if (editorMode === "add") {
        await addDoc(collection(db, "collaborators"), {
          ...data,
          createdAt: data.createdAt || new Date().toISOString(),
        } as any);
      } else {
        await updateDoc(doc(db, "collaborators", id), data as any);
      }
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
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

  if (editing) {
    return (
      <EditForm
        mode={editorMode}
        collaborator={editing}
        onChange={setEditing}
        onSave={saveEdit}
        onCancel={() => setEditing(null)}
        saving={saving}
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2
          className="text-2xl font-black"
          style={{ color: "var(--color-primary)" }}
        >
          Manage Collaborators
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {collaborators.length} collaborators total
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <button
          type="button"
          onClick={startAdd}
          className="group relative aspect-square overflow-hidden rounded-2xl border-2 border-dashed transition-all"
          style={{
            borderColor: "#cbd5e1",
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
              Add Collaborator
            </p>
          </div>
        </button>

        {collaborators.map((c, idx) => (
          <div
            key={c.id}
            className={`group relative aspect-square rounded-2xl border bg-white shadow-sm ${openMenuId === c.id ? "z-20" : "z-0"}`}
            style={{ borderColor: "#e5e7eb" }}
            onMouseLeave={() =>
              setOpenMenuId((current) => (current === c.id ? null : current))
            }
          >
            {c.photo ? (
              <img
                src={c.photo}
                alt={c.name}
                className="h-full w-full rounded-2xl object-cover"
              />
            ) : (
              <div
                className="h-full w-full rounded-2xl flex items-center justify-center text-6xl font-black text-white"
                style={{ background: "var(--color-primary)" }}
              >
                {c.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-10">
              <p className="text-sm font-black text-white line-clamp-1">
                {c.name}
              </p>
              <p className="text-xs text-white/80 mt-1 line-clamp-1">
                {c.designation || "Collaborator"}
                {c.affiliation ? ` · ${c.affiliation}` : ""}
              </p>
              <p className="text-xs text-white/70 mt-1">
                {c.isActive ? "Visible" : "Hidden"}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setOpenMenuId((current) => (current === c.id ? null : c.id))
              }
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white opacity-100 transition-all duration-200 hover:bg-black/50 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label="Open collaborator menu"
            >
              <AppIcon name="more" size={18} />
            </button>

            {openMenuId === c.id && (
              <div className="absolute right-3 top-14 z-[500] w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setEditorMode("edit");
                    setEditing(c);
                    setOpenMenuId(null);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <AppIcon name="about" size={14} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setOpenMenuId(null);
                    await reorder(c, "up");
                  }}
                  disabled={idx === 0}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <span>↑</span>
                  Move Up
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setOpenMenuId(null);
                    await reorder(c, "down");
                  }}
                  disabled={idx === collaborators.length - 1}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <span>↓</span>
                  Move Down
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setOpenMenuId(null);
                    await toggleActive(c);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <AppIcon name="user" size={14} />
                  {c.isActive ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(c)}
                  disabled={deletingId === c.id}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <AppIcon name="logout" size={14} />
                  {deletingId === c.id ? "Removing..." : "Remove"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Edit Form ──────────────────────────────────────────────────
const EditForm: React.FC<{
  mode: "add" | "edit";
  collaborator: CollaboratorProfile;
  onChange: (c: CollaboratorProfile) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}> = ({ mode, collaborator: c, onChange, onSave, onCancel, saving }) => {
  const set = (k: keyof CollaboratorProfile, v: any) =>
    onChange({ ...c, [k]: v });

  const updatePub = (
    i: number,
    k: keyof CollaboratorPublication,
    v: string | number,
  ) => {
    const pubs = [...(c.publications ?? [])];
    pubs[i] = { ...pubs[i], [k]: v };
    set("publications", pubs);
  };

  const addPub = () =>
    set("publications", [
      ...(c.publications ?? []),
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
      (c.publications ?? []).filter((_, idx) => idx !== i),
    );

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl border outline-none";
  const inpStyle = { borderColor: "#e5e7eb" };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-2xl font-black"
          style={{ color: "var(--color-primary)" }}
        >
          {mode === "add" ? "Add Collaborator" : `Edit: ${c.name}`}
        </h2>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="text-sm font-semibold px-5 py-2 rounded-xl border cursor-pointer"
            style={{
              borderColor: "#d1d5db",
              background: "white",
              color: "#374151",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="text-sm font-bold px-5 py-2 rounded-xl text-white disabled:opacity-60 cursor-pointer border-none"
            style={{ background: "var(--color-primary)" }}
          >
            {saving
              ? "Saving..."
              : mode === "add"
                ? "Create Collaborator"
                : "Save Changes"}
          </button>
        </div>
      </div>

      <div
        className="bg-white rounded-2xl p-6 shadow-sm border"
        style={{ borderColor: "#e5e7eb" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          {(
            [
              ["name", "Name"],
              ["email", "Email"],
              ["uid", "UID"],
              ["designation", "Designation"],
              ["affiliation", "Affiliation"],
              ["linkedin", "LinkedIn"],
              ["orcid", "ORCID"],
              ["scholar", "Google Scholar"],
              ["researchgate", "ResearchGate"],
              ["facebook", "Facebook"],
            ] as const
          ).map(([k, label]) => (
            <div key={k}>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                {label}
              </label>
              <input
                className={inp}
                style={inpStyle}
                value={(c as any)[k] ?? ""}
                onChange={(e) => set(k as any, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Bio
          </label>
          <textarea
            rows={5}
            className={inp}
            style={{ ...inpStyle, resize: "vertical" }}
            value={c.bio ?? ""}
            onChange={(e) => set("bio", e.target.value)}
          />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Research Interests (comma separated)
          </label>
          <input
            className={inp}
            style={inpStyle}
            value={(c.researchInterests ?? []).join(", ")}
            onChange={(e) =>
              set(
                "researchInterests",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </div>

        <CloudinaryUpload
          label="Profile Photo"
          currentUrl={c.photo}
          onUpload={(r: CloudinaryUploadResult) => set("photo", r.secure_url)}
        />

        {/* Publications */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-bold text-gray-700">
              Publications
            </label>
            <button
              onClick={addPub}
              className="text-xs font-bold bg-transparent border-none cursor-pointer"
              style={{ color: "var(--color-secondary)" }}
            >
              + Add
            </button>
          </div>
          {(c.publications ?? []).map((p, i) => (
            <div
              key={p.id}
              className="grid grid-cols-4 gap-2 mb-2 items-center"
            >
              <input
                className={`${inp} col-span-2`}
                style={inpStyle}
                placeholder="Title"
                value={p.title}
                onChange={(e) => updatePub(i, "title", e.target.value)}
              />
              <input
                className={inp}
                style={inpStyle}
                placeholder="Journal"
                value={p.journal}
                onChange={(e) => updatePub(i, "journal", e.target.value)}
              />
              <div className="flex gap-1">
                <input
                  className={inp}
                  style={inpStyle}
                  placeholder="Year"
                  type="number"
                  value={p.year}
                  onChange={(e) => updatePub(i, "year", +e.target.value)}
                />
                <button
                  onClick={() => removePub(i)}
                  className="text-red-400 bg-transparent border-none cursor-pointer text-lg leading-none"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-4 flex items-center gap-4 pt-4 border-t"
          style={{ borderColor: "#e5e7eb" }}
        >
          <label className="text-sm font-semibold text-gray-700">
            Visibility
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={c.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
            />
            <span className="text-sm text-gray-600">
              Show on Collaborators page
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default ManageCollaborators;
