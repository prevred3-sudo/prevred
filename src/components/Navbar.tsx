import React from 'react';
import { Volume2, VolumeX, ShieldAlert, Plus } from 'lucide-react';

interface NavbarProps {
  currentTab: 'dashboard' | 'incidents' | 'checklists' | 'emergency';
  onSelectTab: (tab: 'dashboard' | 'incidents' | 'checklists' | 'emergency') => void;
  onOpenReportModal: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  openIncidentsCount: number;
  hasActiveEmergency: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenReportModal,
  soundEnabled,
  onToggleSound,
  openIncidentsCount,
  hasActiveEmergency
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Single text wordmark */}
          <button
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-2.5 text-left focus:outline-none shrink-0 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
                PrevRiesgos
              </span>
              <span className="text-[11px] font-mono tracking-wider text-slate-400 uppercase -mt-0.5">
                Seguridad & Salud Laboral
              </span>
            </div>
          </button>

          {/* Zone 2: 4-5 single line navigation links with subtle underline/indicators */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 ${
                currentTab === 'dashboard'
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : ''
              }`}
            >
              Panel de Control
            </button>

            <button
              onClick={() => onSelectTab('incidents')}
              className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 flex items-center gap-1.5 ${
                currentTab === 'incidents'
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : ''
              }`}
            >
              <span>Incidentes en Vivo</span>
              {openIncidentsCount > 0 && (
                <span className="text-xs font-mono text-amber-300">
                  ({openIncidentsCount})
                </span>
              )}
            </button>


            <button
              onClick={() => onSelectTab('checklists')}
              className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 ${
                currentTab === 'checklists'
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : ''
              }`}
            >
              Inspecciones
            </button>

            <button
              onClick={() => onSelectTab('emergency')}
              className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 flex items-center gap-1.5 ${
                hasActiveEmergency
                  ? 'text-rose-400 font-bold animate-pulse'
                  : currentTab === 'emergency'
                  ? 'text-amber-400 border-b-2 border-amber-400'
                  : ''
              }`}
            >
              <span>Protocolo SOS</span>
              {hasActiveEmergency && (
                <span className="text-xs font-mono text-rose-300">
                  (¡ALERTA ACTIVA!)
                </span>
              )}
            </button>
          </nav>

          {/* Zone 3: 1 primary action (+ sound affordance) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleSound}
              aria-label={soundEnabled ? 'Silenciar alertas' : 'Activar sonido de alertas'}
              title={soundEnabled ? 'Alertas sonoras activadas' : 'Alertas sonoras silenciadas'}
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </button>

            <button
              type="button"
              onClick={onOpenReportModal}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-sm shadow-amber-950 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>Reportar Incidente</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-between overflow-x-auto py-2.5 border-t border-slate-900 gap-4 text-xs font-medium text-slate-400">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`whitespace-nowrap shrink-0 ${currentTab === 'dashboard' ? 'text-amber-400 font-bold' : ''}`}
          >
            Panel
          </button>
          <button
            onClick={() => onSelectTab('incidents')}
            className={`whitespace-nowrap shrink-0 ${currentTab === 'incidents' ? 'text-amber-400 font-bold' : ''}`}
          >
            Incidentes ({openIncidentsCount})
          </button>
          <button
            onClick={() => onSelectTab('checklists')}
            className={`whitespace-nowrap shrink-0 ${currentTab === 'checklists' ? 'text-amber-400 font-bold' : ''}`}
          >
            Inspecciones
          </button>
          <button
            onClick={() => onSelectTab('emergency')}
            className={`whitespace-nowrap shrink-0 ${hasActiveEmergency ? 'text-rose-400 font-bold' : currentTab === 'emergency' ? 'text-amber-400 font-bold' : ''}`}
          >
            SOS {hasActiveEmergency ? '(!)' : ''}
          </button>
        </div>
      </div>
    </header>
  );
};
