import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initial Seed Data for PRL
const INITIAL_SEED_INCIDENTS = [
  {
    id: 'inc-001',
    code: 'INC-2026-042',
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
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
    timestamp: new Date(Date.now() - 1000 * 60 * 85).toISOString(),
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
      }
    ]
  }
];

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'incidents_db.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let inMemoryIncidents: any[] = [];
try {
  if (fs.existsSync(DB_FILE)) {
    inMemoryIncidents = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } else {
    inMemoryIncidents = [...INITIAL_SEED_INCIDENTS];
    fs.writeFileSync(DB_FILE, JSON.stringify(inMemoryIncidents, null, 2));
  }
} catch {
  inMemoryIncidents = [...INITIAL_SEED_INCIDENTS];
}

let inMemoryEmergency = {
  active: false,
  type: 'Evacuación General',
  location: 'Planta Principal',
  triggeredAt: '',
  message: '',
  accountedWorkers: 142,
  totalWorkers: 150,
  assemblyPoint: 'Punto de Encuentro 1 (Zona Norte - Estacionamiento)'
};

function persistDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(inMemoryIncidents, null, 2));
  } catch (err) {
    console.error('Error saving DB to disk:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Support large base64 photos taken from mobile cameras (up to 25MB)
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // API Routes
  // 1. Get all incidents
  app.get('/api/incidents', (req, res) => {
    res.json({ success: true, data: inMemoryIncidents });
  });

  // 2. Create new incident (called by Satellite Mobile App or Matrix)
  app.post('/api/incidents', (req, res) => {
    const newInc = req.body;
    if (!newInc || !newInc.title) {
      return res.status(400).json({ success: false, error: 'Título requerido' });
    }

    // Add unique server timestamp and place at beginning of list
    const incidentToSave = {
      ...newInc,
      id: newInc.id || `inc-${Date.now()}`,
      timestamp: newInc.timestamp || new Date().toISOString()
    };

    inMemoryIncidents = [incidentToSave, ...inMemoryIncidents];
    persistDb();

    console.log(`[PRL Realtime] Nuevo incidente recibido desde ${incidentToSave.reporterRole || 'Terreno'}: ${incidentToSave.code} - ${incidentToSave.title}`);
    res.status(201).json({ success: true, data: incidentToSave });
  });

  // 3. Update existing incident (dossier, 5 whys, CAPA actions)
  app.put('/api/incidents/:id', (req, res) => {
    const { id } = req.params;
    const updated = req.body;
    const idx = inMemoryIncidents.findIndex((i) => i.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Incidente no encontrado' });
    }

    inMemoryIncidents[idx] = { ...inMemoryIncidents[idx], ...updated };
    persistDb();
    res.json({ success: true, data: inMemoryIncidents[idx] });
  });

  // 3b. Delete incident or finding
  app.delete('/api/incidents/:id', (req, res) => {
    const { id } = req.params;
    const existing = inMemoryIncidents.find((i) => i.id === id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Incidente o hallazgo no encontrado' });
    }

    inMemoryIncidents = inMemoryIncidents.filter((i) => i.id !== id);
    persistDb();
    console.log(`[PRL Realtime] Incidente/Hallazgo eliminado: ${id} (${existing.code} - ${existing.title})`);
    res.json({ success: true, message: 'Incidente eliminado exitosamente', id });
  });

  // 4. Emergency State
  app.get('/api/emergency', (req, res) => {
    res.json({ success: true, data: inMemoryEmergency });
  });

  app.post('/api/emergency', (req, res) => {
    const nextEmergency = req.body;
    inMemoryEmergency = { ...inMemoryEmergency, ...nextEmergency };
    console.log(`[PRL Realtime] Estado de emergencia actualizado: Activo=${inMemoryEmergency.active}`);
    res.json({ success: true, data: inMemoryEmergency });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // Mount Vite in dev or serve static files in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PrevRiesgos Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
