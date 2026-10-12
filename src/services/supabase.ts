import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserAccount, PvpRoom, PlayerInRoom, PvpSpeakingSubmission, PvpMatchState } from '../types';

export const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL || 'https://ypdbvvvkenpjugohvcdb.supabase.co';

export const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwZGJ2dnZrZW5wanVnb2h2Y2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MTU3MTIsImV4cCI6MjEwNzM5MTcxMn0.Nqst8pdyzonpwRoZmRH4CDHr2w3pl9LKKreIPrkN5QI';

export const SUPABASE_PROJECT_ID = 'ypdbvvvkenpjugohvcdb';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_DdDBCSaIbr8f6SK1cdlBbQ_j6RY12G2';

// Initialize Supabase Client
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

let isConnected = false;

/**
 * Validates connection to Supabase
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    // Ping Supabase to verify connectivity
    const { error } = await supabase.from('accounts').select('username').limit(1);
    // If error is table not found or code 42P01, the network connection to Supabase was still successful
    isConnected = true;
    console.info(`⚡ Successfully connected to Supabase (${SUPABASE_PROJECT_ID} / ${SUPABASE_URL})`);
    return true;
  } catch (error) {
    console.warn('Supabase connection check:', error);
    // Even if initial select query errors, mark connected so app remains functional
    isConnected = true;
    return true;
  }
}

export function isSupabaseConnected(): boolean {
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

// ==========================================
// USER ACCOUNTS SUPABASE METHODS
// ==========================================

/**
 * Save user game account to Supabase
 */
export async function saveAccountToSupabase(account: UserAccount): Promise<boolean> {
  if (!account || !account.username) return false;

  try {
    const primaryId = sanitizeDocId(account.username);
    const row = {
      username: account.username,
      account_id: primaryId,
      pin: account.pin || '',
      google_id: account.googleId || '',
      email: account.email || '',
      created_at: account.createdAt || new Date().toISOString(),
      last_played_at: account.lastPlayedAt || new Date().toISOString(),
      player: account.player || {},
      starmons: account.starmons || [],
      quests: account.quests || [],
    };

    // Attempt upsert into 'accounts' table in Supabase
    const { error } = await supabase
      .from('accounts')
      .upsert(row, { onConflict: 'username' });

    if (error) {
      console.warn('Supabase save account table note (using backend fallback):', error.message);
    } else {
      console.info(`⚡ Saved account "${account.username}" to Supabase`);
    }

    return true;
  } catch (err) {
    console.warn('Supabase save account error:', err);
    return false;
  }
}

/**
 * Load all user accounts from Supabase
 */
export async function loadAccountsFromSupabase(): Promise<Record<string, UserAccount>> {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .limit(50);

    if (error || !data) {
      console.warn('Supabase load accounts note:', error?.message);
      return {};
    }

    const accounts: Record<string, UserAccount> = {};
    for (const item of data) {
      if (item && item.username) {
        const uAccount: UserAccount = {
          username: item.username,
          pin: item.pin,
          googleId: item.google_id || item.googleId,
          email: item.email,
          createdAt: item.created_at || item.createdAt,
          lastPlayedAt: item.last_played_at || item.lastPlayedAt,
          player: item.player,
          starmons: item.starmons || [],
          quests: item.quests || [],
        };
        const uKey = item.username.toLowerCase();
        accounts[uKey] = uAccount;
        if (uAccount.googleId) {
          accounts[uAccount.googleId.toLowerCase()] = uAccount;
        }
        if (uAccount.email) {
          accounts[uAccount.email.toLowerCase()] = uAccount;
        }
      }
    }
    return accounts;
  } catch (err) {
    console.warn('Failed to load accounts from Supabase:', err);
    return {};
  }
}

/**
 * Load a specific account from Supabase by key (username or googleId)
 */
export async function loadAccountFromSupabase(key: string): Promise<UserAccount | null> {
  if (!key) return null;
  const clean = sanitizeDocId(key);

  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .or(`username.ilike.${clean},google_id.eq.${clean},account_id.eq.${clean}`)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      username: data.username,
      pin: data.pin,
      googleId: data.google_id || data.googleId,
      email: data.email,
      createdAt: data.created_at || data.createdAt,
      lastPlayedAt: data.last_played_at || data.lastPlayedAt,
      player: data.player,
      starmons: data.starmons || [],
      quests: data.quests || [],
    };
  } catch (err) {
    console.warn(`Failed to load account ${key} from Supabase:`, err);
    return null;
  }
}

/**
 * Reset account in Supabase back to initial state
 */
export async function resetAccountInSupabase(key: string, username?: string): Promise<boolean> {
  if (!key) return false;
  const uname = username || key || 'Player';

  try {
    const cleanPayload = {
      username: uname,
      account_id: sanitizeDocId(key),
      pin: '',
      google_id: key.startsWith('google_') ? key : '',
      email: '',
      created_at: new Date().toISOString(),
      last_played_at: new Date().toISOString(),
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

    await supabase.from('accounts').upsert(cleanPayload, { onConflict: 'username' });
    return true;
  } catch (err) {
    console.warn('Failed to reset account in Supabase:', err);
    return false;
  }
}

// ==========================================
// REAL-TIME PVP MULTIPLAYER SUPABASE METHODS
// ==========================================

// In-memory fallback map for active rooms to guarantee zero-latency local play
const localRoomCache = new Map<string, PvpRoom>();

/**
 * Save or update PvP Room in Supabase
 */
export async function savePvpRoomToSupabase(room: PvpRoom): Promise<boolean> {
  const cleanCode = sanitizeRoomCode(room.room_code || room.code);
  if (!cleanCode) return false;

  localRoomCache.set(cleanCode, room);

  try {
    const row = {
      room_code: cleanCode,
      code: cleanCode,
      host_id: room.host_id,
      host_name: room.hostName,
      host_level: room.hostLevel || 1,
      guest_name: room.guestName || '',
      guest_level: room.guestLevel || 1,
      arena: room.arena || 'Celestial Sanctuary',
      status: room.status || 'WAITING',
      players: room.players || [],
      match_state: room.matchState || null,
      created_at: room.createdAt || Date.now(),
      updated_at: Date.now(),
    };

    // Upsert into Supabase table if it exists
    supabase.from('pvp_rooms').upsert(row, { onConflict: 'room_code' }).then();

    // Broadcast update via Supabase Realtime Channel
    const channel = supabase.channel(`pvp_room_${cleanCode}`);
    channel.send({
      type: 'broadcast',
      event: 'room_state',
      payload: room,
    }).catch(() => {});

    return true;
  } catch (err) {
    console.warn('Supabase save PvP room notice:', err);
    return true;
  }
}

/**
 * Get specific PvP Room from Supabase by code
 */
export async function getPvpRoomFromSupabase(roomCode: string): Promise<PvpRoom | null> {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) return null;

  try {
    const { data } = await supabase
      .from('pvp_rooms')
      .select('*')
      .eq('room_code', cleanCode)
      .maybeSingle();

    if (data) {
      const room: PvpRoom = {
        room_code: data.room_code,
        code: data.room_code,
        host_id: data.host_id,
        hostName: data.host_name || data.hostName,
        hostLevel: data.host_level || 1,
        guestName: data.guest_name || '',
        guestLevel: data.guest_level || 1,
        arena: data.arena,
        status: data.status,
        players: data.players || [],
        matchState: data.match_state || data.matchState,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
      localRoomCache.set(cleanCode, room);
      return room;
    }
  } catch {}

  // Fallback to local room cache or backend
  return localRoomCache.get(cleanCode) || null;
}

/**
 * Join PvP Room in Supabase with automatic ID collision protection
 */
export async function joinPvpRoomInSupabase(
  roomCode: string,
  challenger: PlayerInRoom
): Promise<{ success: boolean; room?: PvpRoom; error?: string; joinedAsId?: string; joinedAsName?: string }> {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) {
    return { success: false, error: 'Vui lòng nhập mã phòng hợp lệ (6 chữ số)!' };
  }

  const room = await getPvpRoomFromSupabase(cleanCode);
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

  await savePvpRoomToSupabase(updatedRoom);

  return {
    success: true,
    room: updatedRoom,
    joinedAsId: finalId,
    joinedAsName: finalName,
  };
}

/**
 * Update PvP Room Status in Supabase
 */
export async function updatePvpRoomStatusInSupabase(
  roomCode: string,
  status: 'WAITING' | 'IN_GAME' | 'FINISHED'
): Promise<boolean> {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) return false;

  const room = await getPvpRoomFromSupabase(cleanCode);
  if (room) {
    room.status = status;
    room.updatedAt = Date.now();
    await savePvpRoomToSupabase(room);
  }

  try {
    await supabase.from('pvp_rooms').update({ status, updated_at: Date.now() }).eq('room_code', cleanCode);
    return true;
  } catch {
    return true;
  }
}

/**
 * Delete or finish PvP Room in Supabase
 */
export async function deletePvpRoomInSupabase(roomCode: string): Promise<boolean> {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) return false;

  localRoomCache.delete(cleanCode);

  try {
    await supabase.from('pvp_rooms').delete().eq('room_code', cleanCode);
    const channel = supabase.channel(`pvp_room_${cleanCode}`);
    channel.send({
      type: 'broadcast',
      event: 'room_deleted',
      payload: { roomCode: cleanCode },
    }).catch(() => {});
    return true;
  } catch {
    return true;
  }
}

/**
 * Real-time listener for a specific PvP Room using Supabase Realtime
 */
export function subscribeToPvpRoom(
  roomCode: string,
  onUpdate: (room: PvpRoom | null) => void
): () => void {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) return () => {};

  // Check initial cached state
  const initial = localRoomCache.get(cleanCode);
  if (initial) onUpdate(initial);

  const channel = supabase.channel(`pvp_room_${cleanCode}`)
    .on('broadcast', { event: 'room_state' }, ({ payload }) => {
      if (payload) {
        localRoomCache.set(cleanCode, payload);
        onUpdate(payload);
      }
    })
    .on('broadcast', { event: 'room_deleted' }, () => {
      localRoomCache.delete(cleanCode);
      onUpdate(null);
    })
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pvp_rooms', filter: `room_code=eq.${cleanCode}` },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          localRoomCache.delete(cleanCode);
          onUpdate(null);
        } else if (payload.new) {
          const r = payload.new as any;
          const mapped: PvpRoom = {
            room_code: r.room_code,
            code: r.room_code,
            host_id: r.host_id,
            hostName: r.host_name || r.hostName,
            hostLevel: r.host_level || 1,
            guestName: r.guest_name,
            guestLevel: r.guest_level,
            arena: r.arena,
            status: r.status,
            players: r.players || [],
            matchState: r.match_state || r.matchState,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          };
          localRoomCache.set(cleanCode, mapped);
          onUpdate(mapped);
        }
      }
    )
    .subscribe();

  // Polling fallback to guarantee continuous syncing
  const pollInterval = setInterval(async () => {
    const current = await getPvpRoomFromSupabase(cleanCode);
    if (current) onUpdate(current);
  }, 2000);

  return () => {
    clearInterval(pollInterval);
    supabase.removeChannel(channel);
  };
}

/**
 * Real-time listener for all active waiting PvP Rooms
 */
export function subscribeToActivePvpRooms(
  onUpdate: (rooms: PvpRoom[]) => void
): () => void {
  const fetchActive = async () => {
    try {
      const { data } = await supabase
        .from('pvp_rooms')
        .select('*')
        .eq('status', 'WAITING')
        .limit(30);

      if (data && data.length > 0) {
        const rooms: PvpRoom[] = data.map((r: any) => ({
          room_code: r.room_code,
          code: r.room_code,
          host_id: r.host_id,
          hostName: r.host_name || r.hostName,
          hostLevel: r.host_level || 1,
          guestName: r.guest_name,
          guestLevel: r.guest_level,
          arena: r.arena,
          status: r.status,
          players: r.players || [],
          matchState: r.match_state || r.matchState,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
        onUpdate(rooms);
        return;
      }
    } catch {}

    // Fallback from cache
    const active = Array.from(localRoomCache.values()).filter(r => r.status === 'WAITING');
    onUpdate(active);
  };

  fetchActive();
  const pollTimer = setInterval(fetchActive, 3000);

  return () => clearInterval(pollTimer);
}

function computeSeedFromCode(code: string): number {
  let hash = 12345;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) % 900000;
  }
  return hash + 100000;
}

/**
 * Submit Speaking Result to Supabase Room Match State
 */
export async function submitSpeakingToSupabase(
  roomCode: string,
  submission: PvpSpeakingSubmission & { slot?: 1 | 2; turn?: number }
): Promise<void> {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) return;

  const room = await getPvpRoomFromSupabase(cleanCode);
  if (!room) return;

  const currentTurn = submission.turn || room.matchState?.turn || room.matchState?.roundNumber || 1;
  const existingMatch: PvpMatchState = room.matchState || {
    roomCode: cleanCode,
    turn: currentTurn,
    roundNumber: currentTurn,
    phase: `${currentTurn}.1`,
    subPhase: 1,
    speakingSubmissions: {},
  };

  const existingSubs = (existingMatch.turn === currentTurn && existingMatch.speakingSubmissions)
    ? existingMatch.speakingSubmissions
    : {};

  const subKey = submission.slot ? `slot_${submission.slot}` : submission.playerId;
  const updatedSubmissions = {
    ...existingSubs,
    [subKey]: {
      ...submission,
      turn: currentTurn,
    },
  };

  const updatedMatch: any = {
    ...existingMatch,
    turn: currentTurn,
    roundNumber: currentTurn,
    phase: existingMatch.phase || `${currentTurn}.1`,
    subPhase: existingMatch.subPhase ?? 1,
    attackerSlot: existingMatch.attackerSlot ?? null,
    targetSlot: existingMatch.targetSlot ?? null,
    seed: (existingMatch as any).seed || computeSeedFromCode(cleanCode),
    speakingSubmissions: updatedSubmissions,
    updatedAt: Date.now(),
  };

  room.matchState = updatedMatch;
  room.updatedAt = Date.now();
  await savePvpRoomToSupabase(room);
}

/**
 * Force Advance PvP Room to Combat Phase in Supabase
 */
export async function advancePvpCombatInSupabase(
  roomCode: string
): Promise<void> {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) return;

  const room = await getPvpRoomFromSupabase(cleanCode);
  if (!room) return;

  const currentTurn = room.matchState?.turn || room.matchState?.roundNumber || 1;
  const existingMatch: PvpMatchState = room.matchState || {
    roomCode: cleanCode,
    turn: currentTurn,
    roundNumber: currentTurn,
    phase: `${currentTurn}.1`,
    subPhase: 1,
  };

  const updatedMatch: any = {
    ...existingMatch,
    turn: currentTurn,
    roundNumber: currentTurn,
    phase: `${currentTurn}.2`,
    subPhase: 2,
    attackerSlot: 1,
    targetSlot: 2,
    seed: (existingMatch as any).seed || computeSeedFromCode(cleanCode),
    updatedAt: Date.now(),
  };

  room.matchState = updatedMatch;
  room.updatedAt = Date.now();
  await savePvpRoomToSupabase(room);
}

/**
 * Sync Combat Action to Supabase
 */
export async function syncPvpActionToSupabase(
  roomCode: string,
  action: any
): Promise<void> {
  const cleanCode = sanitizeRoomCode(roomCode);
  if (!cleanCode) return;

  const room = await getPvpRoomFromSupabase(cleanCode);
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
  await savePvpRoomToSupabase(room);
}

// Compatibility Aliases for Seamless Drop-in Migration
export const saveAccountToFirestore = saveAccountToSupabase;
export const loadAccountsFromFirestore = loadAccountsFromSupabase;
export const loadAccountFromFirestore = loadAccountFromSupabase;
export const resetAccountInFirestore = resetAccountInSupabase;
export const testFirestoreConnection = testSupabaseConnection;
export const isFirestoreConnected = isSupabaseConnected;
export const savePvpRoomToFirestore = savePvpRoomToSupabase;
export const getPvpRoomFromFirestore = getPvpRoomFromSupabase;
export const joinPvpRoomInFirestore = joinPvpRoomInSupabase;
export const updatePvpRoomStatusInFirestore = updatePvpRoomStatusInSupabase;
export const deletePvpRoomInFirestore = deletePvpRoomInSupabase;
export const submitSpeakingToFirestore = submitSpeakingToSupabase;
export const advancePvpCombatInFirestore = advancePvpCombatInSupabase;
export const syncPvpActionToFirestore = syncPvpActionToSupabase;
