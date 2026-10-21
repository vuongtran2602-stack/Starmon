import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { capCriterionBands, getInappropriateVocabularyCount, getShortAnswerBandPenalty } from './src/utils/speakingScoring.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = Number.parseInt(process.env.PORT || '3100', 10);
const PVP_SERVER_INSTANCE_ID = `${process.env.K_REVISION || 'local'}:${process.env.HOSTNAME || 'instance'}:${randomUUID()}`;

app.use(express.json());

// Enable CORS for all origins and headers (needed for cross-origin preview / dev URLs)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Persistent PvP Rooms store file
const ROOMS_STORE_FILE = path.resolve(__dirname, 'pvp_rooms_store.json');
// Persistent User Accounts store file
const ACCOUNTS_STORE_FILE = path.resolve(__dirname, 'server_accounts_store.json');
const supabaseUrl = process.env.SUPABASE_URL || 'https://jymjumdypgunipgjkjak.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const serverSupabase = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;
if (!serverSupabase) {
  console.warn('Supabase server persistence is disabled. Set SUPABASE_SERVICE_ROLE_KEY to enable it.');
}

type PvpAuthAccount = {
  username: string;
  password_salt: string;
  password_hash: string;
  active_device_id: string | null;
  active_session_hash: string | null;
};
const localPvpAuthAccounts = new Map<string, PvpAuthAccount>([
  ['a', { username: 'A', password_salt: 'ba26831d9bce2b8746187f316563077c', password_hash: 'b1119cd9ebfb47b2110dd523f3a46eab3a63ffbe936007d584267964b6d3f9028b7cacb461f613ee7bef77b96d0759935177819270380b5e5b8bb53d063f1367', active_device_id: null, active_session_hash: null }],
  ['b', { username: 'B', password_salt: 'c484aa35ed0278e0f4510925b4341ab0', password_hash: '3c97daf2ca296cff23838f73c170cb9bb6fe175b99eb671aa5cfb2c30c7347af3aee594ac65522fbd050fdeb0eded96c3a11682f3f04dca3fc873e4bacf99d82', active_device_id: null, active_session_hash: null }],
]);

function hashPvpSession(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function verifyPassword(password: string, account: PvpAuthAccount): boolean {
  const actual = scryptSync(password, account.password_salt, 64);
  const expected = Buffer.from(account.password_hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function getPvpAuthAccount(username: string): Promise<PvpAuthAccount | null> {
  const key = username.trim().toLowerCase();
  if (!serverSupabase) return localPvpAuthAccounts.get(key) || null;
  const { data, error } = await serverSupabase.from('pvp_auth_accounts')
    .select('username,password_salt,password_hash,active_device_id,active_session_hash')
    .eq('username', key).maybeSingle();
  if (error) throw error;
  return data as PvpAuthAccount | null;
}

async function verifyPvpSession(username: string, deviceId: string, token: string): Promise<string | null> {
  if (!username || !deviceId || !token) return null;
  const account = await getPvpAuthAccount(username);
  if (!account?.active_session_hash || account.active_device_id !== deviceId) return null;
  const expected = Buffer.from(account.active_session_hash, 'hex');
  const actual = Buffer.from(hashPvpSession(token), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? account.username : null;
}

function syncAccountsToSupabase(accounts: Record<string, ServerUserAccount>) {
  if (!serverSupabase) return;
  // getUniqueAccountsList deduplicates by Google ID/email, but separate
  // identities can still share a username. Postgres rejects an upsert batch
  // that contains the same ON CONFLICT key more than once.
  const uniqueByUsername = new Map<string, ServerUserAccount>();
  for (const account of getUniqueAccountsList(accounts)) {
    const username = account.username?.trim();
    if (!username) continue;

    const key = username.toLowerCase();
    const current = uniqueByUsername.get(key);
    const accountTime = Date.parse(account.lastPlayedAt || account.createdAt || '') || 0;
    const currentTime = current
      ? Date.parse(current.lastPlayedAt || current.createdAt || '') || 0
      : -1;
    if (!current || accountTime >= currentTime) uniqueByUsername.set(key, account);
  }

  const rows = Array.from(uniqueByUsername.values()).map(account => ({
    username: account.username.trim(),
    account_id: (account.googleId || account.email || account.username).trim().toLowerCase().replace(/[^a-z0-9_.:-]/g, '_').slice(0, 100),
    pin: account.pin || '',
    google_id: account.googleId || '',
    email: account.email || '',
    created_at: account.createdAt,
    last_played_at: account.lastPlayedAt,
    player: account.player || {},
    starmons: account.starmons || [],
    quests: account.quests || [],
  }));
  if (rows.length) void serverSupabase.from('starmon_accounts').upsert(rows, { onConflict: 'username' })
    .then(({ error }) => { if (error) console.error('Supabase account persistence failed:', error.message); });
}

async function deleteRoomFromSupabase(roomCode: string, expected?: { updatedAt: number; status?: string }): Promise<{ success: boolean; error?: any }> {
  if (!serverSupabase) return requiresSharedRoomStore
    ? { success: false, error: new Error('SUPABASE_SERVICE_ROLE_KEY is not configured') }
    : { success: true };
  const normalizedCode = normalizeRoomCode(roomCode);
  if (!normalizedCode) return { success: false, error: new Error('Invalid room code') };
  try {
    let query = serverSupabase.from('pvp_rooms').delete().eq('room_code', normalizedCode);
    if (expected) {
      query = query.eq('updated_at', expected.updatedAt);
      if (expected.status) query = query.eq('status', expected.status);
    }
    const { data, error } = await query.select('room_code').maybeSingle();
    if (error) {
      console.error('Supabase room deletion failed:', error.message);
      return { success: false, error };
    }
    if (expected && !data) {
      const conflict: any = new Error(`PvP room ${normalizedCode} changed before it could be closed`);
      conflict.code = 'PVP_ROOM_CONFLICT';
      return { success: false, error: conflict };
    }
    return { success: true };
  } catch (error) {
    console.error('Supabase room deletion failed:', error);
    return { success: false, error };
  }
}

const requiresSharedRoomStore = process.env.NODE_ENV === 'production' || Boolean(process.env.K_SERVICE);

async function persistRoomToSupabase(
  room: PvpRoom,
  insertOnly = false,
  clearRuntimeState = false,
  expected?: { updatedAt: number; status?: string },
): Promise<{ success: boolean; error?: any }> {
  if (!serverSupabase) {
    return requiresSharedRoomStore
      ? { success: false, error: new Error('SUPABASE_SERVICE_ROLE_KEY is not configured') }
      : { success: true };
  }
  const roomCode = normalizeRoomCode(room.room_code || room.code);
  if (expected) room.updatedAt = Math.max(Date.now(), expected.updatedAt + 1);
  const row: Record<string, any> = {
    room_code: roomCode,
    code: roomCode,
    host_id: room.host_id,
    host_name: room.hostName,
    host_level: room.hostLevel || 1,
    guest_name: room.guestName || '',
    guest_level: room.guestLevel || 1,
    arena: room.arena || 'Sunken Sands',
    status: room.status || 'WAITING',
    players: room.players || [],
    created_at: room.createdAt,
    updated_at: room.updatedAt || Date.now(),
  };
  if (clearRuntimeState) row.match_state = null;
  // Match snapshots are written only through the atomic runtime RPC. A lobby
  // update from a stale instance cache must not replace authoritative state.
  try {
    const result = insertOnly
      ? await serverSupabase.from('pvp_rooms').insert(row)
      // Do not upsert lobby data: match_state is intentionally absent from
      // `row`, and PostgREST upsert can apply a missing column as NULL on
      // conflict. That would erase the authoritative runtime snapshot during
      // an ordinary lobby update (join, start, or leave).
      : await (async () => {
          let query = serverSupabase.from('pvp_rooms').update(row).eq('room_code', roomCode);
          if (expected) {
            query = query.eq('updated_at', expected.updatedAt);
            if (expected.status) query = query.eq('status', expected.status);
          }
          return query.select('room_code').maybeSingle();
        })();
    if (result.error) {
      console.error('Supabase room persistence failed:', result.error.message);
      return { success: false, error: result.error };
    }
    if (!insertOnly && !result.data) {
      const error: any = new Error(`PvP room ${roomCode} no longer exists or changed in the shared store`);
      if (expected) error.code = 'PVP_ROOM_CONFLICT';
      console.error('Supabase room persistence failed:', error.message);
      return { success: false, error };
    }
    return { success: true };
  } catch (error) {
    console.error('Supabase room persistence failed:', error);
    return { success: false, error };
  }
}

export interface ServerUserAccount {
  username: string;
  pin?: string;
  googleId?: string;
  email?: string;
  createdAt: string;
  lastPlayedAt: string;
  player: any;
  starmons: any[];
  quests?: any[];
}

function getInitialAccounts(): Record<string, ServerUserAccount> {
  const now = new Date().toISOString();
  return {
    'google_wingsofdeath1126': {
      username: 'wingsofdeath1126',
      googleId: 'google_wingsofdeath1126',
      email: 'wingsofdeath1126@gmail.com',
      createdAt: now,
      lastPlayedAt: now,
      player: {
        name: 'wingsofdeath1126',
        username: 'wingsofdeath1126',
        googleId: 'google_wingsofdeath1126',
        googleEmail: 'wingsofdeath1126@gmail.com',
        level: 5,
        exp: 240,
        nextExp: 500,
        gold: 1500,
        gems: 80,
        starterPacksCount: 2,
        isNewPlayer: false,
        hasClaimedBeginnerPack: true,
        hasCompletedOnboardingTutorial: true,
        activeCompanionId: 'pyrokit',
        battleParty: ['pyrokit', 'coralus'],
        mailUnreadCount: 1,
        soundEnabled: true,
        musicEnabled: true,
        showSpeakingHints: false,
        quizQuestionMode: 'speaking_only',
        graphicsQuality: 'High',
      },
      starmons: [
        {
          id: 'pyrokit',
          name: 'Pyrokit',
          title: 'Mystic Nine-Tails Fox',
          element: 'Fire',
          role: 'Spell Caster',
          level: 5,
          cards: 12,
          baseAtk: 100,
          maxHp: 480,
          currentHp: 480,
          def: 44,
          currentMana: 20,
          maxMana: 200,
          avatarSeed: 'pyrokit',
          unlocked: true,
        },
        {
          id: 'coralus',
          name: 'Coralus',
          title: 'Azure Crab Guardian',
          element: 'Water',
          role: 'Guardian',
          level: 4,
          cards: 8,
          baseAtk: 82,
          maxHp: 595,
          currentHp: 595,
          def: 60,
          currentMana: 20,
          maxMana: 200,
          avatarSeed: 'coralus',
          unlocked: true,
        },
      ],
      quests: [],
    },
    'google_acc_a': {
      username: 'Tài khoản Google A',
      googleId: 'google_acc_A',
      email: 'userA@gmail.com',
      createdAt: now,
      lastPlayedAt: now,
      player: {
        name: 'Tài khoản Google A',
        username: 'Tài khoản Google A',
        googleId: 'google_acc_A',
        googleEmail: 'userA@gmail.com',
        level: 4,
        exp: 150,
        nextExp: 400,
        gold: 900,
        gems: 40,
        starterPacksCount: 2,
        isNewPlayer: false,
        hasClaimedBeginnerPack: true,
        hasCompletedOnboardingTutorial: true,
        activeCompanionId: 'ignisaur',
        battleParty: ['ignisaur', 'zapwing'],
        mailUnreadCount: 0,
        soundEnabled: true,
        musicEnabled: true,
        showSpeakingHints: false,
        quizQuestionMode: 'speaking_only',
        graphicsQuality: 'High',
      },
      starmons: [
        {
          id: 'ignisaur',
          name: 'Ignisaur',
          title: 'Volcanic Reptile',
          element: 'Fire',
          role: 'Berserker',
          level: 4,
          cards: 10,
          baseAtk: 92,
          maxHp: 550,
          currentHp: 550,
          def: 48,
          currentMana: 20,
          maxMana: 200,
          avatarSeed: 'ignisaur',
          unlocked: true,
        },
        {
          id: 'zapwing',
          name: 'Zapwing',
          title: 'Thunder Falcon',
          element: 'Thunder',
          role: 'Striker',
          level: 3,
          cards: 6,
          baseAtk: 88,
          maxHp: 430,
          currentHp: 430,
          def: 38,
          currentMana: 20,
          maxMana: 200,
          avatarSeed: 'zapwing',
          unlocked: true,
        },
      ],
      quests: [],
    },
    'google_acc_b': {
      username: 'Tài khoản Google B',
      googleId: 'google_acc_B',
      email: 'userB@gmail.com',
      createdAt: now,
      lastPlayedAt: now,
      player: {
        name: 'Tài khoản Google B',
        username: 'Tài khoản Google B',
        googleId: 'google_acc_B',
        googleEmail: 'userB@gmail.com',
        level: 4,
        exp: 180,
        nextExp: 400,
        gold: 1100,
        gems: 50,
        starterPacksCount: 2,
        isNewPlayer: false,
        hasClaimedBeginnerPack: true,
        hasCompletedOnboardingTutorial: true,
        activeCompanionId: 'tidecrush',
        battleParty: ['tidecrush', 'frostmoth'],
        mailUnreadCount: 0,
        soundEnabled: true,
        musicEnabled: true,
        showSpeakingHints: false,
        quizQuestionMode: 'speaking_only',
        graphicsQuality: 'High',
      },
      starmons: [
        {
          id: 'tidecrush',
          name: 'Tidecrush',
          title: 'Abyssal Behemoth',
          element: 'Water',
          role: 'Juggernaut',
          level: 4,
          cards: 10,
          baseAtk: 85,
          maxHp: 640,
          currentHp: 640,
          def: 62,
          currentMana: 20,
          maxMana: 200,
          avatarSeed: 'tidecrush',
          unlocked: true,
        },
        {
          id: 'frostmoth',
          name: 'Frostmoth',
          title: 'Glacial Spirit',
          element: 'Ice',
          role: 'Controller',
          level: 3,
          cards: 6,
          baseAtk: 80,
          maxHp: 450,
          currentHp: 450,
          def: 42,
          currentMana: 20,
          maxMana: 200,
          avatarSeed: 'frostmoth',
          unlocked: true,
        },
      ],
      quests: [],
    },
  };
}

export function getUniqueAccountsList(accounts: Record<string, ServerUserAccount>): ServerUserAccount[] {
  const seen = new Set<string>();
  const list: ServerUserAccount[] = [];
  for (const acc of Object.values(accounts)) {
    if (!acc) continue;
    const key = (acc.googleId || acc.email || acc.username || '').toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      list.push(acc);
    }
  }
  return list;
}

function loadAccounts(): Record<string, ServerUserAccount> {
  try {
    if (fs.existsSync(ACCOUNTS_STORE_FILE)) {
      const content = fs.readFileSync(ACCOUNTS_STORE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error reading server_accounts_store.json:', err);
  }
  const initial = getInitialAccounts();
  saveAccounts(initial);
  return initial;
}

function saveAccounts(accounts: Record<string, ServerUserAccount>) {
  try {
    fs.writeFileSync(ACCOUNTS_STORE_FILE, JSON.stringify(accounts, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Error writing server_accounts_store.json:', err);
  }
  syncAccountsToSupabase(accounts);
}

let serverAccounts: Record<string, ServerUserAccount> = loadAccounts();

export interface PlayerInRoom {
  id: string; // Google User ID / Host ID
  name: string;
  level: number;
  isHost: boolean;
  isReady: boolean;
  starmons?: Array<{
    id: string;
    name: string;
    element: string;
    level: number;
    maxHp: number;
    baseAtk: number;
    def: number;
    avatarSeed: string;
    skill1?: any;
    skill2?: any;
    passive?: any;
  }>;
}

export interface PvpRoom {
  room_code: string; // 6-digit or custom alphanumeric code
  code: string; // alias for backwards compatibility
  host_id: string; // Google User ID / Host Creator ID
  hostName: string; // alias for backwards compatibility
  hostLevel: number;
  guestName?: string;
  guestLevel?: number;
  arena: string;
  status: 'WAITING' | 'IN_GAME' | 'FINISHED';
  players: PlayerInRoom[];
  createdAt: number;
  updatedAt: number;
}

const DEFAULT_INITIAL_ROOMS: PvpRoom[] = [];

export function normalizeRoomCode(code: string): string {
  return (code || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeRoomPlayers(players: PlayerInRoom[] | undefined, hostId: string, hostFallback: PlayerInRoom): PlayerInRoom[] {
  const normalized = (Array.isArray(players) ? players : []).slice(0, 2).map(player => ({
    ...player,
    isHost: player.id === hostId || player.isHost === true,
    isReady: player.isReady ?? true,
  }));
  const hostIndex = normalized.findIndex(player => player.isHost);
  if (hostIndex > 0) normalized.unshift(...normalized.splice(hostIndex, 1));
  if (!normalized.length) normalized.push(hostFallback);
  return normalized.slice(0, 2).map((player, index) => ({ ...player, isHost: index === 0 }));
}

function pvpRoomFromSupabaseRow(row: any): PvpRoom {
  const hostId = String(row.host_id || 'host_default');
  const storedUpdatedAt = Number(row.updated_at ?? row.updatedAt);
  const hostFallback: PlayerInRoom = {
    id: hostId,
    name: row.host_name || row.hostName || 'Player',
    level: row.host_level || row.hostLevel || 1,
    isHost: true,
    isReady: true,
    starmons: [],
  };
  return {
    room_code: row.room_code || row.code,
    code: row.room_code || row.code,
    host_id: hostId,
    hostName: hostFallback.name,
    hostLevel: hostFallback.level,
    guestName: row.guest_name || row.guestName || undefined,
    guestLevel: row.guest_level || row.guestLevel || 1,
    arena: row.arena || 'Sunken Sands',
    status: row.status || 'WAITING',
    players: normalizeRoomPlayers(row.players, hostId, hostFallback),
    createdAt: Number(row.created_at || row.createdAt) || Date.now(),
    updatedAt: Number.isFinite(storedUpdatedAt) ? storedUpdatedAt : Date.now(),
    ...(row.match_state ? { matchState: row.match_state } : {}),
  } as PvpRoom;
}

function loadRooms(): PvpRoom[] {
  try {
    if (fs.existsSync(ROOMS_STORE_FILE)) {
      const content = fs.readFileSync(ROOMS_STORE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.map((r: any) => ({
          ...r,
          room_code: r.room_code || r.code || '100000',
          code: r.code || r.room_code || '100000',
          host_id: r.host_id || 'host_default',
          status: (r.status === 'in_battle' ? 'IN_GAME' : r.status === 'waiting' ? 'WAITING' : r.status) || 'WAITING',
          players: normalizeRoomPlayers(r.players, r.host_id || 'host_default', {
              id: r.host_id || 'host_default',
              name: r.hostName || 'Player',
              level: r.hostLevel || 1,
              isHost: true,
              isReady: true,
              starmons: [],
            }),
        }));
      }
    }
  } catch (err) {
    console.warn('Error reading pvp_rooms_store.json:', err);
  }
  return [];
}

function saveRooms(rooms: PvpRoom[]) {
  writeRoomsStore(rooms);
}

function writeRoomsStore(rooms: PvpRoom[]) {
  try {
    fs.writeFileSync(ROOMS_STORE_FILE, JSON.stringify(rooms, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Error writing pvp_rooms_store.json:', err);
  }
}

let activeRooms: PvpRoom[] = loadRooms();

async function hydrateSupabaseStores() {
  if (!serverSupabase) return;
  const [{ data: accountRows, error: accountError }, { data: roomRows, error: roomError }] = await Promise.all([
    serverSupabase.from('starmon_accounts').select('*').limit(1000),
    serverSupabase.from('pvp_rooms').select('*').limit(500),
  ]);
  if (accountError) console.error('Could not load Supabase accounts:', accountError.message);
  else if (accountRows?.length) {
    for (const row of accountRows) {
      if (!row.username) continue;
      const account: ServerUserAccount = {
        username: row.username,
        pin: row.pin || '',
        googleId: row.google_id || '',
        email: row.email || '',
        createdAt: row.created_at || new Date().toISOString(),
        lastPlayedAt: row.last_played_at || new Date().toISOString(),
        player: row.player || {},
        starmons: row.starmons || [],
        quests: row.quests || [],
      };
      for (const key of [account.username, account.googleId, account.email]) {
        if (key) serverAccounts[key.toLowerCase()] = account;
      }
    }
    try { fs.writeFileSync(ACCOUNTS_STORE_FILE, JSON.stringify(serverAccounts, null, 2), 'utf-8'); }
    catch (err) { console.warn('Could not cache Supabase accounts locally:', err); }
  }
  if (roomError) console.error('Could not load Supabase rooms:', roomError.message);
  else if (roomRows?.length) {
    const remoteRooms: PvpRoom[] = roomRows.map((row: any) => ({
      ...row,
      room_code: row.room_code || row.code,
      code: row.room_code || row.code,
      hostName: row.host_name || row.hostName,
      hostLevel: row.host_level || row.hostLevel || 1,
      guestName: row.guest_name || '',
      guestLevel: row.guest_level || 1,
      matchState: row.match_state || row.matchState,
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt,
    }));
    activeRooms = remoteRooms;
    try { fs.writeFileSync(ROOMS_STORE_FILE, JSON.stringify(activeRooms, null, 2), 'utf-8'); }
    catch (err) { console.warn('Could not cache Supabase rooms locally:', err); }
    broadcastRoomList();
  }
}

// Map of normalized room code to connected WebSocket clients
const roomClients = new Map<string, Set<WebSocket>>();

// Setup WebSocket Server
const wss = new WebSocketServer({ server });

function broadcastToRoom(roomCode: string, payload: any, senderWs?: WebSocket, relayAcrossInstances = true) {
  const normCode = normalizeRoomCode(roomCode);
  const clients = new Set(roomClients.get(normCode) || []);
  // Keep the authenticated match sockets as a delivery fallback. A socket can
  // temporarily be absent from roomClients after reconnect bookkeeping while
  // still being the current socket recorded for its player slot.
  const match = activeMatchStates.get(normCode);
  if (match) {
    if (match.players[1].socket) clients.add(match.players[1].socket);
    if (match.players[2].socket) clients.add(match.players[2].socket);
  }
  let message: string;
  try {
    message = JSON.stringify(payload);
  } catch (error) {
    console.error(`[PvP] Could not serialize room broadcast (${normCode})`, error);
    return;
  }
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN && client !== senderWs) {
      try {
        client.send(message);
      } catch (error) {
        // A socket may close between readyState and send(). One broken client
        // must never abort the authoritative phase transition for the room.
        console.warn(`[PvP] Could not deliver room broadcast (${normCode})`, error);
      }
    }
  }
  if (relayAcrossInstances && match && match.runtimeOwnerId === PVP_SERVER_INSTANCE_ID && PVP_STATEFUL_BROADCAST_TYPES.has(String(payload?.type || ''))) {
    publishPvpRuntimeState(normCode, payload, match);
  }
}

function broadcastRoomList() {
  const waitingRooms = activeRooms.filter(r => r.status === 'WAITING');
  const message = JSON.stringify({ type: 'ROOMS_UPDATED', rooms: waitingRooms });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function broadcastAccounts() {
  const uniqueList = getUniqueAccountsList(serverAccounts);
  const message = JSON.stringify({ type: 'ACCOUNTS_UPDATED', accounts: uniqueList });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

interface StarmonCombatant {
  index: number;
  ownerSlot: 1 | 2;
  id: string;
  name: string;
  element: string;
  level: number;
  maxHp: number;
  hp: number;
  currentHp: number;
  alive: boolean;
  unlocked: boolean;
  baseAtk: number;
  baseDef?: number;
  element?: string;
  secondaryElement?: string;
  def: number;
  mana: number;
  currentMana: number;
  battleShieldPoints?: number;
  battleTauntTurns?: number;
  battleDamageReduction?: number;
  battleDamageReductionTurns?: number;
  battleDefenseBuffAmount?: number;
  battleDefenseBuffTurns?: number;
  berryReserveUsed?: boolean;
  avatarSeed?: string;
  skill1?: any;
  skill2?: any;
}

interface PlayerSlotState {
  id: string;
  name: string;
  slot: 1 | 2; // 1 = Player 1 (Host / TRÁI), 2 = Player 2 (Guest / PHẢI)
  starmons: StarmonCombatant[];
  results: (boolean | null)[];
  hasSubmittedAnswer: boolean;
  answeredCount: number;
  socket?: WebSocket | null;
}

interface PvpMatchState {
  roomCode: string;
  turn: number; // 1, 2, 3... n
  roundNumber: number; // alias of turn for compatibility
  phase: string; // "1.1", "1.2", "1.3", "2.1", "2.2", "2.3"...
  subPhase: 1 | 2 | 3; // 1 = Answer, 2 = P1 Attack, 3 = P2 Attack
  step: number; // 1, 2, 3 (Step 1 = Starmon 1, Step 2 = Starmon 2, Step 3 = Starmon 3)
  actionCommittedStep: number; // prevents duplicate actions for the same Starmon step
  attackerSlot: 1 | 2 | null;
  targetSlot: 1 | 2 | null;
  players: {
    1: PlayerSlotState;
    2: PlayerSlotState;
  };
  player1: PlayerSlotState; // alias of players[1]
  player2: PlayerSlotState; // alias of players[2]
  attackQueue: number[]; // legacy compatibility
  phaseStartedAt: number;
  phaseEndsAt: number;
  phaseTimerGeneration?: number;
  lastEndedPhase?: string;
  pendingNextTurnAt?: number;
  finished?: boolean;
  phaseTimerHandle?: NodeJS.Timeout | null;
  timerHandle?: NodeJS.Timeout | null;
  stepTimerHandle?: NodeJS.Timeout | null;
  stepStartTime?: number;
  seed: number;
  boardVersion: number;
  runtimeRevision?: number;
  runtimeOwnerId?: string | null;
  runtimeOwnerLastSeenAt?: number;
  board?: { element: string }[][];
  sharedBoard?: {
    seed: number;
    grid: { element: string }[][];
    starmons: {
      1: StarmonCombatant[];
      2: StarmonCombatant[];
    };
    version: number;
  };
}

const SERVER_BOARD_ELEMENTS = ['Fire', 'Water', 'Electric', 'Wind', 'Earth', 'Metal'];

function generateRandomSeed(): number {
  return Math.floor(Math.random() * 1000000000) + 1;
}

function computeSeedFromRoomCode(code: string): number {
  let hash = 12345;
  const clean = (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) % 900000;
  }
  return hash + 100000;
}

function generateBoardFromSeed(seed: number): { element: string }[][] {
  let current = seed;
  const nextRand = () => {
    current = (current * 9301 + 49297) % 233280;
    return current / 233280;
  };

  const grid: { element: string }[][] = [];
  for (let r = 0; r < 8; r++) {
    grid[r] = [];
    for (let c = 0; c < 8; c++) {
      let available = [...SERVER_BOARD_ELEMENTS];
      if (c >= 2 && grid[r][c - 1]?.element === grid[r][c - 2]?.element) {
        available = available.filter(e => e !== grid[r][c - 1]?.element);
      }
      if (r >= 2 && grid[r - 1]?.[c]?.element === grid[r - 2]?.[c]?.element) {
        available = available.filter(e => e !== grid[r - 1]?.[c]?.element);
      }
      const elem = available[Math.floor(nextRand() * available.length)];
      grid[r][c] = { element: elem };
    }
  }
  return grid;
}

function generateServerBoard(): { element: string }[][] {
  return generateBoardFromSeed(generateRandomSeed());
}

function normalizePvpBoard(input: any): { element: string }[][] | null {
  if (!Array.isArray(input) || input.length !== 8) return null;
  const normalized: { element: string }[][] = [];
  for (const row of input) {
    if (!Array.isArray(row) || row.length !== 8) return null;
    const normalizedRow: { element: string }[] = [];
    for (const cell of row) {
      const element = typeof cell === 'string' ? cell : cell?.element;
      if (!SERVER_BOARD_ELEMENTS.includes(element)) return null;
      normalizedRow.push({ element });
    }
    normalized.push(normalizedRow);
  }
  return normalized;
}

function initializeSharedBoard(state: PvpMatchState, seed: number) {
  const grid = generateBoardFromSeed(seed);
  state.seed = seed;
  state.board = grid;
  state.boardVersion = 1;
  state.sharedBoard = {
    seed,
    grid,
    starmons: {
      1: state.players[1].starmons,
      2: state.players[2].starmons,
    },
    version: 1,
  };
}

function serializeBoard(state: PvpMatchState) {
  const normalizedBoard = normalizePvpBoard(state.board);
  if (!normalizedBoard) {
    state.board = generateBoardFromSeed(state.seed || computeSeedFromRoomCode(state.roomCode));
  } else {
    state.board = normalizedBoard;
  }
  return {
    seed: state.seed,
    grid: state.board,
    starmons: {
      1: state.players[1].starmons.map(s => ({ ...s })),
      2: state.players[2].starmons.map(s => ({ ...s })),
    },
    version: state.boardVersion || 1,
  };
}

function serializeMatchState(state: PvpMatchState | null | undefined): any {
  if (!state) return null;
  const p1 = state.players[1];
  const p2 = state.players[2];
  return {
    roomCode: state.roomCode,
    turn: state.turn,
    roundNumber: state.roundNumber,
    phase: state.phase,
    subPhase: state.subPhase,
    step: state.step,
    actionCommittedStep: state.actionCommittedStep,
    attackerSlot: state.attackerSlot,
    targetSlot: state.targetSlot,
    phaseStartedAt: state.phaseStartedAt,
    phaseEndsAt: state.phaseEndsAt,
    pendingNextTurnAt: state.pendingNextTurnAt,
    finished: Boolean(state.finished),
    lastEndedPhase: state.lastEndedPhase,
    phaseTimerGeneration: state.phaseTimerGeneration || 0,
    runtimeRevision: state.runtimeRevision || 0,
    runtimeOwnerId: state.runtimeOwnerId || null,
    runtimeOwnerLastSeenAt: state.runtimeOwnerLastSeenAt || Date.now(),
    players: {
      1: {
        id: p1?.id || 'player1',
        name: p1?.name || 'Player 1',
        slot: p1?.slot || 1,
        starmons: p1?.starmons ? p1.starmons.map(s => ({ ...s })) : [],
        results: p1?.results ? [...p1.results] : [null, null, null],
        hasSubmittedAnswer: Boolean(p1?.hasSubmittedAnswer),
        answeredCount: p1?.answeredCount || 0,
      },
      2: {
        id: p2?.id || 'player2',
        name: p2?.name || 'Player 2',
        slot: p2?.slot || 2,
        starmons: p2?.starmons ? p2.starmons.map(s => ({ ...s })) : [],
        results: p2?.results ? [...p2.results] : [null, null, null],
        hasSubmittedAnswer: Boolean(p2?.hasSubmittedAnswer),
        answeredCount: p2?.answeredCount || 0,
      },
    },
    player1: {
      id: p1?.id || 'player1',
      name: p1?.name || 'Player 1',
      slot: p1?.slot || 1,
      starmons: p1?.starmons ? p1.starmons.map(s => ({ ...s })) : [],
      results: p1?.results ? [...p1.results] : [null, null, null],
      hasSubmittedAnswer: Boolean(p1?.hasSubmittedAnswer),
      answeredCount: p1?.answeredCount || 0,
    },
    player2: {
      id: p2?.id || 'player2',
      name: p2?.name || 'Player 2',
      slot: p2?.slot || 2,
      starmons: p2?.starmons ? p2.starmons.map(s => ({ ...s })) : [],
      results: p2?.results ? [...p2.results] : [null, null, null],
      hasSubmittedAnswer: Boolean(p2?.hasSubmittedAnswer),
      answeredCount: p2?.answeredCount || 0,
    },
    seed: state.seed,
    boardVersion: state.boardVersion,
    board: state.board,
    sharedBoard: state.sharedBoard ? {
      seed: state.sharedBoard.seed,
      grid: state.sharedBoard.grid,
      starmons: {
        1: state.sharedBoard.starmons[1] ? state.sharedBoard.starmons[1].map(s => ({ ...s })) : [],
        2: state.sharedBoard.starmons[2] ? state.sharedBoard.starmons[2].map(s => ({ ...s })) : [],
      },
      version: state.sharedBoard.version,
    } : undefined,
  };
}

function mutateBoard(
  state: PvpMatchState,
  roomCode: string,
  mutationFn: () => void,
  broadcastPayload: any = null
) {
  mutationFn();
  state.boardVersion = (state.boardVersion || 1) + 1;
  if (state.sharedBoard) {
    state.sharedBoard.grid = state.board || state.sharedBoard.grid;
    state.sharedBoard.starmons = {
      1: state.players[1].starmons,
      2: state.players[2].starmons,
    };
    state.sharedBoard.version = state.boardVersion;
  }

  const snapshot = serializeBoard(state);
  const patch = broadcastPayload ? { ...broadcastPayload, grid: state.board } : {
    grid: state.board,
    starmons: snapshot.starmons,
  };

  broadcastToRoom(roomCode, {
    type: 'board_update',
    version: state.boardVersion,
    boardVersion: state.boardVersion,
    patch,
    boardSnapshot: snapshot,
    board: state.board,
    p1_hp: state.players[1].starmons.map(s => s.hp),
    p2_hp: state.players[2].starmons.map(s => s.hp),
    p1_mana: state.players[1].starmons.map(s => s.mana),
    p2_mana: state.players[2].starmons.map(s => s.mana),
  });
}

const activeMatchStates = new Map<string, PvpMatchState>();

const PVP_STATEFUL_BROADCAST_TYPES = new Set([
  'board_update', 'PVP_BOARD_UPDATED', 'board_full_sync', 'phase_start', 'phase_changed',
  'phase_ended', 'PVP_PHASE_START_ANSWER', 'PVP_PHASE_START_SPEAKING', 'step_started',
  'your_starmon_turn', 'your_attack_turn', 'PVP_YOUR_ATTACK_TURN',
  'step_skipped', 'starmon_action_resolved', 'attack_resolved', 'PVP_ANSWER_SUBMITTED',
  'PVP_ANSWER_RESULT', 'PVP_ACTION_REJECTED', 'all_starmons_done', 'PVP_MATCH_FINISHED', 'game_over',
]);

function applySerializedMatchState(state: PvpMatchState, snapshot: any) {
  if (!snapshot || typeof snapshot !== 'object') return;
  const previousPhase = state.phase;
  state.turn = Number(snapshot.turn) || state.turn;
  state.roundNumber = Number(snapshot.roundNumber) || state.turn;
  state.phase = typeof snapshot.phase === 'string' ? snapshot.phase : state.phase;
  state.subPhase = snapshot.subPhase === 2 || snapshot.subPhase === 3 ? snapshot.subPhase : 1;
  state.step = Number(snapshot.step) || 1;
  state.actionCommittedStep = Number(snapshot.actionCommittedStep) || 0;
  state.attackerSlot = snapshot.attackerSlot === 1 || snapshot.attackerSlot === 2 ? snapshot.attackerSlot : null;
  state.targetSlot = snapshot.targetSlot === 1 || snapshot.targetSlot === 2 ? snapshot.targetSlot : null;
  state.phaseStartedAt = Number(snapshot.phaseStartedAt) || state.phaseStartedAt;
  state.phaseEndsAt = Number(snapshot.phaseEndsAt) || state.phaseEndsAt;
  state.pendingNextTurnAt = Number(snapshot.pendingNextTurnAt) || undefined;
  state.finished = Boolean(snapshot.finished);
  state.lastEndedPhase = typeof snapshot.lastEndedPhase === 'string' ? snapshot.lastEndedPhase : undefined;
  state.phaseTimerGeneration = Number(snapshot.phaseTimerGeneration) || state.phaseTimerGeneration || 0;
  state.seed = Number(snapshot.seed) || state.seed;
  state.boardVersion = Number(snapshot.boardVersion) || state.boardVersion;
  state.runtimeRevision = Number(snapshot.runtimeRevision) || state.runtimeRevision || 0;
  state.runtimeOwnerId = typeof snapshot.runtimeOwnerId === 'string' ? snapshot.runtimeOwnerId : state.runtimeOwnerId;
  state.runtimeOwnerLastSeenAt = Number(snapshot.runtimeOwnerLastSeenAt) || 0;

  const incomingPlayers = snapshot.players || {};
  for (const slot of [1, 2] as const) {
    const incoming = incomingPlayers[slot] || incomingPlayers[String(slot)] || snapshot[`player${slot}`];
    const current = state.players[slot];
    if (!incoming || !current) continue;
    current.id = incoming.id || current.id;
    current.name = incoming.name || current.name;
    if (Array.isArray(incoming.starmons)) {
      current.starmons = incoming.starmons.map((mon: any, index: number) => ({
        ...current.starmons[index],
        ...mon,
        ownerSlot: slot,
        index,
        hp: Number(mon.hp ?? mon.currentHp ?? current.starmons[index]?.hp) || 0,
        currentHp: Number(mon.hp ?? mon.currentHp ?? current.starmons[index]?.hp) || 0,
        mana: Number(mon.mana ?? mon.currentMana ?? current.starmons[index]?.mana) || 0,
        currentMana: Number(mon.mana ?? mon.currentMana ?? current.starmons[index]?.mana) || 0,
      }));
    }
    if (Array.isArray(incoming.results)) current.results = [...incoming.results];
    current.hasSubmittedAnswer = Boolean(incoming.hasSubmittedAnswer);
    current.answeredCount = Number(incoming.answeredCount) || 0;
  }
  state.player1 = state.players[1];
  state.player2 = state.players[2];
  const normalizedBoard = normalizePvpBoard(snapshot.board);
  if (normalizedBoard) state.board = normalizedBoard;
  if (state.sharedBoard) {
    state.sharedBoard.seed = state.seed;
    state.sharedBoard.grid = state.board || state.sharedBoard.grid;
    state.sharedBoard.starmons = { 1: state.players[1].starmons, 2: state.players[2].starmons };
    state.sharedBoard.version = state.boardVersion;
  }

  if (state.runtimeOwnerId !== PVP_SERVER_INSTANCE_ID) {
    if (state.phaseTimerHandle) clearTimeout(state.phaseTimerHandle);
    if (state.stepTimerHandle) clearTimeout(state.stepTimerHandle);
    state.phaseTimerHandle = null;
    state.stepTimerHandle = null;
  } else if (previousPhase !== state.phase || !state.phaseTimerHandle) {
    schedulePhaseEnd(state, state.roomCode);
  }
}

const pvpSnapshotWrites = new Map<string, Promise<void>>();
const pvpRuntimeLeaseRefreshAt = new Map<string, number>();
let pvpRealtimeBusReady = false;
const pvpRealtimeBus = serverSupabase?.channel('starmon-pvp-runtime', { config: { private: true } });

function stopPvpRuntime(roomCodeInput: string) {
  const roomCode = normalizeRoomCode(roomCodeInput);
  const match = activeMatchStates.get(roomCode);
  if (match?.phaseTimerHandle) clearTimeout(match.phaseTimerHandle);
  if (match?.stepTimerHandle) clearTimeout(match.stepTimerHandle);
  if (match?.timerHandle) clearTimeout(match.timerHandle);
  if (match) {
    match.phaseTimerHandle = null;
    match.stepTimerHandle = null;
    match.timerHandle = null;
  }
  activeMatchStates.delete(roomCode);
  pvpRuntimeLeaseRefreshAt.delete(roomCode);
}

function applyRemotePvpRuntimeEnvelope(roomCodeInput: string, snapshot: any, event: any, origin: string) {
  const roomCode = normalizeRoomCode(roomCodeInput);
  const match = activeMatchStates.get(roomCode);
  if (!match || !snapshot) return;
  const remoteRevision = Number(snapshot.runtimeRevision) || 0;
  if (remoteRevision <= (match.runtimeRevision || 0)) return;
  applySerializedMatchState(match, snapshot);
  const boardSnapshot = serializeBoard(match);
  const syncEvent = {
    ...(event || {}),
    type: event?.type || 'board_full_sync',
    phase: match.phase,
    turn: match.turn,
    subPhase: match.subPhase,
    attackerSlot: match.attackerSlot,
    targetSlot: match.targetSlot,
    boardVersion: match.boardVersion,
    version: match.boardVersion,
    board: match.board,
    boardSnapshot,
    p1_hp: match.players[1].starmons.map(mon => mon.hp),
    p2_hp: match.players[2].starmons.map(mon => mon.hp),
    p1_mana: match.players[1].starmons.map(mon => mon.mana),
    p2_mana: match.players[2].starmons.map(mon => mon.mana),
  };
  broadcastToRoom(roomCode, syncEvent, undefined, false);
}

async function ensurePvpRuntimeOwner(match: PvpMatchState): Promise<boolean> {
  if (!serverSupabase) {
    if (!match.runtimeOwnerId) match.runtimeOwnerId = PVP_SERVER_INSTANCE_ID;
    match.runtimeOwnerLastSeenAt = Date.now();
    return match.runtimeOwnerId === PVP_SERVER_INSTANCE_ID;
  }

  const now = Date.now();
  const candidate = {
    ...serializeMatchState(match),
    runtimeOwnerId: PVP_SERVER_INSTANCE_ID,
    runtimeOwnerLastSeenAt: now,
    runtimeRevision: Math.max(1, match.runtimeRevision || 0),
  };
  const { data, error } = await serverSupabase.rpc('persist_pvp_runtime_state', {
    p_room_code: match.roomCode,
    p_instance_id: PVP_SERVER_INSTANCE_ID,
    p_candidate_state: candidate,
    p_now_ms: now,
    p_lease_ms: 12_000,
  });
  if (error || !data) {
    console.error(`[PvP] Could not claim shared match runtime (${match.roomCode}):`, error?.message || 'empty state');
    return false;
  }
  const persistedRevision = Number(data.runtimeRevision) || 0;
  const localRevision = Number(match.runtimeRevision) || 0;
  if (data.runtimeOwnerId !== PVP_SERVER_INSTANCE_ID || persistedRevision >= localRevision) {
    applySerializedMatchState(match, data);
  }
  return match.runtimeOwnerId === PVP_SERVER_INSTANCE_ID;
}

function forwardPvpActionToRuntimeOwner(roomCode: string, playerSlot: 1 | 2, data: any) {
  if (!pvpRealtimeBusReady || !pvpRealtimeBus) return false;
  void pvpRealtimeBus.send({
    type: 'broadcast',
    event: 'match_command',
    payload: { roomCode, ownerId: activeMatchStates.get(roomCode)?.runtimeOwnerId, playerSlot, data },
  }).then((status: string) => {
    if (status !== 'ok') console.warn(`[PvP] Could not forward battle action (${roomCode}):`, status);
  }).catch(error => console.warn(`[PvP] Could not forward battle action (${roomCode}):`, error));
  return true;
}

function publishPvpRuntimeState(roomCode: string, event: any, match: PvpMatchState) {
  if (match.runtimeOwnerId !== PVP_SERVER_INSTANCE_ID) return;
  match.runtimeRevision = (match.runtimeRevision || 0) + 1;
  match.runtimeOwnerLastSeenAt = Date.now();
  const snapshot = serializeMatchState(match);
  const envelope = { origin: PVP_SERVER_INSTANCE_ID, roomCode, event, snapshot };

  if (serverSupabase) {
    const previousWrite = pvpSnapshotWrites.get(roomCode) || Promise.resolve();
    const write = previousWrite.catch(() => undefined).then(async () => {
      const { data, error } = await serverSupabase.rpc('persist_pvp_runtime_state', {
        p_room_code: roomCode,
        p_instance_id: PVP_SERVER_INSTANCE_ID,
        p_candidate_state: snapshot,
        p_now_ms: Date.now(),
        p_lease_ms: 12_000,
      });
      if (error || !data) {
        console.warn(`[PvP] Could not persist shared match state (${roomCode}):`, error?.message || 'empty state');
        return;
      }
      if (data.runtimeOwnerId !== PVP_SERVER_INSTANCE_ID) {
        applySerializedMatchState(match, data);
        const boardSnapshot = serializeBoard(match);
        broadcastToRoom(roomCode, {
          type: 'board_full_sync',
          phase: match.phase,
          turn: match.turn,
          subPhase: match.subPhase,
          attackerSlot: match.attackerSlot,
          targetSlot: match.targetSlot,
          boardVersion: match.boardVersion,
          version: match.boardVersion,
          board: match.board,
          boardSnapshot,
          p1_hp: match.players[1].starmons.map(mon => mon.hp),
          p2_hp: match.players[2].starmons.map(mon => mon.hp),
          p1_mana: match.players[1].starmons.map(mon => mon.mana),
          p2_mana: match.players[2].starmons.map(mon => mon.mana),
        }, undefined, false);
        return;
      }
      const persistedRevision = Number(data.runtimeRevision) || 0;
      if (persistedRevision < (Number(match.runtimeRevision) || 0)) return;
      applySerializedMatchState(match, data);
      if (persistedRevision < (Number(match.runtimeRevision) || 0)) return;
      const persistedEnvelope = { origin: PVP_SERVER_INSTANCE_ID, roomCode, event, snapshot: data };
      if (pvpRealtimeBusReady && pvpRealtimeBus) {
        const status = await pvpRealtimeBus.send({ type: 'broadcast', event: 'match_state', payload: persistedEnvelope });
        if (status !== 'ok') console.warn(`[PvP] Cross-instance state broadcast failed (${roomCode}):`, status);
      }
    });
    pvpSnapshotWrites.set(roomCode, write);
    void write.catch(error => {
      console.warn(`[PvP] Could not persist shared match state (${roomCode}):`, error);
    }).finally(() => {
      if (pvpSnapshotWrites.get(roomCode) === write) pvpSnapshotWrites.delete(roomCode);
    });
  }

  if (!serverSupabase && pvpRealtimeBusReady && pvpRealtimeBus) {
    void pvpRealtimeBus.send({ type: 'broadcast', event: 'match_state', payload: envelope })
      .then((status: string) => {
        if (status !== 'ok') console.warn(`[PvP] Cross-instance state broadcast failed (${roomCode}):`, status);
      })
      .catch((error: unknown) => console.warn(`[PvP] Cross-instance state broadcast failed (${roomCode}):`, error));
  }
  setTimeout(() => {
    const latest = activeMatchStates.get(roomCode);
    if (latest === match && latest.runtimeOwnerId === PVP_SERVER_INSTANCE_ID && !latest.phaseTimerHandle) {
      schedulePhaseEnd(latest, roomCode);
    }
  }, 0);
}

if (pvpRealtimeBus) {
  pvpRealtimeBus
    .on('broadcast', { event: 'match_command' }, ({ payload }) => {
      if (!payload?.roomCode || payload.ownerId !== PVP_SERVER_INSTANCE_ID) return;
      const roomCode = normalizeRoomCode(payload.roomCode);
      const match = activeMatchStates.get(roomCode);
      if (!match || match.runtimeOwnerId !== PVP_SERVER_INSTANCE_ID) return;
      const command = payload.data;
      const slot: 1 | 2 = payload.playerSlot === 2 ? 2 : 1;
      if (command?.commandType === 'player_joined') {
        const player = match.players[slot];
        if (command.id) player.id = String(command.id);
        if (command.name) player.name = String(command.name);
        if (Array.isArray(command.starmons) && command.starmons.length > 0 && match.turn === 1 &&
            match.subPhase === 1 && !player.hasSubmittedAnswer) {
          player.starmons = createDefaultStarmonsForSlot(slot, command.starmons);
          player.starmons.forEach((mon, index) => { mon.unlocked = Boolean(player.results[index]); });
        }
        if (match.sharedBoard) {
          match.sharedBoard.starmons[slot] = player.starmons;
        }
        const state = serializeMatchState(match);
        const syncEvent = { type: 'PVP_MATCH_STATE_SYNC', state, matchState: state };
        broadcastToRoom(roomCode, syncEvent);
        publishPvpRuntimeState(roomCode, syncEvent, match);
      } else if (command?.commandType === 'answer_submit' && Array.isArray(command.results)) {
        onAnswerSubmit(match, roomCode, slot, command.results, Boolean(command.isTimeout));
      } else if (command?.commandType === 'phase_sync_request') {
        const request = command.request || {};
        if (Date.now() >= match.phaseEndsAt) {
          advanceExpiredPhase(match, roomCode);
        } else if (
          request.phase !== match.phase ||
          ((request.battlePhase === 'phase1_quiz' || request.battlePhase === 'phase2_combat') &&
            request.battlePhase !== (match.subPhase === 1 ? 'phase1_quiz' : 'phase2_combat')) ||
          request.timerExpired === true ||
          request.step === null ||
          (typeof request.step === 'number' && request.step !== match.step)
        ) {
          if (!match.phaseTimerHandle) schedulePhaseEnd(match, roomCode);
          broadcastToRoom(roomCode, buildCurrentPhaseSyncPayload(match));
          if (match.subPhase === 2 || match.subPhase === 3) {
            if (match.step > 3) {
              signalCombatStepsComplete(match, roomCode);
            } else {
              broadcastToRoom(roomCode, buildCurrentStepSyncPayload(match));
            }
          }
        }
      } else if (command?.commandType === 'turn_end') {
        const { attackerSlot } = getAttackerAndTargetByPhase(match.phase);
        if (attackerSlot === slot && (match.subPhase === 2 || match.subPhase === 3) &&
            command.phase === match.phase && command.turn === match.turn &&
            command.step === match.step && command.starmonIndex === match.step - 1) {
          onStepTimeout(match, roomCode, slot, command.starmonIndex);
        }
      } else if (command?.commandType === 'match_end') {
        const winner = match.players[slot];
        const loser = match.players[slot === 1 ? 2 : 1];
        if (winner.starmons.some(mon => mon.hp > 0) && !loser.starmons.some(mon => mon.hp > 0)) {
          endGame(match, roomCode, 'winner', slot);
        }
      } else if (command?.commandType === 'resync_request') {
        broadcastToRoom(roomCode, {
          type: 'board_full_sync',
          phase: match.phase,
          turn: match.turn,
          subPhase: match.subPhase,
          step: match.step,
          attackerSlot: match.attackerSlot,
          targetSlot: match.targetSlot,
          boardVersion: match.boardVersion,
          version: match.boardVersion,
          board: match.board,
          boardSnapshot: serializeBoard(match),
          p1_hp: match.players[1].starmons.map(mon => mon.hp),
          p2_hp: match.players[2].starmons.map(mon => mon.hp),
          p1_mana: match.players[1].starmons.map(mon => mon.mana),
          p2_mana: match.players[2].starmons.map(mon => mon.mana),
        });
      } else if (command && Number.isInteger(command.starmonIndex) && ['physical_attack', 'use_ability'].includes(command.actionType)) {
        onStarmonAction(match, roomCode, slot, command, undefined);
      }
    })
    .on('broadcast', { event: 'match_state' }, ({ payload }) => {
      if (!payload || payload.origin === PVP_SERVER_INSTANCE_ID || typeof payload.roomCode !== 'string') return;
      const match = activeMatchStates.get(normalizeRoomCode(payload.roomCode));
      if (!match) return;
      if (payload.heartbeat) {
        if (match.runtimeOwnerId === payload.origin) match.runtimeOwnerLastSeenAt = Date.now();
        return;
      }
      applyRemotePvpRuntimeEnvelope(payload.roomCode, payload.snapshot, payload.event, payload.origin);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pvp_rooms' }, ({ new: row }) => {
      if (row?.room_code && row.status !== 'IN_GAME') {
        stopPvpRuntime(row.room_code);
        return;
      }
      const snapshot = row?.match_state;
      const origin = String(snapshot?.runtimeOwnerId || '');
      if (!row?.room_code || !snapshot || origin === PVP_SERVER_INSTANCE_ID) return;
      const match = activeMatchStates.get(normalizeRoomCode(row.room_code));
      if (match && origin === match.runtimeOwnerId) match.runtimeOwnerLastSeenAt = Date.now();
      applyRemotePvpRuntimeEnvelope(row.room_code, snapshot, { type: 'board_full_sync' }, origin);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pvp_rooms' }, ({ old: row }) => {
      if (row?.room_code) stopPvpRuntime(row.room_code);
    })
    .subscribe((status: string) => {
      pvpRealtimeBusReady = status === 'SUBSCRIBED';
      if (status !== 'SUBSCRIBED') console.warn('[PvP] Shared Realtime bus status:', status);
    });
}

const pvpRuntimeHeartbeat = setInterval(() => {
  const now = Date.now();
  for (const [roomCode, match] of activeMatchStates) {
    if (match.runtimeOwnerId === PVP_SERVER_INSTANCE_ID) {
      match.runtimeOwnerLastSeenAt = now;
      if (serverSupabase && now - (pvpRuntimeLeaseRefreshAt.get(roomCode) || 0) >= 5_000) {
        pvpRuntimeLeaseRefreshAt.set(roomCode, now);
        void ensurePvpRuntimeOwner(match);
      }
      if (pvpRealtimeBusReady && pvpRealtimeBus) {
        void pvpRealtimeBus.send({
          type: 'broadcast',
          event: 'match_state',
          payload: { origin: PVP_SERVER_INSTANCE_ID, roomCode, heartbeat: true },
        }).catch(error => console.warn(`[PvP] Runtime heartbeat failed (${roomCode}):`, error));
      }
    } else if (now - (match.runtimeOwnerLastSeenAt || 0) > 12_000) {
      void ensurePvpRuntimeOwner(match).then(ownsRuntime => {
        if (!ownsRuntime) return;
        pvpRuntimeLeaseRefreshAt.set(roomCode, Date.now());
        schedulePhaseEnd(match, roomCode);
        publishPvpRuntimeState(roomCode, { type: 'board_full_sync' }, match);
        console.warn(`[PvP] Took over stale match runtime (${roomCode})`);
      });
    }
  }
}, 2_000);
pvpRuntimeHeartbeat.unref?.();

function aliveStarmonIndices(player: PlayerSlotState): number[] {
  return player.starmons
    .filter(s => s.hp > 0)
    .map(s => s.index);
}

function createDefaultStarmonsForSlot(slot: 1 | 2, inputStarmons?: any[]): StarmonCombatant[] {
  const defaultSeeds = ['voltlynx', 'ignisaur', 'aquanymph'];
  const defaultNames = ['Voltlynx', 'Ignisaur', 'Aquanymph'];
  const defaultElements = ['Electric', 'Fire', 'Water'];

  const sourceList = Array.isArray(inputStarmons) && inputStarmons.length > 0
    ? inputStarmons.slice(0, 3)
    : [0, 1, 2].map(i => ({
        id: defaultSeeds[i],
        name: defaultNames[i],
        element: defaultElements[i],
        level: 1,
        maxHp: 450,
        baseAtk: 45,
        def: 20,
        avatarSeed: defaultSeeds[i],
      }));

  return sourceList.map((input, idx) => {
    const maxHp = input?.maxHp || 450;
    const hp = input?.currentHp ?? input?.hp ?? maxHp;
    return {
      index: idx,
      ownerSlot: slot,
      id: input?.id || defaultSeeds[idx] || `starmon_${slot}_${idx}`,
      name: input?.name || defaultNames[idx] || `Starmon ${idx + 1}`,
      element: input?.element || defaultElements[idx] || 'Fire',
      level: input?.level || 1,
      maxHp,
      hp,
      currentHp: hp,
      alive: hp > 0,
      unlocked: true,
      baseAtk: input?.baseAtk || 45,
      baseDef: input?.battleBaseDef || input?.def || 20,
      secondaryElement: input?.secondaryElement,
      def: input?.def || 20,
      battleShieldPoints: 0,
      battleTauntTurns: 0,
      battleDamageReduction: 0,
      battleDamageReductionTurns: 0,
      battleDefenseBuffAmount: 0,
      battleDefenseBuffTurns: 0,
      berryReserveUsed: false,
      mana: typeof input?.currentMana === 'number' ? input.currentMana : (slot === 1 ? 0 : 20),
      currentMana: typeof input?.currentMana === 'number' ? input.currentMana : (slot === 1 ? 0 : 20),
      avatarSeed: input?.avatarSeed || input?.id || defaultSeeds[idx],
      skill1: input?.skill1 || {
        id: 'skill1',
        name: 'Strike',
        manaCost: 20,
        damageMultiplier: 1.5,
        targetType: 'single',
      },
      skill2: input?.skill2 || {
        id: 'skill2',
        name: 'Ultimate Burst',
        manaCost: 50,
        damageMultiplier: 2.1,
        targetType: 'aoe',
      },
    };
  });
}

// Công thức xác định Attacker / Target theo Phase (n.2 hoặc n.3)
export function getAttackerAndTargetByPhase(phaseString: string): {
  turn: number;
  subPhase: number;
  attackerSlot: 1 | 2 | null;
  targetSlot: 1 | 2 | null;
} {
  const parts = (phaseString || '1.1').split('.');
  const turn = parseInt(parts[0], 10) || 1;
  const subPhase = parseInt(parts[1], 10) || 1;
  if (subPhase === 2 || subPhase === 3) {
    const attackerSlot = (subPhase - 1) as 1 | 2; // n.2 -> 1, n.3 -> 2
    const targetSlot = (3 - attackerSlot) as 1 | 2; // 1 <-> 2
    return { turn, subPhase, attackerSlot, targetSlot };
  }
  return { turn, subPhase, attackerSlot: null, targetSlot: null };
}

function initializeMatchForRoom(room: PvpRoom): PvpMatchState {
  const code = normalizeRoomCode(room.room_code || room.code);
  const p1 = room.players.find(p => p.isHost) || room.players[0];
  const p2 = room.players.find(p => !p.isHost) || room.players[1];
  const seed = computeSeedFromRoomCode(code);
  const board = generateBoardFromSeed(seed);

  const player1State: PlayerSlotState = {
    id: p1?.id || room.host_id || 'host_player',
    name: p1?.name || room.hostName || 'Player 1',
    slot: 1,
    starmons: createDefaultStarmonsForSlot(1, p1?.starmons),
    results: [null, null, null],
    hasSubmittedAnswer: false,
    answeredCount: 0,
  };

  const player2State: PlayerSlotState = {
    id: p2?.id || 'guest_player',
    name: p2?.name || room.guestName || 'Player 2',
    slot: 2,
    starmons: createDefaultStarmonsForSlot(2, p2?.starmons),
    results: [null, null, null],
    hasSubmittedAnswer: false,
    answeredCount: 0,
  };

  const state: PvpMatchState = {
    roomCode: code,
    turn: 1,
    roundNumber: 1,
    phase: '1.1',
    subPhase: 1,
    step: 1,
    actionCommittedStep: 0,
    attackerSlot: null,
    targetSlot: null,
    players: {
      1: player1State,
      2: player2State,
    },
    player1: player1State,
    player2: player2State,
    attackQueue: [],
    phaseStartedAt: Date.now(),
    phaseEndsAt: Date.now() + PHASE_DURATION[1],
    phaseTimerHandle: null,
    seed,
    boardVersion: 1,
    runtimeRevision: 1,
    runtimeOwnerId: null,
    runtimeOwnerLastSeenAt: Date.now(),
    board,
  };

  initializeSharedBoard(state, seed);
  activeMatchStates.set(code, state);
  return state;
}

// =========================================================
// 1. BẢNG THỜI GIAN CỐ ĐỊNH & SERVER ĐỒNG HỒ TUYỆT ĐỐI
// Phase 1 (Answer)   : 120s trả lời + tối đa 15s đồng bộ kết quả.
// Phase 2/3 (Attack): tối đa 30s; kết thúc sớm khi cả 3 Starmon đã được xử lý.
// Phase end remains server-authoritative at phaseEndsAt.
// =========================================================
const ANSWER_DURATION_MS = 120_000;
const ANSWER_ANALYSIS_BUFFER_MS = 15_000;
const COMPLETED_COMBAT_PHASE_GRACE_MS = 500;
const PHASE_DURATION: Record<1 | 2 | 3, number> = {
  1: ANSWER_DURATION_MS + ANSWER_ANALYSIS_BUFFER_MS,
  2: 30_000,  // 30s cho Phase 2 (P1 attack)
  3: 30_000,  // 30s cho Phase 3 (P2 attack)
};

function schedulePhaseEnd(state: PvpMatchState, roomCode: string) {
  if (state.phaseTimerHandle) {
    clearTimeout(state.phaseTimerHandle);
    state.phaseTimerHandle = null;
  }
  const expectedPhase = state.phase;
  const expectedPhaseEndsAt = state.phaseEndsAt;
  const generation = (state.phaseTimerGeneration || 0) + 1;
  state.phaseTimerGeneration = generation;
  const delay = Math.max(0, state.phaseEndsAt - Date.now());
  if (delay <= 0) {
    handlePhaseEnd(state, roomCode, expectedPhase, expectedPhaseEndsAt, generation);
    return;
  }
  state.phaseTimerHandle = setTimeout(() => {
    handlePhaseEnd(state, roomCode, expectedPhase, expectedPhaseEndsAt, generation);
  }, delay);
}

function signalCombatStepsComplete(state: PvpMatchState, roomCode: string): boolean {
  if (state.finished || state.pendingNextTurnAt || state.step <= 3 || (state.subPhase !== 2 && state.subPhase !== 3)) {
    return false;
  }

  const now = Date.now();
  if (state.phaseEndsAt - now > COMPLETED_COMBAT_PHASE_GRACE_MS) {
    state.phaseEndsAt = now + COMPLETED_COMBAT_PHASE_GRACE_MS;
    state.lastEndedPhase = undefined;
    schedulePhaseEnd(state, roomCode);
  }

  broadcastToRoom(roomCode, {
    type: 'all_starmons_done',
    phase: state.phase,
    turn: state.turn,
    subPhase: state.subPhase,
    step: state.step,
    phaseEndsAt: state.phaseEndsAt,
    serverTime: now,
    time_limit: Math.max(0, Math.ceil((state.phaseEndsAt - now) / 1000)),
  });
  return true;
}

function handlePhaseEnd(
  state: PvpMatchState,
  roomCode: string,
  expectedPhase: string,
  expectedPhaseEndsAt: number,
  generation: number
) {
  if (activeMatchStates.get(normalizeRoomCode(roomCode)) !== state) return;
  if (state.finished) return;
  // A cleared timer can already be queued in the event loop. Ignore it if a later
  // phase has replaced it, so an old n.2 timeout cannot consume n.3 (or later rounds).
  if (
    state.phase !== expectedPhase ||
    state.phaseEndsAt !== expectedPhaseEndsAt ||
    state.phaseTimerGeneration !== generation ||
    state.lastEndedPhase === expectedPhase
  ) return;

  // Keep the server clock authoritative if the runtime wakes a timer early.
  if (Date.now() < expectedPhaseEndsAt) {
    state.phaseTimerHandle = setTimeout(() => {
      handlePhaseEnd(state, roomCode, expectedPhase, expectedPhaseEndsAt, generation);
    }, expectedPhaseEndsAt - Date.now());
    return;
  }
  state.lastEndedPhase = expectedPhase;
  if (state.phaseTimerHandle) {
    clearTimeout(state.phaseTimerHandle);
    state.phaseTimerHandle = null;
  }
  if (state.stepTimerHandle) {
    clearTimeout(state.stepTimerHandle);
    state.stepTimerHandle = null;
  }

  // Phase 1 kết thúc -> Đánh dấu sai cho các câu chưa trả lời
  if (state.subPhase === 1) {
    for (const slot of [1, 2] as const) {
      const p = state.players[slot];
      p.starmons.forEach((s, idx) => {
        if (p.results[idx] == null) {
          p.results[idx] = false;
          s.unlocked = false;
        }
      });
      p.hasSubmittedAnswer = true;
    }
  }

  // Broadcast phase_ended cho CẢ 2
  broadcastToRoom(roomCode, {
    type: 'phase_ended',
    phase: state.phase,
    turn: state.turn,
    subPhase: state.subPhase,
    phaseEndsAt: state.phaseEndsAt,
    serverTime: Date.now(),
  });

  if (state.subPhase === 1) {
    try {
      startPhase(state, roomCode, 2);
    } catch (error) {
      console.error(`[PvP] Failed to start phase ${state.turn}.2 for room ${roomCode}`, error);
      retryFailedPhaseTransition(state, roomCode, expectedPhase, expectedPhaseEndsAt, generation);
    }
  } else if (state.subPhase === 2) {
    try {
      startPhase(state, roomCode, 3);
    } catch (error) {
      console.error(`[PvP] Failed to start phase ${state.turn}.3 for room ${roomCode}`, error);
      retryFailedPhaseTransition(state, roomCode, expectedPhase, expectedPhaseEndsAt, generation);
    }
  } else if (state.subPhase === 3) {
    try {
      checkWinAndContinue(state, roomCode);
    } catch (error) {
      console.error(`[PvP] Failed to continue after phase ${expectedPhase} in room ${roomCode}`, error);
      retryFailedPhaseTransition(state, roomCode, expectedPhase, expectedPhaseEndsAt, generation);
    }
  }
}

function retryFailedPhaseTransition(
  state: PvpMatchState,
  roomCode: string,
  expectedPhase: string,
  expectedPhaseEndsAt: number,
  generation: number,
) {
  // Retry only if transition setup failed before changing the authoritative
  // phase. The delay prevents a persistent setup error from recursing inline.
  if (
    activeMatchStates.get(normalizeRoomCode(roomCode)) !== state ||
    state.phase !== expectedPhase ||
    state.phaseEndsAt !== expectedPhaseEndsAt ||
    state.phaseTimerGeneration !== generation
  ) return;

  state.lastEndedPhase = undefined;
  if (state.phaseTimerHandle) clearTimeout(state.phaseTimerHandle);
  state.phaseTimerHandle = setTimeout(() => {
    if (
      activeMatchStates.get(normalizeRoomCode(roomCode)) !== state ||
      state.phase !== expectedPhase ||
      state.phaseEndsAt !== expectedPhaseEndsAt
    ) return;
    state.phaseTimerHandle = null;
    schedulePhaseEnd(state, roomCode);
  }, 1000);
}

function advanceExpiredPhase(state: PvpMatchState, roomCode: string): boolean {
  if (Date.now() < state.phaseEndsAt) return false;
  if (state.finished || state.pendingNextTurnAt) return true;
  // Recover if a previous owner persisted the end marker and stopped before
  // changing phase. Keep this shared by watchdog, timeout, and sync paths.
  if (state.lastEndedPhase === state.phase) {
    console.warn(`[PvP] Recovering stalled phase transition (${roomCode}, ${state.phase})`);
    state.lastEndedPhase = undefined;
    if (state.phaseTimerHandle) clearTimeout(state.phaseTimerHandle);
    state.phaseTimerHandle = null;
    state.phaseTimerGeneration = (state.phaseTimerGeneration || 0) + 1;
  }
  handlePhaseEnd(
    state,
    roomCode,
    state.phase,
    state.phaseEndsAt,
    state.phaseTimerGeneration || 0
  );
  return true;
}

function advanceIfPhaseExpired(state: PvpMatchState, roomCode: string): boolean {
  return advanceExpiredPhase(state, roomCode);
}

// Recover a missed timeout callback and ensure an expired phase always advances.
const phaseDeadlineWatchdog = setInterval(() => {
  const now = Date.now();
  for (const [roomCode, state] of activeMatchStates) {
    if (state.finished) continue;
    if (state.runtimeOwnerId && state.runtimeOwnerId !== PVP_SERVER_INSTANCE_ID) continue;
    if (state.pendingNextTurnAt && now >= state.pendingNextTurnAt) {
      advanceToNextTurn(state, roomCode, state.phase, state.turn, state.pendingNextTurnAt);
      continue;
    }
    if (now >= state.phaseEndsAt) advanceExpiredPhase(state, roomCode);
  }
}, 1000);
phaseDeadlineWatchdog.unref?.();

function startTurn(state: PvpMatchState, roomCode: string, n: number) {
  for (const slot of [1, 2] as const) {
    for (const starmon of state.players[slot].starmons) {
      starmon.battleTauntTurns = Math.max(0, (starmon.battleTauntTurns || 0) - 1);
      if ((starmon.battleDamageReductionTurns || 0) > 0) {
        starmon.battleDamageReductionTurns = Math.max(0, (starmon.battleDamageReductionTurns || 0) - 1);
        if (starmon.battleDamageReductionTurns === 0) starmon.battleDamageReduction = 0;
      }
      if ((starmon.battleDefenseBuffTurns || 0) > 0) {
        starmon.battleDefenseBuffTurns = Math.max(0, (starmon.battleDefenseBuffTurns || 0) - 1);
        if (starmon.battleDefenseBuffTurns === 0) {
          starmon.def = Math.max(0, starmon.def - (starmon.battleDefenseBuffAmount || 0));
          starmon.battleDefenseBuffAmount = 0;
        }
      }
    }
  }
  state.turn = n;
  state.roundNumber = n;
  state.attackQueue = [];
  startPhase(state, roomCode, 1);
}

function startPhase(state: PvpMatchState, roomCode: string, subPhase: 1 | 2 | 3) {
  state.pendingNextTurnAt = undefined;
  state.lastEndedPhase = undefined;
  if (state.phaseTimerHandle) {
    clearTimeout(state.phaseTimerHandle);
    state.phaseTimerHandle = null;
  }
  if (state.stepTimerHandle) {
    clearTimeout(state.stepTimerHandle);
    state.stepTimerHandle = null;
  }

  state.subPhase = subPhase;
  state.phase = `${state.turn}.${subPhase}`;
  const now = Date.now();
  state.phaseStartedAt = now;
  state.phaseEndsAt = now + PHASE_DURATION[subPhase];

  if (subPhase === 1) {
    state.step = 1;
    state.attackerSlot = null;
    state.targetSlot = null;
    state.attackQueue = [];

    // Reset trạng thái câu trả lời đầu turn
    for (const slot of [1, 2] as const) {
      const p = state.players[slot];
      p.results = p.starmons.map(() => null);
      p.hasSubmittedAnswer = false;
      p.answeredCount = 0;
      p.starmons.forEach(s => {
        s.unlocked = false;
      });
    }
  } else {
    // subPhase 2 hoặc 3
    state.attackerSlot = (subPhase - 1) as 1 | 2; // 2 -> 1, 3 -> 2
    state.targetSlot = (3 - state.attackerSlot) as 1 | 2;
    state.step = 1;
    state.actionCommittedStep = 0;
  }

  // Hẹn giờ kết thúc phase — CHỈ 1 timer duy nhất
  schedulePhaseEnd(state, roomCode);

  const snapshot = serializeBoard(state);
  const p1Alive = aliveStarmonIndices(state.players[1]);
  const p2Alive = aliveStarmonIndices(state.players[2]);

  // Broadcast mốc thời gian cho CẢ 2 — cùng 1 payload
  const startPayload = {
    type: 'phase_start',
    phase: state.phase,
    turn: state.turn,
    round_number: state.turn,
    roundNumber: state.turn,
    subPhase: state.subPhase,
    attackerSlot: state.attackerSlot,
    targetSlot: state.targetSlot,
    phaseStartedAt: state.phaseStartedAt,
    phaseEndsAt: state.phaseEndsAt, // Mốc tuyệt đối
    serverTime: now, // để client tính clockOffset
    // Keep the quiz at 120 seconds and reserve the final 15 seconds for server
    // evaluation, persistence, and synchronizing both players' answer results.
    time_limit: subPhase === 1
      ? Math.ceil(ANSWER_DURATION_MS / 1000)
      : Math.ceil(PHASE_DURATION[subPhase] / 1000),
    analysis_buffer: subPhase === 1 ? Math.ceil(ANSWER_ANALYSIS_BUFFER_MS / 1000) : 0,
    boardSnapshot: snapshot,
    grid: state.board,
    board: state.board,
    boardVersion: state.boardVersion,
    version: state.boardVersion,
    seed: state.seed,
    p1_hp: state.players[1].starmons.map(s => s.hp),
    p2_hp: state.players[2].starmons.map(s => s.hp),
    p1_mana: state.players[1].starmons.map(s => s.mana),
    p2_mana: state.players[2].starmons.map(s => s.mana),
  };

  broadcastToRoom(roomCode, startPayload);
  broadcastToRoom(roomCode, { ...startPayload, type: 'phase_changed' });

  if (subPhase === 1) {
    broadcastToRoom(roomCode, {
      ...startPayload,
      type: 'PVP_PHASE_START_ANSWER',
      p1_alive_count: p1Alive.length,
      p1_alive_indices: p1Alive,
      p2_alive_count: p2Alive.length,
      p2_alive_indices: p2Alive,
      start_time: now,
    });
  } else {
    runStep(state, roomCode);
  }
}

function buildCurrentPhaseSyncPayload(state: PvpMatchState) {
  const now = Date.now();
  const answerDeadline = state.phaseStartedAt + ANSWER_DURATION_MS;
  const deadline = state.subPhase === 1 ? answerDeadline : state.phaseEndsAt;
  return {
    type: 'phase_changed',
    phase: state.phase,
    turn: state.turn,
    round_number: state.turn,
    subPhase: state.subPhase,
    step: state.step,
    attackerSlot: state.attackerSlot,
    targetSlot: state.targetSlot,
    phaseStartedAt: state.phaseStartedAt,
    phaseEndsAt: state.phaseEndsAt,
    serverTime: now,
    time_limit: Math.max(1, Math.ceil((deadline - now) / 1000)),
    analysis_buffer: state.subPhase === 1 ? Math.ceil(Math.max(0, state.phaseEndsAt - answerDeadline) / 1000) : 0,
    p1_alive_count: aliveStarmonIndices(state.players[1]).length,
    p1_alive_indices: aliveStarmonIndices(state.players[1]),
    p2_alive_count: aliveStarmonIndices(state.players[2]).length,
    p2_alive_indices: aliveStarmonIndices(state.players[2]),
    board: state.board,
    boardSnapshot: serializeBoard(state),
    boardVersion: state.boardVersion,
    version: state.boardVersion,
    p1_hp: state.players[1].starmons.map(mon => mon.hp),
    p2_hp: state.players[2].starmons.map(mon => mon.hp),
    p1_mana: state.players[1].starmons.map(mon => mon.mana),
    p2_mana: state.players[2].starmons.map(mon => mon.mana),
  };
}

function buildCurrentStepSyncPayload(state: PvpMatchState) {
  const attackerSlot = state.attackerSlot || ((state.subPhase - 1) as 1 | 2);
  const targetSlot = state.targetSlot || ((3 - attackerSlot) as 1 | 2);
  const starmonIndex = Math.max(0, Math.min(2, state.step - 1));
  const attacker = state.players[attackerSlot];
  const starmon = attacker.starmons[starmonIndex];
  const now = Date.now();
  return {
    type: 'step_started',
    phase: state.phase,
    turn: state.turn,
    subPhase: state.subPhase,
    step: state.step,
    attackerSlot,
    targetSlot,
    starmonIndex,
    starmon_name: starmon?.name,
    actor_name: attacker.name,
    validTargetIndices: aliveStarmonIndices(state.players[targetSlot]),
    options: ['physical_attack', 'use_ability'],
    phaseEndsAt: state.phaseEndsAt,
    serverTime: now,
    time_limit: Math.max(1, Math.ceil((state.phaseEndsAt - now) / 1000)),
    board: state.board,
    boardSnapshot: serializeBoard(state),
    boardVersion: state.boardVersion,
    version: state.boardVersion,
    p1_hp: state.players[1].starmons.map(mon => mon.hp),
    p2_hp: state.players[2].starmons.map(mon => mon.hp),
    p1_mana: state.players[1].starmons.map(mon => mon.mana),
    p2_mana: state.players[2].starmons.map(mon => mon.mana),
  };
}

// Đồng bộ trạng thái Phase hiện tại cho 1 socket cụ thể mà không làm gián đoạn client kia
function sendCurrentCombatPhaseToSocket(state: PvpMatchState, ws: WebSocket, mySlot?: 1 | 2) {
  if (ws.readyState !== WebSocket.OPEN) return;
  const attackerSlot: 1 | 2 = state.attackerSlot || ((state.subPhase - 1) as 1 | 2);
  const targetSlot: 1 | 2 = state.targetSlot || ((3 - attackerSlot) as 1 | 2);
  const starmonIndex = Math.max(0, Math.min(2, (state.step || 1) - 1));
  const attacker = state.players[attackerSlot];
  const starmon = attacker?.starmons[starmonIndex];
  const snapshot = serializeBoard(state);
  const now = Date.now();
  const deadline = state.subPhase === 1 ? state.phaseStartedAt + ANSWER_DURATION_MS : state.phaseEndsAt;
  const remainingSec = Math.max(1, Math.ceil((deadline - now) / 1000));

  try {
    ws.send(JSON.stringify({
      type: 'phase_start',
      phase: state.phase,
      turn: state.turn,
      subPhase: state.subPhase,
      attackerSlot: state.subPhase === 1 ? null : attackerSlot,
      targetSlot: state.subPhase === 1 ? null : targetSlot,
      phaseStartedAt: state.phaseStartedAt,
      phaseEndsAt: state.phaseEndsAt,
      serverTime: now,
      time_limit: remainingSec,
      analysis_buffer: state.subPhase === 1 ? Math.ceil(Math.max(0, state.phaseEndsAt - deadline) / 1000) : 0,
      p1_alive_count: aliveStarmonIndices(state.players[1]).length,
      p1_alive_indices: aliveStarmonIndices(state.players[1]),
      p2_alive_count: aliveStarmonIndices(state.players[2]).length,
      p2_alive_indices: aliveStarmonIndices(state.players[2]),
      board: state.board,
      boardSnapshot: snapshot,
      boardVersion: state.boardVersion,
      version: state.boardVersion,
      p1_hp: state.players[1].starmons.map(s => s.hp),
      p2_hp: state.players[2].starmons.map(s => s.hp),
      p1_mana: state.players[1].starmons.map(s => s.mana),
      p2_mana: state.players[2].starmons.map(s => s.mana),
    }));

    if (state.subPhase >= 2 && state.step > 3) {
      signalCombatStepsComplete(state, state.roomCode);
    } else if (state.subPhase >= 2) {
      ws.send(JSON.stringify({
        type: 'step_started',
        phase: state.phase,
        turn: state.turn,
        subPhase: state.subPhase,
        step: state.step,
        attackerSlot,
        targetSlot,
        starmonIndex,
        starmon_name: starmon?.name,
        actor_name: attacker?.name,
        phaseEndsAt: state.phaseEndsAt,
        serverTime: now,
        time_limit: remainingSec,
        boardVersion: state.boardVersion,
        version: state.boardVersion,
        boardSnapshot: snapshot,
        board: state.board,
        p1_hp: state.players[1].starmons.map(s => s.hp),
        p2_hp: state.players[2].starmons.map(s => s.hp),
        p1_mana: state.players[1].starmons.map(s => s.mana),
        p2_mana: state.players[2].starmons.map(s => s.mana),
      }));

      if (
        starmon &&
        starmon.alive &&
        starmon.hp > 0 &&
        attacker.results[starmonIndex] === true &&
        (!mySlot || mySlot === attackerSlot)
      ) {
        ws.send(JSON.stringify({
          type: 'your_starmon_turn',
          phase: state.phase,
          turn: state.turn,
          subPhase: state.subPhase,
          step: state.step,
          attackerSlot,
          targetSlot,
          starmonIndex,
          starmon_name: starmon.name,
          actor_name: attacker.name,
          validTargetIndices: aliveStarmonIndices(state.players[targetSlot]),
          options: ['physical_attack', 'use_ability'],
          phaseEndsAt: state.phaseEndsAt,
          serverTime: now,
          time_limit: remainingSec,
          board: state.board,
          boardSnapshot: snapshot,
          boardVersion: state.boardVersion,
          version: state.boardVersion,
          p1_hp: state.players[1].starmons.map(s => s.hp),
          p2_hp: state.players[2].starmons.map(s => s.hp),
          p1_mana: state.players[1].starmons.map(s => s.mana),
          p2_mana: state.players[2].starmons.map(s => s.mana),
        }));
      }
    }
  } catch {}
}

// Nhận kết quả trả lời câu hỏi ở Phase n.1
function onAnswerSubmit(
  state: PvpMatchState,
  roomCode: string,
  slot: 1 | 2,
  results: boolean[],
  isTimeout: boolean = false,
  ws?: WebSocket
) {
  if (state.subPhase !== 1) {
    if (ws) {
      sendCurrentCombatPhaseToSocket(state, ws, slot);
    }
    return;
  }

  // Reject nếu phase đã kết thúc
  if (advanceIfPhaseExpired(state, roomCode)) {
    return;
  }

  const P = state.players[slot];
  if (!P) return;

  // Những câu chưa trả lời (undefined / false) sẽ bị tính là 0 điểm (unlocked = false)
  P.starmons.forEach((s, idx) => {
    if (s.hp > 0) {
      const unlocked = Array.isArray(results) && results[idx] !== undefined
        ? Boolean(results[idx])
        : Boolean(P.results[idx]);
      P.results[idx] = unlocked;
      s.unlocked = unlocked;
    } else {
      P.results[idx] = false;
      s.unlocked = false;
    }
  });

  P.hasSubmittedAnswer = true;
  P.answeredCount = aliveStarmonIndices(P).length;
  const allPlayersSubmitted = state.players[1].hasSubmittedAnswer && state.players[2].hasSubmittedAnswer;
  if (allPlayersSubmitted && state.phaseEndsAt - Date.now() > COMPLETED_COMBAT_PHASE_GRACE_MS) {
    state.phaseEndsAt = Date.now() + COMPLETED_COMBAT_PHASE_GRACE_MS;
    state.lastEndedPhase = undefined;
    schedulePhaseEnd(state, roomCode);
  }

  broadcastToRoom(roomCode, {
    type: 'PVP_ANSWER_SUBMITTED',
    phase: state.phase,
    turn: state.turn,
    slot,
    player_id: P.id,
    answered_count: P.answeredCount,
    results: P.results,
    phaseEndsAt: state.phaseEndsAt,
    all_submitted: allPlayersSubmitted,
  });

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'answer_all_done',
      phase: state.phase,
      phaseEndsAt: state.phaseEndsAt,
      serverTime: Date.now(),
      message: 'Bạn đã trả lời xong. Đang chờ đối thủ hoàn tất Phase 1...',
    }));
  }

  // Both authoritative answer submissions are ready, so the unused answer
  // timer can be skipped and the phase can end after a short sync grace.
}

// =========================================================
// 3. XỬ LÝ TỪNG STEP TRONG PHASE n.2 VÀ PHASE n.3
// Step không có timer riêng — chỉ dựa vào phase timer (30s)
// =========================================================
function countAlive(starmons: StarmonCombatant[]): number {
  return starmons.filter(s => s && s.hp > 0).length;
}

function runStep(state: PvpMatchState, roomCode: string) {
  if (activeMatchStates.get(normalizeRoomCode(roomCode)) !== state) return;
  if (state.stepTimerHandle) {
    clearTimeout(state.stepTimerHandle);
    state.stepTimerHandle = null;
  }

  // Nếu phase 30s đã kết thúc, nhường quyền cho handlePhaseEnd
  if (advanceIfPhaseExpired(state, roomCode)) return;

  const attackerSlot: 1 | 2 = state.attackerSlot || ((state.subPhase - 1) as 1 | 2);
  const targetSlot: 1 | 2 = state.targetSlot || ((3 - attackerSlot) as 1 | 2);
  state.attackerSlot = attackerSlot;
  state.targetSlot = targetSlot;

  const starmonIndex = state.step - 1; // 0, 1, 2
  const attacker = state.players[attackerSlot];
  const starmon = attacker?.starmons[starmonIndex];
  const snapshot = serializeBoard(state);

  // Case A: Starmon chết -> skip, sang step kế
  if (starmon == null || starmon.hp <= 0) {
    broadcastToRoom(roomCode, {
      type: 'step_skipped',
      phase: state.phase,
      attackerSlot: state.attackerSlot,
      starmonIndex: starmonIndex,
      starmon_name: starmon?.name || `Starmon #${starmonIndex + 1}`,
      reason: 'dead',
      phaseEndsAt: state.phaseEndsAt,
    });
    state.step++;
    if (state.step > 3) {
      signalCombatStepsComplete(state, roomCode);
      return;
    }
    return runStep(state, roomCode);
  }

  // Case B: Trả lời sai -> mất lượt, sang step kế
  if (attacker.results[starmonIndex] !== true) {
    broadcastToRoom(roomCode, {
      type: 'step_skipped',
      phase: state.phase,
      attackerSlot: state.attackerSlot,
      starmonIndex: starmonIndex,
      starmon_name: starmon.name,
      reason: 'wrong_answer',
      phaseEndsAt: state.phaseEndsAt,
    });
    broadcastToRoom(roomCode, {
      type: 'starmon_lost_turn',
      phase: state.phase,
      attackerSlot: state.attackerSlot,
      starmonIndex: starmonIndex,
      starmon_name: starmon.name,
      reason: 'wrong_answer',
    });
    state.step++;
    if (state.step > 3) {
      signalCombatStepsComplete(state, roomCode);
      return;
    }
    state.stepTimerHandle = setTimeout(() => {
      runStep(state, roomCode);
    }, 700);
    return;
  }

  // Case C: Được tấn công
  const remainingSec = Math.max(1, Math.ceil((state.phaseEndsAt - Date.now()) / 1000));

  broadcastToRoom(roomCode, {
    type: 'step_started',
    phase: state.phase,
    turn: state.turn,
    round_number: state.turn,
    roundNumber: state.turn,
    subPhase: state.subPhase,
    step: state.step,
    attackerSlot: state.attackerSlot,
    targetSlot: state.targetSlot,
    starmonIndex: starmonIndex,
    starmon_name: starmon?.name,
    actor_name: attacker?.name,
    boardVersion: state.boardVersion,
    version: state.boardVersion,
    boardSnapshot: snapshot,
    grid: state.board,
    board: state.board,
    p1_hp: state.players[1].starmons.map(s => s.hp),
    p2_hp: state.players[2].starmons.map(s => s.hp),
    p1_mana: state.players[1].starmons.map(s => s.mana),
    p2_mana: state.players[2].starmons.map(s => s.mana),
    phaseEndsAt: state.phaseEndsAt,
    serverTime: Date.now(),
    time_limit: remainingSec,
  });

  const validTargetIndices = aliveStarmonIndices(state.players[targetSlot]);
  const turnData = {
    type: 'your_starmon_turn',
    phase: state.phase,
    turn: state.turn,
    subPhase: state.subPhase,
    step: state.step,
    attackerSlot: state.attackerSlot,
    targetSlot: state.targetSlot,
    starmonIndex: starmonIndex,
    starmon_name: starmon.name,
    actor_name: attacker.name,
    validTargetIndices: validTargetIndices,
    options: ['physical_attack', 'use_ability'],
    phaseEndsAt: state.phaseEndsAt,
    serverTime: Date.now(),
    time_limit: remainingSec,
    board: state.board,
    grid: state.board,
    boardSnapshot: snapshot,
    boardVersion: state.boardVersion,
    version: state.boardVersion,
    p1_hp: state.players[1].starmons.map(s => s.hp),
    p2_hp: state.players[2].starmons.map(s => s.hp),
    p1_mana: state.players[1].starmons.map(s => s.mana),
    p2_mana: state.players[2].starmons.map(s => s.mana),
  };

  if (attacker.socket && attacker.socket.readyState === WebSocket.OPEN) {
    try {
      attacker.socket.send(JSON.stringify(turnData));
    } catch {
      broadcastToRoom(roomCode, turnData);
    }
  } else {
    broadcastToRoom(roomCode, turnData);
  }
}

function endStep(state: PvpMatchState, roomCode: string, _skipped: boolean = false) {
  if (state.stepTimerHandle) {
    clearTimeout(state.stepTimerHandle);
    state.stepTimerHandle = null;
  }

  if (advanceIfPhaseExpired(state, roomCode)) return;

  state.step += 1;
  if (state.step > 3) {
    signalCombatStepsComplete(state, roomCode);
    return;
  }

  runStep(state, roomCode);
}

function onStepTimeout(state: PvpMatchState, roomCode: string, playerSlot: 1 | 2, requestedStarmonIndex: number) {
  if (state.subPhase !== 2 && state.subPhase !== 3) return;
  const attackerSlot = state.attackerSlot || ((state.subPhase - 1) as 1 | 2);
  if (playerSlot !== attackerSlot || requestedStarmonIndex !== state.step - 1) return;

  // The client countdown and the server deadline can differ by a few milliseconds.
  // Once the authoritative deadline has passed, advance through the same guarded
  // phase-end path immediately instead of leaving the client at 0 waiting for the
  // independent timer callback. The phase/generation checks make this idempotent
  // if that callback is already queued.
  if (Date.now() >= state.phaseEndsAt) {
    const starmonIndex = Math.max(0, Math.min(2, (state.step || 1) - 1));
    const starmon = state.players[attackerSlot]?.starmons[starmonIndex];
    broadcastToRoom(roomCode, {
      type: 'starmon_lost_turn',
      phase: state.phase,
      attackerSlot,
      starmonIndex,
      starmon_name: starmon?.name,
      reason: 'timeout',
    });
    advanceExpiredPhase(state, roomCode);
    return;
  }

  // The step countdown may reach zero just before the phase deadline. Keep the
  // server's absolute deadline authoritative, but make sure its timer is armed.
  if (!state.phaseTimerHandle) schedulePhaseEnd(state, roomCode);
}

// =========================================================
// 4. XỬ LÝ HÀNH ĐỘNG CỦA ATTACKER (onStarmonAction)
// =========================================================
function getAbility(
  starmon: StarmonCombatant,
  abilityId: any,
  payload?: any
): { id: string; name: string; cost: number; damageMultiplier: number; targetType?: string } | null {
  const s1 = starmon.skill1;
  const s2 = starmon.skill2;

  if (
    abilityId === 1 ||
    abilityId === '1' ||
    abilityId === 'skill1' ||
    payload?.abilityNum === 1 ||
    (s1 && (abilityId === s1.id || abilityId === s1.name))
  ) {
    return {
      id: s1?.id || 'skill1',
      name: s1?.name || payload?.skillName || 'Skill 1',
      cost: typeof s1?.manaCost === 'number' ? s1.manaCost : (typeof payload?.manaCost === 'number' ? payload.manaCost : 20),
      damageMultiplier: typeof s1?.damageMultiplier === 'number' ? s1.damageMultiplier : 1.5,
      targetType: s1?.targetType || (payload?.isAoE ? 'aoe' : 'single'),
    };
  }

  if (
    abilityId === 2 ||
    abilityId === '2' ||
    abilityId === 'skill2' ||
    payload?.abilityNum === 2 ||
    (s2 && (abilityId === s2.id || abilityId === s2.name))
  ) {
    return {
      id: s2?.id || 'skill2',
      name: s2?.name || payload?.skillName || 'Skill 2',
      cost: typeof s2?.manaCost === 'number' ? s2.manaCost : (typeof payload?.manaCost === 'number' ? payload.manaCost : 50),
      damageMultiplier: typeof s2?.damageMultiplier === 'number' ? s2.damageMultiplier : 2.0,
      targetType: s2?.targetType || (payload?.isAoE ? 'aoe' : 'single'),
    };
  }

  if (abilityId || payload?.skillName) {
    return {
      id: String(abilityId || payload?.skillName),
      name: String(payload?.skillName || abilityId),
      cost: typeof payload?.manaCost === 'number' ? payload.manaCost : 20,
      damageMultiplier: 1.5,
      targetType: payload?.isAoE ? 'aoe' : 'single',
    };
  }

  return null;
}

function calcPhysicalDamage(
  starmon: StarmonCombatant,
  targetStarmon: StarmonCombatant,
  orbSwitches?: any[],
  payload?: any
): number {
  if (payload && typeof payload.damage === 'number' && payload.damage >= 0) {
    return payload.damage;
  }
  const matchCount = Array.isArray(orbSwitches) && orbSwitches.length >= 3
    ? orbSwitches.length
    : (payload?.matchCount || 3);
  const mult = matchCount === 3 ? 1.0 : matchCount === 4 ? 1.25 : 1.5;
  const baseAtk = starmon.baseAtk || 45;
  const def = targetStarmon?.def || 20;
  return Math.max(15, Math.floor(baseAtk * mult * 1.5 - def * 0.4));
}

function calcAbilityDamage(
  starmon: StarmonCombatant,
  ability: { id: string; name: string; cost: number; damageMultiplier: number; targetType?: string },
  _targetStarmonIndex?: number,
  payload?: any
): number {
  if (ability.id === 'shield_bash') {
    return Math.max(0, Math.round((starmon.def || starmon.baseDef || 0) * 0.5));
  }
  if (payload && typeof payload.damage === 'number' && payload.damage >= 0) {
    return payload.damage;
  }
  const baseAtk = starmon.baseAtk || 45;
  return Math.max(0, Math.round(baseAtk * (ability.damageMultiplier || 1.5)));
}

function onStarmonAction(
  state: PvpMatchState,
  roomCode: string,
  playerSlot: 1 | 2,
  data: { starmonIndex: number; actionType: string; payload: any },
  ws?: WebSocket
) {
  const reject = (reason: string) => {
    if (ws) {
      try { ws.send(JSON.stringify({ type: 'PVP_ACTION_REJECTED', reason })); } catch {}
    } else {
      broadcastToRoom(roomCode, { type: 'PVP_ACTION_REJECTED', reason });
    }
  };

  if (state.subPhase !== 2 && state.subPhase !== 3) {
    return reject('không phải phase tấn công');
  }

  if (Date.now() >= state.phaseEndsAt) {
    advanceIfPhaseExpired(state, roomCode);
    return reject('phase tấn công đã kết thúc');
  }

  const attackerSlot: 1 | 2 = state.attackerSlot || ((state.subPhase - 1) as 1 | 2);
  const targetSlot: 1 | 2 = state.targetSlot || ((3 - attackerSlot) as 1 | 2);
  state.attackerSlot = attackerSlot;
  state.targetSlot = targetSlot;

  const { starmonIndex, actionType, payload = {} } = data;

  // ---- Validate ----
  const expectedBoardVersion = payload.boardVersion;
  if (actionType === 'physical_attack' && !Number.isInteger(expectedBoardVersion)) {
    return reject('client chưa gửi phiên bản board; vui lòng tải lại trận đấu để đồng bộ');
  }
  if (Number.isInteger(expectedBoardVersion) && expectedBoardVersion !== state.boardVersion) {
    return reject('board đã thay đổi; đang đồng bộ trạng thái mới nhất');
  }
  const proposedBoard = actionType === 'physical_attack' ? normalizePvpBoard(payload.newBoard) : null;
  if (actionType === 'physical_attack' && Number.isInteger(expectedBoardVersion) && !proposedBoard) {
    return reject('board gửi lên không hợp lệ; đang đồng bộ trạng thái mới nhất');
  }

  if (playerSlot !== state.attackerSlot) {
    return reject('không phải lượt của bạn');
  }

  if (starmonIndex !== state.step - 1) {
    return reject('không phải starmon đang đến lượt');
  }

  if (state.actionCommittedStep === state.step) {
    return reject('starmon này đã hành động trong lượt hiện tại');
  }

  const attacker = state.players[state.attackerSlot];
  const starmon = attacker?.starmons[starmonIndex];

  if (starmon == null || starmon.hp <= 0) {
    return reject('starmon không hợp lệ');
  }

  if (attacker.results[starmonIndex] !== true) {
    return reject('starmon không được phép tấn công');
  }

  const target = state.players[state.targetSlot];
  const aliveTargets = aliveStarmonIndices(target);
  const ability = actionType === 'use_ability' ? getAbility(starmon, payload.abilityId, payload) : null;
  let targetIdx = typeof payload.targetStarmonIndex === 'number'
    ? payload.targetStarmonIndex
    : (aliveTargets[0] ?? 0);
  const taunterIndex = target.starmons.findIndex(s => s.hp > 0 && (s.battleTauntTurns || 0) > 0);
  if (ability?.targetType !== 'aoe' && !payload.isAoE && taunterIndex >= 0) targetIdx = taunterIndex;

  let damage = 0;

  // ---- Xử lý theo loại hành động ----
  if (actionType === 'physical_attack') {
    if (!aliveTargets.includes(targetIdx)) {
      return reject('target không hợp lệ');
    }
    damage = calcPhysicalDamage(starmon, target.starmons[targetIdx], payload.orbSwitches, payload);
  } else if (actionType === 'use_ability') {
    if (ability == null) {
      return reject('ability không tồn tại');
    }
    const currentMana = starmon.mana ?? starmon.currentMana ?? 0;
    if (currentMana < ability.cost && starmon.id !== 'tidecrush') {
      return reject('không đủ mana');
    }
    if (!aliveTargets.includes(targetIdx) && aliveTargets.length > 0) {
      targetIdx = aliveTargets[0];
    }
    payload.targetStarmonIndex = targetIdx;
    const isSupportAbility = ability.id === 'fluffy_hug' || ability.id === 'winged_fortress' || ability.id === 'antler_blessing';
    damage = isSupportAbility ? 0 : calcAbilityDamage(starmon, ability, targetIdx, payload);
  } else {
    return reject('action không hợp lệ');
  }

  const effectLines: string[] = [];
  const passiveEvents: Array<{ starmonName: string; passiveName: string; line: string }> = [];
  const damageElement = ability?.id === 'shield_bash' ? 'Steel' : (starmon.element || 'Physical');
  if (actionType === 'use_ability' && damage > 0 && !['fluffy_hug', 'winged_fortress', 'antler_blessing'].includes(ability?.id || '')) {
    effectLines.push(`Deals ${damage} ${damageElement} DMG`);
  }

  // Lock the step before mutating shared state; repeated or delayed client messages cannot apply damage twice.
  state.actionCommittedStep = state.step;

  const targetStarmon = target.starmons[targetIdx];

  // ---- Mutate shared board & starmon state (Single Source of Truth) & Broadcast board_update to BOTH clients ----
  mutateBoard(
    state,
    roomCode,
    () => {
      if (actionType === 'physical_attack') {
        const matchCount = payload.matchCount || (Array.isArray(payload.orbSwitches) && payload.orbSwitches.length >= 3 ? payload.orbSwitches.length : 3);
        const manaGain = matchCount * 5;
        starmon.mana = Math.min(200, (starmon.mana ?? starmon.currentMana ?? 0) + manaGain);
        starmon.currentMana = starmon.mana;

        if (proposedBoard) state.board = proposedBoard;
      } else if (actionType === 'use_ability') {
        const ability = getAbility(starmon, payload.abilityId, payload)!;
        const currentMana = starmon.mana ?? starmon.currentMana ?? 0;
        starmon.mana = starmon.id === 'tidecrush' && (ability.id === 'skill2' || payload.abilityNum === 2)
          ? 0
          : Math.max(0, currentMana - ability.cost);
        starmon.currentMana = starmon.mana;
      }

      if (ability?.id === 'fluffy_hug') {
        starmon.battleTauntTurns = 3;
        starmon.battleDamageReduction = 0.15;
        starmon.battleDamageReductionTurns = 3;
        effectLines.push('Gain Taunt and 15% damage reduction for 3 turns');
      } else if (ability?.id === 'winged_fortress') {
        const defBonus = Math.round((starmon.baseDef || starmon.def) * 0.2);
        starmon.battleTauntTurns = 3;
        starmon.battleDefenseBuffAmount = defBonus;
        starmon.battleDefenseBuffTurns = 3;
        starmon.def += defBonus;
        effectLines.push(`Gain Taunt and ${defBonus} DEF for 3 turns`);
      } else if (ability?.id === 'antler_blessing') {
        const healTarget = attacker.starmons
          .filter(s => s.hp > 0 && s.hp < s.maxHp)
          .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
        if (healTarget) {
          const healed = Math.round((healTarget.maxHp - healTarget.hp) * 0.5);
          healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + healed);
          healTarget.currentHp = healTarget.hp;
          payload.healedStarmonIndex = healTarget.index;
          payload.healAmount = healed;
          effectLines.push(`Restore ${healed} HP to ${healTarget.name}`);
        } else {
          effectLines.push('No ally needs healing');
        }
      } else {
        const applyHit = (ts: StarmonCombatant) => {
          if (ability?.id === 'ear_whip' && ts.index === targetIdx) {
            ts.battleShieldPoints = 0;
            effectLines.push('Remove target Shield');
          }
          const hpBefore = ts.hp;
          let hitDamage = Math.round(damage * (1 - ((ts.battleDamageReductionTurns || 0) > 0 ? (ts.battleDamageReduction || 0) : 0)));
          const wasHit = hitDamage > 0;
          const shield = Math.max(0, ts.battleShieldPoints || 0);
          const absorbed = Math.min(shield, hitDamage);
          ts.battleShieldPoints = shield - absorbed;
          if (absorbed > 0) effectLines.push(`Shield absorbs ${absorbed} DMG`);
          hitDamage -= absorbed;
          ts.hp = Math.max(0, ts.hp - hitDamage);
          ts.alive = ts.hp > 0;
          ts.currentHp = ts.hp;

          if (hpBefore >= ts.maxHp * 0.3 && ts.hp < ts.maxHp * 0.3 && !ts.berryReserveUsed) {
            const bambloom = target.starmons.find(s => s.id === 'bambloom' && (s.hp > 0 || s === ts));
            if (bambloom) {
              const heal = Math.round(ts.maxHp * (ts.id === 'bambloom' ? 0.3 : 0.15));
              ts.hp = Math.min(ts.maxHp, ts.hp + heal);
              ts.alive = ts.hp > 0;
              ts.currentHp = ts.hp;
              ts.berryReserveUsed = true;
              passiveEvents.push({ starmonName: ts.name, passiveName: 'Berry Reserve', line: `Restores ${heal} HP` });
            }
          }

          if (wasHit && ts.id === 'cottontail') {
            starmon.baseAtk = Math.round(starmon.baseAtk * 0.95);
            passiveEvents.push({ starmonName: ts.name, passiveName: 'Sweet Scent', line: `${starmon.name}'s ATK falls by 5%` });
          }
          if (wasHit && ts.id === 'dreadhorn') {
            const defGain = Math.round((ts.baseDef || ts.def) * 0.05);
            ts.def += defGain;
            passiveEvents.push({ starmonName: ts.name, passiveName: 'Unshakable', line: `Gains ${defGain} DEF` });
          }
        };

        if (actionType === 'use_ability' && (ability?.targetType === 'aoe' || payload.isAoE)) {
          target.starmons.forEach(ts => { if (ts != null && ts.hp > 0) applyHit(ts); });
        } else if (targetStarmon != null && targetStarmon.hp > 0) {
          applyHit(targetStarmon);
        }
      }
    },
    {
      grid: state.board,
      orbSwitches: payload.orbSwitches || [],
      attackerSlot: state.attackerSlot,
      targetSlot: state.targetSlot,
      starmonIndex,
      targetStarmonIndex: targetIdx,
      damage,
      targetHpAfter: targetStarmon ? targetStarmon.hp : 0,
      attackerManaAfter: starmon.mana,
    }
  );

  if (state.stepTimerHandle) {
    clearTimeout(state.stepTimerHandle);
    state.stepTimerHandle = null;
  }

  const snapshot = serializeBoard(state);

  // ---- Broadcast starmon_action_resolved cho CẢ 2 client ----
  broadcastToRoom(roomCode, {
    type: 'starmon_action_resolved',
    phase: state.phase,
    turn: state.turn,
    subPhase: state.subPhase,
    attackerSlot: state.attackerSlot,
    targetSlot: state.targetSlot,
    starmonIndex: starmonIndex,
    actionType: actionType,
    payload: {
      ...payload,
      targetStarmonIndex: targetIdx,
      attackerName: starmon.name,
      skillName: ability?.name || payload.skillName,
      abilityName: ability?.name,
      abilityNum: payload.abilityNum || (ability && starmon.skill2?.id === ability.id ? 2 : 1),
    },
    damage: damage,
    effectLines,
    passiveEvents,
    targetHpAfter: targetStarmon ? targetStarmon.hp : 0,
    attackerManaAfter: starmon.mana,
    board: state.board,
    boardSnapshot: snapshot,
    boardVersion: state.boardVersion,
    version: state.boardVersion,
    p1_hp: state.players[1].starmons.map(s => s.hp),
    p2_hp: state.players[2].starmons.map(s => s.hp),
    p1_mana: state.players[1].starmons.map(s => s.mana),
    p2_mana: state.players[2].starmons.map(s => s.mana),
    state: serializeMatchState(state),
  });

  // ---- Check win ngay ----
  if (countAlive(state.players[state.targetSlot].starmons) === 0) {
    endGame(state, roomCode, 'winner', state.attackerSlot);
    return;
  }

  // ---- Kết thúc lượt starmon -> sang step kế sau 700ms để 2 người chơi thấy rõ hiệu ứng đòn đánh trên board ----
  state.stepTimerHandle = setTimeout(() => {
    endStep(state, roomCode);
  }, 700);
}

function endGame(state: PvpMatchState, roomCode: string, result: 'draw' | 'winner', winnerSlot?: 1 | 2) {
  if (state.finished) return;
  state.finished = true;
  // Invalidate even an already queued phase callback so a finished match cannot restart.
  state.phaseTimerGeneration = (state.phaseTimerGeneration || 0) + 1;
  if (state.timerHandle) {
    clearTimeout(state.timerHandle);
    state.timerHandle = null;
  }
  if (state.phaseTimerHandle) {
    clearTimeout(state.phaseTimerHandle);
    state.phaseTimerHandle = null;
  }
  if (state.stepTimerHandle) {
    clearTimeout(state.stepTimerHandle);
    state.stepTimerHandle = null;
  }

  if (result === 'draw' || !winnerSlot) {
    broadcastToRoom(roomCode, {
      type: 'PVP_MATCH_FINISHED',
      winner: 'draw',
      result: 'draw',
    });
    broadcastToRoom(roomCode, {
      type: 'game_over',
      winner: 'draw',
    });
    return;
  }

  const winnerPlayer = state.players[winnerSlot];
  broadcastToRoom(roomCode, {
    type: 'PVP_MATCH_FINISHED',
    result: 'winner',
    winner: winnerSlot === 1 ? 'player1_win' : 'player2_win',
    winner_slot: winnerSlot,
    winnerSlot: winnerSlot,
    winner_id: winnerPlayer.id,
    winner_name: winnerPlayer.name,
  });
  broadcastToRoom(roomCode, {
    type: 'game_over',
    winner: winnerPlayer.id,
    winnerSlot: winnerSlot,
  });
}

// Kiểm tra thắng thua cuối turn (sau khi kết thúc Phase n.3)
function checkWinAndContinue(state: PvpMatchState, roomCode: string) {
  const p1Alive = state.players[1].starmons.some(s => s.hp > 0);
  const p2Alive = state.players[2].starmons.some(s => s.hp > 0);

  if (!p1Alive && !p2Alive) {
    endGame(state, roomCode, 'draw');
  } else if (!p2Alive) {
    endGame(state, roomCode, 'winner', 1);
  } else if (!p1Alive) {
    endGame(state, roomCode, 'winner', 2);
  } else {
    const endedPhase = state.phase;
    const endedTurn = state.turn;
    const nextTurnAt = Date.now() + 300;
    state.pendingNextTurnAt = nextTurnAt;
    setTimeout(() => {
      advanceToNextTurn(state, roomCode, endedPhase, endedTurn, nextTurnAt);
    }, nextTurnAt - Date.now());
  }
}

function advanceToNextTurn(
  state: PvpMatchState,
  roomCode: string,
  endedPhase: string,
  endedTurn: number,
  expectedAt: number,
) {
  if (
    Date.now() < expectedAt ||
    activeMatchStates.get(normalizeRoomCode(roomCode)) !== state ||
    state.pendingNextTurnAt !== expectedAt ||
    state.phase !== endedPhase ||
    state.turn !== endedTurn ||
    state.subPhase !== 3
  ) return;
  state.pendingNextTurnAt = undefined;
  startTurn(state, roomCode, endedTurn + 1);
}

const pvpBattleSocketAuth = new WeakMap<WebSocket, { username: string; deviceId: string; slot: 1 | 2 }>();
const pvpBattleSocketsByUsername = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws) => {
  let currentRoomCode: string | null = null;

  // Immediately send latest active accounts to newly connected client
  try {
    serverAccounts = loadAccounts();
    ws.send(JSON.stringify({ type: 'ACCOUNTS_UPDATED', accounts: getUniqueAccountsList(serverAccounts) }));
  } catch {}

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const socketAuth = pvpBattleSocketAuth.get(ws);
      if (socketAuth && msg.type !== 'PVP_JOIN_BATTLE') {
        msg.player_id = socketAuth.username;
        msg.slot = socketAuth.slot;
        msg.actor_slot = socketAuth.slot;
        msg.playerSlot = socketAuth.slot;
        msg.attackerSlot = socketAuth.slot;
      }

      switch (msg.type) {
        case 'GET_ACCOUNTS': {
          serverAccounts = loadAccounts();
          ws.send(JSON.stringify({ type: 'ACCOUNTS_UPDATED', accounts: getUniqueAccountsList(serverAccounts) }));
          break;
        }

        case 'JOIN_LOBBY': {
          activeRooms = loadRooms();
          const waitingRooms = activeRooms.filter(r => r.status === 'WAITING');
          ws.send(JSON.stringify({ type: 'ROOMS_UPDATED', rooms: waitingRooms }));
          break;
        }

        case 'JOIN_ROOM': {
          const rawCode = msg.room_code || msg.code || '';
          const targetCode = normalizeRoomCode(rawCode);
          activeRooms = loadRooms();
          let room = activeRooms.find(r => normalizeRoomCode(r.room_code || r.code) === targetCode);
          if (serverSupabase && targetCode) {
            try {
              const { data, error } = await serverSupabase.from('pvp_rooms').select('*')
                .eq('room_code', targetCode).maybeSingle();
              if (error) throw error;
              room = data ? pvpRoomFromSupabaseRow(data) : undefined;
              if (room) {
                const localIndex = activeRooms.findIndex(candidate => normalizeRoomCode(candidate.room_code || candidate.code) === targetCode);
                if (localIndex >= 0) activeRooms[localIndex] = room;
                else activeRooms.unshift(room);
                writeRoomsStore(activeRooms);
              }
            } catch (error) {
              console.error(`[PvP] Could not resolve lobby room ${targetCode}:`, error);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Không thể tải phòng từ kho PvP dùng chung.' }));
              }
              break;
            }
          }
          if (room) {
            if (currentRoomCode && currentRoomCode !== targetCode && roomClients.has(currentRoomCode)) {
              roomClients.get(currentRoomCode)!.delete(ws);
            }
            currentRoomCode = targetCode;
            if (!roomClients.has(targetCode)) {
              roomClients.set(targetCode, new Set());
            }
            roomClients.get(targetCode)!.add(ws);
            // Lobby sockets only subscribe to updates. Room membership and
            // match startup are handled by authenticated HTTP endpoints.
            ws.send(JSON.stringify({ type: 'ROOM_STATE_UPDATED', room }));
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: `Phòng ${rawCode} không tồn tại hoặc đã đóng.` }));
          }
          break;
        }

        case 'START_MATCH': {
          const rawCode = msg.room_code || msg.code || '';
          const targetCode = normalizeRoomCode(rawCode);
          activeRooms = loadRooms();
          const room = activeRooms.find(r => normalizeRoomCode(r.room_code || r.code) === targetCode);
          if (room && room.players.length >= 2) {
            const roomBeforeStart = JSON.parse(JSON.stringify(room)) as PvpRoom;
            room.status = 'IN_GAME';
            const persisted = await persistRoomToSupabase(room, false, false, {
              updatedAt: roomBeforeStart.updatedAt,
              status: roomBeforeStart.status,
            });
            if (!persisted.success) {
              Object.assign(room, roomBeforeStart);
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Phòng vừa thay đổi hoặc không lưu được trạng thái PvP. Hãy làm mới danh sách phòng.' }));
              break;
            }
            const match = activeMatchStates.get(targetCode) || initializeMatchForRoom(room);
            const ownsRuntime = await ensurePvpRuntimeOwner(match);
            if (!ownsRuntime && !match.runtimeOwnerId) {
              const failedWriteUpdatedAt = room.updatedAt;
              const rollbackRoom = { ...roomBeforeStart, updatedAt: Math.max(Date.now(), failedWriteUpdatedAt + 1) };
              Object.assign(room, rollbackRoom);
              await persistRoomToSupabase(rollbackRoom, false, false, { updatedAt: failedWriteUpdatedAt, status: 'IN_GAME' });
              stopPvpRuntime(targetCode);
              saveRooms(activeRooms);
              ws.send(JSON.stringify({ type: 'ERROR', message: 'PvP chưa thể khởi động: cần triển khai hàm persist_pvp_runtime_state trong Supabase.' }));
              break;
            }
            saveRooms(activeRooms);
            const startPayload = {
              type: 'match_start',
              seed: match.seed,
              boardSnapshot: serializeBoard(match),
              board: match.board,
              boardVersion: match.boardVersion,
              version: match.boardVersion,
              player1Id: room.players[0]?.id || match.players[1].id,
              player2Id: room.players[1]?.id || match.players[2].id,
              room,
              matchState: serializeMatchState(match),
            };
            broadcastToRoom(targetCode, startPayload);
            broadcastToRoom(targetCode, { ...startPayload, type: 'MATCH_STARTED' });
            broadcastRoomList();
            if (ownsRuntime && roomBeforeStart.status === 'WAITING') {
              setTimeout(() => {
                startTurn(match, targetCode, 1);
              }, 1000);
            }
          }
          break;
        }

        case 'LEAVE_ROOM': {
          const rawCode = msg.room_code || msg.code || '';
          const targetCode = normalizeRoomCode(rawCode);
          const uid = msg.user_id;
          activeRooms = loadRooms();
          const room = activeRooms.find(r => normalizeRoomCode(r.room_code || r.code) === targetCode);
          if (room) {
            if (uid && uid === room.host_id) {
              const deleted = await deleteRoomFromSupabase(targetCode, {
                updatedAt: Number(room.updatedAt) || 0,
                status: room.status,
              });
              if (!deleted.success) {
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Không thể đóng phòng PvP lúc này.' }));
                break;
              }
              room.status = 'FINISHED';
              stopPvpRuntime(targetCode);
              activeRooms = activeRooms.filter(r => normalizeRoomCode(r.room_code || r.code) !== targetCode);
              saveRooms(activeRooms);
              broadcastToRoom(targetCode, { type: 'ROOM_CLOSED', room_code: targetCode });
            } else {
              const roomBeforeLeave = JSON.parse(JSON.stringify(room)) as PvpRoom;
              room.players = room.players.filter(p => p.id !== uid);
              room.guestName = undefined;
              room.status = 'WAITING';
              room.updatedAt = Date.now();
              const persisted = await persistRoomToSupabase(room, false, true, {
                updatedAt: roomBeforeLeave.updatedAt,
                status: roomBeforeLeave.status,
              });
              if (!persisted.success) {
                Object.assign(room, roomBeforeLeave);
                ws.send(JSON.stringify({ type: 'ERROR', message: 'Không lưu được trạng thái phòng PvP.' }));
                break;
              }
              stopPvpRuntime(targetCode);
              saveRooms(activeRooms);
              broadcastToRoom(targetCode, { type: 'ROOM_STATE_UPDATED', room });
            }
            broadcastRoomList();
          }
          break;
        }

        case 'PVP_JOIN_BATTLE': {
          const rawCode = msg.room_code || '';
          const targetCode = normalizeRoomCode(rawCode);
          if (targetCode) {
            const authenticatedUsername = await verifyPvpSession(
              String(msg.username || ''), String(msg.device_id || ''), String(msg.auth_token || '')
            );
            if (!authenticatedUsername) {
              if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ERROR', message: 'Đăng nhập PvP hết hạn. Hãy đăng nhập lại.' }));
              break;
            }
            activeRooms = loadRooms();
            let authenticatedRoom = activeRooms.find(r => normalizeRoomCode(r.room_code || r.code) === targetCode);
            if (serverSupabase) {
              const { data: roomRow, error: roomError } = await serverSupabase.from('pvp_rooms').select('*').eq('room_code', targetCode).maybeSingle();
              if (roomError) throw roomError;
              if (roomRow) {
                authenticatedRoom = pvpRoomFromSupabaseRow(roomRow);
                const localIndex = activeRooms.findIndex(room => normalizeRoomCode(room.room_code || room.code) === targetCode);
                if (localIndex >= 0) activeRooms[localIndex] = authenticatedRoom;
                else activeRooms.unshift(authenticatedRoom);
              }
            }
            const usernameKey = authenticatedUsername.toLowerCase();
            const isHostAccount = String(authenticatedRoom?.host_id || '').toLowerCase() === usernameKey;
            const isJoinedGuest = Boolean(authenticatedRoom?.players?.some(player =>
              !player.isHost && String(player.id || '').toLowerCase() === usernameKey
            ));
            if (!authenticatedRoom || (!isHostAccount && !isJoinedGuest)) {
              if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ERROR', message: 'Tài khoản này không thuộc phòng PvP đã chọn.' }));
              break;
            }
            const assignedSlot: 1 | 2 = isHostAccount ? 1 : 2;
            pvpBattleSocketAuth.set(ws, { username: authenticatedUsername, deviceId: String(msg.device_id), slot: assignedSlot });
            const accountSockets = pvpBattleSocketsByUsername.get(usernameKey) || new Set<WebSocket>();
            accountSockets.add(ws);
            pvpBattleSocketsByUsername.set(usernameKey, accountSockets);
            msg.slot = assignedSlot;
            msg.is_host = assignedSlot === 1;
            msg.player_id = authenticatedUsername;
            msg.player_name = authenticatedUsername;
            if (currentRoomCode && currentRoomCode !== targetCode && roomClients.has(currentRoomCode)) {
              roomClients.get(currentRoomCode)!.delete(ws);
            }
            currentRoomCode = targetCode;
            if (!roomClients.has(targetCode)) {
              roomClients.set(targetCode, new Set());
            }
            roomClients.get(targetCode)!.add(ws);

            let match = activeMatchStates.get(targetCode);
            if (!match) {
              activeRooms = loadRooms();
              const room = activeRooms.find(r => normalizeRoomCode(r.room_code || r.code) === targetCode) || authenticatedRoom;
              if (room) {
                match = initializeMatchForRoom(room);
              } else {
                if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ERROR', message: 'Không tìm thấy phòng PvP hợp lệ.' }));
                break;
              }
            }
            const sharedSnapshot = (authenticatedRoom as any).matchState;
            if (sharedSnapshot && Number(sharedSnapshot.runtimeRevision) > Number(match.runtimeRevision || 0)) {
              applySerializedMatchState(match, sharedSnapshot);
            }
            const ownsRuntime = await ensurePvpRuntimeOwner(match);
            if (!ownsRuntime && !match.runtimeOwnerId) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'PvP chưa thể đồng bộ: cần triển khai hàm persist_pvp_runtime_state trong Supabase.' }));
              break;
            }

            if (match) {
              const pId = msg.player_id || 'player';
              const pName = msg.player_name || (msg.is_host ? 'Host' : 'Guest');

              // Slot is derived from the authenticated username and server room
              // membership above; client-provided is_host/slot flags are ignored.
              const slot: 1 | 2 = assignedSlot;

              if (slot === 1) {
                match.players[1].id = pId;
                match.players[1].name = pName;
              } else {
                // Preserve distinct slot identities even when both tabs use one account.
                match.players[2].id = pId === match.players[1].id ? `${pId}_tab2` : pId;
                match.players[2].name = pId === match.players[1].id ? `${pName} (2)` : pName;
              }
              match.players[slot].socket = ws;
              if (Array.isArray(msg.starmons) && msg.starmons.length > 0 && match.turn === 1 && match.subPhase === 1 && !match.players[slot].hasSubmittedAnswer) {
                match.players[slot].starmons = createDefaultStarmonsForSlot(slot, msg.starmons);
                match.players[slot].starmons.forEach((s, idx) => {
                  s.unlocked = Boolean(match!.players[slot].results[idx]);
                });
              }

              if (match.runtimeOwnerId && match.runtimeOwnerId !== PVP_SERVER_INSTANCE_ID) {
                const forwarded = forwardPvpActionToRuntimeOwner(targetCode, slot, {
                  commandType: 'player_joined',
                  id: match.players[slot].id,
                  name: match.players[slot].name,
                  starmons: match.players[slot].starmons,
                });
                if (!forwarded) {
                  ws.send(JSON.stringify({ type: 'ERROR', message: 'Máy chủ trận đấu đang kết nối lại. Vui lòng tải lại trận.' }));
                  break;
                }
              }

              if (!match.phaseTimerHandle && match.runtimeOwnerId === PVP_SERVER_INSTANCE_ID) {
                schedulePhaseEnd(match, targetCode);
              }

              const snapshot = serializeBoard(match);

              ws.send(JSON.stringify({
                type: 'slot_assigned',
                slot,
              }));

              ws.send(JSON.stringify({
                type: 'match_start',
                seed: match.seed,
                boardSnapshot: snapshot,
                board: match.board,
                boardVersion: match.boardVersion,
                version: match.boardVersion,
                player1Id: match.players[1].id,
                player2Id: match.players[2].id,
                matchState: serializeMatchState(match),
              }));

              const { attackerSlot, targetSlot } = getAttackerAndTargetByPhase(match.phase);

              ws.send(JSON.stringify({
                type: 'PVP_MATCH_STATE_SYNC',
                slot,
                phase: match.phase,
                turn: match.turn,
                subPhase: match.subPhase,
                attackerSlot,
                targetSlot,
                round_number: match.turn,
                time_limit: match.subPhase === 1
                  ? Math.max(0, Math.ceil((match.phaseStartedAt + ANSWER_DURATION_MS - Date.now()) / 1000))
                  : Math.max(0, Math.ceil((match.phaseEndsAt - Date.now()) / 1000)),
                analysis_buffer: match.subPhase === 1
                  ? Math.ceil(Math.max(0, match.phaseEndsAt - (match.phaseStartedAt + ANSWER_DURATION_MS)) / 1000)
                  : 0,
                state: serializeMatchState(match),
                matchState: serializeMatchState(match),
                board: match.board,
                boardSnapshot: snapshot,
                boardVersion: match.boardVersion,
                version: match.boardVersion,
                seed: match.seed,
                p1_hp: match.players[1].starmons.map(s => s.hp),
                p2_hp: match.players[2].starmons.map(s => s.hp),
                p1_mana: match.players[1].starmons.map(s => s.mana),
                p2_mana: match.players[2].starmons.map(s => s.mana),
              }));

              if (match.runtimeOwnerId === PVP_SERVER_INSTANCE_ID) {
                publishPvpRuntimeState(targetCode, {
                  type: 'PVP_MATCH_STATE_SYNC',
                  phase: match.phase,
                  turn: match.turn,
                  subPhase: match.subPhase,
                  attackerSlot,
                  targetSlot,
                }, match);
              }

              if (match.subPhase === 1) {
                const p1Alive = aliveStarmonIndices(match.players[1]);
                const p2Alive = aliveStarmonIndices(match.players[2]);
                const answerDeadline = match.phaseStartedAt + ANSWER_DURATION_MS;
                const remainingSec = Math.max(1, Math.ceil((answerDeadline - Date.now()) / 1000));
                ws.send(JSON.stringify({
                  type: 'phase_changed',
                  phase: match.phase,
                  turn: match.turn,
                  round_number: match.turn,
                  subPhase: 1,
                  attackerSlot: null,
                  targetSlot: null,
                  attackQueue: [],
                  time_limit: remainingSec,
                  analysis_buffer: Math.ceil(ANSWER_ANALYSIS_BUFFER_MS / 1000),
                  p1_alive_count: p1Alive.length,
                  p1_alive_indices: p1Alive,
                  p2_alive_count: p2Alive.length,
                  p2_alive_indices: p2Alive,
                  board: match.board,
                  boardSnapshot: snapshot,
                  boardVersion: match.boardVersion,
                  version: match.boardVersion,
                }));
              } else if ((match.subPhase === 2 || match.subPhase === 3) && attackerSlot !== null) {
                sendCurrentCombatPhaseToSocket(match, ws, slot);
              }
            }
          }
          break;
        }

        case 'PVP_ANSWER_PROGRESS': {
          const targetCode = normalizeRoomCode(msg.room_code || currentRoomCode || '');
          const match = activeMatchStates.get(targetCode);
          const socketAuth = pvpBattleSocketAuth.get(ws);
          if (!match || !targetCode || !socketAuth) break;
          if (match.subPhase !== 1 ||
              (msg.round_number != null && Number(msg.round_number) !== match.turn)) {
            sendCurrentCombatPhaseToSocket(match, ws, socketAuth.slot);
            break;
          }

          // Never let a client-provided slot redirect answer state to the other
          // player. The authenticated room username is the slot authority.
          const slot = socketAuth.slot;
          const P = match.players[slot];
          if (P && Array.isArray(msg.results)) {
            msg.results.forEach((val: any, idx: number) => {
              if (val !== undefined && P.starmons[idx]) {
                const isOk = Boolean(val) && P.starmons[idx].hp > 0;
                P.results[idx] = isOk;
                P.starmons[idx].unlocked = isOk;
              }
            });
          }
          break;
        }

        case 'PVP_PHASE1_SYNC_BOTH':
        case 'PVP_PHASE1_TIMEOUT': {
          const targetCode = normalizeRoomCode(msg.room_code || currentRoomCode || '');
          if (!targetCode) break;
          if (!roomClients.has(targetCode)) {
            roomClients.set(targetCode, new Set());
          }
          roomClients.get(targetCode)!.add(ws);

          let match = activeMatchStates.get(targetCode);
          if (!match) {
            activeRooms = loadRooms();
            const room = activeRooms.find(r => normalizeRoomCode(r.room_code || r.code) === targetCode);
            if (room) {
              match = initializeMatchForRoom(room);
            }
          }
          if (!match) break;

          const rawSlot = msg.slot ?? msg.actor_slot;
          const slot: 1 | 2 = (rawSlot === 2 || rawSlot === '2') ? 2 : 1;
          match.players[slot].socket = ws;

          // If cloud speaking submissions were forwarded, populate missing results before Phase 2
          if (Array.isArray(msg.slot1_results)) {
            match.players[1].starmons.forEach((s, idx) => {
              const ok = Boolean(msg.slot1_results[idx]) && s.hp > 0;
              match!.players[1].results[idx] = ok;
              s.unlocked = ok;
            });
            match.players[1].hasSubmittedAnswer = true;
          }
          if (Array.isArray(msg.slot2_results)) {
            match.players[2].starmons.forEach((s, idx) => {
              const ok = Boolean(msg.slot2_results[idx]) && s.hp > 0;
              match!.players[2].results[idx] = ok;
              s.unlocked = ok;
            });
            match.players[2].hasSubmittedAnswer = true;
          }
          if (Array.isArray(msg.results)) {
            match.players[slot].starmons.forEach((s, idx) => {
              const ok = Boolean(msg.results[idx]) && s.hp > 0;
              match!.players[slot].results[idx] = ok;
              s.unlocked = ok;
            });
            match.players[slot].hasSubmittedAnswer = true;
          }

          if (match.subPhase === 1) {
            match.players[slot].hasSubmittedAnswer = true;
            match.players[slot].starmons.forEach((s, idx) => {
              if (match!.players[slot].results[idx] == null) {
                match!.players[slot].results[idx] = false;
                s.unlocked = false;
              }
            });
            // QUY TẮC DUY NHẤT: Phase chỉ kết thúc khi server timer state.phaseEndsAt kết thúc qua handlePhaseEnd().
            // Dù cả 2 đã nộp bài sớm hoặc timeout, VẪN CHỜ đúng 120s!
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'answer_all_done',
                phase: match.phase,
                phaseEndsAt: match.phaseEndsAt,
                serverTime: Date.now(),
                message: 'Bạn đã nộp bài. Đang chờ đối thủ hoàn tất Phase 1...',
              }));
            }
          } else {
            // Đã ở Phase n.2 hoặc n.3 -> chỉ đồng bộ lại cho chính client này
            sendCurrentCombatPhaseToSocket(match, ws, slot);
          }
          break;
        }

        case 'PVP_ANSWER_SUBMIT':
        case 'PVP_SPEAKING_FINISH': {
          const targetCode = normalizeRoomCode(msg.room_code || currentRoomCode || '');
          if (!targetCode) break;
          const socketAuth = pvpBattleSocketAuth.get(ws);
          if (!socketAuth) break;
          currentRoomCode = targetCode;
          if (!roomClients.has(targetCode)) {
            roomClients.set(targetCode, new Set());
          }
          roomClients.get(targetCode)!.add(ws);

          let match = activeMatchStates.get(targetCode);
          if (!match) {
            activeRooms = loadRooms();
            const room = activeRooms.find(r => normalizeRoomCode(r.room_code || r.code) === targetCode);
            if (room) {
              match = initializeMatchForRoom(room);
            }
          }
          if (!match) break;

          const ownsRuntime = await ensurePvpRuntimeOwner(match);
          if (!ownsRuntime && (match.runtimeOwnerId === PVP_SERVER_INSTANCE_ID || !match.runtimeOwnerId)) {
            ws.send(JSON.stringify({ type: 'PVP_ACTION_REJECTED', reason: 'Máy chủ trận đấu chưa khóa được state dùng chung.' }));
            break;
          }

          if (msg.round_number != null && Number(msg.round_number) !== match.turn) {
            sendCurrentCombatPhaseToSocket(match, ws, socketAuth.slot);
            break;
          }

          // Use the same username-derived slot as PVP_JOIN_BATTLE, even if a
          // stale client ref still reports the previous slot.
          const slot = socketAuth.slot;
          match.players[slot].socket = ws;

          const results: boolean[] = Array.isArray(msg.results)
            ? msg.results
            : Array.isArray(msg.unlocked_positions)
            ? msg.unlocked_positions
            : [false, false, false];

          if (match.runtimeOwnerId && match.runtimeOwnerId !== PVP_SERVER_INSTANCE_ID) {
            if (!pvpRealtimeBusReady || !pvpRealtimeBus) {
              ws.send(JSON.stringify({ type: 'PVP_ACTION_REJECTED', reason: 'Đang đồng bộ trận đấu; vui lòng thử lại.' }));
              break;
            }
            const status = await pvpRealtimeBus.send({
              type: 'broadcast',
              event: 'match_command',
              payload: {
                roomCode: targetCode,
                ownerId: match.runtimeOwnerId,
                playerSlot: slot,
                data: { commandType: 'answer_submit', results, isTimeout: Boolean(msg.is_timeout) },
              },
            });
            if (status !== 'ok') {
              ws.send(JSON.stringify({ type: 'PVP_ACTION_REJECTED', reason: 'Không gửi được câu trả lời tới máy chủ trận đấu.' }));
            }
            break;
          }

          onAnswerSubmit(match, targetCode, slot, results, Boolean(msg.is_timeout), ws);
          break;
        }

        case 'resync':
        case 'request_resync':
        case 'board_sync':
        case 'request_board_sync': {
          const targetCode = normalizeRoomCode(msg.room_code || currentRoomCode || '');
          const match = activeMatchStates.get(targetCode);
          if (match && ws.readyState === WebSocket.OPEN) {
            const ownsRuntime = await ensurePvpRuntimeOwner(match);
            if (!ownsRuntime && (match.runtimeOwnerId === PVP_SERVER_INSTANCE_ID || !match.runtimeOwnerId)) {
              ws.send(JSON.stringify({ type: 'PVP_ACTION_REJECTED', reason: 'Máy chủ trận đấu đang khôi phục state dùng chung.' }));
              break;
            }
            const rawSlot = msg.slot ?? msg.actor_slot;
            const playerSlot: 1 | 2 = (rawSlot === 2 || rawSlot === '2') ? 2 : 1;
            if (match.runtimeOwnerId && match.runtimeOwnerId !== PVP_SERVER_INSTANCE_ID) {
              if (pvpRealtimeBusReady && pvpRealtimeBus) {
                const status = await pvpRealtimeBus.send({
                  type: 'broadcast',
                  event: 'match_command',
                  payload: {
                    roomCode: targetCode,
                    ownerId: match.runtimeOwnerId,
                    playerSlot,
                    data: { commandType: 'resync_request' },
                  },
                });
                if (status !== 'ok') ws.send(JSON.stringify({ type: 'PVP_ACTION_REJECTED', reason: 'Không thể đồng bộ trạng thái trận đấu.' }));
              } else {
                ws.send(JSON.stringify({ type: 'PVP_ACTION_REJECTED', reason: 'Máy chủ trận đấu đang kết nối lại.' }));
              }
              break;
            }
            const snapshot = serializeBoard(match);
            ws.send(JSON.stringify({
              type: 'resync',
              phase: match.phase,
              subPhase: match.subPhase,
              step: match.step,
              attackerSlot: match.attackerSlot,
              targetSlot: match.targetSlot,
              boardSnapshot: snapshot,
              grid: match.board,
              board: match.board,
              boardVersion: match.boardVersion,
              version: match.boardVersion,
              myResults: match.players[playerSlot]?.results || [false, false, false],
              p1_hp: match.players[1].starmons.map(s => s.hp),
              p2_hp: match.players[2].starmons.map(s => s.hp),
              p1_mana: match.players[1].starmons.map(s => s.mana),
              p2_mana: match.players[2].starmons.map(s => s.mana),
            }));
            ws.send(JSON.stringify({
              type: 'board_full_sync',
              version: match.boardVersion,
              boardVersion: match.boardVersion,
              boardSnapshot: snapshot,
              grid: match.board,
              board: match.board,
              p1_hp: match.players[1].starmons.map(s => s.hp),
              p2_hp: match.players[2].starmons.map(s => s.hp),
              p1_mana: match.players[1].starmons.map(s => s.mana),
              p2_mana: match.players[2].starmons.map(s => s.mana),
            }));
            if (match.subPhase === 2 || match.subPhase === 3) {
              sendCurrentCombatPhaseToSocket(match, ws, playerSlot);
            }
          }
          break;
        }

        case 'board_tile_hover':
        case 'PVP_TILE_HOVER':
        case 'board_tile_select':
        case 'PVP_TILE_SELECT': {
          const targetCode = normalizeRoomCode(msg.room_code || currentRoomCode || '');
          if (targetCode) {
            broadcastToRoom(targetCode, {
              type: 'board_tile_selected',
              slot: msg.slot ?? msg.actor_slot,
              tile: msg.tile || null,
              hover: Boolean(msg.hover),
            }, ws);
          }
          break;
        }

        case 'PVP_PING': {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PVP_PONG', ts: Date.now() }));
          }
          break;
        }

        case 'starmon_action':
        case 'onStarmonAction':
        case 'attack_submit':
        case 'onAttackSubmit':
        case 'PVP_BATTLE_ACTION': {
          const targetCode = normalizeRoomCode(msg.room_code || currentRoomCode || '');
          const match = activeMatchStates.get(targetCode);
          if (!match || !targetCode) break;

          const authenticatedSlot = pvpBattleSocketAuth.get(ws)?.slot;
          const rawSlot = authenticatedSlot ?? msg.playerSlot ?? msg.attackerSlot ?? msg.actor_slot ?? msg.slot;
          let playerSlot: 1 | 2;
          if (rawSlot === 2 || rawSlot === '2') {
            playerSlot = 2;
          } else if (rawSlot === 1 || rawSlot === '1' || rawSlot === 0) {
            playerSlot = 1;
          } else {
            playerSlot = match.players[1].id === msg.player_id ? 1 : 2;
          }
          match.players[playerSlot].socket = ws;

          const starmonIdx = typeof msg.starmonIndex === 'number'
            ? msg.starmonIndex
            : (typeof msg.starmon_index === 'number'
              ? msg.starmon_index
              : (typeof msg.action?.attackerIndex === 'number' ? msg.action.attackerIndex : (match.step || 1) - 1));

          const actionType = msg.actionType || (msg.action?.actionType === 'SKILL' ? 'use_ability' : 'physical_attack');
          const actionPayload = {
            ...(msg.payload || {
              targetStarmonIndex: typeof msg.targetStarmonIndex === 'number'
                ? msg.targetStarmonIndex
                : (typeof msg.action?.targetIdx === 'number' ? msg.action.targetIdx : 0),
              orbSwitches: msg.action?.orbSwitches || [],
              abilityId: msg.action?.abilityId || msg.action?.skillName,
              abilityNum: msg.action?.abilityNum,
              skillName: msg.action?.skillName,
              manaCost: msg.action?.manaCost,
              elem: msg.action?.elem,
              matchCount: msg.action?.matchCount,
              damage: msg.action?.damage,
              isCrit: msg.action?.isCrit,
              isAoE: msg.action?.isAoE,
              newBoard: msg.action?.newBoard,
            }),
            boardVersion: msg.boardVersion ?? msg.payload?.boardVersion ?? msg.version,
          };

          const ownsRuntime = await ensurePvpRuntimeOwner(match);
          if (!ownsRuntime && (match.runtimeOwnerId === PVP_SERVER_INSTANCE_ID || !match.runtimeOwnerId)) {
            ws.send(JSON.stringify({ type: 'PVP_ACTION_REJECTED', reason: 'Máy chủ trận đấu chưa khóa được state dùng chung.' }));
            break;
          }

          if (match.runtimeOwnerId && match.runtimeOwnerId !== PVP_SERVER_INSTANCE_ID) {
            const forwarded = forwardPvpActionToRuntimeOwner(targetCode, playerSlot, {
              starmonIndex: starmonIdx,
              actionType,
              payload: actionPayload,
            });
            if (!forwarded && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'PVP_ACTION_REJECTED', reason: 'Đang đồng bộ trận đấu, vui lòng thử lại.' }));
            }
            break;
          }

          onStarmonAction(match, targetCode, playerSlot, {
            starmonIndex: starmonIdx,
            actionType,
            payload: actionPayload,
          }, ws);
          break;
        }

        case 'PVP_REQUEST_PHASE_SYNC': {
          // Recover both a missed phase broadcast and a timer that expired on
          // the client before the server's deadline callback was processed.
          const targetCode = normalizeRoomCode(currentRoomCode || msg.room_code || '');
          const match = activeMatchStates.get(targetCode);
          const auth = pvpBattleSocketAuth.get(ws);
          if (match && auth && ws.readyState === WebSocket.OPEN) {
            const ownsRuntime = await ensurePvpRuntimeOwner(match);
            if (!ownsRuntime && (match.runtimeOwnerId === PVP_SERVER_INSTANCE_ID || !match.runtimeOwnerId)) {
              ws.send(JSON.stringify({ type: 'PVP_ACTION_REJECTED', reason: 'Máy chủ trận đấu chưa khóa được state dùng chung.' }));
              break;
            }
            if (match.runtimeOwnerId && match.runtimeOwnerId !== PVP_SERVER_INSTANCE_ID) {
              const forwarded = forwardPvpActionToRuntimeOwner(targetCode, auth.slot, {
                commandType: 'phase_sync_request',
                request: {
                  phase: msg.phase,
                  battlePhase: msg.battlePhase,
                  step: msg.step,
                  timerExpired: msg.timerExpired === true,
                },
              });
              if (!forwarded) {
                ws.send(JSON.stringify({ type: 'PVP_ACTION_REJECTED', reason: 'Máy chủ trận đấu đang kết nối lại.' }));
              } else {
                ws.send(JSON.stringify({
                  type: 'PVP_SYNC_ACK',
                  phase: match.phase,
                  turn: match.turn,
                  subPhase: match.subPhase,
                  step: match.step,
                  serverTime: Date.now(),
                }));
              }
              break;
            }
            if (Date.now() >= match.phaseEndsAt) {
              const expiredPhase = match.phase;
              advanceExpiredPhase(match, targetCode);
              if (match.phase !== expiredPhase) {
                sendCurrentCombatPhaseToSocket(match, ws, auth.slot);
              }
            } else if (
              msg.phase !== match.phase ||
              ((msg.battlePhase === 'phase1_quiz' || msg.battlePhase === 'phase2_combat') &&
                msg.battlePhase !== (match.subPhase === 1 ? 'phase1_quiz' : 'phase2_combat')) ||
              msg.timerExpired === true ||
              msg.step === null ||
              (typeof msg.step === 'number' && msg.step !== match.step)
            ) {
              if (!match.phaseTimerHandle) schedulePhaseEnd(match, targetCode);
              sendCurrentCombatPhaseToSocket(match, ws, auth.slot);
            }
            try {
              ws.send(JSON.stringify({
                type: 'PVP_SYNC_ACK',
                phase: match.phase,
                turn: match.turn,
                subPhase: match.subPhase,
                step: match.step,
                phaseEndsAt: match.phaseEndsAt,
                serverTime: Date.now(),
              }));
            } catch (error) {
              console.warn(`[PvP] Could not acknowledge phase sync (${targetCode})`, error);
            }
          }
          break;
        }

        case 'PVP_PHASE_TIMEOUT': {
          const targetCode = normalizeRoomCode(msg.room_code || currentRoomCode || '');
          const match = activeMatchStates.get(targetCode);
          if (!match || (match.subPhase !== 2 && match.subPhase !== 3)) break;

          const ownsRuntime = await ensurePvpRuntimeOwner(match);
          if (!ownsRuntime && (match.runtimeOwnerId === PVP_SERVER_INSTANCE_ID || !match.runtimeOwnerId)) {
            ws.send(JSON.stringify({ type: 'PVP_ACTION_REJECTED', reason: 'Máy chủ trận đấu chưa khóa được state dùng chung.' }));
            break;
          }
          if (match.runtimeOwnerId && match.runtimeOwnerId !== PVP_SERVER_INSTANCE_ID) {
            if (!forwardPvpActionToRuntimeOwner(targetCode, pvpBattleSocketAuth.get(ws)?.slot || 1, {
              commandType: 'phase_sync_request',
              request: { phase: msg.phase, timerExpired: true },
            })) {
              ws.send(JSON.stringify({ type: 'PVP_ACTION_REJECTED', reason: 'Máy chủ trận đấu đang kết nối lại.' }));
            }
            break;
          }

          // Accept only a timeout for the phase the server is currently running.
          // Both clients can report zero; handlePhaseEnd's phase/generation guard
          // makes duplicate reports safe.
          if (msg.phase && msg.phase !== match.phase) break;
          if (Date.now() >= match.phaseEndsAt) {
            advanceExpiredPhase(match, targetCode);
          } else if (!match.phaseTimerHandle) {
            schedulePhaseEnd(match, targetCode);
          }
          break;
        }

        case 'PVP_TURN_END':
        case 'step_timeout': {
          const targetCode = normalizeRoomCode(msg.room_code || currentRoomCode || '');
          const match = activeMatchStates.get(targetCode);
          if (!match) break;

          const ownsRuntime = await ensurePvpRuntimeOwner(match);
          if (!ownsRuntime && (match.runtimeOwnerId === PVP_SERVER_INSTANCE_ID || !match.runtimeOwnerId)) {
            ws.send(JSON.stringify({ type: 'PVP_ACTION_REJECTED', reason: 'Máy chủ trận đấu chưa khóa được state dùng chung.' }));
            break;
          }

          const rawSlot = msg.actor_slot ?? msg.slot ?? msg.attackerSlot;
          const playerSlot: 1 | 2 = (rawSlot === 2 || rawSlot === '2')
            ? 2
            : (rawSlot === 1 || rawSlot === '1' || rawSlot === 0 ? 1 : (match.players[1].id === msg.player_id ? 1 : 2));

          const { attackerSlot } = getAttackerAndTargetByPhase(match.phase);
          if (match.runtimeOwnerId && match.runtimeOwnerId !== PVP_SERVER_INSTANCE_ID) {
            const starmonIndex = Number(msg.starmon_index);
            if (!forwardPvpActionToRuntimeOwner(targetCode, playerSlot, {
              commandType: 'turn_end',
              phase: msg.phase || match.phase,
              turn: Number(msg.turn ?? match.turn),
              step: Number(msg.step ?? (starmonIndex + 1)),
              starmonIndex,
            })) ws.send(JSON.stringify({ type: 'PVP_ACTION_REJECTED', reason: 'Máy chủ trận đấu đang kết nối lại.' }));
            break;
          }
          if (attackerSlot === playerSlot && (match.subPhase === 2 || match.subPhase === 3)) {
            const requestedStarmonIndex = Number(msg.starmon_index);
            if ((msg.phase && msg.phase !== match.phase) ||
                (msg.turn != null && Number(msg.turn) !== match.turn) ||
                (msg.step != null && Number(msg.step) !== match.step)) break;
            onStepTimeout(match, targetCode, playerSlot, requestedStarmonIndex);
          }
          break;
        }

        case 'PVP_MATCH_END': {
          const targetCode = normalizeRoomCode(msg.room_code || currentRoomCode || '');
          const match = activeMatchStates.get(targetCode);
          const auth = pvpBattleSocketAuth.get(ws);
          if (!targetCode || !match || !auth) break;
          const ownsRuntime = await ensurePvpRuntimeOwner(match);
          if (!ownsRuntime && (match.runtimeOwnerId === PVP_SERVER_INSTANCE_ID || !match.runtimeOwnerId)) break;
          if (match.runtimeOwnerId && match.runtimeOwnerId !== PVP_SERVER_INSTANCE_ID) {
            forwardPvpActionToRuntimeOwner(targetCode, auth.slot, { commandType: 'match_end' });
            break;
          }
          const winner = match.players[auth.slot];
          const loser = match.players[auth.slot === 1 ? 2 : 1];
          if (winner.starmons.some(mon => mon.hp > 0) && !loser.starmons.some(mon => mon.hp > 0)) {
            endGame(match, targetCode, 'winner', auth.slot);
          }
          break;
        }

        case 'PVP_ACTION': {
          const targetCode = normalizeRoomCode(msg.room_code || currentRoomCode || '');
          if (targetCode) {
            broadcastToRoom(targetCode, { type: 'OPPONENT_ACTION', action: msg.action }, ws);
          }
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.warn('WS Message Error:', e);
    }
  });

  ws.on('close', () => {
    const socketAuth = pvpBattleSocketAuth.get(ws);
    if (socketAuth) {
      const match = currentRoomCode ? activeMatchStates.get(currentRoomCode) : undefined;
      const player = match?.players[socketAuth.slot];
      if (player?.socket === ws) player.socket = null;
      const accountSockets = pvpBattleSocketsByUsername.get(socketAuth.username.toLowerCase());
      accountSockets?.delete(ws);
      if (accountSockets?.size === 0) pvpBattleSocketsByUsername.delete(socketAuth.username.toLowerCase());
      pvpBattleSocketAuth.delete(ws);
    }
    if (currentRoomCode && roomClients.has(currentRoomCode)) {
      const clients = roomClients.get(currentRoomCode)!;
      clients.delete(ws);
      if (clients.size === 0) {
        roomClients.delete(currentRoomCode);
      }
    }
  });
});

// API: Get active PvP Rooms
app.post('/api/pvp-auth/register', async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username) || password.length < 8 || password.length > 256) {
    return res.status(400).json({ error: 'Tên đăng nhập phải dài 3–24 ký tự; mật khẩu tối thiểu 8 ký tự.' });
  }
  const key = username.toLowerCase();
  const salt = randomBytes(16).toString('hex');
  const account: PvpAuthAccount = {
    username: key,
    password_salt: salt,
    password_hash: scryptSync(password, salt, 64).toString('hex'),
    active_device_id: null,
    active_session_hash: null,
  };
  try {
    if (!serverSupabase) {
      if (localPvpAuthAccounts.has(key)) return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại.' });
      localPvpAuthAccounts.set(key, account);
    } else {
      const { error } = await serverSupabase.from('pvp_auth_accounts').insert(account);
      if (error?.code === '23505') return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại.' });
      if (error) throw error;
    }
    return res.status(201).json({ username: account.username });
  } catch (error) {
    console.error('PvP account registration failed:', error);
    return res.status(503).json({ error: 'Không thể tạo tài khoản PvP lúc này.' });
  }
});

app.post('/api/pvp-auth/login', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const deviceId = String(req.body?.device_id || '');
  if (!username || !deviceId || deviceId.length > 128 || !password || password.length > 256) {
    return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
  }
  try {
    const account = await getPvpAuthAccount(username);
    if (!account || !verifyPassword(password, account)) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }
    if (account.active_device_id && account.active_device_id !== deviceId) {
      return res.status(409).json({ error: 'Tài khoản đang đăng nhập trên thiết bị khác. Hãy đăng xuất ở thiết bị đó trước.' });
    }
    const token = randomBytes(32).toString('hex');
    const sessionHash = hashPvpSession(token);
    if (!serverSupabase) {
      account.active_device_id = deviceId;
      account.active_session_hash = sessionHash;
    } else {
      // Atomic claim: one device can own this username at a time.
      const { data: claimed, error: claimError } = await serverSupabase
        .from('pvp_auth_accounts')
        .update({ active_device_id: deviceId, active_session_hash: sessionHash })
        .eq('username', username).is('active_device_id', null).select('username').maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) {
        const { data: sameDevice, error: sameDeviceError } = await serverSupabase
          .from('pvp_auth_accounts')
          .update({ active_session_hash: sessionHash })
          .eq('username', username).eq('active_device_id', deviceId).select('username').maybeSingle();
        if (sameDeviceError) throw sameDeviceError;
        if (!sameDevice) return res.status(409).json({ error: 'Tài khoản đang đăng nhập trên thiết bị khác. Hãy đăng xuất ở thiết bị đó trước.' });
      }
    }
    return res.json({ username: account.username, sessionToken: token, deviceId });
  } catch (error) {
    console.error('PvP login failed:', error);
    return res.status(503).json({ error: 'Không thể đăng nhập PvP lúc này.' });
  }
});

app.post('/api/pvp-auth/verify', async (req, res) => {
  try {
    const username = await verifyPvpSession(
      String(req.body?.username || '').trim().toLowerCase(),
      String(req.body?.device_id || ''),
      String(req.body?.session_token || '')
    );
    return username ? res.json({ username }) : res.status(401).json({ error: 'Phiên đăng nhập PvP không còn hợp lệ.' });
  } catch (error) {
    console.error('PvP session validation failed:', error);
    return res.status(503).json({ error: 'Không thể xác minh phiên PvP lúc này.' });
  }
});

app.post('/api/pvp-auth/logout', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const deviceId = String(req.body?.device_id || '');
  const token = String(req.body?.session_token || '');
  try {
    if (!serverSupabase) {
      const account = localPvpAuthAccounts.get(username);
      if (account?.active_device_id === deviceId && account.active_session_hash === hashPvpSession(token)) {
        account.active_device_id = null;
        account.active_session_hash = null;
      }
    } else {
      const { error } = await serverSupabase.from('pvp_auth_accounts')
        .update({ active_device_id: null, active_session_hash: null })
        .eq('username', username).eq('active_device_id', deviceId)
        .eq('active_session_hash', hashPvpSession(token));
      if (error) throw error;
    }
    const accountSockets = pvpBattleSocketsByUsername.get(username);
    if (accountSockets) {
      for (const socket of accountSockets) {
        if (socket.readyState === WebSocket.OPEN) socket.close(4001, 'PvP logout');
      }
      pvpBattleSocketsByUsername.delete(username);
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('PvP logout failed:', error);
    return res.status(503).json({ error: 'Không thể đăng xuất PvP lúc này.' });
  }
});

app.get('/api/rooms', async (_req, res) => {
  activeRooms = loadRooms();
  // Filter out any abandoned rooms older than 24 hours
  const now = Date.now();
  activeRooms = activeRooms.filter(r => (now - (r.createdAt || now)) < 86400000 && r.status === 'WAITING');
  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase.from('pvp_rooms').select('*')
        .eq('status', 'WAITING').gte('created_at', now - 86400000).limit(500);
      if (error) {
        console.error('Supabase room list lookup failed:', error.message);
        return res.status(503).json({
          error: 'Không thể tải danh sách phòng từ kho dùng chung. Kiểm tra quyền SELECT trên public.pvp_rooms.',
          code: 'PVP_ROOM_STORE_UNAVAILABLE',
        });
      }
      const byCode = new Map<string, PvpRoom>();
      if (!requiresSharedRoomStore) {
        activeRooms.forEach(room => byCode.set(normalizeRoomCode(room.room_code || room.code), room));
      }
      (data || []).forEach(row => {
        const room = pvpRoomFromSupabaseRow(row);
        byCode.set(normalizeRoomCode(room.room_code || room.code), room);
      });
      return res.json(Array.from(byCode.values()));
    } catch (error) {
      console.error('Supabase room list lookup failed:', error);
      return res.status(503).json({ error: 'Không thể kết nối kho phòng PvP dùng chung.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
    }
  }
  if (requiresSharedRoomStore) {
    return res.status(503).json({ error: 'Máy chủ chưa được cấu hình kho phòng Supabase dùng chung.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
  }
  res.json(activeRooms);
});

// API: Get specific PvP Room by code
app.get('/api/rooms/:code', async (req, res) => {
  const targetCode = normalizeRoomCode(req.params.code || '');
  activeRooms = loadRooms();
  let room = activeRooms.find(r => normalizeRoomCode(r.room_code || r.code) === targetCode);
  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase.from('pvp_rooms').select('*').eq('room_code', targetCode).maybeSingle();
      if (error) return res.status(503).json({ error: 'Không thể tra cứu phòng trong Supabase.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
      room = data ? pvpRoomFromSupabaseRow(data) : null;
    } catch (error) {
      console.error('Supabase room lookup failed:', error);
      return res.status(503).json({ error: 'Không thể kết nối kho phòng PvP dùng chung.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
    }
  } else if (requiresSharedRoomStore) {
    return res.status(503).json({ error: 'Máy chủ chưa được cấu hình kho phòng Supabase dùng chung.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
  }

  if (room) {
    res.json(room);
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

// API: Create new PvP Room (generates 6-digit code or supports custom code)
app.post('/api/rooms/create', async (req, res) => {
  let authenticatedUsername: string | null;
  try {
    authenticatedUsername = await verifyPvpSession(
      String(req.body?.username || ''), String(req.body?.device_id || ''), String(req.body?.auth_token || '')
    );
  } catch (error) {
    console.error('PvP room creation authentication failed:', error);
    return res.status(503).json({ error: 'Không thể xác minh đăng nhập PvP lúc này.' });
  }
  if (!authenticatedUsername) return res.status(401).json({ error: 'Vui lòng đăng nhập tài khoản PvP trước khi tạo phòng.' });
  if (requiresSharedRoomStore && !serverSupabase) {
    return res.status(503).json({ error: 'Máy chủ PvP chưa có SUPABASE_SERVICE_ROLE_KEY nên không thể lưu phòng dùng chung.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
  }
  const {
    host_id,
    host_name,
    hostName,
    host_level,
    hostLevel,
    arena = 'Sunken Sands',
    custom_code,
    customCode,
    starmons = [],
    players = [],
  } = req.body;

  let code = '';
  const rawCustom = custom_code || customCode || req.body.room_code || req.body.code;
  if (rawCustom && typeof rawCustom === 'string' && rawCustom.trim()) {
    code = rawCustom.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  }
  if (!code) {
    // Generate clean 6-digit room code as requested
    code = Math.floor(100000 + Math.random() * 900000).toString();
  }

  activeRooms = loadRooms();
  const normNewCode = normalizeRoomCode(code);
  let existingRoom = activeRooms.find(r => normalizeRoomCode(r.room_code || r.code) === normNewCode);
  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase.from('pvp_rooms').select('room_code')
        .eq('room_code', normNewCode).maybeSingle();
      if (error) {
        console.error('Supabase duplicate room lookup failed:', error.message);
        return res.status(503).json({ error: 'Không thể kiểm tra mã phòng trong Supabase.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
      }
      if (data) existingRoom = { room_code: normNewCode } as PvpRoom;
    } catch (error) {
      console.error('Supabase duplicate room lookup failed:', error);
      return res.status(503).json({ error: 'Không thể kết nối kho phòng PvP dùng chung.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
    }
  }
  if (existingRoom) {
    return res.status(409).json({ error: `Mã phòng ${code} đang được sử dụng. Hãy chọn mã khác.` });
  }
  // Clear any existing match state for this room code
  activeMatchStates.delete(normNewCode);

  const finalHostId = authenticatedUsername;
  const finalHostName = authenticatedUsername;
  const finalHostLevel = host_level || hostLevel || req.body.hostLevel || 1;

  const partyStarmons = Array.isArray(starmons) && starmons.length > 0
    ? starmons
    : (Array.isArray(players) && players[0]?.starmons && players[0].starmons.length > 0 ? players[0].starmons : []);

  const hostPlayer: PlayerInRoom = {
    id: finalHostId,
    name: finalHostName,
    level: finalHostLevel,
    isHost: true,
    isReady: true,
    starmons: partyStarmons,
  };

  const newRoom: PvpRoom = {
    room_code: code,
    code,
    host_id: finalHostId,
    hostName: finalHostName,
    hostLevel: finalHostLevel,
    arena: arena || req.body.arena || 'Sunken Sands',
    status: 'WAITING',
    players: [hostPlayer],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const persisted = await persistRoomToSupabase(newRoom, true);
  if (!persisted.success) {
    if (persisted.error?.code === '23505') {
      return res.status(409).json({ error: `Mã phòng ${code} đang được sử dụng. Hãy chọn mã khác.` });
    }
    return res.status(503).json({
      error: 'Không lưu được phòng lên Supabase. Kiểm tra quyền INSERT và UPDATE cho service_role trên public.pvp_rooms.',
      code: 'PVP_ROOM_STORE_WRITE_FAILED',
    });
  }
  activeRooms.unshift(newRoom);
  saveRooms(activeRooms);
  broadcastRoomList();
  res.json(newRoom);
});

// API: Join PvP Room by code (strict check: exists, WAITING status, not full)
app.post('/api/rooms/join', async (req, res) => {
  let authenticatedUsername: string | null;
  try {
    authenticatedUsername = await verifyPvpSession(
      String(req.body?.username || ''), String(req.body?.device_id || ''), String(req.body?.auth_token || '')
    );
  } catch (error) {
    console.error('PvP room join authentication failed:', error);
    return res.status(503).json({ error: 'Không thể xác minh đăng nhập PvP lúc này.' });
  }
  if (!authenticatedUsername) return res.status(401).json({ error: 'Vui lòng đăng nhập tài khoản PvP trước khi vào phòng.' });
  if (requiresSharedRoomStore && !serverSupabase) {
    return res.status(503).json({ error: 'Máy chủ PvP chưa có SUPABASE_SERVICE_ROLE_KEY nên không thể tra cứu phòng dùng chung.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
  }
  const {
    room_code,
    code,
    user_id,
    user_name,
    guestName,
    user_level,
    guestLevel,
    starmons = [],
  } = req.body;

  const rawInput = (room_code || code || '').toString().trim();
  const normalizedInput = normalizeRoomCode(rawInput);

  if (!normalizedInput) {
    return res.status(400).json({ error: 'Vui lòng nhập mã phòng.' });
  }

  // Always load latest rooms from disk
  activeRooms = loadRooms();
  let room = activeRooms.find(r => normalizeRoomCode(r.room_code || r.code) === normalizedInput);

  // Supabase is authoritative for Cloud Run instances; each instance has its
  // own local filesystem and can otherwise mistake another instance's room
  // for a missing code.
  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase.from('pvp_rooms').select('*')
        .eq('room_code', normalizedInput).maybeSingle();
      if (error) {
        console.error('Supabase room lookup failed:', {
          code: error.code,
          message: error.message,
          hint: error.hint,
        });
        // A database permission/configuration failure is not the same as an
        // unknown room code. Return a service error so the client can show
        // the actual problem instead of asking the player to recheck the code.
        if (error.code === '42501' || /permission denied|row-level security/i.test(error.message)) {
          return res.status(503).json({
            error: 'Backend chưa có quyền đọc bảng pvp_rooms trong Supabase. Hãy áp dụng grant/policy cho bảng và kiểm tra SUPABASE_SERVICE_ROLE_KEY trên Cloud Run.',
            code: 'PVP_ROOM_STORE_PERMISSION_DENIED',
          });
        }
        return res.status(503).json({
          error: 'Không thể kiểm tra phòng trong Supabase lúc này. Vui lòng thử lại sau.',
          code: 'PVP_ROOM_STORE_UNAVAILABLE',
        });
      }
      if (data) {
        room = pvpRoomFromSupabaseRow(data);
        const localIndex = activeRooms.findIndex(r => normalizeRoomCode(r.room_code || r.code) === normalizedInput);
        if (localIndex >= 0) activeRooms[localIndex] = room;
        else activeRooms.unshift(room);
      } else if (requiresSharedRoomStore) {
        room = undefined;
      }
    } catch (error) {
      console.error('Could not resolve PvP room from Supabase:', error);
      return res.status(503).json({
        error: 'Không thể kết nối kho phòng PvP dùng chung. Vui lòng thử lại sau.',
        code: 'PVP_ROOM_STORE_UNAVAILABLE',
      });
    }
  } else if (requiresSharedRoomStore) {
    return res.status(503).json({ error: 'Máy chủ PvP chưa được cấu hình Supabase dùng chung.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
  }

  if (!room) {
    return res.status(404).json({ error: `Phòng "${rawInput}" không tồn tại hoặc đã bị hủy. Vui lòng kiểm tra lại!` });
  }
  const roomBeforeJoin = JSON.parse(JSON.stringify(room)) as PvpRoom;

  let finalUserId = authenticatedUsername;
  let finalUserName = authenticatedUsername;
  const finalUserLevel = user_level || guestLevel || 1;

  if (finalUserId.toLowerCase() === String(room.host_id || '').toLowerCase()) {
    return res.status(409).json({ error: 'Chủ phòng không thể tham gia lại bằng cùng tài khoản. Hãy dùng tài khoản khác cho người chơi 2.' });
  }

  // Check if challenger is reconnecting (never match or overwrite the host slot)
  const existingPlayerIndex = room.players.findIndex(p => !p.isHost && p.id.toLowerCase() === finalUserId.toLowerCase());
  const isAlreadyInRoom = existingPlayerIndex !== -1;

  if (isAlreadyInRoom) {
    // Player is reconnecting/refreshing in this room
    room.players[existingPlayerIndex] = {
      ...room.players[existingPlayerIndex],
      id: finalUserId,
      name: finalUserName,
      level: finalUserLevel,
      isHost: room.players[existingPlayerIndex].isHost || false,
      isReady: true,
      starmons: Array.isArray(starmons) && starmons.length > 0 ? starmons : room.players[existingPlayerIndex].starmons,
    };
  } else {
    if (room.status !== 'WAITING') {
      return res.status(400).json({ error: `Phòng "${rawInput}" đã bắt đầu trận đấu hoặc đã kết thúc!` });
    }
    if (room.players.length >= 2) {
      return res.status(400).json({ error: `Phòng "${rawInput}" đã đầy (tối đa 2 người chơi)!` });
    }
    const challengerPlayer: PlayerInRoom = {
      id: finalUserId,
      name: finalUserName,
      level: finalUserLevel,
      isHost: false,
      isReady: true,
      starmons: Array.isArray(starmons) && starmons.length > 0 ? starmons : [],
    };
    room.players.push(challengerPlayer);
  }

  room.guestName = finalUserName;
  room.guestLevel = finalUserLevel;
  room.status = 'IN_GAME';
  room.updatedAt = Date.now();

  const persisted = await persistRoomToSupabase(room, false, false, {
    updatedAt: roomBeforeJoin.updatedAt,
    status: isAlreadyInRoom ? roomBeforeJoin.status : 'WAITING',
  });
  if (!persisted.success) {
    activeRooms = loadRooms();
    if (persisted.error?.code === 'PVP_ROOM_CONFLICT') {
      return res.status(409).json({ error: 'Phòng vừa có người khác tham gia hoặc thay đổi. Hãy làm mới danh sách phòng.', code: 'PVP_ROOM_CHANGED' });
    }
    return res.status(503).json({
      error: 'Không lưu được trạng thái phòng lên Supabase. Kiểm tra quyền INSERT và UPDATE cho service_role trên public.pvp_rooms.',
      code: 'PVP_ROOM_STORE_WRITE_FAILED',
    });
  }
  saveRooms(activeRooms);
  const normCode = normalizeRoomCode(room.room_code || room.code);
  const isNewMatch = !activeMatchStates.has(normCode);
  const match = isNewMatch ? initializeMatchForRoom(room) : activeMatchStates.get(normCode)!;
  if (!isNewMatch) {
    match.players[2].id = finalUserId;
    match.players[2].name = finalUserName;
    if (Array.isArray(starmons) && starmons.length > 0 && match.turn === 1 && match.subPhase === 1) {
      match.players[2].starmons = createDefaultStarmonsForSlot(2, starmons);
      if (match.sharedBoard) {
        match.sharedBoard.starmons[2] = match.players[2].starmons;
      }
    }
  }
  const ownsRuntime = await ensurePvpRuntimeOwner(match);
  if (!ownsRuntime && !match.runtimeOwnerId) {
    const failedWriteUpdatedAt = room.updatedAt;
    const rollbackRoom = { ...roomBeforeJoin, updatedAt: Math.max(Date.now(), failedWriteUpdatedAt + 1) };
    Object.assign(room, rollbackRoom);
    const roomIndex = activeRooms.findIndex(candidate => normalizeRoomCode(candidate.room_code || candidate.code) === normalizedInput);
    if (roomIndex >= 0) activeRooms[roomIndex] = room;
    else activeRooms.unshift(room);
    await persistRoomToSupabase(rollbackRoom, false, false, { updatedAt: failedWriteUpdatedAt, status: 'IN_GAME' });
    writeRoomsStore(activeRooms);
    if (isNewMatch) activeMatchStates.delete(normalizedInput);
    return res.status(503).json({ error: 'PvP chưa thể khởi động. Hãy triển khai hàm persist_pvp_runtime_state trong Supabase.', code: 'PVP_RUNTIME_LOCK_UNAVAILABLE' });
  }
  broadcastRoomList();
  broadcastToRoom(normCode, { type: 'ROOM_STATE_UPDATED', room });
  broadcastToRoom(normCode, { type: 'MATCH_STARTED', room, matchState: serializeMatchState(match), boardSnapshot: serializeBoard(match), board: match.board });
  broadcastToRoom(normCode, { type: 'match_start', room, matchState: serializeMatchState(match), boardSnapshot: serializeBoard(match), board: match.board });

  if (isNewMatch && ownsRuntime) {
    startTurn(match, normCode, 1);
  }

  res.json({
    success: true,
    room,
    matchState: serializeMatchState(match),
    joinedAsId: finalUserId,
    joinedAsName: finalUserName,
  });
});

// API: Start Match (called by Host when challenger is in room)
app.post('/api/rooms/start', async (req, res) => {
  let authenticatedUsername: string | null;
  try {
    authenticatedUsername = await verifyPvpSession(
      String(req.body?.username || ''), String(req.body?.device_id || ''), String(req.body?.auth_token || '')
    );
  } catch (error) {
    console.error('PvP match start authentication failed:', error);
    return res.status(503).json({ error: 'Không thể xác minh đăng nhập PvP lúc này.' });
  }
  if (!authenticatedUsername) return res.status(401).json({ error: 'Vui lòng đăng nhập trước khi bắt đầu trận.' });
  if (requiresSharedRoomStore && !serverSupabase) {
    return res.status(503).json({ error: 'Máy chủ PvP chưa được cấu hình kho phòng Supabase dùng chung.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
  }
  const { room_code, code } = req.body;
  const rawInput = (room_code || code || '').toString().trim();
  const normalizedInput = normalizeRoomCode(rawInput);

  activeRooms = loadRooms();
  let room = activeRooms.find(r => normalizeRoomCode(r.room_code || r.code) === normalizedInput);
  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase.from('pvp_rooms').select('*').eq('room_code', normalizedInput).maybeSingle();
      if (error) return res.status(503).json({ error: 'Không thể tải trạng thái phòng từ Supabase.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
      if (data) {
        room = pvpRoomFromSupabaseRow(data);
        const localIndex = activeRooms.findIndex(r => normalizeRoomCode(r.room_code || r.code) === normalizedInput);
        if (localIndex >= 0) activeRooms[localIndex] = room;
        else activeRooms.unshift(room);
      } else if (requiresSharedRoomStore) room = undefined;
    } catch (error) {
      console.error('Could not load room before starting PvP match:', error);
      return res.status(503).json({ error: 'Không thể kết nối kho phòng PvP dùng chung.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
    }
  }

  if (!room) {
    return res.status(404).json({ error: 'Không tìm thấy phòng!' });
  }

  if (String(room.host_id || '').toLowerCase() !== authenticatedUsername.toLowerCase()) {
    return res.status(403).json({ error: 'Chỉ chủ phòng mới có thể bắt đầu trận.' });
  }

  if (room.players.length < 2) {
    return res.status(400).json({ error: 'Cần ít nhất 2 người chơi trong phòng để bắt đầu trận đấu!' });
  }

  const roomBeforeStart = JSON.parse(JSON.stringify(room)) as PvpRoom;
  room.status = 'IN_GAME';
  room.updatedAt = Date.now();

  const persisted = await persistRoomToSupabase(room, false, false, {
    updatedAt: roomBeforeStart.updatedAt,
    status: roomBeforeStart.status,
  });
  if (!persisted.success) {
    Object.assign(room, roomBeforeStart);
    if (persisted.error?.code === 'PVP_ROOM_CONFLICT') {
      return res.status(409).json({ error: 'Phòng vừa thay đổi. Hãy làm mới phòng trước khi bắt đầu.', code: 'PVP_ROOM_CHANGED' });
    }
    return res.status(503).json({ error: 'Không lưu được trạng thái phòng lên Supabase.', code: 'PVP_ROOM_STORE_WRITE_FAILED' });
  }

  saveRooms(activeRooms);
  const isNewMatch = !activeMatchStates.has(normalizedInput);
  const match = isNewMatch ? initializeMatchForRoom(room) : activeMatchStates.get(normalizedInput)!;
  const ownsRuntime = await ensurePvpRuntimeOwner(match);
  if (!ownsRuntime && !match.runtimeOwnerId) {
    const failedWriteUpdatedAt = room.updatedAt;
    const rollbackRoom = { ...roomBeforeStart, updatedAt: Math.max(Date.now(), failedWriteUpdatedAt + 1) };
    Object.assign(room, rollbackRoom);
    const roomIndex = activeRooms.findIndex(candidate => normalizeRoomCode(candidate.room_code || candidate.code) === normalizedInput);
    if (roomIndex >= 0) activeRooms[roomIndex] = room;
    else activeRooms.unshift(room);
    await persistRoomToSupabase(rollbackRoom, false, false, { updatedAt: failedWriteUpdatedAt, status: 'IN_GAME' });
    writeRoomsStore(activeRooms);
    if (isNewMatch) activeMatchStates.delete(normalizedInput);
    return res.status(503).json({ error: 'PvP chưa thể khởi động. Hãy triển khai hàm persist_pvp_runtime_state trong Supabase.', code: 'PVP_RUNTIME_LOCK_UNAVAILABLE' });
  }
  broadcastRoomList();
  broadcastToRoom(normalizedInput, { type: 'MATCH_STARTED', room, matchState: serializeMatchState(match), boardSnapshot: serializeBoard(match), board: match.board });
  broadcastToRoom(normalizedInput, { type: 'match_start', room, matchState: serializeMatchState(match), boardSnapshot: serializeBoard(match), board: match.board });
  if (isNewMatch && ownsRuntime) {
    startTurn(match, normalizedInput, 1);
  }

  res.json({ success: true, room, matchState: serializeMatchState(match) });
});

// API: Leave / Close Room
app.post('/api/rooms/leave', async (req, res) => {
  const { room_code, code } = req.body;
  let authenticatedUsername: string | null;
  try {
    authenticatedUsername = await verifyPvpSession(
      String(req.body?.username || ''), String(req.body?.device_id || ''), String(req.body?.auth_token || '')
    );
  } catch (error) {
    console.error('PvP room leave authentication failed:', error);
    return res.status(503).json({ error: 'Không thể xác minh đăng nhập PvP lúc này.' });
  }
  if (!authenticatedUsername) return res.status(401).json({ error: 'Vui lòng đăng nhập tài khoản PvP trước khi rời phòng.' });
  if (requiresSharedRoomStore && !serverSupabase) {
    return res.status(503).json({ error: 'Máy chủ PvP chưa được cấu hình kho phòng Supabase dùng chung.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
  }
  const rawInput = (room_code || code || '').toString().trim();
  const normalizedInput = normalizeRoomCode(rawInput);

  activeRooms = loadRooms();
  let room = activeRooms.find(r => normalizeRoomCode(r.room_code || r.code) === normalizedInput);
  if (serverSupabase) {
    try {
      const { data, error } = await serverSupabase.from('pvp_rooms').select('*').eq('room_code', normalizedInput).maybeSingle();
      if (error) return res.status(503).json({ error: 'Không thể tải trạng thái phòng từ Supabase.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
      if (!data) room = undefined;
      else {
        room = pvpRoomFromSupabaseRow(data);
        const localIndex = activeRooms.findIndex(r => normalizeRoomCode(r.room_code || r.code) === normalizedInput);
        if (localIndex >= 0) activeRooms[localIndex] = room;
        else activeRooms.unshift(room);
      }
    } catch (error) {
      console.error('Could not load room before leaving PvP room:', error);
      return res.status(503).json({ error: 'Không thể kết nối kho phòng PvP dùng chung.', code: 'PVP_ROOM_STORE_UNAVAILABLE' });
    }
  }

  if (room) {
    const isHost = authenticatedUsername.toLowerCase() === String(room.host_id || '').toLowerCase();
    const isRoomMember = room.players.some(player => String(player.id || '').toLowerCase() === authenticatedUsername.toLowerCase());
    if (!isRoomMember) return res.status(403).json({ error: 'Tài khoản này không thuộc phòng PvP.' });
    if (isHost) {
      // Host leaves: close room
      const deleted = await deleteRoomFromSupabase(normalizedInput, {
        updatedAt: room.updatedAt,
        status: room.status,
      });
      if (!deleted.success) {
        if (deleted.error?.code === 'PVP_ROOM_CONFLICT') {
          return res.status(409).json({ error: 'Phòng vừa thay đổi. Hãy làm mới trước khi đóng phòng.', code: 'PVP_ROOM_CHANGED' });
        }
        return res.status(503).json({ error: 'Không thể xóa phòng khỏi Supabase.', code: 'PVP_ROOM_STORE_WRITE_FAILED' });
      }
      room.status = 'FINISHED';
      activeRooms = activeRooms.filter(r => normalizeRoomCode(r.room_code || r.code) !== normalizedInput);
      stopPvpRuntime(normalizedInput);
      saveRooms(activeRooms);
      broadcastToRoom(room.room_code, { type: 'ROOM_CLOSED', room_code: room.room_code });
    } else {
      // Guest leaves
      const roomBeforeLeave = JSON.parse(JSON.stringify(room)) as PvpRoom;
      room.players = room.players.filter(p => String(p.id || '').toLowerCase() !== authenticatedUsername!.toLowerCase());
      room.guestName = undefined;
      room.status = 'WAITING';
      room.updatedAt = Date.now();
      const persisted = await persistRoomToSupabase(room, false, true, {
        updatedAt: roomBeforeLeave.updatedAt,
        status: roomBeforeLeave.status,
      });
      if (!persisted.success) {
        Object.assign(room, roomBeforeLeave);
        if (persisted.error?.code === 'PVP_ROOM_CONFLICT') {
          return res.status(409).json({ error: 'Phòng vừa thay đổi. Hãy làm mới trạng thái phòng.', code: 'PVP_ROOM_CHANGED' });
        }
        return res.status(503).json({ error: 'Không lưu được trạng thái phòng lên Supabase.', code: 'PVP_ROOM_STORE_WRITE_FAILED' });
      }
      stopPvpRuntime(normalizedInput);
      saveRooms(activeRooms);
      broadcastToRoom(room.room_code, { type: 'ROOM_STATE_UPDATED', room });
    }
    broadcastRoomList();
  }

  res.json({ success: true });
});

// ==========================================
// CENTRALIZED ACCOUNTS SYNCHRONIZATION APIS
// ==========================================

// API: Get all accounts synchronized centrally
app.get('/api/accounts', (_req, res) => {
  serverAccounts = loadAccounts();
  const accountsList = getUniqueAccountsList(serverAccounts);
  // Return indexed map with all lookup keys, as well as accounts array
  const responseObj: any = {};
  for (const acc of accountsList) {
    const key = (acc.googleId || acc.email || acc.username || '').toLowerCase();
    if (key) responseObj[key] = acc;
    if (acc.username) responseObj[acc.username.toLowerCase()] = acc;
    if (acc.email) responseObj[acc.email.toLowerCase()] = acc;
    if (acc.googleId) responseObj[acc.googleId.toLowerCase()] = acc;
  }
  // Also expose accounts array
  responseObj.accounts = accountsList;
  res.json(responseObj);
});

// API: Get specific account by username, Google ID, or email
app.get('/api/accounts/:id', (req, res) => {
  const targetId = (req.params.id || '').trim().toLowerCase();
  serverAccounts = loadAccounts();
  const account = serverAccounts[targetId] ||
    Object.values(serverAccounts).find(a =>
      (a.googleId && a.googleId.toLowerCase() === targetId) ||
      (a.email && a.email.toLowerCase() === targetId) ||
      (a.username && a.username.toLowerCase() === targetId)
    );

  if (account) {
    res.json(account);
  } else {
    res.status(404).json({ error: 'Account not found' });
  }
});

// API: Save / Sync account centrally
app.post('/api/accounts/sync', (req, res) => {
  const accountData: ServerUserAccount = req.body;
  if (!accountData || (!accountData.username && !accountData.googleId && !accountData.email)) {
    return res.status(400).json({ error: 'Username, Google ID, or Email is required to sync account' });
  }

  const rawKey = (accountData.googleId || accountData.email || accountData.username || 'user').trim().toLowerCase();
  serverAccounts = loadAccounts();

  const existing = serverAccounts[rawKey] || Object.values(serverAccounts).find(a =>
    Boolean(
      (accountData.googleId && a.googleId && a.googleId.toLowerCase() === accountData.googleId.toLowerCase()) ||
      (accountData.email && a.email && a.email.toLowerCase() === accountData.email.toLowerCase()) ||
      (accountData.username && accountData.username.toLowerCase() !== 'player' && a.username && a.username.toLowerCase() === accountData.username.toLowerCase())
    )
  );

  const updatedAccount: ServerUserAccount = {
    ...(existing || {}),
    ...accountData,
    username: accountData.username || existing?.username || rawKey,
    googleId: accountData.googleId || existing?.googleId,
    email: accountData.email || existing?.email,
    lastPlayedAt: new Date().toISOString(),
    createdAt: existing?.createdAt || accountData.createdAt || new Date().toISOString(),
  };

  serverAccounts[rawKey] = updatedAccount;
  if (accountData.googleId) {
    serverAccounts[accountData.googleId.toLowerCase()] = updatedAccount;
  }
  if (accountData.email) {
    serverAccounts[accountData.email.toLowerCase()] = updatedAccount;
  }
  if (accountData.username && accountData.username.toLowerCase() !== 'player') {
    serverAccounts[accountData.username.toLowerCase()] = updatedAccount;
  }

  saveAccounts(serverAccounts);
  broadcastAccounts();

  res.json({ success: true, account: updatedAccount });
});

// API: Reset account progress to starting point (Level 1, 0 gold, 2 starter packs, 0 starmons)
app.post('/api/accounts/reset', (req, res) => {
  const { username, googleId } = req.body || {};
  serverAccounts = loadAccounts();
  const searchKey = (googleId || username || '').trim().toLowerCase();
  const existingAccount = serverAccounts[searchKey] || Object.values(serverAccounts).find(a =>
    (googleId && a.googleId?.toLowerCase() === googleId.toLowerCase()) ||
    (username && a.username?.toLowerCase() === username.toLowerCase())
  );
  const redeemedCodes = Array.isArray(existingAccount?.player?.redeemedCodes)
    ? existingAccount.player.redeemedCodes
    : [];
  const uname = username || 'Player';
  const cleanAccount: ServerUserAccount = {
    username: uname,
    googleId: googleId || '',
    email: '',
    createdAt: new Date().toISOString(),
    lastPlayedAt: new Date().toISOString(),
    player: {
      name: uname,
      username: uname,
      googleId: googleId || '',
      level: 1,
      exp: 0,
      nextExp: 100,
      gold: 0,
      gems: 0,
      starterPacksCount: 2,
      isNewPlayer: true,
      hasClaimedBeginnerPack: false,
      hasCompletedOnboardingTutorial: false,
      hasClaimedTutorial1Reward: false,
      completedTutorialStages: [],
      redeemedCodes,
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

  if (searchKey) {
    for (const [k, acc] of Object.entries(serverAccounts)) {
      if (
        k === searchKey ||
        (googleId && acc.googleId && acc.googleId.toLowerCase() === googleId.toLowerCase()) ||
        (username && acc.username && acc.username.toLowerCase() === username.toLowerCase())
      ) {
        serverAccounts[k] = cleanAccount;
      }
    }
    serverAccounts[searchKey] = cleanAccount;
  }
  saveAccounts(serverAccounts);
  broadcastAccounts();
  res.json({ success: true, account: cleanAccount });
});

// API: Google Sign-in / Direct Google Account Provisioning
app.post('/api/accounts/google-auth', (req, res) => {
  const { googleId, email, name, player, starmons, quests } = req.body;
  if (!googleId && !email) {
    return res.status(400).json({ error: 'Google ID or Email is required' });
  }

  serverAccounts = loadAccounts();
  const searchKey = (googleId || email || '').trim().toLowerCase();
  const existing = serverAccounts[searchKey] || Object.values(serverAccounts).find(a =>
    Boolean(
      (googleId && a.googleId && a.googleId.toLowerCase() === googleId.toLowerCase()) ||
      (email && a.email && a.email.toLowerCase() === email.toLowerCase())
    )
  );

  if (existing) {
    existing.lastPlayedAt = new Date().toISOString();
    if (player) existing.player = { ...existing.player, ...player };
    if (starmons && starmons.length > 0) existing.starmons = starmons;
    if (quests && quests.length > 0) existing.quests = quests;
    saveAccounts(serverAccounts);
    broadcastAccounts();
    return res.json({ success: true, account: existing, isNew: false });
  }

  // Create fresh Google account centrally
  const displayName = name || (email ? email.split('@')[0] : 'Google Trainer');
  const cleanKey = searchKey;

  const newAccount: ServerUserAccount = {
    username: displayName,
    googleId: googleId || searchKey,
    email: email || undefined,
    createdAt: new Date().toISOString(),
    lastPlayedAt: new Date().toISOString(),
    player: player || {
      name: displayName,
      username: displayName,
      googleId: googleId || searchKey,
      googleEmail: email,
      level: 1,
      exp: 0,
      nextExp: 100,
      gold: 0,
      gems: 0,
      starterPacksCount: 2,
      isNewPlayer: true,
      hasClaimedBeginnerPack: false,
      hasCompletedOnboardingTutorial: false,
      activeCompanionId: '',
      battleParty: [],
      mailUnreadCount: 1,
      soundEnabled: true,
      musicEnabled: true,
      showSpeakingHints: false,
      quizQuestionMode: 'speaking_only',
      graphicsQuality: 'High',
    },
    starmons: starmons || [],
    quests: quests || [],
  };

  serverAccounts[cleanKey] = newAccount;
  if (email && email.toLowerCase() !== cleanKey) {
    serverAccounts[email.toLowerCase()] = newAccount;
  }
  if (googleId && googleId.toLowerCase() !== cleanKey) {
    serverAccounts[googleId.toLowerCase()] = newAccount;
  }

  saveAccounts(serverAccounts);
  broadcastAccounts();
  res.json({ success: true, account: newAccount, isNew: true });
});

const ADVANCED_SPEAKING_VOCAB = [
  'sustainable development', 'renewable energy', 'carbon footprint', 'climate change', 'biodiversity', 'artificial intelligence',
  'critical thinking', 'broaden my horizons', 'a double-edged sword', 'plays a pivotal role', 'quality of life', 'work-life balance',
  'mental well-being', 'public transportation', 'economic growth', 'cultural heritage', 'social media', 'cutting-edge technology',
  'make ends meet', 'once in a blue moon', 'the best of both worlds', 'pose a threat', 'raise awareness', 'take for granted',
  'fast-paced lifestyle', 'lifelong learning', 'sense of accomplishment', 'strong sense of community', 'limited access to',
  'highly competitive', 'gain practical experience', 'heavily dependent on', 'address the issue', 'in the long run', 'from my perspective',
  'a wide range of', 'significant impact', 'deep-rooted', 'cost-effective', 'time-consuming', 'user-friendly', 'energy-efficient',
];

function countAdvancedSpeakingVocab(transcript: string): number {
  return ADVANCED_SPEAKING_VOCAB.filter(phrase => {
    const escaped = phrase.split('').map(char => /[.*+?^${}()|[\]\\]/.test(char) ? `\\${char}` : char).join('').replace(/\s+/g, '\\s+');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(transcript);
  }).length;
}

function countRepeatedPromptKeywords(question: string, transcript: string): number {
  const stopWords = new Set(['a', 'an', 'and', 'are', 'be', 'do', 'does', 'did', 'for', 'from', 'how', 'in', 'is', 'it', 'like', 'of', 'on', 'or', 'the', 'to', 'what', 'when', 'where', 'which', 'who', 'why', 'you', 'your']);
  const keywords = [...new Set((question.toLowerCase().match(/[a-z]+/g) || []).filter(word => word.length > 2 && !stopWords.has(word)))];
  return keywords.reduce((count, word) => count + ((transcript.toLowerCase().match(new RegExp(`\\b${word}(?:s|es)?\\b`, 'g')) || []).length), 0);
}

function getSpeakingRatePenalty(wordCount: number, durationSeconds: number): number {
  if (!(durationSeconds > 0)) return 0;
  const wordsPerMinute = wordCount * 60 / durationSeconds;
  return wordsPerMinute < 60 ? 2 : wordsPerMinute < 70 ? 1.5 : wordsPerMinute < 80 ? 1 : wordsPerMinute < 90 ? 0.5 : 0;
}

function getGeminiApiKeys(): string[] {
  const fallbackKeys = (process.env.GEMINI_FALLBACK_API_KEYS || '').split(',');
  return [...new Set([process.env.GEMINI_API_KEY, ...fallbackKeys].map(key => key?.trim()).filter((key): key is string => Boolean(key)))];
}

function stripJsonFences(text: string): string {
  return text.replace(/```json/gi, '').replace(/```/g, '').trim();
}

/** Use a separate provider when Gemini is unavailable or rate limited. */
async function generateAiJson(prompt: string): Promise<string> {
  let lastError: unknown;
  for (const [index, apiKey] of getGeminiApiKeys().entries()) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        contents: prompt,
      });
      const text = response.text?.trim();
      if (!text) throw new Error('Gemini returned an empty response');
      if (index > 0) console.info(`[AI] Recovered with Gemini fallback key ${index + 1}`);
      return stripJsonFences(text);
    } catch (error) {
      lastError = error;
      console.warn(`[AI] Gemini provider ${index + 1} failed; trying the next configured provider.`);
    }
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_FALLBACK_MODEL || 'gpt-5-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const providerError = await response.text();
        throw new Error(`OpenAI fallback returned ${response.status}: ${providerError.slice(0, 300)}`);
      }
      const data = await response.json() as any;
      const text = data?.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new Error('OpenAI returned an empty response');
      console.info('[AI] Recovered with OpenAI fallback provider.');
      return stripJsonFences(text);
    } catch (error) {
      lastError = error;
      console.error('[AI] OpenAI fallback provider failed.');
    }
  }

  throw lastError instanceof Error ? lastError : new Error('No AI provider is configured or available');
}

// API: Evaluate IELTS Speaking with Gemini API
app.post('/api/evaluate-speaking', async (req, res) => {
  try {
    const {
      question,
      transcript,
      targetBand = 5.0,
      pauses = [],
      hesitations = [],
      stutters = [],
      durationSeconds = 0,
    } = req.body;

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const trimmedTranscript = transcript.trim();
    const words = trimmedTranscript.split(/\s+/);
    const wordCount = words.length;

    // Helper: Round DOWN strictly to the nearest 0.5 step (e.g. 7.7 -> 7.5, 7.4 -> 7.0)
    const floorToHalf = (num: number): number => Math.floor(num * 2) / 2;

    // Detect natural speech fluency metrics from transcript and telemetry
    const detectedStutters: string[] = [];
    const lowerText = trimmedTranscript.toLowerCase();
    // Detect immediate duplicated words (e.g. "I I", "the the", "because because", "it it's")
    const repeatRegex = /\b([a-zA-Z]{1,12})\s+\1\b/gi;
    let match: RegExpExecArray | null;
    while ((match = repeatRegex.exec(trimmedTranscript)) !== null) {
      detectedStutters.push(`Lặp từ "${match[0]}"`);
    }
    // Also include any telemetry passed from client speech recognition
    if (Array.isArray(stutters)) {
      stutters.forEach((s: any) => {
        if (typeof s === 'string' && !detectedStutters.includes(s)) detectedStutters.push(s);
      });
    }

    const detectedHesitations: string[] = [];
    const hesitationTokens = ['um', 'uh', 'er', 'ah', 'umm', 'uhh'];
    words.forEach(w => {
      const cleanW = w.toLowerCase().replace(/[^a-z]/g, '');
      if (hesitationTokens.includes(cleanW)) {
        detectedHesitations.push(`Từ đệm ngập ngừng "${w}"`);
      }
    });
    if (Array.isArray(hesitations)) {
      hesitations.forEach((h: any) => {
        if (typeof h === 'string' && !detectedHesitations.includes(h)) detectedHesitations.push(h);
      });
    }

    const pauseCount = typeof pauses === 'number' ? pauses : Array.isArray(pauses) ? pauses.length : 0;
    const stutterCount = detectedStutters.length;
    const hesitationCount = detectedHesitations.length;

    if (getGeminiApiKeys().length === 0 && !process.env.OPENAI_API_KEY) {
      // Precise Fallback Evaluation following the user's specific rules:
      // 1. Grammar: Default 6.5 to 7.5 if fairly natural and accurate.
      // Only penalize below 6.5 if severe errors (word form errors > 2 or missing subject/predicate).
      let baseGRA = 8.0;
      let severeGrammarErrorsCount = 0;

      const grammarErrors: Array<{
        sentence: string;
        error: string;
        correction: string;
        practice_structure: string;
        explanation: string;
      }> = [];

      // Check for sentence fragment / missing predicate or subject
      const sentences = trimmedTranscript.split(/[.?!]+/).map(s => s.trim()).filter(s => s.length > 0);
      sentences.forEach(s => {
        const sWords = s.split(/\s+/);
        if (sWords.length < 3 && sWords.length > 0 && !['yes', 'no', 'sure', 'of course'].includes(s.toLowerCase())) {
          severeGrammarErrorsCount++;
          grammarErrors.push({
            sentence: s,
            error: 'Câu cụt thiếu thành phần chủ ngữ hoặc vị ngữ hoàn chỉnh.',
            correction: `I think that ${s.toLowerCase()} is essential for my daily life.`,
            practice_structure: 'Cấu trúc câu hoàn chỉnh (Subject + Verb + Object/Complement)',
            explanation: 'Mỗi câu trong IELTS Speaking cần có ít nhất một chủ ngữ và một động từ vị ngữ để tạo thành mệnh đề độc lập có nghĩa.'
          });
        }
      });

      // Check word form error pattern (e.g. "I am very interest in", "he speaks very quick")
      if (lowerText.includes('very interest in') || lowerText.includes('more better') || lowerText.includes('is depend on')) {
        severeGrammarErrorsCount++;
        grammarErrors.push({
          sentence: lowerText.includes('very interest in') ? 'very interest in' : lowerText.includes('more better') ? 'more better' : 'is depend on',
          error: 'Sai dạng từ hoặc cấu trúc so sánh/tính từ.',
          correction: lowerText.includes('very interest in') ? 'very interested in' : lowerText.includes('more better') ? 'much better' : 'depends on',
          practice_structure: 'Dạng phân từ làm tính từ (-ed vs -ing) & Động từ chỉ trạng thái',
          explanation: 'Dùng tính từ đuôi -ed khi miêu tả cảm xúc con người ("interested in") và không dùng "more" đi kèm tính từ ngắn đã thêm "-er".'
        });
      }

      const severeClauseErrors = grammarErrors.filter(e => e.error.includes('thiếu thành phần')).length;
      const verbFormErrors = grammarErrors.filter(e => /dạng từ|verb|V-ing|phân từ/i.test(`${e.error} ${e.practice_structure}`)).length;
      const minorGrammarErrors = Math.max(0, grammarErrors.length - severeClauseErrors - verbFormErrors);
      const grammarVocabLengthPenalty = getShortAnswerBandPenalty(wordCount);
      const inappropriateVocabularyCount = getInappropriateVocabularyCount(trimmedTranscript);
      baseGRA = Math.max(1, 8 - severeClauseErrors * 2 - verbFormErrors - minorGrammarErrors * 0.5 - grammarVocabLengthPenalty);

      // 2. Fluency: based on real stutters, pauses, hesitations
      const shortAnswerPenalty = wordCount < 10 ? 3 : wordCount < 12 ? 2 : wordCount < 15 ? 1 : wordCount < 20 ? 0.5 : 0;
      const speakingRatePenalty = getSpeakingRatePenalty(wordCount, durationSeconds);
      let baseFC = Math.max(1, 8 - shortAnswerPenalty - speakingRatePenalty - stutterCount * 0.5 - hesitationCount * 0.5 - pauseCount * 0.5);

      // 3. Pronunciation: identify REAL phonetic points, NOT generic ending sounds
      let basePR = 8.0;
      const pronunciationErrors: Array<{
        word: string;
        sound: string;
        phonetic: string;
        issue: string;
        guide: string;
      }> = [];

      // Phonetically challenging words commonly found in IELTS
      const phoneticLibrary: Record<string, { sound: string; phonetic: string; issue: string; guide: string }> = {
        comfortable: {
          sound: 'Nuốt âm tiết giữa và trọng âm rơi vào âm tiết đầu /ˈkʌmftəbl/',
          phonetic: '/ˈkʌmftəbl/',
          issue: 'Người học thường phát âm tách thành 4 âm "com-for-ta-ble" thay vì 3 âm chuẩn.',
          guide: 'Lướt nhanh âm "fort" thành /ft/ và rơi trọng âm mạnh vào âm đầu "COM".'
        },
        specifically: {
          sound: 'Trọng âm âm tiết 2 và cụm phụ âm đầu /spəˈsɪf.ɪ.kli/',
          phonetic: '/spəˈsɪf.ɪ.kli/',
          issue: 'Dễ nuốt âm /s/ đầu hoặc phát âm sai trọng âm sang âm tiết 1.',
          guide: 'Bật nhẹ âm /s/ trước khi sang /pə/, nhấn mạnh vào "SIF".'
        },
        opportunity: {
          sound: 'Trọng âm chính rơi vào âm tiết thứ 3 /ˌɒp.əˈtjuː.nə.ti/',
          phonetic: '/ˌɒp.əˈtjuː.nə.ti/',
          issue: 'Nhấn sai trọng âm hoặc phát âm nguyên âm /uː/ thành /u/ ngắn.',
          guide: 'Nhấn mạnh nhất vào âm "TU" (/tjuː/), giữ nguyên âm đôi chuẩn xác.'
        },
        environment: {
          sound: 'Trọng âm âm tiết 2 và âm /n/ câm trước /m/ /ɪnˈvaɪ.rən.mənt/',
          phonetic: '/ɪnˈvaɪ.rən.mənt/',
          issue: 'Dễ đọc rõ chữ "ron" thành "ron-mừn" thay vì âm schwa /rən/.',
          guide: 'Nhấn mạnh vào "VI" (/vaɪ/), âm tiết tiếp theo phát âm lướt nhẹ thành /rən.mənt/.'
        },
        technology: {
          sound: 'Âm /k/ ở chữ "ch" và trọng âm âm tiết 2 /tekˈnɒl.ə.dʒi/',
          phonetic: '/tekˈnɒl.ə.dʒi/',
          issue: 'Nhầm âm "ch" thành âm /tʃ/ thay vì âm bật hơi /k/.',
          guide: 'Bật dứt khoát âm /k/ như "tek-NOL-uh-jee".'
        },
        especially: {
          sound: 'Trọng âm âm tiết 2 /ɪˈspeʃ.əl.i/',
          phonetic: '/ɪˈspeʃ.əl.i/',
          issue: 'Thường thêm âm "e" đằng trước thành "e-specially" thay vì bắt đầu bằng /ɪs/.',
          guide: 'Bắt đầu trực tiếp bằng âm gió /sp/, nhấn trọng âm mạnh vào "SPE".'
        }
      };

      // Search if candidate transcript contains any of these or general phonetic candidates
      for (const [kw, pData] of Object.entries(phoneticLibrary)) {
        if (lowerText.includes(kw)) {
          pronunciationErrors.push({
            word: kw,
            ...pData
          });
          if (pronunciationErrors.length >= 3) break;
        }
      }

      basePR = Math.max(1, 8 - pronunciationErrors.length * 0.5);

      const advancedVocabCount = countAdvancedSpeakingVocab(trimmedTranscript);
      const repeatedPromptKeywords = countRepeatedPromptKeywords(question || '', trimmedTranscript);
      const repeatedKeywordPenalty = Math.floor(repeatedPromptKeywords / wordCount * 10) * 0.5;
      let baseLR = Math.max(1, Math.min(8, 6 + Math.floor(advancedVocabCount / 2) * 0.5 - repeatedKeywordPenalty - grammarVocabLengthPenalty - inappropriateVocabularyCount * 0.5));
      const cappedBands = capCriterionBands({
        fluencyCoherence: baseFC,
        lexicalResource: baseLR,
        grammaticalRange: baseGRA,
        pronunciation: basePR,
      });
      baseFC = cappedBands.fluencyCoherence;
      baseLR = cappedBands.lexicalResource;
      baseGRA = cappedBands.grammaticalRange;
      basePR = cappedBands.pronunciation;
      const rawAvg = (baseFC + baseLR + baseGRA + basePR) / 4;
      const roundedScore = floorToHalf(rawAvg);
      const canAttack = roundedScore >= Number(targetBand || 5.0);

      const dynamicWeaknesses: string[] = [];
      if (repeatedKeywordPenalty > 0) dynamicWeaknesses.push('Từ vựng: Lặp từ, thiếu linh hoạt từ vựng.');
      if (inappropriateVocabularyCount > 0) dynamicWeaknesses.push(`Từ vựng: Dùng ${inappropriateVocabularyCount} từ/cụm từ chưa phù hợp; mỗi trường hợp bị trừ 0.5 band.`);
      if (speakingRatePenalty > 0) dynamicWeaknesses.push('Độ trôi chảy (Fluency): Tốc độ nói chậm.');
      if (detectedStutters.length > 0) {
        dynamicWeaknesses.push(`Độ trôi chảy (Fluency): Phát hiện ${detectedStutters.length} vị trí lặp từ (${detectedStutters.join(', ')}).`);
      }
      if (detectedHesitations.length > 0) {
        dynamicWeaknesses.push(`Độ trôi chảy (Fluency): Sử dụng từ đệm ngập ngừng (${detectedHesitations.join(', ')}).`);
      }
      if (severeGrammarErrorsCount > 0) {
        dynamicWeaknesses.push('Ngữ pháp (Grammar): Cần tránh các lỗi câu cụt hoặc dùng sai dạng từ để không bị trừ điểm.');
      } else {
        dynamicWeaknesses.push('Ngữ pháp (Grammar): Câu nói tự nhiên, nên mở rộng thêm các cấu trúc đảo ngữ hoặc mệnh đề quan hệ để nâng band lên 7.5+.');
      }

      return res.json({
        overall_score: roundedScore,
        can_attack: canAttack,
        overallBand: roundedScore,
        passed: canAttack,
        grammar_errors: grammarErrors,
        pronunciation_errors: pronunciationErrors,
        fluency_detail: {
          stutterCount,
          hesitationCount,
          pauseCount,
          stumbles: [...detectedStutters, ...detectedHesitations],
          feedback: speakingRatePenalty > 0
            ? 'Tốc độ nói chậm.'
            : stutterCount === 0 && hesitationCount === 0
            ? 'Tốc độ nói đều đặn, không có biểu hiện ngập ngừng hay nói lắp.'
            : `Ghi nhận ${stutterCount} lần lặp từ và ${hesitationCount} từ đệm ngập ngừng trong bài nói.`
        },
        feedback_vi: {
          summary: `Thí sinh phản xạ tự nhiên câu hỏi. ${wordCount < 20 ? 'Bài nói quá ngắn.' : ''} Ngữ pháp đạt khoảng ${baseGRA.toFixed(1)}. Điểm tổng kết: Band ${roundedScore}.`,
          weaknesses: dynamicWeaknesses,
          grammar_summary: severeGrammarErrorsCount > 0
            ? `Phát hiện ${severeGrammarErrorsCount} lỗi ngữ pháp cơ bản cần khắc phục.`
            : 'Ngữ pháp tự nhiên và chính xác, duy trì tốt phong thái giao tiếp.',
          pronunciation_summary: 'Phát âm rõ ràng, đã chỉ ra các âm cụ thể cần lưu ý theo IPA.',
          suggestion: 'Tiếp tục luyện tập nói theo luồng ý liên tục, hạn chế lặp từ và mở rộng câu với mệnh đề phức.',
        },
        criteria: {
          fluencyCoherence: {
            band: floorToHalf(baseFC),
            feedback: speakingRatePenalty > 0 ? 'Tốc độ nói chậm.' : stutterCount > 0 ? `Good conversational flow with ${stutterCount} minor repetitions.` : 'Smooth conversational pace with consistent ideas.',
          },
          lexicalResource: {
            band: floorToHalf(baseLR),
            feedback: inappropriateVocabularyCount > 0
              ? `Inappropriate word/collocation use: -0.5 per occurrence (${inappropriateVocabularyCount}).`
              : repeatedKeywordPenalty > 0 ? 'Lặp từ, thiếu linh hoạt từ vựng.' : 'Natural, effective vocabulary suited for IELTS Speaking topics.',
          },
          grammaticalRange: {
            band: floorToHalf(baseGRA),
            feedback: severeGrammarErrorsCount > 0 ? 'Contains basic structural errors that need attention.' : 'Accurate and natural grammatical structures.',
          },
          pronunciation: {
            band: floorToHalf(basePR),
            feedback: 'Intelligible pronunciation with appropriate phonetic clarity.',
          },
        },
        summary: `Demonstrates solid spoken communication addressing "${question}".`,
        strengths: ['Natural expression', 'Communicative clarity'],
        improvements: ['Refine specific phonemes and maintain continuous flow'],
        transcript: trimmedTranscript,
      });
    }

    const systemPrompt = `You are a certified IELTS Speaking Senior Examiner and Referee.
Analyze the candidate's spoken transcript accurately based on official IELTS Speaking criteria, with fairness and realistic expectations for spoken English.

QUESTION: "${question}"
CANDIDATE SPOKEN TRANSCRIPT: "${trimmedTranscript}"
WORD COUNT: ${wordCount}
RECORDING TELEMETRY:
- Detected stutters / word repetitions: ${JSON.stringify(detectedStutters)}
- Detected hesitation fillers: ${JSON.stringify(detectedHesitations)}
- Recorded pause count: ${pauseCount}
- Speech duration (seconds): ${durationSeconds}

CRITICAL SCORING & BAND EVALUATION GUIDELINES (PLEASE READ VERY CAREFULLY):
1. GRAMMATICAL RANGE & ACCURACY (GRA):
   - Start each criterion at band 8.0 when no error is present. Apply each deduction separately: minor verb agreement, singular/plural, or preposition error: -0.5; wrong verb vs V-ing form: -1.0; incomplete sentence or extra/missing subject or predicate: -2.0.
   - Apply this additional length deduction to BOTH GRA and Lexical Resource, after assessing quality: fewer than 7 words: -3.0; 7-9: -2.5; 10-11: -2.0; 12-14: -1.5; 15-17: -1.0; 18-21: -0.5; 22 or more: no length deduction. Apply the deduction once per criterion and do not let either score fall below 1.0.
   - For every grammar error identified, you MUST specify:
     * sentence: original sentence
     * error: exactly where and what the grammar error is ("sai ở đâu")
     * correction: how to fix it ("sửa thế nào")
     * practice_structure: specific grammar structure to practice ("luyện tập cấu trúc gì", e.g. "Mệnh đề quan hệ xác định", "Câu điều kiện loại 2", "Dạng V-ing sau giới từ")
     * explanation: detailed explanation in Vietnamese.

2. PRONUNCIATION (PR):
   - Start at 8.0 with no pronunciation errors. Deduct 0.5 for each mispronounced word and 0.5 for each omitted plural/third-person -s/-es or past -ed ending. Identify only errors supported by the audio; do not infer pronunciation errors from transcript text alone.
   - DO NOT merely pick random words and lazily complain about "cần luyện phát âm âm đuôi (ending sounds)"!
   - ACCURATELY identify real pronunciation / phonetic challenges from words spoken in the transcript:
     * Specify the exact word and the specific sound/phoneme mispronounced ("phát âm sai ở từ nào, âm gì"):
       e.g. vowel confusion (/iː/ vs /ɪ/, /æ/ vs /e/), consonant sounds (/θ/, /ð/, /ʃ/, /tʃ/, /dʒ/, /v/, /z/), consonant clusters (/str-/, /-sks/), silent letters, or incorrect word stress (nhấn sai trọng âm).
     * word: the exact word from transcript
     * sound: the specific sound/phoneme ("âm gì", e.g. "Nguyên âm ngắn /ɪ/", "Phụ âm vô thanh /θ/", "Trọng âm rơi vào âm tiết thứ 2")
     * phonetic: standard IPA transcription
     * issue: clear description of the phonetic mistake in Vietnamese
     * guide: actionable phonetic guide on how to pronounce correctly in Vietnamese.

3. FLUENCY & COHERENCE (FC):
   - Start at 8.0 with no fluency/coherence issue. For total transcript length, deduct 0.5 below 20 words, 1.0 below 15, 2.0 below 12, or 3.0 below 10 (use the strongest matching deduction only). Describe this only as "the answer is too short"; never state a word count or threshold in feedback. For speaking rate, deduct 0.5 below 90 words/minute, 1.0 below 80, 1.5 below 70, or 2.0 below 60 (use the strongest matching deduction only) and describe it as "speaking rate is slow". Also deduct 0.5 for each unreasonable idea and point it out; deduct 0.5 for a 1-second hesitation, 1.0 for 2-3 seconds, and 1.5 for a pause longer than 3 seconds. Do not treat every pause as the same duration.
4. LEXICAL RESOURCE: Start at 6.0. Add 0.5 for each pair of distinct advanced, topic-specific vocabulary items, collocations, or idioms actually used, capped at 8.0. Do not reward repeated use of the same item. Deduct 0.5 for every occurrence of an inappropriate or incorrectly used word/collocation. Return each occurrence in vocabulary_errors with the exact word or phrase, why it is inappropriate in context, and a suitable correction. Do not flag valid but simple vocabulary.
   - Accurately assess fluency based on candidate's real speaking performance:
     * Check for stuttering (nói lắp / repetitions like "I... I think", "the the")
     * Check for stumbles, hesitation fillers ("uh", "um", "er") and prolonged unnatural pauses
     * Provide a dedicated "fluency_detail" object listing stutterCount, hesitationCount, pauseCount, stumble phrases, and Vietnamese feedback on speech flow.

4. OVERALL SCORE & STRICT ROUNDING DOWN RULE:
   - Provide band scores (1.0 to 9.0 in 0.5 steps) for FC, LR, GRA, PR.
   - Calculate raw average: raw_avg = (FC + LR + GRA + PR) / 4.
   - STRICT ROUNDING DOWN RULE: ALWAYS round down to the nearest 0.5 step! Formula: Math.floor(raw_avg * 2) / 2.
     Examples: 7.7 -> 7.5, 7.4 -> 7.0, 6.8 -> 6.5.
   - overall_score MUST EQUAL Math.floor(raw_avg * 2) / 2.
   - can_attack is true if overall_score >= ${Number(targetBand || 5.0)}, false otherwise.

Output STRICTLY a valid JSON object without markdown fences, conforming to this JSON format:
{
  "overall_score": 7.5,
  "can_attack": true,
  "grammar_errors": [
    {
      "sentence": "Candidate sentence",
      "error": "Mô tả lỗi sai cụ thể ở đâu",
      "correction": "Cách sửa câu chuẩn",
      "practice_structure": "Tên cấu trúc ngữ pháp cần luyện tập",
      "explanation": "Giải thích chi tiết bằng tiếng Việt"
    }
  ],
  "vocabulary_errors": [
    { "word": "exact word or phrase", "issue": "Why this use is inappropriate", "correction": "Suitable alternative" }
  ],
  "pronunciation_errors": [
    {
      "word": "opportunity",
      "sound": "Trọng âm chính rơi vào âm tiết thứ 3 /ˌɒp.əˈtjuː.nə.ti/",
      "phonetic": "/ˌɒp.əˈtjuː.nə.ti/",
      "issue": "Nhấn sai trọng âm vào âm tiết đầu hoặc nuốt nguyên âm /uː/",
      "guide": "Nhấn mạnh nhất vào âm 'tu' (/tjuː/) và phát âm rõ các âm tiết"
    }
  ],
  "fluency_detail": {
    "stutterCount": 0,
    "hesitationCount": 1,
    "pauseCount": 0,
    "stumbles": ["I... I think"],
    "feedback": "Nhận xét chi tiết về nhịp điệu và độ trôi chảy"
  },
  "feedback_vi": {
    "summary": "Nhận xét tổng quan bằng tiếng Việt",
    "weaknesses": [
      "Điểm yếu cụ thể từ bài nói"
    ],
    "grammar_summary": "Tóm tắt đánh giá ngữ pháp",
    "pronunciation_summary": "Tóm tắt đánh giá phát âm",
    "suggestion": "Gợi ý cải thiện thiết thực"
  },
  "criteria": {
    "fluencyCoherence": { "band": 7.5, "feedback": "Evaluation text in English" },
    "lexicalResource": { "band": 7.5, "feedback": "Evaluation text in English" },
    "grammaticalRange": { "band": 7.5, "feedback": "Evaluation text in English" },
    "pronunciation": { "band": 7.5, "feedback": "Evaluation text in English" }
  },
  "summary": "Overall examiner assessment in English"
}`;

    const cleanJson = await generateAiJson(systemPrompt);
    const result = JSON.parse(cleanJson);

    // Compute criteria bands and enforce strict floor-to-half rounding
    const modelFc = Number(result.criteria?.fluencyCoherence?.band) || 6.5;
    const shortAnswerPenalty = wordCount < 10 ? 3 : wordCount < 12 ? 2 : wordCount < 15 ? 1 : wordCount < 20 ? 0.5 : 0;
    const grammarVocabLengthPenalty = getShortAnswerBandPenalty(wordCount);
    const speakingRatePenalty = getSpeakingRatePenalty(wordCount, Number(durationSeconds));
    const fc = Math.min(modelFc, Math.max(1, 8 - shortAnswerPenalty - speakingRatePenalty));
    const repeatedPromptKeywords = countRepeatedPromptKeywords(question || '', trimmedTranscript);
    const repeatedKeywordPenalty = Math.floor(repeatedPromptKeywords / wordCount * 10) * 0.5;
    const vocabularyErrors = Array.isArray(result.vocabulary_errors)
      ? result.vocabulary_errors.filter((error: any) => error && typeof error.word === 'string')
      : [];
    const inappropriateVocabularyCount = Math.max(vocabularyErrors.length, getInappropriateVocabularyCount(trimmedTranscript));
    result.vocabulary_errors = vocabularyErrors;
    const lr = Math.max(1, Math.min(8, 6 + Math.floor(countAdvancedSpeakingVocab(trimmedTranscript) / 2) * 0.5 - repeatedKeywordPenalty - grammarVocabLengthPenalty - inappropriateVocabularyCount * 0.5));
    const gr = Math.max(1, (Number(result.criteria?.grammaticalRange?.band) || 7.0) - grammarVocabLengthPenalty);
    const pr = Number(result.criteria?.pronunciation?.band) || 6.5;

    const cappedBands = capCriterionBands({
      fluencyCoherence: fc,
      lexicalResource: lr,
      grammaticalRange: gr,
      pronunciation: pr,
    });
    const finalFc = cappedBands.fluencyCoherence;
    const finalLr = cappedBands.lexicalResource;
    const finalGr = cappedBands.grammaticalRange;
    const finalPr = cappedBands.pronunciation;

    const rawAvg = (finalFc + finalLr + finalGr + finalPr) / 4;
    // Strict rounding down rule as requested: e.g. 7.7 -> 7.5
    const overallScore = floorToHalf(rawAvg);

    result.overall_score = overallScore;
    result.overallBand = overallScore;
    result.can_attack = overallScore >= Number(targetBand || 5.0);
    result.passed = result.can_attack;
    result.transcript = trimmedTranscript;
    result.criteria ||= {};
    result.criteria.fluencyCoherence ||= { band: 6.5, feedback: '' };
    result.criteria.lexicalResource ||= { band: 6.0, feedback: '' };
    result.criteria.fluencyCoherence.band = finalFc;
    result.criteria.lexicalResource.band = finalLr;
    result.criteria.grammaticalRange ||= { band: finalGr, feedback: '' };
    result.criteria.pronunciation ||= { band: finalPr, feedback: '' };
    result.criteria.grammaticalRange.band = finalGr;
    result.criteria.pronunciation.band = finalPr;
    if (repeatedKeywordPenalty > 0) result.criteria.lexicalResource.feedback = 'Keyword repetition reduces lexical flexibility.';
    if (grammarVocabLengthPenalty > 0) {
      result.criteria.grammaticalRange.feedback = 'The answer is too short to demonstrate a wider range of grammar.';
      result.criteria.lexicalResource.feedback = 'The answer is too short to demonstrate a wider range of vocabulary.';
    }
    if (inappropriateVocabularyCount > 0) {
      result.criteria.lexicalResource.feedback = `${inappropriateVocabularyCount} inappropriate word/collocation use(s) reduce lexical accuracy.`;
    }
    if (speakingRatePenalty > 0) result.criteria.fluencyCoherence.feedback = 'Speaking rate is slow.';

    if (!Array.isArray(result.grammar_errors)) {
      result.grammar_errors = [];
    }
    if (!Array.isArray(result.pronunciation_errors)) {
      result.pronunciation_errors = [];
    }

    if (!result.fluency_detail) {
      result.fluency_detail = {
        stutterCount,
        hesitationCount,
        pauseCount,
        stumbles: [...detectedStutters, ...detectedHesitations],
        feedback: stutterCount === 0 && hesitationCount === 0
          ? 'Nói trôi chảy, không có đoạn bị vấp hay ngập ngừng rõ rệt.'
          : `Ghi nhận ${stutterCount} lần lặp từ và ${hesitationCount} lần ngập ngừng.`
      };
    }

    if (!result.feedback_vi) {
      result.feedback_vi = {
        summary: `Bài nói giải quyết câu hỏi "${question}".`,
        weaknesses: ['Cần phát triển câu dài hơn và sử dụng từ nối đa dạng.'],
        suggestion: 'Mở rộng câu trả lời với lý do và ví dụ thực tế.',
      };
    }
    if (wordCount < 20) {
      result.criteria.fluencyCoherence.feedback = 'The answer is too short, which limits fluency and idea development.';
      result.feedback_vi.summary = `${result.feedback_vi.summary || ''} Bài nói quá ngắn.`.trim();
      result.feedback_vi.weaknesses = Array.isArray(result.feedback_vi.weaknesses) ? result.feedback_vi.weaknesses : [];
      result.feedback_vi.weaknesses.push('Bài nói quá ngắn.');
      const sanitizeShortAnswerFeedback = (value: string) => value
        .replace(/\b(?:under|below|fewer than)\s+\d+\s+words?\b/gi, 'the answer is too short')
        .replace(/\b\d+[- ]word(?:s)?\b/gi, 'the answer is too short')
        .replace(/\b\d+\s+words?\b/gi, 'the answer is too short')
        .replace(/dưới\s+\d+\s+từ/gi, 'bài nói quá ngắn')
        .replace(/\b\d+\s+từ\b/gi, 'bài nói quá ngắn');
      result.summary = sanitizeShortAnswerFeedback(result.summary || '');
      result.feedback_vi.summary = sanitizeShortAnswerFeedback(result.feedback_vi.summary);
      result.feedback_vi.weaknesses = result.feedback_vi.weaknesses.map((item: string) => sanitizeShortAnswerFeedback(item));
      result.fluency_detail.feedback = sanitizeShortAnswerFeedback(result.fluency_detail?.feedback || 'Bài nói quá ngắn.');
    }
    if (repeatedKeywordPenalty > 0) {
      result.feedback_vi.summary = `${result.feedback_vi.summary || ''} Lặp từ, thiếu linh hoạt từ vựng.`.trim();
      result.feedback_vi.weaknesses = Array.isArray(result.feedback_vi.weaknesses) ? result.feedback_vi.weaknesses : [];
      result.feedback_vi.weaknesses.push('Lặp từ, thiếu linh hoạt từ vựng.');
    }
    if (speakingRatePenalty > 0) {
      result.feedback_vi.weaknesses = Array.isArray(result.feedback_vi.weaknesses) ? result.feedback_vi.weaknesses : [];
      result.feedback_vi.weaknesses.push('Tốc độ nói chậm.');
      result.fluency_detail.feedback = `${result.fluency_detail.feedback || ''} Tốc độ nói chậm.`.trim();
    }

    return res.json(result);
  } catch (err: any) {
    console.error('Error analyzing speaking with Gemini:', err);
    return res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

// API: Generate AI Background Music Composition with Gemini
app.post('/api/generate-bgm', async (req, res) => {
  try {
    const { prompt = 'Epic Fantasy Match-3 Battle with Orchestral Brass and Driving Pulse', mood = 'heroic' } = req.body;

    if (getGeminiApiKeys().length === 0 && !process.env.OPENAI_API_KEY) {
      // High-quality fallback procedural loop if API key not available
      return res.json({
        title: 'Celestial Symphony (Synthesized)',
        tempo: 124,
        key: 'D Minor',
        mood: mood || 'Heroic Fantasy',
        totalBeats: 16,
        notes: [
          // Bassline (sawtooth/triangle)
          { note: 'D2', time: 0, duration: 1.8, track: 'bass', type: 'triangle' },
          { note: 'D2', time: 2, duration: 1.8, track: 'bass', type: 'triangle' },
          { note: 'Bb1', time: 4, duration: 1.8, track: 'bass', type: 'triangle' },
          { note: 'Bb1', time: 6, duration: 1.8, track: 'bass', type: 'triangle' },
          { note: 'C2', time: 8, duration: 1.8, track: 'bass', type: 'triangle' },
          { note: 'C2', time: 10, duration: 1.8, track: 'bass', type: 'triangle' },
          { note: 'A1', time: 12, duration: 1.8, track: 'bass', type: 'triangle' },
          { note: 'A1', time: 14, duration: 1.8, track: 'bass', type: 'triangle' },
          // Lead melody (sine/square)
          { note: 'D4', time: 0, duration: 0.8, track: 'melody', type: 'sine' },
          { note: 'F4', time: 1, duration: 0.8, track: 'melody', type: 'sine' },
          { note: 'A4', time: 2, duration: 1.2, track: 'melody', type: 'sine' },
          { note: 'G4', time: 3.5, duration: 0.4, track: 'melody', type: 'sine' },
          { note: 'F4', time: 4, duration: 0.8, track: 'melody', type: 'sine' },
          { note: 'D4', time: 5, duration: 0.8, track: 'melody', type: 'sine' },
          { note: 'E4', time: 6, duration: 1.6, track: 'melody', type: 'sine' },
          { note: 'F4', time: 8, duration: 0.8, track: 'melody', type: 'sine' },
          { note: 'G4', time: 9, duration: 0.8, track: 'melody', type: 'sine' },
          { note: 'A4', time: 10, duration: 1.2, track: 'melody', type: 'sine' },
          { note: 'C5', time: 11.5, duration: 0.4, track: 'melody', type: 'sine' },
          { note: 'D5', time: 12, duration: 1.5, track: 'melody', type: 'sine' },
          { note: 'A4', time: 14, duration: 1.5, track: 'melody', type: 'sine' },
          // Arpeggio chords
          { note: 'D3', time: 0, duration: 0.4, track: 'arp', type: 'triangle' },
          { note: 'A3', time: 0.5, duration: 0.4, track: 'arp', type: 'triangle' },
          { note: 'D4', time: 1, duration: 0.4, track: 'arp', type: 'triangle' },
          { note: 'F4', time: 1.5, duration: 0.4, track: 'arp', type: 'triangle' },
          { note: 'Bb3', time: 4, duration: 0.4, track: 'arp', type: 'triangle' },
          { note: 'D4', time: 4.5, duration: 0.4, track: 'arp', type: 'triangle' },
          { note: 'F4', time: 5, duration: 0.4, track: 'arp', type: 'triangle' },
          { note: 'Bb4', time: 5.5, duration: 0.4, track: 'arp', type: 'triangle' },
          { note: 'C3', time: 8, duration: 0.4, track: 'arp', type: 'triangle' },
          { note: 'E3', time: 8.5, duration: 0.4, track: 'arp', type: 'triangle' },
          { note: 'G3', time: 9, duration: 0.4, track: 'arp', type: 'triangle' },
          { note: 'C4', time: 9.5, duration: 0.4, track: 'arp', type: 'triangle' },
          { note: 'A3', time: 12, duration: 0.4, track: 'arp', type: 'triangle' },
          { note: 'C#4', time: 12.5, duration: 0.4, track: 'arp', type: 'triangle' },
          { note: 'E4', time: 13, duration: 0.4, track: 'arp', type: 'triangle' },
          { note: 'A4', time: 13.5, duration: 0.4, track: 'arp', type: 'triangle' },
        ],
        drumPattern: [
          { type: 'kick', time: 0 },
          { type: 'hihat', time: 0.5 },
          { type: 'snare', time: 1 },
          { type: 'hihat', time: 1.5 },
          { type: 'kick', time: 2 },
          { type: 'hihat', time: 2.5 },
          { type: 'snare', time: 3 },
          { type: 'hihat', time: 3.5 },
          { type: 'kick', time: 4 },
          { type: 'hihat', time: 4.5 },
          { type: 'snare', time: 5 },
          { type: 'hihat', time: 5.5 },
          { type: 'kick', time: 6 },
          { type: 'kick', time: 6.5 },
          { type: 'snare', time: 7 },
          { type: 'hihat', time: 7.5 },
          { type: 'kick', time: 8 },
          { type: 'hihat', time: 8.5 },
          { type: 'snare', time: 9 },
          { type: 'hihat', time: 9.5 },
          { type: 'kick', time: 10 },
          { type: 'hihat', time: 10.5 },
          { type: 'snare', time: 11 },
          { type: 'hihat', time: 11.5 },
          { type: 'kick', time: 12 },
          { type: 'hihat', time: 12.5 },
          { type: 'snare', time: 13 },
          { type: 'hihat', time: 13.5 },
          { type: 'kick', time: 14 },
          { type: 'kick', time: 14.5 },
          { type: 'snare', time: 15 },
          { type: 'hihat', time: 15.5 },
        ],
      });
    }

    const musicPrompt = `You are an expert video game composer and audio programmer.
Create a seamlessly looping 16-beat electronic/fantasy chiptune RPG game soundtrack score based on the user's prompt:
Prompt: "${prompt}"
Mood: "${mood}"

Provide a structured 16-beat composition JSON that can be played with Web Audio API.
Rules:
1. Notes must use scientific pitch notation: e.g., 'C2', 'G2', 'A2', 'D3', 'F3', 'A3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#4', 'Bb3', etc.
2. time is in beats from 0 to 15.5 (resolution down to 0.5 or 0.25 beats).
3. totalBeats is 16.
4. tempo between 108 and 140 BPM.
5. track must be 'melody' (lead voice), 'bass' (low rhythm), or 'arp' (arpeggiated backing chords).
6. type must be 'sine', 'triangle', 'sawtooth', or 'square'.
7. drumPattern can have 'kick', 'snare', 'hihat', 'perc' on beat times between 0 and 15.5.
8. Output STRICTLY a JSON object without markdown or code fences:
{
  "title": "Creative Track Title",
  "tempo": 124,
  "key": "D Minor",
  "mood": "${mood}",
  "totalBeats": 16,
  "notes": [
    {"note": "D4", "time": 0, "duration": 0.8, "track": "melody", "type": "sine"},
    {"note": "D2", "time": 0, "duration": 1.8, "track": "bass", "type": "triangle"}
  ],
  "drumPattern": [
    {"type": "kick", "time": 0},
    {"type": "snare", "time": 1},
    {"type": "hihat", "time": 0.5}
  ]
}`;

    const cleanJson = await generateAiJson(musicPrompt);
    const result = JSON.parse(cleanJson);

    return res.json(result);
  } catch (err: any) {
    console.error('Error generating AI BGM with Gemini:', err);
    return res.status(500).json({ error: err.message || 'Music generation failed' });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  await hydrateSupabaseStores().catch(err => console.error('Supabase startup sync failed:', err));
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server with WebSockets running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
