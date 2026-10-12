import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { ElementType, Starmon } from '../types';
import { STARMON_ROSTER } from '../data/starmons';
import { sound } from '../services/sound';
import {
  X,
  Sparkles,
  ChevronRight,
  Layers,
  CheckCircle2,
  AlertCircle,
  PackageCheck
} from 'lucide-react';

import packWindImg from '../assets/images/pack_wind.png';
import packWaterImg from '../assets/images/pack_water.png';
import packMetalImg from '../assets/images/pack_metal.png';
import packFireImg from '../assets/images/pack_fire.png';
import packElectricImg from '../assets/images/pack_electric.png';
import packEarthImg from '../assets/images/pack_earth.png';
import aquanymphDpImg from '../assets/images/aquanymph_dp.png';

import { AQUANYMPH_DA_PHUC_IMAGE, DA_PHUC_UNIFORM_IMAGE } from '../data/itemsData';

interface Props {
  playerGems: number;
  starmons: Starmon[];
  hasClaimedDaPhucPack?: boolean;
  onClose: () => void;
  onPurchaseElementalPack: (element: ElementType) => void;
  onOpenInventory?: () => void;
  onClaimDaPhucPack?: () => void;
}

interface PackConfig {
  element: ElementType;
  title: string;
  image: string;
  elementName: string;
  elementIcon: string;
  themeColor: {
    border: string;
    glow: string;
    badgeBg: string;
    badgeText: string;
    buttonBg: string;
  };
}

const ELEMENTAL_PACKS: PackConfig[] = [
  {
    element: 'Wind',
    title: 'Starmon Wind Pack',
    image: packWindImg,
    elementName: 'Wind Element',
    elementIcon: '💨',
    themeColor: {
      border: 'border-teal-500/70',
      glow: 'shadow-teal-500/30',
      badgeBg: 'bg-teal-500/20',
      badgeText: 'text-teal-300',
      buttonBg: 'from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500',
    },
  },
  {
    element: 'Water',
    title: 'Starmon Water Pack',
    image: packWaterImg,
    elementName: 'Water Element',
    elementIcon: '💧',
    themeColor: {
      border: 'border-sky-500/70',
      glow: 'shadow-sky-500/30',
      badgeBg: 'bg-sky-500/20',
      badgeText: 'text-sky-300',
      buttonBg: 'from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500',
    },
  },
  {
    element: 'Metal',
    title: 'Starmon Metal Pack',
    image: packMetalImg,
    elementName: 'Metal Element',
    elementIcon: '⚙️',
    themeColor: {
      border: 'border-slate-400/70',
      glow: 'shadow-slate-400/30',
      badgeBg: 'bg-slate-400/20',
      badgeText: 'text-slate-200',
      buttonBg: 'from-slate-400 to-zinc-600 hover:from-slate-300 hover:to-zinc-500',
    },
  },
  {
    element: 'Fire',
    title: 'Starmon Fire Pack',
    image: packFireImg,
    elementName: 'Fire Element',
    elementIcon: '🔥',
    themeColor: {
      border: 'border-rose-500/70',
      glow: 'shadow-rose-500/30',
      badgeBg: 'bg-rose-500/20',
      badgeText: 'text-rose-300',
      buttonBg: 'from-rose-500 to-orange-600 hover:from-rose-400 hover:to-orange-500',
    },
  },
  {
    element: 'Electric',
    title: 'Starmon Electric Pack',
    image: packElectricImg,
    elementName: 'Electric Element',
    elementIcon: '⚡',
    themeColor: {
      border: 'border-amber-400/70',
      glow: 'shadow-amber-400/30',
      badgeBg: 'bg-amber-400/20',
      badgeText: 'text-amber-300',
      buttonBg: 'from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400',
    },
  },
  {
    element: 'Earth',
    title: 'Starmon Earth Pack',
    image: packEarthImg,
    elementName: 'Earth Element',
    elementIcon: '🪨',
    themeColor: {
      border: 'border-amber-700/70',
      glow: 'shadow-amber-700/30',
      badgeBg: 'bg-amber-700/20',
      badgeText: 'text-amber-400',
      buttonBg: 'from-amber-700 to-yellow-800 hover:from-amber-600 hover:to-yellow-700',
    },
  },
];

export const ShopModal: React.FC<Props> = ({
  playerGems,
  starmons,
  hasClaimedDaPhucPack = false,
  onClose,
  onPurchaseElementalPack,
  onOpenInventory,
  onClaimDaPhucPack,
}) => {
  const [purchasedPack, setPurchasedPack] = useState<PackConfig | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showDaPhucReward, setShowDaPhucReward] = useState(false);
  const [isDaPhucClaimedLocal, setIsDaPhucClaimedLocal] = useState(hasClaimedDaPhucPack);

  const isDaPhucClaimed = hasClaimedDaPhucPack || isDaPhucClaimedLocal;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleClaimDaPhuc = () => {
    if (isDaPhucClaimed) {
      sound.playWrong();
      showToast('Aquanymph Da Phuc Pack can only be claimed once!');
      return;
    }
    setIsDaPhucClaimedLocal(true);
    sound.playRewardFanfare();
    try {
      confetti({
        particleCount: 160,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#38bdf8', '#0ea5e9', '#6366f1', '#fbbf24', '#f43f5e'],
      });
    } catch {}
    setShowDaPhucReward(true);
    onClaimDaPhucPack?.();
  };

  // Helper: Get all Starmons matching an element
  const getElementalPool = (element: ElementType) => {
    return STARMON_ROSTER.filter(
      s => s.element === element || s.secondaryElement === element
    );
  };

  // Helper: Get owned count for this element
  const getElementalStats = (element: ElementType) => {
    const pool = getElementalPool(element);
    const owned = pool.filter(p =>
      starmons.some(s => s.id === p.id && s.unlocked)
    );
    return {
      pool,
      ownedCount: owned.length,
      totalCount: pool.length,
    };
  };

  const handlePurchase = (pack: PackConfig) => {
    sound.playClick();

    if (playerGems < 359) {
      sound.playWrong();
      showToast('❌ Not enough Gems! 359 Gems required.');
      return;
    }

    // Call purchase handler: deduct gems, add pack to Inventory > Consumables
    onPurchaseElementalPack(pack.element);
    sound.playRewardFanfare();

    try {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#fbbf24', '#34d399', '#f43f5e'],
      });
    } catch {}

    setPurchasedPack(pack);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-gradient-to-b from-slate-900 via-indigo-950/90 to-slate-950 border-2 border-amber-500/40 rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl text-slate-100 overflow-hidden relative">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-rose-950/95 border-2 border-rose-500 text-rose-200 px-4 py-2 rounded-2xl shadow-2xl text-xs sm:text-sm font-bold flex items-center gap-2 animate-bounce">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 sm:px-6 py-3.5 bg-slate-950/80 shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 text-xl shadow-inner">
              🏪
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-xl font-black font-game text-white tracking-wide">
                  TRAINER SHOP
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                  SPECIAL SALE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Purchase Elemental Packs! Packs are stored in your Inventory under Consumables.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Player Gems Display */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-900/90 border border-indigo-400/40 shadow-inner">
              <span className="text-base sm:text-lg">💎</span>
              <div className="flex flex-col">
                <span className="text-[9px] text-indigo-300 uppercase font-black leading-none">
                  Gems
                </span>
                <span className="text-sm sm:text-base font-black font-mono text-amber-300 leading-tight">
                  {playerGems.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all cursor-pointer"
              title="Close Shop"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Promotional Sale Banner */}
        <div className="bg-gradient-to-r from-amber-600/30 via-rose-600/30 to-purple-600/30 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-200 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span className="font-bold">
              🔥 <strong>Special Sale:</strong> Each Elemental Pack discounted from{' '}
              <span className="line-through text-slate-400">500 Gems</span> to{' '}
              <strong className="text-amber-300 font-mono text-sm">359 Gems</strong> (-28% Off)!
            </span>
          </div>
          <span className="text-[11px] text-slate-300 font-medium">
            Stored in Inventory &gt; Consumables to open anytime!
          </span>
        </div>

        {/* Packs Grid Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          {/* SPECIAL FREE BUNDLE: Aquanymph Da Phuc Pack (0 Gems / Free) */}
          <div className="relative rounded-3xl bg-gradient-to-r from-sky-950/90 via-indigo-950/95 to-slate-900 border-2 border-sky-400/80 p-4 sm:p-5 shadow-2xl overflow-hidden group">
            <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-sky-400/15 blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Left Images: Aquanymph Da Phuc + Da Phuc Uniform */}
              <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-slate-950/80 border-2 border-sky-400/60 p-2 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <img
                    src={aquanymphDpImg}
                    alt="Aquanymph Da Phuc"
                    className="max-h-full max-w-full object-contain drop-shadow-md"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = AQUANYMPH_DA_PHUC_IMAGE;
                    }}
                  />
                  <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-sky-500 text-slate-950 text-[9px] font-black uppercase shadow">
                    Starmon
                  </span>
                </div>

                <div className="text-xl font-black text-sky-300 font-game">+</div>

                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-950/80 border-2 border-amber-400/60 p-2 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <img
                    src={DA_PHUC_UNIFORM_IMAGE}
                    alt="Da Phuc Uniform"
                    className="max-h-full max-w-full object-contain drop-shadow-md"
                  />
                  <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black uppercase shadow">
                    Item
                  </span>
                </div>
              </div>

              {/* Center Info */}
              <div className="flex-1 text-center md:text-left space-y-1">
                <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
                  {isDaPhucClaimed ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      CLAIMED
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider animate-pulse shadow">
                      FREE (0 GEMS)
                    </span>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/40 text-[10px] font-black uppercase">
                    Exclusive Bundle
                  </span>
                </div>

                <h3 className="text-base sm:text-xl font-black font-game text-white tracking-wide">
                  AQUANYMPH DA PHUC & UNIFORM BUNDLE
                </h3>

                <p className="text-xs text-sky-200/90 leading-relaxed">
                  Claim <strong>1 Aquanymph Da Phuc</strong> (Item Slot 1 pre-unlocked) and <strong>1 Da Phuc Uniform</strong> completely free!
                </p>
                <p className="text-[11px] text-slate-400">
                  Retains full Aquanymph elemental skills while granting access to exclusive equipment.
                </p>
              </div>

              {/* Right Action Button */}
              <div className="flex flex-col items-center md:items-end gap-2 shrink-0 w-full md:w-auto">
                <div className="flex items-baseline gap-2">
                  <span className="line-through text-slate-500 font-mono text-xs">999 💎</span>
                  <span className={`text-xl sm:text-2xl font-black font-mono drop-shadow ${isDaPhucClaimed ? 'text-slate-400' : 'text-emerald-300'}`}>
                    {isDaPhucClaimed ? 'CLAIMED' : '0 💎 (FREE)'}
                  </span>
                </div>

                <button
                  onClick={handleClaimDaPhuc}
                  disabled={isDaPhucClaimed}
                  className={
                    isDaPhucClaimed
                      ? "w-full md:w-auto px-6 py-3 rounded-2xl bg-slate-800/90 text-slate-400 font-black font-game text-xs sm:text-sm border border-slate-700/70 shadow-inner cursor-not-allowed flex items-center justify-center gap-2 select-none"
                      : "w-full md:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black font-game text-xs sm:text-sm shadow-xl shadow-emerald-500/30 transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 animate-bounce-slow"
                  }
                >
                  {isDaPhucClaimed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>CLAIMED</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-slate-950" />
                      <span>CLAIM FREE BUNDLE</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {ELEMENTAL_PACKS.map(pack => {
              const { ownedCount, totalCount } = getElementalStats(pack.element);
              const isAllOwned = totalCount > 0 && ownedCount >= totalCount;

              return (
                <div
                  key={pack.element}
                  className={`relative rounded-3xl bg-slate-900/90 border-2 ${pack.themeColor.border} p-4 flex flex-col justify-between shadow-xl transition-all hover:scale-[1.01] hover:shadow-2xl overflow-hidden group`}
                >
                  {/* Elemental Ambient Glow */}
                  <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/5 blur-2xl pointer-events-none" />

                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-600/90 text-white text-[10px] font-black tracking-wider uppercase shadow">
                      -28% SALE
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full ${pack.themeColor.badgeBg} ${pack.themeColor.badgeText} text-[11px] font-black border border-white/10 flex items-center gap-1`}
                    >
                      <span>{pack.elementIcon}</span>
                      <span>{pack.elementName}</span>
                    </span>
                  </div>

                  {/* Center Pack Image */}
                  <div className="relative w-full h-36 sm:h-40 flex items-center justify-center my-1">
                    <img
                      src={pack.image}
                      alt={pack.title}
                      className="max-h-full max-w-[190px] object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)] transform group-hover:scale-105 group-hover:-translate-y-1 transition-transform duration-300 pointer-events-none select-none"
                    />
                  </div>

                  {/* Pack Title & Description */}
                  <div className="my-2">
                    <h3 className="text-base sm:text-lg font-black font-game text-white tracking-wide text-center">
                      {pack.title}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-300 text-center leading-relaxed mt-1 min-h-[36px]">
                      Summons 1 unowned {pack.element} Starmon guaranteed, or +50 cards if element codex is complete. Transferred to Inventory &gt; Consumables upon purchase.
                    </p>

                    {/* Collection Status Pill */}
                    <div className="mt-2 flex items-center justify-center">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-950/80 border border-slate-700/80 text-slate-300 flex items-center gap-1">
                        {isAllOwned ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-300">Complete ({ownedCount}/{totalCount})</span>
                          </>
                        ) : (
                          <>
                            <Layers className="w-3 h-3 text-indigo-400" />
                            <span>Codex: {ownedCount}/{totalCount} Starmons</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Price & Purchase Button */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
                    {/* Price with strikethrough */}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">
                        Price
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="line-through text-slate-500 font-mono text-xs sm:text-sm font-bold">
                          500 💎
                        </span>
                        <span className="text-base sm:text-lg font-black font-mono text-amber-300 drop-shadow">
                          359 💎
                        </span>
                      </div>
                    </div>

                    {/* Buy Button */}
                    <button
                      onClick={() => handlePurchase(pack)}
                      className={`px-4 sm:px-5 py-2.5 rounded-2xl bg-gradient-to-r ${pack.themeColor.buttonBg} text-white font-black font-game text-xs sm:text-sm shadow-lg ${pack.themeColor.glow} transition-all active:scale-95 cursor-pointer flex items-center gap-1.5`}
                    >
                      <Sparkles className="w-4 h-4 text-white" />
                      <span>Buy Pack</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-800 px-6 py-2.5 bg-slate-950/90 flex items-center justify-between text-[11px] text-slate-400 shrink-0 flex-wrap gap-2">
          <span>
            💡 <strong>Tip:</strong> Complete daily quests or IELTS quiz trials to earn free Gems.
          </span>
          <span className="text-amber-400/90 font-bold">
            ⚡ Purchased packs are stored in your Inventory under Consumables.
          </span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* PACK PURCHASED SUCCESS CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {purchasedPack && (
        <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
          <div className="relative max-w-md w-full bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 border-2 border-amber-400 rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 mb-3 shadow-lg animate-bounce">
              <PackageCheck className="w-9 h-9" />
            </div>

            <h3 className="text-2xl font-black font-game text-white">
              PACK PURCHASED!
            </h3>
            <p className="text-xs text-amber-300 font-mono font-bold mt-1 uppercase tracking-wider">
              {purchasedPack.title}
            </p>

            {/* Pack Graphic */}
            <div className="w-40 h-48 my-3 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-amber-400/20 blur-xl rounded-full" />
              <img
                src={purchasedPack.image}
                alt={purchasedPack.title}
                className="max-h-full max-w-full object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] relative z-10"
              />
            </div>

            <p className="text-xs text-slate-200 leading-relaxed mb-4 max-w-xs">
              <strong>1x {purchasedPack.title}</strong> has been transferred to your <strong>Inventory &gt; Consumables</strong>! You can open it whenever you are ready.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
              {onOpenInventory && (
                <button
                  onClick={() => {
                    sound.playClick();
                    setPurchasedPack(null);
                    onClose();
                    onOpenInventory();
                  }}
                  className="w-full py-3 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black font-game text-xs rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
                >
                  VIEW IN INVENTORY
                </button>
              )}
              <button
                onClick={() => {
                  sound.playClick();
                  setPurchasedPack(null);
                }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                CONTINUE SHOPPING
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AQUANYMPH DA PHUC CLAIMED SUCCESS MODAL */}
      {showDaPhucReward && (
        <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
          <div className="relative max-w-md w-full bg-gradient-to-b from-slate-900 via-sky-950 to-slate-950 border-2 border-sky-400 rounded-3xl p-6 shadow-2xl text-center flex flex-col items-center">
            <h3 className="text-2xl font-black font-game text-sky-300">
              BUNDLE CLAIMED!
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Aquanymph Da Phuc & Da Phuc Uniform have been added to your collection!
            </p>
            <div className="flex items-center justify-center gap-4 my-4">
              <img src={aquanymphDpImg} alt="Aquanymph Da Phuc" className="w-24 h-24 object-contain" />
              <span className="text-2xl font-black text-sky-300">+</span>
              <img src={DA_PHUC_UNIFORM_IMAGE} alt="Uniform" className="w-20 h-20 object-contain" />
            </div>
            <button
              onClick={() => {
                sound.playClick();
                setShowDaPhucReward(false);
              }}
              className="px-8 py-3 bg-gradient-to-r from-sky-400 to-blue-500 text-white font-black font-game text-xs rounded-xl shadow-lg cursor-pointer"
            >
              AWESOME!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
