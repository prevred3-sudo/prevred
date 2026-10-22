import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { IncidentLiveStreamView } from './components/IncidentLiveStreamView';
import { SatelliteFieldApp } from './components/SatelliteFieldApp';
import { NewIncidentModal } from './components/NewIncidentModal';
import { IncidentDossierModal } from './components/IncidentDossierModal';
import { QrCodeModal } from './components/QrCodeModal';
import { GoogleDriveSyncModal } from './components/GoogleDriveSyncModal';
import {
  INITIAL_INCIDENTS
} from './data/initialData';
import { Incident } from './types';
import { safetyAudio } from './utils/audioAlert';
import {
  fetchIncidentsApi,
  createIncidentApi,
  updateIncidentApi,
  deleteIncidentApi
} from './services/api';

export default function App() {
  // Application Mode: 'matrix' (Central Command & Prevention) or 'satellite' (Field Worker Mobile App)
  const [appMode, setAppMode] = useState<'matrix' | 'satellite'>(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      if (search.get('mode') === 'satellite') {
        return 'satellite';
      }
    }
    return 'matrix';
  });

  const handleSetMode = (mode: 'matrix' | 'satellite') => {
    setAppMode(mode);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (mode === 'satellite') {
        url.searchParams.set('mode', 'satellite');
      } else {
        url.searchParams.delete('mode');
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Navigation tab inside Matrix
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'incidents'>('dashboard');

  // Sound preference
  const [soundEnabled, setSoundEnabled] = useState(true);

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

  // Modals state
  const [showReportModal, setShowReportModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [selectedIncidentForDossier, setSelectedIncidentForDossier] = useState<Incident | null>(null);

  // Field submissions tracked for satellite history
  const [mySatelliteIncidents, setMySatelliteIncidents] = useState<Incident[]>([]);

  // 1. Initial server fetch
  useEffect(() => {
    async function initServerSync() {
      const serverList = await fetchIncidentsApi();
      if (serverList && serverList.length > 0) {
        setIncidents(serverList);
      }
    }
    initServerSync();
  }, []);

  // 2. Real-time background poll (every 2.5 seconds) so field reports appear live on Matrix
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const latest = await fetchIncidentsApi();
        if (latest && latest.length > 0) {
          setIncidents((current) => {
            // If new incidents arrived from external device (satellite worker)
            if (latest.length > current.length) {
              const newest = latest[0];
              if (newest && !current.some((c) => c.id === newest.id)) {
                safetyAudio.playIncidentAlert(newest.severity);
              }
            }
            return latest;
          });
        }
      } catch {
        // Silent sync catch
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, []);

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

  const handleAddIncident = async (newIncident: Incident) => {
    // Optimistic UI update
    setIncidents((prev) => [newIncident, ...prev]);
    setMySatelliteIncidents((prev) => [newIncident, ...prev]);
    safetyAudio.playIncidentAlert(newIncident.severity);

    // If it was an accident with lost time, reset days counter
    if (newIncident.type === 'Accidente con Baja (LTI)') {
      setDaysWithoutLTI(0);
    }

    // Immediately transmit to shared Express server so Matrix receives it in real time
    try {
      const saved = await createIncidentApi(newIncident);
      if (saved) {
        setIncidents((prev) => prev.map((i) => (i.id === newIncident.id ? saved : i)));
      }
      return saved;
    } catch (err) {
      console.warn('Fallo al guardar en servidor:', err);
      throw err;
    }
  };

  const handleUpdateIncident = async (updated: Incident) => {
    setIncidents((prev) =>
      prev.map((i) => (i.id === updated.id ? updated : i))
    );
    try {
      await updateIncidentApi(updated);
    } catch (err) {
      console.warn('Fallo al actualizar incidente:', err);
    }
  };

  const handleDeleteIncident = async (id: string) => {
    // 1. Optimistic removal from state
    setIncidents((prev) => prev.filter((i) => i.id !== id));
    setMySatelliteIncidents((prev) => prev.filter((i) => i.id !== id));
    if (selectedIncidentForDossier?.id === id) {
      setSelectedIncidentForDossier(null);
    }

    // 2. Call backend DELETE endpoint
    try {
      await deleteIncidentApi(id);
    } catch (err) {
      console.warn('Fallo al eliminar incidente en backend:', err);
    }
  };


  // Trigger emergency notice from satellite field
  const handleTriggerFieldEmergency = (location: string, message: string) => {
    safetyAudio.playEmergencySiren();
    console.warn(`Alerta de Terreno en ${location}: ${message}`);
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

    handleAddIncident(simulatedIncident);
  };

  // If in SATELLITE mode, render the lightweight field app
  if (appMode === 'satellite') {
    return (
      <SatelliteFieldApp
        onBackToMatrix={() => handleSetMode('matrix')}
        onSubmitIncident={handleAddIncident}
        myRecentIncidents={mySatelliteIncidents}
        onTriggerEmergency={handleTriggerFieldEmergency}
        onDeleteIncident={handleDeleteIncident}
      />
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

      {/* Mode Switcher floating strip at the top of content */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-slate-400">Modo Activo:</span>
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Aplicación Matriz (Centro de Comando & Supervisión PRL)
            </span>
            <span className="text-slate-500 hidden sm:inline">· Supervisado por prevred@gmail.com</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDriveModal(true)}
              className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 text-xs cursor-pointer"
            >
              Google Drive
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => handleSetMode('satellite')}
              className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 text-xs cursor-pointer"
            >
              📱 Cambiar a App Satélite (Terreno)
            </button>
          </div>
        </div>
      </div>

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
        onSubmit={handleAddIncident}
        nextIncidentNumber={incidents.length + 43}
      />

      <IncidentDossierModal
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
      />
    </div>
  );
}
