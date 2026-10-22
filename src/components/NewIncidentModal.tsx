import React, { useState, useEffect } from 'react';
import { X, Camera, AlertCircle, Clock, ShieldCheck, Check } from 'lucide-react';
import { Incident, IncidentType, SeverityLevel, IncidentStatus } from '../types';

interface NewIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (incident: Incident) => void;
  nextIncidentNumber: number;
}

const COMMON_LOCATIONS = [
  'Nave de Mecanizado - Celda 04',
  'Almacén Central - Bahía C',
  'Línea de Envasado y Paletizado 2',
  'Patio de Carga y Maniobra',
  'Taller de Soldadura y Calderería',
  'Sala de Calderas y Compresores',
  'Laboratorio de Control de Calidad',
  'Techumbre y Silos Exteriores'
];

const SAMPLE_PHOTOS = [
  {
    name: 'Guarda & Bloqueo LOTO',
    url: '/src/assets/images/prl_inspection_machinery_1792634598416.jpg'
  },
  {
    name: 'Pasillo Nave Industrial',
    url: '/src/assets/images/prl_industrial_plant_1792634598147.jpg'
  }
];

export const NewIncidentModal: React.FC<NewIncidentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  nextIncidentNumber
}) => {
  const [now, setNow] = useState(new Date());

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(COMMON_LOCATIONS[0]);
  const [customLocation, setCustomLocation] = useState('');
  const [type, setType] = useState<IncidentType>('Condición Insegura');
  const [severity, setSeverity] = useState<SeverityLevel>('Moderado');
  const [status, setStatus] = useState<IncidentStatus>('Abierto');
  const [reporterName, setReporterName] = useState('Sarah Jenkins');
  const [reporterRole, setReporterRole] = useState('OH&S Supervisor');
  const [affectedPerson, setAffectedPerson] = useState('');
  const [immediateAction, setImmediateAction] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  // Live timer for real-time reporting timestamp
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Por favor ingrese un título descriptivo del incidente.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Por favor detalle los hechos ocurridos en la descripción.');
      return;
    }

    const finalLocation = customLocation.trim() || location;
    const code = `INC-2026-${String(nextIncidentNumber).padStart(3, '0')}`;

    const newIncident: Incident = {
      id: `inc-${Date.now()}`,
      code,
      timestamp: now.toISOString(),
      timeFormatted: 'Registrado ahora mismo',
      title: title.trim(),
      description: description.trim(),
      location: finalLocation,
      type,
      severity,
      status,
      reporterName: reporterName.trim() || 'Técnico de Turno',
      reporterRole: reporterRole.trim() || 'Operador',
      affectedPerson: affectedPerson.trim() || undefined,
      immediateAction: immediateAction.trim() || 'Área señalizada preventivamente e informada a jefatura de turno.',
      photoUrl: selectedPhoto || undefined,
      rootCauseAnalysis: {
        why1: '',
        why2: '',
        why3: '',
        why4: '',
        why5: '',
        rootCauseSummary: ''
      },
      correctiveActions: [
        {
          action: 'Inspección técnica in-situ y verificación de controles de ingeniería.',
          assignee: reporterName.trim() || 'Supervisor de Seguridad',
          dueDate: '24 horas',
          completed: false,
          priority: severity === 'Crítico' || severity === 'Grave' ? 'Urgente' : 'Media'
        }
      ]
    };

    onSubmit(newIncident);
    // Reset fields
    setTitle('');
    setDescription('');
    setAffectedPerson('');
    setImmediateAction('');
    setSelectedPhoto('');
    setErrorMsg('');
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setSelectedPhoto(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full my-8 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div>
            <div className="flex items-center gap-2 text-xs text-amber-400 font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>REGISTRO EN TIEMPO REAL</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-300 tabular-nums">
                {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 mt-0.5">
              Reportar Incidente o Condición Insegura
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Row 1: Tipo y Severidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Tipo de Suceso / Evento *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as IncidentType)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                <option value="Condición Insegura">Condición Insegura (Entorno de riesgo)</option>
                <option value="Acto Inseguro">Acto Inseguro (Comportamiento humano)</option>
                <option value="Casi Accidente (Near Miss)">Casi Accidente (Near Miss sin daño)</option>
                <option value="Accidente sin Baja (FAC/MTC)">Accidente sin Baja (Atención médica)</option>
                <option value="Accidente con Baja (LTI)">Accidente con Baja (LTI - Con pérdida de jornada)</option>
                <option value="Emergencia / Conato">Emergencia / Conato (Fuego/Fuga)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nivel de Severidad Estimada *
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['Leve', 'Moderado', 'Grave', 'Crítico'] as SeverityLevel[]).map((sev) => {
                  const isSelected = severity === sev;
                  const colorMap = {
                    Leve: isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-slate-400 border-slate-800',
                    Moderado: isSelected ? 'bg-amber-600 text-white' : 'bg-slate-950 text-slate-400 border-slate-800',
                    Grave: isSelected ? 'bg-orange-600 text-white' : 'bg-slate-950 text-slate-400 border-slate-800',
                    Crítico: isSelected ? 'bg-rose-600 text-white' : 'bg-slate-950 text-slate-400 border-slate-800'
                  };
                  return (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setSeverity(sev)}
                      className={`py-2 px-1 text-center text-xs font-medium rounded-lg border transition-colors cursor-pointer ${colorMap[sev]}`}
                    >
                      {sev}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 2: Título */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Título del Incidente *
            </label>
            <input
              type="text"
              placeholder="Ej: Fuga de aire comprimido a alta presión con manguera suelta"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          {/* Row 3: Ubicación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Área / Ubicación Operativa *
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                {COMMON_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Detalle específico de ubicación (Opcional)
              </label>
              <input
                type="text"
                placeholder="Punto kilométrico, pasillo o máquina específica"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Row 4: Descripción */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Descripción de lo ocurrido (Hechos objetivos) *
            </label>
            <textarea
              rows={3}
              placeholder="Describa qué sucedió, cómo se detectó y qué máquinas o personas estuvieron involucradas..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          {/* Row 5: Acción Inmediata y Personas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Acción de Contención Inmediata
              </label>
              <input
                type="text"
                placeholder="Ej: Se paró la máquina y se colocó baliza perimetral"
                value={immediateAction}
                onChange={(e) => setImmediateAction(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Trabajador Afectado (Si hubo lesiones)
              </label>
              <input
                type="text"
                placeholder="Nombre o Ninguno (Near Miss/Condición)"
                value={affectedPerson}
                onChange={(e) => setAffectedPerson(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Row 6: Reportante y Rol */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Persona que Reporta
              </label>
              <input
                type="text"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Cargo / Rol PRL
              </label>
              <input
                type="text"
                value={reporterRole}
                onChange={(e) => setReporterRole(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Estado Inicial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as IncidentStatus)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                <option value="Abierto">Abierto</option>
                <option value="En Investigación">En Investigación</option>
                <option value="Acción en Curso">Acción en Curso</option>
              </select>
            </div>
          </div>

          {/* Row 7: Evidencia Fotográfica */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Evidencia Fotográfica In-Situ (Opcional)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="px-3 py-2 bg-slate-950 border border-dashed border-slate-700 hover:border-amber-400 rounded-lg text-xs text-slate-300 flex items-center gap-2 cursor-pointer transition-colors">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>Cargar foto de dispositivo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {SAMPLE_PHOTOS.map((photo) => (
                <button
                  key={photo.name}
                  type="button"
                  onClick={() => setSelectedPhoto(photo.url)}
                  className={`px-3 py-2 rounded-lg text-xs border transition-colors flex items-center gap-1.5 cursor-pointer ${
                    selectedPhoto === photo.url
                      ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {selectedPhoto === photo.url && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{photo.name}</span>
                </button>
              ))}

              {selectedPhoto && (
                <button
                  type="button"
                  onClick={() => setSelectedPhoto('')}
                  className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer ml-auto"
                >
                  Quitar foto
                </button>
              )}
            </div>

            {selectedPhoto && (
              <div className="mt-2 relative w-24 h-16 rounded-md overflow-hidden border border-slate-700">
                <img
                  src={selectedPhoto}
                  alt="Vista previa evidencia"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-amber-950 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Guardar y Notificar en Vivo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
