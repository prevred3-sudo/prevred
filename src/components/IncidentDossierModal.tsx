import React, { useState } from 'react';
import { X, Printer, Shield, CheckCircle, Clock, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Incident, RootCauseAnalysis, CorrectiveAction } from '../types';

interface IncidentDossierModalProps {
  incident: Incident | null;
  onClose: () => void;
  onUpdateIncident: (updated: Incident) => void;
  onDeleteIncident?: (id: string) => void;
}

export const IncidentDossierModal: React.FC<IncidentDossierModalProps> = ({
  incident,
  onClose,
  onUpdateIncident,
  onDeleteIncident
}) => {
  if (!incident) return null;

  const [activeTab, setActiveTab] = useState<'details' | '5whys' | 'actions'>('details');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Local editable states
  const [status, setStatus] = useState(incident.status);
  const [why1, setWhy1] = useState(incident.rootCauseAnalysis?.why1 || '');
  const [why2, setWhy2] = useState(incident.rootCauseAnalysis?.why2 || '');
  const [why3, setWhy3] = useState(incident.rootCauseAnalysis?.why3 || '');
  const [why4, setWhy4] = useState(incident.rootCauseAnalysis?.why4 || '');
  const [why5, setWhy5] = useState(incident.rootCauseAnalysis?.why5 || '');
  const [rootCauseSummary, setRootCauseSummary] = useState(incident.rootCauseAnalysis?.rootCauseSummary || '');
  const [actions, setActions] = useState<CorrectiveAction[]>(incident.correctiveActions || []);

  // New action form state
  const [newActionText, setNewActionText] = useState('');
  const [newActionAssignee, setNewActionAssignee] = useState('');
  const [newActionDueDate, setNewActionDueDate] = useState('48 horas');
  const [newActionPriority, setNewActionPriority] = useState<'Media' | 'Alta' | 'Urgente'>('Alta');

  const handleSave = () => {
    const updatedRootCause: RootCauseAnalysis = {
      why1: why1.trim(),
      why2: why2.trim(),
      why3: why3.trim(),
      why4: why4.trim(),
      why5: why5.trim(),
      rootCauseSummary: rootCauseSummary.trim()
    };

    const updatedIncident: Incident = {
      ...incident,
      status,
      rootCauseAnalysis: updatedRootCause,
      correctiveActions: actions
    };

    onUpdateIncident(updatedIncident);
    onClose();
  };

  const handleAddAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionText.trim()) return;

    const actionItem: CorrectiveAction = {
      action: newActionText.trim(),
      assignee: newActionAssignee.trim() || 'Prevención Central',
      dueDate: newActionDueDate.trim() || 'En revisión',
      completed: false,
      priority: newActionPriority
    };

    setActions([...actions, actionItem]);
    setNewActionText('');
    setNewActionAssignee('');
  };

  const toggleActionComplete = (index: number) => {
    const updated = [...actions];
    updated[index].completed = !updated[index].completed;
    setActions(updated);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:text-black">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full my-8 text-slate-100 shadow-2xl overflow-hidden print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 print:border-b-2 print:border-black">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 print:text-black">
              <span className="font-bold text-sm">{incident.code}</span>
              <span>·</span>
              <span>{incident.type}</span>
              <span>·</span>
              <span className="tabular-nums">{new Date(incident.timestamp).toLocaleString('es-ES')}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 mt-1 print:text-black">
              {incident.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="p-2 text-slate-400 hover:text-slate-200 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer text-xs flex items-center gap-1.5"
              title="Imprimir informe oficial"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir Informe</span>
            </button>
            {onDeleteIncident && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-rose-400 hover:text-rose-300 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer text-xs flex items-center gap-1.5"
                title="Eliminar este hallazgo o incidente"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-800 bg-slate-950/30 print:hidden text-xs font-medium">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 rounded-t-lg transition-colors cursor-pointer ${
              activeTab === 'details'
                ? 'bg-slate-800 text-amber-400 font-semibold border-t-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ficha Técnica & Evidencia
          </button>
          <button
            onClick={() => setActiveTab('5whys')}
            className={`px-4 py-2 rounded-t-lg transition-colors cursor-pointer ${
              activeTab === '5whys'
                ? 'bg-slate-800 text-amber-400 font-semibold border-t-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Investigación (5 Porqués)
          </button>
          <button
            onClick={() => setActiveTab('actions')}
            className={`px-4 py-2 rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'actions'
                ? 'bg-slate-800 text-amber-400 font-semibold border-t-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Plan Correctivo (CAPA)</span>
            <span className="font-mono text-xs">({actions.length})</span>
          </button>
        </div>

        {/* Tab 1: Details */}
        {activeTab === 'details' && (
          <div className="p-6 space-y-6">
            {/* Status change row */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-950 rounded-lg border border-slate-800">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">Estado del Caso:</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Incident['status'])}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  <option value="Abierto">Abierto</option>
                  <option value="En Investigación">En Investigación</option>
                  <option value="Acción en Curso">Acción en Curso</option>
                  <option value="Cerrado">Cerrado / Verificado</option>
                </select>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div>
                  Severidad: <span className="font-semibold text-amber-300">{incident.severity}</span>
                </div>
                <div>
                  Ubicación: <span className="font-semibold text-slate-200">{incident.location}</span>
                </div>
              </div>
            </div>

            {/* Description & Immediate Action */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Descripción Detallada de los Hechos
                </h4>
                <p className="text-sm text-slate-200 bg-slate-950 p-3.5 rounded-lg border border-slate-800/80 leading-relaxed">
                  {incident.description}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Medida de Contención Inmediata Adoptada
                </h4>
                <p className="text-sm text-slate-200 bg-slate-950 p-3.5 rounded-lg border border-slate-800/80 leading-relaxed">
                  {incident.immediateAction || 'No se registraron medidas inmediatas adicionales.'}
                </p>
              </div>
            </div>

            {/* In-situ Photo Evidence */}
            {incident.photoUrl && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Registro Fotográfico In-Situ
                </h4>
                <div className="rounded-xl overflow-hidden border border-slate-800 max-h-72 bg-black flex items-center justify-center">
                  <img
                    src={incident.photoUrl}
                    alt="Evidencia fotográfica del incidente"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Reporter metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-950/60 rounded-lg border border-slate-800/60 text-xs">
              <div>
                <span className="text-slate-500 block">Reportado por:</span>
                <span className="font-semibold text-slate-200">{incident.reporterName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Rol / Función:</span>
                <span className="font-semibold text-slate-200">{incident.reporterRole}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Afectado / Testigos:</span>
                <span className="font-semibold text-slate-200">{incident.affectedPerson || 'Sin lesionados (Preventivo)'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: 5 Whys Investigation */}
        {activeTab === '5whys' && (
          <div className="p-6 space-y-4">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300">
              <span className="font-bold text-amber-400">Metodología de los 5 Porqués (Root Cause Analysis): </span>
              Interrogue la cadena de causalidad retrocediendo paso a paso hasta hallar el fallo del sistema de gestión, no solo el síntoma humano.
            </div>

            <div className="space-y-3">
              {[
                { label: '1er Porqué (Efecto inmediato):', val: why1, set: setWhy1, placeholder: '¿Por qué ocurrió el evento o falla inicial?' },
                { label: '2do Porqué (Causa directa):', val: why2, set: setWhy2, placeholder: '¿Por qué falló el componente, método o condición?' },
                { label: '3er Porqué (Causa intermedia):', val: why3, set: setWhy3, placeholder: '¿Por qué no se previno en la operación rutinaria?' },
                { label: '4to Porqué (Procedimiento):', val: why4, set: setWhy4, placeholder: '¿Por qué el procedimiento o supervisión no lo contuvo?' },
                { label: '5to Porqué (Causa Raíz de Gestión):', val: why5, set: setWhy5, placeholder: '¿Por qué el sistema de gestión o auditoría no lo detectó?' }
              ].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    {item.label}
                  </label>
                  <input
                    type="text"
                    value={item.val}
                    onChange={(e) => item.set(e.target.value)}
                    placeholder={item.placeholder}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                </div>
              ))}

              <div className="pt-2">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400 block mb-1">
                  Dictamen Final de Causa Raíz
                </label>
                <textarea
                  rows={2}
                  value={rootCauseSummary}
                  onChange={(e) => setRootCauseSummary(e.target.value)}
                  placeholder="Resuma la causa fundamental que debe corregirse para evitar recurrencia..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Corrective Actions */}
        {activeTab === 'actions' && (
          <div className="p-6 space-y-5">
            {/* Action list */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Medidas Correctivas y Preventivas (CAPA)
              </h4>

              {actions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-950 rounded-lg border border-slate-800">
                  No hay acciones correctivas asignadas aún.
                </div>
              ) : (
                <div className="space-y-2">
                  {actions.map((act, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                        act.completed
                          ? 'bg-slate-950/50 border-slate-800/50 opacity-70'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleActionComplete(index)}
                        className="flex items-center gap-3 text-left flex-1 cursor-pointer"
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                          act.completed ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-600 bg-slate-900'
                        }`}>
                          {act.completed && <CheckCircle className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className={`text-xs font-semibold ${act.completed ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                            {act.action}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span>Resp: {act.assignee}</span>
                            <span>·</span>
                            <span>Plazo: {act.dueDate}</span>
                            <span>·</span>
                            <span className={act.priority === 'Urgente' ? 'text-rose-400' : 'text-amber-400'}>
                              {act.priority}
                            </span>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => removeAction(index)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Eliminar acción"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add action sub-form */}
            <form onSubmit={handleAddAction} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Asignar Nueva Medida Correctiva</span>
              </div>
              <input
                type="text"
                placeholder="Detalle la acción correctiva (ej: Instalar resguardo perimetral según ISO 14120)"
                value={newActionText}
                onChange={(e) => setNewActionText(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Responsable (ej: Juan Pérez)"
                  value={newActionAssignee}
                  onChange={(e) => setNewActionAssignee(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                />
                <input
                  type="text"
                  placeholder="Fecha Límite (ej: 48h / 28 Oct)"
                  value={newActionDueDate}
                  onChange={(e) => setNewActionDueDate(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                />
                <select
                  value={newActionPriority}
                  onChange={(e) => setNewActionPriority(e.target.value as 'Media' | 'Alta' | 'Urgente')}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  <option value="Media">Prioridad Media</option>
                  <option value="Alta">Prioridad Alta</option>
                  <option value="Urgente">Prioridad Urgente</option>
                </select>
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300 rounded-lg transition-colors cursor-pointer"
              >
                Agregar a la Lista
              </button>
            </form>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/70 print:hidden">
          <div>
            {onDeleteIncident ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar este Hallazgo / Incidente</span>
              </button>
            ) : (
              <div className="text-xs text-slate-400">
                Cambios guardados localmente de forma inmediata.
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer"
            >
              Guardar Investigación
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-100">
                  ¿Confirmar eliminación de {incident.code}?
                </h3>
                <p className="text-xs text-slate-400">
                  Se eliminará este informe, su análisis de 5 Porqués y todas sus acciones correctivas asociadas de manera permanente.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono space-y-1">
              <div className="text-amber-400 font-bold">{incident.code} - {incident.type}</div>
              <div className="text-slate-300 font-sans">{incident.title}</div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
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
                    await onDeleteIncident(incident.id);
                    setShowDeleteConfirm(false);
                    onClose();
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
                <span>{isDeleting ? 'Eliminando...' : 'Sí, Eliminar Definitivamente'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
