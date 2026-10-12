import React, { useEffect, useState } from 'react';
import { ArrowLeft, Clock3, Lock, X } from 'lucide-react';
import { CraftingJob } from '../types';
import { EQUIPMENT_ITEMS_CATALOG, OLD_PICKAXE_IMAGE, STAR_SHARD_IMAGE } from '../data/itemsData';
import { BLACKSMITH_OPTION_IMAGES, getEquipmentUpgradeCost, getItemLevelStats } from '../data/itemStats';

type Mode = 'menu' | 'upgrade' | 'craft' | 'forge';

interface Props {
  gold: number;
  energy: number;
  starShards: number;
  equipmentInventory: { itemId: string; count: number; level?: number; enhancement?: number }[];
  craftingJobs: CraftingJob[];
  onClose: () => void;
  onCraft: (slot: number, itemId: string) => void;
  onClaimCraft: (slot: number) => void;
  onUpgrade: (itemId: string, currentLevel: number) => void;
}

const optionCards = [
  { key: 'upgrade' as const, title: 'UPGRADE ITEMS', image: BLACKSMITH_OPTION_IMAGES.upgrade, locked: false },
  { key: 'craft' as const, title: 'CRAFT ITEMS', image: BLACKSMITH_OPTION_IMAGES.craft, locked: false },
  { key: 'forge' as const, title: 'MAGICAL FORGE', image: BLACKSMITH_OPTION_IMAGES.forge, locked: true },
];

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export const BlacksmithModal: React.FC<Props> = ({
  gold, energy, starShards, equipmentInventory, craftingJobs, onClose, onCraft, onClaimCraft, onUpgrade,
}) => {
  const [mode, setMode] = useState<Mode>('menu');
  const [now, setNow] = useState(Date.now());
  const [selectedCraftSlot, setSelectedCraftSlot] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const itemStacks = equipmentInventory.filter(stack => stack.count > 0);
  const oldPickaxes = itemStacks.filter(stack => stack.itemId === 'old_pickaxe');

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 md:p-6">
      <section className="relative w-full max-w-6xl max-h-[94vh] overflow-y-auto rounded-3xl border-2 border-amber-400/80 bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-amber-400/30 bg-slate-950/95 backdrop-blur">
          <div className="flex items-center gap-3">
            {mode !== 'menu' && <button onClick={() => { if (mode === 'craft' && selectedCraftSlot !== null) setSelectedCraftSlot(null); else setMode('menu'); }} className="rounded-lg p-2 bg-slate-800 hover:bg-slate-700" aria-label="Back"><ArrowLeft className="w-4 h-4" /></button>}
            <div>
              <h2 className="font-game text-lg sm:text-2xl font-black tracking-wider text-amber-300">BLACKSMITH</h2>
              {mode === 'menu' && <p className="text-xs text-slate-400">Choose a service</p>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 bg-slate-800 hover:bg-rose-700" aria-label="Close"><X className="w-5 h-5" /></button>
        </header>

        {mode === 'menu' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 md:p-6">
            {optionCards.map(card => (
              <article key={card.key} className="relative aspect-[0.72] min-h-[340px] overflow-hidden rounded-2xl border border-amber-300/40 bg-slate-900 bg-cover bg-center shadow-xl" style={{ backgroundImage: `url("${card.image}")` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/5 to-black/10" />
                {card.locked && <div className="absolute inset-0 bg-slate-950/65 flex items-center justify-center"><Lock className="w-12 h-12 text-amber-300" /></div>}
                <div className="absolute inset-x-0 bottom-0 h-[22%] min-h-[92px] p-3 flex flex-col items-center justify-end gap-2 bg-gradient-to-t from-black/95 to-transparent">
                  <h3 className="text-center font-game text-sm sm:text-base font-black tracking-wide text-white drop-shadow">{card.title}</h3>
                  <button disabled={card.locked} onClick={() => setMode(card.key)} className="w-full max-w-[190px] py-2 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black font-game text-sm disabled:opacity-50 disabled:cursor-not-allowed">{card.locked ? 'LOCKED' : 'ENTER'}</button>
                </div>
              </article>
            ))}
          </div>
        )}

        {mode === 'upgrade' && (
          <div className="p-4 md:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm font-bold">
              <span>Gold: <b className="text-amber-300">{gold.toLocaleString()}</b></span>
              <span className="flex items-center gap-1.5"><img src={STAR_SHARD_IMAGE} alt="" className="h-6 w-6 object-contain" /> <b className="text-cyan-300">{starShards.toLocaleString()}</b></span>
              <span>Enhance: <b className="text-slate-400">LOCKED</b></span>
            </div>
            {oldPickaxes.length === 0 ? <p className="rounded-xl bg-slate-950 p-6 text-center text-slate-400">No upgradeable items in Inventory.</p> : (
              <div className="space-y-3">
                {oldPickaxes.map(stack => {
                  const item = EQUIPMENT_ITEMS_CATALOG[stack.itemId];
                  const level = stack.level || 1;
                  const targetLevel = level + 1;
                  const cost = getEquipmentUpgradeCost(targetLevel);
                  const stats = getItemLevelStats(stack.itemId, level);
                  const canUpgrade = !!cost && level < 100 && gold >= cost.gold && starShards >= cost.shards;
                  return <div key={`${stack.itemId}-${level}`} className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-slate-700 bg-slate-950/80 p-4">
                    <img src={item?.imageUrl || OLD_PICKAXE_IMAGE} alt={item?.name || stack.itemId} className="h-20 w-20 rounded-xl bg-slate-900 object-contain p-2" />
                    <div className="flex-1">
                      <h3 className="font-game font-black text-white">{item?.name || stack.itemId} <span className="text-xs text-amber-300">x{stack.count}</span></h3>
                      <p className="text-xs text-slate-400">Handheld · Common · Level {level}</p>
                      <p className="mt-1 font-mono text-sm text-emerald-300">ATK +{stats.atk}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-xs text-slate-300">Next Level {targetLevel}<br /><span className="text-amber-300">{cost ? `${cost.gold.toLocaleString()} Gold` : 'MAX LEVEL'}</span> · <span className="text-cyan-300">{cost?.shards.toLocaleString() || 0} Star Shard</span></div>
                      <button disabled={!canUpgrade} onClick={() => onUpgrade(stack.itemId, level)} className="rounded-xl border border-cyan-300/60 bg-cyan-500/20 px-5 py-2 font-game text-sm font-black text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">LEVEL UP</button>
                    </div>
                  </div>;
                })}
              </div>
            )}
            <p className="mt-4 text-xs text-slate-500">Upgrade costs follow the Level Up table in Item Stat.pdf. Rarity enhancement is currently locked.</p>
          </div>
        )}

        {mode === 'craft' && (
          <div className="p-4 md:p-6">
            <div className="mb-4 flex flex-wrap gap-4 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm font-bold">
              <span>Gold: <b className="text-amber-300">{gold.toLocaleString()}</b></span>
              <span>Energy: <b className="text-yellow-300">{energy}</b></span>
              <span className="flex items-center gap-1.5"><img src={STAR_SHARD_IMAGE} alt="" className="h-6 w-6 object-contain" /> <b className="text-cyan-300">{starShards}</b></span>
            </div>
            {selectedCraftSlot === null ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map(slot => {
                const job = craftingJobs.find(entry => entry.slot === slot);
                const isUnlocked = slot === 0;
                const ready = !!job && job.completesAt <= now;
                return <div key={slot} className={`min-h-64 rounded-2xl border p-4 flex flex-col items-center text-center ${isUnlocked ? 'border-amber-400/60 bg-slate-950/80' : 'border-slate-700 bg-slate-900/50 opacity-75'}`}>
                  <span className="text-[10px] font-black tracking-widest text-slate-400">CRAFT SLOT {slot + 1}</span>
                  {!isUnlocked ? <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-500"><Lock className="h-8 w-8" /><span className="font-game font-black">LOCKED</span></div> : job ? <>
                    <img src={EQUIPMENT_ITEMS_CATALOG[job.itemId]?.imageUrl || OLD_PICKAXE_IMAGE} alt="Old Pickaxe" className="mt-3 h-24 w-24 object-contain" />
                    <b className="font-game">{EQUIPMENT_ITEMS_CATALOG[job.itemId]?.name || job.itemId}</b>
                    <div className="mt-2 flex items-center gap-1 text-sm text-cyan-200"><Clock3 className="h-4 w-4" />{ready ? 'READY' : formatTime(job.completesAt - now)}</div>
                    <button disabled={!ready} onClick={() => onClaimCraft(slot)} className="mt-auto w-full rounded-xl bg-emerald-500 px-3 py-2 font-game font-black text-slate-950 disabled:opacity-40">CLAIM</button>
                  </> : <button onClick={() => setSelectedCraftSlot(slot)} className="group flex flex-1 flex-col items-center justify-center gap-3 text-slate-300"><span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-amber-300/70 bg-amber-400/10 text-amber-200 transition group-hover:scale-110 group-hover:bg-amber-400/20"><span className="text-4xl leading-none">+</span></span><span className="font-game text-xs font-black">CHOOSE ITEM</span></button>}
                </div>;
              })}
            </div> : <div className="space-y-3">
              <p className="text-center text-xs text-slate-300">Available recipes for Craft Slot {selectedCraftSlot + 1}</p>
              <article className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-2xl border border-amber-400/60 bg-slate-950/80 p-5 sm:flex-row">
                <img src={OLD_PICKAXE_IMAGE} alt="Old Pickaxe" className="h-28 w-28 object-contain" />
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="font-game text-lg font-black text-amber-200">Old Pickaxe</h3>
                  <p className="text-xs text-slate-400">Handheld · Common · Level 1 · Crafting time: 60 min</p>
                  <p className="mt-3 text-sm font-bold text-slate-200">Craft Cost</p>
                  <p className="text-xs text-amber-100">200 Gold · 50 Star Shard · 50 Energy</p>
                </div>
                <button disabled={gold < 200 || starShards < 50 || energy < 50} onClick={() => { onCraft(selectedCraftSlot, 'old_pickaxe'); setSelectedCraftSlot(null); }} className="w-full rounded-xl bg-amber-400 px-8 py-3 font-game font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">CRAFT</button>
              </article>
            </div>}
          </div>
        )}

        {mode === 'forge' && <div className="p-10 text-center"><Lock className="mx-auto h-12 w-12 text-amber-300" /><h3 className="mt-3 font-game text-xl font-black">MAGICAL FORGE</h3><p className="mt-1 text-sm text-slate-400">Locked</p></div>}
      </section>
    </div>
  );
};
