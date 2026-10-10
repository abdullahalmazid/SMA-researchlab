import { decryptBytes, encryptBytes } from "./crypto";
import type { ChatAttachment } from "./types";

const CLOUD_NAME = String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? "").trim();
const UPLOAD_PRESET = String(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? "").trim();

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const attachmentsAvailable = Boolean(CLOUD_NAME && UPLOAD_PRESET);

/**
 * Files are encrypted in the browser and uploaded as opaque bytes — Cloudinary
 * only ever stores ciphertext. The AES key travels inside the (already
 * end-to-end encrypted) message, so only the chat members can open the file.
 *
 * Uploaded as resource_type "raw". If the upload preset only allows images,
 * Cloudinary rejects this and the message explains what to change.
 */
export const uploadEncryptedFile = async (file: File): Promise<ChatAttachment> => {
  if (!attachmentsAvailable) throw new Error("File sharing isn't configured on this site.");
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("Files can be up to 15 MB.");

  const { cipher, keyB64, ivB64 } = await encryptBytes(await file.arrayBuffer());
  const body = new FormData();
  body.append("file", new Blob([cipher], { type: "application/octet-stream" }), "attachment.bin");
  body.append("upload_preset", UPLOAD_PRESET);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/raw/upload`, {
    method: "POST",
    body,
  });
  const result = (await response.json().catch(() => ({}))) as { secure_url?: string; error?: { message?: string } };
  if (!response.ok || !result.secure_url) {
    throw new Error(
      result.error?.message
        ? `Upload failed: ${result.error.message}. The Cloudinary upload preset must allow raw files.`
        : "Upload failed. Check your connection and try again.",
    );
  }

  return {
    url: result.secure_url,
    name: file.name.slice(0, 200),
    mime: file.type || "application/octet-stream",
    size: file.size,
    keyB64,
    ivB64,
  };
};

const objectUrlCache = new Map<string, Promise<string>>();

/** Downloads, decrypts and returns a blob: URL. Cached per attachment. */
export const openAttachment = (attachment: ChatAttachment) => {
  let pending = objectUrlCache.get(attachment.url);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(attachment.url);
      if (!response.ok) throw new Error("This file is no longer available.");
      const plain = await decryptBytes(await response.arrayBuffer(), attachment.keyB64, attachment.ivB64);
      return URL.createObjectURL(new Blob([plain], { type: attachment.mime }));
    })();
    pending.catch(() => objectUrlCache.delete(attachment.url));
    objectUrlCache.set(attachment.url, pending);
  }
  return pending;
};

export const isImageAttachment = (attachment: ChatAttachment) =>
  /^image\/(png|jpe?g|gif|webp|avif|bmp)$/i.test(attachment.mime);
