import React, { useState, useEffect, useRef } from 'react';
import { Starmon, PvpRoom, PlayerInRoom } from '../types';
import { STARMON_ROSTER } from '../data/starmons';
import { StarmonAsset } from './StarmonAsset';
import { ARENA_MAPS, getArenaMap } from '../data/arenaMaps';
import { sound } from '../services/sound';
import {
  savePvpRoomToFirestore,
  updatePvpRoomStatusInFirestore,
  deletePvpRoomInFirestore,
  subscribeToPvpRoom,
  subscribeToActivePvpRooms,
  sanitizeRoomCode,
  SUPABASE_PROJECT_ID,
} from '../services/supabase';
import {
  Swords,
  Plus,
  Users,
  Copy,
  Check,
  Play,
  ArrowRight,
  Sparkles,
  Shield,
  X,
  RefreshCw,
  Search,
  Radio,
  Crown,
  LogOut,
  AlertCircle,
  UserCheck,
  Edit3,
  Bot,
  Bluetooth
} from 'lucide-react';

interface Props {
  playerName: string;
  playerLevel: number;
  playerId?: string;
  googleEmail?: string;
  playerStarmons?: Starmon[];
  onClose: () => void;
  onStartPvPBattle: (roomInfo: {
    code: string;
    hostName: string;
    hostId?: string;
    arena: string;
    myPlayerId?: string;
    myPlayerName?: string;
    isHost?: boolean;
    opponentId?: string;
    opponentName?: string;
    opponentStarmons?: Starmon[];
  }) => void;
  onStartPveBattle?: () => void;
  onOpenTutorial?: () => void;
  onUpdateGoogleAccount?: (googleId: string, googleEmail?: string) => void;
}

export const PvpLobbyModal: React.FC<Props> = ({
  playerName,
  playerLevel,
  playerId,
  googleEmail,
  playerStarmons = [],
  onClose,
  onStartPvPBattle,
  onStartPveBattle,
  onOpenTutorial,
  onUpdateGoogleAccount,
}) => {
  // Navigation tabs in main lobby
  const [activeTab, setActiveTab] = useState<'join' | 'create' | 'pve' | 'tutorial'>('join');
  const [rooms, setRooms] = useState<PvpRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  const [joinError, setJoinError] = useState('');

  // Active Room state (when user has created or joined a room)
  const [currentRoom, setCurrentRoom] = useState<PvpRoom | null>(null);
  const [customRoomCodeInput, setCustomRoomCodeInput] = useState('');
  const [selectedArena, setSelectedArena] = useState(ARENA_MAPS[0].name);
  const [hasCopiedCode, setHasCopiedCode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [bluetoothPrompt, setBluetoothPrompt] = useState<'create' | 'join' | null>(null);

  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  const announcedPlayerCountRef = useRef<number>(1);
  const hasLaunchedRef = useRef<boolean>(false);
  const isRoomHostRef = useRef<boolean | null>(null);

  // Distinct Google Account identity for cross-account PvP matching (sessionStorage isolated per-tab)
  const [activeGoogleId, setActiveGoogleId] = useState<string>(() => {
    try {
      const sessionStored = sessionStorage.getItem('starmon_pvp_session_uid');
      if (sessionStored) return sessionStored;
      const stored = localStorage.getItem('starmon_pvp_uid') || localStorage.getItem('starmon_google_id');
      if (stored) {
        sessionStorage.setItem('starmon_pvp_session_uid', stored);
        return stored;
      }
    } catch {}
    const newUid = playerId || `google_user_${Math.random().toString(36).substring(2, 8)}`;
    try {
      sessionStorage.setItem('starmon_pvp_session_uid', newUid);
    } catch {}
    return newUid;
  });

  const [activeGoogleName, setActiveGoogleName] = useState<string>(() => {
    try {
      const sessionStored = sessionStorage.getItem('starmon_pvp_session_name');
      if (sessionStored) return sessionStored;
    } catch {}
    if (playerName && playerName !== 'Player') return playerName;
    if (googleEmail) return googleEmail.split('@')[0];
    return 'Tài khoản Google A';
  });

  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [tempGoogleIdInput, setTempGoogleIdInput] = useState(activeGoogleId);
  const [tempGoogleNameInput, setTempGoogleNameInput] = useState(activeGoogleName);

  // Load all centralized accounts on mount
  useEffect(() => {
    fetch('/api/accounts')
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data.accounts)
          ? data.accounts
          : Object.values(data).filter((a: any) => a && typeof a === 'object' && a.username);
        if (list && list.length > 0) setAvailableAccounts(list);
      })
      .catch(() => {});
  }, []);

  // Synchronize Google User ID
  useEffect(() => {
    try {
      sessionStorage.setItem('starmon_pvp_session_uid', activeGoogleId);
      sessionStorage.setItem('starmon_pvp_session_name', activeGoogleName);
    } catch {}
  }, [activeGoogleId, activeGoogleName]);

  const handleQuickSwitchAccount = (id: string, name: string) => {
    sound.playClick();
    setActiveGoogleId(id);
    setActiveGoogleName(name);
    setTempGoogleIdInput(id);
    setTempGoogleNameInput(name);
    try {
      sessionStorage.setItem('starmon_pvp_session_uid', id);
      sessionStorage.setItem('starmon_pvp_session_name', name);
    } catch {}
    onUpdateGoogleAccount?.(id, id.includes('@') ? id : undefined);
    setStatusMessage(`Đã chuyển sang: ${name} (${id})`);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const handleSaveCustomAccount = () => {
    sound.playRewardFanfare();
    const cleanId = tempGoogleIdInput.trim() || `google_user_${Math.random().toString(36).substring(2, 8)}`;
    const cleanName = tempGoogleNameInput.trim() || cleanId;
    setActiveGoogleId(cleanId);
    setActiveGoogleName(cleanName);
    try {
      sessionStorage.setItem('starmon_pvp_session_uid', cleanId);
      sessionStorage.setItem('starmon_pvp_session_name', cleanName);
    } catch {}
    onUpdateGoogleAccount?.(cleanId, cleanId.includes('@') ? cleanId : undefined);
    setIsEditingAccount(false);
    setStatusMessage(`Đã cập nhật tài khoản: ${cleanName}`);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  // Format active battle party starmons for the server room record (always 3 Starmons for 3 questions in Phase 1)
  const unlockedParty = (playerStarmons || []).filter(s => s && s.unlocked);
  const fullPvpRoster = unlockedParty.length >= 3
    ? unlockedParty.slice(0, 3)
    : [...unlockedParty, ...STARMON_ROSTER.filter(r => !unlockedParty.some(u => u.id === r.id))].slice(0, 3);
  const myPartyStarmons = fullPvpRoster.map(s => ({
    id: s.id,
    name: s.name,
    element: s.element,
    level: s.level,
    maxHp: s.maxHp,
    baseAtk: s.baseAtk,
    def: s.def,
    avatarSeed: s.avatarSeed,
    skill1: s.skill1,
    skill2: s.skill2,
    passive: s.passive,
  }));

  // Fetch and subscribe to active waiting rooms via both Firestore and Server
  const fetchRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setRooms(() => {
            const map = new Map<string, PvpRoom>();
            data.forEach((r: PvpRoom) => {
              if (r && r.status === 'WAITING') {
                map.set(sanitizeRoomCode(r.room_code || r.code), r);
              }
            });
            return Array.from(map.values());
          });
        }
      }
    } catch {
      // Ignore network hiccup
    } finally {
      setIsLoadingRooms(false);
    }
  };

  // Setup Real-time Listeners (Supabase + WebSocket fallback)
  useEffect(() => {
    fetchRooms();
    const pollingTimer = setInterval(fetchRooms, 3000);

    // 1. Real-time Supabase active rooms listener (cross-container & cross-device)
    let unsubFsRooms = () => {};
    try {
      unsubFsRooms = subscribeToActivePvpRooms((fsRooms) => {
        if (Array.isArray(fsRooms)) {
          setRooms(prev => {
            const map = new Map<string, PvpRoom>();
            prev.forEach(r => {
              if (r && r.status === 'WAITING') {
                map.set(sanitizeRoomCode(r.room_code || r.code), r);
              }
            });
            fsRooms.forEach(r => {
              const k = sanitizeRoomCode(r.room_code || r.code);
              if (r && r.status === 'WAITING') {
                map.set(k, r);
              } else {
                map.delete(k);
              }
            });
            return Array.from(map.values());
          });
        }
      });
    } catch (e) {
      console.warn('Supabase active rooms subscribe error:', e);
    }

    // 2. WebSocket listener for room state updates
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = (import.meta as any).env?.VITE_WS_URL || `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'JOIN_LOBBY' }));
        if (currentRoom) {
          ws.send(JSON.stringify({
            type: 'JOIN_ROOM',
            room_code: currentRoom.room_code || currentRoom.code,
            user_id: activeGoogleId,
            user_name: activeGoogleName,
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ACCOUNTS_UPDATED' && Array.isArray(msg.accounts)) {
            setAvailableAccounts(msg.accounts);
          } else if (msg.type === 'ROOMS_UPDATED' && Array.isArray(msg.rooms)) {
            setRooms(msg.rooms);
          } else if (msg.type === 'ROOM_STATE_UPDATED' && msg.room) {
            const updatedRoom: PvpRoom = msg.room;
            setCurrentRoom(prev => {
              const prevCode = sanitizeRoomCode(prev?.room_code || prev?.code || '');
              const newCode = sanitizeRoomCode(updatedRoom.room_code || updatedRoom.code || '');
              if (prev && prevCode === newCode) {
                if (updatedRoom.players.length > announcedPlayerCountRef.current) {
                  announcedPlayerCountRef.current = updatedRoom.players.length;
                  sound.playRewardFanfare();
                }
                return updatedRoom;
              }
              return prev;
            });
          } else if ((msg.type === 'MATCH_STARTED' || msg.type === 'match_start') && msg.room) {
            handleMatchLaunch(msg.room);
          } else if (msg.type === 'ROOM_CLOSED') {
            sound.playWrong();
            announcedPlayerCountRef.current = 1;
            hasLaunchedRef.current = false;
            setCurrentRoom(null);
            setStatusMessage('Chủ phòng đã hủy phòng đấu.');
            setTimeout(() => setStatusMessage(''), 4000);
          }
        } catch {}
      };
    } catch (e) {
      console.warn('WS lobby error:', e);
    }

    return () => {
      clearInterval(pollingTimer);
      unsubFsRooms();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Real-time Supabase Subscription for CURRENT ACTIVE ROOM
  const activeRoomCode = currentRoom ? sanitizeRoomCode(currentRoom.room_code || currentRoom.code) : null;

  useEffect(() => {
    if (!activeRoomCode) {
      announcedPlayerCountRef.current = 1;
      hasLaunchedRef.current = false;
      return;
    }

    // 1. Subscribe to Supabase for instantaneous updates
    let unsubRoom = () => {};
    try {
      unsubRoom = subscribeToPvpRoom(activeRoomCode, (updatedRoom) => {
        // Do NOT immediately kick the player out if updatedRoom is null
        if (!updatedRoom) {
          return;
        }

        if (updatedRoom.status === 'FINISHED') {
          sound.playWrong();
          announcedPlayerCountRef.current = 1;
          hasLaunchedRef.current = false;
          setCurrentRoom(null);
          setStatusMessage('Phòng đấu đã đóng hoặc bị hủy.');
          setTimeout(() => setStatusMessage(''), 4000);
          return;
        }

        if (updatedRoom.status === 'IN_GAME' || (updatedRoom.players && updatedRoom.players.length >= 2)) {
          sound.playRewardFanfare();
          setStatusMessage('⚔️ Đã đủ 2 người chơi! Đang bắt đầu trận đấu và chuyển đến Phase 1.1...');
          handleMatchLaunch(updatedRoom);
          return;
        }

        setCurrentRoom(prev => {
          if (!prev) return updatedRoom;
          // Guard: Play sound and announce ONLY once per player joined
          if (updatedRoom.players.length > announcedPlayerCountRef.current) {
            announcedPlayerCountRef.current = updatedRoom.players.length;
            sound.playRewardFanfare();
            const guest = updatedRoom.players[1];
            setStatusMessage(`Đối thủ ${guest?.name || 'Player 2'} đã vào phòng đấu! Đang chuyển đến Phase 1.1...`);
            setTimeout(() => setStatusMessage(''), 4000);
          }
          return updatedRoom;
        });
      });
    } catch (e) {
      console.warn('Supabase room subscribe error:', e);
    }

    // 2. Join room channel over WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'JOIN_ROOM',
        room_code: activeRoomCode,
        user_id: activeGoogleId,
        user_name: activeGoogleName,
      }));
    }

    return () => {
      unsubRoom();
    };
  }, [activeRoomCode, activeGoogleId, activeGoogleName]);

  // Transition both players to PvP Battle with actual opponent Starmons
  const handleMatchLaunch = (room: PvpRoom, overrideUserId?: string) => {
    if (hasLaunchedRef.current) return;
    hasLaunchedRef.current = true;
    sound.playSwoosh();

    let currentUid = overrideUserId || activeGoogleId;
    let currentName = activeGoogleName;
    try {
      const savedUid = sessionStorage.getItem('starmon_pvp_session_uid');
      const savedName = sessionStorage.getItem('starmon_pvp_session_name');
      if (!overrideUserId && savedUid) currentUid = savedUid;
      if (savedName) currentName = savedName;
    } catch {}

    // Determine Slot 1 (Host / TRÁI) vs Slot 2 (Guest / PHẢI) deterministically
    const isMeHost = isRoomHostRef.current !== null
      ? isRoomHostRef.current
      : (currentUid === room.host_id);

    const myPlayerEntry = isMeHost
      ? (room.players.find(p => p.isHost) || room.players[0])
      : (room.players.find(p => !p.isHost) || room.players[1]);

    const opponent = isMeHost
      ? (room.players.find(p => !p.isHost) || room.players[1] || room.players[0])
      : (room.players.find(p => p.isHost) || room.players[0]);

    const opponentStarmons = (opponent?.starmons && opponent.starmons.length > 0)
      ? (opponent.starmons as any)
      : undefined;

    onStartPvPBattle({
      code: room.room_code || room.code,
      hostName: room.hostName || 'Host',
      hostId: room.host_id,
      arena: room.arena,
      myPlayerId: myPlayerEntry?.id || currentUid,
      myPlayerName: myPlayerEntry?.name || currentName,
      isHost: isMeHost,
      opponentId: opponent?.id,
      opponentName: opponent ? `${opponent.name}` : room.hostName,
      opponentStarmons,
    });
  };

  // Auto-launch match as soon as both players are in the room!
  useEffect(() => {
    if (!currentRoom || currentRoom.players.length < 2) return;
    if (hasLaunchedRef.current) return;

    sound.playRewardFanfare();
    setStatusMessage('⚔️ Cả 2 người chơi đã vào phòng! Đang chuyển đến Phase 1.1...');
    const timer = setTimeout(() => {
      if (hasLaunchedRef.current) return;
      handleMatchLaunch({
        ...currentRoom,
        status: 'IN_GAME',
      });
    }, 700);

    return () => clearTimeout(timer);
  }, [currentRoom?.players?.length]);

  // Handle Create Room (Persisted in Firestore & Central Server)
  const handleCreateRoom = async () => {
    sound.playClick();
    isRoomHostRef.current = true;
    setIsProcessing(true);
    setJoinError('');

    const newCode = customRoomCodeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') ||
      Math.floor(100000 + Math.random() * 900000).toString();

    const hostPlayer: PlayerInRoom = {
      id: activeGoogleId,
      name: activeGoogleName,
      level: playerLevel || 1,
      isHost: true,
      isReady: true,
      starmons: myPartyStarmons,
    };

    const newRoom: PvpRoom = {
      room_code: newCode,
      code: newCode,
      host_id: activeGoogleId,
      hostName: activeGoogleName,
      hostLevel: playerLevel || 1,
      arena: selectedArena,
      status: 'WAITING',
      players: [hostPlayer],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    let createdRoom: PvpRoom;

    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newRoom,
          custom_code: newCode,
          host_id: activeGoogleId,
          host_name: activeGoogleName,
          hostLevel: playerLevel || 1,
          starmons: myPartyStarmons,
          players: [hostPlayer],
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      const responseBody = contentType.includes('application/json')
        ? await res.json()
        : null;
      if (!res.ok) {
        throw new Error(responseBody?.error || `Server trả về lỗi ${res.status}.`);
      }
      if (!responseBody?.room_code) {
        throw new Error('Server không phản hồi dữ liệu phòng hợp lệ. Hãy mở game qua server đầy đủ, không dùng Vite frontend độc lập.');
      }
      createdRoom = responseBody as PvpRoom;

      // Firestore is a cross-device mirror; the Express server is required for
      // room creation and remains the authoritative local PvP server.
      void savePvpRoomToFirestore(createdRoom).then(firestoreSaved => {
        if (!firestoreSaved) {
          console.warn('Firestore room mirror failed; room remains available on the game server.');
        }
      });

      setCurrentRoom(createdRoom);
      sound.playRewardFanfare();

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'JOIN_ROOM',
          room_code: newCode,
          user_id: activeGoogleId,
          user_name: activeGoogleName,
        }));
      }
    } catch (err: any) {
      console.error('Error creating room:', err);
      setJoinError(err instanceof Error ? err.message : 'Không thể tạo phòng lúc này. Vui lòng thử lại!');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Join Room by 6-digit code or custom code
  const handleJoinByCode = async (targetCode: string) => {
    const raw = (targetCode || '').trim();
    const cleanCode = sanitizeRoomCode(raw);
    if (!cleanCode) {
      sound.playWrong();
      setJoinError('Vui lòng nhập đúng mã phòng (ví dụ: 6 chữ số hoặc mã custom)!');
      return;
    }

    sound.playClick();
    isRoomHostRef.current = false;
    setIsProcessing(true);
    setJoinError('');

    try {
      // The PvP server owns player-slot assignment and match state. Resolve the
      // join there first so clients cannot launch from a stale cloud copy.
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: cleanCode,
          user_id: activeGoogleId,
          user_name: activeGoogleName,
          user_level: playerLevel || 1,
          starmons: myPartyStarmons,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.room) {
        throw new Error(data?.error || 'Không thể kết nối tới máy chủ PvP.');
      }

      const resolved = { ...data.room, matchState: data.matchState || data.room.matchState } as PvpRoom;
      const effectiveId = data.joinedAsId || activeGoogleId;
      const effectiveName = data.joinedAsName || activeGoogleName;
      // Keep the Supabase room mirror aligned with the server-assigned Player 2.
      void savePvpRoomToFirestore(resolved);
      sound.playRewardFanfare();
      setActiveGoogleId(effectiveId);
      setActiveGoogleName(effectiveName);
      try {
        sessionStorage.setItem('starmon_pvp_session_uid', effectiveId);
        sessionStorage.setItem('starmon_pvp_session_name', effectiveName);
      } catch {}

      setCurrentRoom(resolved);
      if (resolved.status === 'IN_GAME' || (resolved.players && resolved.players.length >= 2)) {
        setStatusMessage('⚔️ Cả 2 người chơi đã vào phòng! Đang chuyển đến Phase 1.1...');
        setTimeout(() => handleMatchLaunch({ ...resolved, status: 'IN_GAME' }, effectiveId), 600);
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'JOIN_ROOM',
          room_code: resolved.room_code || resolved.code,
          user_id: effectiveId,
          user_name: effectiveName,
        }));
      }
    } catch (err: any) {
      console.error('Error joining room:', err);
      sound.playWrong();
      setJoinError(err instanceof Error ? err.message : 'Có lỗi khi tham gia phòng. Vui lòng kiểm tra lại mã!');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Host Start Match button (When both players are in room)
  const handleStartMatch = async () => {
    if (!currentRoom) return;
    sound.playClick();
    setIsProcessing(true);

    const roomCode = currentRoom.room_code || currentRoom.code;

    // 1. Update status in Firestore
    await updatePvpRoomStatusInFirestore(roomCode, 'IN_GAME');

    // 2. Also notify server
    try {
      await fetch('/api/rooms/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: roomCode,
          user_id: activeGoogleId,
        }),
      });
    } catch {}

    handleMatchLaunch({ ...currentRoom, status: 'IN_GAME' });
    setIsProcessing(false);
  };

  // Handle Leave or Cancel Room
  const handleLeaveRoom = async () => {
    if (!currentRoom) return;
    sound.playClick();

    const roomCode = currentRoom.room_code || currentRoom.code;
    const cleanCode = sanitizeRoomCode(roomCode);

    if (isHost) {
      deletePvpRoomInFirestore(cleanCode).catch(() => {});
    }

    try {
      await fetch('/api/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: cleanCode,
          user_id: activeGoogleId,
        }),
      });
    } catch {}

    setCurrentRoom(null);
    fetchRooms();
  };

  const handleCopyCode = (code: string) => {
    try {
      navigator.clipboard.writeText(code);
      setHasCopiedCode(true);
      sound.playClick();
      setTimeout(() => setHasCopiedCode(false), 2500);
    } catch {}
  };

  // Determine role in current room
  const isHost = currentRoom ? (currentRoom.host_id === activeGoogleId || (currentRoom.players[0]?.id === activeGoogleId)) : false;
  const hostPlayer = currentRoom?.players.find(p => p.isHost) || currentRoom?.players[0];
  const challengerPlayer = currentRoom?.players.find(p => !p.isHost) || (currentRoom?.players.length && currentRoom.players.length > 1 ? currentRoom.players[1] : null);
  const isReadyToStart = Boolean(hostPlayer && challengerPlayer && currentRoom && currentRoom.players.length >= 2);

  // Filtered rooms list in lobby
  const filteredRooms = rooms.filter(r => {
    if (!roomSearchQuery.trim()) return true;
    const q = roomSearchQuery.trim().toUpperCase();
    const code = (r.room_code || r.code || '').toUpperCase();
    const host = (r.hostName || '').toUpperCase();
    return code.includes(q) || host.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 md:p-5 animate-in zoom-in-95 duration-200">
      <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl p-5 md:p-6 max-w-lg w-full text-slate-100 shadow-2xl flex flex-col gap-3.5 relative max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={() => {
            if (currentRoom) {
              handleLeaveRoom();
            }
            onClose();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors"
          title="Đóng cửa sổ"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Global Status Notice */}
        {statusMessage && (
          <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500 text-xs text-cyan-300 font-bold flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* PROMINENT GOOGLE ACCOUNT IDENTITY BAR */}
        {/* ======================================================== */}
        <div className="p-3 bg-gradient-to-r from-slate-950 via-indigo-950/60 to-slate-950 rounded-2xl border border-indigo-500/40 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-md shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
              </div>
              <div className="leading-tight">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Tài khoản Google đang kết nối PvP:
                </span>
                <span className="text-xs font-black text-amber-300 font-mono">
                  {activeGoogleName} <span className="text-slate-400 font-normal">({activeGoogleId})</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsEditingAccount(!isEditingAccount)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold border border-slate-700 flex items-center gap-1 cursor-pointer transition-all"
                title="Tùy chỉnh Google User ID hoặc Email"
              >
                <Edit3 className="w-3 h-3" />
                <span>{isEditingAccount ? 'Đóng' : 'Đổi'}</span>
              </button>
            </div>
          </div>

          {/* Quick Profile Switcher for cross-account PvP */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
            <span className="text-[10px] text-slate-400 font-bold shrink-0">Chọn tài khoản PvP:</span>
            {availableAccounts.length > 0 ? (
              availableAccounts.map((acc: any) => {
                const id = acc.googleId || acc.username;
                const name = acc.username || id;
                const isSelected = activeGoogleId === id || activeGoogleName === name;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleQuickSwitchAccount(id, name)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-sm'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400/50 hover:text-white'
                    }`}
                  >
                    {name}
                  </button>
                );
              })
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleQuickSwitchAccount('google_acc_A', 'Tài khoản Google A')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                    activeGoogleId === 'google_acc_A'
                      ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Google Acc A
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSwitchAccount('google_acc_B', 'Tài khoản Google B')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                    activeGoogleId === 'google_acc_B'
                      ? 'bg-cyan-400 text-slate-950 border-cyan-300 font-black shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Google Acc B
                </button>
              </>
            )}
          </div>

          {/* Custom Google Account Editor */}
          {isEditingAccount && (
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 flex flex-col gap-2 mt-1 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-0.5">Tên hiển thị:</label>
                  <input
                    type="text"
                    value={tempGoogleNameInput}
                    onChange={(e) => setTempGoogleNameInput(e.target.value)}
                    placeholder="VD: Google Player 1"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-0.5">Google User ID / Email:</label>
                  <input
                    type="text"
                    value={tempGoogleIdInput}
                    onChange={(e) => setTempGoogleIdInput(e.target.value)}
                    placeholder="VD: google_user_1126 hoặc email"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveCustomAccount}
                className="py-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 text-slate-950 font-black font-game text-xs rounded-lg cursor-pointer"
              >
                Lưu Thông Tin Tài Khoản
              </button>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* VIEW 1: SHARED WAITING LOBBY (MÀN HÌNH CHỜ MULTIPLAYER) */}
        {/* ======================================================== */}
        {currentRoom ? (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            {/* Header with Room Arena */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border-2 border-amber-400/50 flex items-center justify-center text-amber-300 shadow">
                  <Swords className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black font-game text-amber-300">
                    MULTIPLAYER WAITING LOBBY
                  </h2>
                  <p className="text-xs text-slate-400">
                    Đấu trường: <strong className="text-amber-200">{getArenaMap(currentRoom.arena).name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={handleLeaveRoom}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border border-slate-700"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{isHost ? 'Hủy phòng' : 'Rời phòng'}</span>
              </button>
            </div>

            {/* Room Code Card (6 Digits) */}
            <div className="p-4 bg-slate-950 rounded-2xl border-2 border-amber-400/80 flex flex-col items-center gap-2 text-center shadow-lg">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                MÃ PHÒNG (ROOM CODE - 6 CHỮ SỐ)
              </span>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl md:text-4xl font-black font-mono tracking-widest text-amber-300 drop-shadow">
                  {currentRoom.room_code || currentRoom.code}
                </span>
                <button
                  onClick={() => handleCopyCode(currentRoom.room_code || currentRoom.code)}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer active:scale-90 transition-all border border-slate-700"
                  title="Sao chép mã phòng"
                >
                  {hasCopiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {hasCopiedCode && (
                <span className="text-[10px] font-bold text-emerald-400 animate-in fade-in">
                  ✓ Đã sao chép mã phòng! Hãy gửi mã này cho Tài khoản Google khác để vào.
                </span>
              )}

              {/* Status Badge */}
              <div className="mt-1">
                {isReadyToStart ? (
                  <span className="px-3.5 py-1.5 rounded-full bg-emerald-950 border border-emerald-500/80 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-pulse shadow-lg shadow-emerald-500/20">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>ĐÃ ĐỦ 2 NGƯỜI CHƠI · SẴN SÀNG CHIẾN ĐẤU (2/2)</span>
                  </span>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-full bg-amber-950 border border-amber-500/80 text-amber-300 text-xs font-bold flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    <span>ĐANG ĐỢI ĐỐI THỦ NHẬP MÃ PHÒNG (1/2)</span>
                  </span>
                )}
              </div>
            </div>

            {/* 2 Player Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Player 1: Host Card */}
              <div className="p-3.5 bg-slate-950 rounded-2xl border-2 border-indigo-500/60 flex flex-col gap-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-bold border border-indigo-700 flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-400" />
                    <span>CHỦ PHÒNG {isHost ? '(BẠN)' : ''}</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400">✓ Sẵn sàng</span>
                </div>

                <div>
                  <h4 className="font-black text-sm text-white truncate">
                    {hostPlayer?.name || activeGoogleName}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono">
                    ID: {hostPlayer?.id || currentRoom.host_id} · Lv.{hostPlayer?.level || playerLevel}
                  </p>
                </div>

                {/* Starmon party preview */}
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
                  {hostPlayer?.starmons && hostPlayer.starmons.length > 0 ? (
                    hostPlayer.starmons.slice(0, 3).map((m: any, mIdx: number) => {
                      const monId = typeof m === 'string' ? m : (m?.avatarSeed || m?.id || 'coralus');
                      const monName = typeof m === 'object' && m?.name ? m.name : 'Starmon';
                      const monElem = typeof m === 'object' && m?.element ? m.element : '';
                      return (
                        <div key={m?.id || `host_m_${mIdx}`} className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 p-0.5 flex items-center justify-center" title={`${monName} ${monElem ? `(${monElem})` : ''}`}>
                          <StarmonAsset id={monId} size="xs" />
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-[10px] text-slate-500 italic">Đội hình chuẩn bị</span>
                  )}
                </div>
              </div>

              {/* Player 2: Challenger Card */}
              <div className={`p-3.5 bg-slate-950 rounded-2xl border-2 flex flex-col gap-2 relative ${
                challengerPlayer ? 'border-amber-500/60' : 'border-dashed border-slate-800'
              }`}>
                {challengerPlayer ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 font-bold border border-amber-700 flex items-center gap-1">
                        <Swords className="w-3 h-3 text-amber-400" />
                        <span>ĐỐI THỦ {!isHost ? '(BẠN)' : ''}</span>
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400">✓ Đã vào phòng</span>
                    </div>

                    <div>
                      <h4 className="font-black text-sm text-white truncate">
                        {challengerPlayer.name || 'Người chơi 2'}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        ID: {challengerPlayer.id} · Lv.{challengerPlayer.level || 1}
                      </p>
                    </div>

                    {/* Challenger Starmons */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
                      {challengerPlayer.starmons && challengerPlayer.starmons.length > 0 ? (
                        challengerPlayer.starmons.slice(0, 3).map((m: any, mIdx: number) => {
                          const monId = typeof m === 'string' ? m : (m?.avatarSeed || m?.id || 'voltlynx');
                          const monName = typeof m === 'object' && m?.name ? m.name : 'Starmon';
                          const monElem = typeof m === 'object' && m?.element ? m.element : '';
                          return (
                            <div key={m?.id || `chall_m_${mIdx}`} className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 p-0.5 flex items-center justify-center" title={`${monName} ${monElem ? `(${monElem})` : ''}`}>
                              <StarmonAsset id={monId} size="xs" />
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">Đội hình chuẩn bị</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 text-center gap-1.5 h-full">
                    <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 animate-pulse">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-400">Đang chờ đối thủ tham gia...</span>
                    <span className="text-[9px] text-slate-500 max-w-[140px]">Nhập mã {currentRoom.room_code || currentRoom.code} để vào</span>
                  </div>
                )}
              </div>
            </div>

            {/* Pre-Phase 1 Rule Notice */}
            <div className="p-3 bg-amber-950/50 border border-amber-400/70 rounded-2xl text-center shadow-md">
              <p className="text-xs md:text-sm font-black text-amber-300 leading-relaxed">
                ⏱️ Phase 1: Bạn có tổng cộng 2 phút để trả lời 3 câu hỏi. Nếu hết giờ, những câu chưa được trả lời sẽ bị tính là 0 điểm
              </p>
            </div>

            {/* Action Bar: Auto-start on opponent join */}
            <div className="pt-2">
              {!isReadyToStart ? (
                <div className="p-3.5 bg-slate-950/80 border-2 border-dashed border-amber-500/60 rounded-2xl flex items-center justify-center gap-3 text-amber-300 text-xs font-bold animate-pulse text-center shadow-lg">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  <span className="tracking-wide">Waiting for opponent... (Đang chờ đối thủ vào phòng...)</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleStartMatch}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-black font-game text-base rounded-2xl shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all animate-pulse"
                  >
                    <Play className="w-5 h-5 fill-slate-950" />
                    <span>⚔️ BẮT ĐẦU TRẬN ĐẤU NGAY ➔ CHUYỂN ĐẾN PHASE 1.1</span>
                  </button>
                  <p className="text-center text-[11px] font-bold text-emerald-400">
                    ⚔️ Cả 2 người chơi đã vào phòng! Trận đấu đang tự động chuyển đến Phase 1.1...
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* VIEW 2: LOBBY BROWSER (JOIN, CREATE, PVE, TUTORIAL TABS) */
          /* ======================================================== */
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border-2 border-amber-400/50 flex items-center justify-center text-amber-300 shadow">
                <Swords className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black font-game text-amber-300">
                    PvP MULTIPLAYER ARENA
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 border border-amber-500/60 text-amber-300 font-mono font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Supabase: {SUPABASE_PROJECT_ID}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Đồng bộ phòng thời gian thực qua Supabase ({SUPABASE_PROJECT_ID})
                </p>
              </div>
            </div>

            {/* 4 Choices: JOIN ROOM, CREATE ROOM, PVE DUNGEON, TUTORIAL */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-2xl bg-slate-950 p-1.5 border border-slate-800">
              <button
                onClick={() => {
                  sound.playClick();
                  setActiveTab('join');
                  setJoinError('');
                }}
                className={`py-2 px-1 rounded-xl text-xs font-black font-game flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'join'
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>JOIN ROOM</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  setActiveTab('create');
                  setJoinError('');
                }}
                className={`py-2 px-1 rounded-xl text-xs font-black font-game flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'create'
                    ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>CREATE ROOM</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  setActiveTab('pve');
                  setJoinError('');
                }}
                className={`py-2 px-1 rounded-xl text-xs font-black font-game flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'pve'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>PVE BOT</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  setActiveTab('tutorial');
                  setJoinError('');
                }}
                className={`py-2 px-1 rounded-xl text-xs font-black font-game flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'tutorial'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>TUTORIAL</span>
              </button>
            </div>

            {/* TAB 1: JOIN ROOM */}
            {activeTab === 'join' && (
              <div className="flex flex-col gap-3">
                {/* Direct 6-Digit Code Input Box */}
                <div className="p-4 bg-slate-950 rounded-2xl border-2 border-amber-400/50 flex flex-col gap-2.5 shadow-md">
                  <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-amber-300">
                      <Search className="w-3.5 h-3.5" />
                      <span>Nhập mã phòng (Room Code):</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Mã 6 chữ số</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={joinCodeInput}
                      onChange={(e) => {
                        setJoinCodeInput(e.target.value.toUpperCase());
                        setJoinError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleJoinByCode(joinCodeInput);
                      }}
                      placeholder="VD: 469634"
                      maxLength={12}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border-2 border-slate-700 text-amber-300 font-mono text-lg tracking-widest font-bold uppercase focus:outline-none focus:border-amber-400 transition-colors"
                    />
                    <button
                      onClick={() => handleJoinByCode(joinCodeInput)}
                      disabled={isProcessing}
                      className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 font-black font-game text-slate-950 text-xs md:text-sm rounded-xl shadow-lg cursor-pointer active:scale-95 transition-transform flex items-center gap-1.5"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>{isProcessing ? 'ĐANG TÌM...' : 'VÀO PHÒNG'}</span>
                    </button>
                  </div>

                  {/* Preset Quick Join: STARMON-CC9C2 */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-indigo-500/40 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-[11px] text-slate-300 font-bold">
                        Phòng mẫu: <strong className="text-amber-300 font-mono">STARMON-CC9C2</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setJoinCodeInput('STARMON-8C425');
                        handleJoinByCode('STARMON-8C425');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold cursor-pointer transition-all active:scale-95 shadow"
                    >
                      Vào phòng starmon-8c425
                    </button>
                  </div>

                  {joinError && (
                    <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500 text-xs text-rose-300 font-bold flex items-center gap-2 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{joinError}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setBluetoothPrompt(bluetoothPrompt === 'join' ? null : 'join');
                    }}
                    className="w-full py-3 rounded-2xl border border-sky-500/50 bg-sky-950/50 hover:bg-sky-900/60 text-sky-200 font-black font-game text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <Bluetooth className="w-4 h-4" />
                    <span>JOIN ROOM VIA BLUETOOTH</span>
                  </button>
                  {bluetoothPrompt === 'join' && (
                    <p role="status" className="text-center text-xs font-bold text-sky-300">
                      Vui lòng bật Bluetooth trên thiết bị để tham gia trận đấu.
                    </p>
                  )}
                </div>

                {/* Active Available Rooms List on Central Server */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                      <span>Phòng đang chờ trên Server:</span>
                      <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-800 text-amber-300 font-mono font-bold">
                        {filteredRooms.length}
                      </span>
                    </span>
                    <button
                      onClick={fetchRooms}
                      disabled={isLoadingRooms}
                      className="text-cyan-400 hover:text-cyan-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingRooms ? 'animate-spin' : ''}`} />
                      <span>Làm mới</span>
                    </button>
                  </div>

                  {rooms.length > 2 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={roomSearchQuery}
                        onChange={(e) => setRoomSearchQuery(e.target.value)}
                        placeholder="Tìm theo mã phòng hoặc tên chủ phòng..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  )}

                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {filteredRooms.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                        Chưa có phòng nào đang mở trên máy chủ. Hãy bấm tab <strong>"CREATE ROOM"</strong> để tạo phòng mới và chia sẻ mã 6 chữ số!
                      </div>
                    ) : (
                      filteredRooms.map(room => (
                        <div
                          key={room.room_code || room.code}
                          className="p-3 bg-slate-950 hover:bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-amber-400/60 flex items-center justify-between transition-all"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black font-mono text-amber-300 px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30">
                                {room.room_code || room.code}
                              </span>
                              <span className="text-xs font-bold text-white">{room.hostName}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 font-mono font-bold">
                                Lv.{room.hostLevel}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                              Đấu trường: <strong className="text-slate-300">{getArenaMap(room.arena).name}</strong>
                            </p>
                          </div>

                          <button
                            onClick={() => handleJoinByCode(room.room_code || room.code)}
                            className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-black font-game text-xs rounded-xl shadow cursor-pointer active:scale-95 flex items-center gap-1.5 transition-transform"
                          >
                            <span>VÀO PHÒNG</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CREATE ROOM */}
            {activeTab === 'create' && (
              <div className="flex flex-col gap-3">
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300">Chọn Đấu trường PvP:</label>
                  <div className="max-h-56 overflow-y-auto pr-1">
                    <div className="grid grid-cols-2 gap-2">
                    {ARENA_MAPS.map(a => (
                      <button
                        key={a.name}
                        onClick={() => setSelectedArena(a.name)}
                        style={{ backgroundImage: `linear-gradient(90deg, rgba(2,6,23,.88), rgba(2,6,23,.48)), url("${a.preview}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                        className={`relative h-14 overflow-hidden p-2 rounded-xl border text-left transition-all cursor-pointer ${
                          selectedArena === a.name
                            ? 'bg-amber-400/10 border-amber-400 text-white shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <p className="relative z-10 text-xs font-bold truncate text-white drop-shadow">{a.name}</p>
                        <p className="relative z-10 text-[9px] text-slate-200/80 truncate drop-shadow">{a.description}</p>
                      </button>
                    ))}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>Mã phòng tùy chỉnh (Tùy chọn):</span>
                    <span className="text-[10px] text-slate-500 font-mono">Bỏ trống để tạo mã 6 chữ số tự động</span>
                  </label>
                  <input
                    type="text"
                    value={customRoomCodeInput}
                    onChange={(e) => setCustomRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="VD: 888999 (bỏ trống để tự tạo mã)"
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono text-sm tracking-wider font-bold uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Chủ phòng tạo</span>
                    <strong className="text-white text-sm">{activeGoogleName} (Lv. {playerLevel})</strong>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                    Sẵn sàng
                  </span>
                </div>

                {joinError && (
                  <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500 text-xs text-rose-300 font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{joinError}</span>
                  </div>
                )}

                <button
                  onClick={handleCreateRoom}
                  disabled={isProcessing}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 font-black font-game text-slate-950 text-sm rounded-2xl shadow-lg cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isProcessing ? 'ĐANG TẠO PHÒNG TRÊN SERVER...' : '⚔️ TẠO PHÒNG VÀ VÀO PHÒNG CHỜ (LOBBY)'}</span>
                </button>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setBluetoothPrompt(bluetoothPrompt === 'create' ? null : 'create');
                    }}
                    className="w-full py-3 rounded-2xl border border-sky-500/50 bg-sky-950/50 hover:bg-sky-900/60 text-sky-200 font-black font-game text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <Bluetooth className="w-4 h-4" />
                    <span>CREATE ROOM VIA BLUETOOTH</span>
                  </button>
                  {bluetoothPrompt === 'create' && (
                    <p role="status" className="text-center text-xs font-bold text-sky-300">
                      Vui lòng bật Bluetooth trên thiết bị để tạo trận đấu.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: PVE BOT */}
            {activeTab === 'pve' && (
              <div className="flex flex-col gap-3.5 animate-in fade-in duration-200">
                <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 flex flex-col items-center text-center gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow">
                    <Bot className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h3 className="text-base font-black font-game text-white">
                    PvE SOLO DUNGEON (ĐẤU VỚI MÁY)
                  </h3>
                  <p className="text-xs text-slate-300 max-w-sm leading-relaxed">
                    Chế độ luyện tập đơn phương một mình chống lại các quái vật AI hoang dã. Vượt qua thử thách MCQ & IELTS Speaking để mở Rương Chiến Thắng!
                  </p>
                </div>

                <button
                  onClick={() => {
                    sound.playSwoosh();
                    onStartPveBattle?.();
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 text-white font-black font-game text-sm rounded-2xl shadow-xl transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>BẮT ĐẦU LUYỆN TẬP VỚI MÁY</span>
                </button>
              </div>
            )}

            {/* TAB 4: TUTORIAL */}
            {activeTab === 'tutorial' && (
              <div className="flex flex-col gap-3 animate-in fade-in duration-200">
                <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col items-center text-center gap-1.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow">
                    <Sparkles className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-base font-black font-game text-white">
                    COMBAT ACADEMY TUTORIAL
                  </h3>
                  <p className="text-xs text-slate-300 max-w-sm leading-relaxed">
                    Học nhanh các cơ chế cốt lõi qua 3 giai đoạn hoặc chọn bỏ qua hướng dẫn bất kỳ lúc nào!
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-left">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
                    <span className="font-bold text-sky-400 block mb-0.5">Tutorial 1: Basics</span>
                    <span className="text-slate-400 block text-[10px] leading-tight">
                      MCQ, IELTS Speaking, Match-3 orbs & đổi mục tiêu kẻ địch.
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
                    <span className="font-bold text-purple-400 block mb-0.5">Tutorial 2: Abilities</span>
                    <span className="text-slate-400 block text-[10px] leading-tight">
                      Passive (0 tốn tài nguyên) vs Active (mất lượt và tốn Mana).
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
                    <span className="font-bold text-amber-400 block mb-0.5">Tutorial 3: Elements</span>
                    <span className="text-slate-400 block text-[10px] leading-tight">
                      Vòng 6 hệ, Same-Element (+10%), Counter (+10%), Resistance (-10%).
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    sound.playClick();
                    onOpenTutorial?.();
                  }}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 text-slate-950 font-black font-game text-xs md:text-sm rounded-xl shadow-lg cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>START TUTORIAL</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
