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
import { db } from "../firebase/config";
import type { Publication } from "../types";

const emptyPub = (): Omit<Publication, "id" | "createdAt"> => ({
  title: "",
  authors: "",
  journal: "",
  year: new Date().getFullYear(),
  abstract: "",
  url: "",
  doi: "",
  type: "published",
  tags: [],
  hasLabHeadAuthorship: true,
});

const ManagePublications: React.FC = () => {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [collaboratorNameByUid, setCollaboratorNameByUid] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{
    mode: "add" | "edit";
    data: Publication | Omit<Publication, "id" | "createdAt">;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "ongoing" | "published">(
    "all",
  );

  const load = async () => {
    const [pubSnap, collabSnap] = await Promise.all([
      getDocs(query(collection(db, "publications"), orderBy("year", "desc"))),
      getDocs(collection(db, "collaborators")),
    ]);
    setPublications(
      pubSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Publication),
    );
    const nameMap: Record<string, string> = {};
    collabSnap.docs.forEach((d) => {
      const data = d.data() as any;
      if (data.uid && data.name) nameMap[data.uid] = data.name;
    });
    setCollaboratorNameByUid(nameMap);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      if (modal.mode === "add") {
        await addDoc(collection(db, "publications"), {
          ...modal.data,
          createdAt: new Date().toISOString(),
        });
      } else {
        const { id, ...data } = modal.data as Publication;
        await updateDoc(doc(db, "publications", id), data as any);
      }
      setModal(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Publication) => {
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    setDeletingId(p.id);
    await deleteDoc(doc(db, "publications", p.id));
    setDeletingId(null);
    setOpenMenuId(null);
    load();
  };

  const toggleType = async (p: Publication) => {
    await updateDoc(doc(db, "publications", p.id), {
      type: p.type === "ongoing" ? "published" : "ongoing",
      updatedAt: new Date().toISOString(),
    });
    setOpenMenuId(null);
    load();
  };

  const toggleLabHeadAuthorship = async (p: Publication) => {
    await updateDoc(doc(db, "publications", p.id), {
      hasLabHeadAuthorship: !(p.hasLabHeadAuthorship ?? false),
      updatedAt: new Date().toISOString(),
    });
    setOpenMenuId(null);
    load();
  };

  const filtered = publications.filter(
    (p) => filterType === "all" || p.type === filterType,
  );

  const setField = (k: string, v: any) =>
    setModal((m) => (m ? { ...m, data: { ...m.data, [k]: v } } : null));

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl border outline-none";
  const inpStyle = { borderColor: "#e5e7eb" };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2
            className="text-2xl font-black"
            style={{ color: "var(--color-primary)" }}
          >
            Manage Publications
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {publications.length} publications total
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(["all", "ongoing", "published"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className="text-sm font-semibold px-4 py-1.5 rounded-xl border cursor-pointer capitalize"
            style={{
              background: filterType === t ? "var(--color-primary)" : "white",
              color: filterType === t ? "white" : "#374151",
              borderColor:
                filterType === t ? "var(--color-primary)" : "#e5e7eb",
            }}
          >
            {t} (
            {t === "all"
              ? publications.length
              : publications.filter((p) => p.type === t).length}
            )
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div
            className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin"
            style={{
              borderColor: "var(--color-primary)",
              borderTopColor: "transparent",
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setModal({ mode: "add", data: emptyPub() })}
            className="w-full rounded-2xl border-2 border-dashed px-4 py-4 text-left transition-all"
            style={{
              borderColor: "#cbd5e1",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(238,245,241,0.98) 100%)",
            }}
          >
            <span className="inline-flex items-center gap-3">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
                style={{ background: "var(--color-primary)" }}
              >
                <span className="text-2xl leading-none">+</span>
              </span>
              <span>
                <span className="block text-sm font-black text-gray-900">
                  Add Publication
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  Create a new canonical paper record
                </span>
              </span>
            </span>
          </button>

          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-2xl p-4 shadow-sm border flex items-start gap-4"
              style={{
                borderColor: "#e5e7eb",
                borderLeft: `4px solid ${p.type === "ongoing" ? "#f59e0b" : "#2563eb"}`,
              }}
              onMouseLeave={() =>
                setOpenMenuId((current) => (current === p.id ? null : current))
              }
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: p.type === "ongoing" ? "#fef3c7" : "#dbeafe",
                      color: p.type === "ongoing" ? "#92400e" : "#1e40af",
                    }}
                  >
                    {p.type}
                  </span>
                  <span className="text-xs text-gray-400">{p.year}</span>
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: p.hasLabHeadAuthorship
                        ? "#dcfce7"
                        : "#fee2e2",
                      color: p.hasLabHeadAuthorship ? "#166534" : "#991b1b",
                    }}
                  >
                    {p.hasLabHeadAuthorship ? "lab-head yes" : "lab-head no"}
                  </span>
                </div>
                <p className="font-bold text-gray-900 text-sm leading-snug">
                  {p.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{p.authors}</p>
                <p
                  className="text-xs font-medium mt-0.5"
                  style={{ color: "var(--color-secondary)" }}
                >
                  {p.journal}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Uploaded by:{" "}
                  {p.createdByUid
                    ? collaboratorNameByUid[p.createdByUid] || p.createdByUid
                    : "Unknown"}{" "}
                  · Linked: {p.contributorUids?.length ?? 0}
                </p>
              </div>

              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setOpenMenuId((current) => (current === p.id ? null : p.id))
                  }
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  aria-label="Open publication menu"
                >
                  <AppIcon name="more" size={16} />
                </button>

                {openMenuId === p.id && (
                  <div className="absolute right-0 top-10 z-[500] min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setModal({ mode: "edit", data: p });
                        setOpenMenuId(null);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <AppIcon name="about" size={14} />
                      Edit Paper
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleType(p)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <AppIcon name="publications" size={14} />
                      {p.type === "ongoing"
                        ? "Mark as Published"
                        : "Mark as Ongoing"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleLabHeadAuthorship(p)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <AppIcon name="user" size={14} />
                      {p.hasLabHeadAuthorship
                        ? "Set Lab-Head: No"
                        : "Set Lab-Head: Yes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(p)}
                      disabled={deletingId === p.id}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <AppIcon name="logout" size={14} />
                      {deletingId === p.id ? "Deleting..." : "Delete Paper"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 py-10">
              No publications found.
            </p>
          )}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-[2147482000] flex items-start justify-center overflow-y-auto p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setModal(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ background: "var(--color-primary)" }}
            >
              <h3 className="text-white font-black text-lg">
                {modal.mode === "add" ? "Add Publication" : "Edit Publication"}
              </h3>
              <button
                onClick={() => setModal(null)}
                className="text-white text-2xl bg-transparent border-none cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Title *
                </label>
                <input
                  className={inp}
                  style={inpStyle}
                  value={(modal.data as any).title}
                  onChange={(e) => setField("title", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Authors
                </label>
                <input
                  className={inp}
                  style={inpStyle}
                  value={(modal.data as any).authors}
                  onChange={(e) => setField("authors", e.target.value)}
                  placeholder="Rahman, M.R., Siddiqui, A., ..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Journal / Venue
                  </label>
                  <input
                    className={inp}
                    style={inpStyle}
                    value={(modal.data as any).journal}
                    onChange={(e) => setField("journal", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Year
                  </label>
                  <input
                    type="number"
                    className={inp}
                    style={inpStyle}
                    value={(modal.data as any).year}
                    onChange={(e) => setField("year", +e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Type
                  </label>
                  <select
                    className={inp}
                    style={inpStyle}
                    value={(modal.data as any).type}
                    onChange={(e) => setField("type", e.target.value)}
                  >
                    <option value="published">Published</option>
                    <option value="ongoing">Ongoing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    DOI
                  </label>
                  <input
                    className={inp}
                    style={inpStyle}
                    value={(modal.data as any).doi}
                    onChange={(e) => setField("doi", e.target.value)}
                    placeholder="10.1000/xyz123"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Lab-Head Authorship
                </label>
                <select
                  className={inp}
                  style={inpStyle}
                  value={
                    (modal.data as any).hasLabHeadAuthorship ? "yes" : "no"
                  }
                  onChange={(e) =>
                    setField("hasLabHeadAuthorship", e.target.value === "yes")
                  }
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  URL
                </label>
                <input
                  type="url"
                  className={inp}
                  style={inpStyle}
                  value={(modal.data as any).url}
                  onChange={(e) => setField("url", e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Abstract
                </label>
                <textarea
                  rows={4}
                  className={inp}
                  style={{ ...inpStyle, resize: "vertical" }}
                  value={(modal.data as any).abstract}
                  onChange={(e) => setField("abstract", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Tags (comma separated)
                </label>
                <input
                  className={inp}
                  style={inpStyle}
                  value={((modal.data as any).tags ?? []).join(", ")}
                  onChange={(e) =>
                    setField(
                      "tags",
                      e.target.value
                        .split(",")
                        .map((t: string) => t.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setModal(null)}
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
                  onClick={save}
                  disabled={saving}
                  className="text-sm font-bold px-6 py-2 rounded-xl text-white disabled:opacity-60 border-none cursor-pointer"
                  style={{ background: "var(--color-primary)" }}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagePublications;
