import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  HardDrive,
  LogOut,
  Download,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import { Incident } from '../types';
import { googleSignIn, logoutGoogle, getAccessToken, auth, parseAuthError, AuthErrorDiagnostic } from '../utils/firebaseAuth';
import { onAuthStateChanged, User } from 'firebase/auth';
import { uploadMasterSummaryToDrive, listPRLFilesFromDrive, DriveUploadedFile } from '../services/googleDriveService';

interface GoogleDriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidents: Incident[];
}

export const GoogleDriveSyncModal: React.FC<GoogleDriveSyncModalProps> = ({
  isOpen,
  onClose,
  incidents
}) => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [token, setToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<DriveUploadedFile[]>([]);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');
  const [authError, setAuthError] = useState<AuthErrorDiagnostic | null>(null);
  const [confirmSync, setConfirmSync] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const currentToken = await getAccessToken();
        setToken(currentToken);
        if (currentToken) {
          loadFiles(currentToken);
        }
      } else {
        setToken(null);
        setUploadedFiles([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadFiles = async (authToken: string) => {
    try {
      const files = await listPRLFilesFromDrive(authToken);
      setUploadedFiles(files);
    } catch {
      // Ignore initial silent list errors
    }
  };

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        await loadFiles(result.accessToken);
      }
    } catch (err: unknown) {
      const diag = parseAuthError(err);
      setAuthError(diag);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setUser(null);
    setToken(null);
    setUploadedFiles([]);
    setSyncSuccessMsg('');
    setAuthError(null);
  };

  const handleExecuteSync = async () => {
    if (!token) return;
    setIsSyncing(true);
    setAuthError(null);
    setSyncSuccessMsg('');
    try {
      const uploadedMaster = await uploadMasterSummaryToDrive(token, incidents);
      setSyncSuccessMsg(`¡Registro Maestro subido con éxito a Google Drive: ${uploadedMaster.name}!`);
      setConfirmSync(false);
      await loadFiles(token);
    } catch (err: unknown) {
      const diag = parseAuthError(err);
      setAuthError(diag);
    } finally {
      setIsSyncing(false);
    }
  };

  // Direct download fallback to ensure user can always export for Google Drive
  const handleDownloadMasterFile = () => {
    const payload = {
      sistema: 'PrevRiesgos PRL - Centro de Comando Matriz',
      supervisadoPorPrevencionista: 'prevred3@gmail.com',
      fechaExportacion: new Date().toISOString(),
      totalIncidentes: incidents.length,
      resumen: {
        abiertos: incidents.filter((i) => i.status === 'Abierto').length,
        enInvestigacion: incidents.filter((i) => i.status === 'En Investigación').length,
        enAccion: incidents.filter((i) => i.status === 'Acción en Curso').length,
        cerrados: incidents.filter((i) => i.status === 'Cerrado').length
      },
      expedientesYPlanesCAPA: incidents
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PrevRiesgos_Planes_Accion_PRL_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 text-slate-100 shadow-2xl space-y-5 my-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Alojamiento & Supervisión en Google Drive
              </h3>
              <p className="text-xs text-slate-400">
                Cuenta de Prevención: <strong className="text-slate-200">prevred3@gmail.com</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Auth Status Box */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
          {!user ? (
            <div className="text-center py-2 space-y-3">
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Conéctate para alojar los expedientes, fotografías y planes de acción (CAPA) directamente en tu Google Drive.
              </p>

              {/* Official Google Sign-In Styled Button */}
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="inline-flex items-center gap-3 bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold px-4 py-2.5 rounded-lg border border-slate-300 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span>{isSigningIn ? 'Conectando con Google...' : 'Acceder con Google (prevred3@gmail.com)'}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Usuario Google" className="w-9 h-9 rounded-full border border-slate-700" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <span>{user.displayName || 'Prevencionista de Riesgos'}</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded font-mono">
                      Conectado
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {user.email}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors text-xs flex items-center gap-1"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Desconectar</span>
              </button>
            </div>
          )}
        </div>

        {/* Detailed Diagnostics Box if Error Occurs */}
        {authError && (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/80 text-xs space-y-2.5">
            <div className="flex items-start gap-2.5 text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <div className="font-bold text-rose-200">
                  Aviso al conectar con Google ({authError.code})
                </div>
                <div className="text-rose-300/90 mt-0.5 leading-relaxed">
                  {authError.userHint}
                </div>
              </div>
            </div>

            {/* Quick Actions to resolve popup/iframe sandbox issues */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-900/40">
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-rose-900 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir en Pestaña Independiente</span>
              </a>

              <button
                onClick={handleSignIn}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-rose-200 border border-rose-800 rounded-lg text-xs font-medium"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {syncSuccessMsg && (
          <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{syncSuccessMsg}</span>
          </div>
        )}

        {/* Sync Action Area */}
        {user ? (
          <div className="space-y-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    Sincronización en la Nube
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Se exportará el expediente maestro con los {incidents.length} incidentes y sus planes de acción (CAPA).
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {incidents.filter(i => !i.correctiveActions.every(a => a.completed)).length}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Planes activos</span>
                </div>
              </div>

              {!confirmSync ? (
                <button
                  type="button"
                  onClick={() => setConfirmSync(true)}
                  className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-blue-950"
                >
                  <Cloud className="w-4 h-4" />
                  <span>Subir Datos y Planes a Google Drive</span>
                </button>
              ) : (
                <div className="p-3 bg-blue-950/40 border border-blue-600/50 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-blue-200">
                    ¿Confirmar subida de {incidents.length} informes a la carpeta "PrevRiesgos PRL" de su Google Drive?
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmSync(false)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-md"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteSync}
                      disabled={isSyncing}
                      className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-md flex items-center gap-1.5"
                    >
                      {isSyncing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{isSyncing ? 'Subiendo...' : 'Sí, Sincronizar'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* List of Files in Drive */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-slate-300">
                  Expedientes en Google Drive
                </span>
                <button
                  onClick={() => token && loadFiles(token)}
                  className="hover:text-amber-400 flex items-center gap-1 text-[11px]"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Actualizar lista</span>
                </button>
              </div>

              {uploadedFiles.length === 0 ? (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
                  Aún no has sincronizado expedientes en esta sesión.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <HardDrive className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="font-mono text-slate-300 truncate">
                          {file.name}
                        </span>
                      </div>
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px] shrink-0 font-medium"
                        >
                          <span>Abrir en Drive</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Offline / Direct Export Alternative when not signed in */
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">
                Descarga Local de Respaldo para Google Drive
              </span>
              <span className="text-[10px] text-amber-400 font-mono">
                {incidents.length} registros
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              También puedes descargar el expediente completo con la investigación de los 5 Porqués y planes de acción en formato JSON/Drive para importarlo o archivarlo manualmente.
            </p>
            <button
              onClick={handleDownloadMasterFile}
              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Descargar Expediente Maestro (.JSON)</span>
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg cursor-pointer"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
};
