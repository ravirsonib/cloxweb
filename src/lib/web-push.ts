import { registerPushDevice, unregisterPushDevice } from '@/lib/api/notifications';

const STORAGE_TOKEN_KEY = 'clox_web_push_token';
const SW_PATH = '/firebase-messaging-sw.js';
const SW_SCOPE = '/firebase-cloud-messaging-push-scope';

type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

function readFirebaseWebConfig(): FirebaseWebConfig | null {
  const apiKey = (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined)?.trim();
  const authDomain = (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined)?.trim();
  const projectId = (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined)?.trim();
  const messagingSenderId = (
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined
  )?.trim();
  const appId = (import.meta.env.VITE_FIREBASE_APP_ID as string | undefined)?.trim();
  const vapidKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined)?.trim();

  if (!apiKey || !projectId || !messagingSenderId || !appId || !vapidKey) {
    return null;
  }

  return {
    apiKey,
    authDomain: authDomain || `${projectId}.firebaseapp.com`,
    projectId,
    messagingSenderId,
    appId,
    vapidKey,
  };
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * True only when browser supports Web Push AND all VITE_FIREBASE_* keys are configured.
 * When false, Firebase is never initialized and the UI toggle stays hidden cleanly.
 */
export function isWebPushConfigured(): boolean {
  return isWebPushSupported() && readFirebaseWebConfig() !== null;
}

export function getWebPushPermission(): NotificationPermission | 'unsupported' {
  if (!isWebPushSupported()) return 'unsupported';
  return Notification.permission;
}

export function hasRegisteredWebPushToken(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage.getItem(STORAGE_TOKEN_KEY));
  } catch {
    return false;
  }
}

async function getFirebaseMessaging(config: FirebaseWebConfig) {
  const [{ getApps, initializeApp }, { getMessaging, isSupported }] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ]);
  const supported = await isSupported();
  if (!supported) return null;
  const app =
    getApps().length > 0
      ? getApps()[0]!
      : initializeApp({
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId,
        });
  return getMessaging(app);
}

export type EnableWebPushResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'not_configured' | 'unsupported' | 'denied' | 'error'; message?: string };

export async function enableWebPush(
  locale?: 'en' | 'hi' | 'pa',
): Promise<EnableWebPushResult> {
  const config = readFirebaseWebConfig();
  if (!config || !isWebPushSupported()) {
    return { ok: false, reason: 'not_configured' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'denied' };
    }

    const messaging = await getFirebaseMessaging(config);
    if (!messaging) {
      return { ok: false, reason: 'unsupported' };
    }

    const registration = await navigator.serviceWorker.register(SW_PATH, {
      scope: SW_SCOPE,
    });
    const { getToken } = await import('firebase/messaging');
    const token = await getToken(messaging, {
      vapidKey: config.vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) {
      return { ok: false, reason: 'error', message: 'No push token returned by browser' };
    }

    await registerPushDevice({
      token,
      platform: 'WEB',
      locale,
    });

    try {
      window.localStorage.setItem(STORAGE_TOKEN_KEY, token);
    } catch {
      // Ignore storage quota / private-mode errors
    }

    return { ok: true, token };
  } catch (error: unknown) {
    return {
      ok: false,
      reason: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Unregisters the current browser push token on logout or manual mute.
 * Best-effort: never throws so logout/UI flows are never blocked.
 */
export async function disableWebPush(): Promise<void> {
  if (typeof window === 'undefined') return;
  let token: string | null = null;
  try {
    token = window.localStorage.getItem(STORAGE_TOKEN_KEY);
    window.localStorage.removeItem(STORAGE_TOKEN_KEY);
  } catch {
    token = null;
  }

  if (token) {
    try {
      await unregisterPushDevice({ token });
    } catch {
      // Backend session revocation also cleans up the token.
    }
  }

  const config = readFirebaseWebConfig();
  if (!config || !isWebPushSupported()) return;
  try {
    const messaging = await getFirebaseMessaging(config);
    if (!messaging) return;
    const { deleteToken } = await import('firebase/messaging');
    await deleteToken(messaging);
  } catch {
    // Ignore browser cleanup failure
  }
}

export type ForegroundPushPayload = {
  title: string;
  body?: string;
  route?: string;
};

/**
 * Subscribes to foreground FCM web push messages while the CLOX tab is open.
 * No-ops cleanly when Firebase keys are not configured or permission is not granted.
 */
export function subscribeForegroundWebPush(
  onReceive: (payload: ForegroundPushPayload) => void,
): () => void {
  const config = readFirebaseWebConfig();
  if (!config || !isWebPushSupported() || Notification.permission !== 'granted') {
    return () => {};
  }

  let disposed = false;
  let unsub: (() => void) | null = null;

  void (async () => {
    try {
      const messaging = await getFirebaseMessaging(config);
      if (!messaging || disposed) return;
      const { onMessage } = await import('firebase/messaging');
      unsub = onMessage(messaging, (msg) => {
        const title = msg.notification?.title || msg.data?.title || 'CLOX Notification';
        const body = msg.notification?.body || msg.data?.body;
        const route = msg.data?.route;
        onReceive({ title, body, route });
      });
    } catch {
      // Never break app UI if Firebase messaging fails to attach
    }
  })();

  return () => {
    disposed = true;
    unsub?.();
  };
}
