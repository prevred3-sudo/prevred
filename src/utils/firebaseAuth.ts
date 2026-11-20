import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import firebaseConfig from '@/firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

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

/**
 * Direct Google Identity Services (GIS) OAuth token flow.
 * Directly requests an OAuth 2.0 token from Google for the specified client ID,
 * bypassing Firebase Auth's domain restrictions (fixing auth/unauthorized-domain).
 */
export const signInWithGoogleIdentityServices = async (): Promise<{
  user: AppAuthUser;
  accessToken: string;
}> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Entorno de navegador no disponible'));
    }

    const clientId = firebaseConfig.oAuthClientId;
    if (!clientId) {
      return reject(new Error('No se encontró el oAuthClientId en la configuración'));
    }

    if (!window.google?.accounts?.oauth2) {
      return reject(new Error('El cliente de Google Identity Services aún se está cargando. Reintente en un momento.'));
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        prompt: 'select_account',
        login_hint: 'prevred3@gmail.com',
        callback: async (tokenResponse) => {
          if (tokenResponse.error || !tokenResponse.access_token) {
            return reject(
              new Error(tokenResponse.error_description || tokenResponse.error || 'Permiso denegado por el usuario')
            );
          }

          const accessToken = tokenResponse.access_token;
          cachedAccessToken = accessToken;

          // Fetch user info with the access token
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (userRes.ok) {
              const profile = await userRes.json();
              const appUser: AppAuthUser = {
                uid: profile.sub || 'google-user',
                email: profile.email || 'prevred3@gmail.com',
                displayName: profile.name || 'Prevencionista de Riesgos',
                photoURL: profile.picture || null
              };
              cachedAppUser = appUser;
              notifyListeners();
              return resolve({ user: appUser, accessToken });
            }
          } catch {
            // Fallback user profile if userinfo endpoint times out
          }

          const fallbackUser: AppAuthUser = {
            uid: 'prevred-uid',
            email: 'prevred3@gmail.com',
            displayName: 'Prevencionista de Riesgos',
            photoURL: null
          };
          cachedAppUser = fallbackUser;
          notifyListeners();
          resolve({ user: fallbackUser, accessToken });
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

/**
 * Fallback to Firebase Auth popup if GIS is not available
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
  if (!credential?.accessToken) {
    throw new Error('No se obtuvo el token de acceso de Google Drive.');
  }

  const accessToken = credential.accessToken;
  cachedAccessToken = accessToken;
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
 * Primary sign-in function:
 * First attempts Google Identity Services (which fixes auth/unauthorized-domain),
 * and falls back to Firebase Popup.
 */
export const googleSignIn = async (): Promise<{ user: AppAuthUser; accessToken: string }> => {
  if (isSigningIn) {
    throw new Error('Ya hay un proceso de inicio de sesión en curso.');
  }

  isSigningIn = true;
  try {
    if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
      try {
        return await signInWithGoogleIdentityServices();
      } catch (gisError) {
        console.warn('GIS falló, intentando Firebase Popup como alternativa:', gisError);
        return await signInWithFirebasePopup();
      }
    }

    return await signInWithFirebasePopup();
  } finally {
    isSigningIn = false;
  }
};

export const getCurrentAppUser = (): AppAuthUser | null => {
  if (cachedAppUser) return cachedAppUser;
  if (auth.currentUser) {
    return {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      displayName: auth.currentUser.displayName,
      photoURL: auth.currentUser.photoURL
    };
  }
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
