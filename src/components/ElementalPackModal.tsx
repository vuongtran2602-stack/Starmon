import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { ElementType, Starmon } from '../types';
import { STARMON_ROSTER, ELEMENT_COLORS } from '../data/starmons';
import { StarmonAsset } from './StarmonAsset';
import { sound } from '../services/sound';
import { Sparkles, X, ChevronRight, Layers, Eye } from 'lucide-react';

import packWindImg from '../assets/images/pack_wind.png';
import packWaterImg from '../assets/images/pack_water.png';
import packMetalImg from '../assets/images/pack_metal.png';
import packFireImg from '../assets/images/pack_fire.png';
import packElectricImg from '../assets/images/pack_electric.png';
import packEarthImg from '../assets/images/pack_earth.png';

const PACK_IMAGES: Record<ElementType, string> = {
  Wind: packWindImg,
  Water: packWaterImg,
  Metal: packMetalImg,
  Fire: packFireImg,
  Electric: packElectricImg,
  Earth: packEarthImg,
};

interface Props {
  element: ElementType;
  packsAvailable: number;
  starmons: Starmon[];
  onClose: () => void;
  onClaim: (
    element: ElementType,
    rewardStarmon: Starmon,
    isDuplicate: boolean,
    cardsGranted: number,
    openNext?: boolean
  ) => void;
}

export const ElementalPackModal: React.FC<Props> = ({
  element,
  packsAvailable = 1,
  starmons,
  onClose,
  onClaim,
}) => {
  const [packState, setPackState] = useState<'unopened' | 'tearing' | 'opened'>('unopened');
  const [rewardStarmon, setRewardStarmon] = useState<Starmon | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [cardsAmount, setCardsAmount] = useState(25);
  const [showDetailCard, setShowDetailCard] = useState(false);

  const packImg = PACK_IMAGES[element] || packWindImg;

  const triggerOpen = () => {
    if (packState !== 'unopened') return;
    setPackState('tearing');
    sound.playPackTear();

    // Pool matching this element
    const pool = STARMON_ROSTER.filter(
      s => s.element === element || s.secondaryElement === element
    );

    const unowned = pool.filter(p => !starmons.some(s => s.id === p.id && s.unlocked));

    let chosen: Starmon;
    let duplicate = false;
    let cards = 25;

    if (unowned.length > 0) {
      chosen = unowned[Math.floor(Math.random() * unowned.length)];
      duplicate = false;
      cards = 25;
    } else {
      chosen = pool[Math.floor(Math.random() * pool.length)] || pool[0];
      duplicate = true;
      cards = 50;
    }

    setRewardStarmon(chosen);
    setIsDuplicate(duplicate);
    setCardsAmount(cards);

    setTimeout(() => {
      setPackState('opened');
      sound.playRewardFanfare();

      try {
        confetti({
          particleCount: 140,
          spread: 90,
          origin: { y: 0.6 },
          colors: ['#38bdf8', '#f59e0b', '#ec4899', '#10b981', '#6366f1'],
        });
      } catch {}
    }, 600);
  };

  const handleClaimReward = (openNext: boolean = false) => {
    sound.playClick();
    if (rewardStarmon) {
      onClaim(element, rewardStarmon, isDuplicate, cardsAmount, openNext);
      if (openNext && packsAvailable > 1) {
        setPackState('unopened');
        setRewardStarmon(null);
        setShowDetailCard(false);
      } else {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none animate-in fade-in duration-200">
      <div className="relative max-w-lg w-full bg-gradient-to-b from-slate-900 via-indigo-950/95 to-slate-950 border-2 border-amber-400/80 rounded-3xl p-5 md:p-7 shadow-2xl text-slate-100 flex flex-col items-center text-center overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-4">
          <span className="text-[10px] md:text-xs font-mono font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
            {packsAvailable} {element} Pack{packsAvailable > 1 ? 's' : ''} Remaining
          </span>
          <h2 className="text-xl md:text-2xl font-black font-game text-white mt-1">
            {packState === 'opened' ? 'Summoning Complete!' : `Open ${element} Pack`}
          </h2>
        </div>

        {/* UNOPENED STATE */}
        {packState === 'unopened' && (
          <div className="flex flex-col items-center my-3 animate-in fade-in zoom-in-95">
            <div
              onClick={triggerOpen}
              className="relative cursor-pointer group transition-transform hover:scale-105 active:scale-95 duration-200"
              title="Click to tear open!"
            >
              <div className="absolute -inset-4 bg-gradient-to-r from-amber-400/30 to-sky-400/30 rounded-3xl blur-xl group-hover:blur-2xl transition-all" />
              <div className="relative w-56 h-72 sm:w-64 sm:h-80 rounded-3xl bg-slate-950/80 border-2 border-amber-400 p-4 shadow-2xl flex flex-col items-center justify-center backdrop-blur-sm">
                <img
                  src={packImg}
                  alt={`${element} Pack`}
                  className="w-48 h-60 object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] animate-bounce-slow"
                />
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-4 max-w-xs">
              Guaranteed 1 {element} Starmon or 50 upgrade cards if already owned!
            </p>

            <button
              onClick={triggerOpen}
              className="mt-4 px-8 py-3 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black font-game text-sm rounded-2xl shadow-xl shadow-amber-500/40 border-2 border-amber-200 cursor-pointer transform hover:scale-105 active:scale-95 animate-pulse"
            >
              TEAR OPEN PACK
            </button>
          </div>
        )}

        {/* TEARING STATE */}
        {packState === 'tearing' && (
          <div className="py-16 flex flex-col items-center justify-center animate-pulse">
            <div className="w-40 h-40 rounded-full border-4 border-amber-400 border-t-transparent animate-spin mb-4" />
            <h3 className="text-lg font-black font-game text-amber-300">
              Summoning Elemental Starmon...
            </h3>
          </div>
        )}

        {/* OPENED REWARD STATE */}
        {packState === 'opened' && rewardStarmon && (
          <div className="flex flex-col items-center w-full animate-in zoom-in-95 duration-300">
            <div className="relative w-full max-w-sm bg-slate-950/90 border-2 border-amber-400/80 rounded-3xl p-5 shadow-2xl flex flex-col items-center">
              {/* Duplicate or New Badge */}
              <div className="mb-2">
                {isDuplicate ? (
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-purple-500/25 text-purple-300 border border-purple-400/40">
                    Duplicate: +{cardsAmount} Cards Granted
                  </span>
                ) : (
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 animate-pulse">
                    ✨ New Starmon Unlocked!
                  </span>
                )}
              </div>

              {/* Graphic */}
              <div className="w-44 h-44 flex items-center justify-center relative my-1">
                <StarmonAsset
                  id={rewardStarmon.avatarSeed || rewardStarmon.id}
                  size="xl"
                  animated
                  className="w-full h-full object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] scale-125"
                />
              </div>

              <h3 className="text-xl font-black font-game text-white mt-1">
                {rewardStarmon.name}
              </h3>
              <p className="text-xs text-slate-300 italic mb-2">
                "{rewardStarmon.title}"
              </p>

              {/* Element Badges */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm ${
                    ELEMENT_COLORS[rewardStarmon.element]?.bg || 'bg-indigo-600'
                  } ${ELEMENT_COLORS[rewardStarmon.element]?.text || 'text-white'}`}
                >
                  {rewardStarmon.element}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono font-bold">
                  {rewardStarmon.role}
                </span>
              </div>

              {/* Stat Preview */}
              <div className="grid grid-cols-3 gap-2 w-full text-center bg-slate-900/80 p-2.5 rounded-2xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">HP</span>
                  <span className="font-bold text-emerald-300">{rewardStarmon.maxHp}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">ATK</span>
                  <span className="font-bold text-rose-300">{rewardStarmon.baseAtk}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">DEF</span>
                  <span className="font-bold text-sky-300">{rewardStarmon.def}</span>
                </div>
              </div>

              {/* Expandable Skills View */}
              {showDetailCard && (
                <div className="w-full mt-3 p-3 bg-slate-900/90 rounded-2xl border border-slate-700 text-left text-xs space-y-2 animate-in fade-in">
                  <div>
                    <span className="font-bold text-amber-300">
                      Passive: {rewardStarmon.passive.name}
                    </span>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      {rewardStarmon.passive.description}
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-sky-300">
                      Skill 1: {rewardStarmon.skill1.name} (Cost: {rewardStarmon.skill1.manaCost} Mana)
                    </span>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      {rewardStarmon.skill1.description}
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={() => setShowDetailCard(!showDetailCard)}
                className="mt-2 text-[11px] text-indigo-300 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                {showDetailCard ? 'Hide Skills' : 'View Skills & Passive'}
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 w-full mt-4">
              <button
                onClick={() => handleClaimReward(false)}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black font-game text-sm rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                COLLECT & ADD TO CODEX
              </button>
              {packsAvailable > 1 && (
                <button
                  onClick={() => handleClaimReward(true)}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-amber-300 font-black font-game text-xs rounded-xl border border-amber-400/40 shadow-md transition-transform active:scale-95 cursor-pointer"
                >
                  OPEN NEXT
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
