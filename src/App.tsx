import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { EmergencyBanner } from './components/EmergencyBanner';
import { DashboardView } from './components/DashboardView';
import { IncidentLiveStreamView } from './components/IncidentLiveStreamView';
import { RiskMatrixView } from './components/RiskMatrixView';
import { SafetyChecklistsView } from './components/SafetyChecklistsView';
import { EmergencyCenterView } from './components/EmergencyCenterView';
import { SatelliteFieldApp } from './components/SatelliteFieldApp';
import { NewIncidentModal } from './components/NewIncidentModal';
import { IncidentDossierModal } from './components/IncidentDossierModal';
import { QrCodeModal } from './components/QrCodeModal';
import { GoogleDriveSyncModal } from './components/GoogleDriveSyncModal';
import {
  INITIAL_INCIDENTS,
  INITIAL_RISKS,
  INITIAL_CHECKLISTS,
  INITIAL_EMERGENCY
} from './data/initialData';
import { Incident, RiskItem, InspectionChecklist, EmergencyState } from './types';
import { safetyAudio } from './utils/audioAlert';

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
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'incidents' | 'iperc' | 'checklists' | 'emergency'>('dashboard');

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

  const [risks, setRisks] = useState<RiskItem[]>(() => {
    try {
      const saved = localStorage.getItem('prev_risks');
      return saved ? JSON.parse(saved) : INITIAL_RISKS;
    } catch {
      return INITIAL_RISKS;
    }
  });

  const [checklists, setChecklists] = useState<InspectionChecklist[]>(() => {
    try {
      const saved = localStorage.getItem('prev_checklists');
      return saved ? JSON.parse(saved) : INITIAL_CHECKLISTS;
    } catch {
      return INITIAL_CHECKLISTS;
    }
  });

  const [emergency, setEmergency] = useState<EmergencyState>(() => {
    try {
      const saved = localStorage.getItem('prev_emergency');
      return saved ? JSON.parse(saved) : INITIAL_EMERGENCY;
    } catch {
      return INITIAL_EMERGENCY;
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

  // Persist data changes
  useEffect(() => {
    try {
      localStorage.setItem('prev_incidents', JSON.stringify(incidents));
    } catch {
      // Storage quota fallback
    }
  }, [incidents]);

  useEffect(() => {
    try {
      localStorage.setItem('prev_risks', JSON.stringify(risks));
    } catch {
      // Storage quota fallback
    }
  }, [risks]);

  useEffect(() => {
    try {
      localStorage.setItem('prev_checklists', JSON.stringify(checklists));
    } catch {
      // Storage quota fallback
    }
  }, [checklists]);

  useEffect(() => {
    try {
      localStorage.setItem('prev_emergency', JSON.stringify(emergency));
    } catch {
      // Storage quota fallback
    }
  }, [emergency]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    safetyAudio.soundEnabled = next;
  };

  const handleAddIncident = (newIncident: Incident) => {
    setIncidents((prev) => [newIncident, ...prev]);
    setMySatelliteIncidents((prev) => [newIncident, ...prev]);
    safetyAudio.playIncidentAlert(newIncident.severity);

    // If it was an accident with lost time, reset days counter
    if (newIncident.type === 'Accidente con Baja (LTI)') {
      setDaysWithoutLTI(0);
    }
  };

  const handleUpdateIncident = (updated: Incident) => {
    setIncidents((prev) =>
      prev.map((i) => (i.id === updated.id ? updated : i))
    );
  };

  const handleAddRisk = (newRisk: RiskItem) => {
    setRisks((prev) => [newRisk, ...prev]);
  };

  // Convert an inspection finding directly into an open incident in real time
  const handlePromoteFindingToIncident = (
    checklist: InspectionChecklist,
    itemLabel: string,
    observation?: string
  ) => {
    const code = `INC-2026-${String(incidents.length + 43).padStart(3, '0')}`;
    const newInc: Incident = {
      id: `inc-${Date.now()}`,
      code,
      timestamp: new Date().toISOString(),
      timeFormatted: 'Registrado ahora mismo (Desde Auditoría)',
      title: `No Conformidad: ${itemLabel}`,
      description: `Hallazgo detectado en inspección "${checklist.title}" en ${checklist.location}. ${observation ? `Observación: ${observation}` : ''}`,
      location: checklist.location,
      type: 'Condición Insegura',
      severity: 'Moderado',
      status: 'Abierto',
      reporterName: checklist.inspector,
      reporterRole: 'Inspector de Seguridad',
      immediateAction: 'Señalización preventiva del elemento no conforme y notificación a jefatura.',
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
          action: `Subsanar no conformidad detectada en ${itemLabel}.`,
          assignee: 'Equipo de Mantenimiento / Seguridad',
          dueDate: '24 horas',
          completed: false,
          priority: 'Alta'
        }
      ]
    };

    handleAddIncident(newInc);
    setCurrentTab('incidents');
    setSelectedIncidentForDossier(newInc);
  };

  // Trigger emergency from satellite field
  const handleTriggerFieldEmergency = (location: string, message: string) => {
    setEmergency({
      active: true,
      type: 'Evacuación General',
      location,
      triggeredAt: new Date().toLocaleTimeString('es-ES'),
      message,
      accountedWorkers: 10,
      totalWorkers: 150,
      assemblyPoint: 'Punto de Encuentro 1 (Zona Norte)'
    });
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
        hasActiveEmergency={emergency.active}
      />

      {/* Emergency Active Broadcast Banner */}
      <EmergencyBanner
        emergency={emergency}
        onGoToEmergency={() => setCurrentTab('emergency')}
        onResolveEmergency={() => setEmergency({ ...emergency, active: false })}
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
          />
        )}

        {currentTab === 'incidents' && (
          <IncidentLiveStreamView
            incidents={incidents}
            onSelectIncident={(inc) => setSelectedIncidentForDossier(inc)}
            onOpenReportModal={() => setShowReportModal(true)}
            onOpenDriveModal={() => setShowDriveModal(true)}
          />
        )}

        {currentTab === 'iperc' && (
          <RiskMatrixView
            risks={risks}
            onAddRisk={handleAddRisk}
          />
        )}

        {currentTab === 'checklists' && (
          <SafetyChecklistsView
            checklists={checklists}
            onPromoteFindingToIncident={handlePromoteFindingToIncident}
          />
        )}

        {currentTab === 'emergency' && (
          <EmergencyCenterView
            emergency={emergency}
            onUpdateEmergency={setEmergency}
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
