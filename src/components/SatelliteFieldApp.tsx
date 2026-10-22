import React, { useState, useRef } from 'react';
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
  Trash2
} from 'lucide-react';
import { Incident, IncidentType, SeverityLevel } from '../types';
import { safetyAudio } from '../utils/audioAlert';
import { usePWAInstall } from '../utils/usePWAInstall';
import { useOfflineSyncQueue } from '../utils/useOfflineSyncQueue';

interface SatelliteFieldAppProps {
  onBackToMatrix: () => void;
  onSubmitIncident: (incident: Incident) => void;
  myRecentIncidents: Incident[];
  onTriggerEmergency: (location: string, message: string) => void;
  onDeleteIncident?: (id: string) => void;
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
  onSubmitIncident,
  myRecentIncidents,
  onTriggerEmergency,
  onDeleteIncident
}) => {
  const { isInstallable, install, isIOS } = usePWAInstall();

  // Integrated Offline Sync Queue with IndexedDB & Exponential Backoff
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
    onSubmitIncident(syncedIncident);
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
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showOfflineToast, setShowOfflineToast] = useState(false);
  const [lastSubmittedCode, setLastSubmittedCode] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showEppPass, setShowEppPass] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [activeTabHistory, setActiveTabHistory] = useState<'sent' | 'offline_queue'>('sent');

  // Daily EPP Pass states
  const [eppChecks, setEppChecks] = useState({
    helmet: true,
    shoes: true,
    gloves: true,
    glasses: true
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_DIM = 1280;
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
              const compressed = canvas.toDataURL('image/jpeg', 0.82);
              setCapturedPhoto(compressed);
            } else {
              setCapturedPhoto(reader.result as string);
            }
          };
          img.src = reader.result;
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
    if (!note.trim() && !capturedPhoto) {
      alert('Por favor tome una foto o escriba una breve descripción del hallazgo.');
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
      reporterName: workerName,
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
        safetyAudio.playIncidentAlert(selectedSeverity);
        onSubmitIncident(newIncident);
        setLastSubmittedCode(code);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 4500);
      } catch (err) {
        // Transmission error fallback to IndexedDB
        await enqueueIncident(newIncident, 'Error de red durante transmisión');
        setShowOfflineToast(true);
        setTimeout(() => setShowOfflineToast(false), 5000);
      }
    }

    setIsSubmitting(false);

    // Reset simple form
    setNote('');
    setCapturedPhoto(null);
    setGpsLocation('');
  };

  const handleTriggerSOS = () => {
    safetyAudio.playEmergencySiren();
    onTriggerEmergency(zone, `¡Alerta de pánico emitida por ${workerName} desde la Satélite Terreno!`);
    setShowEmergencyConfirm(false);
    alert('¡Alerta SOS transmitida con máxima prioridad a la Matriz PRL!');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-12">
      {/* Top Mobile Field Bar */}
      <div className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-3 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            onClick={onBackToMatrix}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors py-1 cursor-pointer font-medium"
            title="Volver al Centro de Comando Matriz"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Ir a Matriz PRL</span>
            <span className="xs:hidden">Matriz</span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <h1 className="text-sm font-bold tracking-tight text-slate-100">
              Satélite Terreno
            </h1>
          </div>

          <div className="flex items-center gap-2">
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

            {/* PWA Install Button for mobile */}
            {isInstallable && (
              <button
                onClick={install}
                className="px-2.5 py-1 text-[11px] font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded flex items-center gap-1 cursor-pointer"
                title="Instalar en pantalla de inicio"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Instalar</span>
              </button>
            )}

            {isIOS && (
              <button
                onClick={() => setShowIOSModal(true)}
                className="px-2 py-1 text-[11px] border border-slate-700 hover:border-slate-500 text-slate-300 rounded cursor-pointer"
              >
                iOS
              </button>
            )}
          </div>
        </div>
      </div>

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

        {/* Online Success Toast */}
        {showSuccessToast && (
          <div className="bg-emerald-950/90 border border-emerald-500/40 rounded-xl p-4 text-emerald-200 flex items-start gap-3 shadow-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-emerald-100">
                ¡Hallazgo Transmitido a la Matriz!
              </div>
              <div className="text-xs text-emerald-300 mt-0.5">
                Registrado bajo código <span className="font-mono font-bold">{lastSubmittedCode}</span> con fotografía en tiempo real.
              </div>
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

          {/* Note / Description */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-200 tracking-wide uppercase">
              4. Breve Comentario / Nota
            </span>
            <textarea
              rows={2}
              placeholder="Ej: Cable pelado con chispas en la base del elevador 2, pasillo bloqueado..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
            />
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
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`¿Eliminar reporte ${inc.code}?`)) {
                                onDeleteIncident(inc.id);
                              }
                            }}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                            title="Eliminar reporte"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
                            onClick={() => {
                              if (confirm(`¿Descartar este reporte no sincronizado (${item.incident.code})?`)) {
                                removeOfflineItem(item.id);
                              }
                            }}
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
              <span>Instalar en iPhone / iPad</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              1. Pulsa el botón <strong>Compartir</strong> en la barra inferior de Safari.<br />
              2. Desliza hacia abajo y pulsa <strong>"Agregar a Inicio"</strong>.
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
    </div>
  );
};
