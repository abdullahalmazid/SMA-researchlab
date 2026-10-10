import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";

/**
 * Admin change log. Every write made from the admin panel (and from on-page
 * editing by admins) is recorded in `adminAuditLog`: who, what, where, when.
 * Only the primary administrator can read it (see firestore.rules).
 *
 * Logging is best-effort and never blocks or fails the action itself. It is a
 * client-side record: it answers "who on the team changed this", not a
 * tamper-proof ledger — that would need a backend.
 */

export interface AuditActor {
  uid: string;
  name: string;
  level: "primary" | "moderator" | "none";
}

let actor: AuditActor | null = null;

/** Set from AuthContext whenever the signed-in admin changes. */
export const setAuditActor = (next: AuditActor | null) => {
  actor = next;
};

const MAX_FIELDS = 20;
const MAX_VALUE = 160;

const describeValue = (value: unknown): string => {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return value.length > MAX_VALUE ? `${value.slice(0, MAX_VALUE)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.length} item${value.length === 1 ? "" : "s"}]`;
  // Firestore sentinels (serverTimestamp, increment, arrayUnion…) carry a _methodName.
  const method = (value as { _methodName?: string })?._methodName;
  if (method) return `(${method.replace(/^FieldValue\./, "")})`;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return "{…}";
  return String(value);
};

/** A compact, readable summary of what a write set. */
export const summariseData = (data: unknown): Record<string, string> => {
  if (!data || typeof data !== "object") return {};
  const entries = Object.entries(data as Record<string, unknown>).slice(0, MAX_FIELDS);
  return Object.fromEntries(entries.map(([key, value]) => [key, describeValue(value)]));
};

/** Paths never worth logging (the log itself, telemetry, presence). */
const IGNORED_ROOTS = new Set(["adminAuditLog", "presence", "analyticsDaily", "memberActivity"]);

export type AuditOperation = "create" | "update" | "set" | "delete" | "batch" | "custom";

export const logAdminAction = async (
  operation: AuditOperation,
  targetPath: string,
  details: Record<string, string> = {},
  label?: string,
) => {
  if (!actor || actor.level === "none") return;
  const root = targetPath.split("/")[0];
  if (IGNORED_ROOTS.has(root)) return;
  try {
    await addDoc(collection(db, "adminAuditLog"), {
      actorUid: actor.uid,
      actorName: actor.name,
      actorLevel: actor.level,
      action: operation,
      targetPath,
      // A readable name when the write carries one; the log page falls back to "Kind · id".
      targetLabel: label ?? details.title ?? details.name ?? details.targetName ?? "",
      details,
      createdAt: new Date().toISOString(),
      serverAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn("[audit] change was saved but not logged:", error);
  }
};
