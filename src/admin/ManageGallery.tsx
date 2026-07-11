import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import React, { useState } from "react";
import AppIcon from "../components/AppIcon";
import CloudinaryUpload from "../components/CloudinaryUpload";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import { useGallery } from "../firebase/hooks";
import type { CloudinaryUploadResult, GalleryItem } from "../types";

// ── Empty form state ───────────────────────────────────────────
const emptyForm = () => ({ title: "", description: "", imageUrl: "" });

const ManageGallery: React.FC = () => {
  const { appUser } = useAuth();
  const { gallery, loading } = useGallery();
  const [modal, setModal] = useState<{
    mode: "add" | "edit";
    data: Partial<GalleryItem>;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // ── Save (add or edit) ───────────────────────────────────────
  const save = async () => {
    if (!modal) return;
    if (!modal.data.title?.trim()) {
      alert("Please enter a title.");
      return;
    }
    if (!modal.data.imageUrl?.trim()) {
      alert("Please upload or paste an image URL.");
      return;
    }
    setSaving(true);
    try {
      if (modal.mode === "add") {
        const maxOrder = gallery.reduce((m, g) => Math.max(m, g.order ?? 0), 0);
        await addDoc(collection(db, "gallery"), {
          title: modal.data.title.trim(),
          description: modal.data.description?.trim() ?? "",
          imageUrl: modal.data.imageUrl.trim(),
          order: maxOrder + 1,
          uploaderUid: appUser?.uid ?? "",
          uploaderName: appUser?.name ?? "Admin",
          uploaderEmail: appUser?.email ?? "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        const { id, ...data } = modal.data as GalleryItem;
        await updateDoc(doc(db, "gallery", id), {
          title: data.title.trim(),
          description: data.description?.trim() ?? "",
          imageUrl: data.imageUrl.trim(),
          updatedAt: new Date().toISOString(),
        });
      }
      setModal(null);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────
  const remove = async (item: GalleryItem) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setDeletingId(item.id);
    await deleteDoc(doc(db, "gallery", item.id));
    setDeletingId(null);
  };

  // ── Reorder ──────────────────────────────────────────────────
  const reorder = async (item: GalleryItem, direction: "up" | "down") => {
    const idx = gallery.findIndex((g) => g.id === item.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= gallery.length) return;
    const swap = gallery[swapIdx];
    await updateDoc(doc(db, "gallery", item.id), { order: swap.order });
    await updateDoc(doc(db, "gallery", swap.id), { order: item.order });
  };

  const setField = (k: keyof GalleryItem, v: string) =>
    setModal((m) => (m ? { ...m, data: { ...m.data, [k]: v } } : null));

  const inp = "w-full px-3 py-2.5 text-sm rounded-xl border outline-none";
  const inpStyle = { borderColor: "#e5e7eb" };

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2
            className="text-2xl font-black"
            style={{ color: "var(--color-primary)" }}
          >
            Manage Gallery
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {gallery.length} image{gallery.length !== 1 ? "s" : ""} in gallery
          </p>
        </div>
      </div>

      {/* ── Loading ── */}
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
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setModal({ mode: "add", data: emptyForm() })}
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
                  Add Image
                </p>
              </div>
            </button>

            {gallery.map((item, idx) => (
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
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://via.placeholder.com/500x500?text=No+Image";
                  }}
                />

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-10">
                  <p className="text-sm font-black text-white line-clamp-1">
                    {item.title}
                  </p>
                  <p className="text-xs text-white/80 mt-1 line-clamp-1">
                    Uploaded by {item.uploaderName || "Unknown"}
                  </p>
                </div>

                {item.description && (
                  <div className="absolute inset-x-3 bottom-14 rounded-xl border border-white/25 bg-black/45 px-3 py-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <p className="text-xs text-white/90 line-clamp-3">
                      {item.description}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setOpenMenuId((current) =>
                      current === item.id ? null : item.id,
                    )
                  }
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white opacity-100 transition-all duration-200 hover:bg-black/50 sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label="Open image menu"
                >
                  <AppIcon name="more" size={18} />
                </button>

                {openMenuId === item.id && (
                  <div className="absolute right-3 top-14 z-[500] w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setModal({ mode: "edit", data: { ...item } });
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
                        await reorder(item, "up");
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
                        await reorder(item, "down");
                      }}
                      disabled={idx === gallery.length - 1}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <span>↓</span>
                      Move Down
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      disabled={deletingId === item.id}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <AppIcon name="logout" size={14} />
                      {deletingId === item.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {gallery.length === 0 && (
            <p className="mt-4 text-center text-sm text-gray-500">
              No images yet. Use the plus tile to add your first image.
            </p>
          )}
        </>
      )}

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <div
          className="fixed inset-0 z-[2147482000] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setModal(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ background: "var(--color-primary)" }}
            >
              <h3 className="text-white font-black text-lg">
                {modal.mode === "add" ? "Add Image" : "Edit Image"}
              </h3>
              <button
                onClick={() => setModal(null)}
                className="text-white text-2xl bg-transparent border-none cursor-pointer leading-none opacity-70"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-screen">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Title *
                </label>
                <input
                  className={inp}
                  style={inpStyle}
                  value={modal.data.title ?? ""}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="e.g. Lab Annual Meeting 2024"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Description{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  className={inp}
                  style={{ ...inpStyle, resize: "none" }}
                  value={modal.data.description ?? ""}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Short caption shown on hover..."
                />
              </div>

              {/* Image upload */}
              <CloudinaryUpload
                label="Image *"
                currentUrl={modal.data.imageUrl}
                aspectHint="Any aspect ratio works. Landscape images look best in the slideshow."
                onUpload={(r: CloudinaryUploadResult) =>
                  setField("imageUrl", r.secure_url)
                }
              />

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-1">
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
                  {saving
                    ? "Saving..."
                    : modal.mode === "add"
                      ? "Add Image"
                      : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageGallery;
