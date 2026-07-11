import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const commit = process.argv.includes("--commit");
if (!getApps().length) initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const snapshot = await db.collection("collaborators").get();
let ready = 0, skipped = 0, conflicts = 0;
for (const source of snapshot.docs) {
  const data = source.data();
  const uid = String(data.uid || "").trim();
  if (!uid || source.id === uid) { skipped += 1; continue; }
  const target = await db.collection("collaborators").doc(uid).get();
  if (target.exists && target.data()?.uid !== uid) { conflicts += 1; console.error(`CONFLICT ${source.id} -> ${uid}`); continue; }
  ready += 1;
  console.log(`${commit ? "MIGRATE" : "DRY RUN"}: ${source.id} -> ${uid}`);
  if (commit) await db.collection("collaborators").doc(uid).set({ ...data, uid, legacyDocumentId: source.id, migratedAt: new Date().toISOString() }, { merge: true });
}
console.log(JSON.stringify({ commit, scanned: snapshot.size, ready, skipped, conflicts }, null, 2));
console.log(commit ? "Migration completed. Legacy documents were intentionally preserved." : "No writes made. Re-run with --commit after reviewing this report.");
