import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Cloud, X } from 'lucide-react';
import { User } from 'firebase/auth';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { IncidentLiveStreamView } from './components/IncidentLiveStreamView';
import { SatelliteFieldApp } from './components/SatelliteFieldApp';
import { NewIncidentModal } from './components/NewIncidentModal';
import { IncidentDossierModal } from './components/IncidentDossierModal';
import { QrCodeModal } from './components/QrCodeModal';
import { GoogleDriveSyncModal } from './components/GoogleDriveSyncModal';
import { INITIAL_INCIDENTS } from './data/initialData';
import { EmergencyState, Incident } from './types';
import { safetyAudio } from './utils/audioAlert';
import {
  fetchIncidentsFromServer,
  createIncidentApi,
  syncBatchIncidentsApi,
  updateIncidentApi,
  deleteIncidentApi,
  updateEmergencyApi
} from './services/api';
import {
  getAccessToken,
  signInWithFirebaseCloud,
  subscribeFirebaseAuthState
} from './utils/firebaseAuth';
import { fetchIncidentsFromDrive } from './services/googleDriveService';
import {
  saveIncidentToFirestore,
  updateIncidentInFirestore,
  deleteIncidentFromFirestore,
  subscribeIncidentsFromFirestore,
  saveEmergencyToFirestore,
  subscribeEmergencyFromFirestore
} from './services/firestoreSyncService';

const SYNC_CHANNEL_NAME = 'prevriesgos-prl-sync';

function mergeUniqueIncidents(incoming: Incident[], current: Incident[]): Incident[] {
  const map = new Map<string, Incident>();
  for (const item of incoming) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const item of current) {
    if (item && item.id && !map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export default function App() {
  // Lock strictly to Satellite mode on installed PWA or worker QR links (?locked=1 / /satellite)
  const [isSatelliteLocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const search = new URLSearchParams(window.location.search);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const isSatellitePath = window.location.pathname === '/satellite';
    const isLockedParam = search.get('locked') === '1';
    return isStandalone || isSatellitePath || isLockedParam;
  });

  // Application Mode: 'matrix' (Central Command & Prevention) or 'satellite' (Field Worker Mobile App)
  const [appMode, setAppMode] = useState<'matrix' | 'satellite'>(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      if (
        isStandalone ||
        window.location.pathname === '/satellite' ||
        search.get('locked') === '1' ||
        search.get('mode') === 'satellite'
      ) {
        return 'satellite';
      }
    }
    return 'matrix';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title =
        appMode === 'satellite'
          ? 'Satélite PRL · Reportes en Terreno'
          : 'PrevRiesgos · Matriz PRL & Control en Tiempo Real';
    }
  }, [appMode]);

  const handleSetMode = (mode: 'matrix' | 'satellite') => {
    if (isSatelliteLocked && mode === 'matrix') {
      return;
    }
    setAppMode(mode);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (mode === 'satellite') {
        url.searchParams.set('mode', 'satellite');
      } else {
        url.searchParams.delete('mode');
        url.searchParams.delete('locked');
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Navigation tab inside Matrix
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'incidents'>('dashboard');

  // Sound preference
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Firebase Auth user (enables Cloud Firestore cross-device real-time sync)
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isConnectingCloud, setIsConnectingCloud] = useState(false);

  // Core Data States with localStorage persistence
  const [incidents, setIncidents] = useState<Incident[]>(() => {
    try {
      const saved = localStorage.getItem('prev_incidents');
      return saved ? JSON.parse(saved) : INITIAL_INCIDENTS;
    } catch {
      return INITIAL_INCIDENTS;
    }
  });

  const [daysWithoutLTI, setDaysWithoutLTI] = useState<number>(142);

  // Live incoming notification & SOS emergency banner on Matrix
  const [incomingBanner, setIncomingBanner] = useState<{ code: string; title: string } | null>(null);
  const [activeEmergency, setActiveEmergency] = useState<EmergencyState | null>(null);

  // Modals state
  const [showReportModal, setShowReportModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [selectedIncidentForDossier, setSelectedIncidentForDossier] = useState<Incident | null>(null);

  // Field submissions tracked for satellite history
  const [mySatelliteIncidents, setMySatelliteIncidents] = useState<Incident[]>([]);

  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set(incidents.map((i) => i.id)));

  useEffect(() => {
    knownIdsRef.current = new Set(incidents.map((i) => i.id));
  }, [incidents]);

  const notifyNewIncoming = useCallback((inc: Incident) => {
    if (!knownIdsRef.current.has(inc.id)) {
      safetyAudio.playIncidentAlert(inc.severity);
      setIncomingBanner({ code: inc.code, title: inc.title });
      setTimeout(() => {
        setIncomingBanner((prev) => (prev?.code === inc.code ? null : prev));
      }, 6500);
    }
  }, []);

  const postToBroadcast = useCallback((type: string, payload: unknown) => {
    try {
      broadcastRef.current?.postMessage({ type, payload });
    } catch {
      // BroadcastChannel unavailable
    }
  }, []);

  // 0. Firebase Auth + Real-Time Cloud Firestore Listeners (works across ais-pre <-> ais-dev & 4G <-> PC!)
  useEffect(() => {
    const unsubAuth = subscribeFirebaseAuthState((user) => {
      setFirebaseUser(user);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;

    // Auto-flush any reports created on this phone prior to cloud login
    const localFieldReports = incidents.filter(
      (i) => i.id.startsWith('field-') || i.id.startsWith('sos-')
    );
    if (localFieldReports.length > 0) {
      Promise.allSettled(
        localFieldReports.map((inc) => saveIncidentToFirestore(inc))
      ).catch(() => {});
    }

    const unsubIncidents = subscribeIncidentsFromFirestore(
      (cloudIncidents) => {
        if (cloudIncidents.length > 0) {
          setIncidents((current) => {
            const newItems = cloudIncidents.filter(
              (c) => !current.some((cur) => cur.id === c.id)
            );
            if (newItems.length > 0) {
              notifyNewIncoming(newItems[0]);
            }
            return mergeUniqueIncidents(cloudIncidents, current);
          });
          // Also keep local server synced when online
          syncBatchIncidentsApi(cloudIncidents).catch(() => {});
        }
      },
      (err) => {
        console.warn('[Firestore Sync Error]:', err.message);
      }
    );

    const unsubEmergency = subscribeEmergencyFromFirestore((cloudEmergency) => {
      if (cloudEmergency?.active) {
        setActiveEmergency(cloudEmergency);
        safetyAudio.playEmergencySiren();
      } else if (cloudEmergency && !cloudEmergency.active) {
        setActiveEmergency(null);
      }
    });

    return () => {
      unsubIncidents();
      unsubEmergency();
    };
  }, [firebaseUser, notifyNewIncoming]);

  const handleConnectCloudSync = async () => {
    setIsConnectingCloud(true);
    try {
      await signInWithFirebaseCloud();
    } catch (err) {
      console.warn('No se pudo conectar la nube:', err);
      if (!isSatelliteLocked) {
        setShowDriveModal(true);
      }
    } finally {
      setIsConnectingCloud(false);
    }
  };

  // 1. Cross-tab BroadcastChannel listener (instant local multi-tab sync)
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    broadcastRef.current = channel;

    channel.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'incident:created' && payload?.id) {
        notifyNewIncoming(payload as Incident);
        setIncidents((prev) => mergeUniqueIncidents([payload as Incident], prev));
      } else if (type === 'incident:updated' && payload?.id) {
        setIncidents((prev) => prev.map((i) => (i.id === payload.id ? payload : i)));
      } else if (type === 'incident:deleted' && payload?.id) {
        setIncidents((prev) => prev.filter((i) => i.id !== payload.id));
      } else if (type === 'emergency:updated') {
        setActiveEmergency(payload);
        if (payload?.active) safetyAudio.playEmergencySiren();
      }
    };

    return () => {
      channel.close();
      broadcastRef.current = null;
    };
  }, [notifyNewIncoming]);

  // 2. WebSocket real-time connection to /ws + auto-reconnect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connectWs = () => {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'init' && msg.payload) {
              const serverIncidents: Incident[] = Array.isArray(msg.payload.incidents)
                ? msg.payload.incidents
                : [];
              if (serverIncidents.length > 0) {
                setIncidents((prev) => mergeUniqueIncidents(serverIncidents, prev));
              }
              if (msg.payload.emergency?.active) {
                setActiveEmergency(msg.payload.emergency);
              }
            } else if (msg.type === 'incident:created' && msg.payload?.id) {
              const created = msg.payload as Incident;
              notifyNewIncoming(created);
              setIncidents((prev) => mergeUniqueIncidents([created], prev));
            } else if (msg.type === 'incidents:synced' && Array.isArray(msg.payload)) {
              setIncidents((prev) => mergeUniqueIncidents(msg.payload, prev));
            } else if (msg.type === 'incident:updated' && msg.payload?.id) {
              setIncidents((prev) =>
                prev.map((i) => (i.id === msg.payload.id ? msg.payload : i))
              );
            } else if (msg.type === 'incident:deleted' && msg.payload?.id) {
              setIncidents((prev) => prev.filter((i) => i.id !== msg.payload.id));
            } else if (msg.type === 'emergency:updated') {
              setActiveEmergency(msg.payload);
              if (msg.payload?.active) {
                safetyAudio.playEmergencySiren();
              }
            }
          } catch {
            // Ignore malformed message
          }
        };

        ws.onclose = () => {
          if (!disposed) {
            reconnectTimer = setTimeout(connectWs, 3000);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        reconnectTimer = setTimeout(connectWs, 3000);
      }
    };

    connectWs();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [notifyNewIncoming]);

  // 3. Initial server fetch + resilient 2.5s REST polling fallback
  useEffect(() => {
    let active = true;

    async function syncFromServer(isInitial: boolean) {
      const res = await fetchIncidentsFromServer();
      if (!active || !res.ok) return;

      if (res.data.length > 0) {
        setIncidents((current) => {
          if (!isInitial) {
            const newItems = res.data.filter((item) => !current.some((c) => c.id === item.id));
            if (newItems.length > 0) {
              notifyNewIncoming(newItems[0]);
            }
          }
          return mergeUniqueIncidents(res.data, current);
        });
      }
    }

    syncFromServer(true);
    const pollInterval = setInterval(() => syncFromServer(false), 2500);

    return () => {
      active = false;
      clearInterval(pollInterval);
    };
  }, [notifyNewIncoming]);

  // 4. Import helper for Google Drive -> Matrix synchronization
  const handleImportFromDrive = useCallback(async (driveIncidents: Incident[]): Promise<number> => {
    const newItems = driveIncidents.filter(
      (d) => !knownIdsRef.current.has(d.id) && !incidents.some((c) => c.code === d.code)
    );
    if (newItems.length === 0) return 0;

    try {
      const syncedList = await syncBatchIncidentsApi(newItems);
      if (syncedList.length > 0) {
        setIncidents((prev) => mergeUniqueIncidents(syncedList, prev));
      } else {
        setIncidents((prev) => mergeUniqueIncidents(newItems, prev));
      }
    } catch {
      setIncidents((prev) => mergeUniqueIncidents(newItems, prev));
    }

    Promise.allSettled(newItems.map((inc) => saveIncidentToFirestore(inc))).catch(() => {});

    notifyNewIncoming(newItems[0]);
    return newItems.length;
  }, [incidents, notifyNewIncoming]);

  // 5. Auto-sync incoming satellite reports from Google Drive when prevred3@gmail.com is connected in Matrix
  useEffect(() => {
    if (appMode !== 'matrix') return;

    const drivePoll = setInterval(async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const driveIncidents = await fetchIncidentsFromDrive(token);
        if (driveIncidents.length > 0) {
          await handleImportFromDrive(driveIncidents);
        }
      } catch {
        // Silent background Drive poll
      }
    }, 15000);

    return () => clearInterval(drivePoll);
  }, [appMode, handleImportFromDrive]);

  // Persist data changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('prev_incidents', JSON.stringify(incidents));
    } catch {
      // Storage quota fallback
    }
  }, [incidents]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    safetyAudio.soundEnabled = next;
  };

  const handleAddIncident = async (
    newIncident: Incident,
    options?: { skipApi?: boolean }
  ): Promise<Incident> => {
    if (newIncident.type === 'Accidente con Baja (LTI)') {
      setDaysWithoutLTI(0);
    }

    if (options?.skipApi) {
      setIncidents((prev) => mergeUniqueIncidents([newIncident], prev));
      setMySatelliteIncidents((prev) => mergeUniqueIncidents([newIncident], prev));
      postToBroadcast('incident:created', newIncident);
      saveIncidentToFirestore(newIncident).catch((e) => console.warn('[Firestore sync]:', e));
      return newIncident;
    }

    // Write to both Cloud Firestore (cross-device!) and Express server (same-origin!)
    let firestoreOk = false;
    try {
      firestoreOk = await saveIncidentToFirestore(newIncident);
    } catch (fsErr) {
      console.warn('[Firestore] Error al guardar reporte:', fsErr);
    }

    let saved = newIncident;
    try {
      saved = await createIncidentApi(newIncident);
    } catch (apiErr) {
      if (!firestoreOk) {
        throw apiErr;
      }
    }

    setIncidents((prev) => mergeUniqueIncidents([saved], prev));
    setMySatelliteIncidents((prev) => mergeUniqueIncidents([saved], prev));
    safetyAudio.playIncidentAlert(saved.severity);
    postToBroadcast('incident:created', saved);
    return saved;
  };

  const handleUpdateIncident = async (updated: Incident) => {
    setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    postToBroadcast('incident:updated', updated);
    try {
      await Promise.allSettled([
        updateIncidentApi(updated),
        updateIncidentInFirestore(updated)
      ]);
    } catch (err) {
      console.warn('Fallo al actualizar incidente:', err);
    }
  };

  const handleDeleteIncident = async (id: string) => {
    setIncidents((prev) => prev.filter((i) => i.id !== id));
    setMySatelliteIncidents((prev) => prev.filter((i) => i.id !== id));
    if (selectedIncidentForDossier?.id === id) {
      setSelectedIncidentForDossier(null);
    }
    postToBroadcast('incident:deleted', { id });

    try {
      await Promise.allSettled([
        deleteIncidentApi(id),
        deleteIncidentFromFirestore(id)
      ]);
    } catch (err) {
      console.warn('Fallo al eliminar incidente en backend:', err);
    }
  };

  // Trigger emergency notice from satellite field -> transmits SOS state + critical incident to Cloud Firestore & Express!
  const handleTriggerFieldEmergency = async (location: string, message: string) => {
    safetyAudio.playEmergencySiren();
    const emergencyPayload: EmergencyState = {
      active: true,
      type: 'Alerta SOS Terreno',
      location,
      triggeredAt: new Date().toISOString(),
      message,
      accountedWorkers: 142,
      totalWorkers: 150,
      assemblyPoint: 'Punto de Encuentro 1 (Zona Norte - Estacionamiento)'
    };

    setActiveEmergency(emergencyPayload);
    postToBroadcast('emergency:updated', emergencyPayload);
    await Promise.allSettled([
      updateEmergencyApi(emergencyPayload),
      saveEmergencyToFirestore(emergencyPayload)
    ]);

    const sosIncident: Incident = {
      id: `sos-${Date.now()}`,
      code: `SOS-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      timeFormatted: 'ALERTA SOS EN DIRECTO',
      title: `¡ALERTA SOS DE PÁNICO! ${location}`,
      description: message,
      location,
      type: 'Emergencia / Conato',
      severity: 'Crítico',
      status: 'Abierto',
      reporterName: 'Satélite Móvil SOS',
      reporterRole: 'Emergencia en Terreno',
      immediateAction: 'Activación de protocolo de emergencia y alarma general en Matriz PRL.',
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
          action: 'Atender emergencia inmediata en sector reportado y verificar integridad del personal.',
          assignee: 'Brigada de Emergencia / Matriz PRL',
          dueDate: 'Inmediata',
          completed: false,
          priority: 'Urgente'
        }
      ]
    };

    try {
      await handleAddIncident(sosIncident);
    } catch (err) {
      console.warn('Error al registrar incidente SOS:', err);
    }
  };

  const handleDismissEmergency = async () => {
    const cleared: Partial<EmergencyState> = {
      active: false,
      type: 'Evacuación General',
      location: activeEmergency?.location || 'Planta Principal',
      triggeredAt: activeEmergency?.triggeredAt || new Date().toISOString(),
      message: 'Emergencia atendida y cerrada por Matriz PRL'
    };
    setActiveEmergency(null);
    postToBroadcast('emergency:updated', cleared);
    await Promise.allSettled([
      updateEmergencyApi(cleared),
      saveEmergencyToFirestore(cleared)
    ]);
  };

  // Real-time Simulation Helper
  const handleSimulateLiveIncoming = () => {
    const sampleTitles = [
      'Casi accidente: Desprendimiento de carga suspendida en Grúa Puente 2',
      'Falta de guarda perimetral en cinta transportadora de áridos',
      'Fuga de vapor caliente a alta presión en tubería de caldera auxiliar',
      'Operario detectado sin arnés anticaídas en andamio nivel +6m'
    ];
    const sampleLocations = [
      'Nave de Prensas - Celda 02',
      'Patio de Carga - Sector Este',
      'Sala de Calderas y Compresores',
      'Silos de Almacenamiento'
    ];
    const idx = Math.floor(Math.random() * sampleTitles.length);
    const code = `TERRENO-${Math.floor(1000 + Math.random() * 9000)}`;

    const simulatedIncident: Incident = {
      id: `sim-${Date.now()}`,
      code,
      timestamp: new Date().toISOString(),
      timeFormatted: 'Recibido en directo ahora',
      title: sampleTitles[idx],
      description: `Transmisión en tiempo real desde la aplicación Satélite Móvil por la cuadrilla de turno. Verificación inmediata requerida.`,
      location: sampleLocations[idx],
      type: idx === 0 ? 'Casi Accidente (Near Miss)' : idx === 3 ? 'Acto Inseguro' : 'Condición Insegura',
      severity: idx === 0 || idx === 3 ? 'Grave' : 'Moderado',
      status: 'Abierto',
      reporterName: 'Carlos Mendonza',
      reporterRole: 'Técnico de Terreno',
      immediateAction: 'Cuadrilla procedió al acordonamiento y aviso a central.',
      photoUrl: '/src/assets/images/prl_inspection_machinery_1792634598416.jpg',
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
          action: 'Inspección técnica in-situ y verificación de resguardo.',
          assignee: 'Prevención Central / Matriz',
          dueDate: 'Inmediata',
          completed: false,
          priority: 'Alta'
        }
      ]
    };

    handleAddIncident(simulatedIncident).catch((err) => {
      console.warn('Simulación guardada localmente:', err);
    });
  };

  // If in SATELLITE mode (or locked worker phone PWA), render ONLY the field app
  if (appMode === 'satellite' || isSatelliteLocked) {
    return (
      <>
        <SatelliteFieldApp
          onBackToMatrix={() => handleSetMode('matrix')}
          isLockedSatellite={isSatelliteLocked}
          onSubmitIncident={handleAddIncident}
          myRecentIncidents={mySatelliteIncidents.length > 0 ? mySatelliteIncidents : incidents}
          onTriggerEmergency={handleTriggerFieldEmergency}
          onDeleteIncident={handleDeleteIncident}
          onOpenDriveModal={isSatelliteLocked ? undefined : () => setShowDriveModal(true)}
          cloudUser={firebaseUser}
          onConnectCloud={handleConnectCloudSync}
          isConnectingCloud={isConnectingCloud}
        />
        {!isSatelliteLocked && (
          <GoogleDriveSyncModal
            isOpen={showDriveModal}
            onClose={() => setShowDriveModal(false)}
            incidents={incidents}
            onImportFromDrive={handleImportFromDrive}
          />
        )}
      </>
    );
  }

  // MATRIX MODE (Central Prevention & Command Suite)
  const openIncidentsCount = incidents.filter((i) => i.status !== 'Cerrado').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar with Brand, Nav Links and Single Primary CTA */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenReportModal={() => setShowReportModal(true)}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        openIncidentsCount={openIncidentsCount}
      />

      {/* Mode Switcher & Cloud Sync Status Strip */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-slate-400">Modo Activo:</span>
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Aplicación Matriz (Centro de Comando & Supervisión PRL)
            </span>
            {firebaseUser ? (
              <span className="text-[11px] bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Nube Firestore Activa ({firebaseUser.email})
              </span>
            ) : (
              <button
                type="button"
                onClick={handleConnectCloudSync}
                disabled={isConnectingCloud}
                className="text-[11px] bg-blue-600 hover:bg-blue-500 text-white font-semibold px-2.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Cloud className="w-3 h-3" />
                <span>{isConnectingCloud ? 'Conectando...' : 'Conectar Nube (Recibir Celulares)'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDriveModal(true)}
              className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 text-xs cursor-pointer"
            >
              Google Drive
            </button>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={() => handleSetMode('satellite')}
              className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 text-xs cursor-pointer"
            >
              📱 Cambiar a App Satélite (Terreno)
            </button>
          </div>
        </div>
      </div>

      {/* Active SOS Alert Banner from Satellite */}
      {activeEmergency?.active && (
        <div className="bg-rose-950 border-b border-rose-600 px-4 py-3 text-rose-100 animate-pulse">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div className="text-xs">
                <strong className="text-white uppercase tracking-wide">
                  ¡ALERTA SOS RECIBIDA DESDE TERRENO! ({activeEmergency.location})
                </strong>
                <span className="block text-rose-200">{activeEmergency.message}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismissEmergency}
              className="px-3 py-1 bg-rose-800 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer shrink-0"
            >
              Atender / Silenciar
            </button>
          </div>
        </div>
      )}

      {/* Real-time Incoming Satellite Report Banner */}
      {incomingBanner && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/40 px-4 py-2.5 text-emerald-100">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Nuevo reporte recibido desde App Satélite:</strong>{' '}
                <span className="font-mono text-amber-300">{incomingBanner.code}</span> — {incomingBanner.title}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIncomingBanner(null)}
              className="text-emerald-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {currentTab === 'dashboard' && (
          <DashboardView
            incidents={incidents}
            onOpenReportModal={() => setShowReportModal(true)}
            onOpenQrModal={() => setShowQrModal(true)}
            onOpenSatelliteApp={() => handleSetMode('satellite')}
            onOpenDriveModal={() => setShowDriveModal(true)}
            onSelectIncident={(inc) => setSelectedIncidentForDossier(inc)}
            onSimulateLiveIncident={handleSimulateLiveIncoming}
            daysWithoutLTI={daysWithoutLTI}
            onDeleteIncident={handleDeleteIncident}
          />
        )}

        {currentTab === 'incidents' && (
          <IncidentLiveStreamView
            incidents={incidents}
            onSelectIncident={(inc) => setSelectedIncidentForDossier(inc)}
            onOpenReportModal={() => setShowReportModal(true)}
            onOpenDriveModal={() => setShowDriveModal(true)}
            onDeleteIncident={handleDeleteIncident}
          />
        )}
      </main>

      {/* Modals */}
      <NewIncidentModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={(inc) => {
          handleAddIncident(inc).catch((err) => {
            console.warn('Error al enviar reporte manual al servidor:', err);
          });
        }}
        nextIncidentNumber={incidents.length + 43}
      />

      <IncidentDossierModal
        key={selectedIncidentForDossier?.id || 'none'}
        incident={selectedIncidentForDossier}
        onClose={() => setSelectedIncidentForDossier(null)}
        onUpdateIncident={handleUpdateIncident}
        onDeleteIncident={handleDeleteIncident}
      />

      <QrCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        onOpenSatelliteHere={() => {
          setShowQrModal(false);
          handleSetMode('satellite');
        }}
      />

      <GoogleDriveSyncModal
        isOpen={showDriveModal}
        onClose={() => setShowDriveModal(false)}
        incidents={incidents}
        onImportFromDrive={handleImportFromDrive}
      />
    </div>
  );
}
