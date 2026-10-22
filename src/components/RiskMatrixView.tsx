import React, { useState } from 'react';
import { ShieldCheck, Plus, Check, Filter } from 'lucide-react';
import { RiskItem, HierarchyControl } from '../types';

interface RiskMatrixViewProps {
  risks: RiskItem[];
  onAddRisk: (risk: RiskItem) => void;
}

export const RiskMatrixView: React.FC<RiskMatrixViewProps> = ({ risks, onAddRisk }) => {
  const [selectedCell, setSelectedCell] = useState<{ p: number; s: number } | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  // New risk state
  const [area, setArea] = useState('Nave de Mecanizado');
  const [task, setTask] = useState('');
  const [hazard, setHazard] = useState('');
  const [riskDescription, setRiskDescription] = useState('');
  const [probability, setProbability] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [controlHierarchy, setControlHierarchy] = useState<HierarchyControl>('Control de Ingeniería');
  const [controlMeasure, setControlMeasure] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('Prevencionista de Turno');

  // Matrix levels calculation
  const getRiskLevel = (p: number, s: number): RiskItem['riskLevel'] => {
    const score = p * s;
    if (score >= 17) return 'Intolerable';
    if (score >= 12) return 'Importante';
    if (score >= 8) return 'Moderado';
    if (score >= 4) return 'Tolerable';
    return 'Trivial';
  };

  const getCellColor = (p: number, s: number) => {
    const level = getRiskLevel(p, s);
    switch (level) {
      case 'Intolerable':
        return 'bg-rose-950/70 border-rose-600 text-rose-200';
      case 'Importante':
        return 'bg-orange-950/70 border-orange-600 text-orange-200';
      case 'Moderado':
        return 'bg-amber-950/70 border-amber-600 text-amber-200';
      case 'Tolerable':
        return 'bg-yellow-950/50 border-yellow-700 text-yellow-200';
      case 'Trivial':
        return 'bg-emerald-950/60 border-emerald-700 text-emerald-200';
    }
  };

  const handleCreateRisk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.trim() || !hazard.trim()) return;

    const riskScore = probability * severity;
    const newRisk: RiskItem = {
      id: `risk-${Date.now()}`,
      area,
      task: task.trim(),
      hazard: hazard.trim(),
      riskDescription: riskDescription.trim() || 'Riesgo evaluado según estándar IPERC',
      probability,
      severity,
      riskScore,
      riskLevel: getRiskLevel(probability, severity),
      controlHierarchy,
      controlMeasure: controlMeasure.trim() || 'Control de ingeniería y supervisión reglamentaria.',
      responsiblePerson: responsiblePerson.trim() || 'Supervisor'
    };

    onAddRisk(newRisk);
    setTask('');
    setHazard('');
    setRiskDescription('');
    setControlMeasure('');
    setShowAddForm(false);
  };

  const filteredRisks = risks.filter((r) => {
    if (selectedCell) {
      return r.probability === selectedCell.p && r.severity === selectedCell.s;
    }
    if (levelFilter !== 'all') {
      return r.riskLevel === levelFilter;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <span>Matriz IPERC · Evaluación de Riesgos y Controles</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Identificación de Peligros, Evaluación de Riesgos y Medidas de Control (Método 5x5)
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 text-slate-950" />
            <span>{showAddForm ? 'Ocultar Formulario' : 'Nuevo Peligro IPERC'}</span>
          </button>
        </div>

        {/* Add Risk Form */}
        {showAddForm && (
          <form onSubmit={handleCreateRisk} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Registrar Nueva Evaluación IPERC
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Área / Proceso
                </label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tarea / Puesto de Trabajo
                </label>
                <input
                  type="text"
                  placeholder="Ej: Cambio de cuchillas en cizalla circular"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Peligro Identificado (Fuente / Situación)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Bordes afilados y energía mecánica residual"
                  value={hazard}
                  onChange={(e) => setHazard(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Riesgo Asociado (Consecuencia)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Laceración profunda o amputación de falanges"
                  value={riskDescription}
                  onChange={(e) => setRiskDescription(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Probabilidad (1 a 5)
                </label>
                <select
                  value={probability}
                  onChange={(e) => setProbability(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  <option value={1}>1 - Muy Rara (Altamente improbable)</option>
                  <option value={2}>2 - Rara (Poco probable pero posible)</option>
                  <option value={3}>3 - Ocasional (Podría ocurrir en el año)</option>
                  <option value={4}>4 - Frecuente (Ocurre periódicamente)</option>
                  <option value={5}>5 - Continua (Certeza casi absoluta)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Severidad / Daño (1 a 5)
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  <option value={1}>1 - Insignificante (Primeros auxilios)</option>
                  <option value={2}>2 - Menor (Baja temporal menor)</option>
                  <option value={3}>3 - Moderada (Lesión con baja médica)</option>
                  <option value={4}>4 - Grave (Incapacidad permanente)</option>
                  <option value={5}>5 - Catastrófica (Múltiples fatalidades)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nivel de Riesgo Calculado
                </label>
                <div className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-amber-400">
                  {probability * severity} pts · {getRiskLevel(probability, severity)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Jerarquía del Control
                </label>
                <select
                  value={controlHierarchy}
                  onChange={(e) => setControlHierarchy(e.target.value as HierarchyControl)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  <option value="Eliminación">1. Eliminación del peligro</option>
                  <option value="Sustitución">2. Sustitución por alternativa inocua</option>
                  <option value="Control de Ingeniería">3. Control de Ingeniería (Resguardos / Barreras)</option>
                  <option value="Control Administrativo">4. Control Administrativo (Procedimiento / Charlas)</option>
                  <option value="Equipos de Protección Personal (EPP)">5. Equipos de Protección Personal (EPP)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Medida de Control Concreta
                </label>
                <input
                  type="text"
                  placeholder="Detalle el resguardo, procedimiento o EPP específico..."
                  value={controlMeasure}
                  onChange={(e) => setControlMeasure(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg"
              >
                Guardar en Matriz
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 5x5 Matrix Visual Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Cuadrícula 5x5: Probabilidad vs Severidad (P × S)
          </span>
          {selectedCell && (
            <button
              onClick={() => setSelectedCell(null)}
              className="text-xs text-amber-400 hover:text-amber-300 font-medium"
            >
              Limpiar filtro de celda seleccionada (P{selectedCell.p} × S{selectedCell.s})
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[580px] grid grid-cols-6 gap-2 text-center text-xs">
            {/* Header Column */}
            <div className="p-2 font-mono font-bold text-slate-500 flex items-center justify-center">
              P \ S
            </div>
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className="p-2 font-mono font-semibold text-slate-400 border-b border-slate-800">
                S{s} ({['Leve', 'Menor', 'Mod', 'Grave', 'Cat'][s - 1]})
              </div>
            ))}

            {/* Rows for Probability 5 down to 1 */}
            {[5, 4, 3, 2, 1].map((p) => (
              <React.Fragment key={p}>
                <div className="p-2 font-mono font-semibold text-slate-400 flex items-center justify-center border-r border-slate-800">
                  P{p} ({['Rara', 'Baja', 'Med', 'Alta', 'Cont'][p - 1]})
                </div>
                {[1, 2, 3, 4, 5].map((s) => {
                  const count = risks.filter((r) => r.probability === p && r.severity === s).length;
                  const isSelected = selectedCell?.p === p && selectedCell?.s === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setSelectedCell(isSelected ? null : { p, s })}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col items-center justify-center relative ${getCellColor(
                        p,
                        s
                      )} ${isSelected ? 'ring-2 ring-white scale-105 z-10' : 'hover:scale-[1.02]'}`}
                    >
                      <span className="font-mono text-xs opacity-70">
                        {p * s} pts
                      </span>
                      <span className="font-mono text-base font-black tabular-nums mt-0.5">
                        {count > 0 ? `${count} pel.` : '-'}
                      </span>
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-700 inline-block"></span>
            <span>Trivial (1-3)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-yellow-700 inline-block"></span>
            <span>Tolerable (4-7)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-600 inline-block"></span>
            <span>Moderado (8-11)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-orange-600 inline-block"></span>
            <span>Importante (12-16)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-600 inline-block"></span>
            <span>Intolerable (17-25)</span>
          </div>
        </div>
      </div>

      {/* Hazards Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100">
            Registro de Peligros y Medidas de Control ({filteredRisks.length})
          </h3>

          <div className="flex items-center gap-2">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="all">Nivel de Riesgo: Todos</option>
              <option value="Intolerable">Intolerable</option>
              <option value="Importante">Importante</option>
              <option value="Moderado">Moderado</option>
              <option value="Tolerable">Tolerable</option>
              <option value="Trivial">Trivial</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 px-3">Área & Tarea</th>
                <th className="py-2.5 px-3">Peligro</th>
                <th className="py-2.5 px-3">Riesgo / Daño</th>
                <th className="py-2.5 px-3 text-center">P × S</th>
                <th className="py-2.5 px-3">Nivel</th>
                <th className="py-2.5 px-3">Jerarquía</th>
                <th className="py-2.5 px-3">Medida de Control Adoptada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRisks.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-200 block">{item.area}</span>
                    <span className="text-[11px] text-slate-400">{item.task}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-300 font-medium max-w-xs">
                    {item.hazard}
                  </td>
                  <td className="py-3 px-3 text-slate-400 max-w-xs">
                    {item.riskDescription}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold text-slate-200 tabular-nums">
                    {item.probability} × {item.severity} = {item.riskScore}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`font-mono text-[11px] font-semibold ${
                      item.riskLevel === 'Intolerable' ? 'text-rose-400' :
                      item.riskLevel === 'Importante' ? 'text-orange-400' :
                      item.riskLevel === 'Moderado' ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {item.riskLevel}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    {item.controlHierarchy}
                  </td>
                  <td className="py-3 px-3 text-slate-300 max-w-sm">
                    {item.controlMeasure}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
