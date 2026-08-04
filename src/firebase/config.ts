import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const isFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID,
);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "offline-preview-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "offline-preview.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "offline-preview",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "offline-preview.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:offlinepreview",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

/* ── App Check ──────────────────────────────────────────────────────────
 * This is what actually stops the bots. Both public forms call addDoc from
 * the browser, so a script can skip your UI entirely and POST to the
 * Firestore REST endpoint using the apiKey that ships in your JS bundle. No
 * widget on the page can affect that request. App Check attaches an
 * attestation token to every Firebase call, and the rules reject writes
 * that arrive without one.
 *
 * Must run before getFirestore() so the token is attached to the very first
 * request the app makes.
 *
 * SETUP
 *   1. reCAPTCHA admin console → register a site → reCAPTCHA v3 → add your
 *      production domain AND localhost. Copy the site key and secret key.
 *   2. Firebase console → App Check → Apps → register this web app with the
 *      reCAPTCHA v3 provider, pasting the SECRET key.
 *   3. Put the SITE key in .env as VITE_RECAPTCHA_SITE_KEY.
 *
 * Pick reCAPTCHA v3, not reCAPTCHA Enterprise. v3 is free; Enterprise bills
 * per assessment above a quota, which you don't want on the Spark plan.
 * ------------------------------------------------------------------- */

const APP_CHECK_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

if (isFirebaseConfigured && APP_CHECK_KEY) {
  // Localhost cannot pass a real reCAPTCHA attestation. The debug flag makes
  // the SDK print a token to the console — register it once under
  // App Check → Apps → this app → Manage debug tokens, and dev keeps working.
  if (import.meta.env.DEV) {
    (window as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean })
      .FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(APP_CHECK_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (error) {
    // Never let this take the site down. Without a token the two public
    // collections reject writes, which is the correct failure mode; every
    // other collection is unaffected.
    console.warn("[firebase] App Check failed to initialise:", error);
  }
} else if (isFirebaseConfigured) {
  console.warn("[firebase] VITE_RECAPTCHA_SITE_KEY not set — public forms will be rejected.");
}

export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
