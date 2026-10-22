import React, { useState } from 'react';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Smartphone,
  Cloud,
  ArrowRight,
  TrendingUp,
  MapPin,
  Radio,
  Trash2
} from 'lucide-react';
import { Incident } from '../types';

interface DashboardViewProps {
  incidents: Incident[];
  onOpenReportModal: () => void;
  onOpenQrModal: () => void;
  onOpenSatelliteApp: () => void;
  onOpenDriveModal: () => void;
  onSelectIncident: (incident: Incident) => void;
  onSimulateLiveIncident: () => void;
  daysWithoutLTI: number;
  onDeleteIncident?: (id: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  incidents,
  onOpenReportModal,
  onOpenQrModal,
  onOpenSatelliteApp,
  onOpenDriveModal,
  onSelectIncident,
  onSimulateLiveIncident,
  daysWithoutLTI,
  onDeleteIncident
}) => {
  const [incidentToDelete, setIncidentToDelete] = useState<Incident | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const openIncidents = incidents.filter((i) => i.status !== 'Cerrado');
  const nearMisses = incidents.filter((i) => i.type === 'Casi Accidente (Near Miss)');
  
  // Total corrective actions calculation
  const allActions = incidents.flatMap((i) => i.correctiveActions);
  const completedActions = allActions.filter((a) => a.completed);
  const complianceRate = allActions.length > 0 
    ? Math.round((completedActions.length / allActions.length) * 100) 
    : 100;

  return (
    <div className="space-y-6">
      {/* Top Industrial KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Días sin accidentes */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">
              Días sin Accidentes con Baja (LTI)
            </span>
            <div className="text-2xl font-black text-amber-400 font-mono tabular-nums mt-0.5">
              {daysWithoutLTI} días
            </div>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1 font-mono">
              <TrendingUp className="w-3 h-3" />
              Meta operativa: 365 días
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Incidentes en curso */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">
              Incidentes Activos en Seguimiento
            </span>
            <div className="text-2xl font-black text-slate-100 font-mono tabular-nums mt-0.5">
              {openIncidents.length}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {incidents.filter((i) => i.status === 'En Investigación').length} en investigación causal
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Casi Accidentes (Near Miss) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">
              Casi-Accidentes Reportados
            </span>
            <div className="text-2xl font-black text-amber-300 font-mono tabular-nums mt-0.5">
              {nearMisses.length}
            </div>
            <span className="text-[11px] text-amber-400/90 mt-1 block">
              Cultura proactiva de reporte
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: % Cumplimiento CAPA */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium block">
              Efectividad Planes Correctivos
            </span>
            <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums mt-0.5">
              {complianceRate}%
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block tabular-nums">
              {completedActions.length} de {allActions.length} acciones cerradas
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Hero Overview & Satellite Connection Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Supervisor Profile & Plant Card */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-lg">
          <div className="md:w-5/12 relative min-h-[220px] bg-slate-950">
            <img
              src="/src/assets/images/prl_industrial_plant_1792634598147.jpg"
              alt="Planta Industrial y Centro de Operaciones"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex items-end p-4">
              <span className="text-xs font-mono text-amber-300 bg-slate-950/80 px-2 py-0.5 rounded border border-amber-500/30">
                Planta Central · Turno Operativo Activo
              </span>
            </div>
          </div>

          <div className="p-5 md:w-7/12 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <img
                  src="/src/assets/images/prl_safety_officer_1792634598392.jpg"
                  alt="Supervisora de Seguridad y Salud"
                  className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shadow-md"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Ing. Sarah Jenkins · Jefatura PRL
                  </h3>
                  <div className="text-xs text-slate-400">
                    Supervisión Técnica & Prevención de Riesgos Laborales
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Supervisión centralizada en tiempo real. Los incidentes reportados desde terreno por las cuadrillas a través de la <strong>App Satélite</strong> ingresan instantáneamente al panel con evidencia fotográfica y georreferenciación.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={onOpenDriveModal}
                className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>Google Drive (prevred@gmail.com)</span>
              </button>

              <button
                onClick={onSimulateLiveIncident}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                title="Genera un reporte entrante de prueba para verificar la transmisión en vivo"
              >
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                <span>Simular Entrada en Vivo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: SATELLITE FIELD APP PROMO & QR CODE */}
        <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-950 border border-amber-500/30 rounded-2xl p-5 flex flex-col justify-between shadow-lg">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Aplicación Satélite</span>
              </span>
              <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-mono">
                Instalable PWA
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-100">
              Acceso Terreno para Trabajadores
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Diseñada para teléfonos móviles de operarios. Muy liviana y simple: permite sacar fotos de hallazgos in-situ, pulsar botón SOS de pánico y reportar en 3 toques.
            </p>
          </div>

          <div className="space-y-2 pt-4">
            <button
              onClick={onOpenSatelliteApp}
              className="w-full py-2.5 px-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-950 transition-colors cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>Abrir App Satélite (Modo Móvil)</span>
            </button>

            <button
              onClick={onOpenQrModal}
              className="w-full py-2 px-3 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
              <span>Ver Código QR para Escanear en Celular</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Stream Feed Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
            <h3 className="text-sm font-bold text-slate-100">
              Registro de Incidentes en Tiempo Real (Feed Central)
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              · Transmitiendo en directo
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenReportModal}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg border border-slate-700 cursor-pointer"
            >
              + Registrar Hallazgo Manual
            </button>
          </div>
        </div>

        {/* High Density Incidents Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3 font-semibold">Código</th>
                <th className="py-2.5 px-3 font-semibold">Hora</th>
                <th className="py-2.5 px-3 font-semibold">Título del Hallazgo</th>
                <th className="py-2.5 px-3 font-semibold">Ubicación</th>
                <th className="py-2.5 px-3 font-semibold">Tipo</th>
                <th className="py-2.5 px-3 font-semibold">Severidad</th>
                <th className="py-2.5 px-3 font-semibold">Estado</th>
                <th className="py-2.5 px-3 font-semibold text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {incidents.slice(0, 6).map((incident) => {
                const severityColors = {
                  Leve: 'text-emerald-400',
                  Moderado: 'text-amber-400',
                  Grave: 'text-orange-400 font-semibold',
                  Crítico: 'text-rose-400 font-bold'
                };

                return (
                  <tr
                    key={incident.id}
                    onClick={() => onSelectIncident(incident)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-amber-400">
                      {incident.code}
                    </td>
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap tabular-nums">
                      {incident.timeFormatted}
                    </td>
                    <td className="py-3 px-3 text-slate-200 font-medium max-w-xs truncate">
                      {incident.title}
                    </td>
                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap flex items-center gap-1 mt-2">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate max-w-[140px]">{incident.location}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                      {incident.type}
                    </td>
                    <td className={`py-3 px-3 whitespace-nowrap ${severityColors[incident.severity]}`}>
                      {incident.severity}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-300">
                      {incident.status}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {onDeleteIncident && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIncidentToDelete(incident);
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar este hallazgo o incidente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="text-amber-400 group-hover:translate-x-0.5 inline-flex items-center gap-1 text-xs font-semibold">
                          Investigar
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal for Dashboard */}
      {incidentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-100">
                  ¿Eliminar este hallazgo o incidente?
                </h3>
                <p className="text-xs text-slate-400">
                  El registro será eliminado de la lista central y del servidor.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
              <div className="text-amber-400 font-bold">{incidentToDelete.code} - {incidentToDelete.type}</div>
              <div className="text-slate-300 font-sans line-clamp-1">{incidentToDelete.title}</div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIncidentToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!onDeleteIncident) return;
                  setIsDeleting(true);
                  try {
                    await onDeleteIncident(incidentToDelete.id);
                    setIncidentToDelete(null);
                  } catch (err) {
                    alert('Error al eliminar: ' + (err as Error).message);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-lg shadow-rose-900/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Eliminando...' : 'Sí, Eliminar Registro'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
