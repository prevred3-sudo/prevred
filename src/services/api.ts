import { Incident, EmergencyState } from '../types';

/**
 * Shared Realtime API Service connecting both Matrix and Satellite applications
 */
export async function fetchIncidentsApi(): Promise<Incident[]> {
  try {
    const res = await fetch('/api/incidents', { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al obtener incidentes del servidor');
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.warn('Fallo de red al obtener incidentes, usando caché local:', err);
    const local = localStorage.getItem('prev_incidents');
    return local ? JSON.parse(local) : [];
  }
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

export async function updateEmergencyApi(emergency: EmergencyState): Promise<EmergencyState> {
  try {
    const res = await fetch('/api/emergency', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emergency)
    });
    if (!res.ok) return emergency;
    const json = await res.json();
    return json.data;
  } catch {
    return emergency;
  }
}
