import { doc, increment, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import type { User } from "../types";

/**
 * First-party, privacy-light analytics. No cookies, no IP addresses, no
 * third-party scripts: an anonymous random id in localStorage, daily counters
 * in `analyticsDaily/{YYYY-MM-DD}`, and one `visitors/{id}` doc per visitor
 * per day for unique counts. Signed-in collaborators also update
 * `memberActivity/{uid}` so the lab can see who is active.
 *
 * Writes are best-effort; a blocked write never affects the page.
 */

const VISITOR_KEY = "rl_vid";
const SEEN_DAY_KEY = "rl_seen_day";
const SESSION_KEY = "rl_session";

const safeStorage = (store: () => Storage) => ({
  get: (key: string) => {
    try {
      return store().getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      store().setItem(key, value);
    } catch {
      /* private mode */
    }
  },
});
const local = safeStorage(() => window.localStorage);
const session = safeStorage(() => window.sessionStorage);

const randomId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");

const visitorId = () => {
  let id = local.get(VISITOR_KEY);
  if (!id || !/^[a-f0-9]{24}$/.test(id)) {
    id = randomId();
    local.set(VISITOR_KEY, id);
  }
  return id;
};

/** UTC day, so every visitor's counts land in the same bucket. */
export const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);

/** Detail pages collapse to their section so the path map stays small. */
export const pathKey = (pathname: string) => {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "home";
  const [first, second] = parts;
  const base = second && ["collaborators", "publications", "research-ideas"].includes(first) ? `${first}_detail` : parts.join("_");
  return base.toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 60) || "other";
};

const deviceType = () => {
  const width = window.innerWidth;
  return width < 768 ? "mobile" : width < 1100 ? "tablet" : "desktop";
};

const referrerKey = () => {
  try {
    if (!document.referrer) return "direct";
    const host = new URL(document.referrer).hostname.replace(/^www\./, "");
    if (host === window.location.hostname.replace(/^www\./, "")) return "internal";
    return host.toLowerCase().replace(/[^a-z0-9-]/g, "_").slice(0, 60) || "other";
  } catch {
    return "direct";
  }
};

const UNTRACKED = /^\/(admin|admin-login|editlogin|secret-developer)(\/|$)/;

export const trackPageView = async (pathname: string, user: User | null) => {
  if (UNTRACKED.test(pathname)) return;
  // Admins browsing the site would skew visitor numbers.
  if (user && (user.role === "admin" || user.adminLevel === "primary")) return;

  const day = dayKey();
  const path = pathKey(pathname);
  const firstOfSession = !session.get(SESSION_KEY);
  if (firstOfSession) session.set(SESSION_KEY, "1");

  const writes: Promise<unknown>[] = [
    setDoc(
      doc(db, "analyticsDaily", day),
      {
        day,
        views: increment(1),
        paths: { [path]: increment(1) },
        ...(firstOfSession
          ? { sessions: increment(1), devices: { [deviceType()]: increment(1) }, referrers: { [referrerKey()]: increment(1) } }
          : {}),
      },
      { merge: true },
    ),
  ];

  if (local.get(SEEN_DAY_KEY) !== day) {
    local.set(SEEN_DAY_KEY, day);
    writes.push(
      setDoc(doc(db, "analyticsDaily", day, "visitors", visitorId()), {
        firstSeenAt: new Date().toISOString(),
        device: deviceType(),
        firstPath: path,
        member: Boolean(user),
      }),
    );
  }

  if (user && (user.role === "collaborator" || user.role === "lab_head")) {
    writes.push(
      setDoc(
        doc(db, "memberActivity", user.uid),
        {
          uid: user.uid,
          name: user.name || user.email || "Member",
          role: user.role,
          lastSeenAt: new Date().toISOString(),
          lastPath: pathname.slice(0, 120),
          pageViews: increment(1),
          days: { [day]: increment(1) },
          ...(firstOfSession ? { sessions: increment(1), lastSessionAt: new Date().toISOString() } : {}),
        },
        { merge: true },
      ),
    );
  }

  await Promise.allSettled(writes);
};
