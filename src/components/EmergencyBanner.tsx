import React from 'react';
import { AlertTriangle, Users, MapPin, ArrowRight } from 'lucide-react';
import { EmergencyState } from '../types';

interface EmergencyBannerProps {
  emergency: EmergencyState;
  onGoToEmergency: () => void;
  onResolveEmergency: () => void;
}

export const EmergencyBanner: React.FC<EmergencyBannerProps> = ({
  emergency,
  onGoToEmergency,
  onResolveEmergency,
}) => {
  if (!emergency.active) return null;

  return (
    <div className="bg-rose-950/90 border-b border-rose-600/40 px-4 py-3 text-rose-100">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-500/20 border border-rose-500/30 rounded-lg shrink-0">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-rose-300 font-medium">
              <span className="font-bold tracking-wide uppercase text-rose-200">
                Alerta de Emergencia Activa
              </span>
              <span>·</span>
              <span>{emergency.type}</span>
              <span>·</span>
              <span className="flex items-center gap-1 font-mono text-rose-300">
                <MapPin className="w-3.5 h-3.5" />
                {emergency.location}
              </span>
            </div>
            <p className="text-sm font-semibold text-rose-100 mt-0.5">
              {emergency.message || 'Proceder de acuerdo al plan de contingencia y ruta de evacuación.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-900/40 border border-rose-800/60 rounded-md text-xs font-mono text-rose-200">
            <Users className="w-3.5 h-3.5 text-rose-400" />
            <span>Evacuados:</span>
            <span className="font-bold tabular-nums">
              {emergency.accountedWorkers} / {emergency.totalWorkers}
            </span>
          </div>

          <button
            onClick={onGoToEmergency}
            className="px-3 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white rounded-md transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <span>Ver Centro SOS</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onResolveEmergency}
            className="px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-md transition-colors cursor-pointer whitespace-nowrap"
          >
            Desactivar
          </button>
        </div>
      </div>
    </div>
  );
};
