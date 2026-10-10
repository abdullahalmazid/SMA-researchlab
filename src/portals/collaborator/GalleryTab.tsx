import type { User as FirebaseUser } from "firebase/auth";
import { addDoc, collection, deleteDoc, doc } from "firebase/firestore";
import React, { useState } from "react";
import RowMenu from "../../admin/components/RowMenu";
import { useConfirm } from "../../admin/components/useConfirm";
import CloudinaryUpload from "../../components/CloudinaryUpload";
import SideDrawer from "../../components/SideDrawer";
import { db } from "../../firebase/config";
import type { CloudinaryUploadResult, GalleryItem } from "../../types";
import { Button, EmptyState, Field, Notice, Spinner, TabHeader, areaClass, buttonClass, fieldClass, formatDate } from "./ui";

const GalleryTab: React.FC<{
  firebaseUser: FirebaseUser | null;
  uploaderName: string;
  uploaderEmail: string;
  photos: GalleryItem[] | null;
  reload: () => Promise<void>;
}> = ({ firebaseUser, uploaderName, uploaderEmail, photos, reload }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", imageUrl: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { confirm, confirmElement } = useConfirm();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return setError("Give the photo a title.");
    if (!form.imageUrl.trim()) return setError("Upload an image first.");
    if (!firebaseUser) return setError("Your session expired. Please sign in again.");
    setSubmitting(true);
    setError("");
    try {
      await firebaseUser.getIdToken(true);
      const now = new Date().toISOString();
      await addDoc(collection(db, "gallery"), {
        title: form.title.trim(),
        description: form.description.trim(),
        imageUrl: form.imageUrl.trim(),
        uploaderUid: firebaseUser.uid,
        uploaderName,
        uploaderEmail,
        order: Date.now(),
        createdAt: now,
        updatedAt: now,
        isVisible: true,
        moderationStatus: "approved",
      });
      setForm({ title: "", description: "", imageUrl: "" });
      setOpen(false);
      setNotice("Photo published to the gallery.");
      await reload();
    } catch (err) {
      console.error("Gallery upload failed:", err);
      setError((err as { code?: string })?.code === "permission-denied" ? "Upload blocked by permissions. Please sign in again." : "Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (item: GalleryItem) => {
    const ok = await confirm({
      title: "Delete this photo?",
      message: `"${item.title}" will be removed from the lab gallery.`,
      confirmLabel: "Delete photo",
      danger: true,
    });
    if (!ok) return;
    await deleteDoc(doc(db, "gallery", item.id));
    setNotice("Photo deleted.");
    await reload();
  };

  return (
    <div className="pb-10">
      <TabHeader
        title="Gallery"
        description="Photos you've added to the lab gallery."
        action={
          <Button tone="primary" onClick={() => setOpen(true)}>
            + Upload photo
          </Button>
        }
      />

      {notice && (
        <div className="mb-3">
          <Notice tone="success" onDismiss={() => setNotice("")}>
            {notice}
          </Notice>
        </div>
      )}

      {photos === null ? (
        <Spinner label="Loading photos" />
      ) : photos.length === 0 ? (
        <EmptyState
          title="No photos yet"
          text="Share photos from events, fieldwork or the lab."
          action={
            <Button tone="primary" onClick={() => setOpen(true)}>
              + Upload photo
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {photos.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-xl border border-[color:var(--site-border)] bg-[color:var(--site-surface)]">
              <img src={item.imageUrl} alt={item.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-start gap-1 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-[12.5px] font-semibold text-[color:var(--site-heading)]" title={item.description || item.title}>
                    {item.title}
                  </p>
                  <p className="text-[11px] text-[color:var(--site-muted)]">{formatDate(item.createdAt)}</p>
                </div>
                <RowMenu
                  label={`Actions for ${item.title}`}
                  items={[
                    { label: "Open full size ↗", onClick: () => window.open(item.imageUrl, "_blank", "noopener") },
                    { label: "Delete photo…", danger: true, separated: true, onClick: () => void remove(item) },
                  ]}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <SideDrawer open={open} onClose={() => !submitting && setOpen(false)} eyebrow="Gallery" title="Upload a photo">
        <form onSubmit={submit} className="mx-auto max-w-2xl space-y-3 p-4 sm:p-6">
          <CloudinaryUpload
            label="Photo"
            currentUrl={form.imageUrl}
            aspectHint="JPG, PNG or WEBP — clear and relevant to the lab."
            onUpload={(result: CloudinaryUploadResult) => setForm((f) => ({ ...f, imageUrl: result.secure_url }))}
          />
          <Field label="Title" htmlFor="gl-title">
            <input
              id="gl-title"
              required
              className={fieldClass}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Robotics workshop 2026"
            />
          </Field>
          <Field label="Caption" htmlFor="gl-desc" hint="optional">
            <textarea
              id="gl-desc"
              rows={3}
              className={areaClass}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex justify-end gap-2 border-t border-[color:var(--site-border)] pt-3">
            <Button tone="quiet" disabled={submitting} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <button type="submit" disabled={submitting} className={buttonClass("primary")}>
              {submitting ? "Publishing…" : "Publish to gallery"}
            </button>
          </div>
        </form>
      </SideDrawer>

      {confirmElement}
    </div>
  );
};

export default GalleryTab;
