import React, { useState } from 'react';
import {
  AlertTriangle,
  Flame,
  Volume2,
  Users,
  ShieldAlert,
  PhoneCall,
  CheckCircle2,
  Building,
  RotateCcw
} from 'lucide-react';
import { EmergencyState } from '../types';
import { safetyAudio } from '../utils/audioAlert';

interface EmergencyCenterViewProps {
  emergency: EmergencyState;
  onUpdateEmergency: (state: EmergencyState) => void;
}

export const EmergencyCenterView: React.FC<EmergencyCenterViewProps> = ({
  emergency,
  onUpdateEmergency
}) => {
  const [selectedType, setSelectedType] = useState<EmergencyState['type']>('Evacuación General');
  const [location, setLocation] = useState('Planta Completa y Naves');
  const [message, setMessage] = useState('Evacuar inmediatamente por salidas de emergencia hacia Punto de Encuentro 1.');
  const [soundPlaying, setSoundPlaying] = useState(false);

  const handleTriggerEmergency = () => {
    safetyAudio.playEmergencySiren();
    setSoundPlaying(true);
    onUpdateEmergency({
      active: true,
      type: selectedType,
      location,
      triggeredAt: new Date().toLocaleTimeString('es-ES'),
      message,
      accountedWorkers: 35,
      totalWorkers: 150,
      assemblyPoint: 'Punto de Encuentro 1 (Zona Norte - Estacionamiento)'
    });
  };

  const handleDeactivate = () => {
    onUpdateEmergency({
      ...emergency,
      active: false
    });
    setSoundPlaying(false);
  };

  const handleIncrementMuster = (amount: number) => {
    const nextVal = Math.min(emergency.totalWorkers, Math.max(0, emergency.accountedWorkers + amount));
    onUpdateEmergency({
      ...emergency,
      accountedWorkers: nextVal
    });
  };

  const handlePlaySirenOnly = () => {
    safetyAudio.playEmergencySiren();
  };

  return (
    <div className="space-y-6">
      {/* Top Status Card */}
      <div
        className={`rounded-2xl p-6 border transition-all ${
          emergency.active
            ? 'bg-rose-950/80 border-rose-600 text-rose-100 shadow-2xl'
            : 'bg-slate-900 border-slate-800 text-slate-100 shadow-lg'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`p-4 rounded-xl shrink-0 ${
                emergency.active ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-amber-400">
                {emergency.active ? '¡ESTADO DE EMERGENCIA ACTIVO!' : 'SISTEMA DE EMERGENCIA EN ESPERA (STANDBY)'}
              </div>
              <h2 className="text-xl font-black text-slate-100 mt-1">
                {emergency.active ? emergency.type : 'Protocolo SOS & Plan de Contingencias'}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                {emergency.active
                  ? `Activado a las ${emergency.triggeredAt} en ${emergency.location}.`
                  : 'Listo para emitir alarmas audibles y coordinar evacuaciones de cuadrillas.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePlaySirenOnly}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-amber-400" />
              <span>Probar Sirena Acústica</span>
            </button>

            {emergency.active && (
              <button
                onClick={handleDeactivate}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-700 text-xs font-bold text-rose-300 rounded-lg cursor-pointer"
              >
                Desactivar Alarma
              </button>
            )}
          </div>
        </div>

        {/* Live Muster Count in Emergency */}
        {emergency.active && (
          <div className="mt-6 pt-5 border-t border-rose-800/80 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-rose-900/40 p-4 rounded-xl border border-rose-700/60">
              <span className="text-xs text-rose-300 block">Personal Evacuado y Contabilizado</span>
              <div className="text-3xl font-black text-white font-mono tabular-nums mt-1">
                {emergency.accountedWorkers} / {emergency.totalWorkers}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => handleIncrementMuster(1)}
                  className="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 text-white rounded text-xs font-bold"
                >
                  +1
                </button>
                <button
                  onClick={() => handleIncrementMuster(5)}
                  className="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 text-white rounded text-xs font-bold"
                >
                  +5
                </button>
                <button
                  onClick={() => handleIncrementMuster(10)}
                  className="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 text-white rounded text-xs font-bold"
                >
                  +10 Cuadrilla
                </button>
              </div>
            </div>

            <div className="bg-rose-900/40 p-4 rounded-xl border border-rose-700/60">
              <span className="text-xs text-rose-300 block">Punto de Encuentro Activo</span>
              <div className="text-sm font-bold text-white mt-1">
                {emergency.assemblyPoint}
              </div>
              <p className="text-xs text-rose-300 mt-2">
                Brigadistas asignados a control de accesos perimetrales.
              </p>
            </div>

            <div className="bg-rose-900/40 p-4 rounded-xl border border-rose-700/60">
              <span className="text-xs text-rose-300 block">Mensaje Transmitido a Satélites</span>
              <p className="text-xs text-rose-100 font-medium mt-1 leading-relaxed">
                "{emergency.message}"
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Emergency Trigger Dispatch Form */}
      {!emergency.active && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-500" />
            <span>Activar Alerta Masiva de Emergencia</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tipo de Siniestro / Evento
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as EmergencyState['type'])}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                <option value="Evacuación General">Evacuación General (Sirena)</option>
                <option value="Conato de Incendio">Conato de Incendio (Fuego)</option>
                <option value="Derrame Químico">Derrame Químico Tóxico</option>
                <option value="Atrapamiento Mecánico">Atrapamiento Mecánico</option>
                <option value="Emergencia Médica">Emergencia Médica Mayor</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Zona Afectada
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Instrucción para las Cuadrillas
              </label>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <button
            onClick={handleTriggerEmergency}
            className="w-full py-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-950 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>DISPARAR ALERTA DE EMERGENCIA & SIRENA EN TODA LA PLANTA</span>
          </button>
        </div>
      )}

      {/* Emergency Directory Contacts */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-emerald-400" />
          <span>Directorio de Enlace Rápido de Emergencias</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-400 block font-medium">Bomberos / Rescate</span>
            <span className="font-mono font-bold text-amber-400 text-base mt-1 block">132 / 911</span>
            <span className="text-[11px] text-slate-500">Unidad Central de Rescate</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-400 block font-medium">Mutualidad / ART Salud</span>
            <span className="font-mono font-bold text-emerald-400 text-base mt-1 block">1407</span>
            <span className="text-[11px] text-slate-500">Ambulancia & Atención Médica</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-400 block font-medium">Brigada Interna PRL</span>
            <span className="font-mono font-bold text-blue-400 text-base mt-1 block">Canal Radio 4</span>
            <span className="text-[11px] text-slate-500">Líder: Ing. Sarah Jenkins</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-400 block font-medium">Comité Paritario (CPHS)</span>
            <span className="font-mono font-bold text-slate-200 text-base mt-1 block">Ext. 204</span>
            <span className="text-[11px] text-slate-500">Coordinación de Evacuación</span>
          </div>
        </div>
      </div>
    </div>
  );
};
