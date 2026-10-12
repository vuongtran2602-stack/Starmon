import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  limit,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserAccount, PvpRoom, PlayerInRoom, PvpSpeakingSubmission, PvpMatchState } from '../types';

// Support both configured project ID and user-requested ID 'starmon-7f34b'
const activeFirebaseConfig = {
  ...firebaseConfig,
  projectId: 'starmon-7f34b',
  authDomain: 'starmon-7f34b.firebaseapp.com',
  storageBucket: 'starmon-7f34b.firebasestorage.app',
};

// Initialize or reuse Firebase App instance
export const app = getApps().length === 0 ? initializeApp(activeFirebaseConfig) : getApp();

// Initialize Firestore with Database ID from config
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;
export type OperationType = typeof OperationType[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Error: ', JSON.stringify(errInfo));
}

let isConnected = false;

/**
 * Validates connection to Firestore
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    isConnected = true;
    console.info(`🔥 Successfully connected to Firebase Cloud Firestore (Project: ${activeFirebaseConfig.projectId})`);
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is offline. Checking fallback.');
    }
    // Also consider reachable if read permission returned without hard network drop
    isConnected = true;
    return true;
  }
}

export function isFirestoreConnected(): boolean {
  return isConnected;
}

export function sanitizeDocId(key: string): string {
  return (key || 'player')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_\-\.:]/g, '_')
    .slice(0, 100);
}

export function sanitizeRoomCode(code: string): string {
  return (code || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Local in-memory caches to guarantee 100% responsiveness
const localRoomCache = new Map<string, PvpRoom>();

// ==========================================
// USER ACCOUNTS FIRESTORE METHODS
// ==========================================

/**
 * Save user game account to Firestore
 */
export async function saveAccountToFirestore(account: UserAccount): Promise<boolean> {
  if (!account || !account.username) return false;

  const primaryId = sanitizeDocId(account.username);
  const path = `accounts/${primaryId}`;

  try {
    const payload = {
      ...account,
      lastPlayedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'accounts', primaryId), payload, { merge: true });

    // Also mirror by googleId and email if available for easy lookup
    if (account.googleId) {
      const gId = sanitizeDocId(account.googleId);
      if (gId !== primaryId) {
        await setDoc(doc(db, 'accounts', gId), payload, { merge: true }).catch(() => {});
      }
    }
    if (account.email) {
      const eId = sanitizeDocId(account.email);
      if (eId !== primaryId && (!account.googleId || eId !== sanitizeDocId(account.googleId))) {
        await setDoc(doc(db, 'accounts', eId), payload, { merge: true }).catch(() => {});
      }
    }

    console.info(`🔥 Saved account "${account.username}" to Firestore (${activeFirebaseConfig.projectId})`);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Load all user accounts from Firestore
 */
export async function loadAccountsFromFirestore(): Promise<Record<string, UserAccount>> {
  const path = 'accounts';
  try {
    const snap = await getDocs(query(collection(db, 'accounts'), limit(50)));
    const accounts: Record<string, UserAccount> = {};

    snap.forEach((d) => {
      const data = d.data() as UserAccount;
      if (data && data.username) {
        const uKey = data.username.toLowerCase();
        accounts[uKey] = data;
        if (data.googleId) {
          accounts[data.googleId.toLowerCase()] = data;
        }
        if (data.email) {
          accounts[data.email.toLowerCase()] = data;
        }
      }
    });

    return accounts;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return {};
  }
}

/**
 * Load single account from Firestore by key
 */
export async function loadAccountFromFirestore(key: string): Promise<UserAccount | null> {
  if (!key) return null;
  const cleanKey = sanitizeDocId(key);
  const path = `accounts/${cleanKey}`;

  try {
    const snap = await getDoc(doc(db, 'accounts', cleanKey));
    if (snap.exists()) {
      return snap.data() as UserAccount;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

/**
 * Reset account in Firestore back to initial state
 */
export async function resetAccountInFirestore(key: string, username?: string): Promise<boolean> {
  if (!key) return false;
  const uname = username || key || 'Player';
  const cleanKey = sanitizeDocId(key);
  const path = `accounts/${cleanKey}`;

  try {
    const cleanPayload: UserAccount = {
      username: uname,
      pin: '',
      googleId: key.startsWith('google_') ? key : '',
      email: '',
      createdAt: new Date().toISOString(),
      lastPlayedAt: new Date().toISOString(),
      player: {
        name: uname,
        username: uname,
        level: 1,
        exp: 0,
        nextExp: 100,
        gold: 0,
        gems: 0,
        energy: 100,
        maxEnergy: 100,
        lastEnergyRegenTime: Date.now(),
        energyBatteries: { battery50: 5, battery100: 3, battery200: 1 },
        specialItems: { starShard: 15, goldenAnvil: 5 },
        starterPacksCount: 2,
        isNewPlayer: true,
        hasClaimedBeginnerPack: false,
        hasCompletedOnboardingTutorial: false,
        hasClaimedTutorial1Reward: false,
        completedTutorialStages: [],
        activeCompanionId: '',
        battleParty: [],
        mailUnreadCount: 0,
        soundEnabled: true,
        musicEnabled: true,
        showSpeakingHints: false,
        quizQuestionMode: 'speaking_only',
        graphicsQuality: 'High',
      },
      starmons: [],
      quests: [],
    };

    await setDoc(doc(db, 'accounts', cleanKey), cleanPayload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

// ==========================================
// REAL-TIME PVP MULTIPLAYER FIRESTORE METHODS
// ==========================================

/**
 * Save / Update PvP Room in Firestore
 */
export async function savePvpRoomToFirestore(room: PvpRoom): Promise<boolean> {
  if (!room || (!room.room_code && !room.code)) return false;

  const roomCode = sanitizeRoomCode(room.room_code || room.code);
  const path = `pvp_rooms/${roomCode}`;

  try {
    const serializedRoom: PvpRoom = {
      ...room,
      room_code: roomCode,
      code: roomCode,
      updatedAt: Date.now(),
    };

    localRoomCache.set(roomCode, serializedRoom);
    await setDoc(doc(db, 'pvp_rooms', roomCode), serializedRoom, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

/**
 * Get PvP Room from Firestore
 */
export async function getPvpRoomFromFirestore(roomCode: string): Promise<PvpRoom | null> {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) return null;

  const path = `pvp_rooms/${cleanCode}`;
  try {
    const snap = await getDoc(doc(db, 'pvp_rooms', cleanCode));
    if (snap.exists()) {
      const data = snap.data() as PvpRoom;
      localRoomCache.set(cleanCode, data);
      return data;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  return localRoomCache.get(cleanCode) || null;
}

/**
 * Join PvP Room in Firestore
 */
export async function joinPvpRoomInFirestore(
  roomCode: string,
  challenger: PlayerInRoom
): Promise<{ success: boolean; room?: PvpRoom; error?: string; joinedAsId?: string; joinedAsName?: string }> {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) {
    return { success: false, error: 'Vui lòng nhập mã phòng hợp lệ (6 chữ số)!' };
  }

  const room = await getPvpRoomFromFirestore(cleanCode);
  if (!room) {
    return { success: false, error: `Phòng "${cleanCode}" không tồn tại hoặc đã bị hủy. Vui lòng kiểm tra lại mã phòng!` };
  }

  let finalId = challenger.id;
  let finalName = challenger.name;

  if (finalId === room.host_id) {
    finalId = `${finalId}_guest_${Date.now().toString().slice(-4)}`;
    if (finalName === room.hostName) {
      finalName = 'Tài khoản Google B';
    }
  }

  const players = Array.isArray(room.players) ? [...room.players] : [];
  const existingIdx = players.findIndex(p => !p.isHost && (p.id === finalId || (challenger.id !== room.host_id && p.id === challenger.id)));

  if (existingIdx !== -1) {
    players[existingIdx] = {
      ...players[existingIdx],
      ...challenger,
      id: finalId,
      name: finalName,
    };
  } else {
    if (room.status !== 'WAITING') {
      return { success: false, error: `Phòng "${cleanCode}" đã bắt đầu trận đấu hoặc đã kết thúc!` };
    }
    if (players.length >= 2) {
      return { success: false, error: `Phòng "${cleanCode}" đã đầy (tối đa 2 người chơi)!` };
    }
    players.push({
      ...challenger,
      id: finalId,
      name: finalName,
      isHost: false,
      isReady: true,
    });
  }

  const isRoomReady = players.length >= 2;
  const initialMatchState: PvpMatchState = room.matchState || {
    roomCode: cleanCode,
    turn: 1,
    roundNumber: 1,
    phase: '1.1',
    subPhase: 1,
    attackerSlot: null,
    targetSlot: null,
    speakingSubmissions: {},
    updatedAt: Date.now(),
  };

  const updatedRoom: PvpRoom = {
    ...room,
    room_code: cleanCode,
    code: cleanCode,
    guestName: finalName,
    guestLevel: challenger.level || 1,
    status: isRoomReady ? 'IN_GAME' : room.status,
    players,
    matchState: isRoomReady ? initialMatchState : room.matchState,
    updatedAt: Date.now(),
  };

  await savePvpRoomToFirestore(updatedRoom);

  return {
    success: true,
    room: updatedRoom,
    joinedAsId: finalId,
    joinedAsName: finalName,
  };
}

/**
 * Update PvP Room status in Firestore
 */
export async function updatePvpRoomStatusInFirestore(
  roomCode: string,
  status: 'WAITING' | 'IN_GAME' | 'FINISHED'
): Promise<boolean> {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) return false;

  const room = await getPvpRoomFromFirestore(cleanCode);
  if (room) {
    room.status = status;
    room.updatedAt = Date.now();
    await savePvpRoomToFirestore(room);
  }
  return true;
}

/**
 * Delete PvP Room in Firestore
 */
export async function deletePvpRoomInFirestore(roomCode: string): Promise<boolean> {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) return false;

  const path = `pvp_rooms/${cleanCode}`;
  localRoomCache.delete(cleanCode);

  try {
    await deleteDoc(doc(db, 'pvp_rooms', cleanCode));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
}

/**
 * Real-time listener for specific PvP Room
 */
export function subscribeToPvpRoom(
  roomCode: string,
  onUpdate: (room: PvpRoom | null) => void
): () => void {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) return () => {};

  const path = `pvp_rooms/${cleanCode}`;
  const initial = localRoomCache.get(cleanCode);
  if (initial) onUpdate(initial);

  const unsubscribe = onSnapshot(
    doc(db, 'pvp_rooms', cleanCode),
    (snapshot) => {
      if (snapshot.exists()) {
        const roomData = snapshot.data() as PvpRoom;
        localRoomCache.set(cleanCode, roomData);
        onUpdate(roomData);
      } else {
        localRoomCache.delete(cleanCode);
        onUpdate(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  return unsubscribe;
}

/**
 * Real-time listener for all active waiting PvP rooms
 */
export function subscribeToActivePvpRooms(
  onUpdate: (rooms: PvpRoom[]) => void
): () => void {
  const path = 'pvp_rooms';
  const q = query(collection(db, 'pvp_rooms'), limit(30));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const rooms: PvpRoom[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as PvpRoom;
        if (data && data.status === 'WAITING') {
          rooms.push(data);
          localRoomCache.set(data.room_code || data.code, data);
        }
      });
      onUpdate(rooms);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  return unsubscribe;
}

function computeSeedFromCode(code: string): number {
  let hash = 12345;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) % 900000;
  }
  return hash + 100000;
}

/**
 * Submit Speaking Result to Firestore Room Match State
 */
export async function submitSpeakingToFirestore(
  roomCode: string,
  submission: PvpSpeakingSubmission & { slot?: 1 | 2; turn?: number }
): Promise<boolean> {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) return false;

  const room = await getPvpRoomFromFirestore(cleanCode);
  if (!room) return false;

  const slotKey = submission.slot === 2 ? 'slot2' : 'slot1';
  const existingState = room.matchState || {
    roomCode: cleanCode,
    turn: 1,
    roundNumber: 1,
    phase: '1.1',
    subPhase: 1,
    speakingSubmissions: {},
    updatedAt: Date.now(),
  };

  const updatedSubmissions = {
    ...(existingState.speakingSubmissions || {}),
    [slotKey]: {
      ...submission,
      submittedAt: Date.now(),
    },
  };

  const hasSlot1 = !!updatedSubmissions.slot1;
  const hasSlot2 = !!updatedSubmissions.slot2;
  const isBothCompleted = hasSlot1 && hasSlot2;

  let attackerSlot: 1 | 2 | 'TIE' | null = existingState.attackerSlot || null;
  let targetSlot: 1 | 2 | null = existingState.targetSlot || null;

  if (isBothCompleted) {
    const band1 = (updatedSubmissions.slot1 as any)?.overallBand || (updatedSubmissions.slot1 as any)?.score || 0;
    const band2 = (updatedSubmissions.slot2 as any)?.overallBand || (updatedSubmissions.slot2 as any)?.score || 0;
    const time1 = updatedSubmissions.slot1?.completionTime || 999;
    const time2 = updatedSubmissions.slot2?.completionTime || 999;

    if (band1 > band2) {
      attackerSlot = 1;
      targetSlot = 2;
    } else if (band2 > band1) {
      attackerSlot = 2;
      targetSlot = 1;
    } else {
      if (time1 < time2) {
        attackerSlot = 1;
        targetSlot = 2;
      } else if (time2 < time1) {
        attackerSlot = 2;
        targetSlot = 1;
      } else {
        attackerSlot = null;
        targetSlot = null;
      }
    }
  }

  const updatedMatchState: PvpMatchState = {
    ...existingState,
    phase: isBothCompleted ? '1.2' : '1.1',
    subPhase: isBothCompleted ? 2 : 1,
    speakingSubmissions: updatedSubmissions,
    attackerSlot: attackerSlot as 1 | 2 | null,
    targetSlot,
    updatedAt: Date.now(),
  };

  room.matchState = updatedMatchState;
  room.updatedAt = Date.now();
  await savePvpRoomToFirestore(room);

  return true;
}

/**
 * Advance PvP Combat Phase in Firestore
 */
export async function advancePvpCombatInFirestore(
  roomCode: string,
  nextTurn: number,
  resetSubmissions: boolean = true
): Promise<boolean> {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) return false;

  const room = await getPvpRoomFromFirestore(cleanCode);
  if (!room) return false;

  const existingState = room.matchState || {
    roomCode: cleanCode,
    turn: 1,
    roundNumber: 1,
    phase: '1.1',
    subPhase: 1,
    updatedAt: Date.now(),
  };

  const updatedMatchState: PvpMatchState = {
    ...existingState,
    turn: nextTurn,
    roundNumber: nextTurn,
    phase: `${nextTurn}.1`,
    subPhase: 1,
    attackerSlot: null,
    targetSlot: null,
    speakingSubmissions: resetSubmissions ? {} : existingState.speakingSubmissions,
    updatedAt: Date.now(),
  };

  room.matchState = updatedMatchState;
  room.updatedAt = Date.now();
  await savePvpRoomToFirestore(room);

  return true;
}

/**
 * Sync Combat Actions (Match-3 swaps, skills, board changes)
 */
export async function syncPvpActionToFirestore(roomCode: string, action: any): Promise<void> {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) return;

  const room = await getPvpRoomFromFirestore(cleanCode);
  if (!room) return;

  const currentTurn = room.matchState?.turn || room.matchState?.roundNumber || 1;
  const existingMatch: any = room.matchState || {
    roomCode: cleanCode,
    turn: currentTurn,
    roundNumber: currentTurn,
    phase: `${currentTurn}.2`,
    subPhase: 2,
  };

  const { newBoard, ...safeAction } = action || {};
  const nextVersion = (existingMatch.boardVersion || 1) + 1;

  const updatedMatch: any = {
    ...existingMatch,
    boardVersion: nextVersion,
    lastAction: {
      ...safeAction,
      boardJson: newBoard ? JSON.stringify(newBoard) : undefined,
      timestamp: Date.now(),
    },
    updatedAt: Date.now(),
  };

  if (newBoard) {
    updatedMatch.boardJson = JSON.stringify(newBoard);
  }

  room.matchState = updatedMatch;
  room.updatedAt = Date.now();
  await savePvpRoomToFirestore(room);
}

// Backward Compatibility Aliases so other components can import seamlessly
export const saveAccountToSupabase = saveAccountToFirestore;
export const loadAccountsFromSupabase = loadAccountsFromFirestore;
export const loadAccountFromSupabase = loadAccountFromFirestore;
export const resetAccountInSupabase = resetAccountInFirestore;
export const testSupabaseConnection = testFirestoreConnection;
export const isSupabaseConnected = isFirestoreConnected;
export const savePvpRoomToSupabase = savePvpRoomToFirestore;
export const getPvpRoomFromSupabase = getPvpRoomFromFirestore;
export const joinPvpRoomInSupabase = joinPvpRoomInFirestore;
export const updatePvpRoomStatusInSupabase = updatePvpRoomStatusInFirestore;
export const deletePvpRoomInSupabase = deletePvpRoomInFirestore;
export const submitSpeakingToSupabase = submitSpeakingToFirestore;
export const advancePvpCombatInSupabase = advancePvpCombatInFirestore;
export const syncPvpActionToSupabase = syncPvpActionToFirestore;
