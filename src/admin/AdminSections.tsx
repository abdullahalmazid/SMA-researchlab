import {
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
import type { ContactMessage } from "../types";

// ── Contact Messages ──────────────────────────────────────────
export const ContactMessages: React.FC = () => {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    const snap = await getDocs(
      query(collection(db, "contactMessages"), orderBy("submittedAt", "desc")),
    );
    setMessages(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ContactMessage),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (msg: ContactMessage) => {
    await updateDoc(doc(db, "contactMessages", msg.id), { isRead: true });
    load();
  };

  const remove = async (msg: ContactMessage) => {
    if (!window.confirm("Delete this message?")) return;
    await deleteDoc(doc(db, "contactMessages", msg.id));
    load();
  };

  const unreadCount = messages.filter((m) => !m.isRead).length;

  return (
    <div>
      <div className="mb-6">
        <h2
          className="text-2xl font-black"
          style={{ color: "var(--color-primary)" }}
        >
          Contact Messages
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {messages.length} total ·{" "}
          <span
            className="font-bold"
            style={{ color: unreadCount > 0 ? "#ef4444" : "#6b7280" }}
          >
            {unreadCount} unread
          </span>
        </p>
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
      ) : messages.length === 0 ? (
        <div
          className="text-center py-20 bg-white rounded-2xl border"
          style={{ borderColor: "#e5e7eb" }}
        >
          <div className="mb-3 inline-flex text-gray-400">
            <AppIcon name="contact" size={34} />
          </div>
          <p className="text-gray-500">No messages yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="bg-white rounded-2xl shadow-sm border overflow-hidden"
              style={{
                borderColor: "#e5e7eb",
                borderLeft: `4px solid ${msg.isRead ? "#e5e7eb" : "var(--color-accent)"}`,
              }}
            >
              <div
                className="p-4 flex items-start gap-4 cursor-pointer"
                onClick={() => {
                  setExpanded((p) => (p === msg.id ? null : msg.id));
                  if (!msg.isRead) markRead(msg);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-gray-900 text-sm">
                      {msg.name}
                    </p>
                    {!msg.isRead && (
                      <span
                        className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: "#fee2e2", color: "#991b1b" }}
                      >
                        New
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {msg.email} · {new Date(msg.submittedAt).toLocaleString()}
                  </p>
                  {msg.subject && (
                    <p className="text-sm font-medium text-gray-700 mt-1">
                      Re: {msg.subject}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(msg);
                  }}
                  className="text-xs font-bold text-red-400 hover:text-red-600 bg-transparent border-none cursor-pointer flex-shrink-0"
                >
                  Delete
                </button>
              </div>
              {expanded === msg.id && (
                <div
                  className="border-t px-4 py-4"
                  style={{ borderColor: "#f0f0f0", background: "#f9fafb" }}
                >
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {msg.message}
                  </p>
                  <a
                    href={`mailto:${msg.email}?subject=Re: ${msg.subject ?? "Your message to Rahman Research Lab"}`}
                    className="inline-block mt-3 text-xs font-bold no-underline px-4 py-1.5 rounded-lg text-white"
                    style={{ background: "var(--color-primary)" }}
                  >
                    Reply via Email
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export { default as ManageAnnouncements } from "./ManageAnnouncements";
