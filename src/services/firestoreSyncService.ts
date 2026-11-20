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
import { Incident, EmergencyState } from '../types';
import { auth, db, handleFirestoreError, OperationType } from '../utils/firebaseAuth';

const INCIDENTS_COLLECTION = 'incidents';
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
