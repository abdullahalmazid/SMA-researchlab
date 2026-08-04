import React, { useCallback, useEffect, useRef, useState } from "react";
import { cld, downscaleImage, formatBytes } from "../cloudinary.ts";
import type { CloudinaryUploadResult } from "../types";
import AppIcon from "./AppIcon";

interface Props {
  onUpload: (result: CloudinaryUploadResult) => void;
  currentUrl?: string;
  label?: string;
  aspectHint?: string; // e.g. "16:9 recommended for banner"
  /** Longest edge kept after the browser-side resize. */
  maxEdge?: number;
}

const CLOUD_NAME = String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? "").trim();
const UPLOAD_PRESET = String(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? "").trim(); // unsigned preset

/** Above this we refuse before decoding — a 50 MB file will hang a phone. */
const HARD_LIMIT = 25_000_000;

const CloudinaryUpload: React.FC<Props> = ({
  onUpload,
  currentUrl,
  label = "Upload Image",
  aspectHint,
  maxEdge = 1600,
}) => {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string>(currentUrl ?? "");
  const [urlInput, setUrlInput] = useState("");
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [error, setError] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  /* The preview was seeded from currentUrl once and never again, so a parent
     that reset or reloaded its form kept showing the old image. */
  useEffect(() => {
    setPreview(currentUrl ?? "");
  }, [currentUrl]);

  const uploadFile = useCallback(
    async (input: File) => {
      if (!input.type.startsWith("image/")) {
        setError("Please upload an image file.");
        return;
      }
      if (input.size > HARD_LIMIT) {
        setError(`That file is ${formatBytes(input.size)}. Please use one under 25 MB.`);
        return;
      }

      setUploading(true);
      setError("");
      setSavedNote("");

      /* Missing env vars produced an opaque Cloudinary error. On Vercel these
         have to be set in the project settings, not just in a local .env. */
      if (!CLOUD_NAME || !UPLOAD_PRESET) {
        setError("Image uploads aren't configured — the Cloudinary environment variables are missing.");
        setUploading(false);
        return;
      }

      try {
        /* Resize before sending. The preset is unsigned, so an incoming
           transformation can't be passed from here — without this the full
           original is what gets stored and later delivered. */
        const file = await downscaleImage(input, maxEdge);

        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", UPLOAD_PRESET);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          { method: "POST", body: fd },
        );
        const data: CloudinaryUploadResult = await res.json();
        if (!res.ok || !data.secure_url) throw new Error("Cloudinary rejected the upload.");

        setPreview(data.secure_url);
        if (file.size < input.size) {
          setSavedNote(`Resized ${formatBytes(input.size)} → ${formatBytes(file.size)}`);
        }
        onUpload(data);
      } catch {
        setError("Upload failed. Check your connection and try again.");
      } finally {
        setUploading(false);
      }
    },
    [onUpload, maxEdge],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void uploadFile(file);
    },
    [uploadFile],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
    /* Reset, or picking the same file twice in a row fires no change event. */
    e.target.value = "";
  };

  const applyUrl = () => {
    const value = urlInput.trim();
    if (!value) return;
    setPreview(value);
    onUpload({ secure_url: value, public_id: "", width: 0, height: 0 });
    setUrlInput("");
    setSavedNote("");
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px",
    border: "none",
    borderBottom: active ? "2px solid var(--color-primary)" : "2px solid transparent",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? "var(--color-primary)" : "#6b7280",
    background: "transparent",
  });

  return (
    <div>
      {label && (
        <label htmlFor="cloudinary-file" className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
        </label>
      )}
      {aspectHint && <p className="text-xs text-gray-400 mb-3">{aspectHint}</p>}

      {/* type="button" on every one of these. Without it they default to
          submit, and this widget renders inside the collaborator request
          <form> — so clicking a tab submitted the whole form. */}
      <div className="flex mb-3 border-b" style={{ borderColor: "#e5e7eb" }}>
        <button type="button" style={tabStyle(tab === "upload")} onClick={() => setTab("upload")}>
          Upload File
        </button>
        <button type="button" style={tabStyle(tab === "url")} onClick={() => setTab("url")}>
          Paste URL
        </button>
      </div>

      {tab === "upload" && (
        /* A real button, so it's reachable by keyboard. It was a <div> with an
           onClick, which a keyboard user can't trigger at all. */
        <button
          type="button"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-8 cursor-pointer transition-colors"
          style={{
            borderColor: dragging ? "var(--color-primary)" : "#d1d5db",
            background: dragging ? "#eff6ff" : "#f9fafb",
          }}
        >
          {uploading ? (
            <span className="flex flex-col items-center gap-2">
              <span
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
              />
              <span className="text-sm text-gray-500">Resizing and uploading…</span>
            </span>
          ) : (
            <>
              <span className="mb-2 text-gray-500">
                <AppIcon name="gallery" size={30} />
              </span>
              <span className="text-sm font-semibold text-gray-700">
                Drag &amp; drop or click to upload
              </span>
              <span className="text-xs text-gray-400 mt-1">
                PNG, JPG or WEBP. Large photos are shrunk to {maxEdge}px before upload.
              </span>
            </>
          )}
        </button>
      )}

      <input
        id="cloudinary-file"
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      {tab === "url" && (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyUrl();
              }
            }}
            placeholder="https://example.com/image.jpg"
            aria-label="Image URL"
            className="flex-1 text-sm px-3 py-2 rounded-lg border outline-none"
            style={{ borderColor: "#d1d5db", fontFamily: "var(--font-body)" }}
          />
          <button
            type="button"
            onClick={applyUrl}
            className="text-sm font-bold px-4 py-2 rounded-lg text-white"
            style={{ background: "var(--color-primary)", border: "none", cursor: "pointer" }}
          >
            Apply
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600 mt-2">
          {error}
        </p>
      )}
      {savedNote && <p className="text-xs text-emerald-700 mt-2">{savedNote}</p>}

      {preview && (
        <div className="mt-3">
          <p className="text-xs text-gray-400 mb-1">Preview:</p>
          {/* Transformed, like everywhere else — no reason for an admin form to
              pull the full-size original just to show a 160px thumbnail. */}
          <img
            src={cld(preview, "thumb")}
            alt=""
            loading="lazy"
            onError={() => setPreview("")}
            className="rounded-lg object-cover border"
            style={{ maxHeight: 160, maxWidth: "100%", borderColor: "#e5e7eb" }}
          />
        </div>
      )}
    </div>
  );
};

export default CloudinaryUpload;
