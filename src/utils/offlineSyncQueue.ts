import { Incident } from '../types';
import { createIncidentApi } from '../services/api';

export interface OfflineQueueItem {
  id: string;
  incident: Incident;
  createdAt: number;
  retryCount: number;
  nextRetryTime: number;
  lastError?: string;
}

const DB_NAME = 'PrevRiesgos_OfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_incidents';

// Exponential backoff configuration
const BASE_DELAY_MS = 1500; // 1.5 seconds
const MAX_DELAY_MS = 60000; // 60 seconds max
const MAX_RETRIES = 10;

/**
 * Opens or initializes the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB no está disponible en este entorno'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('nextRetryTime', 'nextRetryTime', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Calculates exponential backoff delay with random jitter to prevent server congestion
 */
export function calculateBackoffDelay(retryCount: number): number {
  // delay = min(BASE * 2^retry + jitter, MAX)
  const exponential = BASE_DELAY_MS * Math.pow(2, Math.min(retryCount, 6));
  const jitter = Math.floor(Math.random() * 500); // 0-500ms random jitter
  return Math.min(exponential + jitter, MAX_DELAY_MS);
}

/**
 * Stores an incident into the IndexedDB offline queue
 */
export async function enqueueOfflineIncident(incident: Incident, initialError?: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const item: OfflineQueueItem = {
      id: incident.id,
      incident,
      createdAt: Date.now(),
      retryCount: 0,
      nextRetryTime: Date.now(), // Ready for immediate retry when network returns
      lastError: initialError
    };

    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Retrieves all pending offline incidents
 */
export async function getPendingOfflineIncidents(): Promise<OfflineQueueItem[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Removes an incident from IndexedDB after successful transmission to Matrix
 */
export async function removeOfflineIncident(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Updates retry metadata with exponential backoff timestamp
 */
export async function updateIncidentBackoff(id: string, retryCount: number, errorMsg: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item: OfflineQueueItem = getRequest.result;
      if (!item) return resolve();

      const nextDelay = calculateBackoffDelay(retryCount);
      item.retryCount = retryCount;
      item.nextRetryTime = Date.now() + nextDelay;
      item.lastError = errorMsg;

      const putRequest = store.put(item);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Counts how many items are waiting in the offline queue
 */
export async function getPendingOfflineCount(): Promise<number> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

let isSyncingQueue = false;

/**
 * Flushes all pending incidents in IndexedDB using exponential backoff retry
 */
export async function processOfflineQueue(
  onSuccessOne?: (syncedIncident: Incident) => void,
  forceAll: boolean = false
): Promise<{ syncedCount: number; remainingCount: number }> {
  if (isSyncingQueue) {
    return { syncedCount: 0, remainingCount: await getPendingOfflineCount() };
  }

  // Check if browser is online
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { syncedCount: 0, remainingCount: await getPendingOfflineCount() };
  }

  isSyncingQueue = true;
  let syncedCount = 0;

  try {
    const pendingItems = await getPendingOfflineIncidents();
    const now = Date.now();

    for (const item of pendingItems) {
      // Check if item is eligible for retry according to exponential backoff schedule
      if (!forceAll && item.nextRetryTime > now) {
        continue;
      }

      if (item.retryCount >= MAX_RETRIES) {
        console.warn(`[Offline Queue] Incidente ${item.incident.code} alcanzó el máximo de reintentos.`);
        continue;
      }

      try {
        const saved = await createIncidentApi(item.incident);
        if (saved && saved.id) {
          // Successfully transmitted to server! Remove from IndexedDB
          await removeOfflineIncident(item.id);
          syncedCount++;
          if (onSuccessOne) {
            onSuccessOne(saved);
          }
          console.log(`[Offline Queue] Sincronizado con éxito en Matriz: ${item.incident.code}`);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Error de red';
        const nextRetryCount = item.retryCount + 1;
        await updateIncidentBackoff(item.id, nextRetryCount, errorMsg);
        console.warn(`[Offline Queue] Reintento fallido para ${item.incident.code} (Intento #${nextRetryCount}). Próximo reintento con backoff.`);
      }
    }
  } catch (err) {
    console.error('[Offline Queue] Error general procesando cola:', err);
  } finally {
    isSyncingQueue = false;
  }

  const remainingCount = await getPendingOfflineCount();
  return { syncedCount, remainingCount };
}
