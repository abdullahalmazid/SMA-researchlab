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
import React, { useEffect, useMemo, useState } from "react";
import AppIcon from "../components/AppIcon";
import { db } from "../firebase/config";
import type { Announcement } from "../types";

const ManageAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pinned" | "visible" | "hidden">(
    "all",
  );
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const snap = await getDocs(
      query(collection(db, "announcements"), orderBy("order", "asc")),
    );
    setAnnouncements(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Announcement),
    );
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest("[data-ann-menu='true']") ||
        target.closest("[data-ann-trigger='true']")
      ) {
        return;
      }
      setMenuOpenFor(null);
    };

    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  const add = async () => {
    if (!newText.trim()) return;
    setAdding(true);
    const maxOrder = announcements.reduce(
      (m, a) => Math.max(m, a.order ?? 0),
      0,
    );
    await addDoc(collection(db, "announcements"), {
      content: newText.trim(),
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPinned: false,
      isHidden: false,
    });
    setNewText("");
    load();
    setAdding(false);
  };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setEditingText(a.content);
    setMenuOpenFor(null);
  };

  const saveEdit = async (id: string) => {
    if (!editingText.trim()) return;
    setBusyId(id);
    await updateDoc(doc(db, "announcements", id), {
      content: editingText.trim(),
      updatedAt: new Date().toISOString(),
    });
    setEditingId(null);
    setEditingText("");
    setBusyId(null);
    load();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const togglePin = async (a: Announcement) => {
    setBusyId(a.id);
    await updateDoc(doc(db, "announcements", a.id), {
      isPinned: !a.isPinned,
      updatedAt: new Date().toISOString(),
    });
    setBusyId(null);
    setMenuOpenFor(null);
    load();
  };

  const toggleHidden = async (a: Announcement) => {
    setBusyId(a.id);
    await updateDoc(doc(db, "announcements", a.id), {
      isHidden: !a.isHidden,
      updatedAt: new Date().toISOString(),
    });
    setBusyId(null);
    setMenuOpenFor(null);
    load();
  };

  const move = async (id: string, direction: -1 | 1) => {
    const index = announcements.findIndex((a) => a.id === id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= announcements.length) return;

    const current = announcements[index];
    const other = announcements[swapIndex];
    setBusyId(current.id);
    await Promise.all([
      updateDoc(doc(db, "announcements", current.id), {
        order: other.order ?? swapIndex + 1,
      }),
      updateDoc(doc(db, "announcements", other.id), {
        order: current.order ?? index + 1,
      }),
    ]);
    setBusyId(null);
    setMenuOpenFor(null);
    load();
  };

  const remove = async (a: Announcement) => {
    if (!window.confirm("Delete this announcement?")) return;
    setBusyId(a.id);
    await deleteDoc(doc(db, "announcements", a.id));
    setBusyId(null);
    setMenuOpenFor(null);
    load();
  };

  const filtered = useMemo(() => {
    return announcements.filter((a) => {
      const matchesSearch = !search.trim()
        ? true
        : a.content.toLowerCase().includes(search.toLowerCase());

      const matchesFilter =
        filter === "all"
          ? true
          : filter === "pinned"
            ? !!a.isPinned
            : filter === "hidden"
              ? !!a.isHidden
              : !a.isHidden;

      return matchesSearch && matchesFilter;
    });
  }, [announcements, search, filter]);

  const stats = useMemo(
    () => ({
      total: announcements.length,
      pinned: announcements.filter((a) => a.isPinned).length,
      hidden: announcements.filter((a) => a.isHidden).length,
    }),
    [announcements],
  );

  return (
    <div>
      <div className="mb-6">
        <h2
          className="text-2xl font-black"
          style={{ color: "var(--color-primary)" }}
        >
          Announcements
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Shown in the Latest Updates section on Home.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {stats.total} total · {stats.pinned} pinned · {stats.hidden} hidden
        </p>
      </div>

      <div
        className="bg-white rounded-2xl p-5 shadow-sm border mb-6"
        style={{ borderColor: "#e5e7eb" }}
      >
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          New Announcement
        </label>
        <textarea
          rows={3}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          className="w-full px-4 py-2.5 text-sm rounded-xl border outline-none mb-3"
          style={{
            borderColor: "#e5e7eb",
            resize: "none",
            fontFamily: "var(--font-body)",
          }}
          placeholder="e.g. Our paper has been accepted at NeurIPS 2024."
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            {newText.trim().length} characters
          </p>
          <button
            onClick={add}
            disabled={adding || !newText.trim()}
            className="text-sm font-bold px-5 py-2 rounded-xl text-white disabled:opacity-60 border-none cursor-pointer"
            style={{ background: "var(--color-primary)" }}
          >
            {adding ? "Adding..." : "Add Announcement"}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search announcement text..."
          className="flex-1 text-sm px-4 py-2.5 rounded-xl border outline-none"
          style={{ borderColor: "#d1d5db" }}
        />
        <div className="flex gap-2 flex-wrap">
          {(
            [
              ["all", `All (${stats.total})`],
              ["visible", `Visible (${stats.total - stats.hidden})`],
              ["hidden", `Hidden (${stats.hidden})`],
              ["pinned", `Pinned (${stats.pinned})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className="text-xs font-semibold px-3 py-2 rounded-lg border cursor-pointer"
              style={{
                borderColor: filter === value ? "transparent" : "#d1d5db",
                background: filter === value ? "var(--color-primary)" : "white",
                color: filter === value ? "white" : "#374151",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((a) => {
          const index = announcements.findIndex((x) => x.id === a.id);
          const isFirst = index === 0;
          const isLast = index === announcements.length - 1;

          return (
            <div
              key={a.id}
              className="bg-white rounded-xl p-4 shadow-sm border flex items-start gap-4 relative"
              style={{
                borderColor: "#e5e7eb",
                borderLeft: a.isHidden
                  ? "4px solid #9ca3af"
                  : a.isPinned
                    ? "4px solid #f59e0b"
                    : "4px solid var(--color-accent)",
                opacity: a.isHidden ? 0.72 : 1,
              }}
            >
              <div className="flex-1">
                {editingId === a.id ? (
                  <div>
                    <textarea
                      rows={3}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                      style={{ borderColor: "#d1d5db", resize: "none" }}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => saveEdit(a.id)}
                        disabled={busyId === a.id || !editingText.trim()}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg text-white border-none cursor-pointer disabled:opacity-60"
                        style={{ background: "var(--color-primary)" }}
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer"
                        style={{ borderColor: "#d1d5db", color: "#374151" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {a.content}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(a.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                  {a.isPinned && (
                    <span
                      className="ml-2 font-bold"
                      style={{ color: "#b45309" }}
                    >
                      · Pinned
                    </span>
                  )}
                  {a.isHidden && (
                    <span
                      className="ml-2 font-bold"
                      style={{ color: "#6b7280" }}
                    >
                      · Hidden
                    </span>
                  )}
                </p>
              </div>

              <div className="relative">
                <button
                  data-ann-trigger="true"
                  onClick={() =>
                    setMenuOpenFor((p) => (p === a.id ? null : a.id))
                  }
                  className="text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer text-lg leading-none flex-shrink-0"
                >
                  <AppIcon name="more" size={18} />
                </button>

                {menuOpenFor === a.id && (
                  <div
                    data-ann-menu="true"
                    className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border shadow-xl z-[500] overflow-hidden"
                    style={{ borderColor: "#e5e7eb" }}
                  >
                    <button
                      onClick={() => startEdit(a)}
                      className="block w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-none"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => move(a.id, -1)}
                      disabled={isFirst || busyId === a.id}
                      className="block w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-none disabled:opacity-50"
                    >
                      Move Up
                    </button>
                    <button
                      onClick={() => move(a.id, 1)}
                      disabled={isLast || busyId === a.id}
                      className="block w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-none disabled:opacity-50"
                    >
                      Move Down
                    </button>
                    <button
                      onClick={() => togglePin(a)}
                      className="block w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-none"
                    >
                      {a.isPinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      onClick={() => toggleHidden(a)}
                      className="block w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-none"
                    >
                      {a.isHidden ? "Show" : "Hide"}
                    </button>
                    <button
                      onClick={() => remove(a)}
                      className="block w-full text-left px-3 py-2.5 text-sm hover:bg-red-50 border-none"
                      style={{ color: "#dc2626" }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-8">
            No announcements match your filters.
          </p>
        )}
      </div>
    </div>
  );
};

export default ManageAnnouncements;
