import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

/**
 * Returns the Firebase Messaging instance, or null if not supported.
 * FCM requires a secure context (HTTPS or localhost) and a modern browser.
 */
export async function getFirebaseMessaging() {
  try {
    const supported = await isSupported();
    if (!supported) return null;
    return getMessaging(app);
  } catch (e) {
    console.warn("Firebase messaging not available:", e);
    return null;
  }
}

/**
 * Requests permission and retrieves the FCM token.
 * Returns null if permission is denied or FCM is unsupported.
 */
export async function getFcmToken(): Promise<string | null> {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn("VITE_FIREBASE_VAPID_KEY is not set");
      return null;
    }

    // Use the existing service worker (Vite PWA) if available, otherwise register the firebase one manually (for local dev mode)
    let swReg: ServiceWorkerRegistration | undefined;
    if ("serviceWorker" in navigator) {
      try {
        const existing = await navigator.serviceWorker.getRegistration();
        if (existing) {
          swReg = existing;
        } else {
          swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
        }
      } catch (e) {
        console.warn("Could not get or register service worker:", e);
      }
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });

    return token || null;
  } catch (e) {
    console.warn("getFcmToken failed:", e);
    return null;
  }
}

/**
 * Listen for foreground messages (app is open/focused).
 * Returns an unsubscribe function.
 */
export async function onForegroundMessage(
  handler: (payload: { title?: string; body?: string; link?: string }) => void
) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title;
    const body = payload.notification?.body;
    const link = (payload.data as any)?.link;
    handler({ title, body, link });
  });
}

export { app };
