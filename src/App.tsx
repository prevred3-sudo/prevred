import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Cloud, X } from 'lucide-react';
import { User } from 'firebase/auth';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { IncidentLiveStreamView } from './components/IncidentLiveStreamView';
import { SafetyTalksView } from './components/SafetyTalksView';
import { WorkerNotificationsView } from './components/WorkerNotificationsView';
import { SatelliteFieldApp } from './components/SatelliteFieldApp';
import { NewIncidentModal } from './components/NewIncidentModal';
import { IncidentDossierModal } from './components/IncidentDossierModal';
import { QrCodeModal } from './components/QrCodeModal';
import { GoogleDriveSyncModal } from './components/GoogleDriveSyncModal';
import { INITIAL_INCIDENTS } from './data/initialData';
import { EmergencyState, Incident, SafetyTalk, WorkerNotification } from './types';
import { safetyAudio } from './utils/audioAlert';
import {
  fetchIncidentsFromServer,
  createIncidentApi,
  syncBatchIncidentsApi,
  updateIncidentApi,
  deleteIncidentApi,
  updateEmergencyApi,
  fetchTalksFromServer,
  createTalkApi,
  syncBatchTalksApi,
  updateTalkApi,
  deleteTalkApi,
  fetchNotificationsFromServer,
  createNotificationApi,
  syncBatchNotificationsApi,
  acknowledgeNotificationApi,
  deleteNotificationApi
} from './services/api';
import {
  formatFirebaseAuthError,
  getAccessToken,
  signInWithFirebaseCloud,
  subscribeFirebaseAuthState
} from './utils/firebaseAuth';
import { fetchIncidentsFromDrive } from './services/googleDriveService';
import {
  saveIncidentToFirestore,
  updateIncidentInFirestore,
  deleteIncidentFromFirestore,
  subscribeIncidentsFromFirestore,
  saveEmergencyToFirestore,
  subscribeEmergencyFromFirestore,
  saveSafetyTalkToFirestore,
  updateSafetyTalkInFirestore,
  deleteSafetyTalkFromFirestore,
  subscribeSafetyTalksFromFirestore,
  saveWorkerNotificationToFirestore,
  acknowledgeWorkerNotificationInFirestore,
  deleteWorkerNotificationFromFirestore,
  subscribeWorkerNotificationsFromFirestore
} from './services/firestoreSyncService';

const SYNC_CHANNEL_NAME = 'prevriesgos-prl-sync';
const DELETED_IDS_KEY = 'prev_deleted_ids';
const DELETED_CODES_KEY = 'prev_deleted_codes';
const DELETED_TALK_IDS_KEY = 'prev_deleted_talk_ids';
const DELETED_NOTIFICATION_IDS_KEY = 'prev_deleted_notification_ids';

function loadStoredSet(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? new Set(parsed.filter((v) => typeof v === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function saveStoredSet(key: string, set: Set<string>) {
  try {
    const trimmed = Array.from(set).slice(-500);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota errors
  }
}

function mergeUniqueIncidents(incoming: Incident[], current: Incident[]): Incident[] {
  const map = new Map<string, Incident>();
  for (const item of incoming) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const item of current) {
    if (item && item.id && !map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

function mergeUniqueTalks(incoming: SafetyTalk[], current: SafetyTalk[]): SafetyTalk[] {
  const map = new Map<string, SafetyTalk>();
  for (const item of incoming) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const item of current) {
    if (item && item.id && !map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

function mergeUniqueNotifications(
  incoming: WorkerNotification[],
  current: WorkerNotification[]
): WorkerNotification[] {
  const map = new Map<string, WorkerNotification>();
  for (const item of incoming) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const item of current) {
    if (item && item.id && !map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export default function App() {
  // Lock strictly to Satellite mode ONLY on worker QR links (/satellite or ?locked=1)
  const [isSatelliteLocked, setIsSatelliteLocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const search = new URLSearchParams(window.location.search);
    const isSatellitePath =
      window.location.pathname === '/satellite' ||
      window.location.pathname.startsWith('/satellite/');
    const isLockedParam = search.get('locked') === '1';
    return isSatellitePath || isLockedParam;
  });

  // Application Mode: 'matrix' (Central Command & Prevention) or 'satellite' (Field Worker Mobile App)
  const [appMode, setAppMode] = useState<'matrix' | 'satellite'>(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      if (
        window.location.pathname === '/satellite' ||
        window.location.pathname.startsWith('/satellite/') ||
        search.get('locked') === '1' ||
        search.get('mode') === 'satellite'
      ) {
        return 'satellite';
      }
    }
    return 'matrix';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title =
        appMode === 'satellite'
          ? 'Satélite PRL · Reportes en Terreno'
          : 'PrevRiesgos · Matriz PRL & Control en Tiempo Real';
    }
  }, [appMode]);

  const handleSetMode = (mode: 'matrix' | 'satellite') => {
    if (mode === 'matrix') {
      setIsSatelliteLocked(false);
    }
    setAppMode(mode);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (mode === 'satellite') {
        url.searchParams.set('mode', 'satellite');
      } else {
        if (url.pathname === '/satellite') {
          url.pathname = '/';
        }
        url.searchParams.delete('mode');
        url.searchParams.delete('locked');
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Navigation tab inside Matrix
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'incidents' | 'talks' | 'notifications'>('dashboard');

  // Sound preference
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Firebase Auth user (enables Cloud Firestore cross-device real-time sync)
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isConnectingCloud, setIsConnectingCloud] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string>('');

  // Persistent tombstones for deleted incidents, talks & notifications so polling/Drive/tabs never resurrect them
  const deletedIdsRef = useRef<Set<string>>(loadStoredSet(DELETED_IDS_KEY));
  const deletedCodesRef = useRef<Set<string>>(loadStoredSet(DELETED_CODES_KEY));
  const deletedTalkIdsRef = useRef<Set<string>>(loadStoredSet(DELETED_TALK_IDS_KEY));
  const deletedNotificationIdsRef = useRef<Set<string>>(loadStoredSet(DELETED_NOTIFICATION_IDS_KEY));

  const isIncidentDeleted = useCallback((inc: { id?: string; code?: string } | null | undefined) => {
    if (!inc) return false;
    if (inc.id && deletedIdsRef.current.has(inc.id)) return true;
    if (inc.code && deletedCodesRef.current.has(inc.code)) return true;
    return false;
  }, []);

  const markIncidentDeleted = useCallback((id: string, code?: string) => {
    if (id) {
      deletedIdsRef.current.add(id);
      saveStoredSet(DELETED_IDS_KEY, deletedIdsRef.current);
    }
    if (code) {
      deletedCodesRef.current.add(code);
      saveStoredSet(DELETED_CODES_KEY, deletedCodesRef.current);
    }
  }, []);

  const isTalkDeleted = useCallback((talk: { id?: string } | null | undefined) => {
    if (!talk || !talk.id) return false;
    return deletedTalkIdsRef.current.has(talk.id);
  }, []);

  const markTalkDeleted = useCallback((id: string) => {
    if (id) {
      deletedTalkIdsRef.current.add(id);
      saveStoredSet(DELETED_TALK_IDS_KEY, deletedTalkIdsRef.current);
    }
  }, []);

  const isNotificationDeleted = useCallback((notif: { id?: string } | null | undefined) => {
    if (!notif || !notif.id) return false;
    return deletedNotificationIdsRef.current.has(notif.id);
  }, []);

  const markNotificationDeleted = useCallback((id: string) => {
    if (id) {
      deletedNotificationIdsRef.current.add(id);
      saveStoredSet(DELETED_NOTIFICATION_IDS_KEY, deletedNotificationIdsRef.current);
    }
  }, []);

  // Core Data States with localStorage persistence
  const [incidents, setIncidents] = useState<Incident[]>(() => {
    try {
      const saved = localStorage.getItem('prev_incidents');
      const base: Incident[] = saved ? JSON.parse(saved) : INITIAL_INCIDENTS;
      const dIds = loadStoredSet(DELETED_IDS_KEY);
      const dCodes = loadStoredSet(DELETED_CODES_KEY);
      return base.filter((i) => i && !dIds.has(i.id) && (!i.code || !dCodes.has(i.code)));
    } catch {
      return INITIAL_INCIDENTS;
    }
  });

  const [safetyTalks, setSafetyTalks] = useState<SafetyTalk[]>(() => {
    try {
      const saved = localStorage.getItem('prev_safety_talks');
      const base: SafetyTalk[] = saved ? JSON.parse(saved) : [];
      const dTalkIds = loadStoredSet(DELETED_TALK_IDS_KEY);
      return Array.isArray(base) ? base.filter((t) => t && t.id && !dTalkIds.has(t.id)) : [];
    } catch {
      return [];
    }
  });

  const [workerNotifications, setWorkerNotifications] = useState<WorkerNotification[]>(() => {
    try {
      const saved = localStorage.getItem('prev_worker_notifications');
      const base: WorkerNotification[] = saved ? JSON.parse(saved) : [];
      const dNotifIds = loadStoredSet(DELETED_NOTIFICATION_IDS_KEY);
      return Array.isArray(base) ? base.filter((n) => n && n.id && !dNotifIds.has(n.id)) : [];
    } catch {
      return [];
    }
  });

  const [daysWithoutLTI, setDaysWithoutLTI] = useState<number>(142);

  // Live incoming notification & SOS emergency banner on Matrix
  const [incomingBanner, setIncomingBanner] = useState<{ code: string; title: string } | null>(null);
  const [incomingTalkBanner, setIncomingTalkBanner] = useState<{ code: string; topic: string } | null>(null);
  const [activeEmergency, setActiveEmergency] = useState<EmergencyState | null>(null);

  // Modals state
  const [showReportModal, setShowReportModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [selectedIncidentForDossier, setSelectedIncidentForDossier] = useState<Incident | null>(null);

  // Field submissions tracked for satellite history
  const [mySatelliteIncidents, setMySatelliteIncidents] = useState<Incident[]>([]);
  const [mySatelliteTalks, setMySatelliteTalks] = useState<SafetyTalk[]>([]);

  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const knownIdsRef = useRef<Set<string>>(new Set(incidents.map((i) => i.id)));
  const knownTalkIdsRef = useRef<Set<string>>(new Set(safetyTalks.map((t) => t.id)));

  useEffect(() => {
    knownIdsRef.current = new Set(incidents.map((i) => i.id));
  }, [incidents]);

  useEffect(() => {
    knownTalkIdsRef.current = new Set(safetyTalks.map((t) => t.id));
  }, [safetyTalks]);

  const notifyNewIncoming = useCallback((inc: Incident) => {
    if (isIncidentDeleted(inc)) return;
    if (!knownIdsRef.current.has(inc.id)) {
      safetyAudio.playIncidentAlert(inc.severity);
      setIncomingBanner({ code: inc.code, title: inc.title });
      setTimeout(() => {
        setIncomingBanner((prev) => (prev?.code === inc.code ? null : prev));
      }, 6500);
    }
  }, [isIncidentDeleted]);

  const notifyNewIncomingTalk = useCallback((talk: SafetyTalk) => {
    if (isTalkDeleted(talk)) return;
    if (!knownTalkIdsRef.current.has(talk.id)) {
      safetyAudio.playIncidentAlert('Leve');
      setIncomingTalkBanner({ code: talk.code, topic: talk.topic });
      setTimeout(() => {
        setIncomingTalkBanner((prev) => (prev?.code === talk.code ? null : prev));
      }, 6500);
    }
  }, [isTalkDeleted]);

  const postToBroadcast = useCallback((type: string, payload: unknown) => {
    try {
      broadcastRef.current?.postMessage({ type, payload });
    } catch {
      // BroadcastChannel unavailable
    }
  }, []);

  // 0. Firebase Auth + Real-Time Cloud Firestore Listeners (works across ais-pre <-> ais-dev & 4G <-> PC!)
  useEffect(() => {
    const unsubAuth = subscribeFirebaseAuthState((user) => {
      setFirebaseUser(user);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;

    // Auto-flush any reports or talks created on this phone prior to cloud login (excluding deleted ones)
    const localFieldReports = incidents.filter(
      (i) => (i.id.startsWith('field-') || i.id.startsWith('sos-')) && !isIncidentDeleted(i)
    );
    if (localFieldReports.length > 0) {
      Promise.allSettled(
        localFieldReports.map((inc) => saveIncidentToFirestore(inc))
      ).catch(() => {});
    }

    const localFieldTalks = safetyTalks.filter((t) => !isTalkDeleted(t));
    if (localFieldTalks.length > 0) {
      Promise.allSettled(
        localFieldTalks.map((talk) => saveSafetyTalkToFirestore(talk))
      ).catch(() => {});
    }

    const unsubIncidents = subscribeIncidentsFromFirestore(
      (cloudIncidents) => {
        const activeCloud = cloudIncidents.filter((c) => !isIncidentDeleted(c));
        const deletedStillInCloud = cloudIncidents.filter((c) => isIncidentDeleted(c));
        if (deletedStillInCloud.length > 0) {
          Promise.allSettled(
            deletedStillInCloud.map((c) => deleteIncidentFromFirestore(c.id))
          ).catch(() => {});
        }

        if (activeCloud.length > 0) {
          setIncidents((current) => {
            const newItems = activeCloud.filter(
              (c) => !current.some((cur) => cur.id === c.id)
            );
            if (newItems.length > 0) {
              notifyNewIncoming(newItems[0]);
            }
            return mergeUniqueIncidents(activeCloud, current).filter(
              (i) => !isIncidentDeleted(i)
            );
          });
          // Also keep local server synced when online
          syncBatchIncidentsApi(activeCloud).catch(() => {});
        }
      },
      (err) => {
        console.warn('[Firestore Sync Error]:', err.message);
      },
      (removedIds) => {
        if (removedIds.length === 0) return;
        removedIds.forEach((rid) => {
          markIncidentDeleted(rid);
          deleteIncidentApi(rid).catch(() => {});
        });
        const removedSet = new Set(removedIds);
        setIncidents((prev) => prev.filter((i) => !removedSet.has(i.id)));
        setMySatelliteIncidents((prev) => prev.filter((i) => !removedSet.has(i.id)));
        setSelectedIncidentForDossier((prev) =>
          prev && removedSet.has(prev.id) ? null : prev
        );
      }
    );

    const unsubTalks = subscribeSafetyTalksFromFirestore(
      (cloudTalks) => {
        const activeCloud = cloudTalks.filter((t) => !isTalkDeleted(t));
        const deletedStillInCloud = cloudTalks.filter((t) => isTalkDeleted(t));
        if (deletedStillInCloud.length > 0) {
          Promise.allSettled(
            deletedStillInCloud.map((t) => deleteSafetyTalkFromFirestore(t.id))
          ).catch(() => {});
        }

        if (activeCloud.length > 0) {
          setSafetyTalks((current) => {
            const newItems = activeCloud.filter(
              (c) => !current.some((cur) => cur.id === c.id)
            );
            if (newItems.length > 0) {
              notifyNewIncomingTalk(newItems[0]);
            }
            return mergeUniqueTalks(activeCloud, current).filter(
              (t) => !isTalkDeleted(t)
            );
          });
          syncBatchTalksApi(activeCloud).catch(() => {});
        }
      },
      (err) => {
        console.warn('[Firestore Talks Sync Error]:', err.message);
      },
      (removedIds) => {
        if (removedIds.length === 0) return;
        removedIds.forEach((rid) => {
          markTalkDeleted(rid);
          deleteTalkApi(rid).catch(() => {});
        });
        const removedSet = new Set(removedIds);
        setSafetyTalks((prev) => prev.filter((t) => !removedSet.has(t.id)));
        setMySatelliteTalks((prev) => prev.filter((t) => !removedSet.has(t.id)));
      }
    );

    const isAdminUser = firebaseUser.email?.toLowerCase() === 'prevred3@gmail.com';
    if (isAdminUser) {
      const localNotifs = workerNotifications.filter((n) => !isNotificationDeleted(n));
      if (localNotifs.length > 0) {
        Promise.allSettled(
          localNotifs.map((n) => saveWorkerNotificationToFirestore(n))
        ).catch(() => {});
      }
    }

    const unsubNotifications = subscribeWorkerNotificationsFromFirestore(
      (cloudNotifs) => {
        const activeCloud = cloudNotifs.filter((n) => !isNotificationDeleted(n));
        const deletedStillInCloud = cloudNotifs.filter((n) => isNotificationDeleted(n));
        if (deletedStillInCloud.length > 0 && isAdminUser) {
          Promise.allSettled(
            deletedStillInCloud.map((n) => deleteWorkerNotificationFromFirestore(n.id))
          ).catch(() => {});
        }

        if (activeCloud.length > 0) {
          setWorkerNotifications((current) =>
            mergeUniqueNotifications(activeCloud, current).filter((n) => !isNotificationDeleted(n))
          );
          syncBatchNotificationsApi(activeCloud).catch(() => {});
        }
      },
      (err) => {
        console.warn('[Firestore Notifications Sync Error]:', err.message);
      },
      (removedIds) => {
        if (removedIds.length === 0) return;
        removedIds.forEach((rid) => {
          markNotificationDeleted(rid);
          deleteNotificationApi(rid).catch(() => {});
        });
        const removedSet = new Set(removedIds);
        setWorkerNotifications((prev) => prev.filter((n) => !removedSet.has(n.id)));
      }
    );

    const unsubEmergency = subscribeEmergencyFromFirestore((cloudEmergency) => {
      if (cloudEmergency?.active) {
        setActiveEmergency(cloudEmergency);
        safetyAudio.playEmergencySiren();
      } else if (cloudEmergency && !cloudEmergency.active) {
        setActiveEmergency(null);
      }
    });

    return () => {
      unsubIncidents();
      unsubTalks();
      unsubNotifications();
      unsubEmergency();
    };
  }, [
    firebaseUser,
    notifyNewIncoming,
    isIncidentDeleted,
    markIncidentDeleted,
    notifyNewIncomingTalk,
    isTalkDeleted,
    markTalkDeleted,
    isNotificationDeleted,
    markNotificationDeleted
  ]);

  const handleConnectCloudSync = async () => {
    setIsConnectingCloud(true);
    setCloudSyncError('');
    try {
      await signInWithFirebaseCloud();
    } catch (err) {
      const friendly = formatFirebaseAuthError(err);
      console.warn('No se pudo conectar la nube:', friendly);
      setCloudSyncError(friendly);
    } finally {
      setIsConnectingCloud(false);
    }
  };

  // 1. Cross-tab BroadcastChannel listener (instant local multi-tab sync)
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    broadcastRef.current = channel;

    channel.onmessage = (event) => {
      const { type, payload } = event.data || {};
      if (type === 'incident:created' && payload?.id) {
        if (isIncidentDeleted(payload)) return;
        notifyNewIncoming(payload as Incident);
        setIncidents((prev) => mergeUniqueIncidents([payload as Incident], prev));
      } else if (type === 'incident:updated' && payload?.id) {
        if (isIncidentDeleted(payload)) return;
        setIncidents((prev) => prev.map((i) => (i.id === payload.id ? payload : i)));
      } else if (type === 'incident:deleted' && payload?.id) {
        markIncidentDeleted(payload.id, payload.code);
        setIncidents((prev) => prev.filter((i) => i.id !== payload.id));
        setMySatelliteIncidents((prev) => prev.filter((i) => i.id !== payload.id));
      } else if (type === 'talk:created' && payload?.id) {
        if (isTalkDeleted(payload)) return;
        notifyNewIncomingTalk(payload as SafetyTalk);
        setSafetyTalks((prev) => mergeUniqueTalks([payload as SafetyTalk], prev));
      } else if (type === 'talk:updated' && payload?.id) {
        if (isTalkDeleted(payload)) return;
        setSafetyTalks((prev) => prev.map((t) => (t.id === payload.id ? payload : t)));
      } else if (type === 'talk:deleted' && payload?.id) {
        markTalkDeleted(payload.id);
        setSafetyTalks((prev) => prev.filter((t) => t.id !== payload.id));
        setMySatelliteTalks((prev) => prev.filter((t) => t.id !== payload.id));
      } else if (type === 'notification:created' && payload?.id) {
        if (isNotificationDeleted(payload)) return;
        setWorkerNotifications((prev) => mergeUniqueNotifications([payload as WorkerNotification], prev));
      } else if (type === 'notification:updated' && payload?.id) {
        if (isNotificationDeleted(payload)) return;
        setWorkerNotifications((prev) => prev.map((n) => (n.id === payload.id ? payload : n)));
      } else if (type === 'notification:deleted' && payload?.id) {
        markNotificationDeleted(payload.id);
        setWorkerNotifications((prev) => prev.filter((n) => n.id !== payload.id));
      } else if (type === 'emergency:updated') {
        setActiveEmergency(payload);
        if (payload?.active) safetyAudio.playEmergencySiren();
      }
    };

    return () => {
      channel.close();
      broadcastRef.current = null;
    };
  }, [
    notifyNewIncoming,
    isIncidentDeleted,
    markIncidentDeleted,
    notifyNewIncomingTalk,
    isTalkDeleted,
    markTalkDeleted,
    isNotificationDeleted,
    markNotificationDeleted
  ]);

  // 2. WebSocket real-time connection to /ws + auto-reconnect
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connectWs = () => {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'init' && msg.payload) {
              const serverIncidents: Incident[] = Array.isArray(msg.payload.incidents)
                ? msg.payload.incidents.filter((i: Incident) => !isIncidentDeleted(i))
                : [];
              if (serverIncidents.length > 0) {
                setIncidents((prev) => mergeUniqueIncidents(serverIncidents, prev));
              }
              const serverTalks: SafetyTalk[] = Array.isArray(msg.payload.safetyTalks)
                ? msg.payload.safetyTalks.filter((t: SafetyTalk) => !isTalkDeleted(t))
                : [];
              if (serverTalks.length > 0) {
                setSafetyTalks((prev) => mergeUniqueTalks(serverTalks, prev));
              }
              const serverNotifs: WorkerNotification[] = Array.isArray(msg.payload.workerNotifications)
                ? msg.payload.workerNotifications.filter((n: WorkerNotification) => !isNotificationDeleted(n))
                : [];
              if (serverNotifs.length > 0) {
                setWorkerNotifications((prev) => mergeUniqueNotifications(serverNotifs, prev));
              }
              if (msg.payload.emergency?.active) {
                setActiveEmergency(msg.payload.emergency);
              }
            } else if (msg.type === 'incident:created' && msg.payload?.id) {
              const created = msg.payload as Incident;
              if (isIncidentDeleted(created)) return;
              notifyNewIncoming(created);
              setIncidents((prev) => mergeUniqueIncidents([created], prev));
            } else if (msg.type === 'incidents:synced' && Array.isArray(msg.payload)) {
              const filtered = (msg.payload as Incident[]).filter((i) => !isIncidentDeleted(i));
              setIncidents((prev) => mergeUniqueIncidents(filtered, prev));
            } else if (msg.type === 'incident:updated' && msg.payload?.id) {
              if (isIncidentDeleted(msg.payload)) return;
              setIncidents((prev) =>
                prev.map((i) => (i.id === msg.payload.id ? msg.payload : i))
              );
            } else if (msg.type === 'incident:deleted' && msg.payload?.id) {
              markIncidentDeleted(msg.payload.id, msg.payload.code);
              setIncidents((prev) => prev.filter((i) => i.id !== msg.payload.id));
              setMySatelliteIncidents((prev) => prev.filter((i) => i.id !== msg.payload.id));
            } else if (msg.type === 'talk:created' && msg.payload?.id) {
              const createdTalk = msg.payload as SafetyTalk;
              if (isTalkDeleted(createdTalk)) return;
              notifyNewIncomingTalk(createdTalk);
              setSafetyTalks((prev) => mergeUniqueTalks([createdTalk], prev));
            } else if (msg.type === 'talks:synced' && Array.isArray(msg.payload)) {
              const filteredTalks = (msg.payload as SafetyTalk[]).filter((t) => !isTalkDeleted(t));
              setSafetyTalks((prev) => mergeUniqueTalks(filteredTalks, prev));
            } else if (msg.type === 'talk:updated' && msg.payload?.id) {
              if (isTalkDeleted(msg.payload)) return;
              setSafetyTalks((prev) =>
                prev.map((t) => (t.id === msg.payload.id ? msg.payload : t))
              );
            } else if (msg.type === 'talk:deleted' && msg.payload?.id) {
              markTalkDeleted(msg.payload.id);
              setSafetyTalks((prev) => prev.filter((t) => t.id !== msg.payload.id));
              setMySatelliteTalks((prev) => prev.filter((t) => t.id !== msg.payload.id));
            } else if (msg.type === 'notification:created' && msg.payload?.id) {
              const createdNotif = msg.payload as WorkerNotification;
              if (isNotificationDeleted(createdNotif)) return;
              setWorkerNotifications((prev) => mergeUniqueNotifications([createdNotif], prev));
            } else if (msg.type === 'notifications:synced' && Array.isArray(msg.payload)) {
              const filteredNotifs = (msg.payload as WorkerNotification[]).filter(
                (n) => !isNotificationDeleted(n)
              );
              setWorkerNotifications((prev) => mergeUniqueNotifications(filteredNotifs, prev));
            } else if (msg.type === 'notification:updated' && msg.payload?.id) {
              if (isNotificationDeleted(msg.payload)) return;
              setWorkerNotifications((prev) =>
                prev.map((n) => (n.id === msg.payload.id ? msg.payload : n))
              );
            } else if (msg.type === 'notification:deleted' && msg.payload?.id) {
              markNotificationDeleted(msg.payload.id);
              setWorkerNotifications((prev) => prev.filter((n) => n.id !== msg.payload.id));
            } else if (msg.type === 'emergency:updated') {
              setActiveEmergency(msg.payload);
              if (msg.payload?.active) {
                safetyAudio.playEmergencySiren();
              }
            }
          } catch {
            // Ignore malformed message
          }
        };

        ws.onclose = () => {
          if (!disposed) {
            reconnectTimer = setTimeout(connectWs, 3000);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        reconnectTimer = setTimeout(connectWs, 3000);
      }
    };

    connectWs();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [
    notifyNewIncoming,
    isIncidentDeleted,
    markIncidentDeleted,
    notifyNewIncomingTalk,
    isTalkDeleted,
    markTalkDeleted,
    isNotificationDeleted,
    markNotificationDeleted
  ]);

  // 3. Initial server fetch + resilient 2.5s REST polling fallback (incidents + signed talks + worker notifications)
  useEffect(() => {
    let active = true;

    async function syncFromServer(isInitial: boolean) {
      const [res, talksRes, notifsRes] = await Promise.all([
        fetchIncidentsFromServer(),
        fetchTalksFromServer(),
        fetchNotificationsFromServer()
      ]);
      if (!active) return;

      if (res.ok) {
        const deletedOnServer = res.data.filter((item) => isIncidentDeleted(item));
        if (deletedOnServer.length > 0) {
          Promise.allSettled(deletedOnServer.map((item) => deleteIncidentApi(item.id))).catch(() => {});
        }

        const validServerData = res.data.filter((item) => !isIncidentDeleted(item));
        if (validServerData.length > 0) {
          setIncidents((current) => {
            if (!isInitial) {
              const newItems = validServerData.filter((item) => !current.some((c) => c.id === item.id));
              if (newItems.length > 0) {
                notifyNewIncoming(newItems[0]);
              }
            }
            return mergeUniqueIncidents(validServerData, current).filter((i) => !isIncidentDeleted(i));
          });
        }
      }

      if (talksRes.ok) {
        const deletedTalksOnServer = talksRes.data.filter((item) => isTalkDeleted(item));
        if (deletedTalksOnServer.length > 0) {
          Promise.allSettled(deletedTalksOnServer.map((item) => deleteTalkApi(item.id))).catch(() => {});
        }

        const validServerTalks = talksRes.data.filter((item) => !isTalkDeleted(item));
        if (validServerTalks.length > 0) {
          setSafetyTalks((current) => {
            if (!isInitial) {
              const newItems = validServerTalks.filter((item) => !current.some((c) => c.id === item.id));
              if (newItems.length > 0) {
                notifyNewIncomingTalk(newItems[0]);
              }
            }
            return mergeUniqueTalks(validServerTalks, current).filter((t) => !isTalkDeleted(t));
          });
        }
      }

      if (notifsRes.ok) {
        const deletedNotifsOnServer = notifsRes.data.filter((item) => isNotificationDeleted(item));
        if (deletedNotifsOnServer.length > 0) {
          Promise.allSettled(deletedNotifsOnServer.map((item) => deleteNotificationApi(item.id))).catch(() => {});
        }

        const validServerNotifs = notifsRes.data.filter((item) => !isNotificationDeleted(item));
        if (validServerNotifs.length > 0) {
          setWorkerNotifications((current) =>
            mergeUniqueNotifications(validServerNotifs, current).filter((n) => !isNotificationDeleted(n))
          );
        }
      }
    }

    syncFromServer(true);
    const pollInterval = setInterval(() => syncFromServer(false), 2500);

    return () => {
      active = false;
      clearInterval(pollInterval);
    };
  }, [notifyNewIncoming, isIncidentDeleted, notifyNewIncomingTalk, isTalkDeleted, isNotificationDeleted]);

  // 4. Import helper for Google Drive -> Matrix synchronization
  const handleImportFromDrive = useCallback(async (driveIncidents: Incident[]): Promise<number> => {
    const newItems = driveIncidents.filter(
      (d) =>
        !isIncidentDeleted(d) &&
        !knownIdsRef.current.has(d.id) &&
        !incidents.some((c) => c.code === d.code)
    );
    if (newItems.length === 0) return 0;

    try {
      const syncedList = await syncBatchIncidentsApi(newItems);
      if (syncedList.length > 0) {
        setIncidents((prev) =>
          mergeUniqueIncidents(
            syncedList.filter((i) => !isIncidentDeleted(i)),
            prev
          )
        );
      } else {
        setIncidents((prev) => mergeUniqueIncidents(newItems, prev));
      }
    } catch {
      setIncidents((prev) => mergeUniqueIncidents(newItems, prev));
    }

    Promise.allSettled(newItems.map((inc) => saveIncidentToFirestore(inc))).catch(() => {});

    notifyNewIncoming(newItems[0]);
    return newItems.length;
  }, [incidents, notifyNewIncoming, isIncidentDeleted]);

  // 5. Auto-sync incoming satellite reports from Google Drive when prevred3@gmail.com is connected in Matrix
  useEffect(() => {
    if (appMode !== 'matrix') return;

    const drivePoll = setInterval(async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const driveIncidents = await fetchIncidentsFromDrive(token);
        if (driveIncidents.length > 0) {
          await handleImportFromDrive(driveIncidents);
        }
      } catch {
        // Silent background Drive poll
      }
    }, 15000);

    return () => clearInterval(drivePoll);
  }, [appMode, handleImportFromDrive]);

  // Persist data changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('prev_incidents', JSON.stringify(incidents));
    } catch {
      // Storage quota fallback
    }
  }, [incidents]);

  useEffect(() => {
    try {
      localStorage.setItem('prev_safety_talks', JSON.stringify(safetyTalks));
    } catch {
      // Storage quota fallback
    }
  }, [safetyTalks]);

  useEffect(() => {
    try {
      localStorage.setItem('prev_worker_notifications', JSON.stringify(workerNotifications));
    } catch {
      // Storage quota fallback
    }
  }, [workerNotifications]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    safetyAudio.soundEnabled = next;
  };

  const handleAddIncident = async (
    newIncident: Incident,
    options?: { skipApi?: boolean }
  ): Promise<Incident> => {
    if (newIncident.type === 'Accidente con Baja (LTI)') {
      setDaysWithoutLTI(0);
    }

    if (options?.skipApi) {
      setIncidents((prev) => mergeUniqueIncidents([newIncident], prev));
      setMySatelliteIncidents((prev) => mergeUniqueIncidents([newIncident], prev));
      postToBroadcast('incident:created', newIncident);
      saveIncidentToFirestore(newIncident).catch((e) => console.warn('[Firestore sync]:', e));
      return newIncident;
    }

    // Write to both Cloud Firestore (cross-device!) and Express server (same-origin!)
    let firestoreOk = false;
    try {
      firestoreOk = await saveIncidentToFirestore(newIncident);
    } catch (fsErr) {
      console.warn('[Firestore] Error al guardar reporte:', fsErr);
    }

    let saved = newIncident;
    try {
      saved = await createIncidentApi(newIncident);
    } catch (apiErr) {
      if (!firestoreOk) {
        throw apiErr;
      }
    }

    setIncidents((prev) => mergeUniqueIncidents([saved], prev));
    setMySatelliteIncidents((prev) => mergeUniqueIncidents([saved], prev));
    safetyAudio.playIncidentAlert(saved.severity);
    postToBroadcast('incident:created', saved);
    return saved;
  };

  const handleUpdateIncident = async (updated: Incident) => {
    setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    postToBroadcast('incident:updated', updated);
    try {
      await Promise.allSettled([
        updateIncidentApi(updated),
        updateIncidentInFirestore(updated)
      ]);
    } catch (err) {
      console.warn('Fallo al actualizar incidente:', err);
    }
  };

  const handleDeleteIncident = async (id: string) => {
    const target =
      incidents.find((i) => i.id === id) ||
      mySatelliteIncidents.find((i) => i.id === id);

    markIncidentDeleted(id, target?.code);
    setIncidents((prev) => prev.filter((i) => i.id !== id));
    setMySatelliteIncidents((prev) => prev.filter((i) => i.id !== id));
    if (selectedIncidentForDossier?.id === id) {
      setSelectedIncidentForDossier(null);
    }
    postToBroadcast('incident:deleted', { id, code: target?.code });

    try {
      await Promise.allSettled([
        deleteIncidentApi(id),
        deleteIncidentFromFirestore(id)
      ]);
    } catch (err) {
      console.warn('Fallo al eliminar incidente en backend:', err);
    }
  };

  const handleAddSafetyTalk = async (newTalk: SafetyTalk): Promise<SafetyTalk> => {
    let firestoreOk = false;
    try {
      firestoreOk = await saveSafetyTalkToFirestore(newTalk);
    } catch (fsErr) {
      console.warn('[Firestore] Error al guardar charla firmada:', fsErr);
    }

    let saved = newTalk;
    try {
      saved = await createTalkApi(newTalk);
    } catch (apiErr) {
      if (!firestoreOk) {
        console.warn('[API] Guardado local de charla firmada:', apiErr);
      }
    }

    setSafetyTalks((prev) => mergeUniqueTalks([saved], prev));
    setMySatelliteTalks((prev) => mergeUniqueTalks([saved], prev));
    safetyAudio.playIncidentAlert('Leve');
    postToBroadcast('talk:created', saved);
    return saved;
  };

  const handleValidateSafetyTalk = async (updatedTalk: SafetyTalk) => {
    setSafetyTalks((prev) => prev.map((t) => (t.id === updatedTalk.id ? updatedTalk : t)));
    postToBroadcast('talk:updated', updatedTalk);
    try {
      await Promise.allSettled([
        updateTalkApi(updatedTalk),
        updateSafetyTalkInFirestore(updatedTalk)
      ]);
    } catch (err) {
      console.warn('Fallo al validar charla firmada:', err);
    }
  };

  const handleDeleteSafetyTalk = async (id: string) => {
    markTalkDeleted(id);
    setSafetyTalks((prev) => prev.filter((t) => t.id !== id));
    setMySatelliteTalks((prev) => prev.filter((t) => t.id !== id));
    postToBroadcast('talk:deleted', { id });

    try {
      await Promise.allSettled([
        deleteTalkApi(id),
        deleteSafetyTalkFromFirestore(id)
      ]);
    } catch (err) {
      console.warn('Fallo al eliminar charla en backend:', err);
    }
  };

  const handleSendWorkerNotification = async (
    newNotif: WorkerNotification
  ): Promise<WorkerNotification> => {
    let firestoreOk = false;
    try {
      firestoreOk = await saveWorkerNotificationToFirestore(newNotif);
    } catch (fsErr) {
      console.warn('[Firestore] Error al guardar notificación para trabajadores:', fsErr);
    }

    let saved = newNotif;
    try {
      saved = await createNotificationApi(newNotif);
    } catch (apiErr) {
      if (!firestoreOk) {
        console.warn('[API] Guardado local de notificación:', apiErr);
      }
    }

    setWorkerNotifications((prev) => mergeUniqueNotifications([saved], prev));
    postToBroadcast('notification:created', saved);
    return saved;
  };

  const handleAcknowledgeWorkerNotification = async (
    notificationId: string,
    workerName: string
  ) => {
    const cleanWorker = String(workerName || 'Operador Terreno').trim().slice(0, 120);
    if (!cleanWorker) return;

    setWorkerNotifications((prev) =>
      prev.map((n) => {
        if (n.id !== notificationId) return n;
        const currentAck = Array.isArray(n.acknowledgedBy) ? n.acknowledgedBy : [];
        if (currentAck.includes(cleanWorker)) return n;
        const updated = {
          ...n,
          acknowledgedBy: [...currentAck, cleanWorker].slice(0, 50)
        };
        postToBroadcast('notification:updated', updated);
        return updated;
      })
    );

    try {
      await Promise.allSettled([
        acknowledgeNotificationApi(notificationId, cleanWorker),
        acknowledgeWorkerNotificationInFirestore(notificationId, cleanWorker)
      ]);
    } catch (err) {
      console.warn('Fallo al confirmar lectura de notificación:', err);
    }
  };

  const handleDeleteWorkerNotification = async (id: string) => {
    markNotificationDeleted(id);
    setWorkerNotifications((prev) => prev.filter((n) => n.id !== id));
    postToBroadcast('notification:deleted', { id });

    try {
      await Promise.allSettled([
        deleteNotificationApi(id),
        deleteWorkerNotificationFromFirestore(id)
      ]);
    } catch (err) {
      console.warn('Fallo al eliminar notificación en backend:', err);
    }
  };

  // Trigger emergency notice from satellite field -> transmits SOS state + critical incident to Cloud Firestore & Express!
  const handleTriggerFieldEmergency = async (location: string, message: string) => {
    safetyAudio.playEmergencySiren();
    const emergencyPayload: EmergencyState = {
      active: true,
      type: 'Alerta SOS Terreno',
      location,
      triggeredAt: new Date().toISOString(),
      message,
      accountedWorkers: 142,
      totalWorkers: 150,
      assemblyPoint: 'Punto de Encuentro 1 (Zona Norte - Estacionamiento)'
    };

    setActiveEmergency(emergencyPayload);
    postToBroadcast('emergency:updated', emergencyPayload);
    await Promise.allSettled([
      updateEmergencyApi(emergencyPayload),
      saveEmergencyToFirestore(emergencyPayload)
    ]);

    const sosIncident: Incident = {
      id: `sos-${Date.now()}`,
      code: `SOS-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString(),
      timeFormatted: 'ALERTA SOS EN DIRECTO',
      title: `¡ALERTA SOS DE PÁNICO! ${location}`,
      description: message,
      location,
      type: 'Emergencia / Conato',
      severity: 'Crítico',
      status: 'Abierto',
      reporterName: 'Satélite Móvil SOS',
      reporterRole: 'Emergencia en Terreno',
      immediateAction: 'Activación de protocolo de emergencia y alarma general en Matriz PRL.',
      rootCauseAnalysis: {
        why1: '',
        why2: '',
        why3: '',
        why4: '',
        why5: '',
        rootCauseSummary: ''
      },
      correctiveActions: [
        {
          action: 'Atender emergencia inmediata en sector reportado y verificar integridad del personal.',
          assignee: 'Brigada de Emergencia / Matriz PRL',
          dueDate: 'Inmediata',
          completed: false,
          priority: 'Urgente'
        }
      ]
    };

    try {
      await handleAddIncident(sosIncident);
    } catch (err) {
      console.warn('Error al registrar incidente SOS:', err);
    }
  };

  const handleDismissEmergency = async () => {
    safetyAudio.stopEmergencySiren();
    const cleared: Partial<EmergencyState> = {
      active: false,
      type: 'Evacuación General',
      location: activeEmergency?.location || 'Planta Principal',
      triggeredAt: activeEmergency?.triggeredAt || new Date().toISOString(),
      message: 'Emergencia atendida y cerrada por Matriz PRL'
    };
    setActiveEmergency(null);
    postToBroadcast('emergency:updated', cleared);
    await Promise.allSettled([
      updateEmergencyApi(cleared),
      saveEmergencyToFirestore(cleared)
    ]);
  };

  // Real-time Simulation Helper
  const handleSimulateLiveIncoming = () => {
    const sampleTitles = [
      'Casi accidente: Desprendimiento de carga suspendida en Grúa Puente 2',
      'Falta de guarda perimetral en cinta transportadora de áridos',
      'Fuga de vapor caliente a alta presión en tubería de caldera auxiliar',
      'Operario detectado sin arnés anticaídas en andamio nivel +6m'
    ];
    const sampleLocations = [
      'Nave de Prensas - Celda 02',
      'Patio de Carga - Sector Este',
      'Sala de Calderas y Compresores',
      'Silos de Almacenamiento'
    ];
    const idx = Math.floor(Math.random() * sampleTitles.length);
    const code = `TERRENO-${Math.floor(1000 + Math.random() * 9000)}`;

    const simulatedIncident: Incident = {
      id: `sim-${Date.now()}`,
      code,
      timestamp: new Date().toISOString(),
      timeFormatted: 'Recibido en directo ahora',
      title: sampleTitles[idx],
      description: `Transmisión en tiempo real desde la aplicación Satélite Móvil por la cuadrilla de turno. Verificación inmediata requerida.`,
      location: sampleLocations[idx],
      type: idx === 0 ? 'Casi Accidente (Near Miss)' : idx === 3 ? 'Acto Inseguro' : 'Condición Insegura',
      severity: idx === 0 || idx === 3 ? 'Grave' : 'Moderado',
      status: 'Abierto',
      reporterName: 'Carlos Mendonza',
      reporterRole: 'Técnico de Terreno',
      immediateAction: 'Cuadrilla procedió al acordonamiento y aviso a central.',
      photoUrl: '/src/assets/images/prl_inspection_machinery_1792634598416.jpg',
      rootCauseAnalysis: {
        why1: '',
        why2: '',
        why3: '',
        why4: '',
        why5: '',
        rootCauseSummary: ''
      },
      correctiveActions: [
        {
          action: 'Inspección técnica in-situ y verificación de resguardo.',
          assignee: 'Prevención Central / Matriz',
          dueDate: 'Inmediata',
          completed: false,
          priority: 'Alta'
        }
      ]
    };

    handleAddIncident(simulatedIncident).catch((err) => {
      console.warn('Simulación guardada localmente:', err);
    });
  };

  const isAdminSignedIn = firebaseUser?.email?.toLowerCase() === 'prevred3@gmail.com';
  const effectiveSatelliteLocked = isSatelliteLocked && !isAdminSignedIn;

  const handleAdminUnlockMatrix = async (): Promise<{ ok: boolean; error?: string }> => {
    if (firebaseUser?.email?.toLowerCase() === 'prevred3@gmail.com') {
      handleSetMode('matrix');
      return { ok: true };
    }
    try {
      const appUser = await signInWithFirebaseCloud({ loginHint: 'prevred3@gmail.com' });
      if (appUser.email?.toLowerCase() === 'prevred3@gmail.com') {
        handleSetMode('matrix');
        return { ok: true };
      }
      return {
        ok: false,
        error: `Cuenta conectada (${appUser.email || 'usuario'}) no es administrador. Solo prevred3@gmail.com puede abrir la Matriz PRL.`
      };
    } catch (err) {
      return {
        ok: false,
        error: formatFirebaseAuthError(err)
      };
    }
  };

  // If in SATELLITE mode (or locked worker phone PWA), render ONLY the field app
  if (appMode === 'satellite' || effectiveSatelliteLocked) {
    return (
      <>
        <SatelliteFieldApp
          onBackToMatrix={() => handleSetMode('matrix')}
          isLockedSatellite={effectiveSatelliteLocked}
          onUnlockMatrixAsAdmin={handleAdminUnlockMatrix}
          onSubmitIncident={handleAddIncident}
          myRecentIncidents={mySatelliteIncidents.length > 0 ? mySatelliteIncidents : incidents}
          onSubmitSafetyTalk={handleAddSafetyTalk}
          myRecentTalks={mySatelliteTalks.length > 0 ? mySatelliteTalks : safetyTalks}
          workerNotifications={workerNotifications}
          onAcknowledgeNotification={handleAcknowledgeWorkerNotification}
          onTriggerEmergency={handleTriggerFieldEmergency}
          onDeleteIncident={handleDeleteIncident}
          onOpenDriveModal={effectiveSatelliteLocked ? undefined : () => setShowDriveModal(true)}
          cloudUser={firebaseUser}
          onConnectCloud={handleConnectCloudSync}
          isConnectingCloud={isConnectingCloud}
          cloudError={cloudSyncError}
          onClearCloudError={() => setCloudSyncError('')}
        />
        {!effectiveSatelliteLocked && (
          <GoogleDriveSyncModal
            isOpen={showDriveModal}
            onClose={() => setShowDriveModal(false)}
            incidents={incidents}
            onImportFromDrive={handleImportFromDrive}
          />
        )}
      </>
    );
  }

  // MATRIX MODE (Central Prevention & Command Suite)
  const openIncidentsCount = incidents.filter((i) => i.status !== 'Cerrado').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar with Brand, Nav Links and Single Primary CTA */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenReportModal={() => setShowReportModal(true)}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        openIncidentsCount={openIncidentsCount}
        talksCount={safetyTalks.length}
        notificationsCount={workerNotifications.length}
      />

      {/* Mode Switcher & Cloud Sync Status Strip */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-slate-400">Modo Activo:</span>
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Aplicación Matriz (Centro de Comando & Supervisión PRL)
            </span>
            {firebaseUser ? (
              <span className="text-[11px] bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Nube Firestore Activa ({firebaseUser.email})
              </span>
            ) : (
              <button
                type="button"
                onClick={handleConnectCloudSync}
                disabled={isConnectingCloud}
                className="text-[11px] bg-blue-600 hover:bg-blue-500 text-white font-semibold px-2.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Cloud className="w-3 h-3" />
                <span>{isConnectingCloud ? 'Conectando...' : 'Conectar Nube (Recibir Celulares)'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDriveModal(true)}
              className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 text-xs cursor-pointer"
            >
              Google Drive
            </button>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={() => handleSetMode('satellite')}
              className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 text-xs cursor-pointer"
            >
              📱 Cambiar a App Satélite (Terreno)
            </button>
          </div>
        </div>
      </div>

      {cloudSyncError && !firebaseUser && (
        <div className="bg-rose-950/80 border-b border-rose-700/70 px-4 py-2 text-rose-200 text-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <span>{cloudSyncError}</span>
            <button
              type="button"
              onClick={() => setCloudSyncError('')}
              className="text-rose-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Active SOS Alert Banner from Satellite */}
      {activeEmergency?.active && (
        <div className="bg-rose-950 border-b border-rose-600 px-4 py-3 text-rose-100 animate-pulse">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div className="text-xs">
                <strong className="text-white uppercase tracking-wide">
                  ¡ALERTA SOS RECIBIDA DESDE TERRENO! ({activeEmergency.location})
                </strong>
                <span className="block text-rose-200">{activeEmergency.message}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismissEmergency}
              className="px-3 py-1 bg-rose-800 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer shrink-0"
            >
              Atender / Silenciar
            </button>
          </div>
        </div>
      )}

      {/* Real-time Incoming Satellite Report Banner */}
      {incomingBanner && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/40 px-4 py-2.5 text-emerald-100">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Nuevo reporte recibido desde App Satélite:</strong>{' '}
                <span className="font-mono text-amber-300">{incomingBanner.code}</span> — {incomingBanner.title}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIncomingBanner(null)}
              className="text-emerald-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Real-time Incoming Signed Safety Talk Banner */}
      {incomingTalkBanner && (
        <div className="bg-blue-950/90 border-b border-blue-500/40 px-4 py-2.5 text-blue-100">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                <strong>Nueva Charla Firmada recibida desde Terreno:</strong>{' '}
                <span className="font-mono text-amber-300">{incomingTalkBanner.code}</span> — {incomingTalkBanner.topic}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCurrentTab('talks');
                  setIncomingTalkBanner(null);
                }}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold cursor-pointer"
              >
                Ver Charla
              </button>
              <button
                type="button"
                onClick={() => setIncomingTalkBanner(null)}
                className="text-blue-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {currentTab === 'dashboard' && (
          <DashboardView
            incidents={incidents}
            onOpenReportModal={() => setShowReportModal(true)}
            onOpenQrModal={() => setShowQrModal(true)}
            onOpenSatelliteApp={() => handleSetMode('satellite')}
            onOpenDriveModal={() => setShowDriveModal(true)}
            onSelectIncident={(inc) => setSelectedIncidentForDossier(inc)}
            onSimulateLiveIncident={handleSimulateLiveIncoming}
            daysWithoutLTI={daysWithoutLTI}
            onDeleteIncident={handleDeleteIncident}
            onOpenNotificationsTab={() => setCurrentTab('notifications')}
          />
        )}

        {currentTab === 'incidents' && (
          <IncidentLiveStreamView
            incidents={incidents}
            onSelectIncident={(inc) => setSelectedIncidentForDossier(inc)}
            onOpenReportModal={() => setShowReportModal(true)}
            onOpenDriveModal={() => setShowDriveModal(true)}
            onDeleteIncident={handleDeleteIncident}
          />
        )}

        {currentTab === 'talks' && (
          <SafetyTalksView
            talks={safetyTalks}
            onValidateTalk={handleValidateSafetyTalk}
            onDeleteTalk={handleDeleteSafetyTalk}
          />
        )}

        {currentTab === 'notifications' && (
          <WorkerNotificationsView
            notifications={workerNotifications}
            onSendNotification={handleSendWorkerNotification}
            onDeleteNotification={handleDeleteWorkerNotification}
          />
        )}
      </main>

      {/* Modals */}
      <NewIncidentModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={(inc) => {
          handleAddIncident(inc).catch((err) => {
            console.warn('Error al enviar reporte manual al servidor:', err);
          });
        }}
        nextIncidentNumber={incidents.length + 43}
      />

      <IncidentDossierModal
        key={selectedIncidentForDossier?.id || 'none'}
        incident={selectedIncidentForDossier}
        onClose={() => setSelectedIncidentForDossier(null)}
        onUpdateIncident={handleUpdateIncident}
        onDeleteIncident={handleDeleteIncident}
      />

      <QrCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        onOpenSatelliteHere={() => {
          setShowQrModal(false);
          handleSetMode('satellite');
        }}
      />

      <GoogleDriveSyncModal
        isOpen={showDriveModal}
        onClose={() => setShowDriveModal(false)}
        incidents={incidents}
        onImportFromDrive={handleImportFromDrive}
      />
    </div>
  );
}
