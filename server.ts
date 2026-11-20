import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
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
const DELETED_FILE = path.join(DATA_DIR, 'deleted_ids.json');
const TALKS_FILE = path.join(DATA_DIR, 'talks_db.json');
const DELETED_TALKS_FILE = path.join(DATA_DIR, 'deleted_talk_ids.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications_db.json');
const DELETED_NOTIFICATIONS_FILE = path.join(DATA_DIR, 'deleted_notification_ids.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const deletedIncidentIds = new Set<string>();
try {
  if (fs.existsSync(DELETED_FILE)) {
    const parsedDeleted = JSON.parse(fs.readFileSync(DELETED_FILE, 'utf-8'));
    if (Array.isArray(parsedDeleted)) {
      parsedDeleted.forEach((id) => typeof id === 'string' && deletedIncidentIds.add(id));
    }
  }
} catch {
  // Ignore corrupted deleted file
}

const deletedTalkIds = new Set<string>();
try {
  if (fs.existsSync(DELETED_TALKS_FILE)) {
    const parsedDeletedTalks = JSON.parse(fs.readFileSync(DELETED_TALKS_FILE, 'utf-8'));
    if (Array.isArray(parsedDeletedTalks)) {
      parsedDeletedTalks.forEach((id) => typeof id === 'string' && deletedTalkIds.add(id));
    }
  }
} catch {
  // Ignore corrupted deleted talks file
}

let inMemoryIncidents: any[] = [];
try {
  if (fs.existsSync(DB_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    inMemoryIncidents = Array.isArray(parsed)
      ? parsed.filter((i) => i && !deletedIncidentIds.has(i.id))
      : [...INITIAL_SEED_INCIDENTS];
  } else {
    inMemoryIncidents = INITIAL_SEED_INCIDENTS.filter((i) => !deletedIncidentIds.has(i.id));
    fs.writeFileSync(DB_FILE, JSON.stringify(inMemoryIncidents, null, 2));
  }
} catch {
  inMemoryIncidents = [...INITIAL_SEED_INCIDENTS];
}

let inMemoryTalks: any[] = [];
try {
  if (fs.existsSync(TALKS_FILE)) {
    const parsedTalks = JSON.parse(fs.readFileSync(TALKS_FILE, 'utf-8'));
    inMemoryTalks = Array.isArray(parsedTalks)
      ? parsedTalks.filter((t) => t && !deletedTalkIds.has(t.id))
      : [];
  } else {
    fs.writeFileSync(TALKS_FILE, JSON.stringify([], null, 2));
  }
} catch {
  inMemoryTalks = [];
}

const deletedNotificationIds = new Set<string>();
try {
  if (fs.existsSync(DELETED_NOTIFICATIONS_FILE)) {
    const parsedDeletedNotifs = JSON.parse(fs.readFileSync(DELETED_NOTIFICATIONS_FILE, 'utf-8'));
    if (Array.isArray(parsedDeletedNotifs)) {
      parsedDeletedNotifs.forEach((id) => typeof id === 'string' && deletedNotificationIds.add(id));
    }
  }
} catch {
  // Ignore corrupted deleted notifications file
}

let inMemoryNotifications: any[] = [];
try {
  if (fs.existsSync(NOTIFICATIONS_FILE)) {
    const parsedNotifs = JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8'));
    inMemoryNotifications = Array.isArray(parsedNotifs)
      ? parsedNotifs.filter((n) => n && !deletedNotificationIds.has(n.id))
      : [];
  } else {
    fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify([], null, 2));
  }
} catch {
  inMemoryNotifications = [];
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
    fs.writeFileSync(DELETED_FILE, JSON.stringify(Array.from(deletedIncidentIds), null, 2));
    fs.writeFileSync(TALKS_FILE, JSON.stringify(inMemoryTalks, null, 2));
    fs.writeFileSync(DELETED_TALKS_FILE, JSON.stringify(Array.from(deletedTalkIds), null, 2));
    fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(inMemoryNotifications, null, 2));
    fs.writeFileSync(DELETED_NOTIFICATIONS_FILE, JSON.stringify(Array.from(deletedNotificationIds), null, 2));
  } catch (err) {
    console.error('Error saving DB to disk:', err);
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  // Dedicated WebSocket server on /ws so it never collides with Vite HMR
  const wss = new WebSocketServer({ server, path: '/ws' });

  const broadcastEvent = (type: string, payload: unknown) => {
    const msg = JSON.stringify({ type, payload, serverTime: Date.now() });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  };

  wss.on('connection', (ws) => {
    // Send authoritative state immediately on connect
    ws.send(
      JSON.stringify({
        type: 'init',
        payload: {
          incidents: inMemoryIncidents,
          safetyTalks: inMemoryTalks,
          workerNotifications: inMemoryNotifications,
          emergency: inMemoryEmergency
        },
        serverTime: Date.now()
      })
    );
  });

  // CORS middleware for API endpoints
  app.use('/api', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Support large base64 photos taken from mobile cameras (up to 25MB)
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // API Routes
  // 1. Get all incidents
  app.get('/api/incidents', (req, res) => {
    res.json({ success: true, data: inMemoryIncidents });
  });

  // 2. Create new incident (idempotent by id - called by Satellite Mobile App or Matrix)
  app.post('/api/incidents', (req, res) => {
    const newInc = req.body;
    if (!newInc || !newInc.title) {
      return res.status(400).json({ success: false, error: 'Título requerido' });
    }

    const incidentId = newInc.id || `inc-${Date.now()}`;
    if (deletedIncidentIds.has(incidentId)) {
      deletedIncidentIds.delete(incidentId);
    }

    const existingIdx = inMemoryIncidents.findIndex((i) => i.id === incidentId);
    if (existingIdx !== -1) {
      return res.status(200).json({ success: true, data: inMemoryIncidents[existingIdx], deduplicated: true });
    }

    const incidentToSave = {
      ...newInc,
      id: incidentId,
      timestamp: newInc.timestamp || new Date().toISOString()
    };

    inMemoryIncidents = [incidentToSave, ...inMemoryIncidents];
    persistDb();
    broadcastEvent('incident:created', incidentToSave);

    console.log(`[PRL Realtime] Nuevo incidente recibido desde ${incidentToSave.reporterRole || 'Terreno'}: ${incidentToSave.code} - ${incidentToSave.title}`);
    res.status(201).json({ success: true, data: incidentToSave });
  });

  // 2b. Batch merge incidents (used by Google Drive / IndexedDB sync)
  app.post('/api/incidents/batch', (req, res) => {
    const incomingList = Array.isArray(req.body?.incidents) ? req.body.incidents : [];
    let addedCount = 0;

    for (const item of incomingList) {
      if (!item || !item.id || !item.title) continue;
      if (deletedIncidentIds.has(item.id)) continue;
      if (!inMemoryIncidents.some((existing) => existing.id === item.id || (item.code && existing.code === item.code))) {
        inMemoryIncidents.unshift(item);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      inMemoryIncidents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      persistDb();
      broadcastEvent('incidents:synced', inMemoryIncidents);
    }

    res.json({ success: true, addedCount, data: inMemoryIncidents });
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
    broadcastEvent('incident:updated', inMemoryIncidents[idx]);
    res.json({ success: true, data: inMemoryIncidents[idx] });
  });

  // 3b. Delete incident or finding (idempotent with tombstone persistence)
  app.delete('/api/incidents/:id', (req, res) => {
    const { id } = req.params;
    const existing = inMemoryIncidents.find((i) => i.id === id);

    deletedIncidentIds.add(id);
    inMemoryIncidents = inMemoryIncidents.filter((i) => i.id !== id);
    persistDb();
    broadcastEvent('incident:deleted', { id });

    if (existing) {
      console.log(`[PRL Realtime] Incidente/Hallazgo eliminado: ${id} (${existing.code} - ${existing.title})`);
    }
    res.json({ success: true, message: 'Incidente eliminado exitosamente', id });
  });

  // 3c. Signed Safety Talks (Charlas Firmadas)
  app.get('/api/talks', (req, res) => {
    res.json({ success: true, data: inMemoryTalks });
  });

  app.post('/api/talks', (req, res) => {
    const newTalk = req.body;
    if (!newTalk || !newTalk.topic) {
      return res.status(400).json({ success: false, error: 'Tema de charla requerido' });
    }

    const talkId = newTalk.id || `talk-${Date.now()}`;
    if (deletedTalkIds.has(talkId)) {
      deletedTalkIds.delete(talkId);
    }

    const existingIdx = inMemoryTalks.findIndex((t) => t.id === talkId);
    if (existingIdx !== -1) {
      return res.status(200).json({ success: true, data: inMemoryTalks[existingIdx], deduplicated: true });
    }

    const talkToSave = {
      ...newTalk,
      id: talkId,
      timestamp: newTalk.timestamp || new Date().toISOString()
    };

    inMemoryTalks = [talkToSave, ...inMemoryTalks];
    persistDb();
    broadcastEvent('talk:created', talkToSave);

    console.log(`[PRL Charla Firmada] Recibida desde Terreno: ${talkToSave.code} - ${talkToSave.topic}`);
    res.status(201).json({ success: true, data: talkToSave });
  });

  app.post('/api/talks/batch', (req, res) => {
    const incomingList = Array.isArray(req.body?.talks) ? req.body.talks : [];
    let addedCount = 0;

    for (const item of incomingList) {
      if (!item || !item.id || !item.topic) continue;
      if (deletedTalkIds.has(item.id)) continue;
      if (!inMemoryTalks.some((existing) => existing.id === item.id || (item.code && existing.code === item.code))) {
        inMemoryTalks.unshift(item);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      inMemoryTalks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      persistDb();
      broadcastEvent('talks:synced', inMemoryTalks);
    }

    res.json({ success: true, addedCount, data: inMemoryTalks });
  });

  app.put('/api/talks/:id', (req, res) => {
    const { id } = req.params;
    const updated = req.body;
    const idx = inMemoryTalks.findIndex((t) => t.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Charla no encontrada' });
    }

    inMemoryTalks[idx] = { ...inMemoryTalks[idx], ...updated };
    persistDb();
    broadcastEvent('talk:updated', inMemoryTalks[idx]);
    res.json({ success: true, data: inMemoryTalks[idx] });
  });

  app.delete('/api/talks/:id', (req, res) => {
    const { id } = req.params;
    deletedTalkIds.add(id);
    inMemoryTalks = inMemoryTalks.filter((t) => t.id !== id);
    persistDb();
    broadcastEvent('talk:deleted', { id });
    res.json({ success: true, message: 'Charla eliminada exitosamente', id });
  });

  // 3d. Worker Notifications (Matriz -> Satélite)
  app.get('/api/notifications', (req, res) => {
    res.json({ success: true, data: inMemoryNotifications });
  });

  app.post('/api/notifications', (req, res) => {
    const newNotif = req.body;
    if (!newNotif || !newNotif.title || !newNotif.message) {
      return res.status(400).json({ success: false, error: 'Título y mensaje requeridos' });
    }

    const notifId = newNotif.id || `notif-${Date.now()}`;
    if (deletedNotificationIds.has(notifId)) {
      deletedNotificationIds.delete(notifId);
    }

    const existingIdx = inMemoryNotifications.findIndex((n) => n.id === notifId);
    if (existingIdx !== -1) {
      return res.status(200).json({ success: true, data: inMemoryNotifications[existingIdx], deduplicated: true });
    }

    const notifToSave = {
      ...newNotif,
      id: notifId,
      timestamp: newNotif.timestamp || new Date().toISOString(),
      active: newNotif.active !== false,
      acknowledgedBy: Array.isArray(newNotif.acknowledgedBy) ? newNotif.acknowledgedBy : []
    };

    inMemoryNotifications = [notifToSave, ...inMemoryNotifications];
    persistDb();
    broadcastEvent('notification:created', notifToSave);

    console.log(`[PRL Notificación Matriz->Satélite] ${notifToSave.code} (${notifToSave.priority}): ${notifToSave.title}`);
    res.status(201).json({ success: true, data: notifToSave });
  });

  app.post('/api/notifications/batch', (req, res) => {
    const incomingList = Array.isArray(req.body?.notifications) ? req.body.notifications : [];
    let addedCount = 0;

    for (const item of incomingList) {
      if (!item || !item.id || !item.title) continue;
      if (deletedNotificationIds.has(item.id)) continue;
      if (!inMemoryNotifications.some((existing) => existing.id === item.id)) {
        inMemoryNotifications.unshift(item);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      inMemoryNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      persistDb();
      broadcastEvent('notifications:synced', inMemoryNotifications);
    }

    res.json({ success: true, addedCount, data: inMemoryNotifications });
  });

  app.post('/api/notifications/:id/ack', (req, res) => {
    const { id } = req.params;
    const workerName = String(req.body?.workerName || 'Operador Terreno').trim().slice(0, 120);
    const idx = inMemoryNotifications.findIndex((n) => n.id === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Notificación no encontrada' });
    }

    const currentAck: string[] = Array.isArray(inMemoryNotifications[idx].acknowledgedBy)
      ? inMemoryNotifications[idx].acknowledgedBy
      : [];
    if (workerName && !currentAck.includes(workerName)) {
      inMemoryNotifications[idx] = {
        ...inMemoryNotifications[idx],
        acknowledgedBy: [...currentAck, workerName].slice(0, 50)
      };
      persistDb();
      broadcastEvent('notification:updated', inMemoryNotifications[idx]);
    }

    res.json({ success: true, data: inMemoryNotifications[idx] });
  });

  app.delete('/api/notifications/:id', (req, res) => {
    const { id } = req.params;
    deletedNotificationIds.add(id);
    inMemoryNotifications = inMemoryNotifications.filter((n) => n.id !== id);
    persistDb();
    broadcastEvent('notification:deleted', { id });
    res.json({ success: true, message: 'Notificación eliminada exitosamente', id });
  });

  // 4. Emergency State
  app.get('/api/emergency', (req, res) => {
    res.json({ success: true, data: inMemoryEmergency });
  });

  app.post('/api/emergency', (req, res) => {
    const nextEmergency = req.body;
    inMemoryEmergency = { ...inMemoryEmergency, ...nextEmergency };
    broadcastEvent('emergency:updated', inMemoryEmergency);
    console.log(`[PRL Realtime] Estado de emergencia actualizado: Activo=${inMemoryEmergency.active}`);
    res.json({ success: true, data: inMemoryEmergency });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      serverTime: new Date().toISOString(),
      incidentCount: inMemoryIncidents.length,
      talksCount: inMemoryTalks.length,
      notificationsCount: inMemoryNotifications.length,
      connectedClients: wss.clients.size
    });
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

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`PrevRiesgos Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
