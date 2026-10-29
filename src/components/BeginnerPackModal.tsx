import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Starmon } from '../types';
import { STARMON_ROSTER, getElementDisplayName } from '../data/starmons';
import { StarmonAsset } from './StarmonAsset';
import { sound } from '../services/sound';
import { Coins, Sparkles, X, ChevronRight, Layers, Eye, Clock } from 'lucide-react';
import starterPackImg from '../assets/images/starter_pack.png';
import { GOLD_IMAGE } from '../data/itemsData';

interface Props {
  starterPacksAvailable: number;
  unlockedStarmonIds?: string[];
  onClose: () => void;
  onClaim: (starterStarmon: Starmon, goldAmount: number, cardsAmount: number, openNext?: boolean) => void;
}

export const BeginnerPackModal: React.FC<Props> = ({
  starterPacksAvailable = 1,
  unlockedStarmonIds = [],
  onClose,
  onClaim,
}) => {
  const [packState, setPackState] = useState<'unopened' | 'tearing' | 'opened'>('unopened');
  const [rewardStarmon, setRewardStarmon] = useState<Starmon | null>(null);
  const [showDetailCard, setShowDetailCard] = useState(false);

  // Pool of starter Starmons
  const starterPoolIds = ['pyrokit', 'ignisaur', 'tidecrush', 'glidron', 'voltlynx', 'obsidus', 'coralus', 'stone_golem', 'zapwing', 'vinedra', 'bubbleboon', 'trojan_flare', 'cottontail', 'dreadhorn', 'bambloom'];

  const triggerOpen = () => {
    if (packState !== 'unopened') return;
    setPackState('tearing');
    sound.playPackTear();

    // Prioritize unobtained starters so 2 starter packs grant 2 distinct Starmons!
    const unobtainedPool = starterPoolIds.filter(id => !unlockedStarmonIds.includes(id));
    const candidateIds = unobtainedPool.length > 0 ? unobtainedPool : starterPoolIds;
    const randomId = candidateIds[Math.floor(Math.random() * candidateIds.length)];
    const chosen = STARMON_ROSTER.find(s => s.id === randomId) || STARMON_ROSTER[1];
    setRewardStarmon(chosen);

    setTimeout(() => {
      setPackState('opened');
      sound.playRewardFanfare();

      try {
        confetti({
          particleCount: 130,
          spread: 85,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#fbbf24'],
        });
      } catch {}
    }, 500);
  };

  const handleClaim = (openNext: boolean = false) => {
    sound.playClick();
    if (rewardStarmon) {
      onClaim(rewardStarmon, 500, 25, openNext);
      if (openNext) {
        setPackState('unopened');
        setRewardStarmon(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 md:p-4">
      {/* Background Arcane Ring */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
        <div className="w-[500px] h-[500px] rounded-full border border-purple-500/25 animate-rune-spin flex items-center justify-center">
          <div className="w-[360px] h-[360px] rounded-full border border-dashed border-indigo-400/30" />
        </div>
      </div>

      <div className="relative w-full max-w-3xl min-h-[500px] max-h-[92vh] flex flex-col items-center justify-between text-white z-10 overflow-hidden">
        {/* Top Header matching pack unopened.png */}
        <div className="w-full flex items-center justify-between px-4 py-1.5 shrink-0">
          {packState === 'unopened' ? (
            <>
              <div className="w-16" />
              {/* Ornate Gold Banner */}
              <div className="px-5 py-1 bg-gradient-to-r from-amber-600/40 via-amber-500/60 to-amber-600/40 border border-amber-300/60 rounded-lg shadow-md text-center">
                <span className="text-base md:text-lg font-black font-game tracking-widest text-amber-200">
                  STARTER PACK ({starterPacksAvailable} AVAILABLE)
                </span>
              </div>
              <button
                onClick={triggerOpen}
                className="px-3 py-1 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold rounded text-slate-300 transition-colors"
              >
                SKIP
              </button>
            </>
          ) : (
            <div className="w-full text-center">
              <h2 className="text-2xl md:text-3xl font-black font-game tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-100 drop-shadow">
                REWARDS
              </h2>
            </div>
          )}
        </div>

        {/* UNOPENED PACK STATE (Exact match to pack unopened.png) */}
        {packState === 'unopened' && (
          <div className="flex flex-col items-center justify-center my-auto w-full relative">
            <p className="text-sm md:text-base font-bold text-purple-200 mb-4 drop-shadow animate-pulse">
              Click & swipe to open the pack!
            </p>

            <div className="relative flex items-center justify-center gap-6 md:gap-12">
              {/* Left Side Icons: Coins & Timer */}
              <div className="hidden sm:flex flex-col gap-3 text-slate-400 items-center">
                <div className="p-2.5 bg-slate-900/80 border border-purple-500/30 rounded-2xl flex flex-col items-center">
                  <Coins className="w-5 h-5 text-amber-400 mb-0.5" />
                  <span className="text-[10px] font-mono">1</span>
                </div>
                <div className="p-2.5 bg-slate-900/80 border border-purple-500/30 rounded-2xl flex flex-col items-center">
                  <Clock className="w-5 h-5 text-sky-400" />
                </div>
              </div>

              {/* The Booster Pack Image from user */}
              <div
                onClick={triggerOpen}
                className="relative cursor-pointer group transition-transform hover:scale-105 active:scale-95 touch-none"
              >
                {/* Glow ring */}
                <div className="absolute -inset-3 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-400 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 animate-pulse-glow" />

                {/* Foil Pack Image */}
                <div className="relative w-56 md:w-64 flex items-center justify-center p-1">
                  <img
                    src={starterPackImg}
                    alt="Starter Pack"
                    className="w-full h-auto max-h-[380px] md:max-h-[420px] object-contain drop-shadow-2xl select-none"
                  />
                </div>

                {/* Animated Hand Indicator with Curved Arrow */}
                <div className="absolute -left-12 bottom-10 pointer-events-none flex flex-col items-center animate-bounce">
                  <div className="text-3xl">👆</div>
                  <span className="text-[10px] font-extrabold text-amber-300 mt-0.5 whitespace-nowrap bg-black/70 px-2 py-0.5 rounded-full border border-amber-300/40">
                    Tap to Open!
                  </span>
                </div>
              </div>

              {/* Right Side Buttons: OPEN 5 / 10 / 20 */}
              <div className="hidden sm:flex flex-col gap-2.5">
                <button
                  onClick={triggerOpen}
                  className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-purple-500/40 rounded-xl text-[11px] font-bold text-purple-200 transition-colors flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  OPEN 5
                </button>
                <button
                  onClick={triggerOpen}
                  className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-purple-500/40 rounded-xl text-[11px] font-bold text-purple-200 transition-colors flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  OPEN 10
                </button>
                <button
                  onClick={triggerOpen}
                  className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-purple-500/40 rounded-xl text-[11px] font-bold text-purple-200 transition-colors flex items-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  OPEN 20
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TEARING STATE */}
        {packState === 'tearing' && (
          <div className="my-auto flex flex-col items-center justify-center animate-pulse">
            <div className="w-48 h-64 rounded-2xl bg-gradient-to-r from-amber-300 via-pink-500 to-purple-600 blur-xl animate-spin" />
            <span className="text-xl font-black font-game text-amber-300 mt-4 tracking-wider">
              UNSEALING DESTINY...
            </span>
          </div>
        )}

        {/* OPENED REWARDS (Exact match to Pack opened_Rewards.png) */}
        {packState === 'opened' && rewardStarmon && (
          <div className="w-full flex flex-col items-center my-auto animate-in zoom-in-95 duration-400">
            {/* 3 Revealed Cards Showcase */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5 w-full max-w-2xl my-3">
              {/* Card 1: Shiny Coins */}
              <div className="flex flex-col items-center bg-gradient-to-b from-slate-900/90 to-indigo-950/90 border-2 border-amber-400/70 rounded-2xl p-3 md:p-4 shadow-xl">
                <div className="w-18 h-18 md:w-22 md:h-22 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mb-2 text-4xl">
                  <img src={GOLD_IMAGE} alt="Gold" className="h-10 w-10 object-contain" />
                </div>
                <h3 className="text-sm md:text-base font-black font-game text-amber-300">Starter Gold</h3>
                <span className="text-lg md:text-xl font-black text-white mt-0.5">+500 Gold</span>
                <p className="text-[10px] text-slate-400 mt-1 text-center">Gold coins for upgrades.</p>
              </div>

              {/* Card 2: Specific Starmon Upgrade Cards */}
              <div className="flex flex-col items-center bg-gradient-to-b from-slate-900/90 to-indigo-950/90 border-2 border-cyan-400/70 rounded-2xl p-3 md:p-4 shadow-xl">
                <div className="w-18 h-18 md:w-22 md:h-22 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center mb-2 text-4xl">
                  🃏
                </div>
                <h3 className="text-sm md:text-base font-black font-game text-cyan-300 truncate max-w-[140px] text-center">
                  {rewardStarmon.name} Cards
                </h3>
                <span className="text-lg md:text-xl font-black text-white mt-0.5">+25 Cards</span>
                <p className="text-[10px] text-slate-400 mt-1 text-center">Specific upgrade cards.</p>
              </div>

              {/* Card 3: Starter Starmon Character Card */}
              <div className="flex flex-col items-center bg-gradient-to-b from-indigo-900/90 via-purple-950/90 to-slate-900/90 border-2 border-amber-400 rounded-2xl p-3 md:p-4 shadow-2xl relative overflow-hidden">
                <div className="absolute top-2 left-2 bg-gradient-to-r from-blue-600 to-indigo-600 px-2 py-0.2 rounded text-[10px] font-black text-white border border-blue-300">
                  SUMMONED
                </div>
                <div className="w-22 h-22 md:w-26 md:h-26 flex items-center justify-center my-1">
                  <StarmonAsset id={rewardStarmon.avatarSeed} size="lg" animated />
                </div>
                <span className="text-[9px] font-black px-2 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  STARTER COMPANION
                </span>
                <h3 className="text-base font-black font-game text-white mt-0.5">{rewardStarmon.name}</h3>
                <p className="text-[10px] text-amber-200 truncate">{rewardStarmon.title}</p>
              </div>
            </div>

            {/* Bottom Buttons */}
            <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-2 w-full max-w-xl justify-center">
              <button
                onClick={() => setShowDetailCard(true)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-bold text-slate-200 transition-colors flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                DETAILS
              </button>

              {starterPacksAvailable > 1 ? (
                <>
                  <button
                    onClick={() => handleClaim(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black font-game text-xs md:text-sm tracking-wider rounded-xl shadow-lg shadow-cyan-500/30 transform hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 border-2 border-cyan-200 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-cyan-200" />
                    CLAIM & OPEN PACK 2 ({starterPacksAvailable - 1} LEFT)
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>

                  <button
                    onClick={() => handleClaim(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                  >
                    GO TO LOBBY
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleClaim(false)}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black font-game text-sm md:text-base tracking-wider rounded-xl shadow-lg shadow-amber-500/30 transform hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 border-2 border-amber-200 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-950" />
                  COLLECT & ENTER LOBBY
                  <ChevronRight className="w-4 h-4 text-amber-950" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailCard && rewardStarmon && (
          <div className="absolute inset-0 bg-slate-950/95 rounded-2xl p-4 flex flex-col justify-between z-20">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div>
                <h3 className="text-xl font-bold font-game text-amber-300">{rewardStarmon.name}</h3>
                <p className="text-[11px] text-slate-400">
                  {rewardStarmon.role} · {getElementDisplayName(rewardStarmon.element, rewardStarmon.secondaryElement, rewardStarmon.id)} Element
                </p>
              </div>
              <button
                onClick={() => setShowDetailCard(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 my-3">
              <div className="flex flex-col items-center justify-center p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                <StarmonAsset id={rewardStarmon.avatarSeed} size="lg" animated />
                <div className="mt-2 flex gap-4 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400">HP</span>
                    <p className="text-sm font-bold text-emerald-400">{rewardStarmon.maxHp}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">ATK</span>
                    <p className="text-sm font-bold text-rose-400">{rewardStarmon.baseAtk}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">DEF</span>
                    <p className="text-sm font-bold text-amber-400">{rewardStarmon.def}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold text-amber-400">PASSIVE: {rewardStarmon.passive.name}</span>
                  <p className="text-[11px] text-slate-300 whitespace-pre-line">{rewardStarmon.passive.description}</p>
                </div>
                <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold text-cyan-400">SKILL 1: {rewardStarmon.skill1.name}</span>
                  <p className="text-[11px] text-slate-300 whitespace-pre-line">{rewardStarmon.skill1.description}</p>
                </div>
                <div className="p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold text-purple-400">SKILL 2: {rewardStarmon.skill2.name}</span>
                  <p className="text-[11px] text-slate-300 whitespace-pre-line">{rewardStarmon.skill2.description}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowDetailCard(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl text-slate-200"
            >
              Back to Rewards
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
