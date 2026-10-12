import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock3, Gem, Info, Lock, Sparkles, X, Zap } from 'lucide-react';
import { ElementType, PlayerProfile, ResearchJob } from '../types';
import { getResearchLevel, getResearchProgress, isResearchNodeUnlocked, RESEARCH_NODES, ResearchNode, ResearchNodeId, TECH_BRANCH_IMAGES, TECH_NODE_IMAGES } from '../data/techResearch';

interface Props {
  player: PlayerProfile;
  onClose: () => void;
  onStartResearch: (element: ElementType, nodeId: ResearchNodeId) => void;
  onFastForwardResearch: (slot: number) => void;
  onCompleteResearch: (slot: number) => void;
}

const elements: ElementType[] = ['Fire', 'Water', 'Earth', 'Electric', 'Metal', 'Wind'];
const elementEmojis: Record<ElementType, string> = { Fire: '🔥', Water: '💧', Earth: '🪨', Electric: '⚡', Metal: '⚙️', Wind: '💨' };
const NODE_HEIGHT = 250;
const CONNECTOR_HEIGHT = 24;

function formatTime(ms: number) {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;
}

function nodeEffect(node: ResearchNode, element: ElementType) {
  if (node.stat === 'slot') return `Unlock Item Slot ${node.id === 'well_equipped_1' ? 2 : node.id === 'well_equipped_2' ? 3 : 4} for all ${element} Starmons`;
  return node.effect.replaceAll('Fire', element);
}

export const ShroomLabModal: React.FC<Props> = ({ player, onClose, onStartResearch, onFastForwardResearch, onCompleteResearch }) => {
  const [selectedElement, setSelectedElement] = useState<ElementType | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<ResearchNodeId | null>(null);
  const [now, setNow] = useState(Date.now());
  const levels = player.techResearchLevels;
  const jobs = player.researchJobs || [];
  const selectedProgress = selectedElement ? getResearchProgress(levels, selectedElement) : null;

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

  const renderNode = (node: ResearchNode) => {
    if (!selectedElement) return null;
    const level = getResearchLevel(levels, selectedElement, node.id);
    const unlocked = isResearchNodeUnlocked(levels, selectedElement, node);
    const job = jobs.find(entry => entry.element === selectedElement && entry.nodeId === node.id);
    const label = level >= node.maxLevel ? 'MAX' : `${level}/${node.maxLevel}`;
    return <button type="button" key={node.id} onClick={() => setSelectedNodeId(node.id)} aria-label={`View ${node.name} research details`} className={`relative flex h-[250px] w-full max-w-[290px] flex-col items-center rounded-2xl border-2 p-3 text-center shadow-lg transition hover:border-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${level >= node.maxLevel ? 'border-amber-300 bg-amber-950/70' : unlocked ? 'border-sky-300/70 bg-slate-950/85' : 'border-slate-700 bg-slate-900/80 opacity-70'}`}>
      {!unlocked && <Lock className="absolute right-2 top-2 h-4 w-4 text-slate-400" />}
      <img src={unlocked ? node.image : TECH_NODE_IMAGES.locked} alt="" className="h-14 w-14 shrink-0 object-contain drop-shadow" />
      <h3 className="mt-1 flex h-8 w-full shrink-0 items-center justify-center font-game text-xs font-black leading-tight text-white">{node.name}</h3>
      <div className="mt-1 inline-flex h-6 shrink-0 items-center rounded-md border border-amber-300/50 bg-black/50 px-2 font-mono text-[10px] font-bold text-amber-200">{label}</div>
      <p className="mt-1 flex h-8 w-full shrink-0 items-center justify-center overflow-hidden px-1 text-[10px] leading-snug text-sky-100">{nodeEffect(node, selectedElement)}</p>
      <p className="flex h-6 w-full shrink-0 items-center justify-center overflow-hidden text-[9px] leading-tight text-slate-400">{node.requirements.length > 0 ? `Requires: ${formatRequirement(node)}` : ''}</p>
      {job ? <div className="mt-auto flex h-9 w-full shrink-0 items-center justify-center gap-1 rounded-lg bg-cyan-950/80 px-2 text-xs font-mono text-cyan-200"><Clock3 className="h-3.5 w-3.5" />{formatTime(job.completesAt - now)}</div> : <p className="mt-auto flex h-9 w-full shrink-0 items-center justify-center rounded-lg bg-black/30 text-[10px] font-bold text-slate-200">{level >= node.maxLevel ? 'MAX LEVEL' : unlocked ? 'VIEW RESEARCH' : 'VIEW REQUIREMENTS'}</p>}
    </button>;
  };

  const rows = useMemo(() => Array.from({ length: 7 }, (_, row) => RESEARCH_NODES.filter(node => node.row === row)), []);
  const chartHeight = 7 * NODE_HEIGHT + 6 * CONNECTOR_HEIGHT;
  const rowBottom = (row: number) => row * (NODE_HEIGHT + CONNECTOR_HEIGHT) + NODE_HEIGHT;
  const rowTop = (row: number) => row * (NODE_HEIGHT + CONNECTOR_HEIGHT);
  const connect = (fromX: number, fromY: number, toX: number, toY: number) => `M ${fromX} ${fromY} C ${fromX} ${fromY + CONNECTOR_HEIGHT * 0.55}, ${toX} ${toY - CONNECTOR_HEIGHT * 0.55}, ${toX} ${toY}`;
  const links = [
    connect(166.67, rowBottom(0), 166.67, rowTop(1)),
    connect(833.33, rowBottom(0), 833.33, rowTop(1)),
    connect(500, rowBottom(0), 500, rowTop(2)),
    connect(166.67, rowBottom(1), 500, rowTop(2)),
    connect(833.33, rowBottom(1), 500, rowTop(2)),
    ...[166.67, 500, 833.33].map(x => connect(500, rowBottom(2), x, rowTop(3))),
    ...[166.67, 500, 833.33].map(x => connect(x, rowBottom(3), 500, rowTop(4))),
    ...[166.67, 500, 833.33].map(x => connect(500, rowBottom(4), x, rowTop(5))),
    ...[166.67, 500, 833.33].map(x => connect(x, rowBottom(5), 500, rowTop(6))),
  ];

  return <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/90 p-2 backdrop-blur-md sm:p-5">
    <section className="relative flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border-2 border-amber-400/80 bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-800 text-white shadow-2xl">
      <header className="z-10 flex shrink-0 items-center justify-between border-b border-white/20 bg-slate-950/90 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          {selectedElement && <button onClick={() => { setSelectedNodeId(null); setSelectedElement(null); }} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>}
          <div><h1 className="font-game text-lg font-black tracking-widest text-amber-300 sm:text-2xl">{selectedElement ? `${selectedElement.toUpperCase()} TECH` : 'SHROOMLAB'}</h1><p className="text-[10px] text-sky-100 sm:text-xs">{selectedElement ? 'Elemental Research Tree' : 'Choose a research branch'}</p></div>
          <button title="Research benefits apply to the matching element only. Stat percentages use Starmon base stats at its current level." className="rounded-full bg-white/15 p-1.5"><Info className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold sm:gap-4 sm:text-xs">
          <span className="rounded-lg bg-black/40 px-2 py-1 text-yellow-200"><Zap className="mr-1 inline h-3 w-3" />{player.energy}</span>
          <span className="rounded-lg bg-black/40 px-2 py-1 text-amber-200">{player.gold.toLocaleString()} G</span>
          <span className="rounded-lg bg-black/40 px-2 py-1 text-cyan-200">{(player.royalTokens || 0).toLocaleString()} RT</span>
          <span className="rounded-lg bg-black/40 px-2 py-1 text-fuchsia-200"><Gem className="mr-1 inline h-3 w-3" />{player.gems}</span>
        </div>
        <button onClick={onClose} className="ml-2 rounded-xl bg-slate-800 p-2 hover:bg-rose-700" aria-label="Close"><X className="h-5 w-5" /></button>
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
      </div> : <div className="flex-1 overflow-y-auto p-3 sm:p-5" style={{ backgroundColor: '#4A90E2', backgroundImage: 'radial-gradient(ellipse 100px 34px at 8% 14%, rgba(255,255,255,.42) 0 56%, transparent 60%), radial-gradient(ellipse 130px 42px at 89% 28%, rgba(255,255,255,.35) 0 56%, transparent 60%), radial-gradient(ellipse 115px 38px at 16% 72%, rgba(255,255,255,.32) 0 56%, transparent 60%), radial-gradient(ellipse 140px 45px at 86% 88%, rgba(255,255,255,.4) 0 56%, transparent 60%)' }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/30 bg-slate-950/75 px-4 py-2">
          <div className="flex items-center gap-2"><img src={TECH_BRANCH_IMAGES[selectedElement]} alt="" className="h-10 w-14 rounded object-cover" /><b className="font-game">{selectedElement} Tech Research</b></div>
          <span className="rounded-lg bg-black/35 px-3 py-1 text-xs font-black text-amber-200">{selectedProgress?.percent}% Complete · {selectedProgress?.completed}/{selectedProgress?.total}</span>
          {researchSlotJob ? <span className="flex items-center gap-2 text-xs text-cyan-200"><Clock3 className="h-4 w-4" />{formatTime(researchSlotJob.completesAt - now)} · Queue 1 active</span> : <span className="text-xs text-slate-300">Queue 1 · Idle</span>}
        </div>
        <div className="mx-auto w-full max-w-5xl rounded-[28px] border-[3px] border-amber-950/90 bg-slate-950/35 p-2 shadow-[0_12px_36px_rgba(15,23,42,.35)] sm:p-4">
          <div className="relative mx-auto max-w-5xl">
            <svg className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full overflow-visible lg:block" viewBox={`0 0 1000 ${chartHeight}`} preserveAspectRatio="none" aria-hidden="true">
              <defs><filter id="tech-link-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
              {links.map((path, index) => <g key={index} fill="none" strokeLinecap="round" strokeLinejoin="round"><path d={path} stroke="#321c0c" strokeWidth="13" opacity=".8" /><path d={path} stroke="#ffbd38" strokeWidth="6" filter="url(#tech-link-glow)" /></g>)}
            </svg>
            <div className="relative z-10">
              {rows.map((row, index) => <React.Fragment key={index}>
                <div className="grid grid-cols-1 justify-items-center gap-1 lg:h-[250px] lg:grid-cols-3 lg:gap-3">
                  {row.map(node => <div key={node.id} className={node.col === 1 ? 'col-start-1 lg:col-start-2' : node.col === 2 ? 'col-start-1 lg:col-start-3' : 'col-start-1'}>{renderNode(node)}</div>)}
                </div>
                {index < rows.length - 1 && <div className="relative z-0 flex h-4 items-center justify-center lg:h-6"><div className="h-full w-1 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-orange-500 shadow-[0_0_12px_rgba(251,191,36,.95)] lg:hidden" /></div>}
              </React.Fragment>)}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/70"><Info className="h-3 w-3" />Research bonuses apply to {selectedElement} Starmons' level-based base stats before battle, excluding equipment and temporary buffs. CP is unchanged.</div>
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
        <section role="dialog" aria-modal="true" aria-labelledby="research-node-title" className="w-full max-w-lg rounded-2xl border-2 border-amber-300/80 bg-slate-950 p-5 text-white shadow-2xl sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3"><img src={unlocked ? selectedNode.image : TECH_NODE_IMAGES.locked} alt="" className="h-14 w-14 rounded-xl bg-slate-800 p-1 object-contain" /><div><h2 id="research-node-title" className="font-game text-lg font-black text-amber-200">{selectedNode.name}</h2><p className="text-xs text-slate-300">{selectedElement} Tech · {level}/{selectedNode.maxLevel}</p></div></div>
            <button onClick={() => setSelectedNodeId(null)} aria-label="Close details" className="rounded-lg bg-slate-800 p-2 hover:bg-rose-700"><X className="h-4 w-4" /></button>
          </div>
          <p className="mb-4 rounded-xl bg-sky-950/60 p-3 text-sm text-sky-100">{nodeEffect(selectedNode, selectedElement)}</p>
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
            <div><b className="text-amber-200">Requirements</b>{selectedNode.requirements.length ? <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-200">{selectedNode.requirements.map(req => { const prerequisite = RESEARCH_NODES.find(node => node.id === req.node); const current = getResearchLevel(levels, selectedElement, req.node); return <li key={req.node}>{prerequisite?.name || req.node}: {current}/{req.level}</li>; })}</ul> : <p className="mt-1 text-slate-300">None</p>}</div>
            <div><b className="text-amber-200">Cost per upgrade</b><p className="mt-1 text-slate-200">{selectedNode.cost.energy} Energy · {selectedNode.cost.gold.toLocaleString()} Gold{selectedNode.cost.royalTokens ? ` · ${selectedNode.cost.royalTokens} Royal Tokens` : ''}</p></div>
            <div><b className="text-amber-200">Research time</b><p className="mt-1 flex items-center gap-2 text-slate-200"><Clock3 className="h-4 w-4 text-cyan-300" />{nodeJob ? formatTime(nodeJob.completesAt - now) : `${selectedNode.cost.hours} hours`}{nodeJob && ' remaining'}</p></div>
          </div>
          {nodeJob ? <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-cyan-950/60 p-3"><span className="text-xs text-cyan-100">Reduce remaining time to zero</span><button onClick={() => onFastForwardResearch(nodeJob.slot)} disabled={player.gems < gemCost} title={`Complete now · ${gemCost} Gems`} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-400 px-3 py-2 font-game text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"><ArrowRight className="h-4 w-4" /><Gem className="h-4 w-4" />{gemCost}</button></div> : <button onClick={() => { if (selectedElement) onStartResearch(selectedElement, selectedNode.id); setSelectedNodeId(null); }} disabled={!unlocked || level >= selectedNode.maxLevel || !!researchSlotJob || !canAfford} className="mt-4 w-full rounded-xl border border-amber-200/70 bg-gradient-to-r from-amber-400 to-yellow-300 px-4 py-3 font-game text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">{!unlocked ? 'REQUIREMENTS NOT MET' : level >= selectedNode.maxLevel ? 'MAX LEVEL' : researchSlotJob ? 'QUEUE BUSY' : !canAfford ? 'NOT ENOUGH RESOURCES' : 'START RESEARCH'}</button>}
        </section>
      </div>;
    })()}
  </div>;
};
