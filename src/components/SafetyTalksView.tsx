import React, { useState } from 'react';
import {
  ClipboardCheck,
  Search,
  MapPin,
  Users,
  CheckCircle2,
  Clock,
  Trash2,
  PenTool,
  Camera
} from 'lucide-react';
import { SafetyTalk } from '../types';

interface SafetyTalksViewProps {
  talks: SafetyTalk[];
  onValidateTalk: (talk: SafetyTalk) => void;
  onDeleteTalk: (id: string) => void;
}

export const SafetyTalksView: React.FC<SafetyTalksViewProps> = ({
  talks,
  onValidateTalk,
  onDeleteTalk
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todas' | 'Enviada' | 'Validada Matriz'>('Todas');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredTalks = talks.filter((talk) => {
    const matchesStatus = statusFilter === 'Todas' || talk.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      talk.topic.toLowerCase().includes(q) ||
      talk.code.toLowerCase().includes(q) ||
      talk.instructorName.toLowerCase().includes(q) ||
      talk.location.toLowerCase().includes(q) ||
      talk.attendeeNames.some((n) => n.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  const pendingCount = talks.filter((t) => t.status === 'Enviada').length;
  const validatedCount = talks.filter((t) => t.status === 'Validada Matriz').length;

  return (
    <div className="space-y-6">
      {/* Header & Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              Registro de Charlas Firmadas desde Terreno
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Charlas de 5 minutos, inducciones y ART/AST con firma digital enviadas en tiempo real desde la App Satélite.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs shrink-0">
          <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-center">
            <div className="font-mono font-bold text-amber-400 text-sm">{pendingCount}</div>
            <div className="text-[11px] text-slate-400">Por Validar</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-center">
            <div className="font-mono font-bold text-emerald-400 text-sm">{validatedCount}</div>
            <div className="text-[11px] text-slate-400">Validadas</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por tema, código, relator, sector o asistente..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
          {(['Todas', 'Enviada', 'Validada Matriz'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === status
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {status === 'Enviada' ? 'Pendientes' : status === 'Validada Matriz' ? 'Validadas' : 'Todas'}
            </button>
          ))}
        </div>
      </div>

      {/* Talks List */}
      {filteredTalks.length === 0 ? (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-10 text-center space-y-2">
          <ClipboardCheck className="w-8 h-8 text-slate-600 mx-auto" />
          <div className="text-sm font-semibold text-slate-300">
            Aún no hay charlas firmadas registradas
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Cuando un trabajador o supervisor envíe una charla firmada desde la pestaña <strong>Charla Firmada</strong> en la App Satélite, aparecerá aquí automáticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTalks.map((talk) => (
            <div
              key={talk.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-md"
            >
              {/* Top Meta Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                      {talk.code}
                    </span>
                    <span className="text-slate-300 bg-slate-800 px-2 py-0.5 rounded font-medium">
                      {talk.talkType}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-semibold flex items-center gap-1 ${
                        talk.status === 'Validada Matriz'
                          ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-700/60'
                          : 'bg-blue-950/70 text-blue-300 border border-blue-700/60'
                      }`}
                    >
                      {talk.status === 'Validada Matriz' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      <span>{talk.status}</span>
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100 leading-snug">
                    {talk.topic}
                  </h3>
                </div>

                <span className="text-[11px] font-mono text-slate-500 shrink-0">
                  {talk.dateFormatted}
                </span>
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{talk.location}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    Relator: <strong>{talk.instructorName}</strong> · {talk.attendeesCount} asistente(s)
                  </span>
                </div>
              </div>

              {talk.attendeeNames.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Trabajadores Participantes ({talk.attendeeNames.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {talk.attendeeNames.map((name, idx) => (
                      <span
                        key={`${talk.id}-att-${idx}`}
                        className="text-[11px] bg-slate-800/80 text-slate-200 px-2 py-0.5 rounded border border-slate-700/60"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {talk.notes && (
                <p className="text-xs text-slate-300 bg-slate-950/50 border border-slate-800/60 rounded-lg p-2.5 leading-relaxed">
                  {talk.notes}
                </p>
              )}

              {/* Signature & Optional Sheet Photo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {talk.signatureDataUrl && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                      <PenTool className="w-3 h-3 text-amber-400" />
                      <span>Firma Digital Registrada</span>
                    </div>
                    <div className="bg-white rounded-xl p-2 border border-slate-700 h-28 flex items-center justify-center overflow-hidden">
                      <img
                        src={talk.signatureDataUrl}
                        alt={`Firma de charla ${talk.code}`}
                        className="max-h-24 w-auto object-contain"
                      />
                    </div>
                  </div>
                )}

                {talk.photoUrl && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                      <Camera className="w-3 h-3 text-blue-400" />
                      <span>Foto Planilla / Terreno</span>
                    </div>
                    <div className="bg-black rounded-xl border border-slate-700 h-28 overflow-hidden flex items-center justify-center">
                      <img
                        src={talk.photoUrl}
                        alt={`Evidencia charla ${talk.code}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                {talk.status !== 'Validada Matriz' ? (
                  <button
                    type="button"
                    onClick={() => onValidateTalk({ ...talk, status: 'Validada Matriz' })}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Validar en Matriz</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Validada y archivada en Matriz PRL</span>
                  </span>
                )}

                {confirmDeleteId === talk.id ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2.5 py-1 text-[11px] bg-slate-800 text-slate-300 rounded-lg cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteTalk(talk.id);
                        setConfirmDeleteId(null);
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg cursor-pointer"
                    >
                      Confirmar Borrar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(talk.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Eliminar registro de charla"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
