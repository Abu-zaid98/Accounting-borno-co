import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

// إعدادات Firebase من ملف .env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || `https://${import.meta.env.VITE_FIREBASE_PROJECT_ID || ""}-default-rtdb.firebaseio.com`
};

// التحقق من صحة الإعدادات
export const isFirebaseConfigured = !!(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.authDomain
);

let auth: ReturnType<typeof getAuth> | null = null;
let rtdb: ReturnType<typeof getDatabase> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    rtdb = getDatabase(app);
    storage = getStorage(app);
    console.log("🔥 Firebase Realtime Database initialized successfully.");
  } catch (error) {
    console.error("⚠️ Firebase initialization failed, switching to Local Mode:", error);
  }
} else {
  console.warn("⚠️ Firebase not configured. Running in Offline/Local Mode.");
}

export { auth, rtdb, storage };
