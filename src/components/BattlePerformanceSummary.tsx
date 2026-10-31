import React, { useState } from 'react';
import { ElementType, BattlePerformanceStats } from '../types';
import {
  Flame,
  Droplet,
  Zap,
  Wind,
  Layers,
  Shield,
  Trophy,
  CheckCircle2,
  Award,
  Sparkles,
  Target,
  BarChart3,
  TrendingUp,
  Brain,
  Grid3X3,
  Crown,
  ChevronRight,
  Swords,
  Users,
  Compass
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts';
import { sound } from '../services/sound';
import { StarmonAsset } from './StarmonAsset';

export interface StarmonCombatMetric {
  id: string;
  name: string;
  element: ElementType;
  avatarSeed: string;
  damageDealt: number;
  damageTaken: number;
}

interface Props {
  stats: BattlePerformanceStats;
  playerTeamMetrics?: StarmonCombatMetric[];
  enemyTeamMetrics?: StarmonCombatMetric[];
  enemyDamagePerElement?: Record<ElementType, number>;
  onClose?: () => void;
  onReturnToHub?: () => void;
}

const ELEMENT_CONFIG: Record<
  ElementType,
  { label: string; icon: React.ReactNode; color: string; barGradient: string; textClass: string; hex: string }
> = {
  Fire: {
    label: 'Fire',
    icon: <Flame className="w-4 h-4 text-rose-300" />,
    color: 'rose',
    barGradient: 'from-rose-500 to-amber-500',
    textClass: 'text-rose-400',
    hex: '#f43f5e',
  },
  Water: {
    label: 'Water',
    icon: <Droplet className="w-4 h-4 text-sky-300" />,
    color: 'sky',
    barGradient: 'from-sky-500 to-blue-500',
    textClass: 'text-sky-400',
    hex: '#38bdf8',
  },
  Electric: {
    label: 'Electric',
    icon: <Zap className="w-4 h-4 text-amber-300" />,
    color: 'amber',
    barGradient: 'from-amber-400 to-yellow-500',
    textClass: 'text-amber-400',
    hex: '#f59e0b',
  },
  Wind: {
    label: 'Wind',
    icon: <Wind className="w-4 h-4 text-teal-300" />,
    color: 'teal',
    barGradient: 'from-teal-400 to-emerald-500',
    textClass: 'text-teal-400',
    hex: '#14b8a6',
  },
  Earth: {
    label: 'Earth',
    icon: <Layers className="w-4 h-4 text-emerald-300" />,
    color: 'emerald',
    barGradient: 'from-emerald-500 to-lime-500',
    textClass: 'text-emerald-400',
    hex: '#84cc16',
  },
  Metal: {
    label: 'Metal',
    icon: <Shield className="w-4 h-4 text-slate-300" />,
    color: 'slate',
    barGradient: 'from-slate-400 to-zinc-500',
    textClass: 'text-slate-300',
    hex: '#94a3b8',
  },
};

export const BattlePerformanceSummary: React.FC<Props> = ({
  stats,
  playerTeamMetrics = [],
  enemyTeamMetrics = [],
  enemyDamagePerElement,
  onClose,
  onReturnToHub,
}) => {
  const [activeTab, setActiveTab] = useState<'radar' | 'breakdown' | 'overview' | 'elements' | 'ielts'>('radar');

  // IELTS Accuracy calculation
  const accuracyPct =
    stats.ieltsQuestionsTotal > 0
      ? Math.round((stats.ieltsQuestionsCorrect / stats.ieltsQuestionsTotal) * 100)
      : 100;

  // Match-3 Combo Efficiency calculation
  const avgOrbsPerMatch =
    stats.totalMatchesMade > 0
      ? (stats.totalOrbsCleared / stats.totalMatchesMade).toFixed(1)
      : '3.0';

  const avgOrbsNum = parseFloat(avgOrbsPerMatch);

  // Efficiency Grade
  let efficiencyGrade = 'A';
  let efficiencyColor = 'text-amber-400 border-amber-400/40 bg-amber-500/10';

  if (avgOrbsNum >= 4.5 || stats.maxMatchSize >= 5) {
    efficiencyGrade = 'S+';
    efficiencyColor = 'text-yellow-300 border-yellow-400/50 bg-yellow-500/20';
  } else if (avgOrbsNum >= 3.8 || stats.maxMatchSize >= 4) {
    efficiencyGrade = 'S';
    efficiencyColor = 'text-amber-300 border-amber-400/40 bg-amber-500/15';
  }

  // Find MVP Element
  const elementsList: ElementType[] = ['Water', 'Fire', 'Metal', 'Earth', 'Wind', 'Electric'];
  let mvpElement: ElementType = 'Water';
  let maxElementDmg = -1;

  elementsList.forEach(elem => {
    const d = stats.damagePerElement[elem] || 0;
    if (d > maxElementDmg) {
      maxElementDmg = d;
      mvpElement = elem;
    }
  });

  // Calculate totals for teams
  const defaultPlayerMetrics: StarmonCombatMetric[] = playerTeamMetrics.length > 0
    ? playerTeamMetrics
    : [
        { id: 'p1', name: 'Leader Starmon', element: 'Water', avatarSeed: 'coralus', damageDealt: Math.round(stats.totalDamageDealt * 0.6), damageTaken: 120 },
        { id: 'p2', name: 'Ally DPS', element: 'Fire', avatarSeed: 'pyrokit', damageDealt: Math.round(stats.totalDamageDealt * 0.4), damageTaken: 80 },
      ];

  const defaultEnemyMetrics: StarmonCombatMetric[] = enemyTeamMetrics.length > 0
    ? enemyTeamMetrics
    : [
        { id: 'e1', name: 'Aqua Wyrm', element: 'Water', avatarSeed: 'tidecrush', damageDealt: 110, damageTaken: Math.round(stats.totalDamageDealt * 0.45) },
        { id: 'e2', name: 'Stone Golem', element: 'Earth', avatarSeed: 'stone_golem', damageDealt: 90, damageTaken: Math.round(stats.totalDamageDealt * 0.35) },
        { id: 'e3', name: 'Volt Saber', element: 'Electric', avatarSeed: 'voltlynx', damageDealt: 140, damageTaken: Math.round(stats.totalDamageDealt * 0.20) },
      ];

  const totalEnemyDmgDealt = defaultEnemyMetrics.reduce((sum, m) => sum + m.damageDealt, 0);

  // Radar Data for Elemental Efficiency (6 Elements)
  const elementalRadarData = elementsList.map(elem => {
    const pDmg = stats.damagePerElement[elem] || 0;
    const eDmg = enemyDamagePerElement ? (enemyDamagePerElement[elem] || 0) : Math.round((totalEnemyDmgDealt / 6) * (elem === 'Electric' ? 1.8 : elem === 'Water' ? 1.4 : 0.6));
    return {
      element: elem,
      'Your Team': pDmg,
      'Enemy Team': eDmg,
    };
  });

  return (
    <div className="w-full bg-slate-950/95 border-2 border-indigo-500/60 rounded-3xl p-4 md:p-6 text-slate-100 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
      {/* Background Ambient Glow */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-800 gap-3 relative z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base md:text-lg font-black font-game text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-indigo-200">
                Battle Performance Summary
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
                VICTORY ANALYTICS
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Side-by-side comparative breakdown & Radar visualization of elemental efficiency
            </p>
          </div>
        </div>

        {/* Top Grade Badge */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className={`px-3 py-1.5 rounded-xl border text-xs font-black font-game flex items-center gap-1.5 ${efficiencyColor}`}>
            <Award className="w-4 h-4" />
            <span>Grade {efficiencyGrade}</span>
          </div>
        </div>
      </div>

      {/* Navigation Switcher Tabs */}
      <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto scrollbar-none relative z-10 shrink-0">
        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('radar');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'radar'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/30'
              : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          Elemental Efficiency (Radar)
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('breakdown');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'breakdown'
              ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-500/30'
              : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Team Starmon Breakdown
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('elements');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'elements'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-500/30'
              : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          Elemental Damage (6 Elem)
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('overview');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/30'
              : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          Combat Highlights
        </button>

        <button
          onClick={() => {
            sound.playClick();
            setActiveTab('ielts');
          }}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'ielts'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
              : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          IELTS Academics
        </button>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto space-y-3.5 my-1 pr-1 relative z-10 scrollbar-thin scrollbar-thumb-slate-700">
        {/* ======================================================== */}
        {/* RADAR CHART: SIDE-BY-SIDE TEAM ELEMENTAL EFFICIENCY */}
        {/* ======================================================== */}
        {activeTab === 'radar' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-center gap-4">
              {/* Radar Chart Component */}
              <div className="w-full md:w-1/2 h-64 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={elementalRadarData}>
                    <PolarGrid stroke="#334155" strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="element" stroke="#94a3b8" tick={{ fill: '#e2e8f0', fontSize: 11, fontWeight: 'bold' }} />
                    <PolarRadiusAxis stroke="#475569" angle={30} domain={[0, 'auto']} tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    <Radar
                      name="Your Team"
                      dataKey="Your Team"
                      stroke="#38bdf8"
                      fill="#38bdf8"
                      fillOpacity={0.45}
                    />
                    <Radar
                      name="Enemy Team"
                      dataKey="Enemy Team"
                      stroke="#f43f5e"
                      fill="#f43f5e"
                      fillOpacity={0.35}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px' }}
                      itemStyle={{ fontWeight: 'bold' }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Side Summary Cards */}
              <div className="w-full md:w-1/2 space-y-2.5">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-sky-300 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" /> Your Team Elemental Damage
                    </span>
                    <span className="font-mono font-black text-white">{stats.totalDamageDealt} DMG</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    MVP Element: <strong className="text-amber-300">{mvpElement}</strong> ({stats.damagePerElement[mvpElement] || 0} DMG). 
                    Same-Element Attacks & Elemental Counter bonuses (+10% DMG) greatly empowered your Match-3 strikes.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-rose-300 flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5" /> Opponent Team Elemental Damage
                    </span>
                    <span className="font-mono font-black text-rose-400">{totalEnemyDmgDealt} DMG</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Opponents unleashed counter-attacks using their native elements. The radar chart above shows real-time comparative elemental dominance across all 6 elements.
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-[10px] text-indigo-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    Vòng tròn khắc chế: <strong>Water ➔ Fire ➔ Metal ➔ Wind ➔ Earth ➔ Electric ➔ Water</strong> (+10% Counter / -10% Resistance).
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* SIDE-BY-SIDE STARMON COMPARISON BREAKDOWN */}
        {/* ======================================================== */}
        {(activeTab === 'breakdown' || activeTab === 'radar') && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black font-game text-amber-300 tracking-wide uppercase flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-400" />
                Side-by-Side Starmon Breakdown (Damage Dealt & Taken)
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">Both Teams Comparison</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Left Column: Player Team Starmons */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-sky-500/40 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-black font-game text-sky-400 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" /> YOUR BATTLE PARTY
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Total Dealt: {stats.totalDamageDealt} DMG</span>
                </div>

                {defaultPlayerMetrics.map((p, idx) => {
                  const dealtPct = stats.totalDamageDealt > 0 ? Math.round((p.damageDealt / stats.totalDamageDealt) * 100) : 0;
                  return (
                    <div key={p.id || idx} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                            <StarmonAsset id={p.avatarSeed} size="sm" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">{p.name}</span>
                            <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${ELEMENT_CONFIG[p.element]?.textClass || 'text-sky-400'}`}>
                              {p.element}
                            </span>
                          </div>
                        </div>

                        <div className="text-right text-[11px] font-mono">
                          <span className="text-emerald-400 font-bold">⚔️ {p.damageDealt} Dealt</span>
                          <span className="text-slate-400 block text-[10px]">🛡️ {p.damageTaken} Taken</span>
                        </div>
                      </div>

                      {/* Bar comparison */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                          <span>Team Contribution: {dealtPct}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(5, dealtPct)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Enemy Team Starmons */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-rose-500/40 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-black font-game text-rose-400 flex items-center gap-1.5">
                    <Swords className="w-3.5 h-3.5" /> OPPONENT ROSTER
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Total Dealt: {totalEnemyDmgDealt} DMG</span>
                </div>

                {defaultEnemyMetrics.map((e, idx) => {
                  const dealtPct = totalEnemyDmgDealt > 0 ? Math.round((e.damageDealt / totalEnemyDmgDealt) * 100) : 0;
                  return (
                    <div key={e.id || idx} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                            <StarmonAsset id={e.avatarSeed} size="sm" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">{e.name}</span>
                            <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${ELEMENT_CONFIG[e.element]?.textClass || 'text-rose-400'}`}>
                              {e.element}
                            </span>
                          </div>
                        </div>

                        <div className="text-right text-[11px] font-mono">
                          <span className="text-rose-400 font-bold">⚔️ {e.damageDealt} Dealt</span>
                          <span className="text-slate-400 block text-[10px]">🛡️ {e.damageTaken} Taken</span>
                        </div>
                      </div>

                      {/* Bar comparison */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                          <span>Team Contribution: {dealtPct}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(5, dealtPct)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* ELEMENTAL DAMAGE BREAKDOWN (6 ELEMENTS) */}
        {/* ======================================================== */}
        {(activeTab === 'overview' || activeTab === 'elements') && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-400" />
                <h4 className="text-xs md:text-sm font-bold font-game text-white tracking-wide">
                  Damage Breakdown Per Element (6 Elements)
                </h4>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {stats.totalDamageDealt.toLocaleString()} Total DMG
              </span>
            </div>

            <div className="space-y-2.5">
              {elementsList.map(elem => {
                const cfg = ELEMENT_CONFIG[elem];
                const dmg = stats.damagePerElement[elem] || 0;
                const pct = stats.totalDamageDealt > 0 ? Math.round((dmg / stats.totalDamageDealt) * 100) : 0;
                const isMvp = elem === mvpElement && dmg > 0;

                return (
                  <div key={elem} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md bg-slate-800 flex items-center justify-center">
                          {cfg.icon}
                        </div>
                        <span className="font-bold text-white text-[11px]">{cfg.label}</span>
                        {isMvp && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 font-bold flex items-center gap-0.5">
                            <Crown className="w-2.5 h-2.5" /> MVP
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-slate-200">
                          {dmg.toLocaleString()} DMG
                        </span>
                        <span className={`text-[10px] font-mono font-bold w-10 text-right ${cfg.textClass}`}>
                          {pct}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${cfg.barGradient} transition-all duration-700`}
                        style={{ width: `${Math.max(pct, dmg > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
              <span>* Includes basic Match-3 attacks and Active Skills.</span>
              <span className="text-amber-300 font-bold">
                Same-Element & Counter bonuses applied
              </span>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* COMBAT HIGHLIGHTS (OVERVIEW) */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card 1: Total Damage & MVP Element */}
            <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  Total Damage
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold flex items-center gap-1">
                  <Crown className="w-2.5 h-2.5 text-amber-300" /> MVP: {mvpElement}
                </span>
              </div>
              <div className="text-xl md:text-2xl font-black font-mono text-white">
                {stats.totalDamageDealt.toLocaleString()}{' '}
                <span className="text-xs font-bold text-rose-400">DMG</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                <span>Top Element: {stats.damagePerElement[mvpElement] || 0} DMG</span>
              </div>
            </div>

            {/* Card 2: IELTS Accuracy */}
            <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-emerald-400" />
                  IELTS Accuracy
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full border font-bold text-emerald-300 border-emerald-400/40 bg-emerald-500/10">
                  {accuracyPct}%
                </span>
              </div>
              <div className="text-xl md:text-2xl font-black font-mono text-white flex items-baseline gap-1">
                <span>{stats.ieltsQuestionsCorrect} / {stats.ieltsQuestionsTotal || 3}</span>
                <span className="text-xs text-emerald-400 font-bold">Solved</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                <span>Unlocked Starmon turns each round</span>
              </div>
            </div>

            {/* Card 3: Match-3 Combo Efficiency */}
            <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <Grid3X3 className="w-3.5 h-3.5 text-amber-400" />
                  Combo Efficiency
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-black ${efficiencyColor}`}>
                  Grade {efficiencyGrade}
                </span>
              </div>
              <div className="text-xl md:text-2xl font-black font-mono text-white flex items-baseline gap-1">
                <span>{avgOrbsPerMatch}</span>
                <span className="text-xs text-amber-300 font-bold">Orbs/Match</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                <span>Max Match: {stats.maxMatchSize || 3} Orbs</span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* IELTS ACCURACY SECTION */}
        {/* ======================================================== */}
        {(activeTab === 'ielts') && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs md:text-sm font-bold font-game text-white tracking-wide">
                  IELTS Educational Metrics
                </h4>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-bold font-mono">
                {accuracyPct}% Success
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-black text-lg">
                  {accuracyPct}%
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Phase 1 Performance</span>
                  <span className="text-[10px] text-slate-400 block">
                    {stats.ieltsQuestionsCorrect} answered correctly out of {stats.ieltsQuestionsTotal || 3} questions
                  </span>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Combat turns successfully unlocked</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">EdTech Integration</span>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                    Accurate responses activate combat units, charge high-impact Mana, and activate Starmon passive buffs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="pt-3 border-t border-slate-800 flex items-center justify-between relative z-10 gap-3 shrink-0">
        {onClose && (
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Close Summary
          </button>
        )}

        {onReturnToHub && (
          <button
            onClick={() => {
              sound.playClick();
              onReturnToHub();
            }}
            className="flex-1 py-2.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black font-game text-xs md:text-sm rounded-xl shadow-lg shadow-amber-500/30 transition-all hover:scale-102 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
          >
            <Trophy className="w-4 h-4 text-amber-950" />
            Continue to Main Hub
          </button>
        )}
      </div>
    </div>
  );
};
