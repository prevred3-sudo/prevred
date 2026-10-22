import React, { useState } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  Trash2,
  Plus,
  RotateCcw
} from 'lucide-react';
import { InspectionChecklist, Incident, ChecklistItem } from '../types';

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
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Seguridad Operativa');

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

  // Eliminate/clear detected finding for a specific checklist item
  const handleClearFinding = (itemId: string) => {
    setLocalChecklists((prev) =>
      prev.map((chk) => {
        if (chk.id !== activeChecklist.id) return chk;
        return {
          ...chk,
          items: chk.items.map((it) => (it.id === itemId ? { ...it, status: 'pending', observations: '' } : it))
        };
      })
    );
  };

  // Delete an item permanently from the checklist
  const handleDeleteItem = (itemId: string) => {
    setLocalChecklists((prev) =>
      prev.map((chk) => {
        if (chk.id !== activeChecklist.id) return chk;
        return {
          ...chk,
          items: chk.items.filter((it) => it.id !== itemId)
        };
      })
    );
  };

  // Clear all failed findings in the active checklist
  const handleClearAllFindings = () => {
    if (!confirm('¿Desea restablecer y eliminar todos los hallazgos no conformes de esta inspección?')) return;
    setLocalChecklists((prev) =>
      prev.map((chk) => {
        if (chk.id !== activeChecklist.id) return chk;
        return {
          ...chk,
          items: chk.items.map((it) => (it.status === 'failed' ? { ...it, status: 'pending', observations: '' } : it))
        };
      })
    );
  };

  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemLabel.trim()) return;
    const newItem: ChecklistItem = {
      id: `chk-item-${Date.now()}`,
      label: newItemLabel.trim(),
      category: newItemCategory.trim(),
      status: 'pending'
    };
    setLocalChecklists((prev) =>
      prev.map((chk) => {
        if (chk.id !== activeChecklist.id) return chk;
        return {
          ...chk,
          items: [...chk.items, newItem]
        };
      })
    );
    setNewItemLabel('');
    setShowAddItem(false);
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

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-400" />
              <span>Inspector: <strong className="text-slate-200">{activeChecklist.inspector}</strong></span>
            </div>

            {failedCount > 0 && (
              <button
                type="button"
                onClick={handleClearAllFindings}
                className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Restablecer todos los hallazgos no conformes"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpiar Hallazgos ({failedCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAddItem(!showAddItem)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Ítem</span>
            </button>
          </div>
        </div>

        {/* Add Item Inline Form */}
        {showAddItem && (
          <form
            onSubmit={handleAddNewItem}
            className="p-4 bg-slate-950 border border-amber-500/30 rounded-xl space-y-3 animate-in fade-in"
          >
            <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>Agregar Nuevo Punto de Control / Hallazgo a la Inspección</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Descripción del punto de control..."
                value={newItemLabel}
                onChange={(e) => setNewItemLabel(e.target.value)}
                className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                required
              />
              <input
                type="text"
                placeholder="Categoría (ej: EPP, LOTO, PCI)"
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddItem(false)}
                className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-900 rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer"
              >
                Guardar Punto de Inspección
              </button>
            </div>
          </form>
        )}

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
                    type="button"
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
                    type="button"
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

                  {/* Delete Item Button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors cursor-pointer ml-1"
                    title="Eliminar este ítem de la lista"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Observation field if failed or has note */}
              {item.status === 'failed' && (
                <div className="p-3 bg-slate-900 rounded-lg border border-rose-900/40 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[11px] text-rose-300 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Observación del Hallazgo Detectado:</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleClearFinding(item.id)}
                        className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Descartar este hallazgo y volver a estado pendiente"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Eliminar / Descartar Hallazgo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onPromoteFindingToIncident(activeChecklist, item.label, item.observations)}
                        className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 underline cursor-pointer ml-2"
                      >
                        <span>⚡ Convertir en Incidente Abierto</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
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
