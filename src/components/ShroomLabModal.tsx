import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock3, Info, Lock, Sparkles, X, Zap } from 'lucide-react';
import { ElementType, PlayerProfile } from '../types';
import { getResearchLevel, getResearchProgress, isResearchNodeUnlocked, RESEARCH_NODES, ResearchNode, ResearchNodeId, TECH_BRANCH_IMAGES } from '../data/techResearch';
import { GEM_IMAGE, GOLD_IMAGE, ROYAL_TOKENS_IMAGE } from '../data/itemsData';

interface Props {
  player: PlayerProfile;
  onClose: () => void;
  onStartResearch: (element: ElementType, nodeId: ResearchNodeId) => void;
  onFastForwardResearch: (slot: number) => void;
  onCompleteResearch: (slot: number) => void;
}

const elements: ElementType[] = ['Fire', 'Water', 'Earth', 'Electric', 'Metal', 'Wind'];
const elementEmojis: Record<ElementType, string> = { Fire: '🔥', Water: '💧', Earth: '🪨', Electric: '⚡', Metal: '⚙️', Wind: '💨' };
const TILE_HEIGHT = 112;
const ROW_GAP = 42;
const COLUMN_X = [166.67, 500, 833.33];

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function nodeEffect(node: ResearchNode, element: ElementType) {
  if (node.stat === 'slot') return `Unlock Item Slot ${node.id === 'well_equipped_1' ? 2 : node.id === 'well_equipped_2' ? 3 : 4} for all ${element} Starmons`;
  return node.effect.replaceAll('Fire', element);
}

function pathBetween(fromX: number, fromY: number, toX: number, toY: number) {
  const bendY = fromY + (toY - fromY) / 2;
  return `M ${fromX} ${fromY} V ${bendY} H ${toX} V ${toY}`;
}

export const ShroomLabModal: React.FC<Props> = ({ player, onClose, onStartResearch, onFastForwardResearch, onCompleteResearch }) => {
  const [selectedElement, setSelectedElement] = useState<ElementType | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<ResearchNodeId | null>(null);
  const [now, setNow] = useState(Date.now());
  const levels = player.techResearchLevels;
  const jobs = player.researchJobs || [];
  const selectedProgress = selectedElement ? getResearchProgress(levels, selectedElement) : null;
  const rows = useMemo(() => Array.from({ length: 7 }, (_, row) => RESEARCH_NODES.filter(node => node.row === row)), []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    jobs.forEach(job => {
      if (job.completesAt <= now) onCompleteResearch(job.slot);
    });
  }, [jobs, now, onCompleteResearch]);

  const researchSlotJob = jobs.find(job => job.slot === 0);
  const selectedNode = RESEARCH_NODES.find(node => node.id === selectedNodeId) || null;
  const formatRequirement = (node: ResearchNode) => node.requirements.map(req => {
    const prerequisite = RESEARCH_NODES.find(candidate => candidate.id === req.node);
    return `${prerequisite?.name || req.node} ${req.level}`;
  }).join(' · ');

  const nodeX = (row: number, col: number) => row === 1 ? (col === 0 ? 333.33 : 666.67) : COLUMN_X[col];
  const rowY = (row: number) => row * (TILE_HEIGHT + ROW_GAP);
  const chartHeight = 7 * TILE_HEIGHT + 6 * ROW_GAP;
  const links = [
    pathBetween(nodeX(0, 0), rowY(0) + TILE_HEIGHT, nodeX(1, 0), rowY(1)),
    pathBetween(nodeX(0, 2), rowY(0) + TILE_HEIGHT, nodeX(1, 2), rowY(1)),
    pathBetween(nodeX(0, 1), rowY(0) + TILE_HEIGHT, nodeX(2, 1), rowY(2)),
    pathBetween(nodeX(1, 0), rowY(1) + TILE_HEIGHT, nodeX(2, 1), rowY(2)),
    pathBetween(nodeX(1, 2), rowY(1) + TILE_HEIGHT, nodeX(2, 1), rowY(2)),
    ...[0, 1, 2].map(col => pathBetween(nodeX(2, 1), rowY(2) + TILE_HEIGHT, nodeX(3, col), rowY(3))),
    ...[0, 1, 2].map(col => pathBetween(nodeX(3, col), rowY(3) + TILE_HEIGHT, nodeX(4, 1), rowY(4))),
    ...[0, 1, 2].map(col => pathBetween(nodeX(4, 1), rowY(4) + TILE_HEIGHT, nodeX(5, col), rowY(5))),
    ...[0, 1, 2].map(col => pathBetween(nodeX(5, col), rowY(5) + TILE_HEIGHT, nodeX(6, 1), rowY(6))),
  ];

  const renderNode = (node: ResearchNode, row: number) => {
    if (!selectedElement) return null;
    const level = getResearchLevel(levels, selectedElement, node.id);
    const unlocked = isResearchNodeUnlocked(levels, selectedElement, node);
    const complete = level >= node.maxLevel;
    const job = jobs.find(entry => entry.element === selectedElement && entry.nodeId === node.id);
    const progressText = complete ? 'MAX' : `${level}/${node.maxLevel}`;
    const left = `${(nodeX(row, node.col) / 10).toFixed(3)}%`;
    return <button
      type="button"
      key={node.id}
      onClick={() => setSelectedNodeId(node.id)}
      aria-label={`View ${node.name} research details`}
      title={`${node.name} · ${progressText}${job ? ` · ${formatTime(job.completesAt - now)} remaining` : ''}`}
      className="group absolute z-10 flex h-[112px] w-[138px] -translate-x-1/2 flex-col items-center justify-center transition duration-200 hover:-translate-y-1 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200"
      style={{ left, top: rowY(row) }}
    >
      <span className={`absolute inset-0 rounded-[24px] border-[5px] shadow-[0_5px_0_rgba(40,20,8,.85),0_10px_16px_rgba(15,23,42,.3)] [clip-path:polygon(14%_0,86%_0,100%_25%,100%_77%,86%_100%,14%_100%,0_77%,0_25%)] ${complete ? 'border-[#592d12] bg-[#d49a51]' : unlocked ? 'border-[#49260f] bg-[#c7823e]' : 'border-[#39241b] bg-[#956543]'}`} />
      <span className="absolute inset-[7px] rounded-[18px] border border-[#f3c277]/60 bg-[repeating-linear-gradient(0deg,rgba(73,37,14,.22)_0px,rgba(73,37,14,.22)_2px,transparent_2px,transparent_11px),linear-gradient(145deg,#dca65e,#a96531_55%,#8a4d27)] [clip-path:polygon(13%_0,87%_0,100%_25%,100%_75%,87%_100%,13%_100%,0_75%,0_25%)]" />
      <span className="pointer-events-none absolute inset-x-[18px] top-3 h-px bg-[#f7d18c]/70" />
      <img src={node.image} alt="" className={`absolute inset-0 z-10 m-auto h-[110px] w-[110px] object-contain drop-shadow-[0_2px_2px_rgba(40,20,8,.7)] transition-transform group-hover:scale-110 ${unlocked ? '' : 'saturate-75'}`} />
      <span className="absolute bottom-[13px] z-20 rounded border border-[#643812]/70 bg-[#552d15]/90 px-2 py-0.5 font-mono text-[9px] font-black leading-none text-amber-50 shadow-sm">{job ? formatTime(job.completesAt - now) : progressText}</span>
      {!unlocked && <span className="absolute right-[18px] top-[15px] z-20 rounded-full border border-[#f4cf91]/70 bg-[#412414] p-1 text-amber-100 shadow"><Lock className="h-3 w-3" /></span>}
      {job && <span className="absolute bottom-1 left-1/2 h-1 w-12 -translate-x-1/2 overflow-hidden rounded-full bg-black/50"><span className="block h-full animate-pulse bg-cyan-300" /></span>}
    </button>;
  };

  return <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/90 p-2 backdrop-blur-md sm:p-5">
    <section className="relative flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border-2 border-amber-400/80 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-800 text-white shadow-2xl">
      <header className="z-10 flex shrink-0 items-center justify-between gap-2 border-b border-white/20 bg-slate-950/90 px-3 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {selectedElement && <button onClick={() => { setSelectedNodeId(null); setSelectedElement(null); }} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>}
          <div className="min-w-0"><h1 className="font-game text-base font-black tracking-widest text-amber-300 sm:text-2xl">{selectedElement ? `${selectedElement.toUpperCase()} TECH` : 'SHROOMLAB'}</h1><p className="text-[10px] text-sky-100 sm:text-xs">{selectedElement ? 'Elemental Research Tree' : 'Choose a research branch'}</p></div>
          <button title="Research benefits apply to the matching element only. Stat percentages use Starmon base stats at its current level." className="rounded-full bg-white/15 p-1.5"><Info className="h-4 w-4" /></button>
        </div>
        <div className="hidden items-center gap-2 text-[10px] font-bold sm:flex sm:gap-4 sm:text-xs">
          <span className="rounded-lg bg-black/40 px-2 py-1 text-yellow-200"><Zap className="mr-1 inline h-3 w-3" />{player.energy}</span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-amber-200"><img src={GOLD_IMAGE} alt="Gold" className="h-4 w-4 object-contain" />{player.gold.toLocaleString()} G</span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-cyan-200"><img src={ROYAL_TOKENS_IMAGE} alt="Royal Tokens" className="h-4 w-4 object-contain" />{(player.royalTokens || 0).toLocaleString()} RT</span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 text-fuchsia-200"><img src={GEM_IMAGE} alt="Gems" className="h-4 w-4 object-contain" />{player.gems}</span>
        </div>
        <button onClick={onClose} className="rounded-xl bg-slate-800 p-2 hover:bg-rose-700" aria-label="Close"><X className="h-5 w-5" /></button>
      </header>

      {!selectedElement ? <div className="overflow-y-auto p-4 sm:p-6">
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {[0, 1].map(slot => {
            const job = jobs.find(entry => entry.slot === slot);
            return <div key={slot} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${slot === 0 ? 'border-amber-300/60 bg-slate-950/75' : 'border-slate-500 bg-slate-900/60 opacity-70'}`}>
              {job ? <><img src={TECH_BRANCH_IMAGES[job.element]} alt="" className="h-9 w-9 rounded object-cover" /><div className="min-w-0"><b className="block text-[10px]">{job.element} · {RESEARCH_NODES.find(node => node.id === job.nodeId)?.name}</b><span className="font-mono text-[10px] text-cyan-200">{formatTime(job.completesAt - now)}</span></div>{slot === 0 && <button onClick={() => onFastForwardResearch(slot)} disabled={player.gems < Math.ceil(Math.max(0, job.completesAt - now) / 60000)} title={`Fast-forward · ${Math.ceil(Math.max(0, job.completesAt - now) / 60000)} Gems`} className="ml-auto rounded-lg bg-emerald-500/20 p-2 text-emerald-200 disabled:opacity-30"><Sparkles className="h-4 w-4" /></button>}</> : <span className="text-xs font-bold text-slate-300">{slot === 0 ? 'Research Queue 1 · Idle' : 'Research Queue 2 · Locked'}</span>}
            </div>;
          })}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
          {elements.map(element => {
            const progress = getResearchProgress(levels, element);
            return <button key={element} onClick={() => { setSelectedNodeId(null); setSelectedElement(element); }} className="group overflow-hidden rounded-2xl border-2 border-white/50 bg-white/90 text-left text-slate-950 shadow-xl transition hover:-translate-y-1 hover:border-amber-300">
              <div className="relative flex aspect-[1.35] items-center justify-center overflow-hidden bg-sky-200 p-3"><img src={TECH_BRANCH_IMAGES[element]} alt={`${element} Tech`} className="h-[82%] w-[82%] object-contain transition group-hover:scale-105" /><span className="absolute left-2 top-2 rounded-lg bg-slate-950/80 px-2 py-1 text-xs font-black text-white">{elementEmojis[element]} {element} Tech</span></div>
              <div className="flex items-center justify-between gap-2 p-3"><span className="text-xs font-black">{progress.percent}% · {progress.completed}/{progress.total}</span><span className={progress.percent === 100 ? 'text-amber-500' : 'text-slate-400'}>{progress.percent === 100 ? '★' : '☆'}</span></div>
              <div className="mx-3 mb-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-gradient-to-r from-sky-500 to-emerald-400" style={{ width: `${progress.percent}%` }} /></div>
            </button>;
          })}
        </div>
        <p className="mt-4 text-center text-[10px] text-white/70">Each branch has {getResearchProgress(levels, 'Fire').total} upgrade levels in total. Research progress is counted per element.</p>
      </div> : <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5" style={{ backgroundColor: '#62b8dc', backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px),radial-gradient(ellipse 100px 34px at 8% 14%,rgba(255,255,255,.42) 0 56%,transparent 60%),radial-gradient(ellipse 130px 42px at 89% 28%,rgba(255,255,255,.35) 0 56%,transparent 60%),radial-gradient(ellipse 115px 38px at 16% 72%,rgba(255,255,255,.32) 0 56%,transparent 60%),radial-gradient(ellipse 140px 45px at 86% 88%,rgba(255,255,255,.4) 0 56%,transparent 60%)', backgroundSize: '60px 60px,60px 60px,auto,auto,auto,auto' }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/30 bg-slate-950/75 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-2"><img src={TECH_BRANCH_IMAGES[selectedElement]} alt="" className="h-9 w-12 rounded object-cover" /><b className="font-game text-xs sm:text-sm">{selectedElement} Tech Research</b></div>
          <span className="rounded-lg bg-black/35 px-2 py-1 text-[10px] font-black text-amber-200 sm:px-3 sm:text-xs">{selectedProgress?.percent}% · {selectedProgress?.completed}/{selectedProgress?.total}</span>
          {researchSlotJob ? <span className="flex items-center gap-1 text-[10px] text-cyan-200 sm:gap-2 sm:text-xs"><Clock3 className="h-4 w-4" />{formatTime(researchSlotJob.completesAt - now)} · Queue 1</span> : <span className="text-[10px] text-slate-300 sm:text-xs">Queue 1 · Idle</span>}
        </div>
        <div className="overflow-x-auto rounded-[26px] border-[3px] border-[#4a2a17] bg-sky-500/10 px-2 py-3 shadow-[inset_0_0_24px_rgba(255,255,255,.12)] sm:px-5">
          <div className="relative mx-auto min-w-[720px] max-w-[960px]" style={{ height: chartHeight }}>
            <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" viewBox={`0 0 1000 ${chartHeight}`} preserveAspectRatio="none" aria-hidden="true">
              <defs><filter id="tech-link-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
              {links.map((path, index) => <g key={index} fill="none" strokeLinecap="round" strokeLinejoin="round"><path d={path} stroke="#344f5b" strokeWidth="14" opacity=".9" /><path d={path} stroke="#73909a" strokeWidth="6" filter="url(#tech-link-glow)" /></g>)}
            </svg>
            {rows.map((row, index) => <React.Fragment key={index}>
              {row.map(node => renderNode(node, index))}
            </React.Fragment>)}
            <div className="pointer-events-none absolute bottom-0 left-1/2 z-0 h-14 w-14 -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(255,255,255,.34),transparent_72%)]" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-center text-[10px] text-white/80"><Info className="h-3 w-3 shrink-0" />Click any node to view its effect, requirements, cost, and research time. Bonuses apply to {selectedElement} Starmons.</div>
      </div>}
    </section>
    {selectedElement && selectedNode && (() => {
      const level = getResearchLevel(levels, selectedElement, selectedNode.id);
      const unlocked = isResearchNodeUnlocked(levels, selectedElement, selectedNode);
      const nodeJob = jobs.find(job => job.element === selectedElement && job.nodeId === selectedNode.id);
      const gemCost = nodeJob ? Math.ceil(Math.max(0, nodeJob.completesAt - now) / 60000) : 0;
      const canAfford = player.energy >= selectedNode.cost.energy
        && player.gold >= selectedNode.cost.gold
        && (player.royalTokens || 0) >= (selectedNode.cost.royalTokens || 0);
      return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedNodeId(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="research-node-title" className="w-full max-w-lg rounded-2xl border-2 border-amber-300/80 bg-gradient-to-br from-slate-950 to-slate-900 p-5 text-white shadow-2xl sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3"><img src={selectedNode.image} alt="" className={`h-14 w-14 rounded-xl border border-amber-200/30 bg-amber-950/50 p-1 object-contain ${unlocked ? '' : 'saturate-75'}`} /><div><h2 id="research-node-title" className="font-game text-lg font-black text-amber-200">{selectedNode.name}</h2><p className="text-xs text-slate-300">{selectedElement} Tech · Level {level}/{selectedNode.maxLevel}</p></div></div>
            <button onClick={() => setSelectedNodeId(null)} aria-label="Close details" className="rounded-lg bg-slate-800 p-2 hover:bg-rose-700"><X className="h-4 w-4" /></button>
          </div>
          <p className="mb-4 rounded-xl bg-sky-950/60 p-3 text-sm text-sky-100">{nodeEffect(selectedNode, selectedElement)}</p>
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
            <div><b className="text-amber-200">Requirements</b>{selectedNode.requirements.length ? <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-200">{selectedNode.requirements.map(req => { const prerequisite = RESEARCH_NODES.find(node => node.id === req.node); const current = getResearchLevel(levels, selectedElement, req.node); return <li key={req.node}>{prerequisite?.name || req.node}: {current}/{req.level}</li>; })}</ul> : <p className="mt-1 text-slate-300">None</p>}</div>
            <div><b className="text-amber-200">Cost per upgrade</b><p className="mt-1 flex flex-wrap items-center gap-1.5 text-slate-200"><Zap className="h-4 w-4 text-yellow-300" />{selectedNode.cost.energy}<img src={GOLD_IMAGE} alt="Gold" className="h-4 w-4 object-contain" />{selectedNode.cost.gold.toLocaleString()}{selectedNode.cost.royalTokens ? <><img src={ROYAL_TOKENS_IMAGE} alt="Royal Tokens" className="h-4 w-4 object-contain" />{selectedNode.cost.royalTokens}</> : null}</p></div>
            <div><b className="text-amber-200">Research time</b><p className="mt-1 flex items-center gap-2 text-slate-200"><Clock3 className="h-4 w-4 text-cyan-300" />{nodeJob ? formatTime(nodeJob.completesAt - now) : `${selectedNode.cost.hours} hours`}{nodeJob && ' remaining'}</p></div>
          </div>
          {nodeJob ? <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-cyan-950/60 p-3"><span className="text-xs text-cyan-100">Reduce remaining time to zero</span><button onClick={() => onFastForwardResearch(nodeJob.slot)} disabled={player.gems < gemCost} title={`Complete now · ${gemCost} Gems`} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-400 px-3 py-2 font-game text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"><ArrowRight className="h-4 w-4" /><img src={GEM_IMAGE} alt="Gems" className="h-4 w-4 object-contain" />{gemCost}</button></div> : <button onClick={() => { if (selectedElement) onStartResearch(selectedElement, selectedNode.id); setSelectedNodeId(null); }} disabled={!unlocked || level >= selectedNode.maxLevel || !!researchSlotJob || !canAfford} className="mt-4 w-full rounded-xl border border-amber-200/70 bg-gradient-to-r from-amber-400 to-yellow-300 px-4 py-3 font-game text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{!unlocked ? 'REQUIREMENTS NOT MET' : level >= selectedNode.maxLevel ? 'MAX LEVEL' : researchSlotJob ? 'QUEUE BUSY' : !canAfford ? 'NOT ENOUGH RESOURCES' : 'START RESEARCH'}</button>}
        </section>
      </div>;
    })()}
  </div>;
};
