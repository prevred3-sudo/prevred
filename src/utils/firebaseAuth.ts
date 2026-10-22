import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import firebaseConfig from '@/firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file'
];

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
  login_hint: 'prevred3@gmail.com'
});

// In-memory token cache (never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

export interface AuthErrorDiagnostic {
  code: string;
  message: string;
  userHint: string;
}

export const parseAuthError = (err: unknown): AuthErrorDiagnostic => {
  const errorObj = err as { code?: string; message?: string };
  const code = errorObj?.code || 'auth/unknown';
  const originalMsg = errorObj?.message || 'Error desconocido';

  let userHint = 'Ocurrió un error al contactar el servicio de autenticación de Google.';

  if (code === 'auth/popup-blocked') {
    userHint = 'Tu navegador bloqueó la ventana emergente de inicio de sesión de Google. Permite ventanas emergentes para este sitio o pulsa "Abrir en Pestaña Nueva".';
  } else if (code === 'auth/popup-closed-by-user') {
    userHint = 'Se cerró la ventana de Google antes de finalizar la autorización.';
  } else if (code === 'auth/cancelled-popup-request') {
    userHint = 'Había otra solicitud de acceso en curso. Inténtalo de nuevo.';
  } else if (code === 'auth/unauthorized-domain') {
    userHint = 'Este dominio de previsualización no tiene permisos directos de iframe. Abre la aplicación en una pestaña nueva o usa la exportación directa.';
  } else if (code === 'auth/network-request-failed') {
    userHint = 'Error de red al conectar con los servidores de Google. Verifica tu conexión a Internet.';
  } else if (originalMsg.includes('access token')) {
    userHint = 'No se recibieron los permisos para Google Drive en la cuenta seleccionada. Asegúrate de conceder el permiso en la pantalla de Google.';
  }

  return { code, message: originalMsg, userHint };
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se obtuvo el token de acceso de Google Drive desde la credencial.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
