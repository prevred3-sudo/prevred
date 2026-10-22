import React, { useState } from 'react';
import { ClipboardCheck, CheckCircle2, XCircle, AlertTriangle, ArrowRight, UserCheck } from 'lucide-react';
import { InspectionChecklist, Incident } from '../types';

interface SafetyChecklistsViewProps {
  checklists: InspectionChecklist[];
  onPromoteFindingToIncident: (checklist: InspectionChecklist, itemLabel: string, note?: string) => void;
}

export const SafetyChecklistsView: React.FC<SafetyChecklistsViewProps> = ({
  checklists,
  onPromoteFindingToIncident
}) => {
  const [activeChecklistId, setActiveChecklistId] = useState(checklists[0]?.id || '');
  const [localChecklists, setLocalChecklists] = useState<InspectionChecklist[]>(checklists);

  const activeChecklist = localChecklists.find((c) => c.id === activeChecklistId) || localChecklists[0];

  const handleToggleStatus = (itemId: string, status: 'passed' | 'failed' | 'pending') => {
    setLocalChecklists((prev) =>
      prev.map((chk) => {
        if (chk.id !== activeChecklist.id) return chk;
        return {
          ...chk,
          items: chk.items.map((it) => (it.id === itemId ? { ...it, status } : it))
        };
      })
    );
  };

  const handleUpdateNote = (itemId: string, observations: string) => {
    setLocalChecklists((prev) =>
      prev.map((chk) => {
        if (chk.id !== activeChecklist.id) return chk;
        return {
          ...chk,
          items: chk.items.map((it) => (it.id === itemId ? { ...it, observations } : it))
        };
      })
    );
  };

  if (!activeChecklist) return null;

  const passedCount = activeChecklist.items.filter((i) => i.status === 'passed').length;
  const failedCount = activeChecklist.items.filter((i) => i.status === 'failed').length;
  const score = Math.round((passedCount / activeChecklist.items.length) * 100);

  return (
    <div className="space-y-6">
      {/* Selector of checklists */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-amber-400" />
              <span>Inspecciones & Auditorías de Seguridad Operativa</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Verificaciones de campo. Las no-conformidades pueden ser convertidas en incidentes activos con 1 clic.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Cumplimiento:</span>
            <span className={`font-mono font-bold text-sm ${score >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {score}%
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
          {localChecklists.map((chk) => (
            <button
              key={chk.id}
              onClick={() => setActiveChecklistId(chk.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeChecklist.id === chk.id
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {chk.title}
            </button>
          ))}
        </div>
      </div>

      {/* Active Checklist Details */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400">
          <div className="space-y-1">
            <div className="text-sm font-bold text-slate-200">{activeChecklist.title}</div>
            <div className="flex items-center gap-3">
              <span>Tipo: <strong className="text-slate-300">{activeChecklist.type}</strong></span>
              <span>·</span>
              <span>Ubicación: <strong className="text-slate-300">{activeChecklist.location}</strong></span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-amber-400" />
            <span>Inspector: <strong className="text-slate-200">{activeChecklist.inspector}</strong></span>
          </div>
        </div>

        {/* Items List */}
        <div className="space-y-3">
          {activeChecklist.items.map((item, idx) => (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition-all space-y-3 ${
                item.status === 'failed'
                  ? 'bg-rose-950/20 border-rose-900/60'
                  : item.status === 'passed'
                  ? 'bg-slate-950 border-slate-800'
                  : 'bg-slate-950/50 border-slate-800/50'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-xs text-slate-500 font-bold mt-0.5">
                    #{idx + 1}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      {item.label}
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Categoría: {item.category}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                  <button
                    onClick={() => handleToggleStatus(item.id, 'passed')}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                      item.status === 'passed'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Conforme</span>
                  </button>

                  <button
                    onClick={() => handleToggleStatus(item.id, 'failed')}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                      item.status === 'failed'
                        ? 'bg-rose-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>No Conforme</span>
                  </button>
                </div>
              </div>

              {/* Observation field if failed or has note */}
              {item.status === 'failed' && (
                <div className="p-3 bg-slate-900 rounded-lg border border-rose-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-rose-300 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Observación del Hallazgo Detectado:</span>
                    </span>
                    <button
                      onClick={() => onPromoteFindingToIncident(activeChecklist, item.label, item.observations)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 underline cursor-pointer"
                    >
                      <span>⚡ Convertir en Incidente Abierto en Vivo</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={item.observations || ''}
                    onChange={(e) => handleUpdateNote(item.id, e.target.value)}
                    placeholder="Describa la no conformidad observada para el registro..."
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
