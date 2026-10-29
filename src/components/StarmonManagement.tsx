import React, { useState } from 'react';
import { Starmon, ElementType, EquipmentItem, ResearchTechLevels } from '../types';
import { StarmonAsset } from './StarmonAsset';
import { getCardsNeededForLevel, getGoldNeededForLevel, ELEMENT_COLORS, getElementDisplayName, STARMON_ROSTER } from '../data/starmons';
import { getStarmonClass, getLevelUpStatGain, calculateCP } from '../data/starmonStats';
import { getEquipmentUpgradeCost, getItemLevelStats } from '../data/itemStats';
import { getUnlockedItemSlots } from '../data/techResearch';
import { EQUIPMENT_ITEMS_CATALOG, OMNI_CARD_IMAGE, GOLD_IMAGE } from '../data/itemsData';
import { sound } from '../services/sound';
import { getStarmonSkillDescription } from '../data/starmonSkillTranslations';
import {
  Shield,
  Swords,
  Heart,
  Zap,
  ArrowUpCircle,
  CheckCircle,
  ChevronLeft,
  Sparkles,
  Lock,
  Users,
  ArrowLeftRight,
  ArrowLeft,
  ArrowRight,
  X,
  Plus,
  AlertTriangle,
  Briefcase,
  Info
} from 'lucide-react';

const getEquippedItemBonuses = (starmon: Starmon) =>
  (starmon.equippedItems || []).reduce((total, itemId, slotIndex) => {
    if (!itemId) return total;
    const stats = getItemLevelStats(itemId, starmon.equippedItemLevels?.[slotIndex] || 1);
    return { hp: total.hp + stats.hp, atk: total.atk + stats.atk, def: total.def + stats.def };
  }, { hp: 0, atk: 0, def: 0 });

interface Props {
  starmons: Starmon[];
  playerGold: number;
  omniStarmonCards?: number;
  activeCompanionId: string;
  battleParty?: string[];
  unitTestExpiry?: number;
  equipmentInventory?: { itemId: string; count: number; level?: number; enhancement?: number }[];
  specialItems?: { starShard: number; goldenAnvil: number };
  techResearchLevels?: ResearchTechLevels;
  onClose: () => void;
  onLevelUp: (starmonId: string, cardsCost: number, goldCost: number) => void;
  onConvertOmniCards?: (starmonId: string, count: number) => void;
  onSetActiveCompanion: (starmonId: string) => void;
  onAwakenStarmon?: (starmonId: string, cardsCost: number) => void;
  onUpdateBattleParty?: (partyIds: string[]) => void;
  onEquipItem?: (starmonId: string, slotIndex: number, itemId: string, level?: number) => void;
  onUnequipItem?: (starmonId: string, slotIndex: number) => void;
  onUpgradeEquippedItem?: (starmonId: string, slotIndex: number, currentLevel: number) => void;
}

export const StarmonManagement: React.FC<Props> = ({
  starmons,
  playerGold,
  omniStarmonCards = 0,
  activeCompanionId,
  battleParty,
  unitTestExpiry,
  equipmentInventory = [],
  specialItems = { starShard: 0, goldenAnvil: 0 },
  techResearchLevels,
  onClose,
  onLevelUp,
  onConvertOmniCards,
  onSetActiveCompanion,
  onAwakenStarmon,
  onUpdateBattleParty,
  onEquipItem,
  onUnequipItem,
  onUpgradeEquippedItem,
}) => {
  const [selectedId, setSelectedId] = useState<string>(activeCompanionId || starmons[0].id);
  const [elementFilter, setElementFilter] = useState<'All' | ElementType>('All');
  const [partyWarning, setPartyWarning] = useState<string | null>(null);
  const [activeSlotModal, setActiveSlotModal] = useState<number | null>(null);
  const [inspectSlotIndex, setInspectSlotIndex] = useState<number | null>(null);
  const [itemToast, setItemToast] = useState<string | null>(null);
  const [showEquipLimits, setShowEquipLimits] = useState(false);
  const [showOmniModal, setShowOmniModal] = useState(false);
  const [omniAmount, setOmniAmount] = useState(1);
  const [skillLanguage, setSkillLanguage] = useState<'English' | 'Tiếng Việt'>('English');

  // UnitTest 0-cost mode check (valid for 5 days)
  const isUnitTestActive = !!(unitTestExpiry && unitTestExpiry > Date.now());
  const remainingDays = isUnitTestActive ? Math.ceil((unitTestExpiry - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  // Active Battle Party lineup (1 to 3 Starmons)
  const currentPartyIds: string[] = battleParty && battleParty.length > 0
    ? battleParty
    : starmons.filter(s => s.unlocked).map(s => s.id).slice(0, 3);

  const canEquipItemInSlot = (itemId: string, slotIndex: number | null) => {
    if (slotIndex === null || !getUnlockedItemSlots(techResearchLevels, selectedStarmon.element)[slotIndex]) return false;
    const candidate = EQUIPMENT_ITEMS_CATALOG[itemId];
    if (!candidate || (candidate.targetStarmonId && candidate.targetStarmonId !== selectedStarmon.id)) return false;
    const current = (selectedStarmon.equippedItems || []).filter((id, index) => id && index !== slotIndex)
      .map(id => EQUIPMENT_ITEMS_CATALOG[id!]).filter(Boolean);
    if (current.length >= 6) return false;
    if (candidate.slotType === 'special') return true;
    const count = (type: string) => current.filter(item => item.slotType === type).length;
    if (candidate.slotType === 'headwear' || candidate.slotType === 'body_armor' || candidate.slotType === 'boots') return count(candidate.slotType) < 1;
    if (candidate.slotType === 'relic') return count('relic') < 2;
    if (candidate.slotType === 'handheld_shield') return count('handheld_shield') < 1 && count('handheld') < 1;
    if (candidate.slotType === 'handheld') return count('handheld') + count('handheld_shield') < 2;
    return false;
  };

  const fallbackMon = STARMON_ROSTER[0];
  const selectedStarmon = (starmons && starmons.length > 0 ? (starmons.find(s => s.id === selectedId) || starmons[0]) : null) || fallbackMon;
  const selectedClass = selectedStarmon.starmonClass || getStarmonClass(selectedStarmon.id);
  const nextLevelGain = selectedClass && selectedStarmon.level < 100
    ? getLevelUpStatGain(selectedClass, selectedStarmon.level + 1)
    : undefined;
  const regularCardsNeeded = getCardsNeededForLevel(selectedStarmon.level);
  const regularGoldNeeded = getGoldNeededForLevel(selectedStarmon.level);

  const cardsNeeded = isUnitTestActive ? 0 : regularCardsNeeded;
  const goldNeeded = isUnitTestActive ? 0 : regularGoldNeeded;

  // AWAKEN (UNOBTAINED): Needs 10 separate cards (or 0 cards in UnitTest mode)
  const AWAKEN_COST = isUnitTestActive ? 0 : 10;
  const canAwaken = !selectedStarmon.unlocked && (isUnitTestActive || selectedStarmon.cards >= AWAKEN_COST);

  // ONLY UNLOCKED STARMONS CAN BE LEVELED UP OR USED AS COMPANION!
  const canLevelUp = selectedStarmon.unlocked && !!selectedClass && selectedStarmon.level < 100 && (isUnitTestActive || (selectedStarmon.cards >= cardsNeeded && playerGold >= goldNeeded));

  const handleLevelUpClick = () => {
    if (!canLevelUp) {
      sound.playWrong();
      return;
    }
    sound.playLevelUp();
    onLevelUp(selectedStarmon.id, cardsNeeded, goldNeeded);
  };

  const handleAwakenClick = () => {
    if (!canAwaken || !onAwakenStarmon) {
      sound.playWrong();
      return;
    }
    sound.playRewardFanfare();
    onAwakenStarmon(selectedStarmon.id, AWAKEN_COST);
  };

  const handleSelectCompanion = () => {
    if (!selectedStarmon.unlocked) {
      sound.playWrong();
      return;
    }
    sound.playClick();
    onSetActiveCompanion(selectedStarmon.id);
  };

  // ==========================================
  // BATTLE PARTY REORDERING & MANAGEMENT
  // ==========================================
  const handleMovePartyLeft = (index: number) => {
    if (index <= 0 || !onUpdateBattleParty) return;
    sound.playClick();
    const updated = [...currentPartyIds];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    onUpdateBattleParty(updated);
  };

  const handleMovePartyRight = (index: number) => {
    if (index >= currentPartyIds.length - 1 || !onUpdateBattleParty) return;
    sound.playClick();
    const updated = [...currentPartyIds];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    onUpdateBattleParty(updated);
  };

  const handleRemoveFromParty = (starmonId: string) => {
    if (!onUpdateBattleParty) return;
    if (currentPartyIds.length <= 1) {
      sound.playWrong();
      setPartyWarning('Yêu cầu trong Party luôn có ít nhất 1 Starmon để bắt đầu chiến đấu!');
      setTimeout(() => setPartyWarning(null), 3500);
      return;
    }
    sound.playClick();
    const updated = currentPartyIds.filter(id => id !== starmonId);
    onUpdateBattleParty(updated);
  };

  const handleAddToParty = (starmonId: string) => {
    if (!onUpdateBattleParty) return;
    const target = starmons.find(s => s.id === starmonId);
    if (!target || !target.unlocked) {
      sound.playWrong();
      return;
    }
    if (currentPartyIds.includes(starmonId)) {
      sound.playWrong();
      return;
    }
    if (currentPartyIds.length >= 3) {
      // Replace last slot if full
      sound.playClick();
      const updated = [...currentPartyIds.slice(0, 2), starmonId];
      onUpdateBattleParty(updated);
      return;
    }
    sound.playClick();
    onUpdateBattleParty([...currentPartyIds, starmonId]);
  };

  const filteredStarmons = starmons.filter(s => {
    if (elementFilter === 'All') return true;
    const matchTarget = (e?: ElementType) => {
      if (!e) return false;
      if (elementFilter === 'Wind') return e === 'Wind';
      return e === elementFilter;
    };
    return matchTarget(s.element) || matchTarget(s.secondaryElement);
  });

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 flex flex-col text-slate-100 overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="h-12 md:h-14 border-b border-slate-800 bg-slate-900/90 px-4 md:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors flex items-center gap-1 font-bold text-xs cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Lobby
          </button>
          <h1 className="text-sm md:text-base font-black font-game text-white tracking-wide flex items-center gap-2">
            <span>Starmon Roster & Battle Party</span>
            {isUnitTestActive && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 font-bold animate-pulse">
                🧪 UnitTest 0-Cost ({remainingDays}d)
              </span>
            )}
          </h1>
        </div>

        {/* Currency summary */}
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-950 border border-amber-500/30 rounded-xl">
          <span className="font-bold text-amber-300 text-xs font-mono flex items-center gap-1"><img src={GOLD_IMAGE} alt="Gold" className="h-4 w-4 object-contain" />{playerGold.toLocaleString()}</span>
        </div>
      </header>

      {/* ======================================================== */}
      {/* BATTLE PARTY STRIP (1 to 3 Starmons Lineup & Position Selector) */}
      {/* ======================================================== */}
      <section className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/80 border-b border-indigo-500/30 px-4 py-2 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <div>
              <span className="text-xs font-black font-game text-white flex items-center gap-1.5">
                BATTLE PARTY (Đội Hình Ra Trận: {currentPartyIds.length}/3)
              </span>
              <span className="text-[10px] text-slate-400 block">
                Thay đổi vị trí các Starmon bằng nút ◀ / ▶. Yêu cầu tối thiểu 1 Starmon.
              </span>
            </div>
          </div>

          {partyWarning && (
            <div className="px-3 py-1 bg-rose-950/90 border border-rose-500/60 rounded-xl text-[11px] font-bold text-rose-200 flex items-center gap-1.5 animate-bounce">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>{partyWarning}</span>
            </div>
          )}

          {/* Party Slots */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {[0, 1, 2].map(slotIdx => {
              const monId = currentPartyIds[slotIdx];
              const mon = monId ? starmons.find(s => s.id === monId) : null;

              if (mon) {
                return (
                  <div
                    key={slotIdx}
                    className="p-1.5 rounded-xl bg-slate-950/90 border border-amber-400/50 flex items-center gap-2 shadow-sm"
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-800">
                      <StarmonAsset
                        id={mon.avatarSeed}
                        size="sm"
                        isDaPhucVersion={mon.isDaPhucVersion || mon.equippedItems?.includes('da_phuc_uniform')}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold font-mono">
                          Slot {slotIdx + 1}
                        </span>
                        <span className="text-[11px] font-bold text-white font-game truncate max-w-[80px]">
                          {mon.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {/* Move Left */}
                        <button
                          type="button"
                          onClick={() => handleMovePartyLeft(slotIdx)}
                          disabled={slotIdx === 0}
                          className={`p-0.5 rounded bg-slate-800 text-slate-300 hover:text-white ${
                            slotIdx === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-700 cursor-pointer'
                          }`}
                          title="Move Left (Đổi vị trí lên trước)"
                        >
                          <ArrowLeft className="w-3 h-3" />
                        </button>

                        {/* Move Right */}
                        <button
                          type="button"
                          onClick={() => handleMovePartyRight(slotIdx)}
                          disabled={slotIdx >= currentPartyIds.length - 1}
                          className={`p-0.5 rounded bg-slate-800 text-slate-300 hover:text-white ${
                            slotIdx >= currentPartyIds.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-700 cursor-pointer'
                          }`}
                          title="Move Right (Đổi vị trí xuống sau)"
                        >
                          <ArrowRight className="w-3 h-3" />
                        </button>

                        {/* Remove from Party (requires at least 1 in party) */}
                        <button
                          type="button"
                          onClick={() => handleRemoveFromParty(mon.id)}
                          className={`p-0.5 rounded text-rose-400 hover:text-rose-200 ${
                            currentPartyIds.length <= 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-rose-950/60 cursor-pointer'
                          }`}
                          title={currentPartyIds.length <= 1 ? 'Party luôn cần ít nhất 1 Starmon' : 'Xóa khỏi Party'}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={slotIdx}
                  className="w-28 h-12 rounded-xl border border-dashed border-slate-700/80 bg-slate-950/40 flex items-center justify-center text-center p-1 text-[10px] text-slate-500 font-bold"
                >
                  <span>+ Slot {slotIdx + 1} Empty</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Column: Starmon Roster Grid */}
        <div className="w-full md:w-5/12 lg:w-4/12 border-r border-slate-800 bg-slate-900/40 p-2.5 md:p-3 flex flex-col overflow-hidden">
          {/* Element Filter Bar */}
          <div className="flex items-center gap-1 pb-2 overflow-x-auto no-scrollbar border-b border-slate-800 shrink-0">
            {(['All', 'Fire', 'Water', 'Electric', 'Wind', 'Earth', 'Metal'] as const).map(elem => (
              <button
                key={elem}
                onClick={() => {
                  sound.playClick();
                  setElementFilter(elem);
                }}
                className={`px-2.5 py-0.5 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  elementFilter === elem
                    ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                {elem}
              </button>
            ))}
          </div>

          {/* Starmon List */}
          <div className="flex-1 overflow-y-auto mt-2 pr-1 space-y-1.5">
            {filteredStarmons.map(starmon => {
              const equipmentBonus = getEquippedItemBonuses(starmon);
              const isSelected = starmon.id === selectedStarmon.id;
              const isCurrentCompanion = starmon.id === activeCompanionId;
              const partyIndex = currentPartyIds.indexOf(starmon.id);
              const isInParty = partyIndex !== -1;
              const elemInfo = ELEMENT_COLORS[starmon.element];
              const starmonCardsReq = isUnitTestActive ? 0 : getCardsNeededForLevel(starmon.level);
              const readyToLevel = starmon.unlocked && (isUnitTestActive || (starmon.cards >= starmonCardsReq && playerGold >= getGoldNeededForLevel(starmon.level)));

              return (
                <div
                  key={starmon.id}
                  onClick={() => {
                    sound.playClick();
                    setSelectedId(starmon.id);
                  }}
                  className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-slate-800 border-amber-400 shadow-md'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  } ${!starmon.unlocked ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-12 h-12 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center overflow-hidden">
                      <StarmonAsset
                        id={starmon.avatarSeed}
                        size="sm"
                        isDaPhucVersion={starmon.isDaPhucVersion || starmon.equippedItems?.includes('da_phuc_uniform')}
                      />
                      {!starmon.unlocked && (
                        <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-white font-game">{starmon.name}</span>
                        <div className="flex items-center gap-1">
                          <span className={`text-[9px] px-1 rounded font-bold ${elemInfo.bg} text-slate-950`}>
                            {starmon.element}
                          </span>
                          {starmon.secondaryElement && (
                            <span className={`text-[9px] px-1 rounded font-bold ${ELEMENT_COLORS[starmon.secondaryElement].bg} text-slate-950`}>
                              {starmon.secondaryElement === 'Metal' ? ((starmon.id === 'moltenback' || starmon.id === 'dreadhorn') ? 'Steel' : 'Metal') : starmon.secondaryElement}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 flex-wrap">
                        <span className="font-mono font-bold text-amber-300 bg-amber-400/10 px-1 py-0.5 rounded border border-amber-400/30 text-[9px]">
                          CP {calculateCP(starmon.maxHp + equipmentBonus.hp, starmon.baseAtk + equipmentBonus.atk, starmon.def + equipmentBonus.def)}
                        </span>
                        <span className="font-semibold text-slate-300 text-[9px] bg-slate-800 px-1 py-0.5 rounded">
                          {starmon.starmonClass || getStarmonClass(starmon.id) ? `Class: ${starmon.starmonClass || getStarmonClass(starmon.id)}` : ''}
                        </span>
                        <span>·</span>
                        <span>Lv. {starmon.level}</span>
                        <span>HP {starmon.maxHp + equipmentBonus.hp}{equipmentBonus.hp > 0 && <b className="ml-0.5 text-emerald-400">(+{equipmentBonus.hp})</b>}</span>
                        <span>ATK {starmon.baseAtk + equipmentBonus.atk}{equipmentBonus.atk > 0 && <b className="ml-0.5 text-emerald-400">(+{equipmentBonus.atk})</b>}</span>
                        <span>DEF {starmon.def + equipmentBonus.def}{equipmentBonus.def > 0 && <b className="ml-0.5 text-emerald-400">(+{equipmentBonus.def})</b>}</span>
                        {isInParty && (
                          <span className="text-[9px] text-amber-300 font-bold bg-amber-500/20 px-1 rounded border border-amber-400/40">
                            Party #{partyIndex + 1}
                          </span>
                        )}
                        {isCurrentCompanion && (
                          <span className="text-[9px] text-cyan-300 font-bold bg-cyan-500/20 px-1 rounded">
                            Companion
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {starmon.unlocked ? (
                      <div>
                        <span className="text-[10px] font-mono text-cyan-300">
                          🃏 {starmon.cards}/{starmonCardsReq}
                        </span>
                        {readyToLevel && (
                          <span className="block text-[9px] font-black text-emerald-400 animate-pulse">
                            Level Up!
                          </span>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span className="text-[10px] font-mono text-slate-400">
                          🃏 {starmon.cards}/{AWAKEN_COST}
                        </span>
                        {canAwaken ? (
                          <span className="block text-[9px] font-black text-emerald-400 animate-pulse">
                            Can Summon!
                          </span>
                        ) : (
                          <span className="block text-[9px] text-slate-500 font-semibold">Locked</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Detailed Stats & Level Up Controls */}
        <div className="flex-1 bg-gradient-to-b from-slate-900/60 to-slate-950 p-4 md:p-5 overflow-y-auto flex flex-col justify-between">
          <div>
            {/* Top Showcase Row */}
            <div className="flex flex-col sm:flex-row items-center gap-4 pb-4 border-b border-slate-800">
              <div className="relative w-36 h-36 md:w-40 md:h-40 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl flex items-center justify-center p-2">
                <StarmonAsset
                  id={selectedStarmon.avatarSeed}
                  size="lg"
                  animated
                  isDaPhucVersion={selectedStarmon.isDaPhucVersion || selectedStarmon.equippedItems?.includes('da_phuc_uniform')}
                />
                <div className="absolute top-2 left-2 px-1.5 py-0.2 rounded bg-black/60 border border-slate-700 text-[10px] font-bold text-amber-300">
                  Lv. {selectedStarmon.level}
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-2 w-full">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl md:text-2xl font-black font-game text-white">
                        {selectedStarmon.name}
                      </h2>
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${ELEMENT_COLORS[selectedStarmon.element as ElementType]?.bg || 'bg-slate-500'} text-slate-950 shadow-sm`}>
                          {selectedStarmon.element}
                        </span>
                        {selectedStarmon.secondaryElement && (
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${ELEMENT_COLORS[selectedStarmon.secondaryElement as ElementType]?.bg || 'bg-slate-500'} text-slate-950 shadow-sm`}>
                            {selectedStarmon.secondaryElement === 'Metal' ? ((selectedStarmon.id === 'moltenback' || selectedStarmon.id === 'dreadhorn') ? 'Steel' : 'Metal') : selectedStarmon.secondaryElement}
                          </span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-950/80 border border-indigo-500/50 text-indigo-300 font-mono shadow-sm">
                          {selectedClass ? `Class: ${selectedClass}` : ''}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">{selectedStarmon.title}</p>
                  </div>

                  {/* Companion & Party Quick Actions */}
                  <div className="flex flex-col items-end gap-1.5">
                    {selectedStarmon.unlocked ? (
                      <div className="flex items-center gap-2">
                        {/* Battle Party Toggle */}
                        {currentPartyIds.includes(selectedStarmon.id) ? (
                          <button
                            onClick={() => handleRemoveFromParty(selectedStarmon.id)}
                            disabled={currentPartyIds.length <= 1}
                            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                              currentPartyIds.length <= 1
                                ? 'bg-amber-500/20 border-amber-400/30 text-amber-300 cursor-not-allowed opacity-60'
                                : 'bg-rose-950/60 border-rose-500/50 text-rose-300 hover:bg-rose-900/60'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                            Leave Party
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAddToParty(selectedStarmon.id)}
                            className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black font-game border border-amber-300 shadow-sm transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add to Party
                          </button>
                        )}

                        {/* Set Companion */}
                        <button
                          onClick={handleSelectCompanion}
                          className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1 cursor-pointer ${
                            selectedStarmon.id === activeCompanionId
                              ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          {selectedStarmon.id === activeCompanionId ? 'Active Companion' : 'Set Companion'}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-500 bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
                        Locked
                      </span>
                    )}
                  </div>
                </div>

                {/* Base Attributes with Equipment Bonuses & CP */}
                {(() => {
                  const equipmentBonus = getEquippedItemBonuses(selectedStarmon);
                  const effectiveHp = selectedStarmon.maxHp + equipmentBonus.hp;
                  const effectiveAtk = selectedStarmon.baseAtk + equipmentBonus.atk;
                  const effectiveDef = selectedStarmon.def + equipmentBonus.def;
                  const effectiveCp = calculateCP(effectiveHp, effectiveAtk, effectiveDef);

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                      {/* CP (Combat Power) */}
                      <div className="p-2 bg-gradient-to-br from-amber-950/60 to-slate-900/90 border border-amber-500/50 rounded-xl flex items-center gap-2 shadow-sm">
                        <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                        <div>
                          <span className="text-[10px] text-amber-300 font-bold block font-mono">CP</span>
                          <span className="text-sm font-black text-amber-300 font-mono tracking-tight">
                            {effectiveCp.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* HP */}
                      <div className="p-2 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-2">
                        <Heart className="w-4 h-4 text-rose-400 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">HP</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold text-white font-mono">{effectiveHp}{equipmentBonus.hp > 0 && <b className="ml-1 text-xs text-emerald-400">(+{equipmentBonus.hp})</b>}</span>
                          </div>
                        </div>
                      </div>

                      {/* ATK */}
                      <div className="p-2 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-2">
                        <Swords className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">ATK</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold text-white font-mono">{effectiveAtk}{equipmentBonus.atk > 0 && <b className="ml-1 text-xs text-emerald-400">(+{equipmentBonus.atk})</b>}</span>
                          </div>
                        </div>
                      </div>

                      {/* DEF */}
                      <div className="p-2 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center gap-2">
                        <Shield className="w-4 h-4 text-sky-400 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block">DEF</span>
                          <span className="text-sm font-bold text-white font-mono">{effectiveDef}{equipmentBonus.def > 0 && <b className="ml-1 text-xs text-emerald-400">(+{equipmentBonus.def})</b>}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Skills & Passive */}
            <div className="mt-3 flex items-center justify-end gap-1.5" aria-label="Skill description language">
              <button onClick={() => setSkillLanguage('English')} className={`rounded-lg border px-3 py-1 text-[10px] font-black ${skillLanguage === 'English' ? 'border-amber-300 bg-amber-300 text-slate-950' : 'border-slate-700 bg-slate-950 text-slate-300'}`}>English</button>
              <button onClick={() => setSkillLanguage('Tiếng Việt')} className={`rounded-lg border px-3 py-1 text-[10px] font-black ${skillLanguage === 'Tiếng Việt' ? 'border-amber-300 bg-amber-300 text-slate-950' : 'border-slate-700 bg-slate-950 text-slate-300'}`}>Tiếng Việt</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-3">
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                <span className="text-[10px] font-bold text-amber-400 uppercase">PASSIVE</span>
                <h4 className="text-xs font-bold text-white font-game">{selectedStarmon.passive.name}</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug whitespace-pre-line">{getStarmonSkillDescription(selectedStarmon.id, 'passive', selectedStarmon.passive.description, skillLanguage)}</p>
              </div>

              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                <span className="text-[10px] font-bold text-sky-400 uppercase">SKILL 1 ({selectedStarmon.skill1.manaCost} Ma)</span>
                <h4 className="text-xs font-bold text-white font-game">{selectedStarmon.skill1.name}</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug whitespace-pre-line">{getStarmonSkillDescription(selectedStarmon.id, 'skill1', selectedStarmon.skill1.description, skillLanguage)}</p>
              </div>

              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
                <span className="text-[10px] font-bold text-purple-400 uppercase">SKILL 2 ({selectedStarmon.skill2.manaCost} Ma)</span>
                <h4 className="text-xs font-bold text-white font-game">{selectedStarmon.skill2.name}</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug whitespace-pre-line">{getStarmonSkillDescription(selectedStarmon.id, 'skill2', selectedStarmon.skill2.description, skillLanguage)}</p>
              </div>
            </div>

            {/* ======================================================== */}
            {/* ITEMS & EQUIPMENT AREA (6 SLOTS WITH PLUS & LOCK ICONS) */}
            {/* ======================================================== */}
            <div className="mt-3 p-3.5 bg-slate-900/85 border-2 border-slate-800/90 rounded-2xl relative shadow-md">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs">
                    ⚔️
                  </div>
                  <h3 className="text-xs sm:text-sm font-black font-game text-white tracking-wide">
                    ITEM <span className="font-mono text-amber-300">({(selectedStarmon.equippedItems || []).filter(Boolean).length}/6)</span>
                  </h3>
                  <button onClick={() => setShowEquipLimits(true)} className="rounded-full text-slate-300 hover:text-amber-300" title="Equipment limits"><Info className="w-4 h-4" /></button>
                </div>
                <span className="text-[10px] text-slate-400 hidden sm:inline">
                  Chọn ô để trang bị vật phẩm gia tăng chỉ số
                </span>
              </div>

              {/* Toast for Items */}
              {itemToast && (
                <div className="mb-2.5 p-2 rounded-xl bg-amber-950/80 border border-amber-500/60 text-amber-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{itemToast}</span>
                </div>
              )}

              {/* 6 Slots Grid */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-2.5">
                {[0, 1, 2, 3, 4, 5].map(slotIdx => {
                  const isSlotUnlocked = getUnlockedItemSlots(techResearchLevels, selectedStarmon.element)[slotIdx];
                  const slotLabel = `Item Slot ${slotIdx + 1}`;

                  const equippedItemId = selectedStarmon.equippedItems?.[slotIdx];
                  const equippedItem = equippedItemId ? EQUIPMENT_ITEMS_CATALOG[equippedItemId] : null;

                  return (
                    <div
                      key={slotIdx}
                      onClick={() => {
                        if (!selectedStarmon.unlocked) {
                          sound.playWrong();
                          setItemToast('Cần mở khóa Starmon này trước khi trang bị!');
                          setTimeout(() => setItemToast(null), 3000);
                          return;
                        }

                        if (!isSlotUnlocked) {
                          sound.playWrong();
                          setItemToast(
                            `🔒 Item Slot ${slotIdx + 1} is locked. Research the matching Element Tech to unlock it.`
                          );
                          setTimeout(() => setItemToast(null), 3500);
                          return;
                        }

                        if (equippedItem) {
                          sound.playClick();
                          setInspectSlotIndex(slotIdx);
                        } else {
                          sound.playClick();
                          setActiveSlotModal(slotIdx);
                        }
                      }}
                      className={`relative aspect-square rounded-2xl border-2 flex flex-col items-center justify-center p-1.5 transition-all cursor-pointer group select-none ${
                        !isSlotUnlocked
                          ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700 opacity-80'
                          : equippedItem
                          ? 'bg-gradient-to-b from-slate-900 to-indigo-950/90 border-amber-400/80 shadow-md shadow-amber-500/10 hover:border-amber-300'
                          : 'bg-slate-950/90 border-dashed border-slate-700 hover:border-amber-400/80 hover:bg-slate-900'
                      }`}
                      title={
                        !isSlotUnlocked
                          ? `Ô ${slotIdx + 1} đang bị khóa`
                          : equippedItem
                          ? `${equippedItem.name} (Ấn để xem/tháo)`
                          : `Ô ${slotIdx + 1} trống (Ấn dấu + để trang bị)`
                      }
                    >
                      {/* Top-Right: Lock Icon if Locked */}
                      {!isSlotUnlocked && (
                        <div className="absolute top-1.5 right-1.5 p-1 rounded-md bg-slate-900/90 border border-amber-400/50 text-amber-400 shadow-sm">
                          <Lock className="w-3 h-3" />
                        </div>
                      )}

                      {/* Center Content */}
                      {equippedItem ? (
                        <>
                          <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <span className="absolute -left-2 -top-1 z-10 rounded bg-slate-950 px-1 text-[7px] font-black uppercase text-amber-300">{equippedItem.rarity || 'Common'}</span>
                            <span className="absolute -right-2 -top-1 z-10 rounded bg-slate-950 px-1 text-[8px] font-mono">Lv.{selectedStarmon.equippedItemLevels?.[slotIdx] || 1}</span>
                            <img
                              src={equippedItem.imageUrl}
                              alt={equippedItem.name}
                              className="max-h-full max-w-full object-contain drop-shadow"
                            />
                          </div>
                          <span className="text-[9px] font-bold text-amber-200 mt-1 max-w-full truncate text-center font-game leading-tight">
                            {equippedItem.name} · {equippedItem.slotType?.replace('_', ' ') || 'Item'}
                          </span>
                          <span className="text-[8px] tracking-tight">
                            {Array.from({ length: 5 }, (_, star) => <span key={star} className={(star < (selectedStarmon.equippedItemEnhancements?.[slotIdx] || 0)) ? 'text-amber-300' : 'text-slate-600'}>★</span>)}
                          </span>
                        </>
                      ) : (
                        <>
                          {/* Plus Sign in the Center */}
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                              isSlotUnlocked
                                ? 'bg-amber-500/15 border border-amber-400/40 text-amber-400 group-hover:scale-110 group-hover:bg-amber-500/25'
                                : 'bg-slate-900/60 border border-slate-800 text-slate-600'
                            }`}
                          >
                            <Plus className="w-4 h-4" />
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 mt-1 font-mono">
                            {slotLabel}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Level Up / Awaken Action Bar */}
          <div className="mt-3 pt-3 border-t border-slate-800 p-3 bg-slate-900/80 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            {selectedStarmon.unlocked ? (
              <>
                <div className="w-full sm:w-1/2">
                  <div className="flex justify-between items-center text-[11px] font-bold mb-1">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      Individual Cards Progress
                    </span>
                    <span className="font-mono text-cyan-300">
                      {isUnitTestActive ? '0 / 0 (UnitTest Mode Free)' : `${selectedStarmon.cards} / ${cardsNeeded} Cards`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                      style={{ width: isUnitTestActive ? '100%' : `${Math.min(100, (selectedStarmon.cards / cardsNeeded) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Cost: <strong className="text-amber-300">{goldNeeded.toLocaleString()} Gold</strong>
                  </div>
                  {nextLevelGain && (
                    <div className="text-[10px] text-emerald-300 mt-1 font-mono">
                      Next level: +{nextLevelGain.hp} HP, +{nextLevelGain.atk} ATK, +{nextLevelGain.def} DEF, +{nextLevelGain.cp} CP
                    </div>
                  )}
                </div>

                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <button type="button" title="Convert Omni-Starmon Cards" aria-label="Convert Omni-Starmon Cards" onClick={() => { setOmniAmount(Math.max(1, Math.min(omniStarmonCards, 1))); setShowOmniModal(true); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-amber-400 bg-black text-amber-300 shadow-lg transition hover:bg-slate-900"><Plus className="h-6 w-6" /></button>
                  <button
                    onClick={handleLevelUpClick}
                    disabled={!canLevelUp}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-6 py-2.5 font-game text-xs font-black shadow-md transition-all cursor-pointer md:text-sm sm:w-auto ${canLevelUp ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-slate-950 hover:from-emerald-400 active:scale-95' : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'}`}
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    {isUnitTestActive ? `LEVEL UP (0 COST - UnitTest)` : `LEVEL UP (Lv. ${selectedStarmon.level + 1})`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-full sm:w-1/2">
                  <div className="flex justify-between items-center text-[11px] font-bold mb-1">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      Awakening Shards
                    </span>
                    <span className="font-mono text-purple-300">
                      {isUnitTestActive ? '0 / 0 (UnitTest Free Summon)' : `${selectedStarmon.cards} / ${AWAKEN_COST} Cards`}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      style={{ width: isUnitTestActive ? '100%' : `${Math.min(100, (selectedStarmon.cards / AWAKEN_COST) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    {isUnitTestActive
                      ? '🧪 UnitTest Mode: Unlock any unit immediately with 0 cards!'
                      : 'Win battles to open Victory Chests containing 3–8 cards of random Starmons!'}
                  </div>
                </div>

                <button
                  onClick={handleAwakenClick}
                  disabled={!canAwaken}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-black font-game text-xs md:text-sm flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer ${
                    canAwaken
                      ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 hover:from-purple-400 text-white active:scale-95 animate-pulse'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  {isUnitTestActive
                    ? 'AWAKEN STARMON (0 CARDS - UnitTest)'
                    : canAwaken
                    ? `AWAKEN STARMON (${AWAKEN_COST} CARDS)`
                    : `NEEDS ${AWAKEN_COST - selectedStarmon.cards} MORE CARDS`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL: CHỌN TRANG BỊ ĐỂ CHO STARMON CẦM (SLOT ITEM PICKER) */}
      {/* ======================================================== */}
      {activeSlotModal !== null && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl max-w-lg w-full p-5 shadow-2xl flex flex-col text-white relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  ⚔️
                </div>
                <div>
                  <h3 className="text-base font-black font-game text-white">
                    CHỌN TRANG BỊ CHO Ô SỐ {activeSlotModal + 1}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Trang bị lên {selectedStarmon.name} để gia tăng sức mạnh
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  sound.playClick();
                  setActiveSlotModal(null);
                }}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of Available Items in Inventory */}
            <div className="my-4 max-h-72 overflow-y-auto space-y-2.5 pr-1">
              {equipmentInventory && equipmentInventory.filter(inv => inv.count > 0 && canEquipItemInSlot(inv.itemId, activeSlotModal)).length > 0 ? (
                equipmentInventory
                  .filter(inv => inv.count > 0 && canEquipItemInSlot(inv.itemId, activeSlotModal))
                  .map(invItem => {
                    const catalogItem = EQUIPMENT_ITEMS_CATALOG[invItem.itemId];
                    if (!catalogItem) return null;

                    const isPickaxe = catalogItem.id === 'old_pickaxe';
                    const isDaPhucUniform = catalogItem.id === 'da_phuc_uniform';

                    return (
                      <div
                        key={`${invItem.itemId}-${invItem.level || 1}`}
                        className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-amber-400/70 transition-all flex items-center justify-between gap-3 shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center p-1.5 shrink-0">
                            <img
                              src={catalogItem.imageUrl}
                              alt={catalogItem.name}
                              className="max-h-full max-w-full object-contain drop-shadow"
                            />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black font-game text-white">
                                {catalogItem.name}
                              </h4>
                                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-slate-800 text-amber-300 border border-slate-700 font-bold">
                                Lv. {invItem.level || 1} · x{invItem.count}
                              </span>
                            </div>

                            {/* Stat display */}
                            {isPickaxe && (
                              <div className="text-[11px] text-emerald-300 font-mono mt-0.5 space-y-0.5">
                                <div>- ATK +{getItemLevelStats(catalogItem.id, invItem.level || 1).atk}</div>
                              </div>
                            )}

                            {isDaPhucUniform && (
                              <p className="text-[11px] text-sky-200 mt-0.5 leading-snug">
                                hãy trang bị lên người của Aquanymph để nhận phiên bản độc quyền Aquanymph Đa Phúc.
                              </p>
                            )}

                            {!isPickaxe && !isDaPhucUniform && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {catalogItem.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (activeSlotModal === null) return;
                            sound.playRewardFanfare();
                            onEquipItem?.(selectedStarmon.id, activeSlotModal, catalogItem.id, invItem.level || 1);
                            setActiveSlotModal(null);
                            setItemToast(`✨ Đã cho ${selectedStarmon.name} cầm ${catalogItem.name}!`);
                            setTimeout(() => setItemToast(null), 3000);
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black font-game text-xs rounded-xl shadow transition-transform active:scale-95 shrink-0 cursor-pointer"
                        >
                          Trang Bị
                        </button>
                      </div>
                    );
                  })
              ) : (
                <div className="p-6 text-center bg-slate-950/60 rounded-2xl border border-slate-800">
                  <p className="text-xs text-slate-300">
                    Kho đồ của bạn chưa có trang bị nào!
                  </p>
                  <p className="text-[11px] text-amber-300 mt-1">
                    Nhập mã ẩn bí mật <strong>ItemOldPickaxe</strong> hoặc nhận gói <strong>Aquanymph Đa Phúc (Free 0 Gems)</strong> trong Cửa Hàng để có trang bị.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => {
                  sound.playClick();
                  setActiveSlotModal(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showEquipLimits && (
        <div className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowEquipLimits(false)}>
          <div className="w-full max-w-md rounded-2xl border border-amber-400/60 bg-slate-900 p-5 text-white shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-game font-black text-amber-300">Equipment Limits</h3><button onClick={() => setShowEquipLimits(false)} className="rounded-lg p-1.5 bg-slate-800"><X className="h-4 w-4" /></button></div>
            <p className="mt-1 text-xs text-slate-400">Each Starmon can only be equipped with:</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              <li>• 1 Headwear</li><li>• 1 Body Armor</li><li>• 1 Boots</li><li>• 2 Handhelds</li>
              <li>• 1 Handheld Shield (equipping one shield leaves room for only 1 other Handheld)</li><li>• 2 Relics</li>
            </ul>
            <p className="mt-3 text-xs text-amber-200">Maximum equipped items: 6</p>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: XEM CHI TIẾT & THÁO TRANG BỊ ĐANG CẦM */}
      {/* ======================================================== */}
      {inspectSlotIndex !== null && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl max-w-3xl w-full p-4 sm:p-5 shadow-2xl flex flex-col text-white relative">
            {(() => {
              const eqId = selectedStarmon.equippedItems?.[inspectSlotIndex];
              const item = eqId ? EQUIPMENT_ITEMS_CATALOG[eqId] : null;
              if (!item) return null;
              const level = selectedStarmon.equippedItemLevels?.[inspectSlotIndex] || 1;
              const enhancement = selectedStarmon.equippedItemEnhancements?.[inspectSlotIndex] || 0;
              const stats = getItemLevelStats(item.id, level);
              const cost = item.id === 'old_pickaxe' ? getEquipmentUpgradeCost(level + 1) : null;
              const enhancementStars = Array.from({ length: 5 }, (_, i) => i < enhancement);

              return (
                <>
                  <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                    <h3 className="font-game text-lg font-black text-white">{item.name}</h3>
                    <button onClick={() => setInspectSlotIndex(null)} className="rounded-lg p-2 bg-slate-800 hover:bg-slate-700"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="grid grid-cols-[3fr_7fr] gap-3 sm:gap-5 pt-4">
                    <div className="min-w-0">
                      <div className="relative aspect-square rounded-2xl border border-amber-400/50 bg-slate-950 p-3 flex items-center justify-center">
                        <span className="absolute left-2 top-2 rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-300">{item.rarity || 'Common'}</span>
                        <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-mono font-bold">Lv. {level}</span>
                        <img src={item.imageUrl} alt={item.name} className="max-h-full max-w-full object-contain drop-shadow" />
                      </div>
                      <div className="mt-2 text-center text-sm tracking-wider" aria-label={`Enhancement ${enhancement} stars`}>
                        {enhancementStars.map((active, i) => <span key={i} className={active ? 'text-amber-300' : 'text-slate-600'}>★</span>)}
                      </div>
                      <div className="mt-1 text-center text-[9px] font-bold uppercase text-slate-400">Enhancement {enhancement}/5</div>
                    </div>
                    <div className="min-w-0 border-l border-slate-700 pl-3 sm:pl-5">
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">Stats</h4>
                      <ul className="mt-2 space-y-1 text-sm font-mono text-emerald-300">
                        {stats.hp > 0 && <li>• HP +{stats.hp}</li>}
                        {stats.atk > 0 && <li>• ATK +{stats.atk}</li>}
                        {stats.def > 0 && <li>• DEF +{stats.def}</li>}
                      </ul>
                      <h4 className="mt-4 text-xs font-black uppercase tracking-wider text-sky-300">Effect</h4>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">{item.description}</p>
                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <button disabled={!cost || playerGold < cost.gold || (specialItems?.starShard || 0) < (cost?.shards || 0)} onClick={() => onUpgradeEquippedItem?.(selectedStarmon.id, inspectSlotIndex, level)} className="rounded-xl border border-sky-400/50 bg-sky-500/20 p-2 text-left text-sky-100 disabled:opacity-40">
                          <b className="block font-game text-xs">Level Up</b><span className="text-[9px]">{cost ? `${cost.gold.toLocaleString()} Gold · ${cost.shards.toLocaleString()} Shards` : 'MAX LEVEL'}</span>
                        </button>
                        <button disabled className="rounded-xl border border-slate-700 bg-slate-800/70 p-2 text-left text-slate-500 cursor-not-allowed"><b className="block font-game text-xs">Enhance</b><span className="text-[9px]">Locked</span></button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full mt-4">
                    <button
                      onClick={() => {
                        sound.playClick();
                        onUnequipItem?.(selectedStarmon.id, inspectSlotIndex);
                        setInspectSlotIndex(null);
                        setItemToast(`Đã tháo ${item.name} cất lại vào kho đồ.`);
                        setTimeout(() => setItemToast(null), 3000);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/60 text-rose-200 text-xs font-bold transition-all"
                    >
                      Unequip
                    </button>

                    <button
                      onClick={() => {
                        sound.playClick();
                        const slotToChange = inspectSlotIndex;
                        setInspectSlotIndex(null);
                        setActiveSlotModal(slotToChange);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black font-game transition-all"
                    >
                      Change Item
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      sound.playClick();
                      setInspectSlotIndex(null);
                    }}
                    className="mt-3 text-xs text-slate-400 hover:text-white"
                  >
                    Close
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      )}
      {showOmniModal && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
        <section className="w-full max-w-md rounded-2xl border-2 border-amber-400/70 bg-gradient-to-br from-slate-900 to-indigo-950 p-5 text-white shadow-2xl">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-game text-lg font-black text-amber-200">CONVERT OMNI CARDS</h3><button onClick={() => setShowOmniModal(false)} aria-label="Close" className="rounded-lg bg-slate-800 p-2"><X className="h-4 w-4" /></button></div>
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3"><img src={OMNI_CARD_IMAGE} alt="Omni-Starmon Card" className="h-14 w-14 object-contain" /><div><b className="block">{selectedStarmon.name} Cards</b><span className="text-xs text-slate-300">Omni Cards available: <strong className="text-amber-200">{omniStarmonCards}</strong></span></div></div>
          <label className="mb-2 flex items-center justify-between text-xs font-bold"><span>Cards to convert</span><span className="text-amber-200">Max {omniStarmonCards}</span></label>
          <input type="range" min={omniStarmonCards > 0 ? 1 : 0} max={Math.max(1, omniStarmonCards)} value={Math.min(omniAmount, Math.max(1, omniStarmonCards))} onChange={event => setOmniAmount(Number(event.target.value))} disabled={omniStarmonCards < 1} className="mb-3 w-full accent-amber-400" />
          <input type="number" min={1} max={omniStarmonCards} value={omniStarmonCards > 0 ? Math.min(omniAmount, omniStarmonCards) : 0} onChange={event => setOmniAmount(Math.max(1, Math.min(omniStarmonCards, Number(event.target.value) || 1)))} disabled={omniStarmonCards < 1} className="mb-4 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-center font-mono text-lg" />
          {omniStarmonCards < 1 && <p className="mb-3 text-center text-xs text-slate-400">You do not have any Omni-Starmon Cards yet.</p>}
          <button disabled={omniStarmonCards < 1 || !onConvertOmniCards} onClick={() => { onConvertOmniCards?.(selectedStarmon.id, Math.min(omniAmount, omniStarmonCards)); setShowOmniModal(false); }} className="w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-4 py-3 font-game text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">CONVERT TO {selectedStarmon.name.toUpperCase()} CARDS</button>
        </section>
      </div>}
    </div>
  );
};
