import React, { useState } from 'react';
import { PlayerProfile, Starmon } from '../types';
import { StarmonAsset } from './StarmonAsset';
import { PvpLobbyModal } from './PvpLobbyModal';
import { calculateCP } from '../data/starmonStats';
import { BlacksmithModal } from './BlacksmithModal';
import { ShroomLabModal } from './ShroomLabModal';
import { ElementType, CraftingJob, ResearchJob } from '../types';
import { ResearchNodeId } from '../data/techResearch';
import { sound } from '../services/sound';
import { Settings, Maximize2, Minimize2, Sparkles, User, Package, BookOpen, Hourglass, Lock, Plus } from 'lucide-react';
import mainHubBg from '../assets/images/mainhub_bg.png';
import starterPackImg from '../assets/images/starter_pack.png';
import hatcheryImg from '../assets/images/hatchery.png';
import blacksmithImg from '../assets/images/blacksmith.png';
import shroomlabImg from '../assets/images/shroomlab.png';
import { HATCHERY_IMAGE, BLACKSMITH_IMAGE, SHROOMLAB_IMAGE, getEnergyBarImage, GOLD_IMAGE, GEM_IMAGE } from '../data/itemsData';

// High-resolution custom icon assets
import questIconImg from '../assets/icons/quest_icon.png';
import inventoryIconImg from '../assets/icons/inventory_icon.png';
import mailIconImg from '../assets/icons/mail_icon.png';
import shopIconImg from '../assets/icons/shop_icon.png';
import starmonIconImg from '../assets/icons/starmon_icon.png';
import chatIconImg from '../assets/icons/chat_icon.png';
import battleIconImg from '../assets/icons/battle_icon.png';
import eventsIconImg from '../assets/images/rewards/events_icon.png';

interface Props {
  player: PlayerProfile;
  activeStarmon?: Starmon;
  playerStarmons?: Starmon[];
  allOwnedStarmons?: Starmon[];
  unlockedStarmonCount: number;
  isFullscreen: boolean;
  unclaimedQuestsCount?: number;
  unclaimedEventsCount?: number;
  unreadChatCount?: number;
  onToggleFullscreen: () => void;
  onOpenSettings: () => void;
  onOpenStarmonTeam: () => void;
  onOpenInventory: () => void;
  onOpenShop: () => void;
  onOpenMail: () => void;
  onOpenAuth: () => void;
  onOpenStarterPack: () => void;
  onOpenQuests: () => void;
  onOpenEvents: () => void;
  onOpenChat: () => void;
  onOpenTutorial?: () => void;
  onOpenEnergyBattery?: () => void;
  onStartBattle: (pvpRoomInfo?: {
    code: string;
    hostName: string;
    arena: string;
    opponentName?: string;
    opponentStarmons?: any[];
  }) => void;
  onUpdateGoogleAccount?: (googleId: string, googleEmail?: string) => void;
  onCraftItem: (slot: number, itemId: string) => void;
  onClaimCraftedItem: (slot: number) => void;
  onFastForwardCraft: (slot: number) => void;
  onUpgradeItem: (itemId: string, currentLevel: number) => void;
  onUpgradeEquippedItem: (starmonId: string, slotIndex: number, currentLevel: number) => void;
  onStartResearch: (element: ElementType, nodeId: ResearchNodeId) => void;
  onFastForwardResearch: (slot: number) => void;
  onCompleteResearch: (slot: number) => void;
}

export const MainHub: React.FC<Props> = ({
  player,
  activeStarmon,
  playerStarmons = [],
  allOwnedStarmons = playerStarmons,
  unlockedStarmonCount,
  isFullscreen,
  unclaimedQuestsCount = 0,
  unclaimedEventsCount = 0,
  unreadChatCount = 0,
  onToggleFullscreen,
  onOpenSettings,
  onOpenStarmonTeam,
  onOpenInventory,
  onOpenShop,
  onOpenMail,
  onOpenAuth,
  onOpenStarterPack,
  onOpenQuests,
  onOpenEvents,
  onOpenChat,
  onOpenTutorial,
  onOpenEnergyBattery,
  onStartBattle,
  onUpdateGoogleAccount,
  onCraftItem,
  onClaimCraftedItem,
  onFastForwardCraft,
  onUpgradeItem,
  onUpgradeEquippedItem,
  onStartResearch,
  onFastForwardResearch,
  onCompleteResearch,
}) => {
  const [showPvpLobby, setShowPvpLobby] = useState(false);
  const [showBlacksmith, setShowBlacksmith] = useState(false);
  const [showShroomLab, setShowShroomLab] = useState(false);
  const [battleBlockedNotice, setBattleBlockedNotice] = useState(false);
  const [lockedFeatureNotice, setLockedFeatureNotice] = useState<string | null>(null);

  const handleLockedFeatureClick = (name: string) => {
    sound.playWrong();
    if (name === 'Hatchery') {
      setLockedFeatureNotice('Hatchery (Breeding & Hatching): Sắp mở khóa! Yêu cầu tiêu hao Energy 🗲 để lai tạo và ấp trứng Starmon.');
    } else {
      setLockedFeatureNotice(`${name}: Đang khóa`);
    }
    setTimeout(() => setLockedFeatureNotice(null), 3500);
  };

  const hasAnyStarmon = unlockedStarmonCount > 0 && activeStarmon && activeStarmon.unlocked;
  const renderQueueBadge = (occupied: boolean, feature: string) => (
    <div
      role="status"
      aria-label={occupied ? `${feature} queue occupied` : `${feature} has an available queue`}
      title={occupied ? 'All available queue slots are occupied' : 'At least one queue slot is available'}
      className={`absolute -bottom-4 -right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white shadow-lg ${occupied ? 'bg-slate-950/95 text-amber-300' : 'animate-queue-bob bg-rose-600 text-white'}`}
    >
      {occupied ? <Hourglass className="h-4 w-4 animate-spin" /> : <span className="text-lg font-black leading-none">!</span>}
    </div>
  );
  const squadCP = playerStarmons.reduce(
    (total, mon) => total + (mon.cp || calculateCP(mon.maxHp, mon.baseAtk, mon.def)),
    0
  );

  const handleBattleClick = () => {
    sound.playClick();
    if (!hasAnyStarmon) {
      sound.playWrong();
      setBattleBlockedNotice(true);
      return;
    }
    setShowPvpLobby(true);
  };

  return (
    <div className="relative w-full h-screen max-h-screen overflow-hidden flex flex-col justify-between select-none">
      {/* ======================================================== */}
      {/* OFFICIAL 2D ANIME MAIN HUB BACKGROUND */}
      {/* ======================================================== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <img
          src={mainHubBg}
          alt="Main Hub Background"
          className="w-full h-full object-cover select-none pointer-events-none"
        />
        {/* Atmospheric vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/35 pointer-events-none" />

        {/* Magical Halo Circles behind Mascot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full border border-white/30 animate-rune-spin flex items-center justify-center pointer-events-none">
          <div className="w-[380px] h-[380px] rounded-full border border-dashed border-white/40" />
        </div>
      </div>

      {/* ======================================================== */}
      {/* TOP BAR: Level Star Crest, EXP, Account/Save, Gold, Gems, Settings */}
      {/* ======================================================== */}
      <header className="relative z-20 px-3 md:px-6 pt-3 pb-2 flex items-center justify-between">
        {/* Left: Star Badge + EXP Bar */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Blue Gem Star Crest */}
          <div className="relative flex items-center justify-center drop-shadow-lg">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-tr from-[#1e40af] via-[#3b82f6] to-[#60a5fa] border-2 border-white flex flex-col items-center justify-center text-white shadow-md">
              <span className="text-[10px] font-black tracking-tighter text-sky-200 uppercase leading-none">Lv.</span>
              <span className="text-xl md:text-2xl font-black font-game leading-tight">{player.level}</span>
            </div>
            <Sparkles className="w-4 h-4 text-white absolute -top-1 -right-1 fill-white" />
          </div>

          {/* Sleek EXP Progress Bar */}
          <div className="w-24 md:w-36 h-4 bg-slate-900/80 rounded-full border border-white/60 p-0.5 shadow-inner overflow-hidden flex items-center">
            <div
              className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(8, (player.exp / player.nextExp) * 100))}%` }}
            />
          </div>

          {/* Account / Save System Pill */}
          <button
            onClick={() => {
              sound.playClick();
              onOpenAuth();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-slate-900/90 via-indigo-950/80 to-slate-900/90 hover:from-indigo-900/90 hover:to-slate-800/90 border border-indigo-400/50 rounded-full shadow-md backdrop-blur-sm text-xs text-white transition-all cursor-pointer group"
            title="Account, Sign Up, Log In & Cloud Save"
          >
            <User className="w-4 h-4 text-indigo-300 group-hover:text-amber-300 transition-colors" />
            <span className="font-bold font-game max-w-[90px] md:max-w-[130px] truncate text-indigo-100 group-hover:text-white">
              {player.username || player.name || 'Account'}
            </span>
            <span className="text-[9px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded-full border border-amber-400/30">
              Save File
            </span>
          </button>
        </div>

        {/* Center/Right: Energy Bar + Resource Pills (Gold & Diamonds) */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Energy Bar Widget: Number n/100 above image, Plus button next to it */}
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/90 border border-amber-400/60 rounded-2xl shadow-lg backdrop-blur-sm">
            <div className="flex flex-col items-center">
              <span className="text-[10px] sm:text-[11px] font-black font-game text-amber-300 tracking-wider leading-none mb-0.5">
                {player.energy}/100 🗲
              </span>
              <div className="h-4 sm:h-5 w-24 sm:w-28 flex items-center justify-center">
                <img
                  src={getEnergyBarImage(player.energy)}
                  alt="Energy Bar"
                  className="max-h-full max-w-full object-contain drop-shadow"
                />
              </div>
            </div>

            {/* Plus Button to open Energy Battery Vault */}
            <button
              onClick={() => {
                sound.playClick();
                onOpenEnergyBattery?.();
              }}
              className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-200 text-slate-950 flex items-center justify-center shadow-md border border-white/70 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              title="Nạp Năng Lượng (Sử dụng Energy Battery)"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          </div>

          {/* Gold Coin Pill */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/85 border border-slate-700/80 rounded-full shadow-md backdrop-blur-sm">
            <img src={GOLD_IMAGE} alt="Gold" className="h-6 w-6 object-contain drop-shadow" />
            <span className="font-bold text-white font-game text-xs md:text-sm font-mono tracking-wide">
              {player.gold.toLocaleString()}
            </span>
          </div>

          {/* Diamond Gems Pill */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/85 border border-slate-700/80 rounded-full shadow-md backdrop-blur-sm">
            <img src={GEM_IMAGE} alt="Gems" className="h-6 w-6 scale-[1.575] object-contain drop-shadow" />
            <span className="font-bold text-white font-game text-xs md:text-sm font-mono tracking-wide">
              {player.gems.toLocaleString()}
            </span>
          </div>

          {/* Fullscreen Button */}
          <button
            id="hub-fullscreen-btn"
            onClick={() => {
              sound.playClick();
              onToggleFullscreen();
            }}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-white shadow-md transition-transform hover:scale-105 cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-cyan-300" /> : <Maximize2 className="w-4 h-4 text-slate-200" />}
          </button>

          {/* Tutorial Button */}
          {onOpenTutorial && (
            <button
              id="hub-tutorial-btn"
              onClick={() => {
                sound.playClick();
                onOpenTutorial();
              }}
              className="flex flex-col items-center p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-indigo-500/50 text-indigo-300 hover:text-white shadow-md transition-transform hover:scale-105 group cursor-pointer"
              title="Combat Academy - Tutorial"
            >
              <BookOpen className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-bold text-indigo-200 mt-0.5">Tutorial</span>
            </button>
          )}

          {/* Settings Button */}
          <button
            onClick={() => {
              sound.playClick();
              onOpenSettings();
            }}
            className="flex flex-col items-center p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-white shadow-md transition-transform hover:scale-105 group cursor-pointer"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-slate-200 group-hover:rotate-45 transition-transform duration-300" />
            <span className="text-[9px] font-bold text-slate-300 mt-0.5">Settings</span>
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* RIGHT SIDEBAR: Quests & Chat (Shrunk by 50%) */}
      {/* ======================================================== */}
      <div className="absolute top-16 md:top-20 right-2 md:right-4 z-30 flex flex-col items-center gap-2 pointer-events-auto">
        {/* Events Button */}
        <button
          onClick={() => {
            sound.playClick();
            onOpenEvents();
          }}
          className="group relative flex flex-col items-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
          title="Ongoing Events, Upcoming Events & Daily Rewards"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-b from-sky-300 via-cyan-500 to-blue-600 p-0.5 border border-white shadow-lg shadow-cyan-500/30 flex items-center justify-center backdrop-blur-sm group-hover:-rotate-3 transition-transform">
            <img src={eventsIconImg} alt="Events" className="h-full w-full rounded-[10px] object-contain drop-shadow" />
          </div>
          <span className="text-[9px] md:text-[10px] font-black font-game text-cyan-100 mt-0.5 drop-shadow bg-slate-950/85 px-1.5 py-0.2 rounded-full border border-cyan-300/30">Events</span>
          {unclaimedEventsCount > 0 && <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-black text-[9px] font-mono border border-white animate-bounce shadow-md">{unclaimedEventsCount}</span>}
        </button>

        {/* 1. Quest System Button (50% smaller) */}
        <button
          onClick={() => {
            sound.playClick();
            onOpenQuests();
          }}
          className="group relative flex flex-col items-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
          title="Quests & Missions (Daily, Weekly, Monthly, Legend)"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 p-1 border border-white shadow-lg shadow-amber-500/30 flex items-center justify-center backdrop-blur-sm group-hover:rotate-3 transition-transform">
            <img
              src={questIconImg}
              alt="Quests"
              className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://www.dropbox.com/scl/fi/4i0fsryrmfgftnavhdmmq/Quest-Icon.png?rlkey=le5y1mtg979aiyotch95w33ln&st=xhi47owr&raw=1';
              }}
            />
          </div>
          <span className="text-[9px] md:text-[10px] font-black font-game text-amber-200 mt-0.5 drop-shadow bg-slate-950/85 px-1.5 py-0.2 rounded-full border border-amber-400/30">
            Quests
          </span>
          {unclaimedQuestsCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-black text-[9px] font-mono border border-white animate-bounce shadow-md">
              {unclaimedQuestsCount}
            </span>
          )}
        </button>

        {/* 2. Chat Button (50% smaller) */}
        <button
          onClick={() => {
            sound.playClick();
            onOpenChat();
          }}
          className="group relative flex flex-col items-center cursor-pointer transition-transform hover:scale-105 active:scale-95"
          title="World, Clan & Private Chat"
        >
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gradient-to-b from-emerald-500 via-teal-600 to-emerald-700 p-1 border border-white shadow-lg shadow-emerald-500/30 flex items-center justify-center backdrop-blur-sm group-hover:rotate-3 transition-transform">
            <img
              src={chatIconImg}
              alt="Chat"
              className="w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://www.dropbox.com/scl/fi/g27x2gjn3xeqpgd3lrztd/Chat_Icon.png?rlkey=ydpfymaadmozv17ht2vn3qlut&st=67ixilf1&raw=1';
              }}
            />
          </div>
          <span className="text-[9px] md:text-[10px] font-black font-game text-emerald-200 mt-0.5 drop-shadow bg-slate-950/85 px-1.5 py-0.2 rounded-full border border-emerald-400/30">
            Chat
          </span>
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] font-mono border border-white animate-pulse shadow-md">
              {unreadChatCount}
            </span>
          )}
        </button>
      </div>

      {/* ======================================================== */}
      {/* 5-PART HORIZONTAL SCREEN DIVISION:                       */}
      {/* Part 1 (far left): Empty space                           */}
      {/* Part 2: Hatchery (slightly higher)                       */}
      {/* Part 3 (center): Podium (Mascot / Starter Pack)          */}
      {/* Part 4: ShroomLab (right of Podium, slightly lower)      */}
      {/* Part 5 (far right): Blacksmith (slightly higher than ShroomLab) */}
      {/* ======================================================== */}
      <main className="relative z-10 flex-1 w-full max-w-full flex items-center justify-center px-1 sm:px-2 md:px-4">
        {/* Locked Feature Toast Notice */}
        {lockedFeatureNotice && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border-2 border-amber-400 text-amber-300 px-6 py-2.5 rounded-2xl shadow-2xl text-sm font-black flex items-center gap-2.5 animate-bounce">
            <Lock className="w-5 h-5 text-amber-400" />
            <span className="font-game text-base text-amber-300">{lockedFeatureNotice}</span>
          </div>
        )}

        <div className="w-full h-full grid grid-cols-5 items-center justify-items-center relative pointer-events-none">
          {/* PART 1: Empty space on far left */}
          <div className="w-full h-full flex items-center justify-center pointer-events-none">
            {/* Slot 1: Reserved empty space */}
          </div>

          {/* PART 2: Hatchery (slightly higher than Podium, clouds removed, -20% size) */}
          <div className="w-full flex flex-col items-center justify-center pointer-events-auto -translate-y-4 sm:-translate-y-6 md:-translate-y-8">
            <div
              onClick={() => handleLockedFeatureClick('Hatchery')}
              className="group relative flex flex-col items-center cursor-pointer transition-transform duration-300 hover:scale-105 active:scale-95 select-none animate-float-pedestal"
              title="Hatchery - Locked"
            >
              {/* Graphic (scaled down 20%) */}
              <div className="relative w-[120px] h-[156px] sm:w-[168px] sm:h-[220px] md:w-[216px] md:h-[284px] lg:w-[260px] lg:h-[340px] flex items-center justify-center">
                <img
                  src={hatcheryImg}
                  alt="Hatchery"
                  className="w-full h-full object-contain filter drop-shadow-[0_20px_38px_rgba(0,0,0,0.8)] group-hover:drop-shadow-[0_26px_46px_rgba(251,191,36,0.6)] transition-all duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = HATCHERY_IMAGE;
                  }}
                />
                <div className="absolute left-2 top-2 p-1.5 rounded-full bg-amber-500/30 border border-amber-400 text-amber-300 drop-shadow shadow-amber-500/50 animate-pulse">
                  <Lock className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-300" />
                </div>
              </div>

              {/* Big White Plaque with Golden Border & Bold Black English Text overlapping bottom */}
              <div className="-mt-5 sm:-mt-7 md:-mt-8 lg:-mt-10 relative z-30 pointer-events-none">
                <div className="relative bg-white border-2 sm:border-[3px] md:border-4 border-amber-400 rounded-xl sm:rounded-2xl px-3 py-1 sm:px-5 sm:py-1.5 md:px-6 md:py-2 shadow-[0_8px_20px_rgba(0,0,0,0.5),0_0_12px_rgba(251,191,36,0.5)] flex items-center justify-center">
                  <span className="text-[11px] sm:text-xs md:text-sm lg:text-base font-black font-game text-slate-950 uppercase tracking-widest drop-shadow-sm select-none">
                    HATCHERY
                  </span>
                  {renderQueueBadge(false, 'Hatchery')}
                </div>
              </div>
            </div>
          </div>

          {/* PART 3: Center Podium (Mascot or Starter Pack) */}
          <div className="w-full flex flex-col items-center justify-center pointer-events-auto z-10">
            {!hasAnyStarmon ? (
              /* ZERO STARMON IN INVENTORY STATE */
              <div className="relative flex flex-col items-center animate-float-pedestal text-center max-w-xs px-2">
                <div
                  onClick={() => {
                    sound.playClick();
                    onOpenStarterPack();
                  }}
                  className="relative cursor-pointer group my-1 transition-transform hover:scale-105 active:scale-95"
                  title="Click to open Starter Pack!"
                >
                  <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/40 via-purple-500/40 to-pink-500/40 rounded-full blur-2xl animate-pulse" />
                  <div className="relative w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-3xl bg-slate-950/80 border-2 border-amber-400/80 p-3 shadow-2xl flex flex-col items-center justify-center backdrop-blur-sm">
                    <img
                      src={starterPackImg}
                      alt="Starter Pack"
                      className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] animate-bounce-slow"
                    />
                    <span className="text-[10px] sm:text-xs font-black font-game text-amber-300 mt-1 uppercase tracking-wider bg-amber-500/25 px-3 py-0.5 rounded-full border border-amber-400/50 shadow-md">
                      {player.starterPacksCount} Packs Waiting
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex flex-col items-center">
                  <h3 className="text-sm sm:text-base md:text-lg font-black font-game text-amber-300 drop-shadow-md">
                    0 Starmon in Inventory
                  </h3>
                  <button
                    onClick={() => {
                      sound.playClick();
                      onOpenStarterPack();
                    }}
                    className="mt-2 px-4 py-2 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black font-game text-[11px] sm:text-xs rounded-xl shadow-xl shadow-amber-500/40 border-2 border-amber-200 cursor-pointer transform hover:scale-105 active:scale-95 animate-pulse"
                  >
                    🎁 OPEN STARTER PACK ({player.starterPacksCount})
                  </button>
                </div>
              </div>
            ) : (
              /* OBTAINED COMPANION ACTIVE MASCOT STATE */
              <div className="relative flex flex-col items-center animate-float-pedestal">
                <div
                  onClick={() => {
                    sound.playClick();
                    onOpenInventory();
                  }}
                  className="relative cursor-pointer transition-transform hover:scale-105 group z-10 flex flex-col items-center"
                  title="Click to view Starmon details"
                >
                  <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-72 md:h-72 flex items-center justify-center relative">
                    <StarmonAsset
                      id={activeStarmon?.avatarSeed || 'pyrokit'}
                      isDaPhucVersion={activeStarmon?.isDaPhucVersion || activeStarmon?.equippedItems?.includes('da_phuc_uniform')}
                      size="xl"
                      animated
                      className="w-full h-full object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.8)] scale-125 sm:scale-150 md:scale-[1.7]"
                    />
                  </div>
                  <Sparkles className="w-5 h-5 text-amber-300 absolute -top-2 right-2 animate-bounce" />
                  <Sparkles className="w-4 h-4 text-sky-200 absolute bottom-4 -left-2 animate-pulse" />
                </div>

                <div className="mt-1 px-3 py-1 rounded-full bg-slate-950/80 border border-amber-400/50 backdrop-blur-md flex items-center gap-2 shadow-xl">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] sm:text-xs md:text-sm font-bold text-white font-game">
                    {activeStarmon?.name || 'Starmon'} (Lv. {activeStarmon?.level || 1})
                  </span>
                </div>
                <div className="mt-1 px-3 py-1 rounded-full bg-slate-950/80 border border-amber-400/40 text-[10px] font-bold font-mono text-amber-200 shadow-lg">
                  Squad CP: {squadCP.toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {/* PART 4: ShroomLab (Right of Podium, slightly lower, clouds removed, -20% size) */}
          <div className="w-full flex flex-col items-center justify-center pointer-events-auto translate-y-2 sm:translate-y-4 md:translate-y-5">
            <div
              onClick={() => { sound.playClick(); setShowShroomLab(true); }}
              className="group relative flex flex-col items-center cursor-pointer transition-transform duration-300 hover:scale-105 active:scale-95 select-none animate-float-pedestal [animation-delay:0.8s]"
              title="ShroomLab"
            >
              {/* Graphic (scaled down 20%) */}
              <div className="relative w-[128px] h-[93px] sm:w-[176px] sm:h-[128px] md:w-[224px] md:h-[163px] lg:w-[272px] lg:h-[198px] flex items-center justify-center">
                <img
                  src={shroomlabImg}
                  alt="ShroomLab"
                  className="w-full h-full object-contain filter drop-shadow-[0_20px_38px_rgba(0,0,0,0.8)] group-hover:drop-shadow-[0_26px_46px_rgba(251,191,36,0.6)] transition-all duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = SHROOMLAB_IMAGE;
                  }}
                />
              </div>

              {/* Big White Plaque with Golden Border & Bold Black English Text overlapping bottom */}
              <div className="-mt-5 sm:-mt-6 md:-mt-8 lg:-mt-9 relative z-30 pointer-events-none">
                <div className="relative bg-white border-2 sm:border-[3px] md:border-4 border-amber-400 rounded-xl sm:rounded-2xl px-3 py-1 sm:px-5 sm:py-1.5 md:px-6 md:py-2 shadow-[0_8px_20px_rgba(0,0,0,0.5),0_0_12px_rgba(251,191,36,0.5)] flex items-center justify-center">
                  <span className="text-[11px] sm:text-xs md:text-sm lg:text-base font-black font-game text-slate-950 uppercase tracking-widest drop-shadow-sm select-none">
                    SHROOMLAB
                  </span>
                  {renderQueueBadge((player.researchJobs || []).some(job => job.slot === 0), 'ShroomLab')}
                </div>
              </div>
            </div>
          </div>

          {/* PART 5: Blacksmith (Right of ShroomLab, on the far right, slightly higher than ShroomLab, clouds removed, -20% size) */}
          <div className="w-full flex flex-col items-center justify-center pointer-events-auto -translate-y-4 sm:-translate-y-6 md:-translate-y-8">
            <div
              onClick={() => setShowBlacksmith(true)}
              className="group relative flex flex-col items-center cursor-pointer transition-transform duration-300 hover:scale-105 active:scale-95 select-none animate-float-pedestal [animation-delay:1.5s]"
              title="Blacksmith"
            >
              {/* Graphic (scaled down 20%) */}
              <div className="relative w-[128px] h-[93px] sm:w-[176px] sm:h-[128px] md:w-[224px] md:h-[163px] lg:w-[272px] lg:h-[198px] flex items-center justify-center">
                <img
                  src={blacksmithImg}
                  alt="Blacksmith"
                  className="w-full h-full object-contain filter drop-shadow-[0_20px_38px_rgba(0,0,0,0.8)] group-hover:drop-shadow-[0_26px_46px_rgba(251,191,36,0.6)] transition-all duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = BLACKSMITH_IMAGE;
                  }}
                />
              </div>

              {/* Big White Plaque with Golden Border & Bold Black English Text overlapping bottom */}
              <div className="-mt-5 sm:-mt-6 md:-mt-8 lg:-mt-9 relative z-30 pointer-events-none">
                <div className="relative bg-white border-2 sm:border-[3px] md:border-4 border-amber-400 rounded-xl sm:rounded-2xl px-3 py-1 sm:px-5 sm:py-1.5 md:px-6 md:py-2 shadow-[0_8px_20px_rgba(0,0,0,0.5),0_0_12px_rgba(251,191,36,0.5)] flex items-center justify-center">
                  <span className="text-[11px] sm:text-xs md:text-sm lg:text-base font-black font-game text-slate-950 uppercase tracking-widest drop-shadow-sm select-none">
                    BLACKSMITH
                  </span>
                  {renderQueueBadge((player.craftingJobs || []).some(job => job.slot === 0), 'Blacksmith')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ======================================================== */}
      {/* BOTTOM NAV DOCK: UNIFORM LARGE ICONS, BATTLE 3X LARGER */}
      {/* Order strictly: Starmon -> Inventory -> Battle -> Shop -> Mail */}
      {/* ======================================================== */}
      <footer className="relative z-20 w-full px-2 md:px-8 pb-3 pt-1">
        <div className="relative max-w-5xl mx-auto h-28 md:h-32 bg-gradient-to-r from-[#06b6d4] via-[#3b82f6] to-[#06b6d4] border-t-2 border-white/70 rounded-3xl md:rounded-[40px] px-3 md:px-8 shadow-2xl flex items-center justify-between">
          
          {/* TAB 1: Starmon Team */}
          <button
            onClick={() => {
              sound.playClick();
              onOpenStarmonTeam();
            }}
            className="flex flex-col items-center group transition-transform hover:scale-105 active:scale-95 cursor-pointer flex-1 max-w-[105px] md:max-w-[130px]"
            title="Starmon Team & Codex"
          >
            {/* Equal sized icon */}
            <div className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center mb-0.5 group-hover:-translate-y-1 transition-transform">
              <img
                src={starmonIconImg}
                alt="Starmon Team"
                className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://www.dropbox.com/scl/fi/khuahz1wf0a4tt4jbdiqo/Starmon-icon.png?rlkey=41ck99nzwa4gagz3v8mufn0y8&st=p53w8f3w&raw=1';
                }}
              />
            </div>
            <span className="text-xs md:text-sm font-black font-game text-white tracking-wide drop-shadow-md">
              Starmon
            </span>
          </button>

          {/* TAB 2: Inventory */}
          <button
            onClick={() => {
              sound.playClick();
              onOpenInventory();
            }}
            className="flex flex-col items-center group transition-transform hover:scale-105 active:scale-95 cursor-pointer flex-1 max-w-[105px] md:max-w-[130px]"
            title="Trainer Inventory & Vault"
          >
            {/* Equal sized icon */}
            <div className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center mb-0.5 group-hover:-translate-y-1 transition-transform">
              <img
                src={inventoryIconImg}
                alt="Inventory"
                className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://www.dropbox.com/scl/fi/pyvtkn67cuk639a97ctay/Inventory-Icon-2.png?rlkey=fkjpjyjbijbc997omjxj04xk8&st=vlju0ndn&raw=1';
                }}
              />
            </div>
            <span className="text-xs md:text-sm font-black font-game text-white tracking-wide drop-shadow-md">
              Inventory
            </span>
          </button>

          {/* TAB 3: BATTLE (Prominent Center Button - ~50% larger than other icons) */}
          <div className="relative -top-6 md:-top-8 z-30 shrink-0">
            <button
              onClick={handleBattleClick}
              className="relative w-30 h-30 md:w-36 md:h-36 rounded-3xl bg-gradient-to-b from-[#fef08a] via-[#f59e0b] to-[#d97706] border-4 border-white shadow-[0_12px_28px_rgba(245,158,11,0.6)] flex flex-col items-center justify-center transform hover:scale-105 active:scale-95 transition-all cursor-pointer group"
              title="Enter Combat Arena (~50% larger)"
            >
              <div className="absolute -top-2 text-white">
                <Sparkles className="w-5 h-5 fill-white animate-spin" />
              </div>
              {/* Battle image ~50% larger than other icon images */}
              <div className="w-24 h-24 md:w-28 md:h-28 flex items-center justify-center group-hover:rotate-6 transition-transform">
                <img
                  src={battleIconImg}
                  alt="Battle"
                  className="w-full h-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://www.dropbox.com/scl/fi/yh5hf7q0g0v5tb87f16cs/Battle_Icon.png?rlkey=e22ejmbu3wfp79ywx6lgxuun6&st=6fhgd14i&raw=1';
                  }}
                />
              </div>
              <span className="text-sm md:text-base font-black font-game text-slate-950 tracking-wider leading-none mt-0.5 drop-shadow">
                BATTLE
              </span>
            </button>
          </div>

          {/* TAB 4: Shop */}
          <button
            onClick={() => {
              sound.playClick();
              onOpenShop();
            }}
            className="flex flex-col items-center group transition-transform hover:scale-105 active:scale-95 cursor-pointer flex-1 max-w-[105px] md:max-w-[130px]"
            title="Trainer Shop"
          >
            {/* Equal sized icon */}
            <div className="relative mb-0.5 w-20 h-20 md:w-24 md:h-24 flex items-center justify-center group-hover:-translate-y-1 transition-transform">
              <img
                src={shopIconImg}
                alt="Shop"
                className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-md"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://www.dropbox.com/scl/fi/kn9y482nw80l32gsg0c14/shop-icon.png?rlkey=tmv079ab1uedv45u1eylzqlfq&st=i9trkfn9&raw=1';
                }}
              />
              <div className="absolute -bottom-1 -left-1 px-1.5 py-0.2 rounded bg-rose-600 border border-amber-300 text-[8px] font-black text-amber-200 font-mono tracking-tighter animate-pulse shadow">
                SALE
              </div>
            </div>
            <span className="text-xs md:text-sm font-black font-game text-white tracking-wide drop-shadow-md">
              Shop
            </span>
          </button>

          {/* TAB 5: Mail Box */}
          <div className="relative flex-1 max-w-[105px] md:max-w-[130px] flex justify-center">
            <button
              onClick={() => {
                sound.playClick();
                onOpenMail();
              }}
              className="flex flex-col items-center group transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              title="Mailbox"
            >
              {/* Equal sized icon */}
              <div className="relative mb-0.5 w-20 h-20 md:w-24 md:h-24 flex items-center justify-center group-hover:-translate-y-1 transition-transform">
                <img
                  src={mailIconImg}
                  alt="Mail Box"
                  className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-md"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://www.dropbox.com/scl/fi/v76b2ure79zxsczyfp7ag/Mail-icon.png?rlkey=yec0nzziuzh9x0pl1lt1sppad&st=zqjky0n5&raw=1';
                  }}
                />
                {/* Red notice ONLY shows if there is actual mail in mailbox (player.mailUnreadCount > 0) */}
                {player.mailUnreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-600 border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-lg animate-bounce">
                    {player.mailUnreadCount}
                  </div>
                )}
              </div>
              <span className="text-xs md:text-sm font-black font-game text-white tracking-wide drop-shadow-md">
                Mail
              </span>
            </button>
          </div>
        </div>
      </footer>

      {/* BLOCK BATTLE ALERT MODAL IF 0 STARMON */}
      {battleBlockedNotice && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-200">
            <Package className="w-12 h-12 text-amber-400 mb-2 animate-bounce" />
            <h3 className="text-lg font-black font-game text-white">
              No Starmon in Team!
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              You currently have 0 Starmons in your inventory. Open your Starter Pack to summon your companion before entering battle!
            </p>
            <div className="mt-4 flex flex-col gap-2 w-full">
              <button
                onClick={() => {
                  sound.playClick();
                  setBattleBlockedNotice(false);
                  onOpenStarterPack();
                }}
                className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black font-game text-xs md:text-sm rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                🎁 OPEN STARTER PACK NOW ({player.starterPacksCount} AVAILABLE)
              </button>
              <button
                onClick={() => setBattleBlockedNotice(false)}
                className="w-full py-2 bg-slate-800 text-slate-400 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PvP MULTIPLAYER ROOM LOBBY */}
      {showPvpLobby && (
        <PvpLobbyModal
          playerName={player.name}
          playerLevel={player.level}
          playerId={player.googleId || player.username || undefined}
          googleEmail={player.googleEmail}
          playerStarmons={playerStarmons}
          onClose={() => setShowPvpLobby(false)}
          onStartPvPBattle={(roomInfo) => {
            setShowPvpLobby(false);
            onStartBattle(roomInfo);
          }}
          onStartPveBattle={() => {
            setShowPvpLobby(false);
            onStartBattle();
          }}
          onOpenTutorial={() => {
            setShowPvpLobby(false);
            onOpenTutorial?.();
          }}
          onUpdateGoogleAccount={onUpdateGoogleAccount}
        />
      )}
      {showBlacksmith && (
        <BlacksmithModal
          gold={player.gold}
          gems={player.gems}
          energy={player.energy}
          starShards={player.specialItems?.starShard || 0}
          equipmentInventory={player.equipmentInventory || []}
          starmons={allOwnedStarmons}
          craftingJobs={player.craftingJobs || []}
          onClose={() => setShowBlacksmith(false)}
          onCraft={onCraftItem}
          onClaimCraft={onClaimCraftedItem}
          onFastForward={onFastForwardCraft}
          onUpgrade={onUpgradeItem}
          onUpgradeEquipped={onUpgradeEquippedItem}
        />
      )}
      {showShroomLab && (
        <ShroomLabModal
          player={player}
          onClose={() => setShowShroomLab(false)}
          onStartResearch={onStartResearch}
          onFastForwardResearch={onFastForwardResearch}
          onCompleteResearch={onCompleteResearch}
        />
      )}
    </div>
  );
};
