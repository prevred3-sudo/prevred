import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { Incident, EmergencyState, SafetyTalk, WorkerNotification } from '../types';
import { auth, db, handleFirestoreError, OperationType } from '../utils/firebaseAuth';

const INCIDENTS_COLLECTION = 'incidents';
const SAFETY_TALKS_COLLECTION = 'safety_talks';
const WORKER_NOTIFICATIONS_COLLECTION = 'worker_notifications';
const EMERGENCIES_COLLECTION = 'emergencies';
const CURRENT_EMERGENCY_DOC_ID = 'current';

function sanitizeId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned || `inc_${Date.now()}`;
}

function buildFirestoreIncidentPayload(incident: Incident, reporterUid: string, isCreate: boolean) {
  const safeId = sanitizeId(incident.id);

  // Enforce strict schema & size constraints matching firestore.rules
  const payload: Record<string, unknown> = {
    id: safeId,
    code: String(incident.code || 'INC-000').slice(0, 40),
    timestamp: String(incident.timestamp || new Date().toISOString()).slice(0, 64),
    timeFormatted: String(incident.timeFormatted || 'Ahora').slice(0, 100),
    title: String(incident.title || 'Hallazgo sin título').slice(0, 300),
    description: String(incident.description || '').slice(0, 2000),
    location: String(incident.location || 'Planta Principal').slice(0, 300),
    type: incident.type,
    severity: incident.severity,
    status: incident.status,
    reporterName: String(incident.reporterName || 'Operador').slice(0, 120),
    reporterRole: String(incident.reporterRole || 'Terreno').slice(0, 120),
    reporterUid,
    immediateAction: String(incident.immediateAction || '').slice(0, 1000),
    correctiveActions: (incident.correctiveActions || []).slice(0, 25),
    updatedAt: serverTimestamp()
  };

  if (isCreate) {
    payload.createdAt = serverTimestamp();
  }

  if (incident.affectedPerson && incident.affectedPerson.trim()) {
    payload.affectedPerson = incident.affectedPerson.trim().slice(0, 120);
  }

  // Keep photoUrl well below Firestore's 1MB document limit (max 680KB string)
  if (incident.photoUrl && incident.photoUrl.length <= 680000) {
    payload.photoUrl = incident.photoUrl;
  }

  if (incident.rootCauseAnalysis) {
    payload.rootCauseAnalysis = {
      why1: String(incident.rootCauseAnalysis.why1 || ''),
      why2: String(incident.rootCauseAnalysis.why2 || ''),
      why3: String(incident.rootCauseAnalysis.why3 || ''),
      why4: String(incident.rootCauseAnalysis.why4 || ''),
      why5: String(incident.rootCauseAnalysis.why5 || ''),
      rootCauseSummary: String(incident.rootCauseAnalysis.rootCauseSummary || '')
    };
  }

  return { safeId, payload };
}

export async function saveIncidentToFirestore(incident: Incident): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return false;
  }

  const safeId = sanitizeId(incident.id);
  const path = `${INCIDENTS_COLLECTION}/${safeId}`;
  const docRef = doc(db, INCIDENTS_COLLECTION, safeId);

  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      return true;
    }

    const { payload } = buildFirestoreIncidentPayload(incident, user.uid, true);
    await setDoc(docRef, payload);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateIncidentInFirestore(incident: Incident): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return false;
  }

  const safeId = sanitizeId(incident.id);
  const path = `${INCIDENTS_COLLECTION}/${safeId}`;
  const docRef = doc(db, INCIDENTS_COLLECTION, safeId);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return false;
    }
    const existingData = snap.data();
    const { payload } = buildFirestoreIncidentPayload(
      incident,
      existingData.reporterUid || user.uid,
      false
    );
    payload.createdAt = existingData.createdAt;
    await updateDoc(docRef, payload);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteIncidentFromFirestore(id: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return false;
  }

  const safeId = sanitizeId(id);
  const path = `${INCIDENTS_COLLECTION}/${safeId}`;
  try {
    await deleteDoc(doc(db, INCIDENTS_COLLECTION, safeId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeIncidentsFromFirestore(
  onUpdate: (incidents: Incident[]) => void,
  onError?: (err: Error) => void,
  onRemoved?: (removedIds: string[]) => void
): () => void {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return () => {};
  }

  const isAdmin = user.email === 'prevred3@gmail.com';
  const q = isAdmin
    ? query(collection(db, INCIDENTS_COLLECTION), orderBy('timestamp', 'desc'))
    : query(
        collection(db, INCIDENTS_COLLECTION),
        where('reporterUid', '==', user.uid)
      );

  return onSnapshot(
    q,
    (snapshot) => {
      if (onRemoved) {
        const removedIds = snapshot
          .docChanges()
          .filter((change) => change.type === 'removed')
          .map((change) => change.doc.id);
        if (removedIds.length > 0) {
          onRemoved(removedIds);
        }
      }

      const list: Incident[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: data.id || d.id,
            code: data.code,
            timestamp: data.timestamp,
            timeFormatted: data.timeFormatted,
            title: data.title,
            description: data.description,
            location: data.location,
            type: data.type,
            severity: data.severity,
            status: data.status,
            reporterName: data.reporterName,
            reporterRole: data.reporterRole,
            affectedPerson: data.affectedPerson,
            immediateAction: data.immediateAction,
            photoUrl: data.photoUrl,
            rootCauseAnalysis: data.rootCauseAnalysis,
            correctiveActions: Array.isArray(data.correctiveActions) ? data.correctiveActions : []
          } as Incident;
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, INCIDENTS_COLLECTION);
      } catch (wrappedErr) {
        if (onError && wrappedErr instanceof Error) {
          onError(wrappedErr);
        }
      }
    }
  );
}

export async function saveEmergencyToFirestore(emergency: Partial<EmergencyState>): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return false;
  }

  const path = `${EMERGENCIES_COLLECTION}/${CURRENT_EMERGENCY_DOC_ID}`;
  const docRef = doc(db, EMERGENCIES_COLLECTION, CURRENT_EMERGENCY_DOC_ID);
  try {
    await setDoc(
      docRef,
      {
        active: Boolean(emergency.active),
        type: String(emergency.type || 'Evacuación General').slice(0, 80),
        location: String(emergency.location || 'Planta Principal').slice(0, 300),
        triggeredAt: String(emergency.triggeredAt || new Date().toISOString()).slice(0, 64),
        message: String(emergency.message || '').slice(0, 1000),
        triggeredByUid: user.uid,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeEmergencyFromFirestore(
  onUpdate: (emergency: EmergencyState | null) => void
): () => void {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return () => {};
  }

  const path = `${EMERGENCIES_COLLECTION}/${CURRENT_EMERGENCY_DOC_ID}`;
  return onSnapshot(
    doc(db, EMERGENCIES_COLLECTION, CURRENT_EMERGENCY_DOC_ID),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(snap.data() as EmergencyState);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {
        // Logged by handleFirestoreError
      }
    }
  );
}

function buildFirestoreSafetyTalkPayload(talk: SafetyTalk, reporterUid: string, isCreate: boolean) {
  const safeId = sanitizeId(talk.id);

  const attendeeNames = (Array.isArray(talk.attendeeNames) ? talk.attendeeNames : [])
    .map((n) => String(n || '').trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 50);

  const payload: Record<string, unknown> = {
    id: safeId,
    code: String(talk.code || 'CHARLA-000').slice(0, 40),
    timestamp: String(talk.timestamp || new Date().toISOString()).slice(0, 64),
    dateFormatted: String(talk.dateFormatted || 'Ahora').slice(0, 100),
    topic: String(talk.topic || 'Charla de Seguridad').slice(0, 300),
    talkType: talk.talkType || 'Charla 5 Minutos',
    location: String(talk.location || 'Planta Principal').slice(0, 300),
    instructorName: String(talk.instructorName || 'Operador Terreno').slice(0, 120),
    attendeesCount: Math.max(1, Math.min(200, Math.round(Number(talk.attendeesCount) || 1))),
    attendeeNames,
    notes: String(talk.notes || '').slice(0, 1500),
    status: isCreate ? 'Enviada' : talk.status || 'Enviada',
    reporterUid,
    updatedAt: serverTimestamp()
  };

  if (isCreate) {
    payload.createdAt = serverTimestamp();
  }

  if (talk.signatureDataUrl && talk.signatureDataUrl.length <= 290000) {
    payload.signatureDataUrl = talk.signatureDataUrl;
  }

  if (talk.photoUrl && talk.photoUrl.length <= 490000) {
    payload.photoUrl = talk.photoUrl;
  }

  return { safeId, payload };
}

export async function saveSafetyTalkToFirestore(talk: SafetyTalk): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return false;
  }

  const safeId = sanitizeId(talk.id);
  const path = `${SAFETY_TALKS_COLLECTION}/${safeId}`;
  const docRef = doc(db, SAFETY_TALKS_COLLECTION, safeId);

  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      return true;
    }

    const { payload } = buildFirestoreSafetyTalkPayload(talk, user.uid, true);
    await setDoc(docRef, payload);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateSafetyTalkInFirestore(talk: SafetyTalk): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return false;
  }

  const safeId = sanitizeId(talk.id);
  const path = `${SAFETY_TALKS_COLLECTION}/${safeId}`;
  const docRef = doc(db, SAFETY_TALKS_COLLECTION, safeId);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return false;
    }
    const existingData = snap.data();
    const { payload } = buildFirestoreSafetyTalkPayload(
      talk,
      existingData.reporterUid || user.uid,
      false
    );
    payload.createdAt = existingData.createdAt;
    await updateDoc(docRef, payload);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteSafetyTalkFromFirestore(id: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return false;
  }

  const safeId = sanitizeId(id);
  const path = `${SAFETY_TALKS_COLLECTION}/${safeId}`;
  try {
    await deleteDoc(doc(db, SAFETY_TALKS_COLLECTION, safeId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeSafetyTalksFromFirestore(
  onUpdate: (talks: SafetyTalk[]) => void,
  onError?: (err: Error) => void,
  onRemoved?: (removedIds: string[]) => void
): () => void {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return () => {};
  }

  const isAdmin = user.email === 'prevred3@gmail.com';
  const q = isAdmin
    ? query(collection(db, SAFETY_TALKS_COLLECTION), orderBy('timestamp', 'desc'))
    : query(
        collection(db, SAFETY_TALKS_COLLECTION),
        where('reporterUid', '==', user.uid)
      );

  return onSnapshot(
    q,
    (snapshot) => {
      if (onRemoved) {
        const removedIds = snapshot
          .docChanges()
          .filter((change) => change.type === 'removed')
          .map((change) => change.doc.id);
        if (removedIds.length > 0) {
          onRemoved(removedIds);
        }
      }

      const list: SafetyTalk[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: data.id || d.id,
            code: data.code,
            timestamp: data.timestamp,
            dateFormatted: data.dateFormatted,
            topic: data.topic,
            talkType: data.talkType,
            location: data.location,
            instructorName: data.instructorName,
            attendeesCount: Number(data.attendeesCount) || 1,
            attendeeNames: Array.isArray(data.attendeeNames) ? data.attendeeNames : [],
            notes: data.notes || '',
            signatureDataUrl: data.signatureDataUrl,
            photoUrl: data.photoUrl,
            status: data.status || 'Enviada'
          } as SafetyTalk;
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, SAFETY_TALKS_COLLECTION);
      } catch (wrappedErr) {
        if (onError && wrappedErr instanceof Error) {
          onError(wrappedErr);
        }
      }
    }
  );
}

function buildFirestoreNotificationPayload(
  notif: WorkerNotification,
  senderUid: string,
  isCreate: boolean
) {
  const safeId = sanitizeId(notif.id);
  const acknowledgedBy = (Array.isArray(notif.acknowledgedBy) ? notif.acknowledgedBy : [])
    .map((n) => String(n || '').trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 50);

  const payload: Record<string, unknown> = {
    id: safeId,
    code: String(notif.code || 'AVISO-000').slice(0, 40),
    timestamp: String(notif.timestamp || new Date().toISOString()).slice(0, 64),
    timeFormatted: String(notif.timeFormatted || 'Ahora').slice(0, 100),
    title: String(notif.title || 'Aviso de Seguridad PRL').slice(0, 200),
    message: String(notif.message || 'Atención en terreno').slice(0, 1500),
    priority: notif.priority || 'Informativa',
    targetZone: String(notif.targetZone || 'Todos los Sectores').slice(0, 300),
    targetWorker: String(notif.targetWorker || 'Todos').slice(0, 120),
    senderName: String(notif.senderName || 'Matriz PRL · Jefatura').slice(0, 120),
    senderUid,
    active: notif.active !== false,
    acknowledgedBy,
    updatedAt: serverTimestamp()
  };

  if (isCreate) {
    payload.createdAt = serverTimestamp();
  }

  return { safeId, payload };
}

export async function saveWorkerNotificationToFirestore(
  notif: WorkerNotification
): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return false;
  }

  const safeId = sanitizeId(notif.id);
  const path = `${WORKER_NOTIFICATIONS_COLLECTION}/${safeId}`;
  const docRef = doc(db, WORKER_NOTIFICATIONS_COLLECTION, safeId);

  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      return true;
    }

    const { payload } = buildFirestoreNotificationPayload(notif, user.uid, true);
    await setDoc(docRef, payload);
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function acknowledgeWorkerNotificationInFirestore(
  id: string,
  workerName: string
): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return false;
  }

  const safeId = sanitizeId(id);
  const path = `${WORKER_NOTIFICATIONS_COLLECTION}/${safeId}`;
  const docRef = doc(db, WORKER_NOTIFICATIONS_COLLECTION, safeId);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return false;
    }
    const existingData = snap.data();
    const currentAck: string[] = Array.isArray(existingData.acknowledgedBy)
      ? existingData.acknowledgedBy.filter((n: unknown) => typeof n === 'string')
      : [];
    const cleanWorker = String(workerName || 'Operador Terreno').trim().slice(0, 120);
    if (!cleanWorker || currentAck.includes(cleanWorker)) {
      return true;
    }

    const nextAck = [...currentAck, cleanWorker].slice(0, 50);
    await updateDoc(docRef, {
      acknowledgedBy: nextAck,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteWorkerNotificationFromFirestore(id: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return false;
  }

  const safeId = sanitizeId(id);
  const path = `${WORKER_NOTIFICATIONS_COLLECTION}/${safeId}`;
  try {
    await deleteDoc(doc(db, WORKER_NOTIFICATIONS_COLLECTION, safeId));
    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeWorkerNotificationsFromFirestore(
  onUpdate: (notifications: WorkerNotification[]) => void,
  onError?: (err: Error) => void,
  onRemoved?: (removedIds: string[]) => void
): () => void {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    return () => {};
  }

  const isAdmin = user.email === 'prevred3@gmail.com';
  const q = isAdmin
    ? query(collection(db, WORKER_NOTIFICATIONS_COLLECTION), orderBy('timestamp', 'desc'))
    : query(
        collection(db, WORKER_NOTIFICATIONS_COLLECTION),
        where('active', '==', true)
      );

  return onSnapshot(
    q,
    (snapshot) => {
      if (onRemoved) {
        const removedIds = snapshot
          .docChanges()
          .filter((change) => change.type === 'removed')
          .map((change) => change.doc.id);
        if (removedIds.length > 0) {
          onRemoved(removedIds);
        }
      }

      const list: WorkerNotification[] = snapshot.docs
        .map((d) => {
          const data = d.data();
          return {
            id: data.id || d.id,
            code: data.code,
            timestamp: data.timestamp,
            timeFormatted: data.timeFormatted,
            title: data.title,
            message: data.message,
            priority: data.priority || 'Informativa',
            targetZone: data.targetZone || 'Todos los Sectores',
            targetWorker: data.targetWorker || 'Todos',
            senderName: data.senderName || 'Matriz PRL · Jefatura',
            active: data.active !== false,
            acknowledgedBy: Array.isArray(data.acknowledgedBy) ? data.acknowledgedBy : []
          } as WorkerNotification;
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, WORKER_NOTIFICATIONS_COLLECTION);
      } catch (wrappedErr) {
        if (onError && wrappedErr instanceof Error) {
          onError(wrappedErr);
        }
      }
    }
  );
}
