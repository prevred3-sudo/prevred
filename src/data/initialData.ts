import { Incident, RiskItem, InspectionChecklist, EmergencyState } from '../types';

export const INITIAL_INCIDENTS: Incident[] = [
  {
    id: 'inc-001',
    code: 'INC-2026-042',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(), // 18 mins ago
    timeFormatted: 'Hace 18 minutos',
    title: 'Derrame de aceite lubricante hidráulico sin contención',
    description: 'Fuga repentina por rotura de latiguillo en prensa hidráulica #4. El fluido cubrió un radio de 3 metros sobre el pasillo peatonal con alto riesgo de caída al mismo nivel.',
    location: 'Nave de Mecanizado - Celda 04',
    type: 'Condición Insegura',
    severity: 'Moderado',
    status: 'Acción en Curso',
    reporterName: 'Carlos Mendonza',
    reporterRole: 'Operador de Prensa',
    immediateAction: 'Se acordonó el área con cinta perimetral amarilla/negra y se vertió material absorbente sepiolita.',
    photoUrl: '/src/assets/images/prl_inspection_machinery_1792634598416.jpg',
    rootCauseAnalysis: {
      why1: '¿Por qué hubo derrame? Falló el latiguillo hidráulico de alimentación.',
      why2: '¿Por qué falló el latiguillo? Sobrepresión y desgaste por fricción continuada.',
      why3: '¿Por qué había desgaste? No se sustituyó en la última orden de mantenimiento.',
      why4: '¿Por qué no se sustituyó? Rotura de stock del repuesto en pañol técnico.',
      why5: '¿Por qué no había stock? Falta de alerta automática de umbral mínimo en ERP.',
      rootCauseSummary: 'Ausencia de control de inventario predictivo en componentes críticos de presión hidráulica.'
    },
    correctiveActions: [
      {
        action: 'Completar limpieza total y recogida de residuos en contenedor de tóxicos.',
        assignee: 'Equipo de Mantenimiento / R. Soto',
        dueDate: 'Hoy, 20:00',
        completed: true,
        priority: 'Alta'
      },
      {
        action: 'Revisión exhaustiva de latiguillos de las 8 prensas hermanas de la línea.',
        assignee: 'Ing. M. Valenzuela',
        dueDate: 'Mañana, 12:00',
        completed: false,
        priority: 'Urgente'
      }
    ]
  },
  {
    id: 'inc-002',
    code: 'INC-2026-041',
    timestamp: new Date(Date.now() - 1000 * 60 * 85).toISOString(), // 1.5 hrs ago
    timeFormatted: 'Hace 1 hora y 25m',
    title: 'Casi accidente (Near Miss): Autoelevador esquivó peatón distraído',
    description: 'Autoelevador eléctrico #12 circulaba a velocidad reglamentaria por el cruce del Pasillo 3. Un auxiliar de almacén cruzó la línea amarilla mientras revisaba su terminal portátil sin mirar a ambos lados.',
    location: 'Almacén Central - Cruce Bahía C',
    type: 'Casi Accidente (Near Miss)',
    severity: 'Grave',
    status: 'En Investigación',
    reporterName: 'Lucía Morales',
    reporterRole: 'Conductora de Autoelevador',
    affectedPerson: 'Julián Ramos (Auxiliar de Logística)',
    immediateAction: 'Frenado de emergencia oportuno. Se impartió charla de seguridad de 5 minutos al personal de turno.',
    rootCauseAnalysis: {
      why1: '¿Por qué casi impactan? El peatón cruzó sin verificar la aproximación de vehículos.',
      why2: '¿Por qué no verificó? Tenía la vista fija en la terminal de picking.',
      why3: '¿Por qué leía mientras caminaba? Para cumplir con la tasa horaria de preparación.',
      why4: '¿Por qué no se detuvo en el paso peatonal? La señal acústica del cruce no se activó.',
      why5: '¿Por qué no sonó? El sensor óptico de presencia del cruce estaba desalineado.',
      rootCauseSummary: 'Fallo simultáneo de sensor de cruce inteligente y conducta subestándar por distracción con equipo digital.'
    },
    correctiveActions: [
      {
        action: 'Recalibrar sensor fotoeléctrico y baliza estroboscópica del cruce Bahía C.',
        assignee: 'Técnico de Automatismos',
        dueDate: 'Hoy, 21:00',
        completed: false,
        priority: 'Urgente'
      },
      {
        action: 'Emisión de flash de seguridad sobre política de "Cero Terminales al Caminar".',
        assignee: 'Coordinador PRL',
        dueDate: '23 de Octubre',
        completed: false,
        priority: 'Media'
      }
    ]
  },
  {
    id: 'inc-003',
    code: 'INC-2026-040',
    timestamp: new Date(Date.now() - 1000 * 60 * 320).toISOString(), // 5 hrs ago
    timeFormatted: 'Hace 5 horas',
    title: 'Omisión de bloqueo y etiquetado (LOTO) en cinta de embalaje',
    description: 'Técnico contratista accedió al interior de la tolva de alimentación para destrabar una caja sin colocar candado personal en el interruptor seccionador de energía.',
    location: 'Línea de Envasado y Paletizado 2',
    type: 'Acto Inseguro',
    severity: 'Crítico',
    status: 'Abierto',
    reporterName: 'Ing. Rodrigo Salinas',
    reporterRole: 'Supervisor de Turno',
    immediateAction: 'Detención inmediata del trabajo, retiro del contratista de la línea y reunión obligatoria de seguridad.',
    photoUrl: '/src/assets/images/prl_inspection_machinery_1792634598416.jpg',
    rootCauseAnalysis: {
      why1: '¿Por qué intervino sin LOTO? Consideró que era una tarea de menos de 30 segundos.',
      why2: '¿Por qué asumió eso? Familiaridad excesiva con el mecanismo y prisa por restablecer flujo.',
      why3: '¿Por qué no tenía el kit de candados a mano? Lo dejó en el vehículo exterior.',
      why4: '¿Por qué el supervisor de la contrata no supervisó? Estaba atendiendo otra línea simultánea.',
      why5: '¿Por qué no hay interlock de seguridad en la puerta? El microinterruptor fue puenteado temporalmente.',
      rootCauseSummary: 'Puenteo irregular de seguridad en guarda móvil y tolerancia al riesgo en tareas cortas de mantenimiento.'
    },
    correctiveActions: [
      {
        action: 'Restablecer e inspeccionar el microinterruptor de seguridad categoría 4 de la tolva.',
        assignee: 'Jefe de Mantenimiento Eléctrico',
        dueDate: 'Hoy, 22:00',
        completed: false,
        priority: 'Urgente'
      },
      {
        action: 'Apertura de no conformidad formal a la empresa contratista colaboradora.',
        assignee: 'Depto. de Prevención de Riesgos',
        dueDate: 'Mañana, 10:00',
        completed: false,
        priority: 'Alta'
      }
    ]
  },
  {
    id: 'inc-004',
    code: 'INC-2026-039',
    timestamp: new Date(Date.now() - 1000 * 60 * 1440 * 2).toISOString(), // 2 days ago
    timeFormatted: 'Hace 2 días',
    title: 'Corte superficial en mano izquierda durante despaletizado',
    description: 'Trabajador sufrió laceración leve de 2 cm al cortar fleje plástico con cúter estándar sin hoja autoretráctil. No requirió sutura.',
    location: 'Patio de Recepción de Materias Primas',
    type: 'Accidente sin Baja (FAC/MTC)',
    severity: 'Leve',
    status: 'Cerrado',
    reporterName: 'Enfermería de Planta',
    reporterRole: 'Servicio Médico',
    affectedPerson: 'Marcos Arancibia',
    immediateAction: 'Curación aséptica en enfermería, vendaje protector y entrega inmediata de cúter de seguridad certificado.',
    rootCauseAnalysis: {
      why1: '¿Por qué se cortó? Se zafó la cuchilla durante el corte con fuerza hacia el cuerpo.',
      why2: '¿Por qué usó cúter no autorizado? El cúter de seguridad asignado se había extraviado.',
      why3: '¿Por qué no solicitó reemplazo? El pañol de seguridad estaba cerrado en el turno noche.',
      why4: '¿Por qué no se proveen cúteres en dispensador automático? Aún no se ha instalado en el patio.',
      why5: '¿Por qué? Retraso en aprobación presupuestaria de dispensadores EPP 24/7.',
      rootCauseSummary: 'Uso de herramienta cortante no homologada por falta de disponibilidad inmediata en turno nocturno.'
    },
    correctiveActions: [
      {
        action: 'Retirar todo cúter manual tradicional de los puestos de recepción.',
        assignee: 'Supervisor de Logística',
        dueDate: 'Realizado',
        completed: true,
        priority: 'Alta'
      },
      {
        action: 'Instalar dispensador automático de cúteres de seguridad con hoja oculta.',
        assignee: 'Jefatura de PRL',
        dueDate: '30 de Octubre',
        completed: true,
        priority: 'Media'
      }
    ]
  }
];

export const INITIAL_RISKS: RiskItem[] = [
  {
    id: 'risk-001',
    area: 'Línea de Prensado y Estampado',
    task: 'Operación de troquelado y cambio de matrices',
    hazard: 'Partes mecánicas móviles y presión de 200 toneladas',
    riskDescription: 'Atrapamiento, aplastamiento o amputación de miembros superiores',
    probability: 2,
    severity: 5,
    riskScore: 10,
    riskLevel: 'Importante',
    controlHierarchy: 'Control de Ingeniería',
    controlMeasure: 'Cortinas optoelectrónicas de seguridad tipo 4 con parada instantánea y mando bimanual.',
    responsiblePerson: 'Ing. M. Valenzuela'
  },
  {
    id: 'risk-002',
    area: 'Almacén de Químicos y Solventes',
    task: 'Trasvase de solventes inflamables (Tolueno/Acetona)',
    hazard: 'Generación de electricidad estática y vapores volátiles',
    riskDescription: 'Atmósferas explosivas (ATEX), deflagración, intoxicación por vapores',
    probability: 2,
    severity: 5,
    riskScore: 10,
    riskLevel: 'Importante',
    controlHierarchy: 'Control de Ingeniería',
    controlMeasure: 'Pinzas de puesta a tierra equipotencial con sensor de continuidad y ventilación forzada.',
    responsiblePerson: 'Quím. D. Herrera'
  },
  {
    id: 'risk-003',
    area: 'Techumbre y Mantenimiento de Silos',
    task: 'Inspección de filtros de mangas en altura (>8m)',
    hazard: 'Superficie elevada, bordes desprotegidos y tragaluces frágiles',
    riskDescription: 'Caída de distinto nivel con riesgo de politraumatismo o fatalidad',
    probability: 3,
    severity: 5,
    riskScore: 15,
    riskLevel: 'Intolerable',
    controlHierarchy: 'Control de Ingeniería',
    controlMeasure: 'Líneas de vida rígidas horizontales EN 795 Clase D, arnés anticaídas con absorbedor y permiso de trabajo PTAR obligatorio.',
    responsiblePerson: 'Coordinador Alturas PRL'
  },
  {
    id: 'risk-004',
    area: 'Taller de Soldadura y Calderería',
    task: 'Soldadura TIG/MIG en estructuras de acero inoxidable',
    hazard: 'Radiación ultravioleta no ionizante y humos metálicos',
    riskDescription: 'Conjuntivitis actínica, quemaduras cutáneas y neumoconiosis/fiebre de humos',
    probability: 3,
    severity: 3,
    riskScore: 9,
    riskLevel: 'Moderado',
    controlHierarchy: 'Equipos de Protección Personal (EPP)',
    controlMeasure: 'Brazos de extracción localizada en origen, pantallas fotosensibles DIN 9-13 y respirador con filtros P3.',
    responsiblePerson: 'Supervisor de Taller'
  },
  {
    id: 'risk-005',
    area: 'Patio de Carga y Maniobra',
    task: 'Circulación simultánea de camiones pesados y autoelevadores',
    hazard: 'Puntos ciegos, tráfico mixto y marcha atrás sin visibilidad completa',
    riskDescription: 'Atropello, colisión vehicular o vuelco de carga',
    probability: 3,
    severity: 4,
    riskScore: 12,
    riskLevel: 'Importante',
    controlHierarchy: 'Control Administrativo',
    controlMeasure: 'Segregación física de pasillos peatonales mediante barreras de impacto, espejos parabólicos convexos y balizas acústicas.',
    responsiblePerson: 'Jefe de Tráfico'
  },
  {
    id: 'risk-006',
    area: 'Línea de Ensacado Manual',
    task: 'Paletizado de sacos de 25 kg a ritmo continuo',
    hazard: 'Manipulación manual de cargas con flexión y rotación de tronco',
    riskDescription: 'Trastornos musculoesqueléticos (TME) crónicos y lumbalgia aguda',
    probability: 4,
    severity: 2,
    riskScore: 8,
    riskLevel: 'Moderado',
    controlHierarchy: 'Sustitución',
    controlMeasure: 'Implantación programada de manipulador neumático por vacío y rotación de tareas cada 90 minutos.',
    responsiblePerson: 'Ergónomo de Planta'
  }
];

export const INITIAL_CHECKLISTS: InspectionChecklist[] = [
  {
    id: 'chk-01',
    title: 'Inspección de Bloqueo y Etiquetado (LOTO)',
    type: 'Seguridad Operativa',
    location: 'Sector de Mantenimiento General',
    inspector: 'Sarah Jenkins (OH&S Supervisor)',
    date: 'Hoy, 08:30 AM',
    items: [
      { id: 'c1', category: 'LOTO', label: 'Cada técnico utiliza candado personal con llave única intransferible', status: 'passed' },
      { id: 'c2', category: 'LOTO', label: 'Tarjetas de advertencia contienen foto, nombre, teléfono y motivo de intervención', status: 'passed' },
      { id: 'c3', category: 'LOTO', label: 'Disipación de energía residual (hidráulica, neumática y capacitiva) comprobada antes de intervenir', status: 'failed', observations: 'Falta manómetro calibrado de purga en compresor B' },
      { id: 'c4', category: 'LOTO', label: 'Prueba de arranque en falso (Verificación de Cero Energía) efectuada con éxito', status: 'passed' },
      { id: 'c5', category: 'LOTO', label: 'Cajas de bloqueo grupal disponibles para intervenciones simultáneas de más de 2 operarios', status: 'passed' }
    ]
  },
  {
    id: 'chk-02',
    title: 'Auditoría de Equipos de Protección Personal (EPP)',
    type: 'Cumplimiento Normativo',
    location: 'Planta de Fundición y Moldes',
    inspector: 'Carlos Mendonza',
    date: 'Hoy, 09:15 AM',
    items: [
      { id: 'e1', category: 'EPP', label: 'Calzado de seguridad con puntera composite y plantilla antiperforación en uso', status: 'passed' },
      { id: 'e2', category: 'EPP', label: 'Cascos de seguridad dentro del período de caducidad (menos de 3 años de uso)', status: 'passed' },
      { id: 'e3', category: 'EPP', label: 'Gafas de seguridad antiempañamiento sin ralladuras obstructivas', status: 'passed' },
      { id: 'e4', category: 'EPP', label: 'Protección auditiva adecuada al nivel de decibelios (>85 dBA)', status: 'passed' },
      { id: 'e5', category: 'EPP', label: 'Guantes de protección mecánica/química compatibles con la ficha de seguridad (FDS)', status: 'pending' }
    ]
  },
  {
    id: 'chk-03',
    title: 'Ronda de Extintores y Medios de Emergencia',
    type: 'Protección Contra Incendios',
    location: 'Todas las Naves (Perímetro Exterior e Interior)',
    inspector: 'Brigada de Emergencia',
    date: 'Esta Semana',
    items: [
      { id: 'f1', category: 'PCI', label: 'Extintores señalizados a altura reglamentaria con número correlativo', status: 'passed' },
      { id: 'f2', category: 'PCI', label: 'Manómetros de presión en zona verde operativa', status: 'passed' },
      { id: 'f3', category: 'PCI', label: 'Paso libre de 1 metro frente a extintores y mangueras BIE (sin cajas ni palets obstaculizando)', status: 'failed', observations: 'Palet vacío bloqueando BIE #03 en Almacén' },
      { id: 'f4', category: 'PCI', label: 'Luces de emergencia autónomas operativas en todas las vías de evacuación', status: 'passed' },
      { id: 'f5', category: 'PCI', label: 'Pulsadores de alarma de evacuación accesibles y sin precinto roto', status: 'passed' }
    ]
  }
];

export const INITIAL_EMERGENCY: EmergencyState = {
  active: false,
  type: 'Evacuación General',
  location: 'Planta Principal',
  triggeredAt: '',
  message: '',
  accountedWorkers: 142,
  totalWorkers: 150,
  assemblyPoint: 'Punto de Encuentro 1 (Zona Norte - Estacionamiento)'
};
