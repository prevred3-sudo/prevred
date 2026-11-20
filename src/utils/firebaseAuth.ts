import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '@/firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Startup Firestore connection check per Firebase integration specification
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration (Firestore client is offline).');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file'
];

export interface AppAuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}

// In-memory token cache (never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedAppUser: AppAuthUser | null = null;
let isSigningIn = false;

type AuthListener = (user: AppAuthUser | null, token: string | null) => void;
const listeners = new Set<AuthListener>();

function notifyListeners() {
  listeners.forEach((cb) => {
    try {
      cb(cachedAppUser, cachedAccessToken);
    } catch {
      // Ignore listener errors
    }
  });
}

export function subscribeGoogleAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeFirebaseAuthState(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      cachedAppUser = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL
      };
      notifyListeners();
    }
    cb(firebaseUser);
  });
}

// Global declaration for Google Identity Services (GSI)
declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string; error_description?: string }) => void;
            error_callback?: (error: { type?: string; message?: string } | unknown) => void;
            prompt?: string;
            login_hint?: string;
            hint?: string;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

function isRunAppHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('.run.app');
}

function isVercelHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('.vercel.app');
}

let preferGisAuth = false;

/**
 * Direct Google Identity Services (GIS) OAuth token flow + Firebase signInWithCredential.
 * Works on Cloud Run preview domains even if the domain is not in Firebase Auth's popup allowlist.
 */
export const signInViaGisAndFirebase = async (options?: {
  includeDriveScope?: boolean;
  loginHint?: string;
}): Promise<{
  user: AppAuthUser;
  accessToken: string;
}> => {
  const includeDriveScope = options?.includeDriveScope ?? false;
  const loginHint = options?.loginHint;

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Entorno de navegador no disponible'));
    }

    const clientId = firebaseConfig.oAuthClientId;
    if (!clientId) {
      return reject(new Error('No se encontró el oAuthClientId en la configuración'));
    }

    if (!window.google?.accounts?.oauth2) {
      return reject(new Error('El cliente de Google aún se está cargando. Espera 2 segundos e intenta de nuevo.'));
    }

    const scopes = includeDriveScope
      ? 'https://www.googleapis.com/auth/drive.file openid https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email'
      : 'openid https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes,
        prompt: 'select_account',
        ...(loginHint ? { login_hint: loginHint } : {}),
        callback: async (tokenResponse) => {
          if (tokenResponse.error || !tokenResponse.access_token) {
            return reject(
              new Error(tokenResponse.error_description || tokenResponse.error || 'Permiso denegado por el usuario')
            );
          }

          const accessToken = tokenResponse.access_token;
          if (includeDriveScope) {
            cachedAccessToken = accessToken;
          }

          // Sign into Firebase Auth using the Google OAuth accessToken so Cloud Firestore authenticates!
          try {
            const credential = GoogleAuthProvider.credential(null, accessToken);
            const fbResult = await signInWithCredential(auth, credential);
            const appUser: AppAuthUser = {
              uid: fbResult.user.uid,
              email: fbResult.user.email,
              displayName: fbResult.user.displayName,
              photoURL: fbResult.user.photoURL
            };
            cachedAppUser = appUser;
            notifyListeners();
            return resolve({ user: appUser, accessToken });
          } catch (fbCredErr) {
            console.warn('signInWithCredential falló, obteniendo perfil Google:', fbCredErr);
          }

          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (userRes.ok) {
              const profile = await userRes.json();
              const appUser: AppAuthUser = {
                uid: profile.sub || 'google-user',
                email: profile.email || loginHint || null,
                displayName: profile.name || 'Usuario Google',
                photoURL: profile.picture || null
              };
              cachedAppUser = appUser;
              notifyListeners();
              return resolve({ user: appUser, accessToken });
            }
          } catch {
            // Fallback user profile if userinfo endpoint times out
          }

          reject(new Error('No se pudo completar la sesión de Firebase con Google.'));
        },
        error_callback: (err: unknown) => {
          const errObj = err as { type?: string; message?: string } | null;
          if (errObj?.type === 'popup_closed') {
            reject(new Error('Ventana de inicio de sesión cerrada antes de completar el acceso.'));
          } else if (errObj?.type === 'popup_failed_to_open') {
            reject(new Error('popup-blocked: El navegador bloqueó la ventana emergente de Google.'));
          } else {
            reject(new Error(errObj?.message || errObj?.type || 'Error en la autenticación con Google'));
          }
        }
      });

      client.requestAccessToken();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
};

export const signInWithGoogleIdentityServices = async (): Promise<{
  user: AppAuthUser;
  accessToken: string;
}> => {
  return signInViaGisAndFirebase({
    includeDriveScope: true,
    loginHint: 'prevred3@gmail.com'
  });
};

export function formatFirebaseAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  const lower = raw.toLowerCase();

  if (lower.includes('unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return `El dominio ${host || 'actual'} no está autorizado aún en Firebase Auth (Authentication → Settings → Authorized domains).`;
  }
  if (lower.includes('popup-blocked') || lower.includes('popup_failed_to_open')) {
    return 'El navegador bloqueó la ventana emergente de Google. Habilita las ventanas emergentes e intenta nuevamente.';
  }
  if (lower.includes('popup-closed-by-user') || lower.includes('popup_closed') || lower.includes('cerrada antes')) {
    return 'Cerraste la ventana de Google antes de completar el acceso.';
  }
  if (lower.includes('cancelled-popup-request')) {
    return 'Se canceló la solicitud de inicio de sesión anterior.';
  }
  if (lower.includes('network-request-failed')) {
    return 'Error de red al conectar con Google. Verifica tu conexión e intenta de nuevo.';
  }
  if (lower.includes('redirect_uri_mismatch') || lower.includes('origin_mismatch')) {
    return 'El navegador no pudo validar el origen OAuth. Abre la Matriz en una pestaña nueva desde el enlace inferior.';
  }
  return raw || 'No se pudo completar el inicio de sesión con Google.';
}

/**
 * Lightweight Firebase Auth (NO Drive scope) for real-time Cloud Firestore sync on worker phones & Matrix.
 * Automatically uses GIS + signInWithCredential on Cloud Run domains or if Firebase Popup hits unauthorized-domain.
 */
export const signInWithFirebaseCloud = async (options?: {
  loginHint?: string;
}): Promise<AppAuthUser> => {
  if (isSigningIn) {
    throw new Error('Ya hay un proceso de inicio de sesión en curso.');
  }
  isSigningIn = true;
  try {
    const canUseGis = typeof window !== 'undefined' && Boolean(window.google?.accounts?.oauth2);

    if ((preferGisAuth || isRunAppHost() || isVercelHost()) && canUseGis) {
      try {
        const gisRes = await signInViaGisAndFirebase({
          includeDriveScope: false,
          loginHint: options?.loginHint
        });
        return gisRes.user;
      } catch (gisErr) {
        const msg = gisErr instanceof Error ? gisErr.message.toLowerCase() : String(gisErr).toLowerCase();
        // Do not fall back to signInWithPopup on .run.app or when user cancelled / popup was blocked
        if (
          isRunAppHost() ||
          msg.includes('cerrada') ||
          msg.includes('denegado') ||
          msg.includes('popup-blocked')
        ) {
          throw new Error(formatFirebaseAuthError(gisErr));
        }
        console.warn('GIS Auth falló, intentando Firebase Popup:', gisErr);
      }
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
        ...(options?.loginHint ? { login_hint: options.loginHint } : {})
      });
      const result = await signInWithPopup(auth, provider);
      const appUser: AppAuthUser = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL
      };
      cachedAppUser = appUser;
      notifyListeners();
      return appUser;
    } catch (popupErr: unknown) {
      const msg = popupErr instanceof Error ? popupErr.message : String(popupErr);
      if (
        msg.includes('unauthorized-domain') ||
        msg.includes('operation-not-supported') ||
        msg.includes('popup-blocked')
      ) {
        preferGisAuth = true;
        if (canUseGis) {
          const gisRes = await signInViaGisAndFirebase({
            includeDriveScope: false,
            loginHint: options?.loginHint
          });
          return gisRes.user;
        }
      }
      throw new Error(formatFirebaseAuthError(popupErr));
    }
  } finally {
    isSigningIn = false;
  }
};

/**
 * Firebase Auth popup (authenticates both Cloud Firestore AND provides Google Drive OAuth token)
 */
export const signInWithFirebasePopup = async (): Promise<{
  user: AppAuthUser;
  accessToken: string;
}> => {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.setCustomParameters({
    prompt: 'select_account',
    login_hint: 'prevred3@gmail.com'
  });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken || '';
  if (accessToken) {
    cachedAccessToken = accessToken;
  }

  const appUser: AppAuthUser = {
    uid: result.user.uid,
    email: result.user.email,
    displayName: result.user.displayName,
    photoURL: result.user.photoURL
  };
  cachedAppUser = appUser;
  notifyListeners();
  return { user: appUser, accessToken };
};

/**
 * Primary sign-in function for Drive-enabled flows:
 * Uses GIS + signInWithCredential on Cloud Run domains so both Drive and Firestore work without unauthorized-domain errors.
 */
export const googleSignIn = async (): Promise<{ user: AppAuthUser; accessToken: string }> => {
  if (isSigningIn) {
    throw new Error('Ya hay un proceso de inicio de sesión en curso.');
  }

  isSigningIn = true;
  try {
    const canUseGis = typeof window !== 'undefined' && Boolean(window.google?.accounts?.oauth2);
    if ((preferGisAuth || isRunAppHost() || isVercelHost()) && canUseGis) {
      try {
        return await signInWithGoogleIdentityServices();
      } catch (gisErr) {
        const msg = gisErr instanceof Error ? gisErr.message.toLowerCase() : String(gisErr).toLowerCase();
        if (
          isRunAppHost() ||
          msg.includes('cerrada') ||
          msg.includes('denegado') ||
          msg.includes('popup-blocked')
        ) {
          throw new Error(formatFirebaseAuthError(gisErr));
        }
        console.warn('GIS falló, intentando Firebase Popup:', gisErr);
      }
    }

    try {
      return await signInWithFirebasePopup();
    } catch (firebaseErr) {
      preferGisAuth = true;
      console.warn('Firebase Popup falló, intentando GIS como alternativa:', firebaseErr);
      if (canUseGis) {
        return await signInWithGoogleIdentityServices();
      }
      throw new Error(formatFirebaseAuthError(firebaseErr));
    }
  } finally {
    isSigningIn = false;
  }
};

export const getCurrentAppUser = (): AppAuthUser | null => {
  if (auth.currentUser) {
    return {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      displayName: auth.currentUser.displayName,
      photoURL: auth.currentUser.photoURL
    };
  }
  if (cachedAppUser) return cachedAppUser;
  return null;
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  notifyListeners();
};

export const logoutGoogle = async () => {
  try {
    await signOut(auth);
  } catch {
    // Ignore signout error
  }
  cachedAccessToken = null;
  cachedAppUser = null;
  notifyListeners();
};
