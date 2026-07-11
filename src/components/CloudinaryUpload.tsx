import React, { useCallback, useRef, useState } from "react";
import type { CloudinaryUploadResult } from "../types";
import AppIcon from "./AppIcon";

interface Props {
  onUpload: (result: CloudinaryUploadResult) => void;
  currentUrl?: string;
  label?: string;
  aspectHint?: string; // e.g. "16:9 recommended for banner"
}

// AFTER (hardcoded)
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET; // unsigned preset // unsigned preset

const CloudinaryUpload: React.FC<Props> = ({
  onUpload,
  currentUrl,
  label = "Upload Image",
  aspectHint,
}) => {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string>(currentUrl ?? "");
  const [urlInput, setUrlInput] = useState("");
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file.");
        return;
      }
      setUploading(true);
      setError("");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      try {
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          {
            method: "POST",
            body: fd,
          },
        );
        const data: CloudinaryUploadResult = await res.json();
        if (!res.ok || !data.secure_url) throw new Error("Cloudinary rejected the upload.");
        setPreview(data.secure_url);
        onUpload(data);
      } catch {
        setError("Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [onUpload],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const applyUrl = () => {
    if (!urlInput.trim()) return;
    setPreview(urlInput.trim());
    onUpload({
      secure_url: urlInput.trim(),
      public_id: "",
      width: 0,
      height: 0,
    });
    setUrlInput("");
  };

  const tabStyle = (active: boolean) => ({
    padding: "6px 16px",
    border: "none",
    borderBottom: active
      ? "2px solid var(--color-primary)"
      : "2px solid transparent",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? "var(--color-primary)" : "#6b7280",
    background: "transparent",
  });

  return (
    <div>
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
        </label>
      )}
      {aspectHint && <p className="text-xs text-gray-400 mb-3">{aspectHint}</p>}

      {/* Tabs */}
      <div className="flex mb-3 border-b" style={{ borderColor: "#e5e7eb" }}>
        <button
          style={tabStyle(tab === "upload")}
          onClick={() => setTab("upload")}
        >
          Upload File
        </button>
        <button style={tabStyle(tab === "url")} onClick={() => setTab("url")}>
          Paste URL
        </button>
      </div>

      {tab === "upload" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-8 cursor-pointer transition-colors"
          style={{
            borderColor: dragging ? "var(--color-primary)" : "#d1d5db",
            background: dragging ? "#eff6ff" : "#f9fafb",
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{
                  borderColor: "var(--color-primary)",
                  borderTopColor: "transparent",
                }}
              />
              <p className="text-sm text-gray-500">
                Uploading to Cloudinary...
              </p>
            </div>
          ) : (
            <>
              <div className="mb-2 text-gray-500">
                <AppIcon name="gallery" size={30} />
              </div>
              <p className="text-sm font-semibold text-gray-700">
                Drag & drop or click to upload
              </p>
              <p className="text-xs text-gray-400 mt-1">
                PNG, JPG, WEBP supported
              </p>
            </>
          )}
        </div>
      )}

      {tab === "url" && (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="flex-1 text-sm px-3 py-2 rounded-lg border outline-none"
            style={{ borderColor: "#d1d5db", fontFamily: "var(--font-body)" }}
          />
          <button
            onClick={applyUrl}
            className="text-sm font-bold px-4 py-2 rounded-lg text-white"
            style={{
              background: "var(--color-primary)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Apply
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      {/* Preview */}
      {preview && (
        <div className="mt-3">
          <p className="text-xs text-gray-400 mb-1">Preview:</p>
          <img
            src={preview}
            alt="Preview"
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
