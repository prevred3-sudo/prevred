import { Incident, EmergencyState, SafetyTalk } from '../types';

/**
 * Shared Realtime API Service connecting both Matrix and Satellite applications
 */
export async function fetchIncidentsFromServer(): Promise<{ ok: boolean; data: Incident[] }> {
  try {
    const res = await fetch('/api/incidents', { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al obtener incidentes del servidor');
    const json = await res.json();
    return { ok: true, data: Array.isArray(json.data) ? json.data : [] };
  } catch (err) {
    console.warn('Fallo de red al obtener incidentes, usando caché local:', err);
    const local = localStorage.getItem('prev_incidents');
    return { ok: false, data: local ? JSON.parse(local) : [] };
  }
}

export async function fetchIncidentsApi(): Promise<Incident[]> {
  const res = await fetchIncidentsFromServer();
  return res.data;
}

export async function createIncidentApi(incident: Incident): Promise<Incident> {
  const res = await fetch('/api/incidents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(incident)
  });

  if (!res.ok) {
    throw new Error(`Error en servidor (${res.status})`);
  }

  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error('Respuesta inválida del servidor');
  }
  return json.data;
}

export async function syncBatchIncidentsApi(incidents: Incident[]): Promise<Incident[]> {
  const res = await fetch('/api/incidents/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ incidents })
  });

  if (!res.ok) {
    throw new Error(`Error al sincronizar lote (${res.status})`);
  }

  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

export async function updateIncidentApi(incident: Incident): Promise<Incident> {
  try {
    const res = await fetch(`/api/incidents/${incident.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(incident)
    });

    if (!res.ok) throw new Error('Error al actualizar incidente en servidor');
    const json = await res.json();
    return json.data;
  } catch (err) {
    console.warn('Fallo al actualizar incidente en servidor:', err);
    return incident;
  }
}

export async function deleteIncidentApi(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/incidents/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error al eliminar incidente en servidor');
    const json = await res.json();
    return json.success === true;
  } catch (err) {
    console.warn('Fallo al eliminar incidente en servidor:', err);
    return false;
  }
}

export async function fetchEmergencyApi(): Promise<EmergencyState | null> {
  try {
    const res = await fetch('/api/emergency', { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

export async function updateEmergencyApi(emergency: Partial<EmergencyState>): Promise<EmergencyState | null> {
  try {
    const res = await fetch('/api/emergency', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emergency)
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

export async function fetchTalksFromServer(): Promise<{ ok: boolean; data: SafetyTalk[] }> {
  try {
    const res = await fetch('/api/talks', { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al obtener charlas del servidor');
    const json = await res.json();
    return { ok: true, data: Array.isArray(json.data) ? json.data : [] };
  } catch {
    const local = localStorage.getItem('prev_safety_talks');
    return { ok: false, data: local ? JSON.parse(local) : [] };
  }
}

export async function createTalkApi(talk: SafetyTalk): Promise<SafetyTalk> {
  const res = await fetch('/api/talks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(talk)
  });

  if (!res.ok) {
    throw new Error(`Error en servidor (${res.status})`);
  }

  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error('Respuesta inválida del servidor');
  }
  return json.data;
}

export async function syncBatchTalksApi(talks: SafetyTalk[]): Promise<SafetyTalk[]> {
  const res = await fetch('/api/talks/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ talks })
  });

  if (!res.ok) {
    throw new Error(`Error al sincronizar lote de charlas (${res.status})`);
  }

  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

export async function updateTalkApi(talk: SafetyTalk): Promise<SafetyTalk> {
  try {
    const res = await fetch(`/api/talks/${talk.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(talk)
    });

    if (!res.ok) throw new Error('Error al actualizar charla en servidor');
    const json = await res.json();
    return json.data;
  } catch {
    return talk;
  }
}

export async function deleteTalkApi(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/talks/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error al eliminar charla en servidor');
    const json = await res.json();
    return json.success === true;
  } catch {
    return false;
  }
}

export async function fetchNotificationsFromServer(): Promise<{ ok: boolean; data: import('../types').WorkerNotification[] }> {
  try {
    const res = await fetch('/api/notifications', { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al obtener notificaciones del servidor');
    const json = await res.json();
    return { ok: true, data: Array.isArray(json.data) ? json.data : [] };
  } catch {
    const local = localStorage.getItem('prev_worker_notifications');
    return { ok: false, data: local ? JSON.parse(local) : [] };
  }
}

export async function createNotificationApi(
  notification: import('../types').WorkerNotification
): Promise<import('../types').WorkerNotification> {
  const res = await fetch('/api/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(notification)
  });

  if (!res.ok) {
    throw new Error(`Error en servidor (${res.status})`);
  }

  const json = await res.json();
  if (!json.success || !json.data) {
    throw new Error('Respuesta inválida del servidor');
  }
  return json.data;
}

export async function syncBatchNotificationsApi(
  notifications: import('../types').WorkerNotification[]
): Promise<import('../types').WorkerNotification[]> {
  const res = await fetch('/api/notifications/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ notifications })
  });

  if (!res.ok) {
    throw new Error(`Error al sincronizar lote de notificaciones (${res.status})`);
  }

  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

export async function acknowledgeNotificationApi(
  id: string,
  workerName: string
): Promise<import('../types').WorkerNotification | null> {
  try {
    const res = await fetch(`/api/notifications/${id}/ack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ workerName })
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

export async function deleteNotificationApi(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/notifications/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Error al eliminar notificación en servidor');
    const json = await res.json();
    return json.success === true;
  } catch {
    return false;
  }
}
