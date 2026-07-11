import { doc, updateDoc } from "firebase/firestore";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import AppIcon from "../components/AppIcon";
import EditableText from "../components/EditableText";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import { useGallery, useSiteContent } from "../firebase/hooks";
import type { GalleryItem } from "../types";

type FlipDirection = "next" | "prev";

type FlipState = {
  direction: FlipDirection;
  progress: number;
  settling: boolean;
  velocity: number;
};

const getGalleryYear = (item: GalleryItem) => {
  const parsed = new Date(item.createdAt);
  return Number.isNaN(parsed.getTime())
    ? new Date().getFullYear()
    : parsed.getFullYear();
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// Easing: ease-in-out for more natural page weight
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

const getGalleryPageItems = (gallery: GalleryItem[], pageIndex: number) => {
  const leftIndex = pageIndex * 2;
  const rightIndex = leftIndex + 1;
  return {
    leftItem: gallery[leftIndex] || null,
    rightItem: rightIndex < gallery.length ? gallery[rightIndex] : null,
  };
};

// ── Mobile breakpoint hook ─────────────────────────────────────────────
const useMobileBreakpoint = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);
  return isMobile;
};

// ── Lightbox Modal ─────────────────────────────────────────────────────
const LightboxModal: React.FC<{
  gallery: GalleryItem[];
  initialIndex: number;
  onClose: () => void;
}> = ({ gallery, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imgErr, setImgErr] = useState(false);
  const [visible, setVisible] = useState(false);
  const item = gallery[currentIndex];

  useEffect(() => {
    // Trigger entrance animation
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    setImgErr(false);
  }, [currentIndex]);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 250);
  }, [onClose]);

  const goNext = useCallback(() => {
    if (currentIndex < gallery.length - 1) setCurrentIndex((i) => i + 1);
  }, [currentIndex, gallery.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }, [currentIndex]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [close, goNext, goPrev]);

  const year = item ? String(getGalleryYear(item)) : "";

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-5"
      style={{
        zIndex: 2147483000,
        width: "100vw",
        height: "100dvh",
        background: `rgba(5, 10, 20, ${visible ? 0.92 : 0})`,
        backdropFilter: visible ? "blur(12px)" : "blur(0px)",
        transition: "background 0.25s ease, backdrop-filter 0.25s ease",
      }}
      onClick={close}
    >
      {/* Close button — top right, always visible */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
        className="fixed z-[2] flex items-center justify-center rounded-full text-white transition-all"
        style={{
          top: "max(1rem, env(safe-area-inset-top))",
          right: "max(1rem, env(safe-area-inset-right))",
          width: 44,
          height: 44,
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.2)",
          backdropFilter: "blur(8px)",
          fontSize: 20,
          lineHeight: 1,
          cursor: "pointer",
        }}
        aria-label="Close"
      >
        ✕
      </button>

      {/* Prev / Next arrows */}
      {currentIndex > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="fixed left-4 top-1/2 z-60 flex items-center justify-center rounded-full text-white transition-all"
          style={{
            width: 44,
            height: 44,
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.2)",
            backdropFilter: "blur(8px)",
            cursor: "pointer",
          }}
          aria-label="Previous"
        >
          <AppIcon name="back" size={18} />
        </button>
      )}
      {currentIndex < gallery.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="fixed right-4 top-1/2 z-60 flex items-center justify-center rounded-full text-white transition-all"
          style={{
            width: 44,
            height: 44,
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.2)",
            backdropFilter: "blur(8px)",
            cursor: "pointer",
          }}
          aria-label="Next"
        >
          <AppIcon
            name="back"
            size={18}
            style={{ transform: "rotate(180deg)" }}
          />
        </button>
      )}

      {/* Main card */}
      <div
        className="relative mx-4 flex flex-col overflow-hidden rounded-3xl"
        style={{
          maxWidth: "min(90vw, 860px)",
          maxHeight: "calc(100dvh - 1.5rem)",
          width: "100%",
          background: "#0f172a",
          boxShadow: "0 40px 80px rgba(0,0,0,0.7)",
          transform: visible
            ? "scale(1) translateY(0)"
            : "scale(0.93) translateY(24px)",
          opacity: visible ? 1 : 0,
          transition:
            "transform 0.28s cubic-bezier(0.34, 1.36, 0.64, 1), opacity 0.25s ease",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image area */}
        <div className="relative min-h-0 overflow-hidden" style={{ maxHeight: "calc(100dvh - 12rem)" }}>
          {imgErr ? (
            <div
              className="flex flex-col items-center justify-center text-gray-500"
              style={{ height: 320, background: "#1e293b" }}
            >
              <AppIcon name="gallery" size={40} />
              <p className="mt-3 text-sm">Image unavailable</p>
            </div>
          ) : (
            <img
              src={item?.imageUrl}
              alt={item?.title}
              onError={() => setImgErr(true)}
              className="w-full object-contain"
              style={{ display: "block", maxHeight: "calc(100dvh - 12rem)" }}
              draggable={false}
            />
          )}
          {/* Gradient overlay at bottom of image */}
          <div
            className="absolute bottom-0 left-0 right-0 pointer-events-none"
            style={{
              height: 80,
              background: "linear-gradient(to bottom, transparent, #0f172a)",
            }}
          />
        </div>

        {/* Detail panel */}
        <div className="px-6 pb-6 pt-4" style={{ background: "#0f172a" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-bold uppercase tracking-[0.22em] mb-1"
                style={{ color: "rgba(148,163,184,0.8)" }}
              >
                {year}
              </p>
              <h2
                className="font-black text-white leading-tight"
                style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)" }}
              >
                {item?.title}
              </h2>
              {item?.description && (
                <p
                  className="mt-2 leading-relaxed"
                  style={{ color: "rgba(148,163,184,0.85)", fontSize: 14 }}
                >
                  {item.description}
                </p>
              )}
              <p
                className="mt-3 text-xs"
                style={{ color: "rgba(100,116,139,0.9)" }}
              >
                Uploaded by {item?.uploaderName || "Lab team"}
              </p>
            </div>
            {/* Counter pill */}
            <div
              className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: "rgba(255,255,255,0.07)",
                color: "rgba(148,163,184,0.9)",
                border: "1px solid rgba(255,255,255,0.1)",
                whiteSpace: "nowrap",
              }}
            >
              {currentIndex + 1} / {gallery.length}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ── Main Gallery Component ─────────────────────────────────────────────
const Gallery: React.FC = () => {
  const { gallery, loading } = useGallery();
  const { content } = useSiteContent();
  const [viewMode, setViewMode] = useState<"gallery" | "album">("gallery");
  const [albumPage, setAlbumPage] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(gallery.length / 2));
  const albumIndex = clamp(albumPage, 0, totalPages - 1);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (viewMode !== "album") return;
      if (e.key === "Escape") setViewMode("gallery");
      if (e.key === "ArrowRight")
        setAlbumPage((v) => Math.min(v + 1, totalPages - 1));
      if (e.key === "ArrowLeft") setAlbumPage((v) => Math.max(v - 1, 0));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [viewMode, totalPages]);

  const galleryStats = useMemo(() => {
    const years = gallery.map((item) => getGalleryYear(item));
    const uniqueYears = new Set(years);
    return {
      total: gallery.length,
      years: uniqueYears.size,
      latestYear: years.length ? Math.max(...years) : new Date().getFullYear(),
    };
  }, [gallery]);

  return (
    <div>
      {/* Lightbox */}
      {lightboxIndex !== null && (
        <LightboxModal
          gallery={gallery}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* ── Hero ── */}
      <section
        className="relative min-h-[320px] overflow-hidden py-20 text-center px-4 flex items-center justify-center"
        style={{ background: "var(--color-primary)" }}
      >
        {content["gallery.bannerUrl"] && (
          <img
            src={content["gallery.bannerUrl"]}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: "brightness(0.45)" }}
          />
        )}
        <div className="relative z-10">
          <div
            className="font-black text-white mb-4"
            style={{
              fontSize: "clamp(2rem,4vw,3rem)",
              fontFamily: "var(--font-heading)",
            }}
          >
            <EditableText
              id="gallery.pageTitle"
              defaultValue={content["gallery.pageTitle"] ?? "Gallery"}
              className="font-black text-white"
              aria-label="Edit gallery page title"
            />
          </div>
          <div
            className="text-base max-w-xl mx-auto"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            <EditableText
              id="gallery.pageSubtitle"
              defaultValue={
                content["gallery.pageSubtitle"] ??
                "Moments, milestones, and memories from the lab."
              }
              className="text-base"
              aria-label="Edit gallery page subtitle"
            />
          </div>
        </div>
      </section>

      {/* ── Gallery / Album Toggle ── */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          className="rounded-2xl border bg-white px-4 py-4 flex items-center gap-3"
          style={{
            borderColor: "#e5e7eb",
            boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
          }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "#f8fafc",
              color: "var(--color-primary)",
            }}
          >
            <AppIcon name="gallery" size={18} />
          </div>
          <div className="min-w-0">
            <EditableText
              id="gallery.stats.moments"
              defaultValue={content["gallery.stats.moments"] ?? "Moments"}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400"
              aria-label="Edit gallery moments label"
            />
            <p className="text-base font-black text-gray-900 truncate">
              {galleryStats.total}
            </p>
            <EditableText
              id="gallery.stats.momentsHint"
              defaultValue={
                content["gallery.stats.momentsHint"] ??
                "Published gallery items"
              }
              className="text-xs text-gray-500 truncate"
              aria-label="Edit gallery moments hint"
            />
          </div>
        </div>
        <div
          className="rounded-2xl border bg-white px-4 py-4 flex items-center gap-3"
          style={{
            borderColor: "#e5e7eb",
            boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
          }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "#f8fafc",
              color: "var(--color-primary)",
            }}
          >
            <AppIcon name="publications" size={18} />
          </div>
          <div className="min-w-0">
            <EditableText
              id="gallery.stats.archive"
              defaultValue={content["gallery.stats.archive"] ?? "Archive"}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400"
              aria-label="Edit gallery archive label"
            />
            <p className="text-base font-black text-gray-900 truncate">
              {galleryStats.years}
            </p>
            <EditableText
              id="gallery.stats.archiveHint"
              defaultValue={
                content["gallery.stats.archiveHint"] ??
                `Latest year ${galleryStats.latestYear}`
              }
              className="text-xs text-gray-500 truncate"
              aria-label="Edit gallery archive hint"
            />
          </div>
        </div>
        <div
          className="rounded-2xl border bg-white px-4 py-4 flex items-center gap-3"
          style={{
            borderColor: "#e5e7eb",
            boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
          }}
        >
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: "#f8fafc",
              color: "var(--color-primary)",
            }}
          >
            <AppIcon name="message" size={18} />
          </div>
          <div className="min-w-0">
            <EditableText
              id="gallery.stats.view"
              defaultValue={content["gallery.stats.view"] ?? "View"}
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400"
              aria-label="Edit gallery view label"
            />
            <p className="text-base font-black text-gray-900 truncate">
              {viewMode === "album"
                ? (content["gallery.stats.albumBook"] ?? "Album Book")
                : (content["gallery.stats.galleryGrid"] ?? "Gallery Grid")}
            </p>
            <EditableText
              id="gallery.stats.viewHint"
              defaultValue={
                content["gallery.stats.viewHint"] ??
                (viewMode === "album"
                  ? "Swipe pages like a book"
                  : "Click images to open")
              }
              className="text-xs text-gray-500 truncate"
              aria-label="Edit gallery view hint"
            />
          </div>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setViewMode("gallery")}
          className="rounded-full px-4 py-2 text-sm font-semibold transition-all"
          style={{
            background:
              viewMode === "gallery" ? "var(--color-primary)" : "white",
            color: viewMode === "gallery" ? "white" : "#334155",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
          }}
        >
          <EditableText
            id="gallery.toggle.galleryGrid"
            defaultValue={
              content["gallery.toggle.galleryGrid"] ?? "Gallery Grid"
            }
            className="text-sm font-semibold"
            aria-label="Edit gallery grid toggle label"
          />
        </button>
        <button
          type="button"
          onClick={() => setViewMode("album")}
          className="rounded-full px-4 py-2 text-sm font-semibold transition-all"
          style={{
            background: viewMode === "album" ? "var(--color-primary)" : "white",
            color: viewMode === "album" ? "white" : "#334155",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
          }}
        >
          <EditableText
            id="gallery.toggle.albumBook"
            defaultValue={content["gallery.toggle.albumBook"] ?? "Album Book"}
            className="text-sm font-semibold"
            aria-label="Edit album book toggle label"
          />
        </button>
        <EditableText
          id="gallery.toggle.hint"
          defaultValue={
            content["gallery.toggle.hint"] ??
            (viewMode === "album"
              ? "Drag the page or swipe to flip through the album."
              : "Click any image to open it in full detail.")
          }
          className="text-sm text-gray-500"
          aria-label="Edit gallery toggle hint"
        />
      </div>

      {loading ? (
        <div className="py-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-2xl overflow-hidden border animate-pulse"
                style={{ borderColor: "#e5e7eb", background: "#fafafa" }}
              >
                <div className="h-56 bg-gradient-to-br from-gray-200 to-gray-100" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-2/3 rounded bg-gray-200" />
                  <div className="h-3 w-1/2 rounded bg-gray-200" />
                  <div className="h-3 w-full rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : gallery.length === 0 ? (
        <div
          className="text-center py-24 rounded-3xl border"
          style={{
            borderColor: "#e5e7eb",
            background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
          }}
        >
          <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-2xl text-gray-400 bg-white shadow-sm">
            <AppIcon name="gallery" size={30} />
          </div>
          <p className="text-gray-900 text-lg font-black">
            No gallery items yet.
          </p>
          <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
            This space will fill with lab milestones, events, and shared moments
            as soon as images are added.
          </p>
        </div>
      ) : viewMode === "gallery" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch transition-all duration-300 ease-out">
          {gallery.map((item, idx) => (
            <GalleryCard
              key={item.id}
              item={item}
              priority={idx < 2}
              onClick={() => setLightboxIndex(idx)}
            />
          ))}
        </div>
      ) : (
        <AlbumBookView
          gallery={gallery}
          pageIndex={albumIndex}
          onPrev={() => setAlbumPage((v) => Math.max(v - 1, 0))}
          onNext={() => setAlbumPage((v) => Math.min(v + 1, totalPages - 1))}
        />
      )}
    </div>
  );
};

// ── Gallery Card ───────────────────────────────────────────────
const GalleryCard: React.FC<{
  item: GalleryItem;
  onClick?: () => void;
  priority?: boolean;
}> = ({ item, onClick, priority = false }) => {
  const [imgErr, setImgErr] = useState(false);
  const [hovered, setHovered] = useState(false);
  const itemYear = getGalleryYear(item);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative h-full overflow-hidden rounded-2xl border bg-white cursor-pointer"
      style={{
        borderColor: "#e5e7eb",
        boxShadow: hovered
          ? "0 8px 32px rgba(15,23,42,0.13)"
          : "0 1px 8px rgba(15,23,42,0.05)",
        transition:
          "box-shadow 0.22s ease, border-color 0.22s ease, transform 0.22s ease",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <div className="relative overflow-hidden bg-white aspect-[4/3]">
        {imgErr ? (
          <div
            className="flex h-full flex-col items-center justify-center text-gray-400 text-sm font-medium"
            style={{ background: "#fafafa" }}
          >
            <AppIcon name="gallery" size={22} />
            <span className="mt-2">Image unavailable</span>
          </div>
        ) : (
          <img
            src={item.imageUrl}
            alt={item.title}
            onError={() => setImgErr(true)}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover bg-slate-100 transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        )}
        {/* Hover zoom icon overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            opacity: hovered ? 1 : 0,
            transition: "opacity 0.2s ease",
            background: "rgba(0,0,0,0.18)",
          }}
        >
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(6px)",
              transform: hovered ? "scale(1)" : "scale(0.7)",
              transition: "transform 0.22s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            {/* Simple expand icon */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M3 3h5M3 3v5M17 3h-5M17 3v5M3 17h5M3 17v-5M17 17h-5M17 17v-5"
                stroke="#0f172a"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Caption below image — always visible */}
      <div className="p-4 border-t" style={{ borderColor: "#f1f5f9" }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400 mb-1">
          {itemYear}
        </p>
        <p>
          <EditableText
            id={`gallery.title.${item.id}`}
            defaultValue={item.title}
            onSave={async (val: string) => {
              if (val !== item.title) {
                await updateDoc(doc(db, "gallery", item.id), { title: val });
              }
            }}
            className="text-gray-900 font-black text-sm leading-snug line-clamp-1 mt-1"
            // canEdit removed; editability handled internally
            aria-label="Edit gallery item title"
          />
        </p>

        <EditableText
          id={`gallery.description.${item.id}`}
          defaultValue={item.description || ""}
          onSave={async (val: string) => {
            if (val !== item.description) {
              await updateDoc(doc(db, "gallery", item.id), {
                description: val,
              });
            }
          }}
          className="text-gray-600 text-xs leading-relaxed mt-2 line-clamp-2"
          // canEdit removed; editability handled internally
          aria-label="Edit gallery item description"
        />
        <p className="mt-2 text-[11px] text-gray-400">
          {item.uploaderName || "Lab team"}
        </p>
      </div>
    </div>
  );
};

// ── Album Book View ────────────────────────────────────────────────────
const AlbumBookView: React.FC<{
  gallery: GalleryItem[];
  pageIndex: number;
  onPrev: () => void;
  onNext: () => void;
}> = ({ gallery, pageIndex, onPrev, onNext }) => {
  const isMobile = useMobileBreakpoint();
  const totalPages = Math.ceil(gallery.length / 2);

  if (isMobile) {
    return (
      <MobileAlbumView
        gallery={gallery}
        pageIndex={pageIndex}
        totalPages={totalPages}
        onPrev={onPrev}
        onNext={onNext}
      />
    );
  }

  return (
    <DesktopAlbumView
      gallery={gallery}
      pageIndex={pageIndex}
      totalPages={totalPages}
      onPrev={onPrev}
      onNext={onNext}
    />
  );
};

// ── Mobile Album: one page at a time with swipe ────────────────────────
const MobileAlbumView: React.FC<{
  gallery: GalleryItem[];
  pageIndex: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}> = ({ gallery, pageIndex, totalPages, onPrev, onNext }) => {
  const isFirst = pageIndex === 0;
  const { role } = useAuth();
  const isLast = pageIndex === totalPages - 1;
  const spread = getGalleryPageItems(gallery, pageIndex);

  // Show left page first, then right. Two sub-pages per spread on mobile.
  const [subPage, setSubPage] = useState<"left" | "right">("left");
  const item = subPage === "left" ? spread.leftItem : spread.rightItem;

  // Reset sub-page on spread change
  useEffect(() => {
    setSubPage("left");
  }, [pageIndex]);

  const touchRef = useRef<{ startX: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const canGoBack = pageIndex > 0 || subPage === "right";
  const canGoForward =
    !isLast || (subPage === "left" && spread.rightItem !== null);

  const goBack = () => {
    if (subPage === "right") {
      setSubPage("left");
    } else {
      onPrev();
      setSubPage("right");
    }
  };

  const goForward = () => {
    if (subPage === "left" && spread.rightItem) {
      setSubPage("right");
    } else {
      onNext();
      setSubPage("left");
    }
  };

  const [imgErr, setImgErr] = useState(false);
  useEffect(() => setImgErr(false), [item?.id]);

  const getYear = (i: GalleryItem | null) => {
    if (!i) return "";
    const p = new Date(i.createdAt);
    return Number.isNaN(p.getTime())
      ? String(new Date().getFullYear())
      : String(p.getFullYear());
  };

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-[#f8fafc] p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
            Album Book
          </p>
          <p className="text-xs text-gray-400">Swipe to flip pages</p>
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
          Page {pageIndex * 2 + (subPage === "right" ? 2 : 1)} /{" "}
          {gallery.length}
        </div>
      </div>

      {/* Single page card */}
      <div
        className="relative rounded-2xl overflow-hidden bg-white shadow-xl"
        style={{
          minHeight: 440,
          border: "1px solid #e5e7eb",
          transform: `translateX(${swipeOffset}px)`,
          transition: swiping ? "none" : "transform 0.22s ease",
        }}
        onTouchStart={(e) => {
          touchRef.current = { startX: e.touches[0].clientX };
          setSwiping(true);
        }}
        onTouchMove={(e) => {
          if (!touchRef.current) return;
          const dx = e.touches[0].clientX - touchRef.current.startX;
          setSwipeOffset(clamp(dx, -120, 120));
        }}
        onTouchEnd={() => {
          setSwiping(false);
          if (swipeOffset < -50 && canGoForward) goForward();
          else if (swipeOffset > 50 && canGoBack) goBack();
          setSwipeOffset(0);
          touchRef.current = null;
        }}
      >
        {item ? (
          <>
            <div className="relative overflow-hidden" style={{ height: 300 }}>
              {imgErr ? (
                <div
                  className="flex flex-col items-center justify-center text-gray-300 h-full"
                  style={{ background: "#f3f4f6" }}
                >
                  <AppIcon name="gallery" size={32} />
                  <span className="mt-2 text-sm font-medium">
                    Image unavailable
                  </span>
                </div>
              ) : (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  onError={() => setImgErr(true)}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              )}
            </div>
            <div className="p-5 border-t" style={{ borderColor: "#e5e7eb" }}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                {getYear(item)}
              </p>
              <EditableText
                id={`gallery.title.${item.id}`}
                defaultValue={item.title}
                onSave={async (val: string) => {
                  if (val !== item.title) {
                    await updateDoc(doc(db, "gallery", item.id), {
                      title: val,
                    });
                  }
                }}
                className="text-gray-900 font-black text-base leading-snug mt-1"
                // canEdit removed; editability handled internally
                aria-label="Edit gallery item title"
              />
              <EditableText
                id={`gallery.description.${item.id}`}
                defaultValue={item.description || ""}
                onSave={async (val: string) => {
                  if (val !== item.description) {
                    await updateDoc(doc(db, "gallery", item.id), {
                      description: val,
                    });
                  }
                }}
                className="text-gray-600 text-sm leading-relaxed mt-2"
                // canEdit removed; editability handled internally
                aria-label="Edit gallery item description"
              />
            </div>
          </>
        ) : (
          <div
            className="flex items-center justify-center text-gray-300"
            style={{ height: 440, background: "#f8fafc" }}
          >
            <AppIcon name="gallery" size={48} />
          </div>
        )}

        {/* Swipe hint edges */}
        {swipeOffset > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 pointer-events-none"
            style={{
              width: 40,
              background:
                "linear-gradient(to right, rgba(var(--color-primary-rgb),0.12), transparent)",
            }}
          />
        )}
        {swipeOffset < 0 && (
          <div
            className="absolute right-0 top-0 bottom-0 pointer-events-none"
            style={{
              width: 40,
              background:
                "linear-gradient(to left, rgba(var(--color-primary-rgb),0.12), transparent)",
            }}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={!canGoBack}
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-30 shadow-sm"
          style={{
            borderColor: "#e5e7eb",
            background: "white",
            color: "#334155",
          }}
        >
          <AppIcon name="back" size={16} />
          Previous
        </button>
        <button
          type="button"
          onClick={goForward}
          disabled={!canGoForward}
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-30 shadow-sm"
          style={{
            borderColor: "#e5e7eb",
            background: "white",
            color: "#334155",
          }}
        >
          Next
          <AppIcon
            name="back"
            size={16}
            style={{ transform: "rotate(180deg)" }}
          />
        </button>
      </div>
    </div>
  );
};

// ── Desktop Album: full two-page 3D flip ──────────────────────────────
const DesktopAlbumView: React.FC<{
  gallery: GalleryItem[];
  pageIndex: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}> = ({ gallery, pageIndex, totalPages, onPrev, onNext }) => {
  const currentSpread = getGalleryPageItems(gallery, pageIndex);
  const previousSpread = getGalleryPageItems(gallery, pageIndex - 1);
  const nextSpread = getGalleryPageItems(gallery, pageIndex + 1);

  const [flipState, setFlipState] = useState<FlipState | null>(null);
  const bookRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<{
    pointerId: number;
    direction: FlipDirection;
    startX: number;
    width: number;
    progress: number;
    lastX: number;
    lastTime: number;
    velocity: number;
  } | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setFlipState(null);
    gestureRef.current = null;
    if (settleTimerRef.current !== null)
      window.clearTimeout(settleTimerRef.current);
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, [pageIndex]);

  useEffect(() => {
    return () => {
      if (settleTimerRef.current !== null)
        window.clearTimeout(settleTimerRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const isFirst = pageIndex === 0;
  const isLast = pageIndex === totalPages - 1;

  const dragProgress = flipState?.progress ?? 0;
  // Apply easing to the visual progress for more natural weight
  const easedProgress = easeInOut(dragProgress);
  const activeDirection = flipState?.direction ?? null;
  const isNext = activeDirection === "next";
  const isPrev = activeDirection === "prev";

  const staticLeftItem = isPrev
    ? previousSpread.leftItem
    : currentSpread.leftItem;
  const staticRightItem = isNext
    ? nextSpread.rightItem
    : currentSpread.rightItem;
  const flipFrontItem = isNext
    ? currentSpread.rightItem
    : currentSpread.leftItem;
  const flipBackItem = isNext ? nextSpread.leftItem : previousSpread.rightItem;

  const getYear = (item: GalleryItem | null) => {
    if (!item) return "";
    const parsed = new Date(item.createdAt);
    return Number.isNaN(parsed.getTime())
      ? String(new Date().getFullYear())
      : String(parsed.getFullYear());
  };

  // Shadow fan spread angle based on flip progress
  const shadowOpacity = easedProgress * 0.28;
  const shadowBlur = 8 + easedProgress * 40;
  const shadowSpread = easedProgress * 20;

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-[#f8fafc] p-4 sm:p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] transition-all duration-300 ease-out">
      {/* View Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
            Album Book
          </p>
          <p className="text-sm text-gray-500">Drag on either page to flip.</p>
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
          Page {pageIndex + 1} / {totalPages}
        </div>
      </div>

      {/* Book Container */}
      <div
        ref={bookRef}
        className="relative flex items-center justify-center w-full max-w-5xl mx-auto rounded-3xl"
        style={{
          minHeight: "min(72vh, 680px)",
          perspective: "2800px",
          perspectiveOrigin: "50% 45%",
          touchAction: "pan-y",
          userSelect: "none",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          if ((e.target as HTMLElement | null)?.closest("button")) return;
          if (!bookRef.current) return;

          const rect = bookRef.current.getBoundingClientRect();
          const localX = e.clientX - rect.left;
          const canFlipNext = pageIndex < totalPages - 1;
          const canFlipPrev = pageIndex > 0;

          const direction: FlipDirection | null =
            localX >= rect.width / 2
              ? canFlipNext
                ? "next"
                : null
              : canFlipPrev
                ? "prev"
                : null;

          if (!direction) return;

          gestureRef.current = {
            pointerId: e.pointerId,
            direction,
            startX: e.clientX,
            width: rect.width,
            progress: 0,
            lastX: e.clientX,
            lastTime: performance.now(),
            velocity: 0,
          };
          setFlipState({
            direction,
            progress: 0,
            settling: false,
            velocity: 0,
          });

          if (!bookRef.current.hasPointerCapture(e.pointerId)) {
            bookRef.current.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          const gesture = gestureRef.current;
          if (!gesture || gesture.pointerId !== e.pointerId) return;

          const now = performance.now();
          const dt = now - gesture.lastTime;
          const dx = e.clientX - gesture.lastX;
          // Velocity in progress units per ms
          const rawVelocity = dt > 0 ? dx / (gesture.width / 2) / dt : 0;
          gesture.velocity = gesture.velocity * 0.7 + rawVelocity * 0.3;
          gesture.lastX = e.clientX;
          gesture.lastTime = now;

          const rawProgress =
            gesture.direction === "next"
              ? (gesture.startX - e.clientX) / (gesture.width / 2)
              : (e.clientX - gesture.startX) / (gesture.width / 2);

          const progress = clamp(rawProgress, 0, 1);
          gesture.progress = progress;

          if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(() => {
            setFlipState({
              direction: gesture.direction,
              progress,
              settling: false,
              velocity: gesture.velocity,
            });
            rafRef.current = null;
          });
        }}
        onPointerUp={(e) => {
          const gesture = gestureRef.current;
          if (!gesture || gesture.pointerId !== e.pointerId) return;

          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
          }

          // Velocity-aware commit: fast flick commits even below threshold
          const velocityCommit =
            gesture.direction === "next"
              ? gesture.velocity < -0.003
              : gesture.velocity > 0.003;
          const shouldCommit = gesture.progress > 0.38 || velocityCommit;

          setFlipState({
            direction: gesture.direction,
            progress: shouldCommit ? 1 : 0,
            settling: true,
            velocity: gesture.velocity,
          });

          if (settleTimerRef.current !== null)
            window.clearTimeout(settleTimerRef.current);

          settleTimerRef.current = window.setTimeout(() => {
            if (shouldCommit) {
              if (gesture.direction === "next") onNext();
              else onPrev();
            } else {
              setFlipState(null);
            }
            gestureRef.current = null;
            settleTimerRef.current = null;
          }, 380);

          if (bookRef.current?.hasPointerCapture(e.pointerId)) {
            bookRef.current.releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={(e) => {
          const gesture = gestureRef.current;
          if (!gesture || gesture.pointerId !== e.pointerId) return;
          if (settleTimerRef.current !== null)
            window.clearTimeout(settleTimerRef.current);
          if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
          gestureRef.current = null;
          setFlipState(null);
          if (bookRef.current?.hasPointerCapture(e.pointerId)) {
            bookRef.current.releasePointerCapture(e.pointerId);
          }
        }}
      >
        <div
          className="absolute inset-0 bg-white rounded-3xl overflow-hidden flex"
          style={{
            boxShadow:
              "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.04)",
          }}
        >
          {/* Static Left Page */}
          <div className="absolute top-0 bottom-0 left-0 w-1/2 z-0">
            <BookPage side="left" item={staticLeftItem} getYear={getYear} />
            {/* Shadow cast by the turning page onto the resting page */}
            {isNext && (
              <div
                className="absolute inset-0 pointer-events-none rounded-l-3xl"
                style={{
                  background: `linear-gradient(to right, transparent 20%, rgba(0,0,0,${shadowOpacity}) 100%)`,
                  transition: "none",
                }}
              />
            )}
          </div>

          {/* Static Right Page */}
          <div className="absolute top-0 bottom-0 right-0 w-1/2 z-0">
            <BookPage side="right" item={staticRightItem} getYear={getYear} />
            {isPrev && (
              <div
                className="absolute inset-0 pointer-events-none rounded-r-3xl"
                style={{
                  background: `linear-gradient(to left, transparent 20%, rgba(0,0,0,${shadowOpacity}) 100%)`,
                }}
              />
            )}
          </div>

          {/* Spine shadow — deepens when a page lifts */}
          <div
            className="absolute top-0 bottom-0 z-10 pointer-events-none"
            style={{
              left: "calc(50% - 28px)",
              width: "56px",
              background: `linear-gradient(90deg,
                transparent 0%,
                rgba(0,0,0,${0.02 + easedProgress * 0.06}) 30%,
                rgba(0,0,0,${0.12 + easedProgress * 0.1}) 50%,
                rgba(0,0,0,${0.02 + easedProgress * 0.06}) 70%,
                transparent 100%)`,
            }}
          />

          {/* The Turning Page */}
          {activeDirection && (
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none"
              style={{
                width: "50%",
                left: isNext ? "50%" : "0",
                transformOrigin: isNext ? "left center" : "right center",
                transform: `rotateY(${isNext ? -180 * easedProgress : 180 * easedProgress}deg)`,
                transformStyle: "preserve-3d",
                WebkitTransformStyle: "preserve-3d",
                transition: flipState?.settling
                  ? "transform 0.38s cubic-bezier(0.22, 0.9, 0.36, 1)"
                  : "none",
              }}
            >
              {/* Front face */}
              <div
                className="absolute inset-0"
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                }}
              >
                <BookPage
                  side={isNext ? "right" : "left"}
                  item={flipFrontItem}
                  getYear={getYear}
                />

                {/* Darkening shadow as it lifts */}
                <div
                  className={`absolute inset-0 pointer-events-none ${isNext ? "rounded-r-3xl" : "rounded-l-3xl"}`}
                  style={{
                    background: isNext
                      ? `linear-gradient(to left, transparent 0%, rgba(0,0,0,${easedProgress * 0.25}) 100%)`
                      : `linear-gradient(to right, transparent 0%, rgba(0,0,0,${easedProgress * 0.25}) 100%)`,
                  }}
                />

                {/* Sweep highlight — light catching the page surface */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: isNext
                      ? `linear-gradient(${105 + easedProgress * 30}deg, transparent 30%, rgba(255,255,255,${0.04 + easedProgress * 0.12}) 50%, transparent 70%)`
                      : `linear-gradient(${75 - easedProgress * 30}deg, transparent 30%, rgba(255,255,255,${0.04 + easedProgress * 0.12}) 50%, transparent 70%)`,
                  }}
                />
              </div>

              {/* Back face */}
              <div
                className="absolute inset-0"
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
              >
                <BookPage
                  side={isNext ? "left" : "right"}
                  item={flipBackItem}
                  getYear={getYear}
                />

                {/* Back face tint — paper reverse is slightly warmer */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "rgba(255,248,230,0.06)" }}
                />

                <div
                  className={`absolute inset-0 pointer-events-none ${isNext ? "rounded-l-3xl" : "rounded-r-3xl"}`}
                  style={{
                    background: isNext
                      ? `linear-gradient(to right, rgba(0,0,0,${(1 - easedProgress) * 0.2}) 0%, transparent 60%)`
                      : `linear-gradient(to left, rgba(0,0,0,${(1 - easedProgress) * 0.2}) 0%, transparent 60%)`,
                  }}
                />

                {/* Back highlight sweep */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: `linear-gradient(${isNext ? 260 : 100}deg, transparent 30%, rgba(255,255,255,${(1 - easedProgress) * 0.1}) 50%, transparent 70%)`,
                  }}
                />
              </div>

              {/* Page edge "thickness" strip — visible at mid-flip */}
              <div
                className="absolute pointer-events-none"
                style={{
                  top: 0,
                  bottom: 0,
                  width: `${Math.round(Math.sin(easedProgress * Math.PI) * 6)}px`,
                  [isNext ? "left" : "right"]: 0,
                  background:
                    "linear-gradient(180deg, #e2e8f0, #f1f5f9, #e2e8f0)",
                  opacity: Math.sin(easedProgress * Math.PI),
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={isFirst}
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-30 shadow-sm"
          style={{
            borderColor: "#e5e7eb",
            background: "white",
            color: "#334155",
          }}
        >
          <AppIcon name="back" size={16} />
          Previous page
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isLast}
          className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-30 shadow-sm"
          style={{
            borderColor: "#e5e7eb",
            background: "white",
            color: "#334155",
          }}
        >
          Next page
          <AppIcon
            name="back"
            size={16}
            style={{ transform: "rotate(180deg)" }}
          />
        </button>
      </div>
    </div>
  );
};

// ── Shared BookPage ────────────────────────────────────────────────────
const BookPage: React.FC<{
  side: "left" | "right";
  item: GalleryItem | null;
  getYear: (item: GalleryItem | null) => string;
}> = ({ side, item, getYear }) => {
  const isLeft = side === "left";
  const { role } = useAuth();
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    setImgErr(false);
  }, [item?.id]);

  return (
    <div
      className="flex flex-col h-full bg-white relative overflow-hidden"
      style={{ borderRadius: isLeft ? "24px 0 0 24px" : "0 24px 24px 0" }}
    >
      {item ? (
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-hidden relative">
            {imgErr ? (
              <div
                className="flex flex-col items-center justify-center text-gray-300 h-full"
                style={{ background: "#f3f4f6" }}
              >
                <AppIcon name="gallery" size={32} />
                <span className="mt-2 text-sm font-medium">
                  Image unavailable
                </span>
              </div>
            ) : (
              <img
                src={item.imageUrl}
                alt={item.title}
                onError={() => setImgErr(true)}
                className="absolute inset-0 w-full h-full object-cover"
                draggable={false}
              />
            )}
          </div>
          <div
            className="p-5 border-t"
            style={{ borderColor: "#e5e7eb", background: "white" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">
              {getYear(item)}
            </p>
            <p className="text-gray-900 font-black text-sm leading-snug line-clamp-1">
              {item.title}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-gray-500 line-clamp-2">
              {item.description || "No description provided."}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center justify-center h-full text-gray-300"
          style={{ background: "#f8fafc" }}
        >
          <AppIcon name="gallery" size={48} />
        </div>
      )}

      {/* Spine inner highlight */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: isLeft
            ? "inset -6px 0 16px rgba(0,0,0,0.04)"
            : "inset 6px 0 16px rgba(0,0,0,0.04)",
        }}
      />
    </div>
  );
};

export default Gallery;
