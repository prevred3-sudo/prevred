import React, { useState } from 'react';
import {
  Bell,
  Send,
  AlertTriangle,
  Info,
  Siren,
  MapPin,
  UserCheck,
  Trash2,
  CheckCircle2,
  Search
} from 'lucide-react';
import { NotificationPriority, WorkerNotification } from '../types';

interface WorkerNotificationsViewProps {
  notifications: WorkerNotification[];
  onSendNotification: (notif: WorkerNotification) => Promise<WorkerNotification | void>;
  onDeleteNotification: (id: string) => void;
}

const TARGET_ZONES = [
  'Todos los Sectores',
  'Sector 1 - Nave de Mecanizado',
  'Sector 2 - Patio de Carga y Maniobras',
  'Sector 3 - Almacén y Silos',
  'Sector 4 - Taller de Mantenimiento',
  'Sector 5 - Trabajos en Altura / Techumbre',
  'Sector 6 - Área de Soldadura'
];

const QUICK_PRESETS: Array<{
  title: string;
  message: string;
  priority: NotificationPriority;
}> = [
  {
    title: 'Detener trabajos en altura por viento',
    message: 'Por ráfagas de viento sobre el límite permitido, suspender maniobras en techumbre y andamios hasta nueva orden.',
    priority: 'Urgente'
  },
  {
    title: 'Verificación obligatoria de bloqueo LOTO',
    message: 'Antes de intervenir equipos eléctricos o prensas, confirmar candado personal y tarjeta LOTO instalada.',
    priority: 'Advertencia'
  },
  {
    title: 'Uso obligatorio de protección auditiva y gafas',
    message: 'Recordatorio preventivo: mantener EPP completo durante toda la jornada en áreas operativas.',
    priority: 'Informativa'
  },
  {
    title: 'Reunión rápida de coordinación PRL',
    message: 'Se solicita presencia de encargados de cuadrilla en punto de encuentro central en 10 minutos.',
    priority: 'Advertencia'
  }
];

export const WorkerNotificationsView: React.FC<WorkerNotificationsViewProps> = ({
  notifications,
  onSendNotification,
  onDeleteNotification
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<NotificationPriority>('Advertencia');
  const [targetZone, setTargetZone] = useState(TARGET_ZONES[0]);
  const [targetWorker, setTargetWorker] = useState('');
  const [senderName, setSenderName] = useState('Matriz PRL · Jefatura');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sentToast, setSentToast] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSentToast('');

    if (!title.trim() || !message.trim()) {
      setErrorMsg('Ingresa un título y un mensaje para enviar la notificación a los trabajadores.');
      return;
    }

    setIsSending(true);
    const now = new Date();
    const code = `AVISO-${Math.floor(1000 + Math.random() * 9000)}`;
    const newNotification: WorkerNotification = {
      id: `notif-${Date.now()}`,
      code,
      timestamp: now.toISOString(),
      timeFormatted: now.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }),
      title: title.trim().slice(0, 200),
      message: message.trim().slice(0, 1500),
      priority,
      targetZone: targetZone.trim() || 'Todos los Sectores',
      targetWorker: targetWorker.trim() || 'Todos',
      senderName: senderName.trim() || 'Matriz PRL · Jefatura',
      active: true,
      acknowledgedBy: []
    };

    try {
      await onSendNotification(newNotification);
      setSentToast(`Notificación ${code} enviada en tiempo real a la App Satélite.`);
      setTimeout(() => setSentToast(''), 5500);
      setTitle('');
      setMessage('');
      setTargetWorker('');
    } catch {
      setErrorMsg('No se pudo enviar la notificación. Verifica la conexión e intenta nuevamente.');
    } finally {
      setIsSending(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      n.title.toLowerCase().includes(q) ||
      n.message.toLowerCase().includes(q) ||
      n.code.toLowerCase().includes(q) ||
      n.targetZone.toLowerCase().includes(q) ||
      n.targetWorker.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              Enviar Notificaciones a Trabajadores (App Satélite)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Emite instrucciones operativas, advertencias climáticas o avisos urgentes en tiempo real directamente a los teléfonos en terreno.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs shrink-0">
          <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-center">
            <div className="font-mono font-bold text-amber-400 text-sm">{notifications.length}</div>
            <div className="text-[11px] text-slate-400">Avisos Emitidos</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-center">
            <div className="font-mono font-bold text-emerald-400 text-sm">
              {notifications.reduce((acc, n) => acc + (n.acknowledgedBy?.length || 0), 0)}
            </div>
            <div className="text-[11px] text-slate-400">Lecturas Confirmadas</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Compose Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 h-fit shadow-lg"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Send className="w-4 h-4 text-amber-400" />
              <span>Nuevo Aviso para Terreno</span>
            </h3>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Plantillas Rápidas
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PRESETS.map((preset) => (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => {
                    setTitle(preset.title);
                    setMessage(preset.message);
                    setPriority(preset.priority);
                    setErrorMsg('');
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors cursor-pointer text-left"
                >
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Nivel de Prioridad
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Informativa', 'Advertencia', 'Urgente'] as NotificationPriority[]).map((level) => {
                const isSelected = priority === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setPriority(level)}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? level === 'Urgente'
                          ? 'bg-rose-600 border-rose-400 text-white shadow-md shadow-rose-950'
                          : level === 'Advertencia'
                          ? 'bg-amber-400 border-amber-300 text-slate-950'
                          : 'bg-blue-600 border-blue-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {level === 'Urgente' ? (
                      <Siren className="w-3.5 h-3.5" />
                    ) : level === 'Advertencia' ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <Info className="w-3.5 h-3.5" />
                    )}
                    <span>{level}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Zone & Worker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Sector Destino
              </label>
              <select
                value={targetZone}
                onChange={(e) => setTargetZone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                {TARGET_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Trabajador (Opcional)
              </label>
              <input
                type="text"
                value={targetWorker}
                onChange={(e) => setTargetWorker(e.target.value)}
                placeholder="Todos los trabajadores"
                maxLength={120}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Título del Aviso
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Suspender maniobras en patio norte"
              maxLength={200}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* Message */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Instrucción / Mensaje para el Trabajador
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe claramente la instrucción de seguridad o aviso operativo..."
              maxLength={1500}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
            />
          </div>

          {/* Sender */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Emitido por
            </label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              maxLength={120}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            />
          </div>

          {errorMsg && (
            <div className="bg-rose-950/80 border border-rose-500/50 rounded-xl p-3 text-xs text-rose-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {sentToast && (
            <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-xl p-3 text-xs text-emerald-200 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{sentToast}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSending}
            className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-amber-950"
          >
            <Send className="w-4 h-4" />
            <span>{isSending ? 'Enviando a Terreno...' : 'Enviar Notificación a App Satélite'}</span>
          </button>
        </form>

        {/* Right: Dispatches History & Read Confirmations */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar avisos enviados por título, sector o código..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          {filteredNotifications.length === 0 ? (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-10 text-center space-y-2">
              <Bell className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-300">
                No hay notificaciones enviadas todavía
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Usa el formulario de la izquierda para enviar una alerta o instrucción directa a los teléfonos con la App Satélite instalada.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`bg-slate-900 border rounded-2xl p-4 space-y-3 shadow-md ${
                    notif.priority === 'Urgente'
                      ? 'border-rose-700/60'
                      : notif.priority === 'Advertencia'
                      ? 'border-amber-700/50'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                          {notif.code}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold uppercase ${
                            notif.priority === 'Urgente'
                              ? 'bg-rose-600 text-white'
                              : notif.priority === 'Advertencia'
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {notif.priority}
                        </span>
                        <span className="text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-400" />
                          {notif.targetZone}
                        </span>
                        {notif.targetWorker && notif.targetWorker !== 'Todos' && (
                          <span className="bg-slate-800 text-amber-300 px-2 py-0.5 rounded">
                            Para: {notif.targetWorker}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-100">{notif.title}</h4>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500 shrink-0">
                      {notif.timeFormatted}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 leading-relaxed">
                    {notif.message}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>
                          Confirmado por {notif.acknowledgedBy?.length || 0} trabajador(es):
                        </span>
                      </span>
                      {notif.acknowledgedBy && notif.acknowledgedBy.length > 0 ? (
                        notif.acknowledgedBy.map((name, idx) => (
                          <span
                            key={`${notif.id}-ack-${idx}`}
                            className="bg-emerald-950/70 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded"
                          >
                            {name}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500">En espera de lectura en terreno</span>
                      )}
                    </div>

                    {confirmDeleteId === notif.id ? (
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
                            onDeleteNotification(notif.id);
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
                        onClick={() => setConfirmDeleteId(notif.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Eliminar notificación"
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
      </div>
    </div>
  );
};
