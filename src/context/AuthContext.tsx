import { deleteApp, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  type User as FirebaseUser,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, db, isFirebaseConfigured } from "../firebase/config";
import type { User, UserRole } from "../types";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  appUser: User | null;
  role: UserRole | null;
  loading: boolean;
  authError: string;
  login: (email: string, password: string) => Promise<UserRole>;
  logout: () => Promise<void>;
  createCollaboratorAccount: (email: string, password: string, name: string) => Promise<string>;
  sendPasswordSetupEmail: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const validRoles: UserRole[] = ["admin", "lab_head", "collaborator", "pending"];
const configuredAdminUid = String(import.meta.env.VITE_ADMIN_UID || "").trim();
const configuredLabHeadUid = String(import.meta.env.VITE_LAB_HEAD_UID || "").trim();

const resolveProfile = async (fbUser: FirebaseUser): Promise<User> => {
  const profileRef = doc(db, "users", fbUser.uid);
  let snapshot;
  try {
    snapshot = await getDoc(profileRef);
  } catch (error: any) {
    const code = String(error?.code || "");
    if (code.includes("permission-denied")) {
      throw new Error("auth/profile-permission-denied");
    }
    throw error;
  }

  if (!snapshot.exists()) {
    if (configuredAdminUid && fbUser.uid === configuredAdminUid) return { uid: fbUser.uid, email: fbUser.email || "", name: "Administrator", role: "admin", adminLevel: "primary", adminPermissions: [], createdAt: new Date().toISOString() };
    if (configuredLabHeadUid && fbUser.uid === configuredLabHeadUid) return { uid: fbUser.uid, email: fbUser.email || "", name: fbUser.displayName || "Lab Head", role: "lab_head", adminLevel: "none", adminPermissions: [], createdAt: new Date().toISOString() };
    throw new Error("auth/profile-not-found");
  }
  const data = snapshot.data() as Partial<User>;
  const role = String(data.role ?? "").trim().toLowerCase() as UserRole;
  if (!validRoles.includes(role)) throw new Error("auth/invalid-profile-role");

  return {
    uid: fbUser.uid,
    email: data.email || fbUser.email || "",
    name: data.name || fbUser.displayName || "User",
    role,
    createdAt: data.createdAt || new Date().toISOString(),
    adminLevel: fbUser.uid === configuredAdminUid ? "primary" : (data.adminLevel ?? (role === "admin" ? "primary" : "none")),
    adminPermissions: Array.isArray(data.adminPermissions) ? data.adminPermissions : [],
    accountStatus: data.accountStatus ?? "active",
    collaboratorProfileId: data.collaboratorProfileId,
  };
};

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
    return onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthError("");
      if (!fbUser) { setAppUser(null); setLoading(false); return; }
      setLoading(true);
      try {
        setAppUser(await resolveProfile(fbUser));
      } catch (error: any) {
        setAppUser(null);
        setAuthError(String(error?.message || "auth/profile-load-failed"));
      } finally {
        setLoading(false);
      }
    });
  }, []);

  // Authorization data must be live. Granting or revoking moderator access
  // updates the current interface without requiring a new login.
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    return onSnapshot(doc(db, "users", firebaseUser.uid), (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data() as Partial<User>;
      const nextRole = String(data.role ?? "").toLowerCase() as UserRole;
      if (!validRoles.includes(nextRole)) return;
      setAppUser((current) => ({
        uid: firebaseUser.uid,
        email: data.email || firebaseUser.email || current?.email || "",
        name: data.name || current?.name || firebaseUser.displayName || "User",
        role: nextRole,
        createdAt: data.createdAt || current?.createdAt || new Date().toISOString(),
        adminLevel: firebaseUser.uid === configuredAdminUid ? "primary" : (data.adminLevel ?? "none"),
        adminPermissions: Array.isArray(data.adminPermissions) ? data.adminPermissions : [],
        accountStatus: data.accountStatus ?? "active",
        collaboratorProfileId: data.collaboratorProfileId,
      }));
    }, (error) => console.error("Realtime user profile error:", error));
  }, [firebaseUser?.uid]);

  // Public profile identity is canonical for collaborators and the lab head.
  // This listener keeps the navbar, portal header, and user popup synchronized.
  useEffect(() => {
    if (!firebaseUser?.uid || !appUser || !["collaborator", "lab_head"].includes(appUser.role)) return;
    const directRef = doc(db, "collaborators", firebaseUser.uid);
    let fallbackUnsub: (() => void) | undefined;
    const directUnsub = onSnapshot(directRef, (snapshot) => {
      if (snapshot.exists()) {
        const profile = snapshot.data();
        setAppUser((current) => current ? { ...current, name: profile.name || current.name, email: profile.email || current.email } : current);
        fallbackUnsub?.();
      } else if (!fallbackUnsub) {
        fallbackUnsub = onSnapshot(query(collection(db, "collaborators"), where("uid", "==", firebaseUser.uid)), (legacy) => {
          const profile = legacy.docs[0]?.data();
          if (profile) setAppUser((current) => current ? { ...current, name: profile.name || current.name, email: profile.email || current.email } : current);
        });
      }
    });
    return () => { directUnsub(); fallbackUnsub?.(); };
  }, [firebaseUser?.uid, appUser?.role]);

  useEffect(() => {
    if (!firebaseUser?.uid || !appUser) return;
    const userRef = doc(db, "presence", firebaseUser.uid);
    const updatePresence = (isOnline: boolean) => setDoc(userRef, {
      ownerUid: firebaseUser.uid,
      isOnline,
      lastActiveAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    }, { merge: true }).catch(() => undefined);
    void updatePresence(true);
    const timer = window.setInterval(() => void updatePresence(document.visibilityState === "visible"), 60_000);
    const visibility = () => void updatePresence(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", visibility);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visibility); void updatePresence(false); };
  }, [appUser, firebaseUser?.uid]);

  const login = async (email: string, password: string) => {
    if (!isFirebaseConfigured) throw new Error("firebase/not-configured");
    setAuthError("");
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    try {
      const profile = await resolveProfile(credential.user);
      setFirebaseUser(credential.user);
      setAppUser(profile);
      return profile.role;
    } catch (error) {
      await signOut(auth);
      throw error;
    }
  };

  const logout = async () => { await signOut(auth); setAppUser(null); setAuthError(""); };

  const createCollaboratorAccount = async (email: string, password: string, name: string) => {
    const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);
    try {
      const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      return credential.user.uid;
    } finally { await deleteApp(secondaryApp); }
  };

  const sendPasswordSetupEmail = async (email: string) => {
    auth.useDeviceLanguage();
    // Use Firebase's default hosted action handler. This avoids rejected
    // continue URLs on preview/Vercel domains that are not yet authorized.
    await sendPasswordResetEmail(auth, email.trim());
  };

  return <AuthContext.Provider value={{ firebaseUser, appUser, role: appUser?.role ?? null, loading, authError, login, logout, createCollaboratorAccount, sendPasswordSetupEmail }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
