import React, { useState } from 'react';
import {
  Search,
  Filter,
  ArrowRight,
  Cloud,
  Clock,
  Camera,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react';
import { Incident, SeverityLevel, IncidentStatus, IncidentType } from '../types';
import { saveIncidentToDrive, getOrCreatePRLFolder } from '../services/googleDriveService';
import { getAccessToken } from '../utils/firebaseAuth';

interface IncidentLiveStreamViewProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
  onOpenReportModal: () => void;
  onOpenDriveModal: () => void;
  onDeleteIncident: (id: string) => void;
}

export const IncidentLiveStreamView: React.FC<IncidentLiveStreamViewProps> = ({
  incidents,
  onSelectIncident,
  onOpenReportModal,
  onOpenDriveModal,
  onDeleteIncident
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const [savingId, setSavingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string>('');
  const [incidentToDelete, setIncidentToDelete] = useState<Incident | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredIncidents = incidents.filter((inc) => {
    const matchesSearch =
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.reporterName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity = severityFilter === 'all' || inc.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || inc.status === statusFilter;
    const matchesType = typeFilter === 'all' || inc.type === typeFilter;

    return matchesSearch && matchesSeverity && matchesStatus && matchesType;
  });

  const handleQuickSaveToDrive = async (e: React.MouseEvent, incident: Incident) => {
    e.stopPropagation();
    const token = await getAccessToken();
    if (!token) {
      onOpenDriveModal();
      return;
    }

    setSavingId(incident.id);
    try {
      const folderId = await getOrCreatePRLFolder(token);
      await saveIncidentToDrive(token, incident, folderId);
      setToastMsg(`¡Informe ${incident.code} alojado con éxito en Google Drive!`);
      setTimeout(() => setToastMsg(''), 4000);
    } catch (err: unknown) {
      alert(`Error al guardar en Google Drive: ${(err as Error).message}`);
    } finally {
      setSavingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!incidentToDelete) return;
    setIsDeleting(true);
    const code = incidentToDelete.code;
    try {
      await onDeleteIncident(incidentToDelete.id);
      setToastMsg(`El registro ${code} ha sido eliminado correctamente.`);
      setTimeout(() => setToastMsg(''), 4000);
      setIncidentToDelete(null);
    } catch (err) {
      alert('Error al eliminar el registro: ' + (err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span>Registro de Incidentes y Hallazgos en Tiempo Real</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Supervisión de sucesos reportados desde la App Satélite (terreno) y la planta central
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenReportModal}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              + Nuevo Reporte
            </button>
            <button
              onClick={onOpenDriveModal}
              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Google Drive</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por código, título, lugar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Severity Filter */}
          <div className="relative">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="all">Severidad: Todas</option>
              <option value="Leve">Leve</option>
              <option value="Moderado">Moderado</option>
              <option value="Grave">Grave</option>
              <option value="Crítico">Crítico</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="all">Estado: Todos</option>
              <option value="Abierto">Abierto</option>
              <option value="En Investigación">En Investigación</option>
              <option value="Acción en Curso">Acción en Curso</option>
              <option value="Cerrado">Cerrado</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="all">Tipo: Todos</option>
              <option value="Condición Insegura">Condición Insegura</option>
              <option value="Acto Inseguro">Acto Inseguro</option>
              <option value="Casi Accidente (Near Miss)">Casi Accidente</option>
              <option value="Accidente sin Baja (FAC/MTC)">Accidente sin Baja</option>
              <option value="Accidente con Baja (LTI)">Accidente con Baja (LTI)</option>
              <option value="Emergencia / Conato">Emergencia / Conato</option>
            </select>
          </div>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Grid of Incidents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredIncidents.length === 0 ? (
          <div className="col-span-full bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-500">
            No se encontraron incidentes que coincidan con los filtros aplicados.
          </div>
        ) : (
          filteredIncidents.map((incident) => {
            const severityClass = {
              Leve: 'text-emerald-400',
              Moderado: 'text-amber-400',
              Grave: 'text-orange-400 font-semibold',
              Crítico: 'text-rose-400 font-bold'
            }[incident.severity];

            return (
              <div
                key={incident.id}
                onClick={() => onSelectIncident(incident)}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all cursor-pointer flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="font-bold text-amber-400">{incident.code}</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {incident.timeFormatted}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${severityClass}`}>
                        {incident.severity}
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                        {incident.status}
                      </span>
                      {/* Delete button on card header */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIncidentToDelete(incident);
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar este hallazgo o incidente"
                        aria-label="Eliminar incidente"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                    {incident.title}
                  </h3>

                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {incident.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {incident.location}
                    </span>
                    <span>·</span>
                    <span>Reporta: {incident.reporterName}</span>
                    {incident.photoUrl && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-amber-400">
                          <Camera className="w-3.5 h-3.5" />
                          Con Foto
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => handleQuickSaveToDrive(e, incident)}
                      disabled={savingId === incident.id}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer font-medium"
                      title="Alojar este informe individual en Google Drive"
                    >
                      <Cloud className="w-3.5 h-3.5" />
                      <span>{savingId === incident.id ? 'Alojando...' : 'Google Drive'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIncidentToDelete(incident);
                      }}
                      className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer font-medium transition-colors"
                      title="Eliminar registro"
                    >
                      <Trash2 className="w-3 h-3 text-slate-500 hover:text-rose-400" />
                      <span>Eliminar</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
                    <span>Expediente & 5 Porqués</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Modal to Delete Incident / Finding */}
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
                  Se removerá de forma permanente del sistema central y no estará disponible para análisis de 5 Porqués ni planes CAPA.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Código:</span>
                <span className="text-amber-400 font-bold">{incidentToDelete.code}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Tipo:</span>
                <span className="text-slate-200">{incidentToDelete.type}</span>
              </div>
              <div className="text-slate-300 font-sans line-clamp-2 pt-1 border-t border-slate-800/80">
                {incidentToDelete.title}
              </div>
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
                onClick={handleConfirmDelete}
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
