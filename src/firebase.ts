import { initializeApp, getApps } from "firebase/app";

export function initFirebase() {
  // Avoid re-initializing in strict mode or hot reload
  if (getApps().length > 0) return;

  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  if (!apiKey || !authDomain || !projectId) {
    console.warn(
      "[Firebase] Missing VITE_FIREBASE_* env vars. Skipping Firebase initialization."
    );
    return;
  }

  initializeApp({
    apiKey,
    authDomain,
    projectId,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
}

