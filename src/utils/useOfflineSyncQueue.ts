import { useState, useEffect, useCallback } from 'react';
import { Incident } from '../types';
import {
  getPendingOfflineCount,
  getPendingOfflineIncidents,
  enqueueOfflineIncident,
  removeOfflineIncident,
  processOfflineQueue,
  OfflineQueueItem
} from './offlineSyncQueue';
import { useOnlineStatus } from './usePWAInstall';

export function useOfflineSyncQueue(onIncidentSyncedToMatrix?: (incident: Incident) => void) {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingItems, setPendingItems] = useState<OfflineQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number; timestamp: number } | null>(null);

  const refreshQueueState = useCallback(async () => {
    try {
      const count = await getPendingOfflineCount();
      setPendingCount(count);
      const items = await getPendingOfflineIncidents();
      setPendingItems(items);
    } catch {
      // Fallback
    }
  }, []);

  // Sync runner
  const triggerSync = useCallback(
    async (forceAll: boolean = false) => {
      if (!isOnline || isSyncing) return;
      setIsSyncing(true);
      try {
        const { syncedCount } = await processOfflineQueue((incident) => {
          if (onIncidentSyncedToMatrix) {
            onIncidentSyncedToMatrix(incident);
          }
        }, forceAll);

        if (syncedCount > 0) {
          setLastSyncResult({ synced: syncedCount, timestamp: Date.now() });
        }
      } catch (err) {
        console.error('Error durante sincronización offline:', err);
      } finally {
        setIsSyncing(false);
        await refreshQueueState();
      }
    },
    [isOnline, isSyncing, onIncidentSyncedToMatrix, refreshQueueState]
  );

  // Initial load
  useEffect(() => {
    refreshQueueState();
  }, [refreshQueueState]);

  // Automatic Trigger 1: Whenever connectivity is restored ('online' event)
  useEffect(() => {
    if (isOnline) {
      console.log('[AutoSync] Conexión recuperada. Procesando cola de IndexedDB...');
      triggerSync(true);
    }
  }, [isOnline, triggerSync]);

  // Automatic Trigger 2: Periodic exponential backoff scheduler when online (every 4 seconds)
  useEffect(() => {
    if (!isOnline) return;

    const timer = setInterval(() => {
      // If there are items scheduled to retry, process them
      if (pendingCount > 0) {
        triggerSync(false);
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [isOnline, pendingCount, triggerSync]);

  // Queue a new incident for offline handling
  const enqueueIncident = useCallback(
    async (incident: Incident, errorMsg?: string) => {
      await enqueueOfflineIncident(incident, errorMsg);
      await refreshQueueState();
    },
    [refreshQueueState]
  );

  // Manually remove/discard an incident from the offline queue
  const removeOfflineItem = useCallback(
    async (id: string) => {
      await removeOfflineIncident(id);
      await refreshQueueState();
    },
    [refreshQueueState]
  );

  return {
    isOnline,
    pendingCount,
    pendingItems,
    isSyncing,
    lastSyncResult,
    triggerSync,
    enqueueIncident,
    removeOfflineItem,
    refreshQueueState
  };
}
