export type IncidentType =
  | 'Accidente con Baja (LTI)'
  | 'Accidente sin Baja (FAC/MTC)'
  | 'Casi Accidente (Near Miss)'
  | 'Condición Insegura'
  | 'Acto Inseguro'
  | 'Emergencia / Conato';

export type SeverityLevel = 'Leve' | 'Moderado' | 'Grave' | 'Crítico';

export type IncidentStatus = 'Abierto' | 'En Investigación' | 'Acción en Curso' | 'Cerrado';

export interface RootCauseAnalysis {
  why1: string;
  why2: string;
  why3: string;
  why4: string;
  why5: string;
  rootCauseSummary: string;
}

export interface CorrectiveAction {
  action: string;
  assignee: string;
  dueDate: string;
  completed: boolean;
  priority: 'Baja' | 'Media' | 'Alta' | 'Urgente';
}

export interface Incident {
  id: string;
  code: string;
  timestamp: string;
  timeFormatted: string;
  title: string;
  description: string;
  location: string;
  type: IncidentType;
  severity: SeverityLevel;
  status: IncidentStatus;
  reporterName: string;
  reporterRole: string;
  affectedPerson?: string;
  immediateAction: string;
  photoUrl?: string;
  rootCauseAnalysis?: RootCauseAnalysis;
  correctiveActions: CorrectiveAction[];
}

export type HierarchyControl =
  | 'Eliminación'
  | 'Sustitución'
  | 'Control de Ingeniería'
  | 'Control Administrativo'
  | 'Equipos de Protección Personal (EPP)';

export interface RiskItem {
  id: string;
  area: string;
  task: string;
  hazard: string;
  riskDescription: string;
  probability: 1 | 2 | 3 | 4 | 5;
  severity: 1 | 2 | 3 | 4 | 5;
  riskScore: number;
  riskLevel: 'Trivial' | 'Tolerable' | 'Moderado' | 'Importante' | 'Intolerable';
  controlHierarchy: HierarchyControl;
  controlMeasure: string;
  responsiblePerson: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  status: 'passed' | 'failed' | 'na' | 'pending';
  observations?: string;
}

export interface InspectionChecklist {
  id: string;
  title: string;
  type: string;
  location: string;
  inspector: string;
  date: string;
  items: ChecklistItem[];
}

export interface EmergencyState {
  active: boolean;
  type: 'Evacuación General' | 'Derrame Químico' | 'Conato de Incendio' | 'Atrapamiento Mecánico' | 'Emergencia Médica';
  location: string;
  triggeredAt: string;
  message: string;
  accountedWorkers: number;
  totalWorkers: number;
  assemblyPoint: string;
}
