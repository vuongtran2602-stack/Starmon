import React, { useState, useRef, useEffect } from 'react';
import { PlayerProfile, Starmon, StarmonSaveFile, UserAccount, QuestItem } from '../types';
import { GOLD_IMAGE, GEM_IMAGE } from '../data/itemsData';
import { INITIAL_QUESTS } from '../data/questsData';
import { sound } from '../services/sound';
import {
  SUPABASE_PROJECT_ID,
} from '../services/supabase';
import {
  User,
  Download,
  Upload,
  KeyRound,
  UserPlus,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck,
  ShieldCheck,
  Sparkles,
  Package,
  Layers,
  Coins,
  Cloud,
  RotateCcw
} from 'lucide-react';

interface Props {
  player: PlayerProfile;
  starmons: Starmon[];
  quests: QuestItem[];
  initialTab?: 'profile' | 'auth' | 'backup' | 'restore' | 'password';
  onClose: () => void;
  onRestoreSave: (loadedPlayer: PlayerProfile, loadedStarmons: Starmon[], accountUsername?: string, loadedQuests?: QuestItem[]) => void;
  onSwitchUser: (username: string) => void;
  onResetProgress?: () => void;
}

const ACCOUNTS_STORAGE_KEY = 'starmon_accounts_db_v2';
const CURRENT_USER_KEY = 'starmon_current_user_v2';

export function getAllAccounts(): Record<string, UserAccount> {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function getAccountsArray(): UserAccount[] {
  const accounts = getAllAccounts();
  const seen = new Set<string>();
  const list: UserAccount[] = [];
  for (const acc of Object.values(accounts)) {
    if (!acc || typeof acc !== 'object') continue;
    const key = (acc.googleId || acc.email || acc.username || '').toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      list.push(acc);
    }
  }
  return list;
}

export function saveAccount(account: UserAccount) {
  try {
    const accounts = getAllAccounts();
    const key = account.username.toLowerCase();
    accounts[key] = account;
    if (account.googleId) {
      accounts[account.googleId.toLowerCase()] = account;
    }
    if (account.email) {
      accounts[account.email.toLowerCase()] = account;
    }
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));

    // Sync private game-account data through the backend service role.
    fetch('/api/accounts/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account),
    }).catch(e => console.warn('Account server sync notice:', e));
  } catch (e) {
    console.warn('Failed to save account:', e);
  }
}

export async function syncAccountsFromServer(): Promise<Record<string, UserAccount>> {
  try {
    const local = getAllAccounts();
    const merged = { ...local };

    // Game account records are private and are fetched through the backend.
    const res = await fetch('/api/accounts');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        const incomingAccounts: UserAccount[] = Array.isArray(data.accounts)
          ? data.accounts
          : (Object.values(data) as any[]).filter(a => a && typeof a === 'object' && a.username);

        for (const acc of incomingAccounts) {
          const key = (acc.googleId || acc.email || acc.username || '').toLowerCase();
          if (key) merged[key] = acc;
          if (acc.username) merged[acc.username.toLowerCase()] = acc;
          if (acc.googleId) merged[acc.googleId.toLowerCase()] = acc;
          if (acc.email) merged[acc.email.toLowerCase()] = acc;
        }
      }
    }
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.warn('Sync accounts from server error:', err);
  }
  return getAllAccounts();
}

export function getCurrentUsername(): string | null {
  try {
    return localStorage.getItem(CURRENT_USER_KEY);
  } catch {}
  return null;
}

export function setCurrentUsername(username: string | null) {
  try {
    if (username) {
      localStorage.setItem(CURRENT_USER_KEY, username);
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch {}
}

export const AuthAndSaveModal: React.FC<Props> = ({
  player,
  starmons,
  quests,
  initialTab = 'profile',
  onClose,
  onRestoreSave,
  onSwitchUser,
  onResetProgress,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'auth' | 'backup' | 'restore' | 'password'>(initialTab);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');

  // Form states
  const [usernameInput, setUsernameInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [switchingAccountUsername, setSwitchingAccountUsername] = useState('');
  const [switchPasswordInput, setSwitchPasswordInput] = useState('');
  const [switchAccountError, setSwitchAccountError] = useState('');
  const [googleEmailInput, setGoogleEmailInput] = useState(player.googleEmail || '');
  const [googleIdInput, setGoogleIdInput] = useState(player.googleId || '');
  const [syncedAccounts, setSyncedAccounts] = useState<UserAccount[]>(() => getAccountsArray());

  // Synchronize accounts from central server and listen to real-time WebSocket events
  useEffect(() => {
    syncAccountsFromServer().then(() => {
      setSyncedAccounts(getAccountsArray());
    }).catch(() => {});

    let ws: WebSocket | null = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket((import.meta as any).env?.VITE_WS_URL || `${protocol}//${window.location.host}/ws`);
      ws.onopen = () => {
        ws?.send(JSON.stringify({ type: 'GET_ACCOUNTS' }));
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ACCOUNTS_UPDATED' && Array.isArray(msg.accounts)) {
            const local = getAllAccounts();
            const merged = { ...local };
            for (const acc of msg.accounts) {
              const key = (acc.googleId || acc.email || acc.username || '').toLowerCase();
              if (key) merged[key] = acc;
              if (acc.username) merged[acc.username.toLowerCase()] = acc;
              if (acc.googleId) merged[acc.googleId.toLowerCase()] = acc;
              if (acc.email) merged[acc.email.toLowerCase()] = acc;
            }
            localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(merged));
            setSyncedAccounts(msg.accounts);
          } else if (msg.type === 'ACCOUNT_SYNCED' && msg.account) {
            const acc = msg.account;
            const local = getAllAccounts();
            const key = (acc.googleId || acc.email || acc.username || '').toLowerCase();
            local[key] = acc;
            if (acc.username) local[acc.username.toLowerCase()] = acc;
            if (acc.googleId) local[acc.googleId.toLowerCase()] = acc;
            if (acc.email) local[acc.email.toLowerCase()] = acc;
            localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(local));
            setSyncedAccounts(getAccountsArray());
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const handleGoogleSync = async (targetEmail?: string, targetId?: string) => {
    const email = (targetEmail !== undefined ? targetEmail : googleEmailInput).trim();
    const gid = (targetId !== undefined ? targetId : googleIdInput).trim() || (email ? `google_${email.replace(/[^a-zA-Z0-9]/g, '_')}` : `google_${Date.now()}`);
    const name = email ? email.split('@')[0] : `Google_${gid.slice(-4)}`;

    setIsProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/accounts/google-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleId: gid,
          email: email || undefined,
          name,
          player: {
            ...player,
            name,
            username: name,
            googleId: gid,
            googleEmail: email || undefined,
          },
          starmons,
          quests,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const acc = data.account;
        sound.playRewardFanfare();
        setSuccessMessage(`Đã đồng bộ thành công Tài khoản Google: ${acc.username} (${acc.googleId})!`);
        setCurrentUsername(acc.username);
        try {
          localStorage.setItem('starmon_pvp_uid', acc.googleId);
          localStorage.setItem('starmon_google_id', acc.googleId);
        } catch {}
        setTimeout(() => {
          onRestoreSave(acc.player, acc.starmons || starmons, acc.username, acc.quests || quests);
          setActiveTab('profile');
          setSuccessMessage('');
        }, 800);
      } else {
        const err = await res.json();
        sound.playWrong();
        setErrorMessage(err.error || 'Lỗi đồng bộ tài khoản Google.');
      }
    } catch {
      sound.playWrong();
      setErrorMessage('Lỗi kết nối máy chủ khi đồng bộ tài khoản.');
    } finally {
      setIsProcessing(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUsername = player.username || getCurrentUsername() || 'Guest Adventurer';
  const isGuest = !player.username && !getCurrentUsername();

  const unlockedCount = starmons.filter(s => s.unlocked).length;
  const totalCards = starmons.reduce((acc, s) => acc + s.cards, 0);

  // ==========================================
  // CHANGE PASSWORD HANDLER
  // ==========================================
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const accounts = getAllAccounts();
    const username = (player.username || getCurrentUsername() || '').toLowerCase();
    const account = accounts[username];

    if (!account) {
      setErrorMessage('Please log into or create an account first before setting a password.');
      sound.playWrong();
      return;
    }

    if (account.pin && oldPinInput.trim() !== account.pin) {
      setErrorMessage('Current password / PIN does not match.');
      sound.playWrong();
      return;
    }

    if (newPinInput.trim().length < 3) {
      setErrorMessage('New password / PIN must be at least 3 characters.');
      sound.playWrong();
      return;
    }

    if (newPinInput.trim() !== confirmPinInput.trim()) {
      setErrorMessage('New password and Confirmation password do not match.');
      sound.playWrong();
      return;
    }

    account.pin = newPinInput.trim();
    saveAccount(account);
    sound.playRewardFanfare();
    setSuccessMessage('Password / PIN changed successfully!');
    setOldPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
  };

  // ==========================================
  // SIGN UP HANDLER
  // ==========================================
  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanUsername = usernameInput.trim();
    if (cleanUsername.length < 3) {
      setErrorMessage('Username must be at least 3 characters long.');
      sound.playWrong();
      return;
    }

    const accounts = getAllAccounts();
    const key = cleanUsername.toLowerCase();
    if (accounts[key]) {
      setErrorMessage('An account with this username already exists! Please log in.');
      sound.playWrong();
      return;
    }

    // New accounts start with 2 Starter Packs, 0 Starmon in inventory, 0 gold
    const newPlayerProfile: PlayerProfile = {
      name: cleanUsername,
      username: cleanUsername,
      googleId: player.googleId || '',
      googleEmail: player.googleEmail || '',
      level: 1,
      exp: 0,
      nextExp: 100,
      gold: 0,
      gems: 0,
      energy: 100,
      maxEnergy: 100,
      lastEnergyRegenTime: Date.now(),
      energyBatteries: {
        battery50: 5,
        battery100: 3,
        battery200: 1,
      },
      specialItems: {
        starShard: 15,
        goldenAnvil: 5,
      },
      starterPacksCount: 2,
      isNewPlayer: true,
      hasClaimedBeginnerPack: false,
      hasCompletedOnboardingTutorial: false,
      activeCompanionId: '',
      elementalPacks: { Wind: 0, Water: 0, Metal: 0, Fire: 0, Electric: 0, Earth: 0 },
      mailUnreadCount: 1,
      soundEnabled: player.soundEnabled ?? true,
      musicEnabled: player.musicEnabled ?? true,
      graphicsQuality: player.graphicsQuality ?? 'High',
    };

    // All Starmons locked with 0 cards
    const freshStarmons = starmons.map(s => ({
      ...s,
      unlocked: false,
      cards: 0,
      level: 1,
    }));

    // Fresh quests for brand new account
    const freshQuests = INITIAL_QUESTS.map(q => ({
      ...q,
      currentProgress: 0,
      claimed: false,
    }));

    const newAccount: UserAccount = {
      username: cleanUsername,
      pin: pinInput.trim() || undefined,
      googleId: player.googleId || '',
      email: player.googleEmail || '',
      createdAt: new Date().toISOString(),
      lastPlayedAt: new Date().toISOString(),
      player: newPlayerProfile,
      starmons: freshStarmons,
      quests: freshQuests,
    };

    saveAccount(newAccount);

    sound.playRewardFanfare();
    setSuccessMessage('Tạo tài khoản thành công. Hãy ấn đăng nhập để tiếp tục.');
    setAuthMode('login');
    setUsernameInput(cleanUsername);
    setPinInput('');
  };

  // ==========================================
  // LOG IN HANDLER
  // ==========================================
  const handleLogIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanUsername = usernameInput.trim();
    if (!cleanUsername) {
      setErrorMessage('Please enter your username.');
      sound.playWrong();
      return;
    }

    const accounts = getAllAccounts();
    const key = cleanUsername.toLowerCase();
    let account = accounts[key];

    // Try to fetch from central server if not in local storage
    if (!account) {
      try {
        const sRes = await fetch(`/api/accounts/${encodeURIComponent(cleanUsername)}`);
        if (sRes.ok) {
          account = await sRes.json();
          accounts[key] = account;
          localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
        }
      } catch {}
    }

    if (!account) {
      setErrorMessage(`No account found for "${cleanUsername}". Check the spelling or Sign Up!`);
      sound.playWrong();
      return;
    }

    if (account.pin && pinInput.trim() !== account.pin) {
      setErrorMessage('Incorrect PIN / Passcode.');
      sound.playWrong();
      return;
    }

    // Update last played
    account.lastPlayedAt = new Date().toISOString();
    saveAccount(account);
    setCurrentUsername(cleanUsername);

    const loadedQuests = account.quests && account.quests.length > 0
      ? account.quests
      : INITIAL_QUESTS.map(q => ({ ...q, currentProgress: 0, claimed: false }));

    sound.playRewardFanfare();
    setSuccessMessage(`Welcome back, ${account.username}! Loaded progress.`);
    setUsernameInput('');
    setPinInput('');

    setTimeout(() => {
      onRestoreSave(account.player, account.starmons, account.username, loadedQuests);
      setActiveTab('profile');
      setSuccessMessage('');
    }, 1000);
  };

  // ==========================================
  // DOWNLOAD PROGRESS FILE HANDLER (.json)
  // ==========================================
  const handleDownloadSave = () => {
    sound.playClick();
    setIsProcessing(true);

    try {
      const exportData: StarmonSaveFile = {
        app: 'Starmon: Tactics & RPG',
        version: '2.0',
        exportedAt: new Date().toISOString(),
        username: player.username || currentUsername,
        player: {
          ...player,
          username: player.username || currentUsername,
        },
        starmons,
        quests,
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `starmon_save_${(player.username || currentUsername).replace(/\s+/g, '_')}_lv${player.level}_${timestamp}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      sound.playRewardFanfare();
      setSuccessMessage(`Progress file downloaded: ${fileName}`);
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to generate save file. Please try again.');
      sound.playWrong();
    } finally {
      setIsProcessing(false);
    }
  };

  // ==========================================
  // UPLOAD PROGRESS FILE HANDLER
  // ==========================================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    sound.playClick();
    setIsProcessing(true);
    setErrorMessage('');
    setSuccessMessage('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Validation
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid JSON format.');
        }

        if (!parsed.player || !Array.isArray(parsed.starmons)) {
          throw new Error('Save file is missing player profile or starmon roster data.');
        }

        const loadedPlayer = parsed.player as PlayerProfile;
        const loadedStarmons = parsed.starmons as Starmon[];
        const loadedUser = parsed.username || loadedPlayer.username || loadedPlayer.name || 'Restored Player';
        const loadedQuests = Array.isArray(parsed.quests) && parsed.quests.length > 0
          ? (parsed.quests as QuestItem[])
          : INITIAL_QUESTS.map(q => ({ ...q, currentProgress: 0, claimed: false }));

        // Save account locally as well
        const account: UserAccount = {
          username: loadedUser,
          createdAt: parsed.exportedAt || new Date().toISOString(),
          lastPlayedAt: new Date().toISOString(),
          player: loadedPlayer,
          starmons: loadedStarmons,
          quests: loadedQuests,
        };
        saveAccount(account);
        setCurrentUsername(loadedUser);

        sound.playRewardFanfare();
        setSuccessMessage(`Progress restored successfully for "${loadedUser}" (Lv. ${loadedPlayer.level})!`);

        setTimeout(() => {
          onRestoreSave(loadedPlayer, loadedStarmons, loadedUser, loadedQuests);
          setActiveTab('profile');
          setSuccessMessage('');
        }, 1200);
      } catch (err: any) {
        console.error('Save import failed:', err);
        setErrorMessage(err.message || 'Could not parse save file. Make sure it is a valid Starmon JSON save.');
        sound.playWrong();
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setErrorMessage('Error reading file from disk.');
      sound.playWrong();
      setIsProcessing(false);
    };

    reader.readAsText(file);
  };

  const handleLogOut = () => {
    sound.playClick();
    setCurrentUsername(null);
    onSwitchUser('Guest Adventurer');
    setSuccessMessage('Logged out. Playing in Guest mode.');
    setTimeout(() => {
      setActiveTab('auth');
      setAuthMode('login');
      setSuccessMessage('');
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-slate-700/90 rounded-3xl p-5 md:p-6 max-w-xl w-full shadow-2xl text-slate-100 flex flex-col justify-between max-h-[90vh] overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-black font-game text-white flex flex-wrap items-center gap-2">
                <span>Account & Cloud Save</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold flex items-center gap-1">
                  <Cloud className="w-3 h-3 text-amber-400" />
                  Supabase: {SUPABASE_PROJECT_ID}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Sign up, log in, or download & upload your progress file
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-5 gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-3 shrink-0">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('profile');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`py-1.5 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === 'profile'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Profile</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('auth');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`py-1.5 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === 'auth'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{isGuest ? 'Log In/Up' : 'Accounts'}</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('password');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`py-1.5 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === 'password'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Password</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('backup');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`py-1.5 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === 'backup'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('restore');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`py-1.5 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
              activeTab === 'restore'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Load</span>
          </button>
        </div>

        {/* Feedback Notices */}
        {errorMessage && (
          <div className="mb-3 px-3 py-2 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-3 px-4 py-3 bg-emerald-900/80 border-2 border-emerald-400/80 rounded-xl text-emerald-100 text-sm font-semibold flex items-center gap-2.5 shadow-lg shadow-emerald-950/40">
            <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
            <span className="leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 1: PROFILE SUMMARY & ACTIVE STATE */}
        {/* ========================================== */}
        {activeTab === 'profile' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-lg">
                  <div className="w-full h-full rounded-2xl bg-slate-950 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-amber-300 uppercase">Level</span>
                    <span className="text-xl font-black font-game text-white">{player.level}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-black font-game text-white">{currentUsername}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isGuest ? 'bg-slate-800 text-slate-400' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {isGuest ? 'Guest' : 'Active Account'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    EXP: {player.exp} / {player.nextExp} · <img src={GOLD_IMAGE} alt="Gold" className="inline h-3.5 w-3.5 object-contain align-text-bottom" /> {player.gold.toLocaleString()}
                  </p>
                </div>
              </div>

              {!isGuest && (
                <button
                  onClick={handleLogOut}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-400" />
                  Log Out
                </button>
              )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <div className="flex items-center justify-center gap-1 text-slate-400 text-[10px] font-bold uppercase mb-1">
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  Starter Packs
                </div>
                <span className="text-xl font-black font-game text-amber-300">
                  {player.starterPacksCount} Available
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <div className="flex items-center justify-center gap-1 text-slate-400 text-[10px] font-bold uppercase mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Unlocked Starmons
                </div>
                <span className="text-xl font-black font-game text-cyan-300">
                  {unlockedCount} / {starmons.length}
                </span>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <div className="flex items-center justify-center gap-1 text-slate-400 text-[10px] font-bold uppercase mb-1">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  Total Cards
                </div>
                <span className="text-xl font-black font-game text-purple-300">
                  {totalCards}
                </span>
              </div>
            </div>

            {/* ALL SYNCHRONIZED ACCOUNTS CARD */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950/60 to-slate-950 border-2 border-indigo-500/50 flex flex-col gap-3 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black font-game text-white flex items-center gap-1.5">
                      <span>TẤT CẢ TÀI KHOẢN ĐỒNG BỘ</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-mono font-bold">
                        {syncedAccounts.length}
                      </span>
                    </h5>
                    <p className="text-[10px] text-slate-400">
                      Tài khoản hiện tại: <strong className="text-amber-300 font-mono">{player.username || player.name}</strong> ({player.googleId || 'Chưa gắn kết'})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Real-time Sync</span>
                </div>
              </div>

              {/* List of all synchronized accounts */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {syncedAccounts.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
                    Đang đồng bộ danh sách tài khoản từ máy chủ...
                  </div>
                ) : (
                  syncedAccounts.map((acc) => {
                    const isActive = Boolean(
                      (player.googleId && acc.googleId && acc.googleId.toLowerCase() === player.googleId.toLowerCase()) ||
                      (player.googleEmail && acc.email && acc.email.toLowerCase() === player.googleEmail.toLowerCase()) ||
                      (acc.username && acc.username.toLowerCase() === (player.username || player.name || '').toLowerCase())
                    );
                    const accLvl = acc.player?.level || 1;
                    const accGold = acc.player?.gold ?? 0;
                    const accStarmons = (acc.starmons || []).filter(s => s.unlocked).length;

                    return (
                      <React.Fragment key={acc.googleId || acc.email || acc.username}>
                      <div
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                          isActive
                            ? 'bg-indigo-950/80 border-amber-400 shadow-md ring-1 ring-amber-400/40'
                            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow shrink-0">
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"/>
                              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"/>
                              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                            </svg>
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <strong className="text-xs font-bold text-white truncate">
                                {acc.username}
                              </strong>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 font-mono font-bold">
                                Lv.{accLvl}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate font-mono">
                              {acc.email || acc.googleId} · {accGold}G · {accStarmons} Starmon
                            </p>
                          </div>
                        </div>

                        {isActive ? (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-[10px] font-game shrink-0 shadow-sm">
                            ✓ ĐANG DÙNG
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSwitchingAccountUsername(acc.username);
                              setSwitchPasswordInput('');
                              setSwitchAccountError('');
                            }}
                            className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-[10px] font-game rounded-lg transition-transform active:scale-95 cursor-pointer shrink-0"
                          >
                            CHUYỂN SANG
                          </button>
                        )}
                      </div>
                      {switchingAccountUsername === acc.username && !isActive && (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            setSwitchAccountError('');
                            const storedAccount = getAllAccounts()[acc.username.toLowerCase()] || acc;
                            if (!storedAccount.pin) {
                              setSwitchAccountError('Tài khoản này chưa cài mật khẩu. Hãy đăng nhập và đặt mật khẩu trước khi chuyển tài khoản.');
                              sound.playWrong();
                              return;
                            }
                            if (switchPasswordInput !== storedAccount.pin) {
                              setSwitchAccountError('Mật khẩu không chính xác.');
                              sound.playWrong();
                              return;
                            }

                            sound.playRewardFanfare();
                            setCurrentUsername(acc.username);
                            if (acc.googleId) {
                              try {
                                localStorage.setItem('starmon_pvp_uid', acc.googleId);
                                localStorage.setItem('starmon_google_id', acc.googleId);
                              } catch {}
                            }
                            setSuccessMessage(`Đã chuyển sang tài khoản: ${acc.username}!`);
                            setSwitchingAccountUsername('');
                            setSwitchPasswordInput('');
                            setTimeout(() => {
                              onRestoreSave(acc.player, acc.starmons || starmons, acc.username, acc.quests || quests);
                              setSuccessMessage('');
                            }, 600);
                          }}
                          className="mt-2 p-2.5 rounded-xl bg-slate-950/90 border border-slate-700 space-y-2"
                        >
                          <label className="block text-[10px] font-bold text-slate-300">Nhập mật khẩu để chuyển sang {acc.username}</label>
                          <div className="flex gap-2">
                            <input
                              type="password"
                              value={switchPasswordInput}
                              onChange={(event) => setSwitchPasswordInput(event.target.value)}
                              autoComplete="current-password"
                              placeholder="Mật khẩu tài khoản"
                              required
                              className="min-w-0 flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                            />
                            <button type="submit" className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black">XÁC NHẬN</button>
                            <button type="button" onClick={() => { setSwitchingAccountUsername(''); setSwitchPasswordInput(''); setSwitchAccountError(''); }} className="px-2 py-2 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold">HỦY</button>
                          </div>
                          {switchAccountError && <p role="alert" className="text-[10px] text-rose-300">{switchAccountError}</p>}
                        </form>
                      )}
                      </React.Fragment>
                    );
                  })
                )}
              </div>

              {/* Add / Sync another Google Account */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
                <span className="text-[10px] text-slate-400 font-bold block">
                  Đăng nhập / Đồng bộ tài khoản Google mới:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleGoogleSync('wingsofdeath1126@gmail.com', 'google_wingsofdeath1126')}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] text-cyan-300 font-bold rounded-lg border border-cyan-500/40 transition-colors cursor-pointer"
                  >
                    wingsofdeath1126@gmail.com
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGoogleSync('userA@gmail.com', 'google_acc_A')}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] text-amber-300 font-bold rounded-lg border border-amber-500/40 transition-colors cursor-pointer"
                  >
                    Google Acc A
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGoogleSync('userB@gmail.com', 'google_acc_B')}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-[10px] text-emerald-300 font-bold rounded-lg border border-emerald-500/40 transition-colors cursor-pointer"
                  >
                    Google Acc B
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    placeholder="Nhập email Google của bạn (VD: name@gmail.com)..."
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => handleGoogleSync()}
                    disabled={isProcessing}
                    className="px-4 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 text-white font-black text-xs rounded-xl shadow cursor-pointer active:scale-95 shrink-0"
                  >
                    Đồng Bộ
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Action Prompt */}
            <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
              <div>
                <h5 className="text-xs font-bold text-indigo-200">Safeguard Your Progress</h5>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Export a download file or create an account to switch devices seamlessly.
                </p>
              </div>
              <button
                onClick={handleDownloadSave}
                className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black font-game text-xs rounded-xl shadow transition-transform active:scale-95 flex items-center gap-1.5 shrink-0 ml-2"
              >
                <Download className="w-3.5 h-3.5 text-amber-950" />
                Save to File
              </button>
            </div>

            {/* RESET PROGRESS & RELOAD CARD */}
            <div className="p-3.5 rounded-2xl bg-rose-950/40 border-2 border-rose-900/60 flex flex-col gap-2 shadow-lg">
              <div>
                <h5 className="text-xs font-black text-rose-300 flex items-center gap-1.5 font-game uppercase tracking-wide">
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  <span>Xóa Tiến Trình & Bắt Đầu Lại Từ Đầu (Factory Reset)</span>
                </h5>
                <p className="text-[10px] text-slate-300 mt-1 leading-relaxed">
                  Xóa toàn bộ tiến trình và đưa tài khoản về khởi điểm ban đầu: <strong className="text-amber-300">Level 1, 0 Vàng, 0 Kim Cương, 2 Gói Khởi Đầu, 0 Starmon</strong> và tự động tải lại toàn bộ trang web (Reload page).
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm('⚠️ BẠN CÓ CHẮC CHẮN MUỐN RESET TOÀN BỘ TIẾN TRÌNH?\n\nHành động này sẽ xóa sạch dữ liệu game, đưa tài khoản về Level 1, 0 Vàng, 0 Kim Cương, 2 Gói Khởi Đầu, 0 Starmon và làm mới lại toàn bộ trang web để bắt đầu lại từ đầu.')) {
                    if (onResetProgress) {
                      onResetProgress();
                    } else {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }
                }}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-rose-950 via-rose-900 to-rose-950 hover:from-rose-900 hover:to-rose-800 border border-rose-500/60 text-rose-100 text-xs font-black rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 active:scale-98"
              >
                <RotateCcw className="w-4 h-4 text-rose-300" />
                <span>🔄 Reset Toàn Bộ Tiến Trình & Khởi Động Lại (Reload Page)</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: SIGN UP / LOG IN FORM */}
        {/* ========================================== */}
        {activeTab === 'auth' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* Toggle Login / Sign Up */}
            <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setAuthMode('signup');
                  setErrorMessage('');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  authMode === 'signup'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                Sign Up (Fresh Account)
              </button>
              <button
                type="button"
                onClick={() => {
                  sound.playClick();
                  setAuthMode('login');
                  setErrorMessage('');
                }}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  authMode === 'login'
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LogIn className="w-3.5 h-3.5 text-cyan-400" />
                Log In (Existing Account)
              </button>
            </div>

            <form onSubmit={authMode === 'signup' ? handleSignUp : handleLogIn} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Enter unique username..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  {authMode === 'signup' ? 'PIN / Passcode (Optional)' : 'PIN / Passcode (If configured)'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="e.g. 1234 or leave blank"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-colors"
                  />
                </div>
              </div>

              {authMode === 'signup' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/20 text-[11px] text-amber-200 leading-relaxed">
                  ✨ <strong>Starting Bonus:</strong> New accounts start strictly at Level 1, 0 Gold, with <strong>2 Starter Packs</strong> and <strong>0 Starmon</strong> in inventory!
                </div>
              )}

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black font-game text-sm rounded-xl shadow-lg shadow-amber-400/20 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                {authMode === 'signup' ? (
                  <>
                    <UserPlus className="w-4 h-4 text-slate-950" />
                    CREATE ACCOUNT & START
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 text-slate-950" />
                    LOG IN & LOAD PROGRESS
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB: CHANGE PASSWORD / PIN */}
        {/* ========================================== */}
        {activeTab === 'password' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs">
              <span className="text-slate-400">Account: </span>
              <strong className="text-white font-game">{currentUsername}</strong>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Update your account security passcode to protect your save file and Starmon roster.
              </span>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Current Password / PIN
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={oldPinInput}
                    onChange={(e) => setOldPinInput(e.target.value)}
                    placeholder="Enter current password/PIN (leave blank if none was set)"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  New Password / PIN
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                    placeholder="At least 3 characters..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Confirm New Password / PIN
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value)}
                    placeholder="Re-type new password/PIN..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black font-game text-sm rounded-xl shadow-lg shadow-amber-400/20 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-slate-950" />
                UPDATE PASSWORD / PIN
              </button>
            </form>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: DOWNLOAD SAVE FILE (.JSON) */}
        {/* ========================================== */}
        {activeTab === 'backup' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-center flex flex-col justify-center items-center py-2">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border-2 border-amber-400/40 flex items-center justify-center text-amber-300 mb-1">
              <Download className="w-8 h-8" />
            </div>

            <h4 className="text-base font-black font-game text-white">
              Download Save File (.json)
            </h4>
            <p className="text-xs text-slate-400 max-w-sm">
              Save all your current game progress, Starmons, individual upgrade cards, Gold, and unopened Starter Packs directly to your device.
            </p>

            {/* Save file preview details */}
            <div className="w-full max-w-md bg-slate-950 rounded-2xl p-3 border border-slate-800 text-left text-xs space-y-1.5">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Player Profile:</span>
                <span className="font-bold text-white">{currentUsername} (Lv. {player.level})</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Starter Packs:</span>
                <span className="font-bold text-amber-300">{player.starterPacksCount}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Unlocked Starmons:</span>
                <span className="font-bold text-cyan-300">{unlockedCount} / {starmons.length}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-500">Gold & Gems:</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-400"><img src={GOLD_IMAGE} alt="Gold" className="h-4 w-4 object-contain" />{player.gold}<span className="mx-1">·</span><img src={GEM_IMAGE} alt="Gems" className="h-4 w-4 object-contain" />{player.gems}</span>
              </div>
            </div>

            <button
              onClick={handleDownloadSave}
              disabled={isProcessing}
              className="w-full max-w-md py-3 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black font-game text-sm rounded-xl shadow-lg shadow-amber-400/20 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-amber-200"
            >
              <Download className="w-4 h-4 text-slate-950" />
              DOWNLOAD SAVE FILE NOW
            </button>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 4: UPLOAD / RESTORE PROGRESS FILE */}
        {/* ========================================== */}
        {activeTab === 'restore' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-center flex flex-col justify-center items-center py-2">
            <div className="w-16 h-16 rounded-3xl bg-cyan-500/20 border-2 border-cyan-400/40 flex items-center justify-center text-cyan-300 mb-1">
              <Upload className="w-8 h-8" />
            </div>

            <h4 className="text-base font-black font-game text-white">
              Upload Progress File (.json)
            </h4>
            <p className="text-xs text-slate-400 max-w-sm">
              Restore your game progress from a previously downloaded save file.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              accept=".json,.starmon"
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-md p-6 border-2 border-dashed border-cyan-400/40 hover:border-cyan-400 bg-slate-950/60 rounded-2xl cursor-pointer transition-colors group flex flex-col items-center justify-center gap-2"
            >
              <FileCheck className="w-8 h-8 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-slate-200">
                Click to browse or drop your .json save file here
              </span>
              <span className="text-[10px] text-slate-500">
                Accepts .json and .starmon files
              </span>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full max-w-md py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black font-game text-sm rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-white" />
              CHOOSE FILE TO LOAD
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs text-slate-400">
          <span>Starmon Secure Storage v2.0</span>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
