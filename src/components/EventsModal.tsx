import React, { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, X } from 'lucide-react';
import { ElementType, MysteryReward, PlayerProfile, Starmon } from '../types';
import { getDailyRewardStatus } from '../data/dailyRewards';
import { GEM_IMAGE, GOLD_IMAGE, OMNI_CARD_IMAGE, STAR_SHARD_IMAGE, GOLDEN_ANVIL_IMAGE, COMMON_ITEM_PACK_IMAGE } from '../data/itemsData';
import dailyRewardsBanner from '../assets/images/rewards/daily_rewards.png';
import lockedIcon from '../assets/images/rewards/locked_icon.png';
import chestClosed from '../assets/images/rewards/chest_closed.jpg';
import chestOpened from '../assets/images/rewards/chest_opened.jpg';
import day7GachaWheel from '../assets/images/rewards/day7_gacha_wheel.png';
import claimButton from '../assets/images/rewards/claim_button.png';
import eventsIcon from '../assets/images/rewards/events_icon.png';
import starmonIcon from '../assets/icons/starmon_icon.png';
import packWind from '../assets/images/pack_wind.png';
import packWater from '../assets/images/pack_water.png';
import packMetal from '../assets/images/pack_metal.png';
import packFire from '../assets/images/pack_fire.png';
import packElectric from '../assets/images/pack_electric.png';
import packEarth from '../assets/images/pack_earth.png';
import { sound } from '../services/sound';

interface Props {
  player: PlayerProfile;
  ownedStarmons: Starmon[];
  onClose: () => void;
  onClaimDailyReward: (day: number, mysteryReward?: MysteryReward) => { success: boolean; message?: string };
}

type PrizeCategory = 'elementalPack' | 'gems70' | 'goldenAnvil' | 'commonItemPack' | 'starShard' | 'omniCards' | 'gems50' | 'gold';
interface WheelSection { category: PrizeCategory; label: string; weight: number; color: string }

const ELEMENTS: ElementType[] = ['Fire', 'Water', 'Earth', 'Electric', 'Metal', 'Wind'];
const ELEMENT_PACK_IMAGES: Record<ElementType, string> = {
  Fire: packFire, Water: packWater, Earth: packEarth, Electric: packElectric, Metal: packMetal, Wind: packWind,
};
const WHEEL_SECTIONS: WheelSection[] = [
  { category: 'elementalPack', label: 'Starmon Pack', weight: 6, color: '#fb923c' },
  { category: 'gems70', label: '70 Gems', weight: 14, color: '#38bdf8' },
  { category: 'goldenAnvil', label: 'Anvil', weight: 5, color: '#a78bfa' },
  { category: 'commonItemPack', label: 'Common Pack', weight: 5, color: '#a16207' },
  { category: 'starShard', label: 'Star Shards', weight: 10, color: '#f472b6' },
  { category: 'omniCards', label: 'Omni Cards', weight: 10, color: '#818cf8' },
  { category: 'gems50', label: '50 Gems', weight: 35, color: '#0ea5e9' },
  { category: 'gold', label: '1,000 Gold', weight: 15, color: '#facc15' },
];

const DAILY_REWARDS: { day: number; title: string; detail: string; image: string }[] = [
  { day: 1, title: 'Gold', detail: '500 Gold', image: GOLD_IMAGE },
  { day: 2, title: 'Gems', detail: '20 Gems', image: GEM_IMAGE },
  { day: 3, title: 'Starmon Cards', detail: '20 random cards for an owned Starmon', image: starmonIcon },
  { day: 4, title: 'Gold', detail: '800 Gold', image: GOLD_IMAGE },
  { day: 5, title: 'Omni-Starmon Cards', detail: '10 cards · usable on any unlocked Starmon', image: OMNI_CARD_IMAGE },
  { day: 6, title: 'Gems', detail: '40 Gems', image: GEM_IMAGE },
  { day: 7, title: 'Mystery Chest', detail: 'Spin for a random reward', image: chestClosed },
];
const BOARD_SLOTS: Record<number, { left: string; top: string; width: string; height: string }> = {
  1: { left: '32.8%', top: '41.8%', width: '14.1%', height: '15.6%' },
  2: { left: '49%', top: '41.8%', width: '14.1%', height: '15.6%' },
  3: { left: '65.1%', top: '41.8%', width: '14.1%', height: '15.6%' },
  4: { left: '32.8%', top: '68.4%', width: '14.1%', height: '15.6%' },
  5: { left: '49%', top: '68.4%', width: '14.1%', height: '15.6%' },
  6: { left: '65.1%', top: '68.4%', width: '14.1%', height: '15.6%' },
  7: { left: '83.4%', top: '54%', width: '14.5%', height: '19.5%' },
};

function rollMysteryReward(): { category: PrizeCategory; reward: MysteryReward; midpoint: number } {
  const roll = Math.random() * 100;
  let cumulative = 0;
  let selected = WHEEL_SECTIONS[WHEEL_SECTIONS.length - 1];
  for (const section of WHEEL_SECTIONS) {
    if (roll < cumulative + section.weight) {
      selected = section;
      break;
    }
    cumulative += section.weight;
  }

  // The supplied wheel artwork centers the first (6%) reward at 12 o'clock.
  const midpoint = WHEEL_SECTIONS.indexOf(selected) * 45;
  switch (selected.category) {
    case 'elementalPack':
      return { category: selected.category, midpoint, reward: { type: 'elementalPack', element: ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)] } };
    case 'gems70': return { category: selected.category, midpoint, reward: { type: 'gems', amount: 70 } };
    case 'goldenAnvil': return { category: selected.category, midpoint, reward: { type: 'goldenAnvil', amount: 1 } };
    case 'commonItemPack': return { category: selected.category, midpoint, reward: { type: 'commonItemPack', amount: 1 } };
    case 'starShard': return { category: selected.category, midpoint, reward: { type: 'starShard', amount: 20 } };
    case 'omniCards': return { category: selected.category, midpoint, reward: { type: 'omniCards', amount: 10 } };
    case 'gems50': return { category: selected.category, midpoint, reward: { type: 'gems', amount: 50 } };
    case 'gold': return { category: selected.category, midpoint, reward: { type: 'gold', amount: 1000 } };
  }
}

function rewardMessage(reward: MysteryReward) {
  switch (reward.type) {
    case 'elementalPack': return `${reward.element} Starmon Pack`;
    case 'gems': return `${reward.amount} Gems`;
    case 'gold': return `${reward.amount.toLocaleString()} Gold`;
    case 'goldenAnvil': return '1 Golden Anvil';
    case 'commonItemPack': return '1 Common Item Pack';
    case 'starShard': return `${reward.amount} Star Shards`;
    case 'omniCards': return `${reward.amount} Omni-Starmon Cards`;
  }
}

function rewardIcon(reward: MysteryReward) {
  switch (reward.type) {
    case 'elementalPack': return ELEMENT_PACK_IMAGES[reward.element];
    case 'gems': return GEM_IMAGE;
    case 'gold': return GOLD_IMAGE;
    case 'goldenAnvil': return GOLDEN_ANVIL_IMAGE;
    case 'commonItemPack': return COMMON_ITEM_PACK_IMAGE;
    case 'starShard': return STAR_SHARD_IMAGE;
    case 'omniCards': return OMNI_CARD_IMAGE;
  }
}

export const EventsModal: React.FC<Props> = ({ player, ownedStarmons, onClose, onClaimDailyReward }) => {
  const [view, setView] = useState<'ongoing' | 'upcoming' | 'rewards' | 'spin'>('ongoing');
  const [now, setNow] = useState(new Date());
  const [isSpinning, setIsSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [spinMessage, setSpinMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [wonReward, setWonReward] = useState<MysteryReward | null>(null);
  const [wheelReward, setWheelReward] = useState<MysteryReward | null>(null);
  const progress = getDailyRewardStatus(player.dailyRewardProgress, now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const spin = () => {
    if (isSpinning) return;
    const result = rollMysteryReward();
    const rotation = wheelRotation + 360 * 5 + (360 - result.midpoint);
    setWheelReward(result.reward);
    setWheelRotation(rotation);
    setIsSpinning(true);
    setNotice('');
    window.setTimeout(() => {
      setIsSpinning(false);
      const claim = onClaimDailyReward(7, result.reward);
      if (claim.success) {
        sound.playRewardFanfare();
        setWonReward(result.reward);
        setSpinMessage(claim.message || rewardMessage(result.reward));
      } else {
        setNotice(claim.message || 'This daily reward has already been claimed.');
      }
    }, 5000);
  };

  const claimDay = (day: number) => {
    if (day === 7) {
      setWonReward(null);
      setWheelReward(null);
      setSpinMessage('');
      setWheelRotation(0);
      setView('spin');
      return;
    }
    const claim = onClaimDailyReward(day);
    setNotice(claim.message || (claim.success ? 'Daily reward claimed!' : 'This daily reward is not available yet.'));
    if (claim.success) sound.playRewardFanfare();
  };

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md sm:p-6">
    <section className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border-2 border-cyan-300/70 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white shadow-2xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-slate-950/75 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {view === 'rewards' || view === 'spin' ? <button onClick={() => { setView('rewards'); setNotice(''); }} aria-label="Back to events" className="rounded-xl bg-slate-800 p-2 hover:bg-slate-700"><ArrowLeft className="h-4 w-4" /></button> : null}
          <img src={eventsIcon} alt="Events" className="h-12 w-12 object-contain" />
          <div><h2 className="font-game text-lg font-black tracking-wide text-cyan-200 sm:text-2xl">{view === 'rewards' ? 'DAILY REWARDS' : view === 'spin' ? 'MYSTERY CHEST' : 'EVENTS'}</h2><p className="text-[10px] text-slate-400 sm:text-xs">{view === 'spin' ? 'Spin the wheel to reveal your prize' : 'Ongoing events and upcoming events'}</p></div>
        </div>
        <button onClick={onClose} aria-label="Close events" className="rounded-xl bg-slate-800 p-2 text-slate-300 hover:bg-rose-700 hover:text-white"><X className="h-5 w-5" /></button>
      </header>

      {view === 'ongoing' || view === 'upcoming' ? <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-700 bg-slate-950 p-1.5">
          <button onClick={() => setView('ongoing')} className={`rounded-xl px-3 py-2 text-xs font-black ${view === 'ongoing' ? 'bg-gradient-to-r from-cyan-300 to-sky-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>ONGOING EVENTS</button>
          <button onClick={() => setView('upcoming')} className={`rounded-xl px-3 py-2 text-xs font-black ${view === 'upcoming' ? 'bg-gradient-to-r from-cyan-300 to-sky-400 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>UPCOMING EVENTS</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === 'ongoing' ? <div className="grid gap-4 md:grid-cols-2">
            <article className="overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-br from-rose-950 via-slate-900 to-amber-950 shadow-lg">
              <div className="flex items-center gap-4 p-4 sm:p-5">
                <img src={dailyRewardsBanner} alt="Daily Rewards" className="h-24 w-32 rounded-xl border border-amber-300/30 bg-black/30 object-contain p-1" />
                <div className="min-w-0 flex-1"><span className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-1 text-[9px] font-black uppercase text-emerald-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />Ongoing</span><h3 className="font-game text-base font-black text-amber-100 sm:text-lg">Daily Login Rewards</h3><p className="mt-1 text-xs text-slate-300">Claim a reward each day in this 7-day cycle.</p></div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-4 py-3"><span className="text-xs text-cyan-100">Day {progress.day} of 7{progress.canClaimToday ? ' · ready to claim' : ' · claimed today'}</span><button onClick={() => { setNotice(''); setView('rewards'); }} className="rounded-xl bg-gradient-to-r from-amber-300 to-yellow-400 px-4 py-2 text-xs font-black text-slate-950 shadow hover:brightness-110">VIEW REWARDS</button></div>
            </article>
          </div> : <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center"><CalendarDays className="mb-3 h-10 w-10 text-slate-600" /><h3 className="font-game text-base font-black text-slate-300">No upcoming events announced</h3><p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500">New events will appear here when they are scheduled.</p></div>}
        </div>
      </div> : null}

      {view === 'rewards' ? <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {notice && <div role="status" className="mx-auto mb-2 max-w-3xl rounded-xl border border-cyan-300/30 bg-cyan-950/80 px-4 py-2 text-center text-xs text-cyan-100">{notice}</div>}
        <div className="mx-auto w-full max-w-[760px]">
          <div className="relative mx-auto w-full overflow-hidden" style={{ aspectRatio: '4 / 3' }}>
            <img src={dailyRewardsBanner} alt="Interactive seven-day Daily Rewards board" draggable={false} className="absolute inset-0 h-full w-full select-none object-fill" />
            {DAILY_REWARDS.map(entry => {
              const claimed = progress.claimedDays.includes(entry.day);
              const canReceiveCards = entry.day !== 3 || ownedStarmons.length > 0;
              const available = (progress.allRewardsUnlocked || entry.day === progress.day)
                && !claimed
                && progress.canClaimToday
                && canReceiveCards;
              const locked = !claimed && !available;
              const image = entry.day === 7 ? (claimed ? chestOpened : chestClosed) : entry.image;
              const slot = BOARD_SLOTS[entry.day];
              const slotStyle: React.CSSProperties = { left: slot.left, top: slot.top, width: slot.width, height: slot.height };
              return <button
                key={entry.day}
                type="button"
                onClick={() => available && claimDay(entry.day)}
                disabled={!available}
                aria-label={`Day ${entry.day}: ${entry.title}, ${claimed ? 'claimed' : available ? 'claim now' : 'locked'}`}
                title={entry.day === 3 && ownedStarmons.length === 0 && entry.day === progress.day ? 'Unlock a Starmon to claim these cards' : `${entry.title} · ${entry.detail}`}
                className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[14%] outline-none transition ${entry.day === 7 ? 'border border-amber-300/60 bg-black/20' : ''} ${available ? 'cursor-pointer ring-2 ring-amber-300/90 shadow-[0_0_14px_rgba(251,191,36,.8)] hover:scale-105 hover:ring-white focus-visible:ring-4' : locked ? 'cursor-default' : 'cursor-default ring-1 ring-emerald-300/70'}`}
                style={slotStyle}
              >
                <span className={`absolute inset-0 flex flex-col items-center justify-center ${locked ? 'bg-black/35' : claimed ? 'bg-emerald-950/20' : 'bg-amber-950/15'}`}>
                  <img src={image} alt="" draggable={false} style={{ height: entry.day === 7 ? '67.2%' : '64%', width: entry.day === 7 ? '105%' : '74%' }} className={`absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow ${locked ? 'opacity-40 grayscale-[30%]' : ''}`} />
                  {claimed ? <span className="absolute bottom-[8%] flex items-center gap-[2px] rounded-full bg-emerald-950/95 px-[5%] py-[1%] text-[clamp(5px,0.75vw,9px)] font-black leading-none text-emerald-200"><CheckCircle2 className="h-[1em] w-[1em]" />CLAIMED</span>
                    : locked ? <><img src={lockedIcon} alt="" draggable={false} className="absolute left-1/2 top-[16%] h-[52%] w-[52%] max-w-none -translate-x-1/2 scale-[2.5] object-contain drop-shadow-lg" /><span className="absolute bottom-[8%] rounded-full bg-black/90 px-[7%] py-[1%] text-[clamp(5px,0.75vw,9px)] font-black leading-none text-slate-200">LOCKED</span></>
                    : <img src={claimButton} alt="Claim now" draggable={false} className="absolute bottom-[8%] h-[31%] w-[86%] object-contain drop-shadow-md" />}
                </span>
              </button>;
            })}
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-[10px] text-slate-300 sm:text-xs">
            <span>{progress.allRewardsUnlocked ? 'All unclaimed rewards are available' : `Day ${progress.day} of 7${progress.canClaimToday ? ' · ready to claim' : ' · claimed today'}`}</span>
            <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{progress.allRewardsUnlocked ? 'Claim each unlocked reward once' : 'Next reward unlocks tomorrow'}</span>
          </div>
          {progress.day === 3 && progress.canClaimToday && ownedStarmons.length === 0 && <p className="mt-1 text-center text-[10px] text-amber-200">Unlock at least one Starmon to receive Day 3 cards.</p>}
        </div>
        <p className="mt-2 text-center text-[9px] text-slate-500">A new 7-day cycle starts after Day 7.</p>
      </div> : null}

      {view === 'spin' ? <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,.18),transparent_55%)] p-4 sm:p-6">
        {notice && <div role="status" className="mx-auto mb-3 max-w-3xl rounded-xl border border-rose-300/30 bg-rose-950/80 px-4 py-2 text-center text-xs text-rose-100">{notice}</div>}
        <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[1fr_290px] lg:items-center">
          <div className="relative flex flex-col items-center overflow-hidden rounded-3xl border border-amber-200/30 bg-gradient-to-b from-indigo-950/90 via-slate-950/90 to-amber-950/30 p-4 shadow-[0_18px_60px_rgba(2,6,23,.55)] sm:p-6">
            <div className="pointer-events-none absolute -left-12 -top-16 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-10 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="relative z-10 mb-1 flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-300/10 px-3 py-1 text-[9px] font-black tracking-[.22em] text-amber-100 shadow-lg sm:text-[10px]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" /> DAY 7 · MYSTERY CHEST
            </div>
            <p className="relative z-10 mb-1 text-center text-[11px] text-slate-300 sm:text-xs">One spin, one surprise. What will you win?</p>
            <div className="relative z-10 my-3 aspect-square w-full max-w-[22rem] drop-shadow-[0_12px_28px_rgba(251,191,36,.22)]">
              <img src={day7GachaWheel} alt="Day 7 prize wheel" draggable={false} className="h-full w-full select-none object-contain" style={{ transform: `rotate(${wheelRotation}deg)`, transition: isSpinning ? 'transform 5s cubic-bezier(.08,.78,.12,1)' : 'none' }} />
              <button onClick={spin} disabled={isSpinning || Boolean(wonReward)} aria-label={isSpinning ? 'Wheel spinning' : 'Spin for Day 7 reward'} className="absolute left-1/2 top-1/2 flex h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-emerald-200/80 bg-emerald-900/35 font-game text-[11px] font-black tracking-wider text-white shadow-[inset_0_0_14px_rgba(16,185,129,.8),0_2px_10px_rgba(0,0,0,.6)] transition hover:bg-emerald-700/55 hover:shadow-[inset_0_0_18px_rgba(16,185,129,1),0_0_16px_rgba(16,185,129,.8)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-90 sm:text-sm">{isSpinning ? '…' : 'SPIN'}</button>
            </div>
            <p className="relative z-10 mt-2 text-center text-[11px] text-slate-300 sm:text-xs">{isSpinning ? 'Good luck! Your reward is on its way…' : 'Tap the golden button to spin the wheel.'}</p>
            {wheelReward && isSpinning && <p className="sr-only">Spinning for {rewardMessage(wheelReward)}</p>}
          </div>
          <aside className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/95 to-indigo-950/90 p-4 shadow-xl sm:p-5">
            <div className="mb-3 flex items-center justify-between"><div><p className="text-[9px] font-black tracking-[.2em] text-cyan-300">YOUR CHANCES</p><h3 className="font-game text-sm font-black text-amber-100">PRIZE ODDS</h3></div><span className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[9px] font-bold text-amber-200">100% TOTAL</span></div>
            <ul className="space-y-1.5 text-[10px] text-slate-200">{[
              ['Starmon Pack · one of 6 elements', '1% each', '#fb923c'], ['70 Gems', '14%', '#38bdf8'], ['1 Golden Anvil', '5%', '#a78bfa'], ['1 Common Item Pack', '5%', '#a16207'], ['20 Star Shards', '10%', '#f472b6'], ['10 Omni-Starmon Cards', '10%', '#818cf8'], ['50 Gems', '35%', '#0ea5e9'], ['1,000 Gold', '15%', '#facc15'],
            ].map(([prize, chance, color]) => <li key={prize} className="flex items-center justify-between gap-2 rounded-xl border border-white/[.06] bg-white/[.035] px-2.5 py-2"><span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10" style={{ backgroundColor: color }} /><span className="leading-tight">{prize}</span></span><b className="shrink-0 rounded-md bg-cyan-300/10 px-1.5 py-1 text-cyan-200">{chance}</b></li>)}</ul>
            <p className="mt-3 rounded-xl border border-white/5 bg-black/20 p-2.5 text-[9px] leading-relaxed text-slate-400">Each of the six elemental packs has a 1% chance. Every spin awards one prize.</p>
          </aside>
        </div>
        {wonReward && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="day7-reward-title">
          <div className="w-full max-w-sm rounded-3xl border-2 border-amber-300/80 bg-gradient-to-b from-indigo-950 via-slate-950 to-amber-950/80 p-6 text-center shadow-[0_0_60px_rgba(251,191,36,.3)] animate-in zoom-in-95 duration-300">
            <img src={chestOpened} alt="Opened mystery chest" className="mx-auto h-28 w-40 object-contain drop-shadow-[0_8px_18px_rgba(251,191,36,.35)]" />
            <p className="mt-1 text-[10px] font-black tracking-[.25em] text-amber-300">DAY 7 GRAND PRIZE</p>
            <h3 id="day7-reward-title" className="mt-2 font-game text-xl font-black text-amber-100">{spinMessage || rewardMessage(wonReward)}</h3>
            <div className="mx-auto mt-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-amber-200/40 bg-amber-300/10 p-3 shadow-inner"><img src={rewardIcon(wonReward)} alt={rewardMessage(wonReward)} className="h-full w-full object-contain" /></div>
            <button onClick={() => { setView('rewards'); setNotice(''); }} className="mt-6 rounded-xl bg-gradient-to-r from-cyan-300 to-sky-400 px-8 py-3 text-xs font-black text-slate-950 shadow-lg transition hover:brightness-110">CLAIMED · CONTINUE</button>
          </div>
        </div>}
      </div> : null}
    </section>
  </div>;
};
