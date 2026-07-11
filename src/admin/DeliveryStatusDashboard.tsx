import { collection, onSnapshot } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import AppIcon from "../components/AppIcon";
import { db } from "../firebase/config";

interface NotificationEvent {
  id: string;
  senderId: string;
  recipientId: string;
  chatId: string;
  messageId: string;
  status: "sent" | "failed" | "skipped";
  reason?: string;
  createdAt: string;
}

interface UserRow {
  name?: string;
  email?: string;
}

const DeliveryStatusDashboard: React.FC = () => {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [usersById, setUsersById] = useState<Record<string, UserRow>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubEvents = onSnapshot(
      collection(db, "privateChatNotificationEvents"),
      (snap) => {
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as NotificationEvent)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setEvents(rows);
        setLoading(false);
      },
    );

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const next: Record<string, UserRow> = {};
      snap.docs.forEach((docRow) => {
        next[docRow.id] = docRow.data() as UserRow;
      });
      setUsersById(next);
    });

    return () => {
      unsubEvents();
      unsubUsers();
    };
  }, []);

  const stats = useMemo(() => {
    const total = events.length;
    const sent = events.filter((e) => e.status === "sent").length;
    const failed = events.filter((e) => e.status === "failed").length;
    const skipped = events.filter((e) => e.status === "skipped").length;
    return { total, sent, failed, skipped };
  }, [events]);

  const recent = events.slice(0, 30);

  return (
    <div>
      <div className="mb-6">
        <h2
          className="text-2xl font-black"
          style={{ color: "var(--color-primary)" }}
        >
          Delivery Status
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Email notification outcomes for private chat events.
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
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Total Events", value: stats.total, color: "#334155" },
              { label: "Sent", value: stats.sent, color: "#16a34a" },
              { label: "Failed", value: stats.failed, color: "#dc2626" },
              { label: "Skipped", value: stats.skipped, color: "#ca8a04" },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border bg-white p-4"
                style={{ borderColor: "#e5e7eb" }}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  {card.label}
                </p>
                <p
                  className="text-2xl font-black mt-1"
                  style={{ color: card.color }}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <div
            className="rounded-2xl border bg-white overflow-hidden"
            style={{ borderColor: "#e5e7eb" }}
          >
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: "#eef2f7" }}
            >
              <p className="text-sm font-black text-gray-800">
                Recent Deliveries
              </p>
            </div>
            {recent.length === 0 ? (
              <div className="py-14 text-center">
                <div className="inline-flex text-gray-400 mb-3">
                  <AppIcon name="message" size={28} />
                </div>
                <p className="text-sm text-gray-500">
                  No notification events yet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-2">Time</th>
                      <th className="px-4 py-2">From</th>
                      <th className="px-4 py-2">To</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((eventRow) => {
                      const sender = usersById[eventRow.senderId];
                      const recipient = usersById[eventRow.recipientId];
                      const statusColor =
                        eventRow.status === "sent"
                          ? "#16a34a"
                          : eventRow.status === "failed"
                            ? "#dc2626"
                            : "#ca8a04";

                      return (
                        <tr
                          key={eventRow.id}
                          className="border-t"
                          style={{ borderColor: "#f1f5f9" }}
                        >
                          <td className="px-4 py-2 text-gray-500">
                            {new Date(eventRow.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-gray-800">
                            {sender?.name || eventRow.senderId}
                          </td>
                          <td className="px-4 py-2 text-gray-800">
                            {recipient?.name || eventRow.recipientId}
                          </td>
                          <td
                            className="px-4 py-2 font-bold"
                            style={{ color: statusColor }}
                          >
                            {eventRow.status}
                          </td>
                          <td className="px-4 py-2 text-gray-500">
                            {eventRow.reason || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DeliveryStatusDashboard;
