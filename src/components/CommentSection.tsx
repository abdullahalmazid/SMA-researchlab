import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  updateDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import { useComments } from "../firebase/hooks";
import type { Comment as AppComment } from "../types";
import AppIcon from "./AppIcon";

interface Props {
  ideaId: string;
}

const CommentSection: React.FC<Props> = ({ ideaId }) => {
  const { comments, loading } = useComments(ideaId);
  const { appUser, role } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [profilePhotos, setProfilePhotos] = useState<Record<string, string>>({});

  const canComment = role === "collaborator" || role === "lab_head";

  // Comments created before profile photos were supported still receive the
  // current canonical collaborator avatar without rewriting historic data.
  useEffect(() => {
    const authorIds = Array.from(new Set([
      ...comments.map((comment) => comment.authorId),
      appUser?.uid || "",
    ].filter(Boolean)));
    if (authorIds.length === 0) return;
    const unsubscribers = authorIds.map((uid) => onSnapshot(
      query(collection(db, "collaborators"), where("uid", "==", uid)),
      (snapshot) => {
        const photo = String(snapshot.docs[0]?.data()?.photo || "");
        setProfilePhotos((current) => current[uid] === photo ? current : { ...current, [uid]: photo });
      },
      () => undefined,
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [appUser?.uid, comments]);

  const childrenByParent = useMemo(() => {
    const grouped = new Map<string | null, AppComment[]>();
    for (const comment of comments) {
      const key = comment.parentId ?? null;
      const bucket = grouped.get(key) ?? [];
      bucket.push(comment);
      grouped.set(key, bucket);
    }

    grouped.forEach((bucket) => {
      bucket.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });

    return grouped;
  }, [comments]);

  const getChildren = (parentId: string | null) =>
    childrenByParent.get(parentId) ?? [];

  const topLevel = getChildren(null);

  const submit = async (content: string, parentId?: string) => {
    if (!content.trim() || !appUser) return;
    await addDoc(collection(db, "comments"), {
      ideaId,
      authorId: appUser.uid,
      authorName: appUser.name,
      authorPhoto: profilePhotos[appUser.uid] || "",
      content: content.trim(),
      parentId: parentId ?? null,
      createdAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, "researchIdeas", ideaId), {
      commentCount: increment(1),
    });
  };

  const collectTreeIds = (rootId: string) => {
    const ids: string[] = [];
    const stack = [rootId];

    while (stack.length) {
      const currentId = stack.pop();
      if (!currentId) continue;
      ids.push(currentId);

      const children = getChildren(currentId);
      for (const child of children) stack.push(child.id);
    }

    return ids;
  };

  const deleteComment = async (comment: AppComment) => {
    if (!window.confirm("Delete this comment and all nested replies?")) return;

    const idsToDelete = collectTreeIds(comment.id);
    for (const id of idsToDelete) {
      await deleteDoc(doc(db, "comments", id));
    }

    await updateDoc(doc(db, "researchIdeas", ideaId), {
      commentCount: increment(-idsToDelete.length),
    });
  };

  const canDelete = (c: AppComment) => role === "admin" || appUser?.uid === c.authorId;

  const canEdit = (c: AppComment) =>
    role === "admin" || appUser?.uid === c.authorId;

  const editComment = async (comment: AppComment, content: string) => {
    const trimmed = content.trim();
    if (!trimmed || trimmed === comment.content.trim()) return;

    await updateDoc(doc(db, "comments", comment.id), {
      content: trimmed,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div>
      <style>{`
        @keyframes commentIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes replyIn   { from { opacity:0; transform:translateX(-6px); } to { opacity:1; transform:translateX(0); } }
      `}</style>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-1 h-7 rounded-full"
          style={{ background: "var(--color-secondary)" }}
        />
        <h3
          className="font-black text-xl"
          style={{
            color: "var(--color-primary)",
            fontFamily: "var(--font-heading)",
          }}
        >
          Discussion
        </h3>
        <div
          className="px-2.5 py-0.5 rounded-full text-xs font-black"
          style={{ background: "var(--color-primary)", color: "white" }}
        >
          {comments.length}
        </div>
      </div>

      {/* Main input */}
      {canComment ? (
        <CommentInput
          appUser={appUser}
          onSubmit={async (content) => {
            setSubmitting(true);
            try {
              await submit(content);
            } finally {
              setSubmitting(false);
            }
          }}
          submitting={submitting}
          placeholder="Share your thoughts about this research..."
        />
      ) : (
        <div
          className="flex items-center gap-4 p-5 rounded-2xl mb-8"
          style={{ background: "#f8fafc", border: "1px solid #e8eef4" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{ background: "#e8eef4" }}
          >
            <AppIcon name="lock" size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-700">
              Comments are for collaborators
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Only approved collaborators and admins can comment.
            </p>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div
            className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin"
            style={{
              borderColor: "var(--color-primary)",
              borderTopColor: "transparent",
            }}
          />
        </div>
      ) : topLevel.length === 0 ? (
        <div
          className="text-center py-14 rounded-2xl"
          style={{ background: "#f8fafc", border: "1px dashed #d1d5db" }}
        >
          <div className="mb-3 inline-flex items-center justify-center text-gray-400">
            <AppIcon name="message" size={36} />
          </div>
          <p className="font-bold text-gray-500 text-sm">No comments yet</p>
          <p className="text-xs text-gray-400 mt-1">
            {canComment
              ? "Be the first to start the discussion!"
              : "No discussion yet."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4" style={{ overflow: "visible" }}>
          {topLevel.map((comment, idx) => (
            <div
              key={comment.id}
              style={{
                animation: `commentIn 0.3s ease ${idx * 0.05}s both`,
                overflow: "visible",
                position: "relative",
              }}
            >
              <CommentThreadNode
                comment={comment}
                depth={0}
                lineage={[comment.id]}
                getChildren={getChildren}
                canDelete={canDelete}
                onDelete={deleteComment}
                canEdit={canEdit}
                onEdit={editComment}
                canComment={canComment}
                appUser={appUser}
                appUserPhoto={profilePhotos[appUser?.uid || ""] || ""}
                resolvePhoto={(comment) => comment.authorPhoto || profilePhotos[comment.authorId] || ""}
                onReply={submit}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Reusable Comment Input ─────────────────────────────────────
const CommentInput: React.FC<{
  appUser: any;
  appUserPhoto?: string;
  onSubmit: (content: string) => Promise<void>;
  submitting?: boolean;
  placeholder?: string;
  isReply?: boolean;
  onCancel?: () => void;
  autoFocus?: boolean;
}> = ({
  appUser,
  appUserPhoto = "",
  onSubmit,
  submitting = false,
  placeholder = "Write a comment...",
  isReply = false,
  onCancel,
  autoFocus = false,
}) => {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const loading = submitting || busy;

  const handle = async () => {
    if (!text.trim() || loading) return;
    setBusy(true);
    try {
      await onSubmit(text.trim());
      setText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-2xl overflow-hidden mb-5"
      style={{
        border: `1px solid ${isReply ? "var(--color-secondary)2b" : "#e8eef4"}`,
        boxShadow: "0 1px 6px rgba(15,23,42,0.04)",
        background: "white",
      }}
    >
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-center gap-3 mb-3">
          <Avatar photo={appUserPhoto} name={appUser?.name || "You"} size={36}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-xs flex-shrink-0"
          />
          <div>
            <p className="text-sm font-semibold text-gray-700 leading-none">
              {appUser?.name ?? "You"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {isReply ? "Write a reply" : "Write a comment"}
            </p>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handle();
          }}
          placeholder={placeholder}
          rows={isReply ? 2 : 4}
          autoFocus={autoFocus}
          className="w-full text-sm resize-none outline-none text-gray-700 rounded-xl"
          style={{
            border: "1px solid #e2e8f0",
            padding: "14px 14px",
            minHeight: isReply ? 88 : 124,
            fontFamily: "var(--font-body)",
            lineHeight: 1.65,
            background: "#fbfdff",
          }}
        />
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-gray-400">Ctrl + Enter to post</span>
          <div className="flex gap-2 ml-auto">
            {onCancel && (
              <button
                onClick={onCancel}
                className="text-xs font-bold px-4 py-1.5 rounded-lg border-none cursor-pointer"
                style={{ background: "#f1f5f9", color: "#64748b" }}
              >
                Cancel
              </button>
            )}
            <button
              onClick={handle}
              disabled={loading || !text.trim()}
              className="text-xs font-bold px-4 py-1.5 rounded-xl text-white disabled:opacity-50 transition-all"
              style={{
                background: isReply
                  ? "var(--color-secondary)"
                  : "var(--color-primary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                    style={{
                      borderColor: "white",
                      borderTopColor: "transparent",
                    }}
                  />
                  Posting...
                </span>
              ) : isReply ? (
                "↩ Reply"
              ) : (
                "Post"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Recursive Thread Node ──────────────────────────────────────
const CommentThreadNode: React.FC<{
  comment: AppComment;
  depth: number;
  lineage: string[];
  getChildren: (parentId: string | null) => AppComment[];
  canDelete: (comment: AppComment) => boolean;
  onDelete: (comment: AppComment) => Promise<void>;
  canEdit: (comment: AppComment) => boolean;
  onEdit: (comment: AppComment, content: string) => Promise<void>;
  canComment: boolean;
  appUser: any;
  appUserPhoto?: string;
  resolvePhoto: (comment: AppComment) => string;
  onReply: (content: string, parentId?: string) => Promise<void>;
}> = ({
  comment,
  depth,
  lineage,
  getChildren,
  canDelete,
  onDelete,
  canEdit,
  onEdit,
  canComment,
  appUser,
  appUserPhoto = "",
  resolvePhoto,
  onReply,
}) => {
  const [hovered, setHovered] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [savingEdit, setSavingEdit] = useState(false);
  const actionAnchorRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const allChildren = getChildren(comment.id);
  const children = allChildren.filter((child) => !lineage.includes(child.id));

  const leftPadding = Math.min(depth, 4) * 20;

  const initials = comment.authorName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!isEditing) setEditText(comment.content);
  }, [comment.content, isEditing]);

  useEffect(() => {
    if (!menuOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      if (!actionMenuRef.current) return;
      if (!actionMenuRef.current.contains(event.target as Node)) {
        if (!actionButtonRef.current?.contains(event.target as Node)) {
          setMenuOpen(false);
        }
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [menuOpen]);

  const submitEdit = async () => {
    if (!editText.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      await onEdit(comment, editText);
      setIsEditing(false);
      setMenuOpen(false);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div
      className="transition-all"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        paddingLeft: leftPadding,
        overflow: "visible",
        position: "relative",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Avatar photo={resolvePhoto(comment)} name={comment.authorName || initials} size={depth === 0 ? 42 : 36} />

        <div className="flex-1 min-w-0">
          {/* Bubble */}
          <div
            className="inline-block px-4 py-3 rounded-2xl rounded-tl-sm mb-1"
            style={{
              background: hovered ? "#eaf1fb" : "#f0f4f8",
              maxWidth: "100%",
              width: "100%",
              border: "1px solid #e8eef4",
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-black text-gray-800 text-sm">
                {comment.authorName}
              </span>
              {depth > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    fontSize: 10,
                  }}
                >
                  Reply
                </span>
              )}
            </div>

            {isEditing ? (
              <div>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  className="w-full text-sm resize-y outline-none rounded-lg p-2"
                  style={{
                    border: "1px solid #cbd5e1",
                    color: "#374151",
                    background: "white",
                    fontFamily: "var(--font-body)",
                    lineHeight: 1.65,
                  }}
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditText(comment.content);
                    }}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border-none cursor-pointer"
                    style={{ background: "#e2e8f0", color: "#475569" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitEdit}
                    disabled={savingEdit || !editText.trim()}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border-none text-white disabled:opacity-60 cursor-pointer"
                    style={{ background: "var(--color-primary)" }}
                  >
                    {savingEdit ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <p
                className="text-sm text-gray-700 leading-relaxed"
                style={{ lineHeight: 1.65 }}
              >
                {comment.content}
              </p>
            )}
          </div>

          {/* Action row */}
          <div className="flex items-center gap-4 px-1 flex-wrap">
            <span className="text-xs text-gray-400">
              {new Date(comment.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {canComment && (
              <button
                onClick={() => setShowReply((v) => !v)}
                className="text-xs font-black border-none bg-transparent cursor-pointer"
                style={{
                  color: showReply ? "var(--color-secondary)" : "#64748b",
                }}
              >
                ↩ Reply
              </button>
            )}
            {children.length > 0 && (
              <button
                onClick={() => setShowReplies((v) => !v)}
                className="text-xs font-bold border-none bg-transparent cursor-pointer"
                style={{ color: "var(--color-primary)" }}
              >
                {showReplies
                  ? `▲ Hide ${children.length} ${children.length === 1 ? "reply" : "replies"}`
                  : `▼ View ${children.length} ${children.length === 1 ? "reply" : "replies"}`}
              </button>
            )}
            {(canEdit(comment) || canDelete(comment)) && (
              <div className="ml-auto relative" ref={actionAnchorRef}>
                <button
                  ref={actionButtonRef}
                  onClick={() => {
                    if (!menuOpen && actionButtonRef.current) {
                      const rect =
                        actionButtonRef.current.getBoundingClientRect();
                      const menuWidth = 140;
                      const menuHeight = 92;
                      const gap = 8;
                      const spaceBelow = window.innerHeight - rect.bottom;
                      const spaceAbove = rect.top;
                      const opensUp =
                        spaceBelow < menuHeight + gap &&
                        spaceAbove > menuHeight + gap;

                      const top = opensUp
                        ? rect.top - menuHeight - gap
                        : rect.bottom + gap;
                      const left = Math.min(
                        Math.max(8, rect.right - menuWidth),
                        window.innerWidth - menuWidth - 8,
                      );

                      setMenuPosition({
                        top,
                        left,
                      });
                    }
                    setMenuOpen((v) => !v);
                  }}
                  aria-label="Comment actions"
                  className="w-7 h-7 rounded-full border-none cursor-pointer flex items-center justify-center"
                  style={{
                    background: menuOpen ? "#e2e8f0" : "transparent",
                    color: "#64748b",
                  }}
                >
                  <AppIcon name="more" size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Reply input */}
          {showReply && (
            <div className="mt-3" style={{ animation: "replyIn 0.2s ease" }}>
              <CommentInput
                appUser={appUser}
                appUserPhoto={appUserPhoto}
                onSubmit={async (content) => {
                  await onReply(content, comment.id);
                  setShowReply(false);
                  setShowReplies(true);
                }}
                isReply
                placeholder={`Reply to ${comment.authorName}...`}
                onCancel={() => setShowReply(false)}
                autoFocus
              />
            </div>
          )}

          {/* Replies */}
          {showReplies && children.length > 0 && (
            <div
              className="mt-3 flex flex-col gap-3 pl-3"
              style={{
                borderLeft: "2px solid #dbe7f3",
                overflow: "visible",
                position: "relative",
              }}
            >
              {children.map((reply, idx) => (
                <div
                  key={reply.id}
                  style={{ animation: `replyIn 0.2s ease ${idx * 0.04}s both` }}
                >
                  <CommentThreadNode
                    comment={reply}
                    depth={depth + 1}
                    lineage={[...lineage, reply.id]}
                    getChildren={getChildren}
                    canDelete={canDelete}
                    onDelete={onDelete}
                    canEdit={canEdit}
                    onEdit={onEdit}
                    canComment={canComment}
                    appUser={appUser}
                    appUserPhoto={appUserPhoto}
                    resolvePhoto={resolvePhoto}
                    onReply={onReply}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {menuOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={actionMenuRef}
              className="rounded-xl overflow-hidden"
              style={{
                position: "fixed",
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
                minWidth: 140,
                background: "white",
                border: "1px solid #e2e8f0",
                boxShadow: "0 10px 28px rgba(15,23,42,0.16)",
                zIndex: 9999,
              }}
            >
              {canEdit(comment) && (
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold border-none cursor-pointer"
                  style={{ background: "white", color: "#0f172a" }}
                >
                  Edit comment
                </button>
              )}
              {canDelete(comment) && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(comment);
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold border-none cursor-pointer"
                  style={{ background: "white", color: "#b91c1c" }}
                >
                  Delete comment
                </button>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

const Avatar: React.FC<{ photo?: string; name: string; size: number; className?: string }> = ({ photo, name, size, className = "" }) => {
  const [failed, setFailed] = useState(false);
  const initials = name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "?";
  return <div className={`overflow-hidden rounded-full flex shrink-0 items-center justify-center font-black text-white ${className}`} style={{ width: size, height: size, background: "linear-gradient(135deg, var(--color-primary), var(--color-secondary))", boxShadow: "0 2px 8px rgba(30,58,95,0.18)" }}>
    {photo && !failed ? <img src={photo} alt={`${name} avatar`} className="h-full w-full object-cover" onError={() => setFailed(true)} /> : <span style={{ fontSize: size <= 36 ? 11 : 13 }}>{initials}</span>}
  </div>;
};

export default CommentSection;
