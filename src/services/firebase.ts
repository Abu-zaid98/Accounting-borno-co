import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { getAuth, signInAnonymously } from 'firebase/auth';

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
  firebaseConfig.projectId &&
  firebaseConfig.databaseURL &&
  firebaseConfig.apiKey
);

let rtdb: ReturnType<typeof getDatabase> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let authReadyPromise: Promise<void> = Promise.resolve();

if (isFirebaseConfigured) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    rtdb = getDatabase(app);
    storage = getStorage(app);
    auth = getAuth(app);
    
    // تسجيل دخول مخفي (مجهول) لإرضاء قواعد حماية Firebase Database (auth != null)
    authReadyPromise = signInAnonymously(auth)
      .then(() => console.log("✅ Anonymous Auth ready for RTDB."))
      .catch((err) => {
        console.warn("⚠️ Anonymous Auth failed. Permission Denied might occur.", err);
      });

    console.log("🔥 Firebase Realtime Database initialized successfully.");
  } catch (error) {
    console.error("⚠️ Firebase initialization failed:", error);
  }
} else {
  console.warn("⚠️ Firebase not configured. Running offline.");
}

export { rtdb, storage, auth, authReadyPromise };
