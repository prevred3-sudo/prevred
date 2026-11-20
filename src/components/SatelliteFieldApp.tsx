import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  AlertTriangle,
  MapPin,
  Send,
  CheckCircle2,
  Wifi,
  WifiOff,
  Flame,
  HardHat,
  ArrowLeft,
  Smartphone,
  Sparkles,
  History,
  RotateCcw,
  RefreshCw,
  Clock,
  Database,
  Trash2,
  Cloud,
  Power,
  X,
  Lock,
  Mic,
  Square
} from 'lucide-react';
import { Incident, IncidentType, SeverityLevel } from '../types';
import { safetyAudio } from '../utils/audioAlert';
import { usePWAInstall } from '../utils/usePWAInstall';
import { useOfflineSyncQueue } from '../utils/useOfflineSyncQueue';
import { getAccessToken, getCurrentAppUser } from '../utils/firebaseAuth';
import { saveIncidentToDrive } from '../services/googleDriveService';

import type { User } from 'firebase/auth';

interface SatelliteFieldAppProps {
  onBackToMatrix: () => void;
  isLockedSatellite?: boolean;
  onUnlockMatrixAsAdmin?: () => Promise<{ ok: boolean; error?: string }>;
  onSubmitIncident: (incident: Incident, options?: { skipApi?: boolean }) => Promise<any> | void;
  myRecentIncidents: Incident[];
  onTriggerEmergency: (location: string, message: string) => void;
  onDeleteIncident?: (id: string) => void;
  onOpenDriveModal?: () => void;
  cloudUser?: User | null;
  onConnectCloud?: () => void;
  isConnectingCloud?: boolean;
  cloudError?: string;
  onClearCloudError?: () => void;
}

const FIELD_ZONES = [
  'Sector 1 - Nave de Mecanizado',
  'Sector 2 - Patio de Carga y Maniobras',
  'Sector 3 - Almacén y Silos',
  'Sector 4 - Taller de Mantenimiento',
  'Sector 5 - Trabajos en Altura / Techumbre',
  'Sector 6 - Área de Soldadura'
];

export const SatelliteFieldApp: React.FC<SatelliteFieldAppProps> = ({
  onBackToMatrix,
  isLockedSatellite = false,
  onUnlockMatrixAsAdmin,
  onSubmitIncident,
  myRecentIncidents,
  onTriggerEmergency,
  onDeleteIncident,
  onOpenDriveModal,
  cloudUser,
  onConnectCloud,
  isConnectingCloud,
  cloudError,
  onClearCloudError
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  // Integrated Offline Sync Queue with IndexedDB & Exponential Backoff
  // Note: processOfflineQueue ALREADY saved the item to /api/incidents, so pass skipApi: true
  const {
    isOnline,
    pendingCount,
    pendingItems,
    isSyncing,
    lastSyncResult,
    triggerSync,
    enqueueIncident,
    removeOfflineItem
  } = useOfflineSyncQueue((syncedIncident) => {
    onSubmitIncident(syncedIncident, { skipApi: true });
  });

  // Field Form State
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<IncidentType>('Condición Insegura');
  const [selectedSeverity, setSelectedSeverity] = useState<SeverityLevel>('Moderado');
  const [zone, setZone] = useState(FIELD_ZONES[0]);
  const [gpsLocation, setGpsLocation] = useState<string>('');
  const [note, setNote] = useState('');
  const [workerName, setWorkerName] = useState('Operador Terreno');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [driveBackupNotice, setDriveBackupNotice] = useState('');
  const [showOfflineToast, setShowOfflineToast] = useState(false);
  const [sosSentToast, setSosSentToast] = useState(false);
  const [lastSubmittedCode, setLastSubmittedCode] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showEppPass, setShowEppPass] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [isAppClosed, setIsAppClosed] = useState(false);
  const [showAdminUnlockModal, setShowAdminUnlockModal] = useState(false);
  const [adminUnlockLoading, setAdminUnlockLoading] = useState(false);
  const [adminUnlockError, setAdminUnlockError] = useState('');
  const [activeTabHistory, setActiveTabHistory] = useState<'sent' | 'offline_queue'>('sent');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [driveConnectedEmail, setDriveConnectedEmail] = useState<string | null>(() => getCurrentAppUser()?.email || null);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');

  // Daily EPP Pass states
  const [eppChecks, setEppChecks] = useState({
    helmet: true,
    shoes: true,
    gloves: true,
    glasses: true
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{
    stop: () => void;
    abort: () => void;
  } | null>(null);
  const noteBaseRef = useRef<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      setDriveConnectedEmail(getCurrentAppUser()?.email || null);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []);

  const stopVoiceDictation = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Ignore stop errors
    }
    setIsListening(false);
    setInterimTranscript('');
  };

  const handleToggleVoiceDictation = () => {
    setVoiceError('');
    setValidationError('');

    if (isListening) {
      stopVoiceDictation();
      return;
    }

    if (typeof window === 'undefined') return;
    const win = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
        onerror: ((e: { error?: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
        abort: () => void;
      };
      webkitSpeechRecognition?: new () => {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
        onerror: ((e: { error?: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
        abort: () => void;
      };
    };

    const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setVoiceError('Este navegador no admite dictado directo. Usa el ícono de micrófono del teclado de tu teléfono o abre en Chrome/Safari.');
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = navigator.language?.startsWith('es') ? navigator.language : 'es-ES';
      recognition.continuous = true;
      recognition.interimResults = true;
      noteBaseRef.current = note.trim();

      recognition.onresult = (event) => {
        let finalSession = '';
        let interimSession = '';
        for (let i = 0; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res?.[0]?.transcript || '';
          if (res.isFinal) {
            finalSession += `${text} `;
          } else {
            interimSession += `${text} `;
          }
        }
        const cleanedFinal = finalSession.trim();
        const combined = [noteBaseRef.current, cleanedFinal].filter(Boolean).join(' ');
        setNote(combined);
        setInterimTranscript(interimSession.trim());
      };

      recognition.onerror = (event) => {
        const code = event?.error || '';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          setVoiceError('Permiso de micrófono denegado. Habilita el micrófono en tu navegador e intenta de nuevo.');
        } else if (code === 'no-speech') {
          setVoiceError('No se detectó voz. Acerca el micrófono y vuelve a pulsar para hablar.');
        } else if (code === 'audio-capture') {
          setVoiceError('No se encontró micrófono disponible en este dispositivo.');
        } else if (code === 'network') {
          setVoiceError('El dictado por voz requiere conexión de red en este navegador.');
        } else if (code !== 'aborted') {
          setVoiceError('No se pudo iniciar el dictado por voz. Intenta nuevamente.');
        }
        setIsListening(false);
        setInterimTranscript('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
      setVoiceError('No se pudo activar el micrófono en este dispositivo.');
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setValidationError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const rawResult = reader.result;
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const MAX_DIM = 1024;
              let width = img.width;
              let height = img.height;

              if (width > height && width > MAX_DIM) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              } else if (height > MAX_DIM) {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                let compressed = canvas.toDataURL('image/jpeg', 0.75);
                if (compressed.length > 620000) {
                  compressed = canvas.toDataURL('image/jpeg', 0.55);
                }
                setCapturedPhoto(compressed);
              } else {
                setCapturedPhoto(rawResult);
              }
            } catch {
              setCapturedPhoto(rawResult);
            }
          };
          img.onerror = () => {
            setCapturedPhoto(rawResult);
          };
          img.src = rawResult;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGetGPS = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = `GPS: Lat ${pos.coords.latitude.toFixed(4)}, Long ${pos.coords.longitude.toFixed(4)}`;
          setGpsLocation(coords);
        },
        () => {
          setGpsLocation('GPS: Ubicación en Planta Principal');
        },
        { timeout: 8000 }
      );
    } else {
      setGpsLocation('GPS no disponible en este dispositivo');
    }
  };

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening) {
      stopVoiceDictation();
    }
    setValidationError('');
    setDriveBackupNotice('');

    if (!note.trim() && !capturedPhoto) {
      setValidationError('Por favor tome una foto, dicte por voz o escriba una breve descripción del hallazgo antes de enviar.');
      return;
    }

    setIsSubmitting(true);
    const code = `TERRENO-${Math.floor(1000 + Math.random() * 9000)}`;

    const newIncident: Incident = {
      id: `field-${Date.now()}`,
      code,
      timestamp: new Date().toISOString(),
      timeFormatted: 'Registrado ahora mismo desde Satélite Móvil',
      title: note.trim() || `Hallazgo fotográfico en ${zone}`,
      description: `Reporte emitido desde la Aplicación Satélite Móvil por ${workerName}. ${gpsLocation ? `(${gpsLocation})` : ''}`,
      location: gpsLocation ? `${zone} · ${gpsLocation}` : zone,
      type: selectedType,
      severity: selectedSeverity,
      status: 'Abierto',
      reporterName: workerName.trim() || 'Operador Terreno',
      reporterRole: 'Trabajador en Terreno',
      immediateAction: 'Reportado de inmediato a Prevención Central vía Satélite.',
      photoUrl: capturedPhoto || undefined,
      rootCauseAnalysis: {
        why1: '',
        why2: '',
        why3: '',
        why4: '',
        why5: '',
        rootCauseSummary: ''
      },
      correctiveActions: [
        {
          action: 'Inspección de prevención en terreno requerida.',
          assignee: 'Prevención Central / Matriz',
          dueDate: 'Inmediata',
          completed: false,
          priority: selectedSeverity === 'Crítico' || selectedSeverity === 'Grave' ? 'Urgente' : 'Alta'
        }
      ]
    };

    if (!isOnline) {
      // OFFLINE MODE: Store directly in IndexedDB queue for automatic exponential backoff retry
      try {
        await enqueueIncident(newIncident, 'Almacenado localmente en IndexedDB por falta de conexión.');
        safetyAudio.playIncidentAlert('Moderado');
        setLastSubmittedCode(code);
        setShowOfflineToast(true);
        setTimeout(() => setShowOfflineToast(false), 5000);
      } catch (err) {
        console.error('Error al encolar en IndexedDB:', err);
      }
    } else {
      // ONLINE: Attempt immediate server transmission
      try {
        await onSubmitIncident(newIncident);
        setLastSubmittedCode(code);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 5000);

        // Check if user is logged into Google Drive (prevred3@gmail.com) for automatic cloud backup
        const token = await getAccessToken();
        if (token) {
          saveIncidentToDrive(token, newIncident)
            .then(() => {
              setDriveBackupNotice(`Respaldado también en Google Drive (${driveConnectedEmail || 'prevred3@gmail.com'})`);
            })
            .catch((driveErr) => {
              console.warn('[Google Drive] Respaldo automático falló:', driveErr);
            });
        }
      } catch (err) {
        // Transmission error fallback to IndexedDB
        await enqueueIncident(newIncident, 'Error de red durante transmisión a la Matriz');
        setLastSubmittedCode(code);
        setShowOfflineToast(true);
        setTimeout(() => setShowOfflineToast(false), 5000);
      }
    }

    setIsSubmitting(false);

    // Reset simple form
    setNote('');
    noteBaseRef.current = '';
    setInterimTranscript('');
    setCapturedPhoto(null);
    setGpsLocation('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTriggerSOS = () => {
    safetyAudio.playEmergencySiren();
    onTriggerEmergency(zone, `¡Alerta de pánico emitida por ${workerName} desde la Satélite Terreno!`);
    setShowEmergencyConfirm(false);
    setSosSentToast(true);
    setTimeout(() => setSosSentToast(false), 6000);
  };

  const handleCloseSatelliteApp = () => {
    setShowCloseConfirm(false);
    setIsAppClosed(true);
    try {
      window.close();
    } catch {
      // Browser prevented programmatic window close; fallback closed screen renders
    }
  };

  if (isAppClosed) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
            <Power className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-slate-100">
              Satélite PRL Cerrada
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              La aplicación de reportes en terreno se cerró de forma segura. Ya puedes salir o cerrar esta pestaña.
            </p>
          </div>
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAppClosed(false)}
              className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Reabrir Satélite PRL
            </button>
            {!isLockedSatellite ? (
              <button
                type="button"
                onClick={() => {
                  setIsAppClosed(false);
                  onBackToMatrix();
                }}
                className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition-colors cursor-pointer border border-slate-700"
              >
                Volver a Matriz PRL
              </button>
            ) : onUnlockMatrixAsAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setIsAppClosed(false);
                  setAdminUnlockError('');
                  setShowAdminUnlockModal(true);
                }}
                className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors cursor-pointer border border-slate-700 flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Acceso Matriz (Solo Admin)</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-12">
      {/* Top Mobile Field Bar */}
      <div className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {!isLockedSatellite ? (
            <button
              onClick={onBackToMatrix}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors py-1 cursor-pointer font-medium"
              title="Volver al Centro de Comando Matriz"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden xs:inline">Ir a Matriz PRL</span>
              <span className="xs:hidden">Matriz</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
              <HardHat className="w-3.5 h-3.5" />
              <span>Terreno</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <h1 className="text-sm font-bold tracking-tight text-slate-100">
              Satélite PRL
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Google Drive Button (hidden on locked worker phones) */}
            {!isLockedSatellite && onOpenDriveModal && (
              <button
                onClick={onOpenDriveModal}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono bg-blue-950/80 text-blue-300 border border-blue-800/60 hover:bg-blue-900/80 cursor-pointer transition-colors"
                title="Alojamiento & Respaldo en Google Drive (prevred3@gmail.com)"
              >
                <Cloud className="w-3 h-3 text-blue-400" />
                <span className="hidden sm:inline">Drive</span>
              </button>
            )}

            {/* Online/Offline status indicator */}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono ${
                isOnline
                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-800/60 animate-pulse'
              }`}
              title={isOnline ? 'En línea con la Matriz' : 'Sin conexión: Modo Offline activo con IndexedDB'}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span className="hidden sm:inline">Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-rose-400" />
                  <span>Offline</span>
                </>
              )}
            </div>

            {/* PWA Install Button for mobile (auto-hides once installed in standalone mode) */}
            {!isInstalled && isInstallable && (
              <button
                onClick={install}
                className="px-2.5 py-1 text-[11px] font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded flex items-center gap-1 cursor-pointer"
                title="Instalar App Satélite en pantalla de inicio"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Instalar</span>
              </button>
            )}

            {!isInstalled && isIOS && (
              <button
                onClick={() => setShowIOSModal(true)}
                className="px-2 py-1 text-[11px] font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded flex items-center gap-1 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Instalar</span>
              </button>
            )}

            {/* Close Satellite App Button */}
            <button
              type="button"
              onClick={() => setShowCloseConfirm(true)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/70 cursor-pointer transition-colors"
              title="Cerrar Aplicación Satélite"
            >
              <Power className="w-3 h-3 text-rose-400" />
              <span>Cerrar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Satélite-to-Matrix Realtime Bridge Status Card */}
      <div className="bg-slate-900/80 border-b border-slate-800 px-4 py-2 text-xs">
        <div className="max-w-md mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-300">
            <div className={`w-2 h-2 rounded-full ${cloudUser ? 'bg-emerald-400 animate-pulse' : isOnline ? 'bg-amber-400' : 'bg-rose-500'}`} />
            <span className="text-[11px]">
              {cloudUser
                ? `Tiempo Real con Matriz (${cloudUser.email})`
                : isOnline
                ? 'Solo local · Falta Conectar Nube'
                : 'Sin red: Cola IndexedDB'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isLockedSatellite && onOpenDriveModal && (
              <button
                type="button"
                onClick={onOpenDriveModal}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
              >
                <Cloud className="w-3 h-3" />
                <span className="hidden xs:inline">prevred3@gmail.com</span>
                <span className="xs:hidden">Drive</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => triggerSync(true)}
              disabled={isSyncing || !isOnline}
              className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer disabled:opacity-40"
              title="Forzar sincronización inmediata con la Matriz"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated Worker App Install Banner (ONLY shown when opened via QR /satellite?locked=1 and not yet installed) */}
      {isLockedSatellite && !isInstalled && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-100">
          <div className="max-w-md mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-[11px] leading-snug">
                Instala <strong>Satélite PRL</strong> en tu teléfono para enviar reportes directos a la Matriz.
              </span>
            </div>
            {isInstallable ? (
              <button
                type="button"
                onClick={install}
                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded text-[11px] shrink-0 cursor-pointer"
              >
                Instalar App
              </button>
            ) : isIOS ? (
              <button
                type="button"
                onClick={() => setShowIOSModal(true)}
                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded text-[11px] shrink-0 cursor-pointer"
              >
                Cómo Instalar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAndroidGuide(true)}
                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded text-[11px] shrink-0 cursor-pointer"
              >
                Instalar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cloud Connect Banner when opened on mobile without Google sign-in */}
      {!cloudUser && onConnectCloud && (
        <div className="bg-blue-950/80 border-b border-blue-700/50 px-4 py-2 text-xs text-blue-100">
          <div className="max-w-md mx-auto space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] leading-snug">
                Conecta tu cuenta Google para enviar reportes en tiempo real a la Matriz PRL.
              </span>
              <button
                type="button"
                onClick={onConnectCloud}
                disabled={isConnectingCloud}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-[11px] shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isConnectingCloud ? 'Conectando...' : 'Conectar Nube'}
              </button>
            </div>
            {cloudError && (
              <div className="bg-rose-950/80 border border-rose-700/70 text-rose-200 px-2.5 py-1.5 rounded flex items-center justify-between gap-2 text-[11px]">
                <span>{cloudError}</span>
                {onClearCloudError && (
                  <button
                    type="button"
                    onClick={onClearCloudError}
                    className="text-rose-300 hover:text-white cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offline Queue Reattempt & Backoff Status Strip */}
      {pendingCount > 0 && (
        <div className="bg-amber-950/90 border-b border-amber-600/40 px-4 py-2.5 text-xs text-amber-200 shadow-md">
          <div className="max-w-md mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-amber-100">
                  {pendingCount} en cola IndexedDB
                </span>
                <span className="text-amber-300/80 block text-[11px]">
                  {isOnline ? 'Reintentando con backoff exponencial...' : 'Se enviarán al recuperar señal'}
                </span>
              </div>
            </div>

            {isOnline && (
              <button
                onClick={() => triggerSync(true)}
                disabled={isSyncing}
                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Enviando...' : 'Reintentar'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Field Container (Max-w-md designed for mobile screen & quick thumbs) */}
      <main className="max-w-md w-full mx-auto px-4 pt-4 flex-1 flex flex-col space-y-4">
        {/* Worker Badge & Quick Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 font-bold text-sm">
              <HardHat className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Trabajador asignado:</div>
              <input
                type="text"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                className="text-xs font-bold text-slate-100 bg-transparent border-b border-slate-700 focus:border-amber-400 focus:outline-none max-w-[170px]"
                placeholder="Su Nombre"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowEppPass(!showEppPass)}
              className="p-2 text-slate-400 hover:text-amber-400 bg-slate-950 border border-slate-800 rounded-lg text-xs font-medium cursor-pointer"
              title="Pase EPP diario"
            >
              EPP
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 text-slate-400 hover:text-amber-400 bg-slate-950 border border-slate-800 rounded-lg text-xs font-medium cursor-pointer relative"
              title="Mis envíos y cola offline"
            >
              <History className="w-4 h-4" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 text-[10px] font-bold rounded-full flex items-center justify-center font-mono">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* EPP Quick Daily Check Dropdown */}
        {showEppPass && (
          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <HardHat className="w-4 h-4" />
                <span>Pase Diario de Seguridad</span>
              </div>
              <button
                onClick={() => setShowEppPass(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Cerrar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setEppChecks(p => ({ ...p, helmet: !p.helmet }))}
                className={`p-2.5 rounded-lg border text-left flex items-center justify-between cursor-pointer ${
                  eppChecks.helmet ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300' : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
              >
                <span>Casco y Barbiquejo</span>
                <CheckCircle2 className={`w-4 h-4 ${eppChecks.helmet ? 'text-emerald-400' : 'text-slate-600'}`} />
              </button>
              <button
                type="button"
                onClick={() => setEppChecks(p => ({ ...p, shoes: !p.shoes }))}
                className={`p-2.5 rounded-lg border text-left flex items-center justify-between cursor-pointer ${
                  eppChecks.shoes ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300' : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
              >
                <span>Calzado Puntera</span>
                <CheckCircle2 className={`w-4 h-4 ${eppChecks.shoes ? 'text-emerald-400' : 'text-slate-600'}`} />
              </button>
              <button
                type="button"
                onClick={() => setEppChecks(p => ({ ...p, glasses: !p.glasses }))}
                className={`p-2.5 rounded-lg border text-left flex items-center justify-between cursor-pointer ${
                  eppChecks.glasses ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300' : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
              >
                <span>Gafas Seguridad</span>
                <CheckCircle2 className={`w-4 h-4 ${eppChecks.glasses ? 'text-emerald-400' : 'text-slate-600'}`} />
              </button>
              <button
                type="button"
                onClick={() => setEppChecks(p => ({ ...p, gloves: !p.gloves }))}
                className={`p-2.5 rounded-lg border text-left flex items-center justify-between cursor-pointer ${
                  eppChecks.gloves ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300' : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
              >
                <span>Guantes según FDS</span>
                <CheckCircle2 className={`w-4 h-4 ${eppChecks.gloves ? 'text-emerald-400' : 'text-slate-600'}`} />
              </button>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
              <span>Estado: {Object.values(eppChecks).every(Boolean) ? '100% Protegido para iniciar labor' : 'Revisar EPP faltante'}</span>
            </div>
          </div>
        )}

        {/* SOS Panic Button Strip */}
        <div className="bg-gradient-to-r from-rose-950/60 to-slate-900 border border-rose-900/50 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-rose-900">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-rose-200">¿Emergencia Inmediata?</div>
              <div className="text-[11px] text-rose-400">Pánico / Fuego / Derrame grave</div>
            </div>
          </div>
          <button
            onClick={() => setShowEmergencyConfirm(true)}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer whitespace-nowrap active:scale-95"
          >
            BOTÓN SOS
          </button>
        </div>

        {/* Validation Error Banner (replaces blocked window.alert) */}
        {validationError && (
          <div className="bg-rose-950/90 border border-rose-500/50 rounded-xl p-3.5 text-rose-200 flex items-start gap-2.5 text-xs shadow-lg">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {/* SOS Transmitted Toast */}
        {sosSentToast && (
          <div className="bg-rose-950 border border-rose-500 rounded-xl p-4 text-rose-100 flex items-start gap-3 shadow-xl">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-white">
                ¡Alerta SOS Transmitida con Máxima Prioridad!
              </div>
              <div className="text-xs text-rose-200 mt-0.5">
                La Matriz PRL recibió su señal de emergencia en tiempo real para el sector <strong>{zone}</strong>.
              </div>
            </div>
          </div>
        )}

        {/* Online Success Toast */}
        {showSuccessToast && (
          <div className="bg-emerald-950/90 border border-emerald-500/40 rounded-xl p-4 text-emerald-200 flex items-start gap-3 shadow-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-emerald-100">
                {cloudUser
                  ? '¡Hallazgo Transmitido a la Matriz en Tiempo Real!'
                  : 'Reporte Guardado en el Dispositivo'}
              </div>
              <div className="text-xs text-emerald-300 mt-0.5">
                Registrado bajo código <span className="font-mono font-bold">{lastSubmittedCode}</span>.
                {!cloudUser && ' Pulsa "Conectar Nube" arriba para sincronizarlo en vivo con la Matriz.'}
              </div>
              {driveBackupNotice && (
                <div className="text-[11px] text-blue-300 mt-1 flex items-center gap-1">
                  <Cloud className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>{driveBackupNotice}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Offline Saved in IndexedDB Toast */}
        {showOfflineToast && (
          <div className="bg-amber-950/90 border border-amber-500/40 rounded-xl p-4 text-amber-200 flex items-start gap-3 shadow-xl">
            <Database className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-amber-100">
                Guardado en Modo Offline (IndexedDB)
              </div>
              <div className="text-xs text-amber-300/90 mt-0.5 leading-relaxed">
                Sin señal en terreno. El reporte y la foto quedaron almacenados localmente y se transmitirán automáticamente a la Matriz con reintento exponencial al volver a conectarte.
              </div>
            </div>
          </div>
        )}

        {/* Success sync feedback */}
        {lastSyncResult && lastSyncResult.synced > 0 && (
          <div className="bg-blue-950/90 border border-blue-500/40 rounded-xl p-3 text-blue-200 flex items-center gap-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              ¡{lastSyncResult.synced} reporte(s) offline sincronizado(s) exitosamente con la Matriz!
            </span>
          </div>
        )}

        {/* MAIN CAPTURE FORM */}
        <form onSubmit={handleSendReport} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
              1. Tomar Foto del Hallazgo
            </span>
            {capturedPhoto && (
              <button
                type="button"
                onClick={() => setCapturedPhoto(null)}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Borrar foto</span>
              </button>
            )}
          </div>

          {/* Photo Capture Area */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handlePhotoCapture}
            className="hidden"
          />

          {!capturedPhoto ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-amber-500/50 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 group active:scale-[0.99]"
            >
              <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                <Camera className="w-7 h-7" />
              </div>
              <div className="text-sm font-bold text-slate-100">
                Pulsar aquí para abrir Cámara
              </div>
              <p className="text-xs text-slate-400 max-w-xs">
                Tome una fotografía directa de la condición insegura, cable suelto o peligro
              </p>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black aspect-video max-h-56 flex items-center justify-center">
              <img
                src={capturedPhoto}
                alt="Foto capturada en terreno"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 px-3 py-1 bg-slate-900/90 text-amber-300 text-xs font-semibold rounded-md border border-slate-700 flex items-center gap-1 backdrop-blur-sm cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Cambiar Foto</span>
              </button>
            </div>
          )}

          {/* Classification Options */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
              2. ¿Qué Tipo de Hallazgo es?
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'Condición Insegura' as IncidentType, label: '⚠️ Condición Insegura', desc: 'Peligro en el entorno o equipo' },
                { type: 'Acto Inseguro' as IncidentType, label: '🚫 Acto Inseguro', desc: 'Comportamiento no seguro' },
                { type: 'Casi Accidente (Near Miss)' as IncidentType, label: '⚡ Casi Accidente', desc: 'Estuvo a punto de pasar algo' },
                { type: 'Emergencia / Conato' as IncidentType, label: '🆘 Riesgo Inminente', desc: 'Requiere atención urgente' }
              ].map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => {
                    setSelectedType(item.type);
                    if (item.type === 'Emergencia / Conato') {
                      setSelectedSeverity('Crítico');
                    } else if (item.type === 'Casi Accidente (Near Miss)') {
                      setSelectedSeverity('Grave');
                    }
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedType === item.type
                      ? 'border-amber-400 bg-amber-500/10 text-white shadow-sm'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-100">{item.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Location & GPS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                3. Ubicación del Hallazgo
              </span>
              <button
                type="button"
                onClick={handleGetGPS}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-medium"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{gpsLocation ? 'GPS capturado' : 'Detectar GPS'}</span>
              </button>
            </div>

            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              {FIELD_ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>

            {gpsLocation && (
              <div className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-1 rounded">
                📍 {gpsLocation}
              </div>
            )}
          </div>

          {/* Note / Description with Voice Dictation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
                4. Breve Comentario / Nota
              </span>
              <button
                type="button"
                onClick={handleToggleVoiceDictation}
                aria-label={isListening ? 'Detener dictado por voz' : 'Dictar reporte por voz con micrófono'}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse shadow-md shadow-rose-950'
                    : 'bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/40'
                }`}
              >
                {isListening ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Detener Voz</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5" />
                    <span>Dictar por Voz</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={3}
              placeholder="Pulsa 'Dictar por Voz' para hablar sin escribir, o escribe aquí..."
              value={isListening && interimTranscript ? (note ? `${note} ${interimTranscript}` : interimTranscript) : note}
              onChange={(e) => {
                if (isListening) stopVoiceDictation();
                setNote(e.target.value);
              }}
              className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none resize-none transition-colors ${
                isListening
                  ? 'border-rose-500 ring-1 ring-rose-500/40'
                  : 'border-slate-700 focus:border-amber-400'
              }`}
            />
            {isListening && (
              <div className="flex items-center gap-2 text-[11px] text-rose-300 bg-rose-950/50 border border-rose-700/50 rounded-lg px-2.5 py-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping shrink-0" />
                <span>Escuchando micrófono... Habla claro y pulsa <strong>Detener Voz</strong> al terminar.</span>
              </div>
            )}
            {!isListening && note.trim().length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setNote('');
                    noteBaseRef.current = '';
                  }}
                  className="text-[11px] text-slate-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Borrar texto</span>
                </button>
              </div>
            )}
            {voiceError && (
              <div className="text-[11px] text-amber-200 bg-amber-950/60 border border-amber-700/50 rounded-lg px-2.5 py-1.5">
                {voiceError}
              </div>
            )}
          </div>

          {/* Big Action Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-amber-950/60 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <Send className="w-4 h-4 text-slate-950" />
            <span>
              {isSubmitting
                ? 'PROCESANDO...'
                : !isOnline
                ? 'GUARDAR OFFLINE (SE ENVIARÁ CON SEÑAL)'
                : 'ENVIAR REPORTE A MATRIZ'}
            </span>
          </button>
        </form>

        {/* Field History & Offline Queue View */}
        {showHistory && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTabHistory('sent')}
                  className={`py-1 px-2.5 rounded-lg cursor-pointer transition-colors ${
                    activeTabHistory === 'sent'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Transmitidos ({myRecentIncidents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabHistory('offline_queue')}
                  className={`py-1 px-2.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1 ${
                    activeTabHistory === 'offline_queue'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>IndexedDB Offline</span>
                  {pendingCount > 0 && (
                    <span className="font-mono text-[10px] bg-amber-600 text-white px-1.5 rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </button>
              </div>

              <button
                onClick={() => setShowHistory(false)}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            {/* Sub-tab 1: Sent Incidents */}
            {activeTabHistory === 'sent' && (
              myRecentIncidents.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  No has emitido reportes en esta sesión.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {myRecentIncidents.slice(0, 6).map((inc) => (
                    <div
                      key={inc.id}
                      className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-start justify-between gap-2 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                          <span className="text-amber-400 font-bold">{inc.code}</span>
                          <span>·</span>
                          <span className="truncate max-w-[130px]">{inc.location}</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-200 mt-0.5 line-clamp-1">
                          {inc.title}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                          En Matriz
                        </span>
                        {onDeleteIncident && (
                          confirmDeleteId === inc.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteIncident(inc.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded cursor-pointer"
                            >
                              Confirmar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(inc.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                              title="Eliminar reporte"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Sub-tab 2: Offline Pending Queue in IndexedDB */}
            {activeTabHistory === 'offline_queue' && (
              pendingItems.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  No hay reportes pendientes en IndexedDB. Todo sincronizado.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {pendingItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 bg-slate-950 rounded-xl border border-amber-900/60 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-amber-400">
                          {item.incident.code}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded">
                            Reintentos: {item.retryCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeOfflineItem(item.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                            title="Descartar reporte pendiente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="text-slate-200 font-medium line-clamp-1">
                        {item.incident.title}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>Guardado en IndexedDB</span>
                        </span>
                        {item.lastError && (
                          <span className="text-rose-400 truncate max-w-[120px]">
                            {item.lastError}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {isOnline && (
                    <button
                      type="button"
                      onClick={() => triggerSync(true)}
                      disabled={isSyncing}
                      className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Transmitiendo a Matriz...' : 'Sincronizar Todo Ahora'}</span>
                    </button>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* Explicit Footer Close Satellite Button for Thumb Access */}
        <div className="pt-2 pb-4 space-y-2">
          <button
            type="button"
            onClick={() => setShowCloseConfirm(true)}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-200 border border-slate-800 hover:border-rose-800/70 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Power className="w-4 h-4 text-rose-400" />
            <span>Cerrar Aplicación Satélite</span>
          </button>

          {isLockedSatellite && onUnlockMatrixAsAdmin && (
            <button
              type="button"
              onClick={() => {
                setAdminUnlockError('');
                setShowAdminUnlockModal(true);
              }}
              className="w-full py-1.5 text-[11px] text-slate-500 hover:text-amber-400 flex items-center justify-center gap-1 transition-colors cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              <span>Acceso Administrador a Matriz PRL</span>
            </button>
          )}
        </div>
      </main>

      {/* Emergency Confirmation Modal */}
      {showEmergencyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm">
          <div className="bg-rose-950 border border-rose-600 rounded-2xl max-w-sm w-full p-5 text-rose-100 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-600 rounded-full text-white">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Confirmar Alerta SOS
                </h3>
                <p className="text-xs text-rose-300">
                  Activará la alarma general en el centro de control Matriz PRL.
                </p>
              </div>
            </div>
            <div className="text-xs bg-rose-900/50 p-2.5 rounded-lg border border-rose-800">
              Sector actual: <strong className="text-white">{zone}</strong>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowEmergencyConfirm(false)}
                className="flex-1 py-2 text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleTriggerSOS}
                className="flex-1 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-lg cursor-pointer"
              >
                ¡ACTIVAR ALERTA!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Installation Instruction Guide */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xs w-full p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Instalar Satélite PRL en iPhone</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              1. Pulsa el botón <strong>Compartir</strong> en la barra inferior de Safari.<br />
              2. Desliza hacia abajo y pulsa <strong>"Agregar a pantalla de inicio"</strong>.<br />
              3. Solo se instalará la App Satélite de reportes en terreno.
            </p>
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2 bg-slate-800 text-slate-200 text-xs font-medium rounded-lg cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Android / Browser Manual Install Guide */}
      {showAndroidGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xs w-full p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-amber-400" />
              <span>Instalar Satélite PRL en Android</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              1. Abre el menú del navegador (los <strong>3 puntos ⋮</strong> arriba a la derecha en Chrome).<br />
              2. Toca <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.<br />
              3. Quedará instalada únicamente la App Satélite de terreno.
            </p>
            <button
              onClick={() => setShowAndroidGuide(false)}
              className="w-full py-2 bg-slate-800 text-slate-200 text-xs font-medium rounded-lg cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Close App Confirmation Modal */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xs w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Power className="w-4 h-4 text-rose-400" />
                <span>¿Cerrar Satélite PRL?</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {pendingCount > 0
                ? `Tienes ${pendingCount} reporte(s) pendientes en cola offline. Permanecerán guardados en el teléfono hasta que vuelvas a abrir la app.`
                : 'Se cerrará la ventana de la aplicación móvil de reportes en terreno.'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCloseSatelliteApp}
                className="flex-1 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg cursor-pointer"
              >
                Sí, Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin-Only Matrix Access Modal (prevents workers from entering Matrix) */}
      {showAdminUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xs w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Acceso Matriz PRL (Admin)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAdminUnlockModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              La App Satélite está bloqueada para uso en terreno. Inicia sesión con la cuenta administradora{' '}
              <strong className="text-amber-400">prevred3@gmail.com</strong> para abrir la Aplicación Matriz.
            </p>
            {adminUnlockError && (
              <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-700/70 text-[11px] text-rose-200 space-y-2">
                <div>{adminUnlockError}</div>
                <a
                  href={typeof window !== 'undefined' ? window.location.origin : '/'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-amber-300 underline font-semibold"
                >
                  Abrir Matriz en pestaña nueva
                </a>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAdminUnlockModal(false)}
                className="flex-1 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={adminUnlockLoading}
                onClick={async () => {
                  if (!onUnlockMatrixAsAdmin) return;
                  setAdminUnlockLoading(true);
                  setAdminUnlockError('');
                  const res = await onUnlockMatrixAsAdmin();
                  setAdminUnlockLoading(false);
                  if (res.ok) {
                    setShowAdminUnlockModal(false);
                  } else if (res.error) {
                    setAdminUnlockError(res.error);
                  }
                }}
                className="flex-1 py-2 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg cursor-pointer disabled:opacity-50"
              >
                {adminUnlockLoading ? 'Verificando...' : 'Entrar con Google'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
