/**
 * Cloudinary delivery helper.
 *
 * Every image on the site is stored as `secure_url` — the untouched original.
 * A 4000px phone photo was being downloaded in full and then scaled to 200px by
 * CSS, which is where the bandwidth budget goes.
 *
 * Putting transformation parameters in the delivery path makes Cloudinary
 * resize and re-encode on its side and cache the result on the CDN. A 2.5 MB
 * original comes back as 20–40 KB.
 *
 * This lives in one file on purpose. A copy of it that drifts in one component
 * doesn't throw an error — it silently serves originals again, which is exactly
 * the bug being fixed here. If you'd rather inline it, it's six lines: copy
 * `cld` and the SIZES entry you need, and accept that risk.
 */

/**
 * A fixed set of widths. Each distinct transformation is generated once and
 * cached, but the cached copies also count toward storage — so a handful of
 * shared sizes costs less than every component inventing its own.
 */
export const SIZES = {
  /** Navbar and footer avatars, ~26–52px on screen. */
  avatar: "w_96,h_96,c_fill,g_face",
  /** Small previews and thumbnails. */
  thumb: "w_320,c_limit",
  /** The hero lab-head portrait, ~220px. */
  portrait: "w_440,h_440,c_fill,g_face",
  /** Collaborator card photos, 4:3. */
  card: "w_600,h_450,c_fill,g_face",
  /** Gallery slides and other large in-page images. */
  wide: "w_900,c_limit",
  /** Full-bleed page banners. */
  banner: "w_1920,c_limit",
} as const;

export type CloudinarySize = keyof typeof SIZES;

/** Cloudinary delivery URLs look like …/<cloud>/image/upload/<version>/<id>. */
const UPLOAD_MARKER = "/image/upload/";

/**
 * Returns a resized delivery URL, or the input untouched if it isn't a
 * Cloudinary URL — the upload widget has a "Paste URL" tab, so plenty of stored
 * images are hosted elsewhere.
 */
export function cld(url: string | undefined | null, size: CloudinarySize): string {
  const value = (url ?? "").trim();
  if (!value) return "";
  if (!value.includes("res.cloudinary.com") || !value.includes(UPLOAD_MARKER)) return value;

  const [prefix, rest] = value.split(UPLOAD_MARKER);
  if (!rest) return value;

  /* Already transformed — don't stack a second set of parameters on top. */
  if (/^[a-z]{1,3}_[^/]+\//.test(rest)) return value;

  /* f_auto picks WebP or AVIF per browser; q_auto picks the quality. */
  return `${prefix}${UPLOAD_MARKER}f_auto,q_auto,${SIZES[size]}/${rest}`;
}

/**
 * Shrinks an image in the browser before upload. Your preset is unsigned, and
 * unsigned uploads can't carry a transformation — so without this, the original
 * is what gets stored, and storage is charged on the same credit pool as
 * bandwidth. Set an incoming transformation on the preset as well if you want
 * a guarantee that doesn't depend on the client.
 *
 * Falls back to the original file whenever anything goes wrong: a failed resize
 * should never block someone from uploading their photo.
 */
export async function downscaleImage(
  file: File,
  maxEdge = 1600,
  quality = 0.85,
): Promise<File> {
  /* GIFs would lose their animation, SVGs are already tiny and vector. */
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (file.size < 300_000) return file;
  if (typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) {
      bitmap.close?.();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, quality),
    );
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], file.name, { type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** For the "2.4 MB → 180 KB" line in the upload widget. */
export const formatBytes = (bytes: number): string =>
  bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`;
