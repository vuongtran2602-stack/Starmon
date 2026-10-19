import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Starmon, QuizQuestion, OrbTile, ElementType, BattlePhase, BattlePerformanceStats, SpeakingFeedbackVi, GrammarErrorDetail, PronunciationErrorDetail, FluencyDetail, QuizQuestionMode, SpeakingLogEntry } from '../types';
import { BattlePerformanceSummary } from './BattlePerformanceSummary';
import { StarmonAsset } from './StarmonAsset';
import { getRandomQuizSet, IELTS_SPEAKING_POOL, EXTENDED_SPEAKING_BANK } from '../data/quizzes';
import { ELEMENT_COUNTERS, ELEMENT_COLORS, getBaseMultiplierForOrbs, STARMON_ROSTER } from '../data/starmons';
import { sound } from '../services/sound';
import { submitSpeakingToSupabase, syncPvpActionToSupabase, subscribeToPvpRoom } from '../services/supabase';
import { TutorialSpotlight } from './TutorialSpotlight';
import {
  Mic,
  Square,
  Maximize2,
  Minimize2,
  Volume2,
  Trophy,
  RotateCcw,
  Check,
  Lock,
  Flame,
  Droplet,
  Zap,
  Wind,
  Layers,
  Shield,
  Crosshair,
  Sparkles,
  Award,
  BookOpen,
  ArrowRight,
  Play,
  RefreshCw,
  X,
  Info,
  Clock,
  TrendingUp,
  FastForward,
  Swords,
  Bot,
  Gift,
  ScrollText,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Filter,
  BarChart3,
  Brain,
  Grid3X3,
  Home
} from 'lucide-react';
import phase1Bg from '../assets/images/phase1_bg.png';
import { getArenaMap } from '../data/arenaMaps';
import { GOLD_IMAGE } from '../data/itemsData';
import { getVietnameseAnalysisForQuestion } from '../data/vietnameseSuggestions';
import { BattleLogEntry } from '../types';
import { capCriterionBands, getInappropriateVocabularyCount, getShortAnswerBandPenalty } from '../utils/speakingScoring';

interface Props {
  playerStarmons: Starmon[];
  allRosterStarmons?: Starmon[];
  isFullscreen: boolean;
  showSpeakingHints?: boolean;
  questionMode?: QuizQuestionMode;
  onChangeQuestionMode?: (mode: QuizQuestionMode) => void;
  onSaveSpeakingLog?: (entry: SpeakingLogEntry) => void;
  onToggleFullscreen: () => void;
  onExitBattle: (result: 'win' | 'loss', rewards?: { gold: number; cards: number; cardStarmonId?: string; exp: number }) => void;
  pvpRoomInfo?: {
    code: string;
    hostName: string;
    hostId?: string;
    arena: string;
    myPlayerId?: string;
    myPlayerName?: string;
    isHost?: boolean;
    opponentId?: string;
    opponentName?: string;
    opponentStarmons?: Starmon[];
    pvpAuth?: { username: string; deviceId: string; sessionToken: string };
  } | null;
  onRequestMicrophone?: () => void;
  onQuestProgress?: (category: 'match_orbs' | 'deal_damage' | 'speaking_band' | 'combo_hyper' | 'cast_skill', data?: any) => void;
  tutorialStage?: 1 | 2 | 3 | null;
  hasClaimedTutorialReward?: boolean;
  onSkipTutorial?: () => void;
  onNextTutorialStage?: (next: 1 | 2 | 3) => void;
  onTutorial1Reward?: () => void;
}

export interface IeltsCriterionResult {
  band: number;
  feedback: string;
}

export interface IeltsAiEvaluationResult {
  overallBand: number;
  passed: boolean;
  overall_score?: number;
  can_attack?: boolean;
  questionIndex?: number;
  questionText?: string;
  grammar_errors?: GrammarErrorDetail[];
  vocabulary_errors?: Array<{ word: string; issue: string; correction: string }>;
  pronunciation_errors?: PronunciationErrorDetail[];
  fluency_detail?: FluencyDetail;
  feedback_vi?: SpeakingFeedbackVi;
  criteria: {
    fluencyCoherence: IeltsCriterionResult;
    lexicalResource: IeltsCriterionResult;
    grammaticalRange: IeltsCriterionResult;
    pronunciation: IeltsCriterionResult;
  };
  summary: string;
  strengths: string[];
  improvements: string[];
  transcript: string;
}

const ELEMENTS: ElementType[] = ['Fire', 'Water', 'Electric', 'Wind', 'Earth', 'Metal'];
const BOARD_SIZE = 8;
const QUESTION_TIME_LIMIT = 120; // 120 seconds for Phase 1 speaking practice
const ADVANCED_SPEAKING_VOCAB = [
  'sustainable development', 'renewable energy', 'carbon footprint', 'climate change', 'biodiversity', 'artificial intelligence',
  'critical thinking', 'broaden my horizons', 'a double-edged sword', 'plays a pivotal role', 'quality of life', 'work-life balance',
  'mental well-being', 'public transportation', 'economic growth', 'cultural heritage', 'social media', 'cutting-edge technology',
  'make ends meet', 'once in a blue moon', 'the best of both worlds', 'pose a threat', 'raise awareness', 'take for granted',
  'fast-paced lifestyle', 'lifelong learning', 'sense of accomplishment', 'strong sense of community', 'limited access to',
  'highly competitive', 'gain practical experience', 'heavily dependent on', 'address the issue', 'in the long run', 'from my perspective',
  'a wide range of', 'significant impact', 'deep-rooted', 'cost-effective', 'time-consuming', 'user-friendly', 'energy-efficient',
];

function isEarlierPvpPhase(incomingPhase: unknown, currentPhase: string): boolean {
  if (typeof incomingPhase !== 'string') return false;
  const parse = (value: string) => {
    const match = /^(\d+)\.(\d+)$/.exec(value);
    return match ? [Number(match[1]), Number(match[2])] as const : null;
  };
  const incoming = parse(incomingPhase);
  const current = parse(currentPhase);
  if (!incoming || !current) return false;
  return incoming[0] < current[0] || (incoming[0] === current[0] && incoming[1] < current[1]);
}

function countAdvancedSpeakingVocab(transcript: string): number {
  return ADVANCED_SPEAKING_VOCAB.filter(phrase => {
    const escaped = phrase.split('').map(char => /[.*+?^${}()|[\]\\]/.test(char) ? `\\${char}` : char).join('').replace(/\s+/g, '\\s+');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(transcript);
  }).length;
}

function countRepeatedPromptKeywords(question: string, transcript: string): number {
  const stopWords = new Set(['a', 'an', 'and', 'are', 'be', 'do', 'does', 'did', 'for', 'from', 'how', 'in', 'is', 'it', 'like', 'of', 'on', 'or', 'the', 'to', 'what', 'when', 'where', 'which', 'who', 'why', 'you', 'your']);
  const keywords = [...new Set((question.toLowerCase().match(/[a-z]+/g) || []).filter(word => word.length > 2 && !stopWords.has(word)))];
  return keywords.reduce((count, word) => count + ((transcript.toLowerCase().match(new RegExp(`\\b${word}(?:s|es)?\\b`, 'g')) || []).length), 0);
}

function getSpeakingRatePenalty(wordCount: number, durationSeconds: number): number {
  if (!(durationSeconds > 0)) return 0;
  const wordsPerMinute = wordCount * 60 / durationSeconds;
  return wordsPerMinute < 60 ? 2 : wordsPerMinute < 70 ? 1.5 : wordsPerMinute < 80 ? 1 : wordsPerMinute < 90 ? 0.5 : 0;
}

function normalizeRecognizedSpeech(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const normalized = (word: string) => word.toLowerCase().replace(/[^a-z0-9']/g, '');

  // Some tablet speech engines return the just-finalized phrase twice. Remove
  // identical adjacent phrase copies while keeping short natural repetitions.
  let changed = true;
  while (changed && words.length >= 6) {
    changed = false;
    for (let size = Math.floor(words.length / 2); size >= 3; size--) {
      const leftStart = words.length - size * 2;
      const left = words.slice(leftStart, leftStart + size).map(normalized);
      const right = words.slice(leftStart + size).map(normalized);
      if (left.every((word, index) => word && word === right[index])) {
        words.splice(leftStart + size, size);
        changed = true;
        break;
      }
    }
  }
  return words.join(' ');
}

export function deserializeBoard(snapshot: any): OrbTile[][] | null {
  if (!snapshot) return null;
  let rawGrid: any = null;
  if (Array.isArray(snapshot) && snapshot.length === 8) {
    rawGrid = snapshot;
  } else if (snapshot.grid && Array.isArray(snapshot.grid) && snapshot.grid.length === 8) {
    rawGrid = snapshot.grid;
  } else if (snapshot.board && Array.isArray(snapshot.board) && snapshot.board.length === 8) {
    rawGrid = snapshot.board;
  } else if (snapshot.boardSnapshot) {
    return deserializeBoard(snapshot.boardSnapshot);
  } else if (snapshot.patch?.grid && Array.isArray(snapshot.patch.grid) && snapshot.patch.grid.length === 8) {
    rawGrid = snapshot.patch.grid;
  }
  if (!rawGrid || !Array.isArray(rawGrid) || rawGrid.length !== 8) return null;
  return rawGrid.map((row: any, r: number) =>
    row.map((cell: any, c: number) => {
      const elem = (cell?.element || cell) as ElementType;
      return {
        id: cell?.id || `orb_${r}_${c}_${elem}`,
        element: elem,
        row: r,
        col: c,
      };
    })
  );
}

export const BattleView: React.FC<Props> = ({
  playerStarmons,
  allRosterStarmons,
  isFullscreen,
  showSpeakingHints = false,
  questionMode = 'random',
  onChangeQuestionMode,
  onSaveSpeakingLog,
  onToggleFullscreen,
  onExitBattle,
  pvpRoomInfo,
  onRequestMicrophone,
  onQuestProgress,
  tutorialStage = null,
  hasClaimedTutorialReward = false,
  onSkipTutorial,
  onNextTutorialStage,
  onTutorial1Reward,
}) => {
  const [phase, setPhase] = useState<BattlePhase>('phase1_quiz');
  const [currentRoundNumber, setCurrentRoundNumber] = useState(1);
  const [pveLevel, setPveLevel] = useState(1);

  // Status Effect Duration States (Frostbite, Silence)
  const [playerFrostbiteTurns, setPlayerFrostbiteTurns] = useState<Record<number, number>>({});
  const [enemyFrostbiteTurns, setEnemyFrostbiteTurns] = useState<Record<number, number>>({});
  const [playerSilenceTurns, setPlayerSilenceTurns] = useState<Record<number, number>>({});
  const [enemySilenceTurns, setEnemySilenceTurns] = useState<Record<number, number>>({});

  // Per-Starmon Damage Metrics for Recharts Radar & Side-by-Side Comparison
  const [playerDmgDealt, setPlayerDmgDealt] = useState<Record<number, number>>({});
  const [playerDmgTaken, setPlayerDmgTaken] = useState<Record<number, number>>({});
  const [enemyDmgDealt, setEnemyDmgDealt] = useState<Record<number, number>>({});
  const [enemyDmgTaken, setEnemyDmgTaken] = useState<Record<number, number>>({});
  const [enemyDamagePerElement, setEnemyDamagePerElement] = useState<Record<ElementType, number>>({
    Fire: 0,
    Water: 0,
    Electric: 0,
    Wind: 0,
    Earth: 0,
    Metal: 0,
  });

  // Starmon Full Stats & Passive Inspection Modal
  const [inspectingStarmon, setInspectingStarmon] = useState<{
    mon: Starmon;
    isEnemy: boolean;
    monIndex: number;
    originalBase?: Starmon;
  } | null>(null);

  // ==========================================
  // BATTLE LOG (LỊCH SỬ TRẬN ĐẤU)
  // ==========================================
  const [showBattleLogModal, setShowBattleLogModal] = useState<boolean>(false);
  const [battleLogFilter, setBattleLogFilter] = useState<'all' | 'player' | 'enemy' | 'skills' | 'quiz'>('all');
  const logTurnRef = useRef<number>(1);
  const [battleLogs, setBattleLogs] = useState<BattleLogEntry[]>([
    {
      id: `log_init_${Date.now()}`,
      turnNumber: 1,
      phase: 'quiz',
      source: 'system',
      actionType: 'status',
      message: '⚔️ BATTLE INITIATED: Round 1 started. Entering Quiz & IELTS Speaking Phase.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    },
  ]);

  const addBattleLog = (entry: Omit<BattleLogEntry, 'id' | 'timestamp' | 'turnNumber'>) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newEntry: BattleLogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      turnNumber: logTurnRef.current,
      timestamp: timeStr,
    };
    setBattleLogs(prev => [newEntry, ...prev]);
  };

  // Evaluation modal: Concise 4 criteria version by default ('none'), user manually clicks to expand 'vietnamese'
  const [expandedFeedbackSection, setExpandedFeedbackSection] = useState<'none' | 'vietnamese'>('none');

  // ==========================================
  // REAL-TIME PVP MULTIPLAYER STATES & WEBSOCKET
  // ==========================================
  const isPvP = Boolean(
    pvpRoomInfo &&
    pvpRoomInfo.code &&
    !pvpRoomInfo.code.toLowerCase().includes('bot') &&
    pvpRoomInfo.code !== 'PVE_BOT' &&
    pvpRoomInfo.code !== 'RANKED-PVP'
  );
  const currentArenaMap = getArenaMap(pvpRoomInfo?.arena);
  const requiredSpeakingBand = isPvP ? 5.0 : Math.min(7.5, 5 + Math.floor(pveLevel / 10) * 0.5);
  const pvpWsRef = useRef<WebSocket | null>(null);
  const lastPvpSocketAckAtRef = useRef(0);
  const currentRoundNumberRef = useRef(currentRoundNumber);
  currentRoundNumberRef.current = currentRoundNumber;
  const syncBoardRef = useRef<((grid: any) => void) | null>(null);
  const playerTeamRef = useRef<Starmon[]>([]);

  const [pvpIsConnected, setPvpIsConnected] = useState<boolean>(false);
  const [pvpWaitingForOpponentSpeaking, setPvpWaitingForOpponentSpeaking] = useState<boolean>(false);
  const [waitingCountdown, setWaitingCountdown] = useState<number | null>(null);
  const [pvpTurnNumber, setPvpTurnNumber] = useState<number>(1);
  const pvpTurnNumberRef = useRef<number>(1);
  pvpTurnNumberRef.current = pvpTurnNumber;
  const lastGeneratedQuizKeyRef = useRef<string>(`${pvpRoomInfo?.code || ''}:1`);

  const [pvpSubPhase, setPvpSubPhase] = useState<1 | 2 | 3>(1);
  const pvpSubPhaseRef = useRef<1 | 2 | 3>(1);
  pvpSubPhaseRef.current = pvpSubPhase;

  const [pvpFlowPhaseString, setPvpFlowPhaseString] = useState<string>('1.1');
  const pvpFlowPhaseRef = useRef<string>('1.1');
  pvpFlowPhaseRef.current = pvpFlowPhaseString;
  // Tracks the last authoritative combat step received from the PvP server.
  // Null means the phase changed but its step notification may have been missed.
  const pvpSyncedStepRef = useRef<number | null>(null);

  const [pvpTurnBanner, setPvpTurnBanner] = useState<string | null>(null);
  const [pvpTurnTimer, setPvpTurnTimer] = useState<number | null>(null);
  const [pvpWaitingForPhaseTransition, setPvpWaitingForPhaseTransition] = useState(false);
  const pvpTimeoutRequestedPhaseRef = useRef<string | null>(null);
  const [isActionPendingServer, setIsActionPendingServer] = useState<boolean>(false);
  const [actingStepIndex, setActingStepIndex] = useState<number>(0);
  const [selectedEnemyIndex, setSelectedEnemyIndex] = useState<number>(0);

  // Quy ước vị trí cố định:
  // Player 1 (Host)  = bên TRÁI = slot 1
  // Player 2 (Guest) = bên PHẢI = slot 2
  const [pvpMySlot, setPvpMySlot] = useState<1 | 2>(pvpRoomInfo?.isHost ? 1 : 2);
  const pvpMySlotRef = useRef<1 | 2>(pvpRoomInfo?.isHost ? 1 : 2);
  pvpMySlotRef.current = pvpMySlot;

  // Công thức xác định Attacker / Target theo Phase:
  // attackerSlot = subPhase - 1      // n.2 -> 1, n.3 -> 2
  // targetSlot   = 3 - attackerSlot  // 1 <-> 2
  const pvpAttackerSlot: 1 | 2 | null = (pvpSubPhase === 2 || pvpSubPhase === 3)
    ? ((pvpSubPhase - 1) as 1 | 2)
    : null;
  const pvpTargetSlot: 1 | 2 | null = pvpAttackerSlot
    ? ((3 - pvpAttackerSlot) as 1 | 2)
    : null;
  const pvpAttackerSlotRef = useRef<1 | 2 | null>(null);
  pvpAttackerSlotRef.current = pvpAttackerSlot;
  const pvpTargetSlotRef = useRef<1 | 2 | null>(null);
  pvpTargetSlotRef.current = pvpTargetSlot;

  const pvpQuizAnswersRef = useRef<boolean[]>([]);
  const boardVersionRef = useRef<number>(0);

  // 5. Client — map slot sang trái/phải chỉ để hiển thị
  const SLOT_TO_SIDE: Record<1 | 2, 'left' | 'right'> = { 1: 'left', 2: 'right' };

  const [pvpHighlightedAttackerSlot, setPvpHighlightedAttackerSlot] = useState<1 | 2 | null>(null);
  const [pvpHighlightedTargetSlot, setPvpHighlightedTargetSlot] = useState<1 | 2 | null>(null);
  const [pvpActionMenu, setPvpActionMenu] = useState<{
    starmonIndex: number;
    options: string[];
    validTargets: number[];
    timer: number;
    selectedMode: 'physical_attack' | 'use_ability';
  } | null>(null);
  const [pvpLostTurnEffect, setPvpLostTurnEffect] = useState<{
    starmonIndex: number;
    attackerSlot: 1 | 2;
    reason?: string;
  } | null>(null);

  // 6. Client chỉ enable input khi attackerSlot == mySlot và đang trong lượt your_starmon_turn của mình
  const isMyTurnInPvP = !isPvP || (pvpAttackerSlot === pvpMySlot && pvpActionMenu !== null && !isActionPendingServer);
  const pvpCurrentTurnPlayerName = isPvP
    ? (pvpAttackerSlot === pvpMySlot
        ? (pvpRoomInfo?.myPlayerName || `Player ${pvpMySlot}`)
        : (pvpRoomInfo?.opponentName || `Player ${pvpAttackerSlot || (3 - pvpMySlot)}`))
    : null;

  // Dynamic attack animation state (fromSide -> toSide)
  const [attackAnim, setAttackAnim] = useState<{
    fromSide: 'left' | 'right';
    fromIndex: number;
    toSide: 'left' | 'right';
    toIndex: number;
    damage: number;
    isCrit?: boolean;
  } | null>(null);

  const playAttackAnim = useCallback((data: {
    fromSide: 'left' | 'right';
    fromIndex: number;
    toSide: 'left' | 'right';
    toIndex: number;
    damage: number;
    isCrit?: boolean;
  }) => {
    setAttackAnim(data);
    sound.playAttackHit();

    const floatText = data.isCrit ? `💥 CRIT! -${data.damage} HP` : `-${data.damage} HP`;
    setFloatingDamage({
      text: floatText,
      isEnemy: data.toSide === 'right',
    });

    setTimeout(() => {
      setAttackAnim(null);
      setFloatingDamage(null);
    }, 1200);
  }, []);

  // Cập nhật HP đúng vào starmon của targetSlot (1 = Player 1 / TRÁI, 2 = Player 2 / PHẢI)
  const updateStarmonHp = useCallback((targetSlot: 1 | 2, targetStarmonIndex: number, targetHpAfter: number) => {
    const mySlot = pvpMySlotRef.current;
    const clampedHp = Math.max(0, targetHpAfter);
    if (targetSlot === mySlot) {
      setPlayerTeam(prev =>
        prev.map((s, idx) => (idx === targetStarmonIndex ? { ...s, currentHp: clampedHp } : s))
      );
    } else {
      setEnemyTeam(prev => {
        const next = prev.map((s, idx) => (idx === targetStarmonIndex ? { ...s, currentHp: clampedHp } : s));
        if (clampedHp <= 0) {
          const nextAlive = next.findIndex(e => e.currentHp > 0);
          if (nextAlive !== -1) {
            setSelectedEnemyIndex(nextAlive);
          }
        }
        return next;
      });
    }
  }, []);

  const updateHpsFromArrays = useCallback((
    p1_hp?: number[],
    p2_hp?: number[],
    p1_mana?: number[],
    p2_mana?: number[],
    incomingVersion?: number
  ) => {
    if (!Array.isArray(p1_hp) || !Array.isArray(p2_hp)) return;
    // Board versions also version the HP/energy snapshot emitted after each
    // authoritative PvP action. Do not let a delayed sync restore old bars.
    if (boardVersionRef.current > 0 && (
      typeof incomingVersion !== 'number' ||
      incomingVersion <= 0 ||
      incomingVersion < boardVersionRef.current
    )) return;
    const mySlot = pvpMySlotRef.current;
    if (mySlot === 1) {
      setPlayerTeam(prev => prev.map((s, i) => ({
        ...s,
        currentHp: p1_hp[i] !== undefined ? Math.max(0, p1_hp[i]) : s.currentHp,
        currentMana: Array.isArray(p1_mana) && p1_mana[i] !== undefined ? p1_mana[i] : s.currentMana,
      })));
      setEnemyTeam(prev => prev.map((s, i) => ({
        ...s,
        currentHp: p2_hp[i] !== undefined ? Math.max(0, p2_hp[i]) : s.currentHp,
        currentMana: Array.isArray(p2_mana) && p2_mana[i] !== undefined ? p2_mana[i] : s.currentMana,
      })));
    } else {
      setPlayerTeam(prev => prev.map((s, i) => ({
        ...s,
        currentHp: p2_hp[i] !== undefined ? Math.max(0, p2_hp[i]) : s.currentHp,
        currentMana: Array.isArray(p2_mana) && p2_mana[i] !== undefined ? p2_mana[i] : s.currentMana,
      })));
      setEnemyTeam(prev => prev.map((s, i) => ({
        ...s,
        currentHp: p1_hp[i] !== undefined ? Math.max(0, p1_hp[i]) : s.currentHp,
        currentMana: Array.isArray(p1_mana) && p1_mana[i] !== undefined ? p1_mana[i] : s.currentMana,
      })));
    }
  }, []);

  const applyAuthoritativeTeamsFromMatchState = useCallback((matchState: any) => {
    const players = matchState?.players;
    const slot1 = players?.[1] || players?.['1'] || matchState?.player1;
    const slot2 = players?.[2] || players?.['2'] || matchState?.player2;
    if (!Array.isArray(slot1?.starmons) || !Array.isArray(slot2?.starmons)) return;

    const makeTeam = (serverTeam: any[], currentTeam: Starmon[]) => serverTeam.map((source, index) => {
      const current = currentTeam[index];
      const monId = source?.avatarSeed || source?.id || current?.avatarSeed || current?.id;
      const template = STARMON_ROSTER.find(mon => mon.id === monId || mon.avatarSeed === monId) || current || STARMON_ROSTER[0];
      const hp = source?.hp ?? source?.currentHp ?? current?.currentHp ?? source?.maxHp ?? template.maxHp;
      const mana = source?.mana ?? source?.currentMana ?? current?.currentMana ?? 0;
      return {
        ...template,
        ...current,
        ...source,
        currentHp: Math.max(0, Number(hp) || 0),
        maxHp: Number(source?.maxHp) || current?.maxHp || template.maxHp,
        currentMana: Math.max(0, Number(mana) || 0),
        maxMana: current?.maxMana || 200,
        skill1: source?.skill1?.name ? source.skill1 : current?.skill1 || template.skill1,
        skill2: source?.skill2?.name ? source.skill2 : current?.skill2 || template.skill2,
        passive: source?.passive?.name ? source.passive : current?.passive || template.passive,
      } as Starmon;
    });

    if (pvpMySlotRef.current === 1) {
      setPlayerTeam(current => makeTeam(slot1.starmons, current));
      setEnemyTeam(current => makeTeam(slot2.starmons, current));
    } else {
      setPlayerTeam(current => makeTeam(slot2.starmons, current));
      setEnemyTeam(current => makeTeam(slot1.starmons, current));
    }
  }, []);

  const sendPvpMessage = useCallback((msg: any) => {
    if (pvpWsRef.current && pvpWsRef.current.readyState === WebSocket.OPEN) {
      pvpWsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // =========================================================
  // 5. CLIENT — HIỂN THỊ THEO STEP (PHASE 2 & PHASE 3)
  // =========================================================
  const showPhaseBanner = useCallback((text: string) => {
    // CHỈ hiện thông báo phase, KHÔNG hiện step
    setPvpTurnBanner(text);
    sound.playSwoosh();
    setTimeout(() => {
      setPvpTurnBanner(prev => (prev === text ? null : prev));
    }, 2200);
  }, []);

  const highlightAttacker = useCallback((slot: 1 | 2) => {
    pvpAttackerSlotRef.current = slot;
    setPvpHighlightedAttackerSlot(slot);
  }, []);

  const highlightTarget = useCallback((slot: 1 | 2) => {
    pvpTargetSlotRef.current = slot;
    setPvpHighlightedTargetSlot(slot);
  }, []);

  const showActionMenu = useCallback((config: {
    starmonIndex: number;
    options: string[];
    validTargets: number[];
    timer: number;
    actorName?: string;
  }) => {
    setActingStepIndex(config.starmonIndex);
    setPvpTurnTimer(config.timer);
    setTurnStatusType('normal');
    if (Array.isArray(config.validTargets) && config.validTargets.length > 0) {
      setSelectedEnemyIndex(prev => (config.validTargets.includes(prev) ? prev : config.validTargets[0]));
    }
    setPvpActionMenu({
      starmonIndex: config.starmonIndex,
      options: config.options || ['physical_attack', 'use_ability'],
      validTargets: config.validTargets || [0, 1, 2],
      timer: config.timer || 30,
      selectedMode: 'physical_attack',
    });
    const monName = playerTeamRef.current[config.starmonIndex]?.name || `Starmon #${config.starmonIndex + 1}`;
    setTurnAnnouncement(`Đến Lượt ${config.actorName || 'Bạn'}'s ${monName}`);
    sound.playRewardFanfare();
  }, []);

  const showLostTurnEffect = useCallback((starmonIndex: number, attackerSlot: 1 | 2, reason?: string) => {
    sound.playWrong();
    const isMyMon = attackerSlot === pvpMySlotRef.current;
    if (isMyMon) {
      setPvpActionMenu(null);
      setTurnStatusType('missed');
    }
    setPvpLostTurnEffect({ starmonIndex, attackerSlot, reason });
    setTimeout(() => {
      setPvpLostTurnEffect(prev =>
        prev && prev.starmonIndex === starmonIndex && prev.attackerSlot === attackerSlot ? null : prev
      );
    }, 1400);

    const monName = isMyMon
      ? (playerTeamRef.current[starmonIndex]?.name || `Starmon #${starmonIndex + 1}`)
      : `Starmon #${starmonIndex + 1}`;
    const reasonText = reason === 'timeout' ? 'hết 30s không hành động' : 'trả lời sai câu hỏi tương ứng';
    setTurnAnnouncement(
      isMyMon
        ? `❌ ${monName} mất lượt (${reasonText})!`
        : `🛡️ ${monName} của đối thủ mất lượt (${reasonText})!`
    );
  }, []);

  const playActionAnim = useCallback((data: any) => {
    const attackerSlot: 1 | 2 = data.attackerSlot === 2 ? 2 : 1;
    const targetSlot: 1 | 2 = (3 - attackerSlot) as 1 | 2;
    const attackerSide: 'left' | 'right' = SLOT_TO_SIDE[attackerSlot];
    const targetSide: 'left' | 'right' = SLOT_TO_SIDE[targetSlot];
    const atkIndex = typeof data.starmonIndex === 'number'
      ? data.starmonIndex
      : (typeof data.attackerStarmonIndex === 'number' ? data.attackerStarmonIndex : 0);
    const defIndex = typeof data.payload?.targetStarmonIndex === 'number'
      ? data.payload.targetStarmonIndex
      : (typeof data.targetStarmonIndex === 'number' ? data.targetStarmonIndex : 0);
    const damage = data.damage ?? 0;
    const isCrit = Boolean(data.payload?.isCrit || data.action?.isCrit);

    if (attackerSlot !== pvpMySlotRef.current) {
      setActiveEnemyAttackerIndex(atkIndex);
    }

    playAttackAnim({
      fromSide: attackerSide,
      fromIndex: atkIndex,
      toSide: targetSide,
      toIndex: defIndex,
      damage,
      isCrit,
    });
  }, [playAttackAnim]);

  const updateBoardFromServer = useCallback((data: any) => {
    const attackerSlot: 1 | 2 = data.attackerSlot === 2 ? 2 : 1;
    const targetSlot: 1 | 2 = (3 - attackerSlot) as 1 | 2;
    const atkIndex = typeof data.starmonIndex === 'number'
      ? data.starmonIndex
      : (typeof data.attackerStarmonIndex === 'number' ? data.attackerStarmonIndex : 0);
    const defIndex = typeof data.payload?.targetStarmonIndex === 'number'
      ? data.payload.targetStarmonIndex
      : (typeof data.targetStarmonIndex === 'number' ? data.targetStarmonIndex : 0);

    const v = data.boardVersion ?? data.version ?? 0;
    const isFreshSnapshot = v > 0
      ? v >= boardVersionRef.current
      : boardVersionRef.current === 0;
    if (isFreshSnapshot) {
      if (v > 0) boardVersionRef.current = v;
      const snapshot = data.boardSnapshot || data.board || data.payload?.newBoard || data.action?.newBoard;
      if (snapshot) {
        syncBoardRef.current?.(snapshot);
      }
    }

    // The per-target shortcut is part of the same authoritative snapshot as
    // the board. Ignore it when an older action arrives after a newer state.
    if (isFreshSnapshot && typeof data.targetHpAfter === 'number') {
      updateStarmonHp(targetSlot, defIndex, data.targetHpAfter);
    }

    if (isFreshSnapshot && typeof data.attackerManaAfter === 'number') {
      if (attackerSlot === pvpMySlotRef.current) {
        setPlayerTeam(prev =>
          prev.map((s, idx) => (idx === atkIndex ? { ...s, currentMana: data.attackerManaAfter } : s))
        );
      } else {
        setEnemyTeam(prev =>
          prev.map((s, idx) => (idx === atkIndex ? { ...s, currentMana: data.attackerManaAfter } : s))
        );
      }
    }

    if (Array.isArray(data.p1_hp) && Array.isArray(data.p2_hp)) {
      updateHpsFromArrays(data.p1_hp, data.p2_hp, data.p1_mana, data.p2_mana, v);
    }
  }, [updateHpsFromArrays, updateStarmonHp]);

  // Single Source of Truth: Express WebSocket governs all battle phases and turns.
  // Supabase is used exclusively for archiving match records and speaking submissions.

  // 4. Gửi hành động của Starmon theo đúng cấu trúc Step (physical_attack | use_ability)
  const syncPvpAction = useCallback((action: {
    actionType: 'MATCH' | 'SKILL';
    elem?: ElementType;
    matchCount?: number;
    orbSwitches?: any[];
    damage: number;
    targetIdx: number;
    targetNewHp?: number;
    isCrit?: boolean;
    attackerIndex: number;
    attackerName: string;
    abilityId?: string | number;
    abilityNum?: 1 | 2;
    skillName?: string;
    manaCost?: number;
    isAoE?: boolean;
    newBoard?: { element: ElementType }[][];
  }) => {
    if (isPvP && pvpRoomInfo?.code) {
      setIsActionPendingServer(true);
      setPvpActionMenu(null);
      const starmonIdx = action.attackerIndex !== undefined ? action.attackerIndex : actingStepIndex;
      const targetMonIdx = action.targetIdx !== undefined ? action.targetIdx : selectedEnemyIndex;

      const mySlot = pvpMySlotRef.current;
      const targetSlot: 1 | 2 = (3 - mySlot) as 1 | 2;
      const serverActionType = action.actionType === 'SKILL' ? 'use_ability' : 'physical_attack';

      const payload = {
        targetStarmonIndex: targetMonIdx,
        orbSwitches: action.orbSwitches || [],
        abilityId: action.abilityId ?? action.skillName ?? action.abilityNum,
        abilityNum: action.abilityNum,
        skillName: action.skillName,
        manaCost: action.manaCost,
        elem: action.elem,
        matchCount: action.matchCount,
        damage: action.damage,
        isCrit: action.isCrit,
        isAoE: action.isAoE,
        newBoard: action.newBoard,
        // Bind the proposed board transition to the exact server snapshot it
        // was calculated from. The server rejects it if a newer action won.
        boardVersion: boardVersionRef.current,
      };

      sendPvpMessage({
        type: 'starmon_action',
        room_code: pvpRoomInfo.code,
        phase: pvpFlowPhaseRef.current,
        turn: pvpTurnNumberRef.current,
        subPhase: pvpSubPhaseRef.current,
        player_id: pvpRoomInfo.myPlayerId,
        player_name: pvpRoomInfo.myPlayerName,
        playerSlot: mySlot,
        attackerSlot: mySlot,
        targetSlot,
        starmonIndex: starmonIdx,
        actionType: serverActionType,
        payload,
        action,
      });

      syncPvpActionToSupabase(pvpRoomInfo.code, {
        ...action,
        phase: pvpFlowPhaseRef.current,
        senderId: pvpRoomInfo.myPlayerId,
        senderName: pvpRoomInfo.myPlayerName,
        actorSlot: mySlot,
        targetSlot,
        starmonIndex: starmonIdx,
        targetStarmonIndex: targetMonIdx,
      }).catch(err => console.warn('Supabase sync action err:', err));
    }
  }, [isPvP, pvpRoomInfo, actingStepIndex, selectedEnemyIndex, sendPvpMessage]);

  // PvP Battle Step Countdown Timer (30s per step)
  useEffect(() => {
    if (!isPvP || phase !== 'phase2_combat' || pvpTurnTimer === null || pvpWaitingForPhaseTransition) return;
    if (pvpTurnTimer <= 0) {
      setPvpWaitingForPhaseTransition(true);
      setTurnAnnouncement('Đang kết nối, vui lòng đợi');
      const timeoutKey = `${pvpRoomInfo?.code || ''}:${pvpFlowPhaseRef.current}`;
      if (pvpTimeoutRequestedPhaseRef.current !== timeoutKey) {
        pvpTimeoutRequestedPhaseRef.current = timeoutKey;
        sendPvpMessage({
          type: 'PVP_PHASE_TIMEOUT',
          room_code: pvpRoomInfo?.code,
          player_id: pvpRoomInfo?.myPlayerId,
          phase: pvpFlowPhaseRef.current,
        });
        sendPvpMessage({
          type: 'PVP_REQUEST_PHASE_SYNC',
          room_code: pvpRoomInfo?.code,
          phase: pvpFlowPhaseRef.current,
          timerExpired: true,
        });
      }
      if (pvpAttackerSlotRef.current === pvpMySlotRef.current && pvpActionMenu !== null) {
        sound.playWrong();
        setPvpActionMenu(null);
        sendPvpMessage({
          type: 'PVP_TURN_END',
          room_code: pvpRoomInfo?.code,
          player_id: pvpRoomInfo?.myPlayerId,
          actor_slot: pvpMySlotRef.current,
          phase: pvpFlowPhaseRef.current,
          turn: pvpTurnNumberRef.current,
          step: actingStepIndex + 1,
          starmon_index: actingStepIndex,
        });
        setTurnStatusType('missed');
        setTurnAnnouncement('Đang kết nối, vui lòng đợi');
      }
      return;
    }

    const t = setInterval(() => {
      setPvpTurnTimer(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(t);
  }, [isPvP, phase, pvpTurnTimer, pvpActionMenu, pvpWaitingForPhaseTransition, pvpRoomInfo?.myPlayerId, pvpRoomInfo?.code, actingStepIndex, sendPvpMessage]);

  // Phase n.3 -> (n+1).1 is a server-side transition. Periodically compare
  // the local phase with the server so a missed websocket broadcast cannot
  // leave either player waiting indefinitely at the end of a turn.
  useEffect(() => {
    if (!isPvP || !pvpRoomInfo?.code) return;
    const syncTimer = setInterval(() => {
      if (Date.now() - lastPvpSocketAckAtRef.current > 10000) {
        const socket = pvpWsRef.current;
        if (socket && socket.readyState === WebSocket.OPEN) socket.close();
        return;
      }
      sendPvpMessage({
        type: 'PVP_REQUEST_PHASE_SYNC',
        room_code: pvpRoomInfo.code,
        phase: pvpFlowPhaseRef.current,
        battlePhase: phase,
        step: pvpSyncedStepRef.current,
      });
    }, 2500);
    return () => clearInterval(syncTimer);
  }, [isPvP, phase, pvpRoomInfo?.code, sendPvpMessage]);

  // Strictly unlocked Starmons can participate in combat (in PvP always ensure 3 Starmons for 3 questions)
  const unlockedOnly = (playerStarmons || []).filter(s => s && s.unlocked);
  const fallbackMon = (playerStarmons && playerStarmons[0]) || STARMON_ROSTER[0];
  const battleRoster = isPvP
    ? (unlockedOnly.length >= 3
        ? unlockedOnly.slice(0, 3)
        : [...unlockedOnly, ...STARMON_ROSTER.filter(r => !unlockedOnly.some(u => u.id === r.id))].slice(0, 3))
    : (unlockedOnly.length > 0 ? unlockedOnly.slice(0, 3) : [fallbackMon]);
  const partySize = Math.max(1, Math.min(3, battleRoster.length));

  // Player team in battle (Max Mana = 200)
  const [playerTeam, setPlayerTeam] = useState<Starmon[]>(() =>
    battleRoster.map((s, idx) => {
      const monId = s?.id || s?.avatarSeed || 'coralus';
      const template = STARMON_ROSTER.find(r => r.id === monId || r.avatarSeed === monId) || STARMON_ROSTER[0];
      const maxHp = s?.maxHp || template.maxHp || 350;
      const initialMana = isPvP
        ? (pvpRoomInfo?.isHost ? 0 : 20)
        : Math.min(200, Math.max(50, s?.currentMana || 50));
      return {
        ...template,
        ...s,
        id: s?.id || `${template.id}_${idx}`,
        avatarSeed: s?.avatarSeed || template.avatarSeed,
        maxMana: 200,
        maxHp: maxHp,
        currentHp: (s?.currentHp !== undefined && s.currentHp > 0) ? s.currentHp : maxHp,
        currentMana: initialMana,
        skill1: (s?.skill1 && s.skill1.name) ? s.skill1 : template.skill1,
        skill2: (s?.skill2 && s.skill2.name) ? s.skill2 : template.skill2,
        passive: (s?.passive && s.passive.name) ? s.passive : template.passive,
      };
    })
  );
  playerTeamRef.current = playerTeam;

  // TIDECRUSH BUFF & COOLDOWN MECHANIC:
  // Lasts 3 turns, cannot be used again for 3 turns
  const [tidecrushBuffTurns, setTidecrushBuffTurns] = useState<number>(0);
  const [tidecrushCooldownTurns, setTidecrushCooldownTurns] = useState<number>(0);
  const [tidecrushBonusAtk, setTidecrushBonusAtk] = useState<number>(0);

  // Additional active shield status points
  const [teamShieldPoints, setTeamShieldPoints] = useState<number>(0);
  const [coralusShieldTurns, setCoralusShieldTurns] = useState<number>(0);

  // Bubbleboon & Trojan Flare combat states
  const [bubbleboonDoubleStrikeTurns, setBubbleboonDoubleStrikeTurns] = useState<number>(0);
  const [bubbleboonRemainingSwaps, setBubbleboonRemainingSwaps] = useState<number>(1);
  const [trojanShieldPoints, setTrojanShieldPoints] = useState<number>(0);
  const [trojanCooldownTurns, setTrojanCooldownTurns] = useState<number>(0);
  const [trojanHasClarity, setTrojanHasClarity] = useState<boolean>(false);
  const [trojanNextTurnResonance, setTrojanNextTurnResonance] = useState<boolean>(false);
  const [trojanCurrentResonance, setTrojanCurrentResonance] = useState<boolean>(false);

  // Coralus Skill 1 Aqua Pincer: 25% DEF reduction for 2 turns
  const [enemyDefDebuffs, setEnemyDefDebuffs] = useState<Record<number, { percent: number; turns: number }>>({});
  const [playerDefDebuffs, setPlayerDefDebuffs] = useState<Record<number, { percent: number; turns: number }>>({});

  // Victory Chest States: 100-500 Gold, 3-8 Cards of a random Starmon
  const [chestOpened, setChestOpened] = useState<boolean>(false);
  const [chestRewards, setChestRewards] = useState<{
    gold: number;
    cards: number;
    starmon: Starmon;
    isUnobtained: boolean;
  } | null>(null);

  // Battle Performance Summary State
  const [performanceStats, setPerformanceStats] = useState<BattlePerformanceStats>({
    damagePerElement: {
      Fire: 0,
      Water: 0,
      Electric: 0,
      Wind: 0,
      Earth: 0,
      Metal: 0,
    },
    totalDamageDealt: 0,
    ieltsQuestionsTotal: 0,
    ieltsQuestionsCorrect: 0,
    ieltsSpeakingCount: 0,
    ieltsSpeakingBandSum: 0,
    totalMatchesMade: 0,
    totalOrbsCleared: 0,
    maxMatchSize: 0,
    totalTurns: 0,
  });

  const [victoryViewTab, setVictoryViewTab] = useState<'rewards' | 'performance'>('rewards');

  const recordDamageDealt = (element: ElementType, amount: number) => {
    setPerformanceStats(prev => ({
      ...prev,
      damagePerElement: {
        ...prev.damagePerElement,
        [element]: (prev.damagePerElement[element] || 0) + amount,
      },
      totalDamageDealt: prev.totalDamageDealt + amount,
    }));
  };

  const recordPlayerMonDamageDealt = (idx: number, dmg: number) => {
    setPlayerDmgDealt(prev => ({ ...prev, [idx]: (prev[idx] || 0) + dmg }));
  };

  const recordPlayerMonDamageTaken = (idx: number, dmg: number) => {
    setPlayerDmgTaken(prev => ({ ...prev, [idx]: (prev[idx] || 0) + dmg }));

    // Zapwing Passive: Static Feather - Zapwing gains 10% ATK every time it takes DMG
    if (dmg > 0) {
      setPlayerTeam(prev =>
        prev.map((mon, mIdx) => {
          if (mIdx === idx && (mon.id === 'zapwing' || mon.avatarSeed === 'zapwing') && mon.currentHp > 0) {
            const atkBonus = Math.max(1, Math.round(mon.baseAtk * 0.1));
            addBattleLog({
              phase: 'combat',
              source: 'player',
              unitName: 'Zapwing',
              actionType: 'status',
              message: `⚡ Static Feather: Zapwing gained +${atkBonus} ATK (+10%) after taking damage!`,
            });
            return { ...mon, baseAtk: mon.baseAtk + atkBonus };
          }
          return mon;
        })
      );
    }
  };

  const recordEnemyMonDamageDealt = (idx: number, dmg: number, elem: ElementType) => {
    setEnemyDmgDealt(prev => ({ ...prev, [idx]: (prev[idx] || 0) + dmg }));
    setEnemyDamagePerElement(prev => ({ ...prev, [elem]: (prev[elem] || 0) + dmg }));
  };

  const recordEnemyMonDamageTaken = (idx: number, dmg: number) => {
    setEnemyDmgTaken(prev => ({ ...prev, [idx]: (prev[idx] || 0) + dmg }));

    // Enemy Zapwing Static Feather
    if (dmg > 0) {
      setEnemyTeam(prev =>
        prev.map((mon, mIdx) => {
          if (mIdx === idx && (mon.id === 'zapwing' || mon.avatarSeed === 'zapwing') && mon.currentHp > 0) {
            const atkBonus = Math.max(1, Math.round(mon.baseAtk * 0.1));
            return { ...mon, baseAtk: mon.baseAtk + atkBonus };
          }
          return mon;
        })
      );
    }
  };

  const getOriginalBaseStats = (mon: Starmon): Starmon => {
    if (allRosterStarmons) {
      const found = allRosterStarmons.find(s => s.id === mon.id || s.avatarSeed === mon.avatarSeed);
      if (found) return found;
    }
    const foundRoster = STARMON_ROSTER.find(s => s.id === mon.id || s.avatarSeed === mon.avatarSeed);
    if (foundRoster) return foundRoster;
    return mon;
  };

  // ACTIVE STATUS EFFECTS STATE (ONLY DISPLAYED WHEN ACTIVE)
  const [playerBurnTurns, setPlayerBurnTurns] = useState<Record<number, number>>({});
  const [enemyBurnTurns, setEnemyBurnTurns] = useState<Record<number, number>>({});
  const [playerPoisonTurns, setPlayerPoisonTurns] = useState<Record<number, number>>({});
  const [enemyPoisonTurns, setEnemyPoisonTurns] = useState<Record<number, number>>({});
  const [vinedraCritBonusTurns, setVinedraCritBonusTurns] = useState<Record<number, number>>({});
  const [playerPiercingTurns, setPlayerPiercingTurns] = useState<Record<number, number>>({});
  const [teamShieldTurns, setTeamShieldTurns] = useState<number>(0);
  const [showPiercingAnim, setShowPiercingAnim] = useState<boolean>(false);
  const [inspectingStatusEffect, setInspectingStatusEffect] = useState<{
    name: string;
    icon: React.ReactNode;
    badgeClass: string;
    description: string;
    turnsRemaining: number;
    value?: string;
    targetName: string;
  } | null>(null);

  // STONE GOLEM MECHANICS
  // Unyielding Granite: 5% Max HP shield each round, 25% Max HP shield for 3 turns on death
  // Active 1: Stone Crash (60 Mana) -> 120% DMG, 30% chance to stun
  // Active 2: Fortress Bulwark (90 Mana) -> Taunt for 2 turns, 18% Max HP shield for 2 turns
  const [playerStoneGolemTauntTurns, setPlayerStoneGolemTauntTurns] = useState<number>(0);
  const [enemyStoneGolemTauntTurns, setEnemyStoneGolemTauntTurns] = useState<number>(0);
  const [golemDeathShieldTurns, setGolemDeathShieldTurns] = useState<number>(0);
  const [stunnedPlayerIndices, setStunnedPlayerIndices] = useState<number[]>([]);
  const [stunnedEnemyIndices, setStunnedEnemyIndices] = useState<number[]>([]);
  const playerGolemDeathApplied = useRef<boolean>(false);
  const enemyGolemDeathApplied = useRef<boolean>(false);

  // MINEACLE & CYBORGNID & ZEPHYRION MECHANICS
  const [playerMineacleTauntTurns, setPlayerMineacleTauntTurns] = useState<number>(0);
  const [enemyMineacleTauntTurns, setEnemyMineacleTauntTurns] = useState<number>(0);
  const [playerCyborgnidDmgAbsorbed, setPlayerCyborgnidDmgAbsorbed] = useState<number>(0);
  const playerMineacleDeathApplied = useRef<boolean>(false);
  const enemyMineacleDeathApplied = useRef<boolean>(false);

  // MOSSLOTH & KHEPRI MECHANICS
  const [playerMosslothTauntTurns, setPlayerMosslothTauntTurns] = useState<number>(0);
  const [playerMosslothRegenTurns, setPlayerMosslothRegenTurns] = useState<number>(0);
  const [playerKhepriShroudTurns, setPlayerKhepriShroudTurns] = useState<number>(0);
  const [sunEffectTurns, setSunEffectTurns] = useState<number>(0);
  const [playerHealingBlockTurns, setPlayerHealingBlockTurns] = useState<Record<number, number>>({});
  const [enemyHealingBlockTurns, setEnemyHealingBlockTurns] = useState<Record<number, number>>({});

  // Ability detail inspection state
  const [selectedAbilityDetail, setSelectedAbilityDetail] = useState<{
    mon: Starmon;
    monIndex: number;
    skillNum: 1 | 2;
  } | null>(null);

  // Unlocked status per position in battle party (1, 2, or 3)
  const [unlockedPositions, setUnlockedPositions] = useState<boolean[]>(() => Array(partySize).fill(false));

  // Turn-based execution in Phase 2:
  // Steps 0..N-1: Player Starmons act
  // Step N: Opponent Team acts (Moves Orbs & Casts Abilities like player!)
  const [turnAnnouncement, setTurnAnnouncement] = useState<string>('');
  const [turnStatusType, setTurnStatusType] = useState<'normal' | 'missed' | 'enemy'>('normal');

  // AI Opponent highlighted tiles & active enemy index
  const [aiHighlightedTiles, setAiHighlightedTiles] = useState<{ row: number; col: number }[] | null>(null);
  const [activeEnemyAttackerIndex, setActiveEnemyAttackerIndex] = useState<number | null>(null);
  const enemyAttackerQueueRef = useRef<number[]>([]);

  // Opponent Team (Stacked vertically on right side)
  const [enemyTeam, setEnemyTeam] = useState<Starmon[]>(() => {
    if (pvpRoomInfo?.opponentStarmons && pvpRoomInfo.opponentStarmons.length > 0) {
      return pvpRoomInfo.opponentStarmons.map((s, sIdx) => {
        const monId = typeof s === 'string' ? s : (s?.id || s?.avatarSeed || 'coralus');
        const fullTemplate = STARMON_ROSTER.find(r => r.id === monId || r.avatarSeed === monId) || STARMON_ROSTER[sIdx % STARMON_ROSTER.length] || STARMON_ROSTER[0];
        const baseObj: any = typeof s === 'object' && s !== null ? s : {};
        const maxHp = Number(baseObj.maxHp) || fullTemplate.maxHp || 340;
        return {
          ...fullTemplate,
          ...baseObj,
          id: baseObj.id || `${fullTemplate.id}_${sIdx}`,
          name: baseObj.name || (pvpRoomInfo ? `${pvpRoomInfo.opponentName || pvpRoomInfo.hostName}'s ${fullTemplate.name}` : fullTemplate.name),
          avatarSeed: baseObj.avatarSeed || fullTemplate.avatarSeed,
          currentHp: maxHp,
          maxHp: maxHp,
          baseAtk: Number(baseObj.baseAtk) || fullTemplate.baseAtk || 45,
          def: Number(baseObj.def) || fullTemplate.def || 20,
          currentMana: isPvP
            ? (pvpRoomInfo?.isHost ? 20 : 0)
            : Math.min(200, Math.max(30, Number(baseObj.currentMana) || 30)),
          maxMana: 200,
          unlocked: true,
          skill1: (baseObj.skill1 && baseObj.skill1.name) ? baseObj.skill1 : fullTemplate.skill1,
          skill2: (baseObj.skill2 && baseObj.skill2.name) ? baseObj.skill2 : fullTemplate.skill2,
          passive: (baseObj.passive && baseObj.passive.name) ? baseObj.passive : fullTemplate.passive,
        };
      });
    }
    return [
      {
        id: 'enemy_wyrm',
        name: pvpRoomInfo ? `${pvpRoomInfo.opponentName || pvpRoomInfo.hostName}'s Wyrm` : 'Aqua Wyrm',
      title: 'Azure Serpent',
      element: 'Water',
      role: 'DPS',
      level: 1,
      cards: 0,
      baseAtk: 46,
      maxHp: 340,
      def: 22,
      currentHp: 340,
      currentMana: 35,
      maxMana: 200,
      avatarSeed: 'tidecrush',
      unlocked: true,
      passive: { name: 'Cold Mist', description: 'Reduces enemy accuracy', tag: 'Mist' },
      skill1: { id: 'w1', name: 'Aqua Surge', description: 'Surges forward with water blades', manaCost: 20, damageMultiplier: 1.4, targetType: 'single' },
      skill2: { id: 'w2', name: 'Tsunami Wave', description: 'Waves crash across all foes', manaCost: 50, damageMultiplier: 2.1, targetType: 'aoe' },
    },
    {
      id: 'enemy_golem',
      name: 'Stone Golem',
      title: 'Ancient Granite Titan',
      element: 'Earth',
      role: 'Guardian',
      level: 1,
      cards: 0,
      baseAtk: 48,
      maxHp: 520,
      def: 42,
      currentHp: 520,
      currentMana: 30,
      maxMana: 200,
      avatarSeed: 'stone_golem',
      unlocked: true,
      passive: {
        name: 'Unyielding Granite',
        description: 'Gains 5% max HP shield at round start. On death grants 25% max HP shield to allies for 3 turns.',
        tag: 'Granite Shield'
      },
      skill1: {
        id: 'stone_crash',
        name: 'Stone Crash',
        description: 'Deals 120% Earth Physical Damage with 30% chance to stun',
        manaCost: 60,
        damageMultiplier: 1.2,
        targetType: 'single',
        statusEffect: 'Stun (30%)'
      },
      skill2: {
        id: 'fortress_bulwark',
        name: 'Fortress Bulwark',
        description: 'Taunts all enemies for 2 turns and gains 18% max HP shield for 2 turns',
        manaCost: 90,
        damageMultiplier: 0,
        targetType: 'self',
        statusEffect: 'Taunt & Shield (2t)'
      },
    },
    {
      id: 'enemy_volt',
      name: 'Volt Saber',
      title: 'Thunder Panther',
      element: 'Electric',
      role: 'DPS',
      level: 1,
      cards: 0,
      baseAtk: 52,
      maxHp: 310,
      def: 20,
      currentHp: 310,
      currentMana: 25,
      maxMana: 200,
      avatarSeed: 'voltlynx',
      unlocked: true,
      passive: { name: 'Static Charge', description: '+50% Crit DMG bonus', tag: 'Crit' },
      skill1: { id: 'k1', name: 'Thunder Claw', description: 'Strikes with electrified claws', manaCost: 20, damageMultiplier: 1.5, targetType: 'single' },
      skill2: { id: 'k2', name: 'Lightning Storm', description: 'Calls down thunderbolts', manaCost: 50, damageMultiplier: 2.2, targetType: 'aoe' },
    },
  ];
});
  const pveBaseEnemyTeamRef = useRef<Starmon[]>(enemyTeam.map(enemy => ({ ...enemy })));
  const pveLevelTransitioningRef = useRef(false);

  const [tutorialHasSwappedOrbs, setTutorialHasSwappedOrbs] = useState(false);
  const [tutorialHasRecordedSpeaking, setTutorialHasRecordedSpeaking] = useState(false);
  const [tutorialRound, setTutorialRound] = useState<1 | 2>(1);
  const [tutorialMcqCorrect, setTutorialMcqCorrect] = useState(false);
  const [isTutorial1Complete, setIsTutorial1Complete] = useState<boolean>(false);

  // Request microphone access proactively on battle mount
  useEffect(() => {
    onRequestMicrophone?.();
  }, [onRequestMicrophone]);

  const lastSetupStageRef = useRef<1 | 2 | 3 | null>(null);

  // Handle Tutorial Stage switching and setup
  useEffect(() => {
    if (tutorialStage && lastSetupStageRef.current !== tutorialStage) {
      lastSetupStageRef.current = tutorialStage;
      setPhase('phase1_quiz');
      setCurrentRoundNumber(1);
      setUnlockedPositions([false, false, false]);
      setActiveQuestionIndex(0);
      setAnsweredState({});
      setQuestionTimer(QUESTION_TIME_LIMIT);
      setChestOpened(false);
      setChestRewards(null);
      setTutorialHasSwappedOrbs(false);
      setTutorialHasRecordedSpeaking(false);
      setTutorialRound(1);
      setTutorialMcqCorrect(false);
      setIeltsAiResult(null);
      setSpokenTranscript('');

      if (tutorialStage === 1) {
        // TUTORIAL 1: Exactly 1 Starmon active: Voltlynx (special tutorial guest)
        const voltlynxTemplate = STARMON_ROSTER.find(s => s.id === 'voltlynx') || STARMON_ROSTER[0];
        setPlayerTeam([{
          ...voltlynxTemplate,
          level: 1,
          cards: 0,
          currentHp: voltlynxTemplate.maxHp,
          currentMana: 60,
          maxMana: 200,
          unlocked: true,
        }]);

        // Single enemy for training
        setEnemyTeam([{
          id: 'tutorial_wyrm',
          name: 'Aqua Wyrm',
          title: 'Training Wyrm',
          element: 'Water',
          role: 'DPS',
          level: 1,
          cards: 0,
          baseAtk: 24,
          maxHp: 320,
          def: 12,
          currentHp: 320,
          currentMana: 0,
          maxMana: 200,
          avatarSeed: 'tidecrush',
          unlocked: true,
          passive: { name: 'Practice Target', description: 'Training dummy for Combat Academy.', tag: 'Dummy' },
          skill1: { id: 'tw1', name: 'Aqua Surge', description: 'Surges with water', manaCost: 20, damageMultiplier: 1.2, targetType: 'single' },
          skill2: { id: 'tw2', name: 'Tsunami Wave', description: 'Waves crash', manaCost: 50, damageMultiplier: 1.8, targetType: 'aoe' },
        }]);

        const tut1MCQ: QuizQuestion = {
          id: 'tut1_q1_mcq',
          type: 'mcq',
          title: 'Grammar Foundation',
          category: 'Grammar',
          question: 'Choose the correct word: "The researcher conducted several _____ before publishing the results."',
          options: ['experiments', 'experimented', 'experimenting', 'experimental'],
          correctIndex: 0,
          assignedStarmonIndex: 0,
        };
        // Round 1 starts strictly with ONLY the MCQ question!
        setCurrentQuizSet([tut1MCQ]);
        setTutorialRound(1);
        setUnlockedPositions([false]);
        setTurnAnnouncement('TUTORIAL 1: Phase 1 MCQ - Select the correct answer to attack!');
      } else if (tutorialStage === 2) {
        const threeRoster = playerStarmons.length >= 3 ? playerStarmons.slice(0, 3) : STARMON_ROSTER.slice(0, 3);
        setPlayerTeam(threeRoster.map(s => ({
          ...s,
          currentHp: s.maxHp,
          currentMana: 140, // 140 mana to cast abilities easily
          maxMana: 200,
        })));
        setCurrentQuizSet(getRandomQuizSet(3));
        setTurnAnnouncement('TUTORIAL 2: In a battle party, turn order depends on questions! Click skills to view & cast abilities.');
      } else if (tutorialStage === 3) {
        const threeRoster = playerStarmons.length >= 3 ? playerStarmons.slice(0, 3) : STARMON_ROSTER.slice(0, 3);
        setPlayerTeam(threeRoster.map(s => ({
          ...s,
          currentHp: s.maxHp,
          currentMana: 100,
          maxMana: 200,
        })));
        setCurrentQuizSet(getRandomQuizSet(3));
        setTurnAnnouncement('TUTORIAL 3: Water ➔ Fire ➔ Metal ➔ Earth ➔ Wind ➔ Electric ➔ Water! Same-Elem (+10%), Counter (+10%), Resist (-10%).');
      }
    }
  }, [tutorialStage]);

  // ==========================================
  // REAL-TIME PVP WEBSOCKET CONNECTION & SYNCHRONIZATION
  // ==========================================
  useEffect(() => {
    if (!isPvP || !pvpRoomInfo?.code) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = (import.meta as any).env?.VITE_WS_URL || `${protocol}//${window.location.host}/ws`;
    let activeSocket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(wsUrl);
      activeSocket = ws;
      pvpWsRef.current = ws;

      ws.onopen = () => {
      if (disposed || activeSocket !== ws) return;
      lastPvpSocketAckAtRef.current = Date.now();
      setPvpIsConnected(true);
      const initialSlot: 1 | 2 = pvpRoomInfo.isHost ? 1 : 2;
      setPvpMySlot(initialSlot);
      pvpMySlotRef.current = initialSlot;
      ws.send(JSON.stringify({
        type: 'PVP_JOIN_BATTLE',
        room_code: pvpRoomInfo.code,
        player_id: pvpRoomInfo.myPlayerId || 'player',
        player_name: pvpRoomInfo.myPlayerName || pvpRoomInfo.hostName,
        is_host: Boolean(pvpRoomInfo.isHost),
        slot: initialSlot,
        username: pvpRoomInfo.pvpAuth?.username,
        device_id: pvpRoomInfo.pvpAuth?.deviceId,
        auth_token: pvpRoomInfo.pvpAuth?.sessionToken,
        starmons: playerTeamRef.current,
      }));
    };

      ws.onmessage = (event) => {
      if (disposed || activeSocket !== ws) return;
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'match_start':
          case 'MATCH_STARTED': {
            const v = msg.boardVersion ?? msg.version ?? 1;
            if (v >= boardVersionRef.current) {
              boardVersionRef.current = v;
              const deserialized = deserializeBoard(msg.boardSnapshot || msg.grid || msg.board || msg.matchState?.board);
              if (deserialized) {
                setBoard(deserialized);
              } else if (typeof msg.seed === 'number') {
                setBoard(generateBoardFromSeed(msg.seed));
              }
            }
            break;
          }

          case 'slot_assigned':
          case 'role_assigned': {
            if (typeof msg.slot === 'number') {
              const s: 1 | 2 = msg.slot === 2 ? 2 : 1;
              setPvpMySlot(s);
              pvpMySlotRef.current = s;
            }
            break;
          }

          case 'resync': {
            const phaseStr = String(msg.phase || pvpFlowPhaseRef.current || '1.1');
            if (isEarlierPvpPhase(phaseStr, pvpFlowPhaseRef.current)) break;
            const parts = phaseStr.split('.');
            const turnNum = parseInt(parts[0], 10) || 1;
            const sub = (parseInt(parts[1], 10) || 1) as 1 | 2 | 3;

            setPvpTurnNumber(turnNum);
            pvpTurnNumberRef.current = turnNum;
            setCurrentRoundNumber(turnNum);
            currentRoundNumberRef.current = turnNum;
            logTurnRef.current = turnNum;
            setPvpSubPhase(sub);
            pvpSubPhaseRef.current = sub;
            pvpSyncedStepRef.current = sub === 1 ? 1 : null;
            setPvpFlowPhaseString(phaseStr);
            pvpFlowPhaseRef.current = phaseStr;
            pvpTimeoutRequestedPhaseRef.current = null;
            setPvpWaitingForPhaseTransition(false);

            if (sub === 1) {
              setIsActionPendingServer(false);
              setPvpWaitingForOpponentSpeaking(false);
              setPvpActionMenu(null);
              setPhase('phase1_quiz');
              preparePvpQuizForTurn(turnNum, msg.time_limit);
            } else if (sub === 2 || sub === 3) {
              setIsActionPendingServer(false);
              setPvpWaitingForOpponentSpeaking(false);
              setPhase('phase2_combat');
            }

            if (msg.attackerSlot) highlightAttacker(msg.attackerSlot);
            if (msg.targetSlot) highlightTarget(msg.targetSlot);

            const incomingV = msg.boardVersion ?? msg.version ?? 0;
            if (incomingV >= boardVersionRef.current) {
              boardVersionRef.current = incomingV;
              const deserialized = deserializeBoard(msg.boardSnapshot || msg.grid || msg.board);
              if (deserialized) {
                setBoard(deserialized);
              }
            }

            if (Array.isArray(msg.myResults)) {
              pvpQuizAnswersRef.current = msg.myResults;
              setUnlockedPositions(msg.myResults);
            }

            if (Array.isArray(msg.p1_hp) && Array.isArray(msg.p2_hp)) {
              updateHpsFromArrays(msg.p1_hp, msg.p2_hp, msg.p1_mana, msg.p2_mana, msg.boardVersion ?? msg.version);
            }
            break;
          }

          case 'PVP_MATCH_STATE_SYNC': {
            lastPvpSocketAckAtRef.current = Date.now();
            reconnectAttempt = 0;
            if (isEarlierPvpPhase(msg.phase, pvpFlowPhaseRef.current)) break;
            if (typeof msg.slot === 'number') {
              const s: 1 | 2 = msg.slot === 2 ? 2 : 1;
              setPvpMySlot(s);
              pvpMySlotRef.current = s;
            }
            if (typeof msg.phase === 'string') {
              setPvpFlowPhaseString(msg.phase);
              pvpFlowPhaseRef.current = msg.phase;
              const parts = msg.phase.split('.');
              const tNum = parseInt(parts[0], 10) || 1;
              const sPhase = (parseInt(parts[1], 10) || 1) as 1 | 2 | 3;
              setPvpTurnNumber(tNum);
              pvpTurnNumberRef.current = tNum;
              setCurrentRoundNumber(tNum);
              currentRoundNumberRef.current = tNum;
              logTurnRef.current = tNum;
              setPvpSubPhase(sPhase);
              pvpSubPhaseRef.current = sPhase;
              pvpSyncedStepRef.current = sPhase === 1 ? 1 : null;
              if (sPhase === 1) {
                setIsActionPendingServer(false);
                setPvpWaitingForOpponentSpeaking(false);
                setPvpActionMenu(null);
                setPhase('phase1_quiz');
                preparePvpQuizForTurn(tNum, msg.time_limit);
                if (typeof msg.time_limit === 'number') setQuestionTimer(msg.time_limit);
              } else if (sPhase === 2 || sPhase === 3) {
                setIsActionPendingServer(false);
                setPvpWaitingForOpponentSpeaking(false);
                setPhase('phase2_combat');
              }
            }
            const v = msg.boardVersion ?? msg.version ?? msg.state?.boardVersion ?? 1;
            if (v >= boardVersionRef.current) {
              boardVersionRef.current = v;
              const deserialized = deserializeBoard(msg.boardSnapshot || msg.grid || msg.board || msg.state?.board);
              if (deserialized) {
                setBoard(deserialized);
              } else if (typeof msg.seed === 'number' || typeof msg.state?.seed === 'number') {
                const s = msg.seed ?? msg.state?.seed;
                setBoard(generateBoardFromSeed(s));
              }
            }
            // A reconnect needs the authoritative roster as well as the board:
            // local opponent data may still be at full HP or in a different order.
            if (v >= boardVersionRef.current) {
              applyAuthoritativeTeamsFromMatchState(msg.state || msg.matchState);
            }
            if (Array.isArray(msg.p1_hp) && Array.isArray(msg.p2_hp)) {
              updateHpsFromArrays(msg.p1_hp, msg.p2_hp, msg.p1_mana, msg.p2_mana, msg.boardVersion ?? msg.version);
            }
            break;
          }

          case 'PVP_WAITING_OPPONENT': {
            setPvpWaitingForOpponentSpeaking(true);
            break;
          }

          case 'phase_start':
          case 'phase_changed': {
            lastPvpSocketAckAtRef.current = Date.now();
            reconnectAttempt = 0;
            const phaseStr = String(msg.phase || '1.1');
            if (isEarlierPvpPhase(phaseStr, pvpFlowPhaseRef.current)) break;
            if (phaseStr !== pvpFlowPhaseRef.current) pvpSyncedStepRef.current = null;
            const parts = phaseStr.split('.');
            const turnNum = parseInt(parts[0], 10) || 1;
            const sub = (parseInt(parts[1], 10) || 1) as 1 | 2 | 3;

            setPvpTurnNumber(turnNum);
            pvpTurnNumberRef.current = turnNum;
            setCurrentRoundNumber(turnNum);
            currentRoundNumberRef.current = turnNum;
            logTurnRef.current = turnNum;
            setPvpSubPhase(sub);
            pvpSubPhaseRef.current = sub;
            setPvpFlowPhaseString(phaseStr);
            pvpFlowPhaseRef.current = phaseStr;

            const incomingV = msg.boardVersion ?? msg.version ?? 0;
            if (incomingV >= boardVersionRef.current) {
              boardVersionRef.current = incomingV;
              const deserialized = deserializeBoard(msg.boardSnapshot || msg.grid || msg.board);
              if (deserialized) {
                setBoard(deserialized);
              }
            }

            if (Array.isArray(msg.p1_hp) && Array.isArray(msg.p2_hp)) {
              updateHpsFromArrays(msg.p1_hp, msg.p2_hp, msg.p1_mana, msg.p2_mana, msg.boardVersion ?? msg.version);
            }

            if (sub === 1) {
              pvpSyncedStepRef.current = 1;
              setIsActionPendingServer(false);
              setPvpWaitingForOpponentSpeaking(false);
              setPvpActionMenu(null);
              setPhase('phase1_quiz');
              if (preparePvpQuizForTurn(turnNum, msg.time_limit)) {
                setPvpTurnBanner(`Phase 1: Bạn có tổng cộng 2 phút để trả lời 3 câu hỏi. Nếu hết giờ, những câu chưa được trả lời sẽ bị tính là 0 điểm`);
                setTimeout(() => setPvpTurnBanner(null), 4000);
                sound.playSwoosh();
              }
              if (typeof msg.time_limit === 'number') setQuestionTimer(msg.time_limit);
            } else if (sub === 2 || sub === 3) {
              setIsActionPendingServer(false);
              setPvpWaitingForOpponentSpeaking(false);
              setPvpActionMenu(null);
              setPhase('phase2_combat');
              const attackerSlot: 1 | 2 = msg.attackerSlot === 1 || msg.attackerSlot === 2
                ? msg.attackerSlot
                : ((sub - 1) as 1 | 2);
              const targetSlot: 1 | 2 = (3 - attackerSlot) as 1 | 2;
              // CHỈ hiện thông báo phase, KHÔNG hiện step
              showPhaseBanner(`Phase ${phaseStr}`);
              highlightAttacker(attackerSlot);
              highlightTarget(targetSlot);
            }
            break;
          }

          case 'step_started': {
            setIsActionPendingServer(false);
            setPvpWaitingForOpponentSpeaking(false);
            setPhase('phase2_combat');

            const phaseStr = String(msg.phase || pvpFlowPhaseRef.current || '1.2');
            if (isEarlierPvpPhase(phaseStr, pvpFlowPhaseRef.current)) break;
            const phaseParts = phaseStr.split('.');
            const turnNum = parseInt(phaseParts[0], 10) || pvpTurnNumberRef.current || 1;
            const subPhase = (parseInt(phaseParts[1], 10) === 3 ? 3 : 2) as 2 | 3;
            if (phaseStr === pvpFlowPhaseRef.current && typeof msg.step === 'number' &&
                pvpSyncedStepRef.current !== null && msg.step < pvpSyncedStepRef.current) break;
            const attackerSlot: 1 | 2 = msg.attackerSlot === 2 ? 2 : (msg.attackerSlot === 1 ? 1 : ((subPhase - 1) as 1 | 2));
            const targetSlot: 1 | 2 = (3 - attackerSlot) as 1 | 2;

            setPvpTurnNumber(turnNum);
            pvpTurnNumberRef.current = turnNum;
            setCurrentRoundNumber(turnNum);
            currentRoundNumberRef.current = turnNum;
            logTurnRef.current = turnNum;
            setPvpSubPhase(subPhase);
            pvpSubPhaseRef.current = subPhase;
            setPvpFlowPhaseString(phaseStr);
            pvpFlowPhaseRef.current = phaseStr;
            highlightAttacker(attackerSlot);
            highlightTarget(targetSlot);

            const incomingV = msg.boardVersion ?? msg.version ?? 0;
            if (incomingV >= boardVersionRef.current) {
              boardVersionRef.current = incomingV;
              const deserialized = deserializeBoard(msg.boardSnapshot || msg.grid || msg.board);
              if (deserialized) {
                setBoard(deserialized);
              }
            }

            if (Array.isArray(msg.p1_hp) && Array.isArray(msg.p2_hp)) {
              updateHpsFromArrays(msg.p1_hp, msg.p2_hp, msg.p1_mana, msg.p2_mana, msg.boardVersion ?? msg.version);
            }

            const mySlot = pvpMySlotRef.current;
            const starmonIdx = typeof msg.starmonIndex === 'number'
              ? msg.starmonIndex
              : (typeof msg.starmon_index === 'number' ? msg.starmon_index : (msg.step ? msg.step - 1 : 0));
            pvpSyncedStepRef.current = typeof msg.step === 'number' ? msg.step : starmonIdx + 1;
            const stepTimeoutSec = msg.time_limit || 30;
            setPvpTurnTimer(stepTimeoutSec);
            setPvpWaitingForPhaseTransition(false);
            pvpTimeoutRequestedPhaseRef.current = null;
            const actorName = msg.actor_name || (attackerSlot === 1 ? 'Player 1' : 'Player 2');
            const starmonName = msg.starmon_name || playerTeamRef.current[starmonIdx]?.name || `Starmon #${starmonIdx + 1}`;

            if (mySlot !== attackerSlot) {
              // Target: inspect mode!
              setPvpActionMenu(null);
              setActiveEnemyAttackerIndex(starmonIdx);
              setTurnStatusType('enemy');
              setTurnAnnouncement(`Đến Lượt ${actorName}'s ${starmonName}`);
            } else {
              // Attacker: action enabled
              setActingStepIndex(starmonIdx);
              setTurnStatusType('normal');
              setTurnAnnouncement(`Đến Lượt ${actorName}'s ${starmonName}`);
            }
            break;
          }

          case 'board_tile_selected': {
            if (msg.slot !== pvpMySlotRef.current) {
              setAiHighlightedTiles(msg.tile ? [msg.tile] : null);
            }
            break;
          }

          case 'board_full_sync': {
            const v = msg.boardVersion ?? msg.version ?? 0;
            if (v >= boardVersionRef.current) {
              boardVersionRef.current = v;
              const deserialized = deserializeBoard(msg.boardSnapshot || msg.grid || msg.board);
              if (deserialized) {
                setBoard(deserialized);
              }
            }
            if (Array.isArray(msg.p1_hp) && Array.isArray(msg.p2_hp)) {
              updateHpsFromArrays(msg.p1_hp, msg.p2_hp, msg.p1_mana, msg.p2_mana, msg.boardVersion ?? msg.version);
            }
            break;
          }

          case 'PVP_PHASE_START_ANSWER':
          case 'PVP_PHASE_START_SPEAKING': {
            setIsActionPendingServer(false);
            setPvpWaitingForOpponentSpeaking(false);
            setPvpActionMenu(null);
            const nextRound = msg.turn || msg.round_number || pvpTurnNumberRef.current || currentRoundNumberRef.current;
            preparePvpQuizForTurn(nextRound, msg.time_limit);
            setCurrentRoundNumber(nextRound);
            currentRoundNumberRef.current = nextRound;
            setPvpTurnNumber(nextRound);
            pvpTurnNumberRef.current = nextRound;
            logTurnRef.current = nextRound;
            setPvpSubPhase(1);
            pvpSubPhaseRef.current = 1;
            pvpSyncedStepRef.current = 1;
            pvpAttackerSlotRef.current = null;
            pvpTargetSlotRef.current = null;
            setPvpHighlightedAttackerSlot(null);
            setPvpHighlightedTargetSlot(null);

            const phaseStr = msg.phase || `${nextRound}.1`;
            setPvpFlowPhaseString(phaseStr);
            pvpFlowPhaseRef.current = phaseStr;
            pvpTimeoutRequestedPhaseRef.current = null;
            setPvpWaitingForPhaseTransition(false);
            setPhase('phase1_quiz');

            const incomingV = msg.boardVersion ?? msg.version ?? 0;
            if (incomingV >= boardVersionRef.current) {
              boardVersionRef.current = incomingV;
              const deserialized = deserializeBoard(msg.boardSnapshot || msg.grid || msg.board);
              if (deserialized) {
                setBoard(deserialized);
              } else if (typeof msg.seed === 'number') {
                setBoard(generateBoardFromSeed(msg.seed));
              }
            }

            setPvpTurnBanner(`Phase 1: Bạn có tổng cộng 2 phút để trả lời 3 câu hỏi. Nếu hết giờ, những câu chưa được trả lời sẽ bị tính là 0 điểm`);
            setTimeout(() => setPvpTurnBanner(null), 4000);
            sound.playSwoosh();
            break;
          }

          // Step-based turn notification ("your_starmon_turn")
          case 'your_starmon_turn':
          case 'your_attack_turn':
          case 'PVP_YOUR_ATTACK_TURN': {
            setIsActionPendingServer(false);
            setPvpWaitingForOpponentSpeaking(false);
            setPhase('phase2_combat');

            const phaseStr = String(msg.phase || pvpFlowPhaseRef.current || '1.2');
            if (isEarlierPvpPhase(phaseStr, pvpFlowPhaseRef.current)) break;
            const phaseParts = phaseStr.split('.');
            const turnNum = parseInt(phaseParts[0], 10) || pvpTurnNumberRef.current || 1;
            const subPhase = (parseInt(phaseParts[1], 10) === 3 ? 3 : 2) as 2 | 3;
            if (phaseStr === pvpFlowPhaseRef.current && typeof msg.step === 'number' &&
                pvpSyncedStepRef.current !== null && msg.step < pvpSyncedStepRef.current) break;

            const attackerSlot: 1 | 2 = msg.attackerSlot === 1 || msg.attackerSlot === 2
              ? msg.attackerSlot
              : ((subPhase - 1) as 1 | 2); // server assignment; phase is a compatibility fallback
            const targetSlot: 1 | 2 = (3 - attackerSlot) as 1 | 2; // 1 <-> 2

            setPvpTurnNumber(turnNum);
            pvpTurnNumberRef.current = turnNum;
            setCurrentRoundNumber(turnNum);
            currentRoundNumberRef.current = turnNum;
            logTurnRef.current = turnNum;
            setPvpSubPhase(subPhase);
            pvpSubPhaseRef.current = subPhase;
            setPvpFlowPhaseString(phaseStr);
            pvpFlowPhaseRef.current = phaseStr;
            highlightAttacker(attackerSlot);
            highlightTarget(targetSlot);

            const incomingV = msg.boardVersion ?? msg.version ?? 0;
            if (incomingV >= boardVersionRef.current) {
              boardVersionRef.current = incomingV;
              const deserialized = deserializeBoard(msg.boardSnapshot || msg.grid || msg.board);
              if (deserialized) {
                setBoard(deserialized);
              }
            }

            if (Array.isArray(msg.p1_hp) && Array.isArray(msg.p2_hp)) {
              updateHpsFromArrays(msg.p1_hp, msg.p2_hp, msg.p1_mana, msg.p2_mana, msg.boardVersion ?? msg.version);
            }

            const mySlot = pvpMySlotRef.current;
            const starmonIdx = typeof msg.starmonIndex === 'number'
              ? msg.starmonIndex
              : (typeof msg.starmon_index === 'number' ? msg.starmon_index : 0);
            pvpSyncedStepRef.current = typeof msg.step === 'number' ? msg.step : starmonIdx + 1;
            const stepTimeoutSec = msg.time_limit || 30;
            setPvpTurnTimer(stepTimeoutSec);
            setPvpWaitingForPhaseTransition(false);
            pvpTimeoutRequestedPhaseRef.current = null;

            if (mySlot !== attackerSlot) {
              setPvpActionMenu(null);
              setActiveEnemyAttackerIndex(starmonIdx);
              setTurnStatusType('enemy');
              const actorName = msg.actor_name || (attackerSlot === 1 ? 'Player 1 (TRÁI)' : 'Player 2 (PHẢI)');
              const starmonName = msg.starmon_name || `Starmon #${starmonIdx + 1}`;
              setTurnAnnouncement(`Đến Lượt ${actorName}'s ${starmonName}`);
              break;
            }

            // Hiện UI chọn 1 trong 2 hành động cho đúng Starmon của step hiện tại (KHÔNG hiện thông báo step)
            showActionMenu({
              starmonIndex: starmonIdx,
              options: msg.options || ['physical_attack', 'use_ability'],
              validTargets: Array.isArray(msg.validTargetIndices) ? msg.validTargetIndices : [0, 1, 2],
              timer: stepTimeoutSec,
              actorName: msg.actor_name || pvpRoomInfo?.myPlayerName,
            });
            break;
          }

          case 'starmon_lost_turn':
          case 'PVP_STARMON_SKIPPED':
          case 'starmon_skipped':
          case 'PVP_ATTACK_SKIPPED':
          case 'starmon_timeout': {
            const rawSlot = msg.attackerSlot ?? msg.slot ?? msg.actor_slot;
            const skipSlot: 1 | 2 = (rawSlot === 2 || rawSlot === '2') ? 2 : 1;
            const monIdx = typeof msg.starmonIndex === 'number'
              ? msg.starmonIndex
              : (typeof msg.starmon_index === 'number' ? msg.starmon_index : (msg.index ?? 0));
            // Hiện hiệu ứng "mất lượt" cho starmon đó, KHÔNG hiện thông báo step
            showLostTurnEffect(monIdx, skipSlot, msg.reason);
            const isMyMon = skipSlot === pvpMySlotRef.current;
            const monName = msg.starmon_name || (isMyMon ? playerTeamRef.current[monIdx]?.name : `Starmon #${monIdx + 1}`) || 'Starmon';
            addBattleLog({
              phase: 'combat',
              source: isMyMon ? 'player' : 'enemy',
              unitName: monName,
              actionType: 'status',
              message: msg.reason === 'timeout'
                ? `⏱️ [Phase ${msg.phase || pvpFlowPhaseRef.current}] ${monName} mất lượt do hết 30s!`
                : `❌ [Phase ${msg.phase || pvpFlowPhaseRef.current}] ${monName} mất lượt do trả lời sai câu hỏi tương ứng!`,
            });
            break;
          }

          case 'board_update':
          case 'PVP_BOARD_UPDATED': {
            const v = Number(msg.boardVersion ?? msg.version);
            // Every authoritative board mutation carries a version. A legacy
            // or malformed event must not bypass stale-version checks.
            if (!Number.isInteger(v) || v <= 0 || v < boardVersionRef.current) {
              return;
            }
            boardVersionRef.current = v;
            const deserialized = deserializeBoard(msg.boardSnapshot || msg.patch?.grid || msg.grid || msg.board);
            if (deserialized) {
              setBoard(deserialized);
            }
            if (Array.isArray(msg.p1_hp) && Array.isArray(msg.p2_hp)) {
              updateHpsFromArrays(msg.p1_hp, msg.p2_hp, msg.p1_mana, msg.p2_mana, msg.boardVersion ?? msg.version);
            }
            break;
          }

          // 5. Client — Lắng nghe kết quả hành động của Starmon ("starmon_action_resolved")
          case 'starmon_action_resolved':
          case 'attack_resolved': {
            setIsActionPendingServer(false);
            setPvpActionMenu(null);
            playActionAnim(msg);
            updateBoardFromServer(msg);

            const phaseStr = String(msg.phase || pvpFlowPhaseRef.current || '1.2');
            const attackerSlot: 1 | 2 = msg.attackerSlot === 2 ? 2 : 1;
            const targetSlot: 1 | 2 = (3 - attackerSlot) as 1 | 2;
            const atkIdx = typeof msg.starmonIndex === 'number' ? msg.starmonIndex : (msg.attackerStarmonIndex ?? 0);
            const damage = msg.damage ?? msg.action?.damage ?? 0;
            const isMyAction = attackerSlot === pvpMySlotRef.current;
            const attackerName = isMyAction
              ? (playerTeamRef.current[atkIdx]?.name || `Starmon #${atkIdx + 1}`)
              : (msg.payload?.attackerName || msg.action?.attackerName || `Starmon #${atkIdx + 1}`);
            const skillName = msg.payload?.skillName || msg.action?.skillName;

            addBattleLog({
              phase: 'combat',
              source: isMyAction ? 'player' : 'enemy',
              unitName: attackerName,
              actionType: msg.actionType === 'use_ability' || skillName ? 'skill' : 'match',
              message: msg.actionType === 'use_ability' || skillName
                ? `⚡ [Phase ${phaseStr}] ${attackerName} (P${attackerSlot}) dùng kỹ năng "${skillName || 'Ability'}" gây ${damage} sát thương lên P${targetSlot}!`
                : `⚔️ [Phase ${phaseStr}] ${attackerName} (P${attackerSlot}) tấn công vật lý gây ${damage} sát thương lên P${targetSlot}!`,
            });
            break;
          }

          case 'PVP_ACTION_REJECTED': {
            setIsActionPendingServer(false);
            // Actions update some local UI optimistically. Pull the server's
            // full snapshot after a rejection to restore board, HP, mana and turn.
            sendPvpMessage({
              type: 'request_resync',
              room_code: pvpRoomInfo?.code,
              slot: pvpMySlotRef.current,
            });
            sound.playWrong();
            setTurnAnnouncement(`Lượt đi không hợp lệ: ${msg.reason || 'Chưa tới lượt của bạn'}`);
            break;
          }

          case 'ERROR': {
            setIsActionPendingServer(false);
            setPvpWaitingForOpponentSpeaking(false);
            setPvpTurnBanner(msg.message || 'Không thể kết nối vào trận PvP.');
            break;
          }

          case 'answer_all_done': {
            setIsActionPendingServer(false);
            setPvpWaitingForOpponentSpeaking(true);
            setPvpTurnBanner(msg.message || 'Bạn đã nộp bài. Đang chờ hết 120s Phase 1...');
            break;
          }

          case 'PVP_ANSWER_SUBMITTED': {
            if (msg.all_submitted) {
              setPvpWaitingForOpponentSpeaking(true);
              setPvpWaitingForPhaseTransition(true);
              setTurnAnnouncement('Đang kết nối, vui lòng đợi');
            }
            break;
          }

          case 'all_starmons_done': {
            pvpSyncedStepRef.current = 4;
            setIsActionPendingServer(false);
            setPvpActionMenu(null);
            setPvpTurnTimer(0);
            setPvpWaitingForPhaseTransition(true);
            setTurnAnnouncement('Đang kết nối, vui lòng đợi');
            break;
          }

          case 'phase_ended': {
            setIsActionPendingServer(false);
            setPvpWaitingForOpponentSpeaking(false);
            setPvpActionMenu(null);
            break;
          }

          case 'PVP_SYNC_ACK': {
            lastPvpSocketAckAtRef.current = Date.now();
            reconnectAttempt = 0;
            break;
          }

          case 'game_over':
          case 'PVP_MATCH_FINISHED': {
            const mySlot = pvpMySlotRef.current;
            const winnerSlot = msg.winnerSlot ?? msg.winner_slot;
            const isWinner = winnerSlot !== undefined
              ? winnerSlot === mySlot
              : (msg.winner === 'player1_win' && mySlot === 1) ||
                (msg.winner === 'player2_win' && mySlot === 2) ||
                msg.winner_id === pvpRoomInfo?.myPlayerId;
            if (isWinner) {
              setPhase('victory');
              sound.playRewardFanfare();
            } else {
              setPhase('defeat');
              sound.playWrong();
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.warn('PvP message handling error:', err);
      }
    };

      ws.onerror = () => {
        // onclose owns the reconnect schedule; close explicitly so browsers
        // that only emit error still enter that recovery path.
        if (ws.readyState !== WebSocket.CLOSED) ws.close();
      };

      ws.onclose = () => {
        if (activeSocket !== ws) return;
        activeSocket = null;
        if (pvpWsRef.current === ws) pvpWsRef.current = null;
        setPvpIsConnected(false);
        if (disposed) return;
        const delayMs = Math.min(1000 * (2 ** reconnectAttempt), 15000);
        reconnectAttempt += 1;
        reconnectTimer = window.setTimeout(connect, delayMs);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      const ws = activeSocket;
      activeSocket = null;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
      if (pvpWsRef.current === ws) pvpWsRef.current = null;
    };
  }, [isPvP, pvpRoomInfo?.code, pvpRoomInfo?.myPlayerId]);

  const submitPvPSpeakingFinish = (finalUnlocks: boolean[], isTimeout: boolean = false) => {
    if (!isPvP || !pvpRoomInfo?.code) return;
    setPvpWaitingForOpponentSpeaking(true);
    if (isTimeout) setPvpWaitingForPhaseTransition(true);
    const timeTaken = isTimeout ? QUESTION_TIME_LIMIT : Math.max(1, Math.round(QUESTION_TIME_LIMIT - questionTimer));
    const myId = pvpRoomInfo.myPlayerId || 'player';
    const myName = pvpRoomInfo.myPlayerName || pvpRoomInfo.hostName || 'Player';
    const mySlot = pvpMySlotRef.current;

    sendPvpMessage({
      type: 'PVP_ANSWER_SUBMIT',
      room_code: pvpRoomInfo.code,
      slot: mySlot,
      player_id: myId,
      player_name: myName,
      time_taken: timeTaken,
      results: finalUnlocks,
      round_number: currentRoundNumberRef.current,
      is_timeout: isTimeout,
    });

    sendPvpMessage({
      type: 'PVP_SPEAKING_FINISH',
      room_code: pvpRoomInfo.code,
      slot: mySlot,
      player_id: myId,
      player_name: myName,
      time_taken: timeTaken,
      unlocked_positions: finalUnlocks,
      results: finalUnlocks,
      round_number: currentRoundNumberRef.current,
      is_timeout: isTimeout,
    });

    // Mirror to Supabase for cross-network reliability
    submitSpeakingToSupabase(pvpRoomInfo.code, {
      slot: mySlot,
      turn: currentRoundNumberRef.current,
      playerId: myId,
      playerName: myName,
      completionTime: timeTaken,
      unlockedPositions: finalUnlocks,
      submittedAt: Date.now(),
      isTimeout: isTimeout,
    }).catch(err => console.warn('Supabase speaking submit err:', err));

    setPvpWaitingForOpponentSpeaking(true);
  };

  // ==========================================
  // PHASE 1: 120s total for 3 questions & Speaking Recording + AI Evaluation
  // ==========================================
  const [questionTimer, setQuestionTimer] = useState<number>(QUESTION_TIME_LIMIT);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [answeredState, setAnsweredState] = useState<Record<number, boolean>>({});
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [audioVolumeLevel, setAudioVolumeLevel] = useState<number>(0);
  const [isAiEvaluating, setIsAiEvaluating] = useState<boolean>(false);
  const [spokenTranscript, setSpokenTranscript] = useState<string>('');
  const [ieltsAiResult, setIeltsAiResult] = useState<IeltsAiEvaluationResult | null>(null);
  const [recordingErrorNotice, setRecordingErrorNotice] = useState<string>('');

  // 3-Question background evaluation and multi-tab scorecard states
  const [ieltsResultsMap, setIeltsResultsMap] = useState<Record<number, IeltsAiEvaluationResult | null>>({});
  const [evaluatingMap, setEvaluatingMap] = useState<Record<number, boolean>>({});
  const [questionTranscripts, setQuestionTranscripts] = useState<Record<number, string>>({});
  const [showAllQuestionsReport, setShowAllQuestionsReport] = useState<boolean>(false);
  const [selectedReportTab, setSelectedReportTab] = useState<number>(0);
  const [backgroundNotice, setBackgroundNotice] = useState<string>('');

  // Real-time speech telemetry refs for Fluency (stuttering, hesitations, pauses)
  const recordingStartTimeRef = useRef<number>(0);
  const lastSpeechTimeRef = useRef<number>(0);
  const speechPausesCountRef = useRef<number>(0);

  // Audio Context & Recognition refs for real recording
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const recordingSessionRef = useRef(0);

  // Dynamic quiz questions generated randomly: always 3 questions in Phase 1 (except Tutorial 1)
  const soloQuizMode = questionMode === 'random' || questionMode === 'part1_preference' ? 'speaking_only' : questionMode;
  const [currentQuizSet, setCurrentQuizSet] = useState<QuizQuestion[]>(() =>
    tutorialStage === 1
      ? []
    : getRandomQuizSet(3, isPvP ? (questionMode === 'mcq_only' ? 'mcq_only' : 'speaking_only') : soloQuizMode)
  );

  // Phase messages can arrive more than once, and a room can start a fresh
  // match whose turn counter goes back to 1. Identify a quiz by room + turn.
  function preparePvpQuizForTurn(turn: number, timeLimit?: number): boolean {
    const normalizedTurn = Number.isFinite(turn) && turn > 0 ? turn : 1;
    const quizKey = `${pvpRoomInfo?.code || ''}:${normalizedTurn}`;
    if (lastGeneratedQuizKeyRef.current === quizKey) return false;

    lastGeneratedQuizKeyRef.current = quizKey;
    const generatedQuiz = getRandomQuizSet(3, questionMode === 'mcq_only' ? 'mcq_only' : 'speaking_only');
    setCurrentQuizSet(generatedQuiz.map((q, qIdx) => ({ ...q, assignedStarmonIndex: qIdx })));
    setActiveQuestionIndex(0);
    setAnsweredState({});
    pvpQuizAnswersRef.current = [];
    setUnlockedPositions(Array(partySize).fill(false));
    setQuestionTimer(timeLimit || QUESTION_TIME_LIMIT);
    setIeltsAiResult(null);
    setIeltsResultsMap({});
    setEvaluatingMap({});
    setQuestionTranscripts({});
    setShowAllQuestionsReport(false);
    setSelectedReportTab(0);
    setSpokenTranscript('');
    setRecordingErrorNotice('');
    setBackgroundNotice('');
    setIsAiEvaluating(false);
    return true;
  }

  const currentQ = currentQuizSet[activeQuestionIndex] || currentQuizSet[0] || {
    id: 'placeholder_q',
    type: 'speaking',
    title: 'IELTS Speaking',
    category: 'Speaking',
    question: 'Did you have any opportunities to take part in new activities as a child?',
    assignedStarmonIndex: 0,
  };

  const mapQuizAnswersToStarmons = (quizAnswers: boolean[]) => {
    const results = Array(isPvP ? 3 : partySize).fill(false) as boolean[];
    currentQuizSet.forEach((question, questionIndex) => {
      const starmonIndex = Math.max(0, Math.min(results.length - 1, question.assignedStarmonIndex));
      results[starmonIndex] = Boolean(quizAnswers[questionIndex]);
    });
    return results;
  };

  // Current IELTS Speaking prompt metadata (checks extended bank of 257 questions first)
  const currentIeltsMetadata = EXTENDED_SPEAKING_BANK.find(
    p => p.question.trim().toLowerCase() === currentQ.question?.trim().toLowerCase()
  ) || IELTS_SPEAKING_POOL.find(
    p => p.question.trim().toLowerCase() === currentQ.question?.trim().toLowerCase()
  ) || {
    id: 'speaking_custom',
    question: currentQ.question || '',
    topic: currentQ.category || 'IELTS Speaking',
    sampleAnswer: currentQ.speakingPrompt || 'In my opinion, this topic plays a meaningful role in personal development and helps broaden horizons.',
    keywords: ['speaking', 'practice', 'fluency'],
    suggestedIdiom: 'broaden my horizons'
  };

  // 120s countdown timer for Phase 1 and opponent wait.
  useEffect(() => {
    if (phase !== 'phase1_quiz') return;

    if (questionTimer <= 0) {
      sound.playWrong();
      if (isRecording) {
        setIsRecording(false);
        stopVolumeVisualizer();
        if (speechRecognitionRef.current) {
          try {
            speechRecognitionRef.current.stop();
          } catch {}
        }
      }

      // If time runs out, any unanswered questions are counted as 0 points (false)
      const questionResults: boolean[] = [];
      for (let i = 0; i < currentQuizSet.length; i++) {
        if (answeredState[i] !== undefined) {
          questionResults.push(Boolean(answeredState[i]));
        } else if (pvpQuizAnswersRef.current[i] !== undefined) {
          questionResults.push(Boolean(pvpQuizAnswersRef.current[i]));
        } else if (i === activeQuestionIndex && ieltsAiResult) {
          questionResults.push(Boolean(ieltsAiResult.passed));
        } else {
          questionResults.push(false);
        }
      }

      const finalAns = mapQuizAnswersToStarmons(questionResults);
      pvpQuizAnswersRef.current = questionResults;
      setUnlockedPositions(finalAns);
      setIeltsAiResult(null);
      setSpokenTranscript('');
      setRecordingErrorNotice('');

      if (isPvP) {
        submitPvPSpeakingFinish(finalAns, true);
      } else {
        setPhase('phase2_combat');
        setActingStepIndex(0);
        triggerStartOfRoundPassives();
        announceTurnForStep(0, finalAns);
      }
      return;
    }

    const t = setInterval(() => {
      setQuestionTimer(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(t);
  }, [phase, questionTimer, isPvP, currentQuizSet, answeredState, activeQuestionIndex, ieltsAiResult, isRecording, pvpRoomInfo?.code, sendPvpMessage]);

  const handleAdvanceQuestion = (isCorrect: boolean) => {
    setExpandedFeedbackSection('none');
    setAnsweredState(prev => ({ ...prev, [activeQuestionIndex]: isCorrect }));
    pvpQuizAnswersRef.current[activeQuestionIndex] = isCorrect;

    if (isPvP && pvpRoomInfo?.code) {
      sendPvpMessage({
        type: 'PVP_ANSWER_PROGRESS',
        room_code: pvpRoomInfo.code,
        slot: pvpMySlotRef.current,
        player_id: pvpRoomInfo.myPlayerId || 'player',
        round_number: currentRoundNumberRef.current,
        results: [...pvpQuizAnswersRef.current],
      });
    }

    // Track IELTS and MCQ performance metrics
    setPerformanceStats(prev => ({
      ...prev,
      ieltsQuestionsTotal: prev.ieltsQuestionsTotal + 1,
      ieltsQuestionsCorrect: isCorrect ? prev.ieltsQuestionsCorrect + 1 : prev.ieltsQuestionsCorrect,
      ieltsSpeakingCount: ieltsAiResult ? prev.ieltsSpeakingCount + 1 : prev.ieltsSpeakingCount,
      ieltsSpeakingBandSum: ieltsAiResult?.overallBand ? prev.ieltsSpeakingBandSum + ieltsAiResult.overallBand : prev.ieltsSpeakingBandSum,
    }));

    // A question unlocks the Starmon assigned to it.
    if (isCorrect) {
      setUnlockedPositions(prev => {
        const next = [...prev];
        next[currentQ.assignedStarmonIndex] = true;
        return next;
      });
    }

    if (tutorialStage === 1 && currentQ.type === 'mcq') {
      if (isCorrect) {
        setUnlockedPositions([true]);
        setTimeout(() => {
          sound.playSwoosh();
          setPhase('phase2_combat');
          setActingStepIndex(0);
          triggerStartOfRoundPassives();
          announceTurnForStep(0, [true]);
        }, 1200);
      }
      return;
    }

    if (tutorialStage === 1 && currentQ.type === 'speaking') {
      setUnlockedPositions([true]);
      setTutorialHasRecordedSpeaking(true);
      setTimeout(() => {
        sound.playSwoosh();
        setPhase('phase2_combat');
        setActingStepIndex(0);
        setTutorialRound(2);
        setTutorialHasSwappedOrbs(false);
        setIeltsAiResult(null);
        setTurnAnnouncement('TUTORIAL 1: Hoán đổi 2 viên ngọc để Voltlynx tấn công kết liễu!');
      }, 800);
      return;
    }

    if (activeQuestionIndex < currentQuizSet.length - 1) {
      setTimeout(() => {
        setActiveQuestionIndex(i => i + 1);
        setIeltsAiResult(null);
        setSpokenTranscript('');
        setRecordingErrorNotice('');
      }, 700);
    } else {
      const questionResults = currentQuizSet.map((_, idx) =>
        idx === activeQuestionIndex ? isCorrect : Boolean(pvpQuizAnswersRef.current[idx] ?? answeredState[idx])
      );
      const finalResults = mapQuizAnswersToStarmons(questionResults);
      pvpQuizAnswersRef.current = questionResults;
      setUnlockedPositions(finalResults);

      // CRITICAL: Always dismiss IELTS AI scorecard modal and clean transcript immediately!
      setIeltsAiResult(null);
      setSpokenTranscript('');
      setRecordingErrorNotice('');

      if (isPvP) {
        // In real-time PvP: Send answers for all 3 questions to server
        submitPvPSpeakingFinish(finalResults, false);
      } else {
        // Single player / Tutorial: Completed all questions -> Enter Phase 2 Combat!
        setTimeout(() => {
          sound.playSwoosh();
          setPhase('phase2_combat');
          setActingStepIndex(0); // Start with Starmon 1
          triggerStartOfRoundPassives();
          announceTurnForStep(0, finalResults);
        }, 800);
      }
    }
  };

  // SKIP THIS QUESTION BUTTON:
  // Skips the current question; if it is the last question, immediately starts Phase 2!
  const handleSkipQuestion = () => {
    sound.playSwoosh();
    setExpandedFeedbackSection('none');
    // Stop recording if active
    if (isRecording) {
      setIsRecording(false);
      stopVolumeVisualizer();
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
    }

    // Mark current question as skipped (false = 0 điểm)
    setAnsweredState(prev => ({ ...prev, [activeQuestionIndex]: false }));
    pvpQuizAnswersRef.current[activeQuestionIndex] = false;
    if (isPvP && pvpRoomInfo?.code) {
      sendPvpMessage({
        type: 'PVP_ANSWER_PROGRESS',
        room_code: pvpRoomInfo.code,
        slot: pvpMySlotRef.current,
        player_id: pvpRoomInfo.myPlayerId || 'player',
        round_number: currentRoundNumberRef.current,
        results: [...pvpQuizAnswersRef.current],
      });
    }
    setPerformanceStats(prev => ({
      ...prev,
      ieltsQuestionsTotal: prev.ieltsQuestionsTotal + 1,
    }));

    if (activeQuestionIndex < currentQuizSet.length - 1) {
      // Advance to next question immediately (keeping the shared 120s Phase 1 countdown)
      setActiveQuestionIndex(i => i + 1);
      setIeltsAiResult(null);
      setSpokenTranscript('');
      setRecordingErrorNotice('');
    } else {
      const questionResults = currentQuizSet.map((_, idx) =>
        idx === activeQuestionIndex ? false : Boolean(pvpQuizAnswersRef.current[idx] ?? answeredState[idx])
      );
      const finalResults = mapQuizAnswersToStarmons(questionResults);
      pvpQuizAnswersRef.current = questionResults;
      setUnlockedPositions(finalResults);

      setIeltsAiResult(null);
      setSpokenTranscript('');
      setRecordingErrorNotice('');

      if (isPvP) {
        submitPvPSpeakingFinish(finalResults, false);
      } else {
        // Last question skipped -> IMMEDIATELY enter Phase 2 Combat!
        sound.playSwoosh();
        setPhase('phase2_combat');
        setActingStepIndex(0);
        triggerStartOfRoundPassives();
        announceTurnForStep(0, finalResults);
      }
    }
  };

  const handleMcqOptionSelect = (optIndex: number) => {
    if (answeredState[activeQuestionIndex] !== undefined) return;
    const isCorrect = optIndex === currentQ.correctIndex;
    if (isCorrect) {
      sound.playCorrect();
      if (tutorialStage === 1) {
        setTutorialMcqCorrect(true);
        setAnsweredState(prev => ({ ...prev, [activeQuestionIndex]: true }));
        setUnlockedPositions([true]);
        return;
      }
    } else {
      sound.playWrong();
    }
    handleAdvanceQuestion(isCorrect);
  };

  // Tutorial 1 Advance Handlers
  const handleAdvanceToMatch3FromTutorial = () => {
    sound.playSwoosh();
    setPhase('phase2_combat');
    setActingStepIndex(0);
    triggerStartOfRoundPassives();
    announceTurnForStep(0, [true]);
  };

  const handleAdvanceToSpeaking = () => {
    sound.playSwoosh();
    setTutorialRound(2);
    setPhase('phase1_quiz');
    const tut1Speaking: QuizQuestion = {
      id: 'tut1_q2_speaking',
      type: 'speaking',
      title: 'IELTS Speaking Foundation',
      category: 'IELTS Speaking',
      question: 'Do you like reading books?',
      speakingPrompt: 'Yes, I really enjoy reading books. It is a wonderful way to relax, broaden my horizons, and acquire useful knowledge in my daily life.',
      assignedStarmonIndex: 0,
      minBand: 5.0,
    };
    setCurrentQuizSet([tut1Speaking]);
    setActiveQuestionIndex(0);
    setAnsweredState({});
    setQuestionTimer(QUESTION_TIME_LIMIT);
    setIeltsAiResult(null);
    setSpokenTranscript('');
    setRecordingErrorNotice('');
    setTutorialHasRecordedSpeaking(false);
    setUnlockedPositions([false]);
    setTurnAnnouncement('TUTORIAL 1: Phase 3 IELTS Speaking - Record your answer (Score >= 5.0 to attack)!');
  };

  const handleAdvanceToFinalAttack = () => {
    sound.playSwoosh();
    setPhase('phase2_combat');
    setActingStepIndex(0);
    setUnlockedPositions([true]);
    setTutorialHasSwappedOrbs(false);
    triggerStartOfRoundPassives();
    announceTurnForStep(0, [true]);
    setTurnAnnouncement('TUTORIAL 1: Final Attack - Match 3 orbs to defeat the enemy!');
  };

  // Listen to sample speech via Text-to-Speech
  const handlePlaySampleAudio = (textToSpeak?: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak || currentIeltsMetadata.sampleAnswer);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Real audio volume visualizer
  const startVolumeVisualizer = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioVolumeLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      console.warn('AudioContext volume visualizer notice:', e);
    }
  };

  const stopVolumeVisualizer = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    setAudioVolumeLevel(0);
  };

  // Real speech recording toggle: Green when idle, Red when recording
  const handleToggleRecording = async () => {
    if (answeredState[activeQuestionIndex] !== undefined) return;

    // IF ALREADY RECORDING -> STOP RECORDING AND EVALUATE IN BACKGROUND
    if (isRecording) {
      sound.playClick();
      setIsRecording(false);
      stopVolumeVisualizer();

      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      recordingSessionRef.current += 1;

      const textToAnalyze = normalizeRecognizedSpeech(spokenTranscript).trim() || (tutorialStage === 1 ? (currentQ.speakingPrompt || currentIeltsMetadata.sampleAnswer || 'Yes, I really enjoy reading books. It is a wonderful way to relax, broaden my horizons, and acquire useful knowledge in my daily life.') : '');
      if (!textToAnalyze) {
        setRecordingErrorNotice('No speech detected. Please click the green button to speak again, or use the model answer button.');
        sound.playWrong();
        return;
      }

      submitSpeakingResponseAndAdvance(textToAnalyze);
      return;
    }

    // START RECORDING
    sound.playClick();
    setRecordingErrorNotice('');
    setSpokenTranscript('');
    setIsRecording(true);
    const recordingSession = ++recordingSessionRef.current;
    recordingStartTimeRef.current = Date.now();
    lastSpeechTimeRef.current = Date.now();
    speechPausesCountRef.current = 0;

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        speechRecognitionRef.current = recognition;

        recognition.onresult = (event: any) => {
          if (recordingSessionRef.current !== recordingSession) return;
          const now = Date.now();
          if (lastSpeechTimeRef.current && (now - lastSpeechTimeRef.current > 1800)) {
            speechPausesCountRef.current++;
          }
          lastSpeechTimeRef.current = now;

          const finalSegments: string[] = [];
          const interimSegments: string[] = [];
          for (let i = 0; i < event.results.length; i++) {
            const segment = String(event.results[i]?.[0]?.transcript || '').trim();
            if (!segment) continue;
            if (event.results[i].isFinal) {
              const previousSegment = finalSegments[finalSegments.length - 1];
              const normalizeSegment = (value: string) => value.toLowerCase().replace(/[^a-z0-9']/g, ' ').replace(/\s+/g, ' ').trim();
              if (!previousSegment || normalizeSegment(previousSegment) !== normalizeSegment(segment)) {
                finalSegments.push(segment);
              }
            } else {
              interimSegments.push(segment);
            }
          }
          const currentSpoken = [...finalSegments, ...interimSegments].join(' ');
          setSpokenTranscript(normalizeRecognizedSpeech(currentSpoken));
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition event:', e.error);
          if (recordingSessionRef.current === recordingSession && ['not-allowed', 'audio-capture', 'service-not-allowed'].includes(e.error)) {
            setIsRecording(false);
            setRecordingErrorNotice(e.error === 'not-allowed' || e.error === 'service-not-allowed'
              ? 'Microphone access was blocked. Allow microphone access in your browser, then try again.'
              : 'No microphone was detected. Check your microphone connection and try again.');
            recordingSessionRef.current += 1;
            stopVolumeVisualizer();
          }
        };

        recognition.start();
      } catch (e) {
        console.warn('Recognition start notice:', e);
        setIsRecording(false);
        setRecordingErrorNotice('Speech recognition could not start. Please check microphone permission and try again.');
        recordingSessionRef.current += 1;
        return;
      }
    } else {
      setIsRecording(false);
      setRecordingErrorNotice('Speech recognition is not supported in this browser. Please use a supported browser.');
      recordingSessionRef.current += 1;
      return;
    }

    // Start recognition synchronously inside the user's click, before the permission prompt can consume the activation.
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (recordingSessionRef.current !== recordingSession) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        mediaStreamRef.current = stream;
        startVolumeVisualizer(stream);
      }
    } catch (micErr) {
      console.warn('Microphone permission info:', micErr);
      if (recordingSessionRef.current === recordingSession) {
        setRecordingErrorNotice('Microphone access is unavailable. Allow microphone access in your browser and try again.');
      }
    }
  };

  // Submit candidate response, trigger background AI analysis, and IMMEDIATELY advance to next question
  const submitSpeakingResponseAndAdvance = (transcriptInput: string, responseSource: 'spoken' | 'sample' = 'spoken') => {
    const textToAnalyze = responseSource === 'spoken'
      ? normalizeRecognizedSpeech(transcriptInput)
      : transcriptInput.trim();
    const targetIndex = activeQuestionIndex;
    const targetQuestion = currentQ;

    // Compute speech telemetry
    const durationSeconds = Math.max(1, Math.round((Date.now() - (recordingStartTimeRef.current || Date.now())) / 1000));
    const pauses = speechPausesCountRef.current;

    // Detect repetitions (stutters)
    const stutters: string[] = [];
    const repeatRegex = /\b([a-zA-Z]{1,12})\s+\1\b/gi;
    let m: RegExpExecArray | null;
    while ((m = repeatRegex.exec(textToAnalyze)) !== null) {
      stutters.push(`Lặp từ "${m[0]}"`);
    }

    // Detect hesitation tokens
    const hesitations: string[] = [];
    const tokens = ['um', 'uh', 'er', 'ah', 'umm', 'uhh'];
    textToAnalyze.split(/\s+/).forEach(w => {
      const clean = w.toLowerCase().replace(/[^a-z]/g, '');
      if (tokens.includes(clean)) hesitations.push(`Từ đệm "${w}"`);
    });

    // Save question transcript & mark answered
    setQuestionTranscripts(prev => ({ ...prev, [targetIndex]: textToAnalyze }));
    setAnsweredState(prev => ({ ...prev, [targetIndex]: true }));

    // Start background asynchronous AI evaluation for this question (non-blocking)
    startBackgroundEvaluation(targetIndex, targetQuestion, textToAnalyze, {
      stutters,
      hesitations,
      pauses,
      durationSeconds,
    }, responseSource);

    setSpokenTranscript('');
    setRecordingErrorNotice('');

    if (tutorialStage === 1) {
      setUnlockedPositions([true]);
      setTutorialHasRecordedSpeaking(true);
      setTimeout(() => {
        sound.playSwoosh();
        setPhase('phase2_combat');
        setActingStepIndex(0);
        setTutorialRound(2);
        setTutorialHasSwappedOrbs(false);
        setIeltsAiResult(null);
        setTurnAnnouncement('TUTORIAL 1: Hoán đổi 2 viên ngọc để Voltlynx tấn công kết liễu!');
      }, 800);
      return;
    }

    // IMMEDIATE ADVANCE TO NEXT QUESTION:
    if (targetIndex < currentQuizSet.length - 1) {
      sound.playClick();
      setActiveQuestionIndex(targetIndex + 1);
      setBackgroundNotice(`⚡ AI đang chấm Câu ${targetIndex + 1} trong nền. Bạn có thể trả lời Câu ${targetIndex + 2} ngay bây giờ!`);
      setTimeout(() => setBackgroundNotice(''), 4500);
    } else {
      // Completed the current question set.
      setShowAllQuestionsReport(true);
      setSelectedReportTab(0);
    }
  };

  // Helper for using sample model answer
  const handleUseSampleAnswer = (sampleText: string) => {
    sound.playClick();
    submitSpeakingResponseAndAdvance(sampleText, 'sample');
  };

  const saveSpeakingLogEntry = (questionItem: QuizQuestion, transcriptText: string, result: IeltsAiEvaluationResult) => {
    const createdAt = Date.now();
    onSaveSpeakingLog?.({
      id: `speaking-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt,
      question: questionItem.question,
      transcript: transcriptText,
      overallBand: result.overall_score ?? result.overallBand,
      summary: result.summary || '',
      strengths: result.strengths || [],
      improvements: result.improvements || [],
      criteria: result.criteria || {},
      ...(result.feedback_vi ? { feedbackVi: result.feedback_vi } : {}),
      ...(result.fluency_detail ? { fluencyDetail: result.fluency_detail } : {}),
      grammarErrors: result.grammar_errors || [],
      pronunciationErrors: result.pronunciation_errors || [],
    });
  };

  // Background Asynchronous Evaluation Worker
  const startBackgroundEvaluation = async (
    targetIndex: number,
    questionItem: QuizQuestion,
    transcriptText: string,
    telemetry: { stutters: string[]; hesitations: string[]; pauses: number; durationSeconds: number },
    responseSource: 'spoken' | 'sample' = 'spoken'
  ) => {
    setEvaluatingMap(prev => ({ ...prev, [targetIndex]: true }));

    try {
      const response = await fetch('/api/evaluate-speaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionItem.question,
          transcript: transcriptText,
          targetBand: requiredSpeakingBand,
          stutters: telemetry.stutters,
          hesitations: telemetry.hesitations,
          pauses: telemetry.pauses,
          durationSeconds: telemetry.durationSeconds,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const score = typeof data.overall_score === 'number' ? data.overall_score : Number(data.overallBand) || 5.0;
        const canAttack = score >= requiredSpeakingBand;

        data.overall_score = score;
        data.overallBand = score;
        data.can_attack = canAttack;
        data.passed = canAttack;
        data.questionIndex = targetIndex;
        data.questionText = questionItem.question;
        data.transcript = transcriptText;

        if (tutorialStage === 1) {
          data.overall_score = Math.max(score, 6.0);
          data.overallBand = Math.max(score, 6.0);
          data.can_attack = true;
          data.passed = true;
        }

        setIeltsResultsMap(prev => ({ ...prev, [targetIndex]: data }));
        if (responseSource === 'spoken') saveSpeakingLogEntry(questionItem, transcriptText, data as IeltsAiEvaluationResult);
        setEvaluatingMap(prev => ({ ...prev, [targetIndex]: false }));
        pvpQuizAnswersRef.current[targetIndex] = canAttack;

        if (canAttack) {
          setUnlockedPositions(prev => {
            const next = [...prev];
            next[questionItem.assignedStarmonIndex] = true;
            return next;
          });
          sound.playRewardFanfare();
        }

        onQuestProgress?.('speaking_band', { band: score });
        return;
      }
    } catch (err) {
      console.warn(`AI evaluation API error for Question ${targetIndex + 1}, using fallback:`, err);
    }

    // Precise Fallback Evaluation
    const words = transcriptText.trim().split(/\s+/);
    const wordCount = words.length;
    const lower = transcriptText.toLowerCase();
    const floorToHalf = (num: number): number => Math.floor(num * 2) / 2;

    let baseGRA = 8.0;
    let severeGrammarCount = 0;
    const grammarErrors: GrammarErrorDetail[] = [];

    const sentences = transcriptText.split(/[.?!]+/).map(s => s.trim()).filter(s => s.length > 0);
    sentences.forEach(s => {
      const sWords = s.split(/\s+/);
      if (sWords.length < 3 && sWords.length > 0 && !['yes', 'no', 'sure', 'of course'].includes(s.toLowerCase())) {
        severeGrammarCount++;
        grammarErrors.push({
          sentence: s,
          error: 'Câu cụt thiếu thành phần chủ ngữ hoặc vị ngữ hoàn chỉnh.',
          correction: `I believe that ${s.toLowerCase()} is essential for personal growth.`,
          practice_structure: 'Cấu trúc câu hoàn chỉnh (Subject + Verb + Object/Complement)',
          explanation: 'Mỗi câu trong IELTS Speaking cần có ít nhất một chủ ngữ và một động từ vị ngữ để tạo thành mệnh đề độc lập có nghĩa.'
        });
      }
    });

    if (lower.includes('very interest in') || lower.includes('more better') || lower.includes('is depend on')) {
      severeGrammarCount++;
      grammarErrors.push({
        sentence: lower.includes('very interest in') ? 'very interest in' : lower.includes('more better') ? 'more better' : 'is depend on',
        error: 'Sai dạng từ hoặc cấu trúc so sánh/tính từ.',
        correction: lower.includes('very interest in') ? 'very interested in' : lower.includes('more better') ? 'much better' : 'depends on',
        practice_structure: 'Dạng phân từ làm tính từ (-ed vs -ing) & Động từ chỉ trạng thái',
        explanation: 'Dùng tính từ đuôi -ed khi miêu tả cảm xúc con người ("interested in") và không dùng "more" đi kèm tính từ ngắn đã thêm "-er".'
      });
    }

    const severeClauseErrors = grammarErrors.filter(e => e.error.includes('thiếu thành phần')).length;
    const verbFormErrors = grammarErrors.filter(e => /dạng từ|verb|V-ing|phân từ/i.test(`${e.error} ${e.practice_structure}`)).length;
    const minorGrammarErrors = Math.max(0, grammarErrors.length - severeClauseErrors - verbFormErrors);
    const shortAnswerPenalty = wordCount < 10 ? 3 : wordCount < 12 ? 2 : wordCount < 15 ? 1 : wordCount < 20 ? 0.5 : 0;
    const grammarVocabLengthPenalty = getShortAnswerBandPenalty(wordCount);
    const inappropriateVocabularyCount = getInappropriateVocabularyCount(transcriptText);
    baseGRA = Math.max(1, 8 - severeClauseErrors * 2 - verbFormErrors - minorGrammarErrors * 0.5 - grammarVocabLengthPenalty);

    const speakingRatePenalty = getSpeakingRatePenalty(wordCount, telemetry.durationSeconds);
    let baseFC = Math.max(1, 8 - shortAnswerPenalty - speakingRatePenalty - telemetry.stutters.length * 0.5 - telemetry.hesitations.length * 0.5 - telemetry.pauses * 0.5);
    const repeatedPromptKeywords = countRepeatedPromptKeywords(questionItem.question, transcriptText);
    const repeatedKeywordPenalty = Math.floor(repeatedPromptKeywords / wordCount * 10) * 0.5;
    let baseLR = Math.max(1, Math.min(8, 6 + Math.floor(countAdvancedSpeakingVocab(transcriptText) / 2) * 0.5 - repeatedKeywordPenalty - grammarVocabLengthPenalty - inappropriateVocabularyCount * 0.5));
    let basePR = 8.0;

    const pronunciationErrors: PronunciationErrorDetail[] = [];
    const phoneticLibrary: Record<string, { sound: string; phonetic: string; issue: string; guide: string }> = {
      comfortable: {
        sound: 'Nuốt âm tiết giữa và trọng âm rơi vào âm tiết đầu /ˈkʌmftəbl/',
        phonetic: '/ˈkʌmftəbl/',
        issue: 'Người học thường phát âm tách thành 4 âm "com-for-ta-ble" thay vì 3 âm chuẩn.',
        guide: 'Lướt nhanh âm "fort" thành /ft/ và rơi trọng âm mạnh vào âm đầu "COM".'
      },
      specifically: {
        sound: 'Trọng âm âm tiết 2 và cụm phụ âm đầu /spəˈsɪf.ɪ.kli/',
        phonetic: '/spəˈsɪf.ɪ.kli/',
        issue: 'Dễ nuốt âm /s/ đầu hoặc phát âm sai trọng âm sang âm tiết 1.',
        guide: 'Bật nhẹ âm /s/ trước khi sang /pə/, nhấn mạnh vào "SIF".'
      },
      opportunity: {
        sound: 'Trọng âm chính rơi vào âm tiết thứ 3 /ˌɒp.əˈtjuː.nə.ti/',
        phonetic: '/ˌɒp.əˈtjuː.nə.ti/',
        issue: 'Nhấn sai trọng âm hoặc phát âm nguyên âm /uː/ thành /u/ ngắn.',
        guide: 'Nhấn mạnh nhất vào âm "TU" (/tjuː/), giữ nguyên âm đôi chuẩn xác.'
      },
      environment: {
        sound: 'Trọng âm âm tiết 2 và âm /n/ câm trước /m/ /ɪnˈvaɪ.rən.mənt/',
        phonetic: '/ɪnˈvaɪ.rən.mənt/',
        issue: 'Dễ đọc rõ chữ "ron" thành "ron-mừn" thay vì âm schwa /rən/.',
        guide: 'Nhấn mạnh vào "VI" (/vaɪ/), âm tiết tiếp theo phát âm lướt nhẹ thành /rən.mənt/.'
      },
      technology: {
        sound: 'Âm /k/ ở chữ "ch" và trọng âm âm tiết 2 /tekˈnɒl.ə.dʒi/',
        phonetic: '/tekˈnɒl.ə.dʒi/',
        issue: 'Nhầm âm "ch" thành âm /tʃ/ thay vì âm bật hơi /k/.',
        guide: 'Bật dứt khoát âm /k/ như "tek-NOL-uh-jee".'
      },
      especially: {
        sound: 'Trọng âm âm tiết 2 /ɪˈspeʃ.əl.i/',
        phonetic: '/ɪˈspeʃ.əl.i/',
        issue: 'Thường thêm âm "e" đằng trước thành "e-specially" thay vì bắt đầu bằng /ɪs/.',
        guide: 'Bắt đầu trực tiếp bằng âm gió /sp/, nhấn trọng âm mạnh vào "SPE".'
      }
    };

    for (const [kw, pData] of Object.entries(phoneticLibrary)) {
      if (lower.includes(kw)) {
        pronunciationErrors.push({ word: kw, ...pData });
        if (pronunciationErrors.length >= 3) break;
      }
    }

    basePR = Math.max(1, 8 - pronunciationErrors.length * 0.5);

    const cappedBands = capCriterionBands({
      fluencyCoherence: baseFC,
      lexicalResource: baseLR,
      grammaticalRange: baseGRA,
      pronunciation: basePR,
    });
    baseFC = cappedBands.fluencyCoherence;
    baseLR = cappedBands.lexicalResource;
    baseGRA = cappedBands.grammaticalRange;
    basePR = cappedBands.pronunciation;

    const rawAvg = (baseFC + baseLR + baseGRA + basePR) / 4;
    const roundedScore = floorToHalf(rawAvg);
    const isPassed = roundedScore >= requiredSpeakingBand;

    const fallbackResult: IeltsAiEvaluationResult = {
      overall_score: roundedScore,
      can_attack: isPassed,
      overallBand: roundedScore,
      passed: isPassed,
      questionIndex: targetIndex,
      questionText: questionItem.question,
      grammar_errors: grammarErrors,
      pronunciation_errors: pronunciationErrors,
      fluency_detail: {
        stutterCount: telemetry.stutters.length,
        hesitationCount: telemetry.hesitations.length,
        pauseCount: telemetry.pauses,
        stumbles: [...telemetry.stutters, ...telemetry.hesitations],
        feedback: speakingRatePenalty > 0
          ? 'Tốc độ nói chậm.'
          : telemetry.stutters.length === 0 && telemetry.hesitations.length === 0
          ? 'Nói trôi chảy tự nhiên, tốc độ đều đặn không bị vấp.'
          : `Ghi nhận ${telemetry.stutters.length} lần lặp từ và ${telemetry.hesitations.length} lần ngập ngừng.`
      },
      feedback_vi: {
        summary: `Thí sinh trả lời trực tiếp câu hỏi "${questionItem.question}". ${wordCount < 20 ? 'Bài nói quá ngắn.' : ''} Ngữ pháp đạt khoảng Band ${baseGRA.toFixed(1)}. Điểm tổng kết: Band ${roundedScore}.`,
        weaknesses: [
          ...(telemetry.stutters.length > 0 ? [`Độ trôi chảy (Fluency): ${telemetry.stutters.join(', ')}`] : []),
          ...(wordCount < 20 ? ['Độ trôi chảy (Fluency): Bài nói quá ngắn.'] : []),
          ...(repeatedKeywordPenalty > 0 ? ['Từ vựng: Lặp từ, thiếu linh hoạt từ vựng.'] : []),
          ...(speakingRatePenalty > 0 ? ['Độ trôi chảy (Fluency): Tốc độ nói chậm.'] : []),
          ...(severeGrammarCount > 0 ? ['Ngữ pháp (Grammar): Cần tránh các lỗi câu cụt hoặc sai dạng từ.'] : ['Ngữ pháp (Grammar): Khá tự nhiên, nên tiếp tục phát huy câu phức.']),
        ],
        grammar_summary: severeGrammarCount > 0 ? `Ghi nhận ${severeGrammarCount} lỗi ngữ pháp cơ bản.` : 'Ngữ pháp chính xác và tự nhiên.',
        pronunciation_summary: 'Phát âm rõ ràng, đã chú thích các âm và trọng âm cụ thể theo IPA.',
        suggestion: 'Mở rộng câu trả lời với lý do và ví dụ thực tế (phương pháp A.R.E.A).'
      },
      criteria: {
        fluencyCoherence: { band: floorToHalf(baseFC), feedback: speakingRatePenalty > 0 ? 'Speaking rate is slow.' : 'Natural conversational pace.' },
        lexicalResource: { band: floorToHalf(baseLR), feedback: inappropriateVocabularyCount > 0 ? `Inappropriate word/collocation use: -0.5 per occurrence (${inappropriateVocabularyCount}).` : repeatedKeywordPenalty > 0 ? 'Keyword repetition reduces lexical flexibility.' : 'Relevant and functional vocabulary.' },
        grammaticalRange: { band: floorToHalf(baseGRA), feedback: 'Accurate and natural sentence structures.' },
        pronunciation: { band: floorToHalf(basePR), feedback: 'Clear phonetic articulation.' },
      },
      summary: `Addresses the prompt effectively with clear intelligibility.`,
      strengths: ['Natural expression', 'Clear pronunciation'],
      improvements: ['Incorporate compound clauses and smooth out transitions'],
      transcript: transcriptText,
    };

    setIeltsResultsMap(prev => ({ ...prev, [targetIndex]: fallbackResult }));
    if (responseSource === 'spoken') saveSpeakingLogEntry(questionItem, transcriptText, fallbackResult);
    setEvaluatingMap(prev => ({ ...prev, [targetIndex]: false }));
    pvpQuizAnswersRef.current[targetIndex] = isPassed;
    if (isPassed) {
      setUnlockedPositions(prev => {
        const next = [...prev];
        next[questionItem.assignedStarmonIndex] = true;
        return next;
      });
      sound.playRewardFanfare();
    }
    onQuestProgress?.('speaking_band', { band: roundedScore });
  };

  // Alias for compatibility
  const evaluateWithGeminiAi = async (transcriptText: string) => {
    submitSpeakingResponseAndAdvance(transcriptText);
  };

  // Confirm and proceed from 3-tab report to Phase 2 combat
  const handleConfirmAllSpeakingQuestions = () => {
    sound.playClick();
    setShowAllQuestionsReport(false);
    setIeltsAiResult(null);

    const questionResults = currentQuizSet.map((_, idx) => {
      const res = ieltsResultsMap[idx];
      if (res) return Boolean(res.overall_score !== undefined && res.overall_score >= requiredSpeakingBand);
      return Boolean(pvpQuizAnswersRef.current[idx] ?? answeredState[idx]);
    });
    const finalResults = mapQuizAnswersToStarmons(questionResults);

    pvpQuizAnswersRef.current = questionResults;
    setUnlockedPositions(finalResults);

    let totalBands = 0;
    let answeredCount = 0;
    Object.values(ieltsResultsMap).forEach(r => {
      if (r) {
        totalBands += (r.overall_score ?? r.overallBand);
        answeredCount++;
      }
    });

    if (answeredCount > 0) {
      setPerformanceStats(prev => ({
        ...prev,
        ieltsQuestionsTotal: prev.ieltsQuestionsTotal + answeredCount,
        ieltsQuestionsCorrect: prev.ieltsQuestionsCorrect + finalResults.filter(Boolean).length,
        ieltsSpeakingCount: prev.ieltsSpeakingCount + answeredCount,
        ieltsSpeakingBandSum: prev.ieltsSpeakingBandSum + totalBands,
      }));
    }

    if (isPvP) {
      if (pvpRoomInfo?.code) {
        sendPvpMessage({
          type: 'PVP_ANSWER_PROGRESS',
          room_code: pvpRoomInfo.code,
          slot: pvpMySlotRef.current,
          player_id: pvpRoomInfo.myPlayerId || 'player',
          round_number: currentRoundNumberRef.current,
          results: finalResults,
          finished: true,
        });
      }
      setTurnAnnouncement('ĐÃ HOÀN TẤT 3 CÂU HỎI! Đang chờ đối thủ hoàn thành...');
    } else {
      sound.playSwoosh();
      setPhase('phase2_combat');
      setActingStepIndex(0);
      triggerStartOfRoundPassives();
      announceTurnForStep(0, finalResults);
    }
  };

  // ==========================================
  // PHASE 2: TURN-BASED EXECUTION & COMBAT
  // ==========================================
  const triggerStartOfRoundPassives = () => {
    // Stone Golem Unyielding Granite: Gains a Shield equal to 5% of max HP at the start of each round
    const playerGolem = playerTeam.find(p => (p.id === 'stone_golem' || p.avatarSeed === 'stone_golem') && p.currentHp > 0);
    if (playerGolem) {
      const shieldVal = Math.round(playerGolem.maxHp * 0.05);
      setTeamShieldPoints(prev => prev + shieldVal);
      setFloatingDamage({
        text: `🛡️ UNYIELDING GRANITE: Stone Golem gains +${shieldVal} Shield!`,
        isEnemy: false,
      });
      setTimeout(() => setFloatingDamage(null), 1500);
    }

    // Trojan Flare & Bubbleboon round turnovers
    if (trojanNextTurnResonance) {
      setTrojanCurrentResonance(true);
      setTrojanNextTurnResonance(false);
    } else {
      setTrojanCurrentResonance(false);
    }
    setTrojanCooldownTurns(prev => Math.max(0, prev - 1));
    setBubbleboonDoubleStrikeTurns(prev => Math.max(0, prev - 1));
    setBubbleboonRemainingSwaps(1);
  };

  const announceTurnForStep = (stepIdx: number, overrideUnlocked?: boolean[], forceMyTurnInPvP?: boolean) => {
    if (isPvP && !(forceMyTurnInPvP ?? (pvpAttackerSlotRef.current === pvpMySlotRef.current))) {
      setTurnStatusType('enemy');
      setTurnAnnouncement(`Phase ${pvpFlowPhaseRef.current} ➔ LƯỢT ĐỐI THỦ: ${pvpCurrentTurnPlayerName || 'Đối thủ'} đang ra đòn...`);
      return;
    }

    const unlocks = overrideUnlocked || (isPvP ? Array(partySize).fill(true) : unlockedPositions);

    if (stepIdx < playerTeam.length) {
      const activeIdx = stepIdx;
      const mon = playerTeam[activeIdx] || playerTeam[0];
      const isUnlocked = unlocks[activeIdx] !== undefined ? unlocks[activeIdx] : true;

      if (mon.currentHp <= 0) {
        setTurnStatusType('missed');
        setTurnAnnouncement(`${mon.name} (#${activeIdx + 1}) đã bị hạ gục! Bỏ qua lượt...`);
        setTimeout(() => advanceToNextUnit(activeIdx + 1), 900);
      } else if (stunnedPlayerIndices.includes(activeIdx)) {
        setTurnStatusType('missed');
        setTurnAnnouncement(`LƯỢT #${activeIdx + 1} BỊ CHOÁNG: ${mon.name} bị choáng và mất lượt!`);
        sound.playWrong();
        setStunnedPlayerIndices(prev => prev.filter(i => i !== activeIdx));
        setTimeout(() => advanceToNextUnit(activeIdx + 1), 1200);
      } else if (!isUnlocked && !isPvP) {
        setTurnStatusType('missed');
        setTurnAnnouncement(`LƯỢT #${activeIdx + 1} BỎ LỠ: ${mon.name} chưa mở khóa lượt!`);
        sound.playWrong();
        setTimeout(() => advanceToNextUnit(activeIdx + 1), 1200);
      } else {
        setTurnStatusType('normal');
        setTurnAnnouncement(`LƯỢT CỦA BẠN: ${mon.name} (#${activeIdx + 1}) - Ra chiêu hoặc Hoán đổi ngọc!`);
      }
    } else {
      if (isPvP) {
        setTurnStatusType('enemy');
        setTurnAnnouncement('LƯỢT ĐỐI THỦ: Đang chờ máy chủ điều phối...');
        return;
      }

      setTurnStatusType('enemy');
      setTurnAnnouncement('ENEMY TURN: Opponent is preparing their move...');
      setTimeout(() => {
        startEnemyTurn();
      }, 700);
    }
  };

  const advanceToNextUnit = (nextStep: number) => {
    if (actingStepIndex < playerTeam.length && playerTeam[actingStepIndex]?.id === 'tidecrush') {
      if (tidecrushBuffTurns > 0) {
        const nextBuff = tidecrushBuffTurns - 1;
        setTidecrushBuffTurns(nextBuff);
        if (nextBuff === 0 && tidecrushBonusAtk > 0) {
          setPlayerTeam(prev =>
            prev.map(s =>
              s.id === 'tidecrush'
                ? { ...s, baseAtk: Math.max(30, s.baseAtk - tidecrushBonusAtk) }
                : s
            )
          );
          setTidecrushBonusAtk(0);
          setFloatingDamage({
            text: '🌊 Tidal Surge ATK buff ended',
            isEnemy: false,
          });
          setTimeout(() => setFloatingDamage(null), 1200);
        }
      }

      if (tidecrushCooldownTurns > 0) {
        setTidecrushCooldownTurns(prev => Math.max(0, prev - 1));
      }
    }

    setSelectedAbilityDetail(null);
    setActingStepIndex(nextStep);
    announceTurnForStep(nextStep);
  };

  const activeAttackingStarmon = isPvP
    ? (isMyTurnInPvP &&
       pvpActionMenu !== null &&
       pvpActionMenu.starmonIndex < playerTeam.length &&
       playerTeam[pvpActionMenu.starmonIndex]?.currentHp > 0
        ? playerTeam[pvpActionMenu.starmonIndex]
        : null)
    : (actingStepIndex < playerTeam.length &&
       unlockedPositions[actingStepIndex] &&
       playerTeam[actingStepIndex]?.currentHp > 0
        ? playerTeam[actingStepIndex]
        : null);

  useEffect(() => {
    if (enemyTeam[selectedEnemyIndex]?.currentHp <= 0) {
      const nextLiving = enemyTeam.findIndex(e => e.currentHp > 0);
      if (nextLiving !== -1) {
        setSelectedEnemyIndex(nextLiving);
      }
    }
  }, [enemyTeam, selectedEnemyIndex]);

  // ==========================================
  // BIG 8x8 MATCH-3 BOARD WITH ANTI-CASCADE
  // ==========================================
  const [board, setBoard] = useState<OrbTile[][]>([]);
  const [selectedTile, setSelectedTile] = useState<{ row: number; col: number } | null>(null);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [floatingDamage, setFloatingDamage] = useState<{ text: string; isEnemy: boolean } | null>(null);

  // Finds a valid swap that STRICTLY forms a straight horizontal or vertical line of 3 matching orbs
  const findValidTutorialMatchMove = useCallback((
    grid: OrbTile[][],
    preferredElem: ElementType = 'Electric'
  ): { r1: number; c1: number; r2: number; c2: number; matchElem: ElementType } | null => {
    if (!grid || !Array.isArray(grid) || grid.length === 0) return null;
    const rows = grid.length;
    const cols = grid[0]?.length || 0;

    const bestRef: { current: { r1: number; c1: number; r2: number; c2: number; matchElem: ElementType; score: number } | null } = { current: null };

    const checkStraightLineAt = (g: OrbTile[][], r: number, c: number): { count: number; element: ElementType } | null => {
      const elem = g[r]?.[c]?.element;
      if (!elem) return null;

      // Horizontal line check
      let hLeft = 0;
      while (c - hLeft - 1 >= 0 && g[r][c - hLeft - 1]?.element === elem) hLeft++;
      let hRight = 0;
      while (c + hRight + 1 < cols && g[r][c + hRight + 1]?.element === elem) hRight++;
      const hTotal = 1 + hLeft + hRight;

      // Vertical line check
      let vUp = 0;
      while (r - vUp - 1 >= 0 && g[r - vUp - 1][c]?.element === elem) vUp++;
      let vDown = 0;
      while (r + vDown + 1 < rows && g[r + vDown + 1][c]?.element === elem) vDown++;
      const vTotal = 1 + vUp + vDown;

      if (hTotal >= 3 || vTotal >= 3) {
        return {
          count: Math.max(hTotal >= 3 ? hTotal : 0, vTotal >= 3 ? vTotal : 0),
          element: elem,
        };
      }
      return null;
    };

    const tryPair = (r1: number, c1: number, r2: number, c2: number) => {
      const t1 = grid[r1]?.[c1];
      const t2 = grid[r2]?.[c2];
      if (!t1 || !t2 || !t1.element || !t2.element || t1.element === t2.element) return;

      // Create simulated board with swapped tiles
      const copy = grid.map(row => [...row]);
      copy[r1] = [...grid[r1]];
      copy[r2] = [...grid[r2]];
      copy[r1][c1] = { ...t2, row: r1, col: c1 };
      copy[r2][c2] = { ...t1, row: r2, col: c2 };

      // Check whether either swapped tile directly forms a straight 3-in-a-row match
      const m1 = checkStraightLineAt(copy, r1, c1);
      const m2 = checkStraightLineAt(copy, r2, c2);

      if (m1 || m2) {
        const winningMatch = (m1?.count ?? 0) >= (m2?.count ?? 0) ? m1! : m2!;
        let score = winningMatch.count;
        if (winningMatch.element === preferredElem) {
          score += 100;
        }

        if (!bestRef.current || score > bestRef.current.score) {
          bestRef.current = { r1, c1, r2, c2, matchElem: winningMatch.element, score };
        }
      }
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c < cols - 1) tryPair(r, c, r, c + 1);
        if (r < rows - 1) tryPair(r, c, r + 1, c);
      }
    }

    const best = bestRef.current;
    return best ? { r1: best.r1, c1: best.c1, r2: best.r2, c2: best.c2, matchElem: best.matchElem } : null;
  }, []);

  const generateBoardFromSeed = useCallback((seed: number): OrbTile[][] => {
    let current = seed;
    const nextRand = () => {
      current = (current * 9301 + 49297) % 233280;
      return current / 233280;
    };

    const grid: OrbTile[][] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      grid[r] = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        let available = [...ELEMENTS];
        if (c >= 2 && grid[r][c - 1]?.element === grid[r][c - 2]?.element) {
          available = available.filter(e => e !== grid[r][c - 1]?.element);
        }
        if (r >= 2 && grid[r - 1]?.[c]?.element === grid[r - 2]?.[c]?.element) {
          available = available.filter(e => e !== grid[r - 1]?.[c]?.element);
        }
        const elem = available[Math.floor(nextRand() * available.length)];
        grid[r][c] = {
          id: `orb_${r}_${c}`,
          element: elem,
          row: r,
          col: c,
        };
      }
    }
    return grid;
  }, []);

  const generateCleanBoard = useCallback((): OrbTile[][] => {
    const grid: OrbTile[][] = [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      grid[r] = [];
      for (let c = 0; c < BOARD_SIZE; c++) {
        let available = [...ELEMENTS];
        if (c >= 2 && grid[r][c - 1].element === grid[r][c - 2].element) {
          available = available.filter(e => e !== grid[r][c - 1].element);
        }
        if (r >= 2 && grid[r - 1][c].element === grid[r - 2][c].element) {
          available = available.filter(e => e !== grid[r - 1][c].element);
        }
        const elem = available[Math.floor(Math.random() * available.length)];
        grid[r][c] = {
          id: `orb_${r}_${c}_${Date.now()}_${Math.random()}`,
          element: elem,
          row: r,
          col: c,
        };
      }
    }

    if (tutorialStage === 1) {
      // Guarantee a crystal-clear straight horizontal line of 3 Electric match setup at row 3
      grid[3][1] = { ...grid[3][1], element: 'Fire' };
      grid[3][2] = { ...grid[3][2], element: 'Electric' };
      grid[3][3] = { ...grid[3][3], element: 'Electric' };
      grid[3][4] = { ...grid[3][4], element: 'Water' }; // Swapping with (3, 5) creates (3,2)+(3,3)+(3,4) Electric!
      grid[3][5] = { ...grid[3][5], element: 'Electric' };
      grid[3][6] = { ...grid[3][6], element: 'Wind' };
    }

    return grid;
  }, [tutorialStage]);

  const syncBoardFromData = useCallback((gridData: any) => {
    const deserialized = deserializeBoard(gridData);
    if (deserialized) {
      setBoard(deserialized);
    }
  }, []);

  useEffect(() => {
    syncBoardRef.current = syncBoardFromData;
  }, [syncBoardFromData]);

  useEffect(() => {
    // Single-player uses clean board; PvP initializes deterministic shared board from room seed
    if (!isPvP) {
      setBoard(generateCleanBoard());
    } else if (pvpRoomInfo?.code) {
      const code = pvpRoomInfo.code.toUpperCase().replace(/[^A-Z0-9]/g, '');
      let hash = 12345;
      for (let i = 0; i < code.length; i++) {
        hash = (hash * 31 + code.charCodeAt(i)) % 900000;
      }
      const seed = hash + 100000;
      setBoard(generateBoardFromSeed(seed));
    }
  }, [generateCleanBoard, generateBoardFromSeed, isPvP, pvpRoomInfo?.code]);

  const findMatches = (grid: OrbTile[][]): { row: number; col: number }[] => {
    const coords = new Set<string>();
    if (!grid || !Array.isArray(grid) || grid.length === 0) return [];
    for (let r = 0; r < BOARD_SIZE; r++) {
      let run = 1;
      for (let c = 0; c < BOARD_SIZE; c++) {
        const curr = grid[r]?.[c];
        const next = grid[r]?.[c + 1];
        if (c < BOARD_SIZE - 1 && curr?.element && next?.element && curr.element === next.element) {
          run++;
        } else {
          if (run >= 3) {
            for (let i = 0; i < run; i++) coords.add(`${r},${c - i}`);
          }
          run = 1;
        }
      }
    }
    for (let c = 0; c < BOARD_SIZE; c++) {
      let run = 1;
      for (let r = 0; r < BOARD_SIZE; r++) {
        const curr = grid[r]?.[c];
        const next = grid[r + 1]?.[c];
        if (r < BOARD_SIZE - 1 && curr?.element && next?.element && curr.element === next.element) {
          run++;
        } else {
          if (run >= 3) {
            for (let i = 0; i < run; i++) coords.add(`${r - i},${c}`);
          }
          run = 1;
        }
      }
    }
    return Array.from(coords).map(s => {
      const [r, c] = s.split(',').map(Number);
      return { row: r, col: c };
    });
  };

  const applyAntiCascadeLockout = (grid: OrbTile[][]): OrbTile[][] => {
    const copy = grid.map(row => row.map(tile => ({ ...tile })));
    let matches = findMatches(copy);
    let guard = 0;
    while (matches.length > 0 && guard < 6) {
      guard++;
      matches.forEach(m => {
        const curElem = copy[m.row][m.col].element;
        const diff = ELEMENTS.filter(e => e !== curElem);
        copy[m.row][m.col].element = diff[Math.floor(Math.random() * diff.length)];
      });
      matches = findMatches(copy);
    }
    return copy;
  };

  // Tính toán sinh ngọc mới sau match một cách đồng bộ (synchronous)
  const computeRefilledBoard = (grid: OrbTile[][], matchedCoords: { row: number; col: number }[]): OrbTile[][] => {
    const copy: (OrbTile | null)[][] = grid.map(row => row.map(tile => ({ ...tile })));
    matchedCoords.forEach(m => {
      if (copy[m.row] && copy[m.row][m.col]) {
        copy[m.row][m.col] = null;
      }
    });

    for (let c = 0; c < BOARD_SIZE; c++) {
      let bottom = BOARD_SIZE - 1;
      for (let r = BOARD_SIZE - 1; r >= 0; r--) {
        if (copy[r][c] !== null) {
          if (bottom !== r) {
            copy[bottom][c] = { ...copy[r][c]!, row: bottom };
            copy[r][c] = null;
          }
          bottom--;
        }
      }
      for (let r = bottom; r >= 0; r--) {
        copy[r][c] = {
          id: `orb_${r}_${c}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          element: ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)],
          row: r,
          col: c,
        };
      }
    }
    return applyAntiCascadeLockout(copy as OrbTile[][]);
  };

  // PLAYER TILE SWAP ACTION
  const handleTileClick = (r: number, c: number) => {
    if (isPvP && !isMyTurnInPvP) {
      // In PvP inspect mode: target can click tile to inspect without making moves
      sound.playClick();
      setSelectedTile(prev => prev && prev.row === r && prev.col === c ? null : { row: r, col: c });
      return;
    }
    const isTutorialFinalAttack = tutorialStage === 1 && (tutorialRound === 2 || tutorialHasRecordedSpeaking || (enemyTeam[0] && enemyTeam[0].currentHp < 320));
    if ((!activeAttackingStarmon && !isTutorialFinalAttack) || isSwapping || phase !== 'phase2_combat') return;

    if (!selectedTile) {
      sound.playClick();
      setSelectedTile({ row: r, col: c });
      if (isPvP && pvpRoomInfo?.code) {
        sendPvpMessage({
          type: 'board_tile_select',
          room_code: pvpRoomInfo.code,
          slot: pvpMySlotRef.current,
          tile: { row: r, col: c },
        });
      }
      return;
    }

    const dr = Math.abs(selectedTile.row - r);
    const dc = Math.abs(selectedTile.col - c);

    if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
      setIsSwapping(true);
      const fromRow = selectedTile.row;
      const fromCol = selectedTile.col;
      const orb1 = board[fromRow][fromCol];
      const orb2 = board[r][c];

      const swapped = board.map(row => row.map(cell => ({ ...cell })));
      swapped[fromRow][fromCol] = { ...orb2, row: fromRow, col: fromCol };
      swapped[r][c] = { ...orb1, row: r, col: c };

      setBoard(swapped);
      setSelectedTile(null);
      if (isPvP && pvpRoomInfo?.code) {
        sendPvpMessage({
          type: 'board_tile_select',
          room_code: pvpRoomInfo.code,
          slot: pvpMySlotRef.current,
          tile: null,
        });
      }

      setTimeout(() => {
        let matches = findMatches(swapped);
        if (isTutorialFinalAttack) {
          if (matches.length < 3) {
            matches = [
              { row: fromRow, col: fromCol },
              { row: r, col: c },
              { row: (r + 1) % BOARD_SIZE, col: c },
            ];
          }
          executeMatchAttack(matches, orb1?.element || 'Electric');
          setIsSwapping(false);
          return;
        }

        if (matches.length >= 3) {
          executeMatchAttack(matches, orb1?.element || 'Electric', [
            { from: { row: fromRow, col: fromCol }, to: { row: r, col: c } },
          ]);
        } else {
          sound.playWrong();
          setBoard(board);
        }
        setIsSwapping(false);
      }, 200);
    } else {
      sound.playClick();
      setSelectedTile({ row: r, col: c });
    }
  };

  const executeMatchAttack = (
    matches: { row: number; col: number }[],
    elem: ElementType,
    orbSwitches?: { from: { row: number; col: number }; to: { row: number; col: number } }[]
  ) => {
    const isTutorialFinalAttack = tutorialStage === 1 && (tutorialRound === 2 || tutorialHasRecordedSpeaking || (enemyTeam[0] && enemyTeam[0].currentHp < 320));

    // TUTORIAL 1 FINAL ATTACK: Decisively deduct enemy HP to 0, win immediately, and show Tutorial 1 Complete with 1000 Gold!
    if (isTutorialFinalAttack) {
      const currentEnemyHp = enemyTeam[0]?.currentHp || 320;
      const killDmg = Math.max(320, currentEnemyHp);

      // 1. Trừ sạch HP của đối thủ về 0 ngay lập tức
      setEnemyTeam(prev => prev.map(e => ({ ...e, currentHp: 0 })));
      sound.playAttackHit();
      setFloatingDamage({ text: `⚡ FINISH! -${killDmg} HP [TUTORIAL COMPLETE!]`, isEnemy: true });
      setTutorialHasSwappedOrbs(true);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: activeAttackingStarmon?.name || 'Voltlynx',
        actionType: 'match',
        message: '⚡ Voltlynx launched the final lightning attack!',
        detail: `Dealt ${killDmg} damage. Enemy was completely defeated!`,
      });

      // 2. Kích hoạt chiến thắng (chỉ trao thưởng 1000 Gold nếu chưa nhận lần nào)
      const earnedGold = hasClaimedTutorialReward ? 0 : 1000;
      setIsTutorial1Complete(true);
      setPhase('victory');
      setVictoryViewTab('rewards');
      setChestOpened(true);
      setChestRewards({
        gold: earnedGold,
        cards: 0,
        starmon: STARMON_ROSTER[0],
        isUnobtained: false,
      });
      if (!hasClaimedTutorialReward) {
        onTutorial1Reward?.();
      }
      sound.playRewardFanfare();
      try {
        confetti({ particleCount: 220, spread: 100 });
      } catch {}

      return;
    }

    if (!activeAttackingStarmon || activeAttackingStarmon.currentHp <= 0) return;
    const matchCount = matches.length;
    sound.playMatchPop(matchCount);

    // Strictly ensure target is a living enemy (Dead Starmon cannot be targeted!)
    let targetIdx = selectedEnemyIndex;
    if (!enemyTeam[targetIdx] || enemyTeam[targetIdx].currentHp <= 0) {
      targetIdx = enemyTeam.findIndex(e => e.currentHp > 0);
    }
    if (targetIdx === -1) {
      checkImmediateWinOrNext(actingStepIndex + 1);
      return;
    }
    setSelectedEnemyIndex(targetIdx);

    const targetEnemy = enemyTeam[targetIdx];
    const baseMult = getBaseMultiplierForOrbs(matchCount);

    // Same-Element Attack: Granted if the matched orbs share the exact element (or secondary) of the attacking Starmon (+10% DMG)
    const isSameElem = (elem === activeAttackingStarmon.element || elem === activeAttackingStarmon.secondaryElement);
    const sameElemBonus = isSameElem ? 0.10 : 0.0;

    // Vinedra Toxic Spore: Same-Element Earth attack triggers 35% poison
    if (isSameElem && (activeAttackingStarmon.id === 'vinedra' || activeAttackingStarmon.avatarSeed === 'vinedra')) {
      if (Math.random() < 0.35) {
        setEnemyPoisonTurns(prev => ({ ...prev, [targetIdx]: 2 }));
        addBattleLog({
          phase: 'combat',
          source: 'player',
          unitName: 'Vinedra',
          actionType: 'status',
          message: `🧪 Toxic Spore: Vinedra poisoned ${targetEnemy.name} for 2 turns (-10% DEF, 5% max HP damage/turn)!`,
        });
      }
    }

    // Elemental Counter: Granted if attacking Starmon's element counters targeted enemy's element (+10% DMG)
    const isCounter = (
      ELEMENT_COUNTERS[activeAttackingStarmon.element] === targetEnemy.element ||
      (activeAttackingStarmon.secondaryElement && ELEMENT_COUNTERS[activeAttackingStarmon.secondaryElement] === targetEnemy.element) ||
      ELEMENT_COUNTERS[elem] === targetEnemy.element
    );
    const counterBonus = isCounter ? 0.10 : 0.0;

    // Elemental Resistance: If attacking Starmon's element is countered by targeted enemy's element (-10% DMG)
    const isResisted = (
      ELEMENT_COUNTERS[targetEnemy.element] === activeAttackingStarmon.element ||
      (targetEnemy.secondaryElement && ELEMENT_COUNTERS[targetEnemy.secondaryElement] === activeAttackingStarmon.element)
    );
    const resistancePenalty = isResisted ? -0.10 : 0.0;

    const totalMult = Math.max(0.2, baseMult + sameElemBonus + counterBonus + resistancePenalty);
    const defDebuff = enemyDefDebuffs[targetIdx];
    const defMult = defDebuff && defDebuff.turns > 0 ? 1.25 : 1.0;
    // Poison status effect: DEF reduced by 10%
    const poisonDefMult = (enemyPoisonTurns[targetIdx] || 0) > 0 ? 1.10 : 1.0;

    // Critical Hit Calculation with Voltlynx / Vinedra Passive Buff:
    const isVoltlynx = (activeAttackingStarmon.id === 'voltlynx' || activeAttackingStarmon.avatarSeed === 'voltlynx');
    let critChance = 0.10 + (activeAttackingStarmon.researchCritChance || 0);
    if (isVoltlynx) {
      critChance += 0.25; // +25% extra critical chance
    }
    if (activeAttackingStarmon.id === 'obsidus' || activeAttackingStarmon.avatarSeed === 'obsidus') {
      critChance += 0.30;
    }
    if ((vinedraCritBonusTurns[actingStepIndex] || 0) > 0) {
      critChance += 0.20; // Vinedra Thorn Whip +20% crit bonus
    }

    const isCrit = Math.random() < critChance;
    let critMultiplier = 1.0;
    if (isCrit) {
      // Base crit 1.5x. For Voltlynx: critical attacks & abilities deal extra 25% DMG -> 1.5 * 1.25 = 1.875x!
      critMultiplier = isVoltlynx ? 1.875 : 1.5;
    }

    // Trojan Flare Passive: Infiltration Strike
    // Trojan Flare gains an additional 10% ATK and Piercing whenever a Shield is currently active on it.
    let baseAtkToUse = activeAttackingStarmon.baseAtk;
    let isPiercing = false;
    if ((activeAttackingStarmon.id === 'trojan_flare' || activeAttackingStarmon.avatarSeed === 'trojan_flare') && trojanShieldPoints > 0) {
      baseAtkToUse += Math.round(activeAttackingStarmon.baseAtk * 0.10);
      isPiercing = true;
    }

    // Khepri ATK increase (+20%) when Sun is active
    if ((activeAttackingStarmon.id === 'khepri' || activeAttackingStarmon.avatarSeed === 'khepri') && sunEffectTurns > 0) {
      baseAtkToUse += Math.round(activeAttackingStarmon.baseAtk * 0.20);
    }

    // Ritual of the Sun Effect: Fire DMG +20%, Water DMG -20%
    let sunDmgMult = 1.0;
    if (sunEffectTurns > 0) {
      if (elem === 'Fire') sunDmgMult = 1.20;
      else if (elem === 'Water') sunDmgMult = 0.80;
    }

    let dmg = Math.round(baseAtkToUse * totalMult * (isPiercing ? 1.25 : defMult) * poisonDefMult * critMultiplier * sunDmgMult);

    // Tutorial 1 Round 2: Final attack guarantees enemy knockout
    if (tutorialStage === 1 && tutorialRound === 2) {
      dmg = Math.max(dmg, targetEnemy.currentHp > 0 ? targetEnemy.currentHp : 320);
    }

    // Track Tutorial 1 swap progress
    setTutorialHasSwappedOrbs(true);

    const manaGain = matchCount * 5;
    // Glidron passive: Gain 2 mana for every Wind or Electric orb consumed by either side
    const isWindOrElectric = elem === 'Wind' || elem === 'Electric';
    const glidronBonusMana = isWindOrElectric ? matchCount * 2 : 0;

    // Tidecrush passive: Fluid Precision
    // Basic Match-3 attacks recover 10% of Tidecrush Max HP as ocean tide vitality.
    // If Tidecrush HP is full, gains 10 extra mana instead.
    // Healing Block debuff prevents HP recovery!
    const isTidecrush = activeAttackingStarmon.id === 'tidecrush' || activeAttackingStarmon.avatarSeed === 'tidecrush';
    const hasPlayerHealingBlock = (playerHealingBlockTurns[actingStepIndex] || 0) > 0;
    let tidecrushHeal = 0;
    let tidecrushExtraMana = 0;
    if (isTidecrush) {
      if (activeAttackingStarmon.currentHp >= activeAttackingStarmon.maxHp) {
        tidecrushExtraMana = 10;
      } else if (!hasPlayerHealingBlock) {
        tidecrushHeal = Math.round(activeAttackingStarmon.maxHp * 0.10);
      }
    }

    setPlayerTeam(prev =>
      prev.map((s, idx) => {
        let m = s.currentMana;
        let hp = s.currentHp;
        if (idx === actingStepIndex) {
          m += manaGain + tidecrushExtraMana;
          if (tidecrushHeal > 0) {
            hp = Math.min(s.maxHp, hp + tidecrushHeal);
          }
        }
        if (glidronBonusMana > 0 && (s.id === 'glidron' || s.avatarSeed === 'glidron') && s.currentHp > 0) {
          m += glidronBonusMana;
        }
        return { ...s, currentMana: Math.min(200, m), currentHp: hp };
      })
    );

    if (isTidecrush) {
      if (tidecrushExtraMana > 0) {
        addBattleLog({
          phase: 'combat',
          source: 'player',
          unitName: 'Tidecrush',
          actionType: 'status',
          message: '🌊 Tidecrush "Fluid Precision": HP is full! Gained +10 Extra Mana instead!',
        });
      } else if (tidecrushHeal > 0) {
        addBattleLog({
          phase: 'combat',
          source: 'player',
          unitName: 'Tidecrush',
          actionType: 'status',
          message: `🌊 Tidecrush "Fluid Precision": Recovered +${tidecrushHeal} HP from ocean tide vitality!`,
        });
      }
    }

    if (glidronBonusMana > 0) {
      setEnemyTeam(prev =>
        prev.map(e =>
          (e.id === 'enemy_glidron' || e.avatarSeed === 'glidron') && e.currentHp > 0
            ? { ...e, currentMana: Math.min(200, e.currentMana + glidronBonusMana) }
            : e
        )
      );
    }

    sound.playAttackHit();
    const floatCritText = (tutorialStage === 1 && tutorialRound === 2)
      ? `⚡ FINISH! -${dmg} HP [TUTORIAL COMPLETE!]`
      : isCrit
        ? isVoltlynx
          ? `⚡ CRIT! -${dmg} HP [+25% Voltlynx DMG]`
          : `💥 CRIT! -${dmg} HP`
        : `-${dmg} HP`;
    setFloatingDamage({ text: floatCritText, isEnemy: true });
    setTimeout(() => setFloatingDamage(null), 1200);

    // Record Battle Performance Statistics
    recordDamageDealt(elem, dmg);
    setPerformanceStats(prev => ({
      ...prev,
      totalMatchesMade: prev.totalMatchesMade + 1,
      totalOrbsCleared: prev.totalOrbsCleared + matchCount,
      maxMatchSize: Math.max(prev.maxMatchSize, matchCount),
    }));

    // Notify Quest progress
    onQuestProgress?.('match_orbs', { element: elem, count: matchCount });
    onQuestProgress?.('deal_damage', { element: elem, damage: dmg });
    if (matchCount >= 5) {
      onQuestProgress?.('combo_hyper');
    }

    // Log match-3 attack to Battle Log
    addBattleLog({
      phase: 'combat',
      source: 'player',
      unitName: activeAttackingStarmon.name,
      actionType: 'match',
      message: `${isCrit ? '⚡ CRITICAL HIT! ' : '⚔️ '}${activeAttackingStarmon.name} matched ${matchCount} ${elem} orbs!`,
      detail: `Dealt ${dmg} damage to ${targetEnemy.name}${isCrit && isVoltlynx ? ' (empowered by Voltlynx Passive: +25% Crit Chance & +25% DMG)!' : ''}. Gained +${manaGain} Mana.`,
    });

    // FIX LỖI 1: Tính toán ngọc refill đồng bộ để simplifiedNewBoard không bao giờ bị undefined
    const nextBoard = computeRefilledBoard(board, matches);

    if (isPvP && pvpRoomInfo?.code) {
      const simplifiedNewBoard = nextBoard.map(row => row.map(tile => ({ element: tile.element })));

      syncPvpAction({
        actionType: 'MATCH',
        elem,
        matchCount,
        orbSwitches: orbSwitches && orbSwitches.length > 0 ? orbSwitches : matches,
        damage: dmg,
        targetIdx,
        targetNewHp: Math.max(0, targetEnemy.currentHp - dmg),
        isCrit,
        attackerIndex: actingStepIndex,
        attackerName: activeAttackingStarmon.name,
        newBoard: simplifiedNewBoard,
      });

      // Trong chế độ PvP, việc trừ HP của target và chuyển lượt do hàm resolveAttackByPhase trên server quyết định thông qua sự kiện "attack_resolved"
      return;
    }

    setBoard(nextBoard);

    setEnemyTeam(prev =>
      prev.map((e, idx) => {
        if (idx === targetIdx) {
          const nextHp = Math.max(0, e.currentHp - dmg);
          if (e.currentHp > 0 && nextHp <= 0) {
            addBattleLog({
              phase: 'combat',
              source: 'system',
              actionType: 'defeat',
              message: `💀 Enemy ${e.name} was defeated!`,
            });
          }
          return { ...e, currentHp: nextHp };
        }
        return e;
      })
    );

    setTimeout(() => {
      // Check if Double Strike (Bubbleboon) still has remaining swap
      if ((activeAttackingStarmon.id === 'bubbleboon' || activeAttackingStarmon.avatarSeed === 'bubbleboon') && bubbleboonRemainingSwaps > 1) {
        setBubbleboonRemainingSwaps(1);
        setTurnAnnouncement('⚡ DOUBLE STRIKE: Bubbleboon còn 1 lượt hoán đổi ngọc nữa!');
        return;
      }
      setBubbleboonRemainingSwaps(1);
      checkImmediateWinOrNext(actingStepIndex + 1);
    }, 600);
  };

  // PLAYER CAST ABILITY
  const handleCastAbility = (abilityNum: 1 | 2) => {
    // In Tutorial 1 final attack, casting ability also immediately finishes enemy and wins!
    if (tutorialStage === 1 && (tutorialRound === 2 || tutorialHasRecordedSpeaking || (enemyTeam[0] && enemyTeam[0].currentHp < 320))) {
      setEnemyTeam(prev => prev.map(e => ({ ...e, currentHp: 0 })));
      sound.playAttackHit();
      setFloatingDamage({ text: '⚡ FINISH! -320 HP [TUTORIAL COMPLETE!]', isEnemy: true });
      setIsTutorial1Complete(true);
      setPhase('victory');
      setVictoryViewTab('rewards');
      setChestOpened(true);
      setChestRewards({
        gold: 1000,
        cards: 0,
        starmon: STARMON_ROSTER[0],
        isUnobtained: false,
      });
      onTutorial1Reward?.();
      sound.playRewardFanfare();
      try {
        confetti({ particleCount: 220, spread: 100 });
      } catch {}
      return;
    }

    // Dead Starmons CANNOT attack!
    if (!activeAttackingStarmon || activeAttackingStarmon.currentHp <= 0 || phase !== 'phase2_combat') return;
    if (isPvP && !isMyTurnInPvP) return;
    const skill = abilityNum === 1 ? activeAttackingStarmon.skill1 : activeAttackingStarmon.skill2;

    const syncCurrentSkill = (dmg: number, isAoE: boolean = false, targetIdx: number = selectedEnemyIndex) => {
      if (isPvP && pvpRoomInfo?.code && activeAttackingStarmon) {
        syncPvpAction({
          actionType: 'SKILL',
          abilityId: skill.id || `skill${abilityNum}`,
          abilityNum,
          skillName: skill.name,
          manaCost: skill.manaCost,
          damage: dmg,
          isAoE,
          targetIdx,
          attackerIndex: actingStepIndex,
          attackerName: activeAttackingStarmon.name,
        });
      }
    };

    // Silence check: If this Starmon is Silenced, it CANNOT cast Active Abilities!
    if ((playerSilenceTurns[actingStepIndex] || 0) > 0) {
      sound.playWrong();
      setFloatingDamage({ text: '🔇 SILENCED! Cannot cast Active Abilities!', isEnemy: false });
      setTimeout(() => setFloatingDamage(null), 1400);
      return;
    }

    if (activeAttackingStarmon.id === 'tidecrush' && abilityNum === 2 && tidecrushCooldownTurns > 0) {
      sound.playWrong();
      return;
    }

    if ((activeAttackingStarmon.id === 'trojan_flare' || activeAttackingStarmon.avatarSeed === 'trojan_flare') && abilityNum === 1 && trojanCooldownTurns > 0) {
      sound.playWrong();
      return;
    }

    const isCostFree = (activeAttackingStarmon.id === 'trojan_flare' || activeAttackingStarmon.avatarSeed === 'trojan_flare') && abilityNum === 1;
    if (activeAttackingStarmon.currentMana < skill.manaCost && activeAttackingStarmon.id !== 'tidecrush' && !isCostFree) {
      sound.playWrong();
      return;
    }

    sound.playSkillCast();
    setSelectedAbilityDetail(null);

    // BUBBLEBOON ABILITY 1: DOUBLE JET PUNCH (55 MANA)
    // Gain Double Strike for 1 turn. Bubbleboon performs consecutive orb switches instead of 1.
    // Passive Tidal Momentum: Gains permanent Resonance effect. Bubbleboon doesn't lose a turn when using its abilities.
    if ((activeAttackingStarmon.id === 'bubbleboon' || activeAttackingStarmon.avatarSeed === 'bubbleboon') && abilityNum === 1) {
      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex
            ? { ...s, currentMana: Math.max(0, s.currentMana - 55) }
            : s
        )
      );

      setBubbleboonDoubleStrikeTurns(1);
      setBubbleboonRemainingSwaps(2);

      sound.playSkillCast();
      setFloatingDamage({
        text: '🥊 DOUBLE JET PUNCH! Nhận Double Strike (2 lượt hoán đổi) & Resonance!',
        isEnemy: false,
      });
      setTimeout(() => setFloatingDamage(null), 1800);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Bubbleboon',
        actionType: 'skill',
        message: '💧 Bubbleboon cast "Double Jet Punch" (-55 Mana)!',
        detail: 'Gained Double Strike (2 consecutive orb switches) & Tidal Momentum (Resonance - action continues)!',
      });

      syncCurrentSkill(0, false, selectedEnemyIndex);
      onQuestProgress?.('cast_skill');

      setTurnAnnouncement('✨ RESONANCE! Bubbleboon tiếp tục lượt đi: Thực hiện 2 lần hoán đổi ngọc!');
      return; // Resonance allows immediate continuation of action!
    }

    // BUBBLEBOON ABILITY 2: BUBBLE BOMB (65 MANA)
    // Deals 180% Water Physical DMG to the target and converts 3 random non-water orbs into Water Orbs.
    // If this conversion inadvertently triggers a chain of 3 or more connected Water orbs, it inflicts an additional burst of DMG equal to 100% Atk.
    // Passive Tidal Momentum: Gains permanent Resonance effect. Bubbleboon doesn't lose a turn when using its abilities.
    if ((activeAttackingStarmon.id === 'bubbleboon' || activeAttackingStarmon.avatarSeed === 'bubbleboon') && abilityNum === 2) {
      let targetIdx = selectedEnemyIndex;
      if (!enemyTeam[targetIdx] || enemyTeam[targetIdx].currentHp <= 0) {
        targetIdx = enemyTeam.findIndex(e => e.currentHp > 0);
      }
      if (targetIdx === -1) {
        checkImmediateWinOrNext(actingStepIndex + 1);
        return;
      }

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex
            ? { ...s, currentMana: Math.max(0, s.currentMana - 65) }
            : s
        )
      );

      const baseDmg = Math.round(activeAttackingStarmon.baseAtk * 1.8);

      // Convert 3 random non-water orbs on board into Water orbs
      const nonWaterCoords: { r: number; c: number }[] = [];
      board.forEach((row, r) => {
        row.forEach((tile, c) => {
          if (tile.element !== 'Water') {
            nonWaterCoords.push({ r, c });
          }
        });
      });

      const shuffled = [...nonWaterCoords].sort(() => Math.random() - 0.5);
      const convertedCoords = shuffled.slice(0, 3);

      const newBoard = board.map(row => row.map(tile => ({ ...tile })));
      convertedCoords.forEach(({ r, c }) => {
        newBoard[r][c] = { ...newBoard[r][c], element: 'Water' };
      });
      setBoard(newBoard);

      // Check if conversion triggered 3+ connected Water orbs
      const matches = findMatches(newBoard);
      const waterMatches = matches.filter(m => newBoard[m.row]?.[m.col]?.element === 'Water');
      let extraBurstDmg = 0;
      if (waterMatches.length >= 3) {
        extraBurstDmg = activeAttackingStarmon.baseAtk;
      }

      const totalDmg = baseDmg + extraBurstDmg;

      sound.playAttackHit();
      setFloatingDamage({
        text: extraBurstDmg > 0
          ? `💣 BUBBLE BOMB! -${baseDmg} + BURST -${extraBurstDmg} DMG!`
          : `💣 BUBBLE BOMB! -${baseDmg} Water DMG!`,
        isEnemy: true,
      });
      setTimeout(() => setFloatingDamage(null), 1800);

      recordDamageDealt('Water', totalDmg);
      recordPlayerMonDamageDealt(actingStepIndex, totalDmg);
      recordEnemyMonDamageTaken(targetIdx, totalDmg);
      onQuestProgress?.('deal_damage', { element: 'Water', damage: totalDmg });
      onQuestProgress?.('cast_skill');

      setEnemyTeam(prev =>
        prev.map((e, idx) => {
          if (idx === targetIdx) {
            const nextHp = Math.max(0, e.currentHp - totalDmg);
            if (e.currentHp > 0 && nextHp <= 0) {
              addBattleLog({
                phase: 'combat',
                source: 'system',
                actionType: 'defeat',
                message: `💀 Enemy ${e.name} was defeated!`,
              });
            }
            return { ...e, currentHp: nextHp };
          }
          return e;
        })
      );

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Bubbleboon',
        actionType: 'skill',
        message: '💣 Bubbleboon cast "Bubble Bomb" (-65 Mana)!',
        detail: `Dealt ${baseDmg} Water DMG${extraBurstDmg > 0 ? ` + ${extraBurstDmg} Burst Chain DMG` : ''} and converted 3 orbs to Water!`,
      });

      syncCurrentSkill(totalDmg, false, targetIdx);

      setTurnAnnouncement('✨ RESONANCE! Bubbleboon tiếp tục lượt đi: Bạn có thể hoán đổi ngọc!');
      return; // Tidal Momentum allows continuation of action!
    }

    // TROJAN FLARE ABILITY 1: SIEGE CHARGE (0 MANA, 3 TURN COOLDOWN)
    // Gain Clarity (Immune to stun, froze bite, burn, poison) and Resonance effect for 1 turn (Resonance is applied in the next turn, not this).
    if ((activeAttackingStarmon.id === 'trojan_flare' || activeAttackingStarmon.avatarSeed === 'trojan_flare') && abilityNum === 1) {
      setTrojanHasClarity(true);
      setTrojanNextTurnResonance(true);
      setTrojanCooldownTurns(3);

      // Cure any debuffs (Clarity)
      setPlayerFrostbiteTurns(prev => ({ ...prev, [actingStepIndex]: 0 }));
      setPlayerSilenceTurns(prev => ({ ...prev, [actingStepIndex]: 0 }));
      setStunnedPlayerIndices(prev => prev.filter(i => i !== actingStepIndex));

      sound.playSkillCast();
      setFloatingDamage({
        text: '🛡️ SIEGE CHARGE! Clarity (Kháng hiệu ứng) & Resonance ở lượt sau!',
        isEnemy: false,
      });
      setTimeout(() => setFloatingDamage(null), 1800);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Trojan Flare',
        actionType: 'skill',
        message: '🔥 Trojan Flare activated "Siege Charge" (0 Mana, 3-turn CD)!',
        detail: 'Gained Clarity (Immune to stun, frostbite, burn, poison) & scheduled Resonance for next turn!',
      });

      syncCurrentSkill(0, false, selectedEnemyIndex);
      onQuestProgress?.('cast_skill');

      if (trojanCurrentResonance) {
        setTurnAnnouncement('✨ RESONANCE! Trojan Flare tiếp tục lượt đi: Bạn có thể hoán đổi ngọc!');
        return;
      }

      setTimeout(() => {
        checkImmediateWinOrNext(actingStepIndex + 1);
      }, 700);
      return;
    }

    // TROJAN FLARE ABILITY 2: TACTICAL DECOY (70 MANA)
    // Gain a shield equal to 220% of its current ATK (This shield does not expire and can only be broken via taking DMG).
    // Passive Infiltration Strike: Trojan Flare gains an additional 10% ATK and Piercing whenever a Shield is currently active on it.
    if ((activeAttackingStarmon.id === 'trojan_flare' || activeAttackingStarmon.avatarSeed === 'trojan_flare') && abilityNum === 2) {
      const shieldGain = Math.round(activeAttackingStarmon.baseAtk * 2.2);
      setTrojanShieldPoints(prev => prev + shieldGain);

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex
            ? { ...s, currentMana: Math.max(0, s.currentMana - 70) }
            : s
        )
      );

      sound.playSkillCast();
      setFloatingDamage({
        text: `🛡️ TACTICAL DECOY! +${shieldGain} Giáp vĩnh viễn (Kích hoạt +10% ATK & Xuyên Giáp)!`,
        isEnemy: false,
      });
      setTimeout(() => setFloatingDamage(null), 1800);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Trojan Flare',
        actionType: 'skill',
        message: '🛡️ Trojan Flare cast "Tactical Decoy" (-70 Mana)!',
        detail: `Gained +${shieldGain} Shield (220% ATK). Infiltration Strike activated (+10% ATK & Piercing)!`,
      });

      syncCurrentSkill(0, false, selectedEnemyIndex);
      onQuestProgress?.('cast_skill');

      if (trojanCurrentResonance) {
        setTurnAnnouncement('✨ RESONANCE! Trojan Flare tiếp tục lượt đi: Bạn có thể hoán đổi ngọc!');
        return;
      }

      setTimeout(() => {
        checkImmediateWinOrNext(actingStepIndex + 1);
      }, 700);
      return;
    }

    // TIDECRUSH ABILITY 2: TIDAL SURGE (PURE ATK STAT BUFF, 3 TURNS DURATION, 3 TURNS COOLDOWN, 0 DAMAGE)
    if (activeAttackingStarmon.id === 'tidecrush' && abilityNum === 2) {
      const currentMana = activeAttackingStarmon.currentMana;
      const bonusAtkPercent = currentMana * 0.2;
      const addedAtk = Math.max(1, Math.round(activeAttackingStarmon.baseAtk * (currentMana * 0.002)));
      const newAtk = activeAttackingStarmon.baseAtk + addedAtk;

      setTidecrushBonusAtk(addedAtk);
      setTidecrushBuffTurns(3);
      setTidecrushCooldownTurns(3);

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex
            ? {
                ...s,
                baseAtk: newAtk,
                currentMana: 0,
              }
            : s
        )
      );

      setFloatingDamage({
        text: `🌊 TIDAL SURGE! +${addedAtk} ATK (+${bonusAtkPercent.toFixed(1)}%) LASTS 3 TURNS [0 DMG]`,
        isEnemy: false,
      });

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Tidecrush',
        actionType: 'skill',
        message: `🌊 Tidecrush activated "Tidal Surge" (+${addedAtk} ATK, 3 turns)!`,
        detail: `Transmuted ${currentMana} Mana into +${bonusAtkPercent.toFixed(1)}% bonus Attack!`,
      });

      syncCurrentSkill(0, false, selectedEnemyIndex);

      setTimeout(() => setFloatingDamage(null), 1600);
      if (isPvP) return;

      setTimeout(() => {
        advanceToNextUnit(actingStepIndex + 1);
      }, 700);
      return;
    }

    // AQUANYMPH ABILITY 1: HYDRO CYCLONE (50 MANA)
    // Deals 180% Water DMG and has 20% to give Frostbite to the target for 3 turns.
    // If the target already has Frostbite, silent them for 1 turn!
    if ((activeAttackingStarmon.id === 'aquanymph' || activeAttackingStarmon.avatarSeed === 'aquanymph') && abilityNum === 1) {
      if (activeAttackingStarmon.currentMana < skill.manaCost) {
        sound.playWrong();
        return;
      }

      let targetIdx = selectedEnemyIndex;
      if (enemyStoneGolemTauntTurns > 0) {
        const golemIdx = enemyTeam.findIndex(e => (e.id === 'enemy_golem' || e.avatarSeed === 'stone_golem') && e.currentHp > 0);
        if (golemIdx !== -1) targetIdx = golemIdx;
      }
      if (!enemyTeam[targetIdx] || enemyTeam[targetIdx].currentHp <= 0) {
        targetIdx = enemyTeam.findIndex(e => e.currentHp > 0);
      }
      if (targetIdx === -1) {
        checkImmediateWinOrNext(actingStepIndex + 1);
        return;
      }
      setSelectedEnemyIndex(targetIdx);

      const targetEnemy = enemyTeam[targetIdx];
      const hasFrostbiteAlready = (enemyFrostbiteTurns[targetIdx] || 0) > 0;
      let dmg = Math.round(activeAttackingStarmon.baseAtk * 1.8);
      if ((playerFrostbiteTurns[actingStepIndex] || 0) > 0) {
        dmg = Math.round(dmg * 0.9); // Frostbite reduces Attack by 10%
      }

      let effectDesc = '';
      if (hasFrostbiteAlready) {
        // Target ALREADY has Frostbite: Silence them for 1 turn!
        setEnemySilenceTurns(prev => ({ ...prev, [targetIdx]: 1 }));
        effectDesc = '🔇 SILENCED (1 turn)';
      } else {
        // 20% chance to give Frostbite for 3 turns (80% chance does not proc)
        const isFrostbiteProc = Math.random() < 0.20;
        if (isFrostbiteProc) {
          setEnemyFrostbiteTurns(prev => ({ ...prev, [targetIdx]: 3 }));
          effectDesc = '❄️ FROSTBITE (20% proc, 3 turns)';
        }
      }

      // Check Frostmoth Passive Absolute Zero: Allies' Water and Wind skills have 10% chance to give Frostbite for 1 turn
      const hasAliveFrostmoth = playerTeam.some(p => (p.id === 'frostmoth' || p.avatarSeed === 'frostmoth') && p.currentHp > 0);
      if (hasAliveFrostmoth && Math.random() < 0.10) {
        setEnemyFrostbiteTurns(prev => ({ ...prev, [targetIdx]: Math.max(prev[targetIdx] || 0, 1) }));
        if (!effectDesc) effectDesc = '❄️ FROSTBITE (Absolute Zero 10%, 1t)';
      }

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex
            ? { ...s, currentMana: Math.max(0, s.currentMana - skill.manaCost) }
            : s
        )
      );

      sound.playAttackHit();
      setFloatingDamage({
        text: `💥 -${dmg} HP ${effectDesc ? `& ${effectDesc}` : ''}`,
        isEnemy: true,
      });
      setTimeout(() => setFloatingDamage(null), 1500);

      recordDamageDealt('Water', dmg);
      recordPlayerMonDamageDealt(actingStepIndex, dmg);
      recordEnemyMonDamageTaken(targetIdx, dmg);
      onQuestProgress?.('deal_damage', { element: 'Water', damage: dmg });
      onQuestProgress?.('cast_skill');

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Aquanymph',
        actionType: 'skill',
        message: `🌊 Aquanymph cast "Hydro Cyclone" (-${skill.manaCost} Mana)!`,
        detail: `Dealt ${dmg} Water DMG to ${targetEnemy.name}${effectDesc ? ` and applied ${effectDesc}` : ''}.`,
      });

      if (isPvP) {
        syncCurrentSkill(dmg, false, targetIdx);
        return;
      }

      setEnemyTeam(prev =>
        prev.map((e, idx) => {
          if (idx === targetIdx) {
            const nextHp = Math.max(0, e.currentHp - dmg);
            if (e.currentHp > 0 && nextHp <= 0) {
              addBattleLog({
                phase: 'combat',
                source: 'system',
                actionType: 'defeat',
                message: `💀 Enemy ${e.name} was defeated!`,
              });
            }
            return { ...e, currentHp: nextHp };
          }
          return e;
        })
      );

      syncCurrentSkill(dmg, false, targetIdx);

      setTimeout(() => {
        checkImmediateWinOrNext(actingStepIndex + 1);
      }, 700);
      return;
    }

    // AQUANYMPH ABILITY 2: LOTUS RAIN (125 MANA) - HEALS ALL ALLIES FOR 160 HP
    if ((activeAttackingStarmon.id === 'aquanymph' || activeAttackingStarmon.avatarSeed === 'aquanymph') && abilityNum === 2) {
      if (activeAttackingStarmon.currentMana < 125) {
        sound.playWrong();
        return;
      }

      setPlayerTeam(prev =>
        prev.map((s, idx) => {
          const nextMana = idx === actingStepIndex ? Math.max(0, s.currentMana - 125) : s.currentMana;
          const isBlocked = (playerHealingBlockTurns[idx] || 0) > 0;
          const nextHp = (s.currentHp > 0 && !isBlocked) ? Math.min(s.maxHp, s.currentHp + 160) : s.currentHp;
          return { ...s, currentMana: nextMana, currentHp: nextHp };
        })
      );

      sound.playSkillCast();
      setFloatingDamage({ text: '🌸 LOTUS RAIN: +160 HP HEAL TO ALL ALLIES!', isEnemy: false });
      setTimeout(() => setFloatingDamage(null), 1500);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Aquanymph',
        actionType: 'skill',
        message: '🌸 Aquanymph cast "Lotus Rain" (-125 Mana)!',
        detail: 'Restored 160 HP to all living allies with purifying rainfall.',
      });

      syncCurrentSkill(0, true, 0);

      onQuestProgress?.('cast_skill');
      if (isPvP) return;
      setTimeout(() => advanceToNextUnit(actingStepIndex + 1), 700);
      return;
    }

    // VOLTLYNX ABILITY 2: THUNDER BOLT (65 MANA) - 3 COMPLETELY RANDOM STRIKES
    // Can hit the same target 3 times, hit all 3 targets, or hit 1 target 2 times and another 1 time!
    if ((activeAttackingStarmon.id === 'voltlynx' || activeAttackingStarmon.avatarSeed === 'voltlynx') && abilityNum === 2) {
      if (activeAttackingStarmon.currentMana < skill.manaCost) {
        sound.playWrong();
        return;
      }

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex
            ? { ...s, currentMana: Math.max(0, s.currentMana - skill.manaCost) }
            : s
        )
      );

      let currentEnemies = [...enemyTeam];
      const strikeDetails: string[] = [];
      let totalDmg = 0;

      for (let s = 1; s <= 3; s++) {
        const livingIndices = currentEnemies
          .map((e, idx) => (e.currentHp > 0 ? idx : -1))
          .filter(idx => idx !== -1);
        if (livingIndices.length === 0) break;

        // Completely random choice among current living targets:
        const targetIdx = livingIndices[Math.floor(Math.random() * livingIndices.length)];
        const target = currentEnemies[targetIdx];

        // Voltlynx ability deals extra 25% DMG
        let strikeDmg = Math.round(activeAttackingStarmon.baseAtk * 0.9 * 1.25);
        if ((playerFrostbiteTurns[actingStepIndex] || 0) > 0) {
          strikeDmg = Math.round(strikeDmg * 0.9); // Frostbite -10% ATK
        }

        // Elemental calculation: Electric counters Water (+10%)
        if (target.element === 'Water') {
          strikeDmg = Math.round(strikeDmg * 1.1);
        } else if (target.element === 'Wind') {
          // Wind counters Electric (-10%)
          strikeDmg = Math.round(strikeDmg * 0.9);
        }

        // Target DEF calculation
        const targetDef = target.def ?? 20;
        strikeDmg = Math.max(1, Math.round(strikeDmg * (100 / (100 + targetDef))));

        // Voltlynx Passive: +25% extra critical chance, and critical attacks & abilities deal extra 25% DMG!
        // 10% base + 25% extra = 35% chance per bolt!
        const isBoltCrit = Math.random() < 0.35;
        if (isBoltCrit) {
          // Extra 25% DMG on crit: 1.5 * 1.25 = 1.875x!
          strikeDmg = Math.round(strikeDmg * 1.875);
        }

        const nextHp = Math.max(0, target.currentHp - strikeDmg);
        currentEnemies[targetIdx] = { ...target, currentHp: nextHp };
        totalDmg += strikeDmg;
        recordEnemyMonDamageTaken(targetIdx, strikeDmg);
        strikeDetails.push(`Strike #${s}: -${strikeDmg} HP to ${target.name} (#${targetIdx + 1})${isBoltCrit ? ' ⚡ CRIT! (+25% DMG)' : ''}`);
      }

      if (isPvP) {
        syncCurrentSkill(totalDmg, true, selectedEnemyIndex);
        return;
      }

      setEnemyTeam(currentEnemies);
      recordDamageDealt('Electric', totalDmg);
      recordPlayerMonDamageDealt(actingStepIndex, totalDmg);
      onQuestProgress?.('deal_damage', { element: 'Electric', damage: totalDmg });
      onQuestProgress?.('cast_skill');
      sound.playAttackHit();

      setFloatingDamage({
        text: `⚡ THUNDER BOLT! (3 Random Strikes: Total -${totalDmg} HP)`,
        isEnemy: true,
      });
      setTimeout(() => setFloatingDamage(null), 1600);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Voltlynx',
        actionType: 'skill',
        message: `⚡ Voltlynx unleashed "Thunder Bolt" (-${skill.manaCost} Mana)!`,
        detail: strikeDetails.join(' | '),
      });

      syncCurrentSkill(totalDmg, true, 0);

      setTimeout(() => {
        checkImmediateWinOrNext(actingStepIndex + 1);
      }, 700);
      return;
    }

    // OBSIDUS ABILITY 1: STONE CRASH (PIERCING) (40 MANA)
    // Gain Piercing for 2 turns, ignoring 50% of target DEF and STILL ABLE TO MOVE THIS TURN!
    if ((activeAttackingStarmon.id === 'obsidus' || activeAttackingStarmon.avatarSeed === 'obsidus') && abilityNum === 1) {
      if (activeAttackingStarmon.currentMana < skill.manaCost) {
        sound.playWrong();
        return;
      }

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex
            ? { ...s, currentMana: Math.max(0, s.currentMana - skill.manaCost) }
            : s
        )
      );

      // Grant Piercing for 2 turns to this Starmon
      setPlayerPiercingTurns(prev => ({
        ...prev,
        [actingStepIndex]: 2,
      }));

      // Trigger piercing visual effect animation (arrowhead piercing line)
      setShowPiercingAnim(true);
      setTimeout(() => setShowPiercingAnim(false), 2200);

      sound.playAttackHit();
      setFloatingDamage({
        text: '🗡️ PIERCING ACTIVATED! (Ignores 50% DEF - Move Orbs!)',
        isEnemy: false,
      });
      setTimeout(() => setFloatingDamage(null), 1800);

      onQuestProgress?.('cast_skill');

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Obsidus',
        actionType: 'skill',
        message: '🗡️ Obsidus cast "Stone Crash" (-40 Mana)!',
        detail: 'Gain Piercing for 2 turns, ignoring 50% of target DEF and still able to move this turn.',
      });

      if (isPvP) {
        syncCurrentSkill(Math.round(activeAttackingStarmon.baseAtk * 1.4), false, selectedEnemyIndex);
        return;
      }
      // DO NOT advance unit or end turn! The player can now swap/match orbs!
      return;
    }

    // CORALUS ABILITY 1: AQUA PINCER (40 MANA)
    // Deals 180% DMG and reduces enemy DEF by 25% for 2 turns!
    if (activeAttackingStarmon.id === 'coralus' && abilityNum === 1) {
      if (activeAttackingStarmon.currentMana < 40) {
        sound.playWrong();
        return;
      }

      let targetIdx = selectedEnemyIndex;
      if (enemyStoneGolemTauntTurns > 0) {
        const golemIdx = enemyTeam.findIndex(e => (e.id === 'enemy_golem' || e.avatarSeed === 'stone_golem') && e.currentHp > 0);
        if (golemIdx !== -1) targetIdx = golemIdx;
      }
      // Dead enemies CANNOT be targeted!
      if (!enemyTeam[targetIdx] || enemyTeam[targetIdx].currentHp <= 0) {
        targetIdx = enemyTeam.findIndex(e => e.currentHp > 0);
      }
      if (targetIdx === -1) {
        checkImmediateWinOrNext(actingStepIndex + 1);
        return;
      }
      setSelectedEnemyIndex(targetIdx);

      const dmg = Math.round(activeAttackingStarmon.baseAtk * 1.8);
      const targetEnemy = enemyTeam[targetIdx];

      // Apply 25% DEF reduction for 2 turns
      setEnemyDefDebuffs(prev => ({
        ...prev,
        [targetIdx]: { percent: 0.25, turns: 2 },
      }));

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex
            ? { ...s, currentMana: Math.max(0, s.currentMana - 40) }
            : s
        )
      );

      sound.playAttackHit();
      setFloatingDamage({
        text: `💥 -${dmg} HP & 🛡️ DEF -25% (2t)!`,
        isEnemy: true,
      });
      setTimeout(() => setFloatingDamage(null), 1400);

      recordDamageDealt('Water', dmg);
      onQuestProgress?.('deal_damage', { element: 'Water', damage: dmg });
      onQuestProgress?.('cast_skill');

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Coralus',
        actionType: 'skill',
        message: `🌊 Coralus cast "Aqua Pincer" (-40 Mana)!`,
        detail: `Dealt ${dmg} DMG to ${targetEnemy.name} and reduced DEF by 25% for 2 turns!`,
      });

      if (isPvP) {
        syncCurrentSkill(dmg, false, targetIdx);
        return;
      }

      setEnemyTeam(prev =>
        prev.map((e, idx) => {
          if (idx === targetIdx) {
            const nextHp = Math.max(0, e.currentHp - dmg);
            if (e.currentHp > 0 && nextHp <= 0) {
              addBattleLog({
                phase: 'combat',
                source: 'system',
                actionType: 'defeat',
                message: `💀 Enemy ${e.name} was defeated!`,
              });
            }
            return { ...e, currentHp: nextHp };
          }
          return e;
        })
      );

      syncCurrentSkill(dmg, false, targetIdx);

      setTimeout(() => {
        checkImmediateWinOrNext(actingStepIndex + 1);
      }, 700);
      return;
    }

    // CORALUS ABILITY 2: BUBBLE FORTRESS (70 MANA, LASTS 3 TURNS)
    if (activeAttackingStarmon.id === 'coralus' && abilityNum === 2) {
      if (activeAttackingStarmon.currentMana < 70) {
        sound.playWrong();
        return;
      }

      setTeamShieldPoints(prev => prev + 200);
      setTeamShieldTurns(3);
      setCoralusShieldTurns(3);
      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex
            ? { ...s, currentMana: Math.max(0, s.currentMana - 70) }
            : s
        )
      );
      setFloatingDamage({ text: '🛡️ +200 TEAM BARRIER (LASTS 3 TURNS)!', isEnemy: false });

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Coralus',
        actionType: 'skill',
        message: '🛡️ Coralus cast "Bubble Fortress" (-70 Mana)!',
        detail: 'Granted +200 Barrier to all team members for 3 turns.',
      });

      syncCurrentSkill(0, true, 0);

      setTimeout(() => setFloatingDamage(null), 1400);
      if (isPvP) return;
      setTimeout(() => advanceToNextUnit(actingStepIndex + 1), 700);
      return;
    }

    // STONE GOLEM ABILITY 1: STONE CRASH (60 MANA)
    // Deals 120% Earth Physical Damage to target enemy, 30% chance to stun
    if ((activeAttackingStarmon.id === 'stone_golem' || activeAttackingStarmon.avatarSeed === 'stone_golem') && abilityNum === 1) {
      const dmg = Math.round(activeAttackingStarmon.baseAtk * 1.2);
      const isStunned = Math.random() < 0.3;

      let targetIdx = selectedEnemyIndex;
      if (enemyStoneGolemTauntTurns > 0) {
        const golemIdx = enemyTeam.findIndex(e => (e.id === 'enemy_golem' || e.avatarSeed === 'stone_golem') && e.currentHp > 0);
        if (golemIdx !== -1) targetIdx = golemIdx;
      }
      // Dead enemies CANNOT be targeted!
      if (!enemyTeam[targetIdx] || enemyTeam[targetIdx].currentHp <= 0) {
        targetIdx = enemyTeam.findIndex(e => e.currentHp > 0);
      }
      if (targetIdx === -1) {
        checkImmediateWinOrNext(actingStepIndex + 1);
        return;
      }
      setSelectedEnemyIndex(targetIdx);
      const targetEnemy = enemyTeam[targetIdx];

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex
            ? { ...s, currentMana: Math.max(0, s.currentMana - skill.manaCost) }
            : s
        )
      );

      sound.playAttackHit();
      if (isStunned) {
        setStunnedEnemyIndices(prev => Array.from(new Set([...prev, targetIdx])));
        setFloatingDamage({
          text: `💥 -${dmg} HP & 💫 STUNNED! (30% chance)`,
          isEnemy: true,
        });
      } else {
        setFloatingDamage({ text: `💥 -${dmg} HP`, isEnemy: true });
      }
      setTimeout(() => setFloatingDamage(null), 1400);

      recordDamageDealt('Earth', dmg);
      onQuestProgress?.('deal_damage', { element: 'Earth', damage: dmg });
      onQuestProgress?.('cast_skill');

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Stone Golem',
        actionType: 'skill',
        message: `🪨 Stone Golem cast "Stone Crash" (-${skill.manaCost} Mana)!`,
        detail: `Dealt ${dmg} Earth DMG to ${targetEnemy.name}${isStunned ? ' and inflicted STUN (skips next turn)!' : '.'}`,
      });

      if (isPvP) {
        syncCurrentSkill(dmg, false, targetIdx);
        return;
      }

      setEnemyTeam(prev =>
        prev.map((e, idx) => {
          if (idx === targetIdx) {
            const nextHp = Math.max(0, e.currentHp - dmg);
            if (e.currentHp > 0 && nextHp <= 0) {
              addBattleLog({
                phase: 'combat',
                source: 'system',
                actionType: 'defeat',
                message: `💀 Enemy ${e.name} was defeated!`,
              });
            }
            return { ...e, currentHp: nextHp };
          }
          return e;
        })
      );

      syncCurrentSkill(dmg, false, targetIdx);

      setTimeout(() => {
        checkImmediateWinOrNext(actingStepIndex + 1);
      }, 700);
      return;
    }

    // STONE GOLEM ABILITY 2: FORTRESS BULWARK
    // Taunts all enemies for 2 turns, grants itself Shield = 18% Max HP for 2 turns
    if ((activeAttackingStarmon.id === 'stone_golem' || activeAttackingStarmon.avatarSeed === 'stone_golem') && abilityNum === 2) {
      const bulwarkShield = Math.round(activeAttackingStarmon.maxHp * 0.18);
      setTeamShieldPoints(prev => prev + bulwarkShield);
      setTeamShieldTurns(2);
      setPlayerStoneGolemTauntTurns(2);

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex
            ? { ...s, currentMana: Math.max(0, s.currentMana - skill.manaCost) }
            : s
        )
      );

      setFloatingDamage({
        text: `🛡️ FORTRESS BULWARK: Taunted enemies for 2 turns & gained +${bulwarkShield} Shield!`,
        isEnemy: false,
      });

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Stone Golem',
        actionType: 'skill',
        message: `🏰 Stone Golem cast "Fortress Bulwark" (-${skill.manaCost} Mana)!`,
        detail: `Taunts all incoming single-target attacks for 2 turns and gained +${bulwarkShield} Shield.`,
      });

      syncCurrentSkill(0, true, 0);

      setTimeout(() => setFloatingDamage(null), 1600);
      if (isPvP) return;

      setTimeout(() => {
        advanceToNextUnit(actingStepIndex + 1);
      }, 700);
      return;
    }

    // ==============================================================
    // ZAPWING ABILITY 1: LIGHTNING BEAK (20 MANA - SINGLE ENEMY)
    // 135% Electric DMG, 35% chance to inflict Stun to the target!
    // ==============================================================
    if ((activeAttackingStarmon.id === 'zapwing' || activeAttackingStarmon.avatarSeed === 'zapwing') && abilityNum === 1) {
      if (activeAttackingStarmon.currentMana < 20) {
        sound.playWrong();
        return;
      }

      let targetIdx = selectedEnemyIndex;
      if (enemyStoneGolemTauntTurns > 0) {
        const golemIdx = enemyTeam.findIndex(e => (e.id === 'enemy_golem' || e.avatarSeed === 'stone_golem') && e.currentHp > 0);
        if (golemIdx !== -1) targetIdx = golemIdx;
      }
      if (!enemyTeam[targetIdx] || enemyTeam[targetIdx].currentHp <= 0) {
        targetIdx = enemyTeam.findIndex(e => e.currentHp > 0);
      }
      if (targetIdx === -1) {
        checkImmediateWinOrNext(actingStepIndex + 1);
        return;
      }
      setSelectedEnemyIndex(targetIdx);
      const targetEnemy = enemyTeam[targetIdx];

      const isStunned = Math.random() < 0.35;
      const dmg = Math.round(activeAttackingStarmon.baseAtk * 1.35);

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex
            ? { ...s, currentMana: Math.max(0, s.currentMana - 20) }
            : s
        )
      );

      sound.playAttackHit();
      if (isStunned) {
        setStunnedEnemyIndices(prev => Array.from(new Set([...prev, targetIdx])));
        setFloatingDamage({
          text: `⚡ -${dmg} HP & 💫 STUNNED! (35% chance)`,
          isEnemy: true,
        });
      } else {
        setFloatingDamage({ text: `⚡ -${dmg} HP`, isEnemy: true });
      }
      setTimeout(() => setFloatingDamage(null), 1400);

      recordDamageDealt('Electric', dmg);
      recordPlayerMonDamageDealt(actingStepIndex, dmg);
      recordEnemyMonDamageTaken(targetIdx, dmg);
      onQuestProgress?.('deal_damage', { element: 'Electric', damage: dmg });
      onQuestProgress?.('cast_skill');

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Zapwing',
        actionType: 'skill',
        message: `⚡ Zapwing cast "Lightning Beak" (-20 Mana)!`,
        detail: `Dealt ${dmg} Electric DMG to ${targetEnemy.name}${isStunned ? ' and inflicted STUN (35% chance)!' : '.'}`,
      });

      if (isPvP) {
        syncCurrentSkill(dmg, false, targetIdx);
        return;
      }

      setEnemyTeam(prev =>
        prev.map((e, idx) => {
          if (idx === targetIdx) {
            const nextHp = Math.max(0, e.currentHp - dmg);
            if (e.currentHp > 0 && nextHp <= 0) {
              addBattleLog({
                phase: 'combat',
                source: 'system',
                actionType: 'defeat',
                message: `💀 Enemy ${e.name} was defeated!`,
              });
            }
            return { ...e, currentHp: nextHp };
          }
          return e;
        })
      );

      setTimeout(() => {
        checkImmediateWinOrNext(actingStepIndex + 1);
      }, 700);
      return;
    }

    // ==============================================================
    // ZAPWING ABILITY 2: THUNDER GALE TEMPEST (75 MANA - AOE)
    // 220% Electric DMG to ALL enemies!
    // ==============================================================
    if ((activeAttackingStarmon.id === 'zapwing' || activeAttackingStarmon.avatarSeed === 'zapwing') && abilityNum === 2) {
      if (activeAttackingStarmon.currentMana < 75) {
        sound.playWrong();
        return;
      }

      const dmg = Math.round(activeAttackingStarmon.baseAtk * 2.2);

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex
            ? { ...s, currentMana: Math.max(0, s.currentMana - 75) }
            : s
        )
      );

      sound.playAttackHit();
      setFloatingDamage({
        text: `⚡🌪️ THUNDER GALE TEMPEST! -${dmg} AoE HP!`,
        isEnemy: true,
      });
      setTimeout(() => setFloatingDamage(null), 1500);

      const livingEnemies = enemyTeam.filter(e => e.currentHp > 0);
      recordDamageDealt('Electric', dmg * Math.max(1, livingEnemies.length));
      recordPlayerMonDamageDealt(actingStepIndex, dmg * Math.max(1, livingEnemies.length));
      onQuestProgress?.('deal_damage', { element: 'Electric', damage: dmg * Math.max(1, livingEnemies.length) });
      onQuestProgress?.('cast_skill');

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Zapwing',
        actionType: 'skill',
        message: `⚡🌪️ Zapwing unleashed "Thunder Gale Tempest" (-75 Mana)!`,
        detail: `Dealt ${dmg} Electric DMG to ALL enemies!`,
      });

      enemyTeam.forEach((e, idx) => {
        if (e.currentHp > 0) {
          recordEnemyMonDamageTaken(idx, dmg);
        }
      });

      if (isPvP) {
        syncCurrentSkill(dmg, true, selectedEnemyIndex);
        return;
      }

      setEnemyTeam(prev =>
        prev.map(e => {
          const nextHp = Math.max(0, e.currentHp - dmg);
          if (e.currentHp > 0 && nextHp <= 0) {
            addBattleLog({
              phase: 'combat',
              source: 'system',
              actionType: 'defeat',
              message: `💀 Enemy ${e.name} was defeated!`,
            });
          }
          return { ...e, currentHp: nextHp };
        })
      );

      setTimeout(() => {
        checkImmediateWinOrNext(actingStepIndex + 1);
      }, 700);
      return;
    }

    // ==============================================================
    // VINEDRA ABILITY 1: THORN WHIP (25 MANA - MULTI-CAST IN SAME TURN IF >= 25 MANA)
    // 70% Earth DMG. Gains +20% crit chance.
    // If Vinedra has 25 or more mana after using this ability, it can use Thorn Whip again!
    // ==============================================================
    if ((activeAttackingStarmon.id === 'vinedra' || activeAttackingStarmon.avatarSeed === 'vinedra') && abilityNum === 1) {
      if (activeAttackingStarmon.currentMana < 25) {
        sound.playWrong();
        return;
      }

      let targetIdx = selectedEnemyIndex;
      if (enemyStoneGolemTauntTurns > 0) {
        const golemIdx = enemyTeam.findIndex(e => (e.id === 'enemy_golem' || e.avatarSeed === 'stone_golem') && e.currentHp > 0);
        if (golemIdx !== -1) targetIdx = golemIdx;
      }
      if (!enemyTeam[targetIdx] || enemyTeam[targetIdx].currentHp <= 0) {
        targetIdx = enemyTeam.findIndex(e => e.currentHp > 0);
      }
      if (targetIdx === -1) {
        checkImmediateWinOrNext(actingStepIndex + 1);
        return;
      }
      setSelectedEnemyIndex(targetIdx);
      const targetEnemy = enemyTeam[targetIdx];

      // +20% crit chance applied
      const existingCrit = (vinedraCritBonusTurns[actingStepIndex] || 0) > 0 ? 0.20 : 0.0;
      const isCrit = Math.random() < (0.10 + existingCrit);
      const critMult = isCrit ? 1.5 : 1.0;
      let dmg = Math.round(activeAttackingStarmon.baseAtk * 0.7 * critMult);
      if ((playerFrostbiteTurns[actingStepIndex] || 0) > 0) {
        dmg = Math.round(dmg * 0.9);
      }

      // Gain +20% crit chance for attacks & abilities
      setVinedraCritBonusTurns(prev => ({
        ...prev,
        [actingStepIndex]: Math.max(prev[actingStepIndex] || 0, 2),
      }));

      // Toxic Spore passive (35% chance on active skill cast)
      const isPoison = Math.random() < 0.35;
      if (isPoison) {
        setEnemyPoisonTurns(prev => ({ ...prev, [targetIdx]: 2 }));
      }

      const remainingMana = Math.max(0, activeAttackingStarmon.currentMana - 25);
      const canCastAgain = remainingMana >= 25;

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex
            ? { ...s, currentMana: remainingMana }
            : s
        )
      );

      sound.playAttackHit();
      const statusNote = `${isCrit ? '💥 CRIT! ' : ''}-${dmg} HP${isPoison ? ' & 🍄 Poison (2t)' : ''}`;

      setFloatingDamage({
        text: canCastAgain
          ? `🌿 THORN WHIP! ${statusNote} (Cast again! ${remainingMana} Ma left)`
          : `🌿 THORN WHIP! ${statusNote}`,
        isEnemy: true,
      });
      setTimeout(() => setFloatingDamage(null), 1400);

      recordDamageDealt('Earth', dmg);
      recordPlayerMonDamageDealt(actingStepIndex, dmg);
      recordEnemyMonDamageTaken(targetIdx, dmg);
      onQuestProgress?.('deal_damage', { element: 'Earth', damage: dmg });
      onQuestProgress?.('cast_skill');

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Vinedra',
        actionType: 'skill',
        message: `🌿 Vinedra cast "Thorn Whip" (-25 Mana)!`,
        detail: `Dealt ${dmg} Earth DMG to ${targetEnemy.name} and gained +20% Crit Chance${isPoison ? ', inflicted Poison for 2 turns' : ''}.${canCastAgain ? ` Remaining Mana: ${remainingMana} — Can cast Thorn Whip again this turn!` : ''}`,
      });

      if (isPvP) {
        syncCurrentSkill(dmg, false, targetIdx);
        return;
      }

      let anyLiving = false;
      setEnemyTeam(prev => {
        const next = prev.map((e, idx) => {
          if (idx === targetIdx) {
            const nextHp = Math.max(0, e.currentHp - dmg);
            if (e.currentHp > 0 && nextHp <= 0) {
              addBattleLog({
                phase: 'combat',
                source: 'system',
                actionType: 'defeat',
                message: `💀 Enemy ${e.name} was defeated!`,
              });
            }
            return { ...e, currentHp: nextHp };
          }
          return e;
        });
        anyLiving = next.some(e => e.currentHp > 0);
        return next;
      });

      setTimeout(() => {
        if (!anyLiving) {
          checkImmediateWinOrNext(actingStepIndex + 1);
          return;
        }

        // Auto-switch to next living enemy if current enemy was defeated
        setEnemyTeam(currentEnemies => {
          if (currentEnemies[targetIdx]?.currentHp <= 0) {
            const nextTarget = currentEnemies.findIndex(e => e.currentHp > 0);
            if (nextTarget !== -1) {
              setSelectedEnemyIndex(nextTarget);
            }
          }
          return currentEnemies;
        });

        // IF Vinedra has >= 25 mana remaining: DO NOT ADVANCE! Vinedra stays active to cast again!
        syncCurrentSkill(dmg, false, targetIdx);
        if (canCastAgain) {
          return;
        } else {
          checkImmediateWinOrNext(actingStepIndex + 1);
        }
      }, 600);
      return;
    }

    // ==============================================================
    // VINEDRA ABILITY 2: POISONOUS BURST (45 MANA - AOE)
    // 85% Earth DMG to all foes, 35% chance to inflict Poison for 2 turns
    // ==============================================================
    if ((activeAttackingStarmon.id === 'vinedra' || activeAttackingStarmon.avatarSeed === 'vinedra') && abilityNum === 2) {
      if (activeAttackingStarmon.currentMana < 45) {
        sound.playWrong();
        return;
      }

      const dmg = Math.round(activeAttackingStarmon.baseAtk * 0.85);

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex
            ? { ...s, currentMana: Math.max(0, s.currentMana - 45) }
            : s
        )
      );

      sound.playAttackHit();
      setFloatingDamage({
        text: `🌺 POISONOUS BURST! -${dmg} AoE HP & Toxic Cloud!`,
        isEnemy: true,
      });
      setTimeout(() => setFloatingDamage(null), 1400);

      const livingEnemies = enemyTeam.filter(e => e.currentHp > 0);
      recordDamageDealt('Earth', dmg * Math.max(1, livingEnemies.length));
      recordPlayerMonDamageDealt(actingStepIndex, dmg * Math.max(1, livingEnemies.length));
      onQuestProgress?.('deal_damage', { element: 'Earth', damage: dmg * Math.max(1, livingEnemies.length) });
      onQuestProgress?.('cast_skill');

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Vinedra',
        actionType: 'skill',
        message: `🌺 Vinedra cast "Poisonous Burst" (-45 Mana)!`,
        detail: `Dealt ${dmg} Earth DMG to ALL foes and released Toxic Spores!`,
      });

      enemyTeam.forEach((e, idx) => {
        if (e.currentHp > 0) {
          recordEnemyMonDamageTaken(idx, dmg);
          if (Math.random() < 0.35) {
            setEnemyPoisonTurns(prev => ({ ...prev, [idx]: 2 }));
            addBattleLog({
              phase: 'combat',
              source: 'player',
              unitName: 'Vinedra',
              actionType: 'status',
              message: `🍄 Toxic Spore poisoned enemy ${e.name} for 2 turns!`,
            });
          }
        }
      });

      if (isPvP) {
        syncCurrentSkill(dmg, true, selectedEnemyIndex);
        return;
      }

      setEnemyTeam(prev =>
        prev.map(e => {
          const nextHp = Math.max(0, e.currentHp - dmg);
          if (e.currentHp > 0 && nextHp <= 0) {
            addBattleLog({
              phase: 'combat',
              source: 'system',
              actionType: 'defeat',
              message: `💀 Enemy ${e.name} was defeated!`,
            });
          }
          return { ...e, currentHp: nextHp };
        })
      );

      syncCurrentSkill(dmg, true, 0);

      setTimeout(() => {
        checkImmediateWinOrNext(actingStepIndex + 1);
      }, 700);
      return;
    }

    // ==============================================================
    // CYBORGNID ABILITY 1: PLASMA SLASH (45 MANA)
    // Slashes the target with steel claws, dealing 130% Steel DMG
    // ==============================================================
    if ((activeAttackingStarmon.id === 'cyborgnid' || activeAttackingStarmon.avatarSeed === 'cyborgnid') && abilityNum === 1) {
      if (activeAttackingStarmon.currentMana < 45) {
        sound.playWrong();
        return;
      }
      let targetIdx = selectedEnemyIndex;
      if (enemyStoneGolemTauntTurns > 0) {
        const golemIdx = enemyTeam.findIndex(e => (e.id === 'enemy_golem' || e.avatarSeed === 'stone_golem') && e.currentHp > 0);
        if (golemIdx !== -1) targetIdx = golemIdx;
      }
      if (!enemyTeam[targetIdx] || enemyTeam[targetIdx].currentHp <= 0) {
        targetIdx = enemyTeam.findIndex(e => e.currentHp > 0);
      }
      if (targetIdx === -1) {
        checkImmediateWinOrNext(actingStepIndex + 1);
        return;
      }
      setSelectedEnemyIndex(targetIdx);
      const targetEnemy = enemyTeam[targetIdx];

      const dmg = Math.round(activeAttackingStarmon.baseAtk * 1.30);
      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex ? { ...s, currentMana: Math.max(0, s.currentMana - 45) } : s
        )
      );

      sound.playAttackHit();
      setFloatingDamage({ text: `⚔️ PLASMA SLASH! -${dmg} Steel HP`, isEnemy: true });
      setTimeout(() => setFloatingDamage(null), 1200);

      recordDamageDealt('Metal', dmg);
      recordPlayerMonDamageDealt(actingStepIndex, dmg);
      recordEnemyMonDamageTaken(targetIdx, dmg);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Cyborgnid',
        actionType: 'skill',
        message: `⚙️ Cyborgnid cast "Plasma Slash" (-45 Mana)!`,
        detail: `Slashed ${targetEnemy.name} with razor claws dealing ${dmg} Steel DMG (130%).`,
      });

      if (isPvP) {
        syncCurrentSkill(dmg, false, targetIdx);
        return;
      }

      setEnemyTeam(prev =>
        prev.map((e, idx) => {
          if (idx === targetIdx) {
            const nextHp = Math.max(0, e.currentHp - dmg);
            if (e.currentHp > 0 && nextHp <= 0) {
              addBattleLog({
                phase: 'combat',
                source: 'system',
                actionType: 'defeat',
                message: `💀 Enemy ${e.name} was defeated!`,
              });
            }
            return { ...e, currentHp: nextHp };
          }
          return e;
        })
      );

      syncCurrentSkill(dmg, false, targetIdx);
      setTimeout(() => checkImmediateWinOrNext(actingStepIndex + 1), 600);
      return;
    }

    // ==============================================================
    // CYBORGNID ABILITY 2: CHARGE BEAM (65 MANA)
    // Gains a Shield equal to 20% max HP for 3 turns, unleashes laser
    // dealing Steel DMG equal to 130% ATK + 30% of absorbed damage taken!
    // ==============================================================
    if ((activeAttackingStarmon.id === 'cyborgnid' || activeAttackingStarmon.avatarSeed === 'cyborgnid') && abilityNum === 2) {
      if (activeAttackingStarmon.currentMana < 65) {
        sound.playWrong();
        return;
      }
      let targetIdx = selectedEnemyIndex;
      if (enemyStoneGolemTauntTurns > 0) {
        const golemIdx = enemyTeam.findIndex(e => (e.id === 'enemy_golem' || e.avatarSeed === 'stone_golem') && e.currentHp > 0);
        if (golemIdx !== -1) targetIdx = golemIdx;
      }
      if (!enemyTeam[targetIdx] || enemyTeam[targetIdx].currentHp <= 0) {
        targetIdx = enemyTeam.findIndex(e => e.currentHp > 0);
      }
      if (targetIdx === -1) {
        checkImmediateWinOrNext(actingStepIndex + 1);
        return;
      }
      setSelectedEnemyIndex(targetIdx);
      const targetEnemy = enemyTeam[targetIdx];

      const shieldGain = Math.round(activeAttackingStarmon.maxHp * 0.20);
      setTeamShieldPoints(prev => prev + shieldGain);
      setTeamShieldTurns(3);

      const bonusFromTaken = Math.round(playerCyborgnidDmgAbsorbed * 0.30);
      const dmg = Math.round(activeAttackingStarmon.baseAtk * 1.30) + bonusFromTaken;
      setPlayerCyborgnidDmgAbsorbed(0);

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex ? { ...s, currentMana: Math.max(0, s.currentMana - 65) } : s
        )
      );

      sound.playAttackHit();
      setFloatingDamage({
        text: `⚡ CHARGE BEAM! -${dmg} HP [+${shieldGain} Shield (3t)]`,
        isEnemy: true,
      });
      setTimeout(() => setFloatingDamage(null), 1400);

      recordDamageDealt('Metal', dmg);
      recordPlayerMonDamageDealt(actingStepIndex, dmg);
      recordEnemyMonDamageTaken(targetIdx, dmg);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Cyborgnid',
        actionType: 'skill',
        message: `⚡ Cyborgnid cast "Charge Beam" (-65 Mana)!`,
        detail: `Gained +${shieldGain} Shield (20% max HP, 3t) and blasted ${targetEnemy.name} for ${dmg} Steel DMG (including +${bonusFromTaken} absorbed energy DMG).`,
      });

      if (isPvP) {
        syncCurrentSkill(dmg, false, targetIdx);
        return;
      }

      setEnemyTeam(prev =>
        prev.map((e, idx) => {
          if (idx === targetIdx) {
            const nextHp = Math.max(0, e.currentHp - dmg);
            if (e.currentHp > 0 && nextHp <= 0) {
              addBattleLog({
                phase: 'combat',
                source: 'system',
                actionType: 'defeat',
                message: `💀 Enemy ${e.name} was defeated!`,
              });
            }
            return { ...e, currentHp: nextHp };
          }
          return e;
        })
      );

      syncCurrentSkill(dmg, false, targetIdx);
      setTimeout(() => checkImmediateWinOrNext(actingStepIndex + 1), 600);
      return;
    }

    // ==============================================================
    // MINEACLE ABILITY 1: CHAIN SLAM (45 MANA)
    // Swings heavy spiked chain dealing 170% Water DMG
    // ==============================================================
    if ((activeAttackingStarmon.id === 'mineacle' || activeAttackingStarmon.avatarSeed === 'mineacle') && abilityNum === 1) {
      if (activeAttackingStarmon.currentMana < 45) {
        sound.playWrong();
        return;
      }
      let targetIdx = selectedEnemyIndex;
      if (enemyStoneGolemTauntTurns > 0) {
        const golemIdx = enemyTeam.findIndex(e => (e.id === 'enemy_golem' || e.avatarSeed === 'stone_golem') && e.currentHp > 0);
        if (golemIdx !== -1) targetIdx = golemIdx;
      }
      if (!enemyTeam[targetIdx] || enemyTeam[targetIdx].currentHp <= 0) {
        targetIdx = enemyTeam.findIndex(e => e.currentHp > 0);
      }
      if (targetIdx === -1) {
        checkImmediateWinOrNext(actingStepIndex + 1);
        return;
      }
      setSelectedEnemyIndex(targetIdx);
      const targetEnemy = enemyTeam[targetIdx];

      const dmg = Math.round(activeAttackingStarmon.baseAtk * 1.70);
      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex ? { ...s, currentMana: Math.max(0, s.currentMana - 45) } : s
        )
      );

      sound.playAttackHit();
      setFloatingDamage({ text: `⚓ CHAIN SLAM! -${dmg} Water HP`, isEnemy: true });
      setTimeout(() => setFloatingDamage(null), 1200);

      recordDamageDealt('Water', dmg);
      recordPlayerMonDamageDealt(actingStepIndex, dmg);
      recordEnemyMonDamageTaken(targetIdx, dmg);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Mineacle',
        actionType: 'skill',
        message: `⚓ Mineacle cast "Chain Slam" (-45 Mana)!`,
        detail: `Smashed ${targetEnemy.name} with spiked ocean chain for ${dmg} Water DMG (170%).`,
      });

      if (isPvP) {
        syncCurrentSkill(dmg, false, targetIdx);
        return;
      }

      setEnemyTeam(prev =>
        prev.map((e, idx) => {
          if (idx === targetIdx) {
            const nextHp = Math.max(0, e.currentHp - dmg);
            if (e.currentHp > 0 && nextHp <= 0) {
              addBattleLog({
                phase: 'combat',
                source: 'system',
                actionType: 'defeat',
                message: `💀 Enemy ${e.name} was defeated!`,
              });
            }
            return { ...e, currentHp: nextHp };
          }
          return e;
        })
      );

      syncCurrentSkill(dmg, false, targetIdx);
      setTimeout(() => checkImmediateWinOrNext(actingStepIndex + 1), 600);
      return;
    }

    // ==============================================================
    // MINEACLE ABILITY 2: IRON BARRICADE (75 MANA)
    // Gain Taunt effect and 50% max HP Shield for 3 turns!
    // ==============================================================
    if ((activeAttackingStarmon.id === 'mineacle' || activeAttackingStarmon.avatarSeed === 'mineacle') && abilityNum === 2) {
      if (activeAttackingStarmon.currentMana < 75) {
        sound.playWrong();
        return;
      }
      const barricadeShield = Math.round(activeAttackingStarmon.maxHp * 0.50);
      setTeamShieldPoints(prev => prev + barricadeShield);
      setTeamShieldTurns(3);
      setPlayerMineacleTauntTurns(3);

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex ? { ...s, currentMana: Math.max(0, s.currentMana - 75) } : s
        )
      );

      sound.playSkillCast();
      setFloatingDamage({
        text: `🛡️ IRON BARRICADE: Taunted enemies (3t) & +${barricadeShield} Shield (50% max HP, 3t)!`,
        isEnemy: false,
      });
      setTimeout(() => setFloatingDamage(null), 1600);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Mineacle',
        actionType: 'skill',
        message: `🛡️ Mineacle cast "Iron Barricade" (-75 Mana)!`,
        detail: `Taunted incoming attacks for 3 turns and deployed +${barricadeShield} Shield (50% max HP) for 3 turns.`,
      });

      syncCurrentSkill(0, true, 0);
      if (isPvP) return;

      setTimeout(() => advanceToNextUnit(actingStepIndex + 1), 700);
      return;
    }

    // ==============================================================
    // ZEPHYRION ABILITY 1: JUSTICE JUDGMENT (30 MANA)
    // Deals 125% Wind DMG to target. If target HP > user HP: double DMG (250%)!
    // ==============================================================
    if ((activeAttackingStarmon.id === 'zephyrion' || activeAttackingStarmon.avatarSeed === 'zephyrion') && abilityNum === 1) {
      if (activeAttackingStarmon.currentMana < 30) {
        sound.playWrong();
        return;
      }
      let targetIdx = selectedEnemyIndex;
      if (enemyStoneGolemTauntTurns > 0) {
        const golemIdx = enemyTeam.findIndex(e => (e.id === 'enemy_golem' || e.avatarSeed === 'stone_golem') && e.currentHp > 0);
        if (golemIdx !== -1) targetIdx = golemIdx;
      }
      if (!enemyTeam[targetIdx] || enemyTeam[targetIdx].currentHp <= 0) {
        targetIdx = enemyTeam.findIndex(e => e.currentHp > 0);
      }
      if (targetIdx === -1) {
        checkImmediateWinOrNext(actingStepIndex + 1);
        return;
      }
      setSelectedEnemyIndex(targetIdx);
      const targetEnemy = enemyTeam[targetIdx];

      const isTargetHigherHp = targetEnemy.currentHp > activeAttackingStarmon.currentHp;
      const mult = isTargetHigherHp ? 2.50 : 1.25;
      // Order Crown passive provides +10% DMG to all Wind attacks/abilities
      const dmg = Math.round(activeAttackingStarmon.baseAtk * mult * 1.10);

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex ? { ...s, currentMana: Math.max(0, s.currentMana - 30) } : s
        )
      );

      sound.playAttackHit();
      setFloatingDamage({
        text: isTargetHigherHp ? `⚖️ JUSTICE JUDGMENT (DOUBLE DMG)! -${dmg} Wind HP` : `⚖️ JUSTICE JUDGMENT! -${dmg} Wind HP`,
        isEnemy: true,
      });
      setTimeout(() => setFloatingDamage(null), 1400);

      recordDamageDealt('Wind', dmg);
      recordPlayerMonDamageDealt(actingStepIndex, dmg);
      recordEnemyMonDamageTaken(targetIdx, dmg);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Zephyrion',
        actionType: 'skill',
        message: `⚖️ Zephyrion cast "Justice Judgment" (-30 Mana)!`,
        detail: `Dealt ${dmg} Wind DMG to ${targetEnemy.name}${isTargetHigherHp ? ' (DOUBLED because target HP > user HP!)' : '.'} (+10% Order Crown boost)`,
      });

      if (isPvP) {
        syncCurrentSkill(dmg, false, targetIdx);
        return;
      }

      setEnemyTeam(prev =>
        prev.map((e, idx) => {
          if (idx === targetIdx) {
            const nextHp = Math.max(0, e.currentHp - dmg);
            if (e.currentHp > 0 && nextHp <= 0) {
              addBattleLog({
                phase: 'combat',
                source: 'system',
                actionType: 'defeat',
                message: `💀 Enemy ${e.name} was defeated!`,
              });
            }
            return { ...e, currentHp: nextHp };
          }
          return e;
        })
      );

      syncCurrentSkill(dmg, false, targetIdx);
      setTimeout(() => checkImmediateWinOrNext(actingStepIndex + 1), 600);
      return;
    }

    // ==============================================================
    // ZEPHYRION ABILITY 2: RIGHTEOUS GALE (60 MANA)
    // If any target has at least 1 debuff currently active before cast,
    // that target takes double DMG. Deals 120% AoE Wind DMG and removes
    // all buff and debuff statuses from ALL enemies!
    // ==============================================================
    if ((activeAttackingStarmon.id === 'zephyrion' || activeAttackingStarmon.avatarSeed === 'zephyrion') && abilityNum === 2) {
      if (activeAttackingStarmon.currentMana < 60) {
        sound.playWrong();
        return;
      }

      // Check debuffs on each enemy prior to cast:
      // Frostbite, Poison, Stun
      const enemyHasDebuff = enemyTeam.map((e, idx) => {
        const hasFrostbite = (enemyFrostbiteTurns[idx] || 0) > 0;
        const hasPoison = (enemyPoisonTurns[idx] || 0) > 0;
        const hasStun = stunnedEnemyIndices.includes(idx);
        return hasFrostbite || hasPoison || hasStun;
      });

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex ? { ...s, currentMana: Math.max(0, s.currentMana - 60) } : s
        )
      );

      sound.playAttackHit();
      setFloatingDamage({
        text: `🌪️ RIGHTEOUS GALE! 120% AoE DMG & Cleansed All Foes!`,
        isEnemy: true,
      });
      setTimeout(() => setFloatingDamage(null), 1500);

      let totalGaleDmg = 0;
      setEnemyTeam(prev =>
        prev.map((e, idx) => {
          if (e.currentHp <= 0) return e;
          const isDebuffed = enemyHasDebuff[idx];
          const mult = isDebuffed ? 2.40 : 1.20; // Double DMG if target has at least 1 debuff!
          // +10% Order Crown boost
          const dmg = Math.round(activeAttackingStarmon.baseAtk * mult * 1.10);
          totalGaleDmg += dmg;
          recordEnemyMonDamageTaken(idx, dmg);
          const nextHp = Math.max(0, e.currentHp - dmg);
          if (e.currentHp > 0 && nextHp <= 0) {
            addBattleLog({
              phase: 'combat',
              source: 'system',
              actionType: 'defeat',
              message: `💀 Enemy ${e.name} was defeated!`,
            });
          }
          return { ...e, currentHp: nextHp };
        })
      );

      // Remove ALL buff and debuff statuses from all enemies!
      setEnemyFrostbiteTurns({});
      setEnemyPoisonTurns({});
      setStunnedEnemyIndices([]);
      setEnemyStoneGolemTauntTurns(0);

      recordDamageDealt('Wind', totalGaleDmg);
      recordPlayerMonDamageDealt(actingStepIndex, totalGaleDmg);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Zephyrion',
        actionType: 'skill',
        message: `🌪️ Zephyrion cast "Righteous Gale" (-60 Mana)!`,
        detail: `Dealt 120% AoE Wind DMG (Doubled on debuffed foes) and completely cleansed all buffs & debuffs from all enemies!`,
      });

      syncCurrentSkill(totalGaleDmg, true, 0);

      setTimeout(() => checkImmediateWinOrNext(actingStepIndex + 1), 700);
      return;
    }

    // ==============================================================
    // MOSSLOTH ABILITY 1: BRANCH SLAM (40 MANA)
    // Deals Earth DMG based on the user's max HP (15%).
    // ==============================================================
    if ((activeAttackingStarmon.id === 'mossloth' || activeAttackingStarmon.avatarSeed === 'mossloth') && abilityNum === 1) {
      if (activeAttackingStarmon.currentMana < 40) {
        sound.playWrong();
        return;
      }
      let targetIdx = selectedEnemyIndex;
      if (enemyStoneGolemTauntTurns > 0) {
        const golemIdx = enemyTeam.findIndex(e => (e.id === 'enemy_golem' || e.avatarSeed === 'stone_golem') && e.currentHp > 0);
        if (golemIdx !== -1) targetIdx = golemIdx;
      }
      if (!enemyTeam[targetIdx] || enemyTeam[targetIdx].currentHp <= 0) {
        targetIdx = enemyTeam.findIndex(e => e.currentHp > 0);
      }
      if (targetIdx === -1) {
        checkImmediateWinOrNext(actingStepIndex + 1);
        return;
      }
      setSelectedEnemyIndex(targetIdx);
      const targetEnemy = enemyTeam[targetIdx];

      // 15% of user max HP as Earth DMG
      const dmg = Math.round(activeAttackingStarmon.maxHp * 0.15);

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex ? { ...s, currentMana: Math.max(0, s.currentMana - 40) } : s
        )
      );

      sound.playAttackHit();
      setFloatingDamage({
        text: `🌿 BRANCH SLAM! -${dmg} Earth HP`,
        isEnemy: true,
      });
      setTimeout(() => setFloatingDamage(null), 1400);

      recordDamageDealt('Earth', dmg);
      recordPlayerMonDamageDealt(actingStepIndex, dmg);
      recordEnemyMonDamageTaken(targetIdx, dmg);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Mossloth',
        actionType: 'skill',
        message: `🌿 Mossloth cast "Branch Slam" (-40 Mana)!`,
        detail: `Dealt ${dmg} Earth DMG (15% of Mossloth's Max HP ${activeAttackingStarmon.maxHp}) to ${targetEnemy.name}.`,
      });

      if (isPvP) {
        syncCurrentSkill(dmg, false, targetIdx);
        return;
      }

      setEnemyTeam(prev =>
        prev.map((e, idx) => {
          if (idx === targetIdx) {
            const nextHp = Math.max(0, e.currentHp - dmg);
            if (e.currentHp > 0 && nextHp <= 0) {
              addBattleLog({
                phase: 'combat',
                source: 'system',
                actionType: 'defeat',
                message: `💀 Enemy ${e.name} was defeated!`,
              });
            }
            return { ...e, currentHp: nextHp };
          }
          return e;
        })
      );

      syncCurrentSkill(dmg, false, targetIdx);
      setTimeout(() => checkImmediateWinOrNext(actingStepIndex + 1), 600);
      return;
    }

    // ==============================================================
    // MOSSLOTH ABILITY 2: SLUGGISH METABOLISM (75 MANA)
    // Gain Taunt for 3 turns and heal 15% of its max HP at the end of every turn.
    // ==============================================================
    if ((activeAttackingStarmon.id === 'mossloth' || activeAttackingStarmon.avatarSeed === 'mossloth') && abilityNum === 2) {
      if (activeAttackingStarmon.currentMana < 75) {
        sound.playWrong();
        return;
      }

      setPlayerMosslothTauntTurns(3);
      setPlayerMosslothRegenTurns(3);

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex ? { ...s, currentMana: Math.max(0, s.currentMana - 75) } : s
        )
      );

      sound.playShield();
      setFloatingDamage({
        text: `🐢 SLUGGISH METABOLISM! Taunt (3t) & +15% HP Regen/turn (3t)`,
        isEnemy: false,
      });
      setTimeout(() => setFloatingDamage(null), 1400);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Mossloth',
        actionType: 'skill',
        message: `🐢 Mossloth cast "Sluggish Metabolism" (-75 Mana)!`,
        detail: `Slowed metabolism: Gained Taunt for 3 turns and will heal 15% Max HP (${Math.round(activeAttackingStarmon.maxHp * 0.15)} HP) at the end of every turn for 3 turns!`,
      });

      syncCurrentSkill(0, true, 0);
      if (isPvP) return;

      setTimeout(() => advanceToNextUnit(actingStepIndex + 1), 700);
      return;
    }

    // ==============================================================
    // KHEPRI ABILITY 1: MUMMY'S CURSE (30 MANA)
    // Deals Earth DMG equal to 10% of target's current HP and applies
    // Healing Block for 2 turns (prevent HP regeneration from all sources).
    // Passive: Desert Shroud (+30% Evasion for 1 turn).
    // ==============================================================
    if ((activeAttackingStarmon.id === 'khepri' || activeAttackingStarmon.avatarSeed === 'khepri') && abilityNum === 1) {
      if (activeAttackingStarmon.currentMana < 30) {
        sound.playWrong();
        return;
      }
      let targetIdx = selectedEnemyIndex;
      if (enemyStoneGolemTauntTurns > 0) {
        const golemIdx = enemyTeam.findIndex(e => (e.id === 'enemy_golem' || e.avatarSeed === 'stone_golem') && e.currentHp > 0);
        if (golemIdx !== -1) targetIdx = golemIdx;
      }
      if (!enemyTeam[targetIdx] || enemyTeam[targetIdx].currentHp <= 0) {
        targetIdx = enemyTeam.findIndex(e => e.currentHp > 0);
      }
      if (targetIdx === -1) {
        checkImmediateWinOrNext(actingStepIndex + 1);
        return;
      }
      setSelectedEnemyIndex(targetIdx);
      const targetEnemy = enemyTeam[targetIdx];

      // 10% of target's current HP as Earth DMG
      const dmg = Math.max(1, Math.round(targetEnemy.currentHp * 0.10));

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex ? { ...s, currentMana: Math.max(0, s.currentMana - 30) } : s
        )
      );

      // Apply Healing Block for 2 turns
      setEnemyHealingBlockTurns(prev => ({ ...prev, [targetIdx]: 2 }));

      // Desert Shroud passive: +30% Evasion for 1 turn (does not stack)
      setPlayerKhepriShroudTurns(1);

      sound.playAttackHit();
      setFloatingDamage({
        text: `⚰️ MUMMY'S CURSE! -${dmg} Earth HP & 🚫 Heal Block (2t)`,
        isEnemy: true,
      });
      setTimeout(() => setFloatingDamage(null), 1400);

      recordDamageDealt('Earth', dmg);
      recordPlayerMonDamageDealt(actingStepIndex, dmg);
      recordEnemyMonDamageTaken(targetIdx, dmg);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Khepri',
        actionType: 'skill',
        message: `⚰️ Khepri cast "Mummy's Curse" (-30 Mana)!`,
        detail: `Dealt ${dmg} Earth DMG (10% of ${targetEnemy.name}'s current HP) and cursed target with Healing Block for 2 turns! Desert Shroud passive activated (+30% Evasion for 1 turn).`,
      });

      if (isPvP) {
        syncCurrentSkill(dmg, false, targetIdx);
        return;
      }

      setEnemyTeam(prev =>
        prev.map((e, idx) => {
          if (idx === targetIdx) {
            const nextHp = Math.max(0, e.currentHp - dmg);
            if (e.currentHp > 0 && nextHp <= 0) {
              addBattleLog({
                phase: 'combat',
                source: 'system',
                actionType: 'defeat',
                message: `💀 Enemy ${e.name} was defeated!`,
              });
            }
            return { ...e, currentHp: nextHp };
          }
          return e;
        })
      );

      syncCurrentSkill(dmg, false, targetIdx);
      setTimeout(() => checkImmediateWinOrNext(actingStepIndex + 1), 600);
      return;
    }

    // ==============================================================
    // KHEPRI ABILITY 2: RITUAL OF THE SUN (65 MANA)
    // Summon the Sun Effect on the entire board. When Sun is active,
    // all Water DMG is reduced by 20% and all Fire DMG increases by 20%.
    // When the sun effect is active, Khepri's ATK increases by 20% and
    // Desert Shroud passive is also activated.
    // ==============================================================
    if ((activeAttackingStarmon.id === 'khepri' || activeAttackingStarmon.avatarSeed === 'khepri') && abilityNum === 2) {
      if (activeAttackingStarmon.currentMana < 65) {
        sound.playWrong();
        return;
      }

      setPlayerTeam(prev =>
        prev.map((s, idx) =>
          idx === actingStepIndex ? { ...s, currentMana: Math.max(0, s.currentMana - 65) } : s
        )
      );

      // Summon Sun Effect on entire board for 3 turns
      setSunEffectTurns(3);

      // Desert Shroud passive: +30% Evasion for 1 turn
      setPlayerKhepriShroudTurns(1);

      sound.playSkillCharge();
      setFloatingDamage({
        text: `☀️ RITUAL OF THE SUN! Fire +20% | Water -20% | Khepri ATK +20% (3t)`,
        isEnemy: false,
      });
      setTimeout(() => setFloatingDamage(null), 1500);

      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: 'Khepri',
        actionType: 'skill',
        message: `☀️ Khepri cast "Ritual of the Sun" (-65 Mana)!`,
        detail: `Summoned Sun Effect on entire battlefield for 3 turns (Fire DMG +20%, Water DMG -20%, Khepri ATK +20%) and activated Desert Shroud (+30% Evasion for 1 turn)!`,
      });

      syncCurrentSkill(0, true, 0);
      if (isPvP) return;

      setTimeout(() => advanceToNextUnit(actingStepIndex + 1), 700);
      return;
    }

    // Standard Direct Damage Skill
    const isGlidronSkill2 = (activeAttackingStarmon.id === 'glidron' || activeAttackingStarmon.avatarSeed === 'glidron') && abilityNum === 2;
    const glidronHpSacrifice = isGlidronSkill2 ? Math.max(1, Math.round(activeAttackingStarmon.currentHp * 0.3)) : 0;

    // Voltlynx Passive: +25% extra critical chance, and critical attacks & abilities deal extra 25% DMG
    const isVoltlynxAbility = activeAttackingStarmon.id === 'voltlynx' || activeAttackingStarmon.avatarSeed === 'voltlynx';
    let abilityCritChance = 0.10 + (activeAttackingStarmon.researchCritChance || 0);
    if (isVoltlynxAbility) {
      abilityCritChance += 0.25; // +25% extra critical chance
      if (abilityNum === 1) {
        abilityCritChance += 0.25; // Lightning Paw +25% inherent bonus
      }
    }
    const isAbilityCrit = Math.random() < abilityCritChance;
    let abilityCritMult = 1.0;
    if (isAbilityCrit) {
      // Base crit 1.5x. For Voltlynx: critical attacks & abilities deal extra 25% DMG -> 1.5 * 1.25 = 1.875x!
      abilityCritMult = isVoltlynxAbility ? 1.875 : 1.5;
    }

    const voltlynxAbilityBuff = isVoltlynxAbility ? 1.25 : 1.0;
    let dmg = Math.round(activeAttackingStarmon.baseAtk * skill.damageMultiplier * voltlynxAbilityBuff * abilityCritMult);
    if ((playerFrostbiteTurns[actingStepIndex] || 0) > 0) {
      dmg = Math.round(dmg * 0.9); // Frostbite reduces Attack by 10%
    }

    setPlayerTeam(prev =>
      prev.map((s, idx) =>
        idx === actingStepIndex
          ? {
              ...s,
              currentMana: Math.max(0, s.currentMana - skill.manaCost),
              currentHp: isGlidronSkill2 ? Math.max(1, s.currentHp - glidronHpSacrifice) : s.currentHp,
            }
          : s
      )
    );

    if (isGlidronSkill2) {
      addBattleLog({
        phase: 'combat',
        source: 'player',
        unitName: activeAttackingStarmon.name,
        actionType: 'status',
        message: `⚡ Glidron sacrificed ${glidronHpSacrifice} HP (-30% current HP) to unleash Giga-Watt Explosion!`,
      });
    }

    sound.playAttackHit();
    const abilityFloatText = isAbilityCrit
      ? isVoltlynxAbility
        ? `⚡ CRIT! -${dmg} HP [+25% Voltlynx DMG]`
        : `💥 CRIT! -${dmg} HP`
      : `💥 -${dmg} HP`;
    setFloatingDamage({ text: abilityFloatText, isEnemy: true });
    setTimeout(() => setFloatingDamage(null), 1200);

    let effectiveTarget = selectedEnemyIndex;
    if (enemyStoneGolemTauntTurns > 0) {
      const golemIdx = enemyTeam.findIndex(e => (e.id === 'enemy_golem' || e.avatarSeed === 'stone_golem') && e.currentHp > 0);
      if (golemIdx !== -1) effectiveTarget = golemIdx;
    }
    // Dead enemies CANNOT be targeted!
    if (!enemyTeam[effectiveTarget] || enemyTeam[effectiveTarget].currentHp <= 0) {
      effectiveTarget = enemyTeam.findIndex(e => e.currentHp > 0);
    }
    if (effectiveTarget === -1) {
      checkImmediateWinOrNext(actingStepIndex + 1);
      return;
    }
    setSelectedEnemyIndex(effectiveTarget);

    addBattleLog({
      phase: 'combat',
      source: 'player',
      unitName: activeAttackingStarmon.name,
      actionType: 'skill',
      message: `⚡ ${activeAttackingStarmon.name} cast "${skill.name}" (-${skill.manaCost} Mana)!`,
      detail: `Dealt ${dmg} DMG${skill.targetType === 'aoe' ? ' to ALL enemies!' : ` to ${enemyTeam[effectiveTarget].name}!`}`,
    });

    // Check Frostmoth Absolute Zero passive:
    // Allies' Water and Wind skills have 10% chance to give Frostbite (Reduce their Attack by 10%) to enemies for 1 turn
    const isWaterOrWindSkill = activeAttackingStarmon.element === 'Water' || activeAttackingStarmon.element === 'Wind' ||
      activeAttackingStarmon.secondaryElement === 'Water' || activeAttackingStarmon.secondaryElement === 'Wind';
    const hasAliveFrostmothMon = playerTeam.some(p => (p.id === 'frostmoth' || p.avatarSeed === 'frostmoth') && p.currentHp > 0);
    const triggerAbsoluteZero = isWaterOrWindSkill && hasAliveFrostmothMon && Math.random() < 0.10;

    if (isPvP) {
      syncCurrentSkill(dmg, skill.targetType === 'aoe', effectiveTarget);
      return;
    }

    if (skill.targetType === 'aoe') {
      const livingCount = enemyTeam.filter(e => e.currentHp > 0).length;
      recordDamageDealt(activeAttackingStarmon.element, dmg * Math.max(1, livingCount));
      recordPlayerMonDamageDealt(actingStepIndex, dmg * Math.max(1, livingCount));
      enemyTeam.forEach((e, idx) => {
        if (e.currentHp > 0) {
          recordEnemyMonDamageTaken(idx, dmg);
          if (triggerAbsoluteZero) {
            setEnemyFrostbiteTurns(prev => ({ ...prev, [idx]: Math.max(prev[idx] || 0, 1) }));
          }
        }
      });
      if (triggerAbsoluteZero) {
        addBattleLog({
          phase: 'combat',
          source: 'player',
          unitName: 'Frostmoth',
          actionType: 'status',
          message: '❄️ Absolute Zero triggered! (10% chance) Inflicted Frostbite (-10% ATK) on all enemies for 1 turn!',
        });
      }
      setEnemyTeam(prev =>
        prev.map(e => {
          const nextHp = Math.max(0, e.currentHp - dmg);
          if (e.currentHp > 0 && nextHp <= 0) {
            addBattleLog({
              phase: 'combat',
              source: 'system',
              actionType: 'defeat',
              message: `💀 Enemy ${e.name} was defeated!`,
            });
          }
          return { ...e, currentHp: nextHp };
        })
      );
    } else {
      recordDamageDealt(activeAttackingStarmon.element, dmg);
      recordPlayerMonDamageDealt(actingStepIndex, dmg);
      recordEnemyMonDamageTaken(effectiveTarget, dmg);
      if (triggerAbsoluteZero) {
        setEnemyFrostbiteTurns(prev => ({ ...prev, [effectiveTarget]: Math.max(prev[effectiveTarget] || 0, 1) }));
        addBattleLog({
          phase: 'combat',
          source: 'player',
          unitName: 'Frostmoth',
          actionType: 'status',
          message: `❄️ Absolute Zero triggered! (10% chance) Inflicted Frostbite (-10% ATK) on ${enemyTeam[effectiveTarget].name} for 1 turn!`,
        });
      }
      setEnemyTeam(prev =>
        prev.map((e, idx) => {
          if (idx === effectiveTarget) {
            const nextHp = Math.max(0, e.currentHp - dmg);
            if (e.currentHp > 0 && nextHp <= 0) {
              addBattleLog({
                phase: 'combat',
                source: 'system',
                actionType: 'defeat',
                message: `💀 Enemy ${e.name} was defeated!`,
              });
            }
            return { ...e, currentHp: nextHp };
          }
          return e;
        })
      );
    }

    syncCurrentSkill(dmg, skill.targetType === 'aoe', effectiveTarget);

    setTimeout(() => {
      checkImmediateWinOrNext(actingStepIndex + 1);
    }, 600);
  };

  const checkImmediateWinOrNext = (nextStep: number) => {
    if (tutorialStage === 1) {
      if (tutorialRound === 1) {
        // In Tutorial 1 Round 1, after the first match attack, the enemy took damage.
        // Hold phase in combat and wait for player to view enemy HP and click "Qua IELTS Speaking ➔"
        return;
      }
      // In Tutorial 1 final attack / Round 2: Guarantee immediate win!
      setEnemyTeam(prev => prev.map(e => ({ ...e, currentHp: 0 })));
      setPhase('victory');
      setChestOpened(true);
      setChestRewards({
        gold: 1000,
        cards: 0,
        starmon: STARMON_ROSTER[0],
        isUnobtained: false,
      });
      onTutorial1Reward?.();
      sound.playRewardFanfare();
      try {
        confetti({ particleCount: 220, spread: 100 });
      } catch {}
      return;
    }

    setEnemyTeam(currentEnemies => {
      const allEnemiesDefeated = currentEnemies.every(e => e.currentHp <= 0);
      if (allEnemiesDefeated) {
        if (!isPvP) {
          if (pveLevelTransitioningRef.current) return currentEnemies;
          pveLevelTransitioningRef.current = true;
          const nextLevel = pveLevel + 1;
          const levelGrowth = nextLevel - 1;
          const nextEnemyTeam = pveBaseEnemyTeamRef.current.map(base => {
            const hpScale = 1 + levelGrowth * 0.08;
            const attackScale = 1 + levelGrowth * 0.04;
            const defenseScale = 1 + levelGrowth * 0.03;
            const maxHp = Math.round(base.maxHp * hpScale);
            return {
              ...base,
              level: nextLevel,
              maxHp,
              currentHp: maxHp,
              baseAtk: Math.round(base.baseAtk * attackScale),
              def: Math.round(base.def * defenseScale),
              currentMana: Math.min(200, base.currentMana + levelGrowth * 4),
            };
          });
          setPveLevel(nextLevel);
          setTurnAnnouncement(`LEVEL ${pveLevel} CLEARED! Bot Starmons level up to ${nextLevel}.`);
          sound.playRewardFanfare();
          setTimeout(() => {
            setEnemyTeam(nextEnemyTeam);
            setSelectedEnemyIndex(0);
            setCurrentRoundNumber(1);
            currentRoundNumberRef.current = 1;
            logTurnRef.current = 1;
            setPhase('phase1_quiz');
            setActiveQuestionIndex(0);
            setQuestionTimer(QUESTION_TIME_LIMIT);
            setAnsweredState({});
            setUnlockedPositions(Array(partySize).fill(false));
            setIeltsAiResult(null);
            setIeltsResultsMap({});
            setEvaluatingMap({});
            setQuestionTranscripts({});
            setShowAllQuestionsReport(false);
            setSpokenTranscript('');
            setRecordingErrorNotice('');
            setEnemyFrostbiteTurns({});
            setEnemySilenceTurns({});
            setEnemyPoisonTurns({});
            setEnemyDefDebuffs({});
            setStunnedEnemyIndices([]);
            setPlayerTeam(team => team.map(mon => ({
              ...mon,
              currentHp: Math.min(mon.maxHp, mon.currentHp + Math.round(mon.maxHp * 0.2)),
              currentMana: Math.min(mon.maxMana, mon.currentMana + 20),
            })));
            setCurrentQuizSet(getRandomQuizSet(partySize, soloQuizMode));
            setTurnAnnouncement(`PvE LEVEL ${nextLevel} · Cần đạt Band ${Math.min(7.5, 5 + Math.floor(nextLevel / 10) * 0.5).toFixed(1)} để mở lượt tấn công.`);
            pveLevelTransitioningRef.current = false;
          }, 1200);
          return currentEnemies;
        }

        setPhase('victory');
        setChestOpened(false);
        setChestRewards(null);
        sound.playRewardFanfare();
        if (isPvP && pvpRoomInfo?.code) {
          sendPvpMessage({
            type: 'PVP_MATCH_END',
            room_code: pvpRoomInfo.code,
            winner_id: pvpRoomInfo.myPlayerId,
            winner_name: pvpRoomInfo.myPlayerName,
          });
        }
        try {
          confetti({ particleCount: 180, spread: 95 });
        } catch {}
        return currentEnemies;
      }

      if (isPvP) {
        // Authoritative Server manages turn progression. Action was submitted via syncPvpAction.
        // We wait for the server's PVP_TURN_CHANGE or PVP_PHASE_START_SPEAKING broadcast!
        setTurnStatusType('enemy');
        setTurnAnnouncement(`Đang chờ máy chủ điều phối lượt đi...`);
        return currentEnemies;
      }

      advanceToNextUnit(nextStep);
      return currentEnemies;
    });
  };

  // ==============================================================
  // OPPONENT / ENEMY TURN: MOVE ORBS & USE ABILITIES LIKE PLAYER!
  // ==============================================================
  interface AiMoveResult {
    r1: number;
    c1: number;
    r2: number;
    c2: number;
    score: number;
    matches: { row: number; col: number }[];
    matchElem: ElementType;
  }

  const findBestAiOrbMove = (grid: OrbTile[][], enemyElem: ElementType): AiMoveResult | null => {
    let bestMove: AiMoveResult | null = null;

    const testSwap = (r1: number, c1: number, r2: number, c2: number) => {
      const copy = grid.map(row => row.map(tile => ({ ...tile })));
      const t1 = copy[r1]?.[c1];
      const t2 = copy[r2]?.[c2];
      if (!t1 || !t2 || !t1.element || !t2.element) return;
      copy[r1][c1] = { ...t2, row: r1, col: c1 };
      copy[r2][c2] = { ...t1, row: r2, col: c2 };

      const matches = findMatches(copy);
      if (matches.length >= 3) {
        const matchElem = t1.element;
        // Favor matches of the enemy's own element or larger combos
        const score = matches.length + (matchElem === enemyElem ? 4 : 0);
        if (!bestMove || score > bestMove.score) {
          bestMove = { r1, c1, r2, c2, score, matches, matchElem };
        }
      }
    };

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (c < BOARD_SIZE - 1) testSwap(r, c, r, c + 1);
        if (r < BOARD_SIZE - 1) testSwap(r, c, r + 1, c);
      }
    }

    return bestMove;
  };

  const startEnemyTurn = () => {
    if (isPvP) return;
    enemyAttackerQueueRef.current = enemyTeam
      .map((enemy, index) => ({ enemy, index }))
      .filter(({ enemy }) => enemy.currentHp > 0)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)
      .map(({ index }) => index);
    executeEnemyTurn();
  };

  const executeEnemyTurn = () => {
    if (isPvP) return; // ZERO BOT IN PVP MODE!
    const livingEnemies = enemyTeam.filter(e => e.currentHp > 0);
    if (livingEnemies.length === 0) return;

    // Each bot turn uses up to two distinct, randomly selected living Starmons.
    const queuedAttackerIdx = enemyAttackerQueueRef.current.shift();
    const queuedAttacker = queuedAttackerIdx === undefined ? undefined : enemyTeam[queuedAttackerIdx];
    const attacker = queuedAttacker?.currentHp > 0
      ? queuedAttacker
      : livingEnemies[Math.floor(Math.random() * livingEnemies.length)];
    const attackerIdx = enemyTeam.findIndex(e => e.id === attacker.id);
    setActiveEnemyAttackerIndex(attackerIdx);

    // 1. Check if enemy attacker is Stunned
    if (stunnedEnemyIndices.includes(attackerIdx)) {
      setTurnAnnouncement(`💫 ENEMY STUNNED: ${attacker.name} is stunned and skips their turn!`);
      sound.playWrong();
      setStunnedEnemyIndices(prev => prev.filter(i => i !== attackerIdx));
      setTimeout(() => {
        finishEnemyTurn(playerTeam);
      }, 1000);
      return;
    }

    const applyDamageToPlayer = (prevPlayers: Starmon[], dmg: number, isAoE: boolean = false, isOrbMatch: boolean = false) => {
      let finalDmg = dmg;

      // Ritual of the Sun Effect on enemy damage: Fire +20%, Water -20%
      if (sunEffectTurns > 0 && attacker) {
        if (attacker.element === 'Fire') finalDmg = Math.round(finalDmg * 1.20);
        else if (attacker.element === 'Water') finalDmg = Math.round(finalDmg * 0.80);
      }

      // Coralus Passive: When Coralus HP is above 50%, reduces all incoming damage by 15% for itself and all allies!
      const coralusMon = prevPlayers.find(p => (p.id === 'coralus' || p.avatarSeed === 'coralus') && p.currentHp > 0);
      if (coralusMon && coralusMon.currentHp > (coralusMon.maxHp * 0.5) && finalDmg > 0) {
        finalDmg = Math.max(1, Math.round(finalDmg * 0.85));
      }

      // Trojan Flare Tactical Decoy Shield absorption
      if (trojanShieldPoints > 0 && finalDmg > 0) {
        if (trojanShieldPoints >= finalDmg) {
          setTrojanShieldPoints(prev => prev - finalDmg);
          finalDmg = 0;
        } else {
          finalDmg -= trojanShieldPoints;
          setTrojanShieldPoints(0);
        }
      }

      let updated = [...prevPlayers];
      if (isAoE) {
        updated = updated.map(p => ({
          ...p,
          currentHp: p.currentHp > 0 ? Math.max(0, p.currentHp - finalDmg) : 0,
        }));
      } else {
        // Single target hit: If player Mossloth, Mineacle or Stone Golem has active taunt, force target to them!
        const mosslothIdx = updated.findIndex(p => (p.id === 'mossloth' || p.avatarSeed === 'mossloth') && p.currentHp > 0);
        const mineacleIdx = updated.findIndex(p => (p.id === 'mineacle' || p.avatarSeed === 'mineacle') && p.currentHp > 0);
        const golemIdx = updated.findIndex(p => (p.id === 'stone_golem' || p.avatarSeed === 'stone_golem') && p.currentHp > 0);

        let targetPIdx = -1;
        if (playerMosslothTauntTurns > 0 && mosslothIdx !== -1) {
          targetPIdx = mosslothIdx;
        } else if (playerMineacleTauntTurns > 0 && mineacleIdx !== -1) {
          targetPIdx = mineacleIdx;
        } else if (playerStoneGolemTauntTurns > 0 && golemIdx !== -1) {
          targetPIdx = golemIdx;
        } else {
          targetPIdx = updated.findIndex(p => p.currentHp > 0);
        }

        if (targetPIdx !== -1 && finalDmg > 0) {
          const targetMon = updated[targetPIdx];
          if (isOrbMatch && targetMon.researchPhysicalDamageReduction) {
            finalDmg = Math.max(1, Math.round(finalDmg * (1 - targetMon.researchPhysicalDamageReduction)));
          }
          let dodged = false;

          // 1. Mossloth Passive: Mossy Camouflage (<50% Max HP -> 20% chance to dodge)
          if ((targetMon.id === 'mossloth' || targetMon.avatarSeed === 'mossloth') && targetMon.currentHp < targetMon.maxHp * 0.5) {
            if (Math.random() < 0.20) {
              dodged = true;
              sound.playSwoosh();
              setFloatingDamage({ text: '🍃 DODGED (Mossy Camouflage)!', isEnemy: false });
              setTimeout(() => setFloatingDamage(null), 1200);
              addBattleLog({
                phase: 'combat',
                source: 'player',
                unitName: 'Mossloth',
                actionType: 'status',
                message: '🍃 Mossy Camouflage: Mossloth (<50% HP) dodged the incoming single-target attack!',
              });
            }
          }
          // 2. Khepri Passive: Desert Shroud (30% Evasiveness for 1 turn after ability)
          else if ((targetMon.id === 'khepri' || targetMon.avatarSeed === 'khepri') && playerKhepriShroudTurns > 0) {
            if (Math.random() < 0.30) {
              dodged = true;
              sound.playSwoosh();
              setFloatingDamage({ text: '🏜️ EVADED (Desert Shroud)!', isEnemy: false });
              setTimeout(() => setFloatingDamage(null), 1200);
              addBattleLog({
                phase: 'combat',
                source: 'player',
                unitName: 'Khepri',
                actionType: 'status',
                message: '🏜️ Desert Shroud: Khepri evaded the incoming single-target attack!',
              });
            }
          }

          if (!dodged) {
            updated[targetPIdx] = { ...targetMon, currentHp: Math.max(0, targetMon.currentHp - finalDmg) };
          }
        }
      }

      // CYBORGNID PASSIVE: Kinetic Battery (Gains 10 Mana every time it takes damage)
      // and track absorbed damage for Charge Beam
      updated = updated.map((p, idx) => {
        const oldHp = prevPlayers[idx]?.currentHp || 0;
        const loss = oldHp - p.currentHp;
        if ((p.id === 'cyborgnid' || p.avatarSeed === 'cyborgnid') && loss > 0) {
          setPlayerCyborgnidDmgAbsorbed(prev => prev + loss);
          return {
            ...p,
            currentMana: Math.min(200, p.currentMana + 10),
          };
        }
        return p;
      });

      // MINEACLE PASSIVE: Proximity Detonation (Reflect 20% of damage taken back to attacker)
      prevPlayers.forEach((oldP, idx) => {
        const newHp = updated[idx]?.currentHp || 0;
        const loss = oldP.currentHp - newHp;
        if ((oldP.id === 'mineacle' || oldP.avatarSeed === 'mineacle') && loss > 0) {
          const reflectDmg = Math.round(loss * 0.20);
          if (reflectDmg > 0) {
            setEnemyTeam(prevEnemies =>
              prevEnemies.map(e => e.currentHp > 0 ? { ...e, currentHp: Math.max(0, e.currentHp - reflectDmg) } : e)
            );
            addBattleLog({
              phase: 'combat',
              source: 'player',
              unitName: 'Mineacle',
              actionType: 'status',
              message: `💣 Proximity Detonation: Mineacle reflected ${reflectDmg} DMG (20%) back to attacker!`,
            });
          }
        }
      });

      // Track unit defeats
      prevPlayers.forEach((oldP, pIdx) => {
        if (oldP.currentHp > 0 && updated[pIdx].currentHp <= 0) {
          addBattleLog({
            phase: 'combat',
            source: 'system',
            actionType: 'defeat',
            message: `⚠️ Your ${oldP.name} (#${pIdx + 1}) has fainted!`,
          });
        }
      });

      // MINEACLE DEATH TRIGGER: Upon death, explodes and deals 10% Max HP to ALL enemies!
      const oldMineacle = prevPlayers.find(p => (p.id === 'mineacle' || p.avatarSeed === 'mineacle'));
      const newMineacle = updated.find(p => (p.id === 'mineacle' || p.avatarSeed === 'mineacle'));
      if (oldMineacle && oldMineacle.currentHp > 0 && newMineacle && newMineacle.currentHp <= 0 && !playerMineacleDeathApplied.current) {
        playerMineacleDeathApplied.current = true;
        const deathBlast = Math.round(newMineacle.maxHp * 0.10);
        setEnemyTeam(prevEnemies =>
          prevEnemies.map(e => ({ ...e, currentHp: Math.max(0, e.currentHp - deathBlast) }))
        );
        addBattleLog({
          phase: 'combat',
          source: 'player',
          unitName: 'Mineacle',
          actionType: 'defeat',
          message: `💥 Proximity Detonation: Fallen Mineacle exploded, dealing ${deathBlast} DMG (10% max HP) to ALL enemies!`,
        });
      }

      // Check Unyielding Granite Death Trigger: 25% max HP shield for 3 turns to allies on death
      const oldGolem = prevPlayers.find(p => (p.id === 'stone_golem' || p.avatarSeed === 'stone_golem'));
      const newGolem = updated.find(p => (p.id === 'stone_golem' || p.avatarSeed === 'stone_golem'));
      if (oldGolem && oldGolem.currentHp > 0 && newGolem && newGolem.currentHp <= 0 && !playerGolemDeathApplied.current) {
        playerGolemDeathApplied.current = true;
        const deathShield = Math.round(newGolem.maxHp * 0.25);
        setTeamShieldPoints(prev => prev + deathShield);
        setGolemDeathShieldTurns(3);
        setFloatingDamage({
          text: `🛡️ UNYIELDING GRANITE: Fallen Stone Golem grants +${deathShield} Shield to all allies for 3 turns!`,
          isEnemy: false,
        });
        addBattleLog({
          phase: 'combat',
          source: 'player',
          unitName: 'Stone Golem',
          actionType: 'status',
          message: `🛡️ Stone Golem's Unyielding Granite triggered: +${deathShield} Shield to all allies for 3 turns!`,
        });
      }

      return updated;
    };

    // DECISION: Cast Ability OR Move Match-3 Orbs like the player!
    const isEnemyGolem = attacker.id === 'enemy_golem' || attacker.avatarSeed === 'stone_golem';
    const canCastSkill2 = !!(attacker.skill2 && attacker.currentMana >= (attacker.skill2.manaCost || 40));
    const canCastSkill1 = !!(attacker.skill1 && attacker.currentMana >= (attacker.skill1.manaCost || 20));
    const isEnemySilenced = (enemySilenceTurns[attackerIdx] || 0) > 0;

    const shouldCastAbility = !isEnemySilenced && (canCastSkill2 || canCastSkill1) && Math.random() < 0.65;

    if (shouldCastAbility) {
      // Cast Ability Path
      const skillToCast = canCastSkill2 ? attacker.skill2 : attacker.skill1;
      const manaCost = skillToCast?.manaCost || 20;

      // Special handling for Enemy Stone Golem Fortress Bulwark
      if (isEnemyGolem && canCastSkill2) {
        setTurnAnnouncement(`ENEMY ABILITY: ${attacker.name} casts "Fortress Bulwark"! Taunts player & gains shield for 2 turns!`);
        sound.playSkillCast();
        setEnemyStoneGolemTauntTurns(2);
        setEnemyTeam(prev =>
          prev.map(e =>
            e.id === attacker.id ? { ...e, currentMana: Math.max(0, e.currentMana - attacker.skill2.manaCost) } : e
          )
        );
        addBattleLog({
          phase: 'combat',
          source: 'enemy',
          unitName: attacker.name,
          actionType: 'skill',
          message: `🏰 Enemy ${attacker.name} cast Fortress Bulwark! Taunted attacks for 2 turns!`,
        });
        setTimeout(() => {
          finishEnemyTurn(playerTeam);
        }, 800);
        return;
      }

      // Special handling for Enemy Voltlynx Thunder Bolt: 3 Completely Random Strikes!
      if (skillToCast.id === 'thunder_bolt' || (skillToCast as any).targetType === 'random_3') {
        setTurnAnnouncement(`ENEMY ABILITY: ${attacker.name} casts "Thunder Bolt"! (3 Random Strikes)`);
        sound.playSkillCast();

        setEnemyTeam(prev =>
          prev.map(e =>
            e.id === attacker.id ? { ...e, currentMana: Math.max(0, e.currentMana - manaCost) } : e
          )
        );

        setTimeout(() => {
          sound.playAttackHit();
          setPlayerTeam(prevPlayers => {
            let currentPlayers = [...prevPlayers];
            let totalDmg = 0;
            const hitLogs: string[] = [];

            for (let s = 1; s <= 3; s++) {
              const livingIndices = currentPlayers
                .map((p, idx) => (p.currentHp > 0 ? idx : -1))
                .filter(idx => idx !== -1);
              if (livingIndices.length === 0) break;

              const targetIdx = livingIndices[Math.floor(Math.random() * livingIndices.length)];
              const target = currentPlayers[targetIdx];

              let strikeDmg = Math.round(attacker.baseAtk * 0.9);
              if ((enemyFrostbiteTurns[attackerIdx] || 0) > 0) {
                strikeDmg = Math.round(strikeDmg * 0.9); // Frostbite -10% ATK
              }

              // Elemental counter/resistance
              if (target.element === 'Water') strikeDmg = Math.round(strikeDmg * 1.1);
              else if (target.element === 'Wind') strikeDmg = Math.round(strikeDmg * 0.9);

              const def = target.def ?? 20;
              strikeDmg = Math.max(1, Math.round(strikeDmg * (100 / (100 + def))));

              currentPlayers[targetIdx] = {
                ...target,
                currentHp: Math.max(0, target.currentHp - strikeDmg),
              };
              totalDmg += strikeDmg;
              recordPlayerMonDamageTaken(targetIdx, strikeDmg);
              hitLogs.push(`Strike #${s}: -${strikeDmg} HP to ${target.name} (#${targetIdx + 1})`);
            }

            setFloatingDamage({
              text: `⚡ ENEMY THUNDER BOLT! (3 Strikes: -${totalDmg} HP)`,
              isEnemy: false,
            });
            setTimeout(() => setFloatingDamage(null), 1500);

            addBattleLog({
              phase: 'combat',
              source: 'enemy',
              unitName: attacker.name,
              actionType: 'skill',
              message: `⚡ Enemy ${attacker.name} unleashed "Thunder Bolt"!`,
              detail: hitLogs.join(' · '),
            });

            finishEnemyTurn(currentPlayers);
            return currentPlayers;
          });
        }, 700);
        return;
      }

      setTurnAnnouncement(`ENEMY ABILITY: ${attacker.name} casts "${skillToCast.name}"!`);
      sound.playSkillCast();

      // Check stun chance for Stone Crash
      if (isEnemyGolem && !canCastSkill2 && Math.random() < 0.3) {
        const livingIndices = playerTeam.map((p, i) => p.currentHp > 0 ? i : -1).filter(i => i !== -1);
        if (livingIndices.length > 0) {
          const stTarget = livingIndices[Math.floor(Math.random() * livingIndices.length)];
          setStunnedPlayerIndices(prev => Array.from(new Set([...prev, stTarget])));
          addBattleLog({
            phase: 'combat',
            source: 'enemy',
            unitName: attacker.name,
            actionType: 'status',
            message: `💫 Enemy ${attacker.name} stunned your ${playerTeam[stTarget]?.name}!`,
          });
        }
      }

      // Check stun chance for Zapwing Lightning Beak (35%)
      if ((attacker.id === 'enemy_zapwing' || attacker.avatarSeed === 'zapwing') && skillToCast.id === 'lightning_beak' && Math.random() < 0.35) {
        const livingIndices = playerTeam.map((p, i) => p.currentHp > 0 ? i : -1).filter(i => i !== -1);
        if (livingIndices.length > 0) {
          const stTarget = livingIndices[Math.floor(Math.random() * livingIndices.length)];
          setStunnedPlayerIndices(prev => Array.from(new Set([...prev, stTarget])));
          addBattleLog({
            phase: 'combat',
            source: 'enemy',
            unitName: attacker.name,
            actionType: 'status',
            message: `💫 Enemy Zapwing stunned your ${playerTeam[stTarget]?.name}!`,
          });
        }
      }

      // Check poison chance for Vinedra abilities (35%)
      if (attacker.id === 'enemy_vinedra' || attacker.avatarSeed === 'vinedra') {
        const livingIndices = playerTeam.map((p, i) => p.currentHp > 0 ? i : -1).filter(i => i !== -1);
        livingIndices.forEach(idx => {
          if (Math.random() < 0.35) {
            setPlayerPoisonTurns(prev => ({ ...prev, [idx]: 2 }));
            addBattleLog({
              phase: 'combat',
              source: 'enemy',
              unitName: attacker.name,
              actionType: 'status',
              message: `🍄 Toxic Spore poisoned your ${playerTeam[idx]?.name} for 2 turns!`,
            });
          }
        });
      }

      // Check Enemy Glidron Skill 2 HP sacrifice (30% current HP)
      const isEnemyGlidronSkill2 = (attacker.id === 'enemy_glidron' || attacker.avatarSeed === 'glidron') && skillToCast.id === 'gigawatt_explosion';
      const enemyGlidronSacrifice = isEnemyGlidronSkill2 ? Math.max(1, Math.round(attacker.currentHp * 0.3)) : 0;

      // Deduct mana from enemy and reduce Glidron HP if skill 2
      setEnemyTeam(prev =>
        prev.map(e =>
          e.id === attacker.id
            ? {
                ...e,
                currentMana: Math.max(0, e.currentMana - manaCost),
                currentHp: isEnemyGlidronSkill2 ? Math.max(1, e.currentHp - enemyGlidronSacrifice) : e.currentHp,
              }
            : e
        )
      );

      let dmg = Math.round(attacker.baseAtk * skillToCast.damageMultiplier);
      if ((enemyFrostbiteTurns[attackerIdx] || 0) > 0) {
        dmg = Math.round(dmg * 0.9); // Frostbite -10% ATK
      }

      // Shield mitigation
      if (teamShieldPoints > 0) {
        if (teamShieldPoints >= dmg) {
          setTeamShieldPoints(prev => prev - dmg);
          dmg = 0;
        } else {
          dmg -= teamShieldPoints;
          setTeamShieldPoints(0);
        }
      }

      setTimeout(() => {
        sound.playAttackHit();
        setFloatingDamage({
          text: dmg === 0 ? '🛡️ BLOCKED BY SHIELD!' : `💥 -${dmg} HP`,
          isEnemy: false,
        });
        setTimeout(() => setFloatingDamage(null), 1200);

        addBattleLog({
          phase: 'combat',
          source: 'enemy',
          unitName: attacker.name,
          actionType: 'skill',
          message: `👾 Enemy ${attacker.name} cast "${skillToCast.name}"!`,
          detail: `Inflicted ${dmg} DMG${skillToCast.targetType === 'aoe' ? ' across all player Starmons.' : '.'}`,
        });

        // Inflict damage on player units with Taunt redirection
        setPlayerTeam(prevPlayers => {
          const updated = applyDamageToPlayer(prevPlayers, dmg, skillToCast.targetType === 'aoe');
          finishEnemyTurn(updated);
          return updated;
        });
      }, 700);
      return;
    }

    // Move Orbs Path: Find and execute match-3 swap on board!
    const aiMove = findBestAiOrbMove(board, attacker.element);

    if (aiMove) {
      const moveData = aiMove;
      const r1 = moveData.r1;
      const c1 = moveData.c1;
      const r2 = moveData.r2;
      const c2 = moveData.c2;
      const matchedCoords = moveData.matches;
      const matchCount = matchedCoords.length;
      const matchElem = moveData.matchElem;

      setTurnAnnouncement(`ENEMY MATCH-3: ${attacker.name} is swapping orbs at [${r1 + 1},${c1 + 1}] & [${r2 + 1},${c2 + 1}]...`);
      setAiHighlightedTiles([{ row: r1, col: c1 }, { row: r2, col: c2 }]);

      // Step A: Show AI swap highlight for 600ms
      setTimeout(() => {
        sound.playClick();

        // Step B: Perform swap on board
        setBoard(prevBoard => {
          const copy = prevBoard.map(row => row.map(tile => ({ ...tile })));
          const t1 = copy[r1][c1];
          const t2 = copy[r2][c2];
          copy[r1][c1] = { ...t2, row: r1, col: c1 };
          copy[r2][c2] = { ...t1, row: r2, col: c2 };
          return copy;
        });

        // Step C: Trigger match pop & damage calculation
        setTimeout(() => {
          setAiHighlightedTiles(null);
          sound.playMatchPop(matchCount);

          // Glidron passive: Gain 2 mana for every Wind or Electric orb consumed by either side
          const isWindOrElectric = matchElem === 'Wind' || matchElem === 'Electric';
          const glidronBonusMana = isWindOrElectric ? matchCount * 2 : 0;

          // Tidecrush passive: Fluid Precision
          const isEnemyTidecrush = attacker.id === 'enemy_tidecrush' || attacker.avatarSeed === 'tidecrush';
          let enemyTidecrushHeal = 0;
          let enemyTidecrushExtraMana = 0;
          if (isEnemyTidecrush) {
            if (attacker.currentHp >= attacker.maxHp) {
              enemyTidecrushExtraMana = 10;
            } else {
              enemyTidecrushHeal = Math.round(attacker.maxHp * 0.10);
            }
          }

          // Enemy gains mana from matched orbs
          const manaGain = matchCount * 6;
          setEnemyTeam(prev =>
            prev.map(e => {
              let m = e.currentMana;
              let hp = e.currentHp;
              if (e.id === attacker.id) {
                m += manaGain + enemyTidecrushExtraMana;
                if (enemyTidecrushHeal > 0) {
                  hp = Math.min(e.maxHp, hp + enemyTidecrushHeal);
                }
              }
              if (glidronBonusMana > 0 && (e.id === 'enemy_glidron' || e.avatarSeed === 'glidron') && e.currentHp > 0) {
                m += glidronBonusMana;
              }
              return { ...e, currentMana: Math.min(200, m), currentHp: hp };
            })
          );

          if (glidronBonusMana > 0) {
            setPlayerTeam(prev =>
              prev.map(s =>
                (s.id === 'glidron' || s.avatarSeed === 'glidron') && s.currentHp > 0
                  ? { ...s, currentMana: Math.min(200, s.currentMana + glidronBonusMana) }
                  : s
              )
            );
          }

          // Calculate match-3 damage
          const baseMult = getBaseMultiplierForOrbs(matchCount);
          const isEnemySameElem = (matchElem === attacker.element || matchElem === attacker.secondaryElement);
          const enemySameElemBonus = isEnemySameElem ? 0.10 : 0.0;

          const frontlinePlayer = playerTeam.find(p => p.currentHp > 0);
          let enemyCounterBonus = 0.0;
          let enemyResistPenalty = 0.0;
          if (frontlinePlayer) {
            if (
              ELEMENT_COUNTERS[attacker.element] === frontlinePlayer.element ||
              (attacker.secondaryElement && ELEMENT_COUNTERS[attacker.secondaryElement] === frontlinePlayer.element) ||
              ELEMENT_COUNTERS[matchElem] === frontlinePlayer.element
            ) {
              enemyCounterBonus = 0.10;
            }
            if (
              ELEMENT_COUNTERS[frontlinePlayer.element] === attacker.element ||
              (frontlinePlayer.secondaryElement && ELEMENT_COUNTERS[frontlinePlayer.secondaryElement] === attacker.element)
            ) {
              enemyResistPenalty = -0.10;
            }
          }

          const totalMult = Math.max(0.2, baseMult + enemySameElemBonus + enemyCounterBonus + enemyResistPenalty);
          let rawDmg = Math.round(attacker.baseAtk * totalMult);

          // Shield mitigation
          if (teamShieldPoints > 0) {
            if (teamShieldPoints >= rawDmg) {
              setTeamShieldPoints(prev => prev - rawDmg);
              rawDmg = 0;
            } else {
              rawDmg -= teamShieldPoints;
              setTeamShieldPoints(0);
            }
          }

          sound.playAttackHit();
          setFloatingDamage({
            text: rawDmg === 0 ? '🛡️ BLOCKED BY SHIELD!' : `-${rawDmg} HP`,
            isEnemy: false,
          });
          setTimeout(() => setFloatingDamage(null), 1000);

          addBattleLog({
            phase: 'combat',
            source: 'enemy',
            unitName: attacker.name,
            actionType: 'match',
            message: `👾 Enemy ${attacker.name} matched ${matchCount} ${matchElem} orbs!`,
            detail: `Dealt ${rawDmg} DMG to your frontline!`,
          });

          // Damage player frontline with Taunt redirection
          setPlayerTeam(prevPlayers => {
            const updated = applyDamageToPlayer(prevPlayers, rawDmg, false, true);

            // Refill board with anti-cascade lockout
            setBoard(prev => {
              const next = prev.map(row => row.map(tile => ({ ...tile })));
              matchedCoords.forEach((m: { row: number; col: number }) => {
                next[m.row][m.col] = null as unknown as OrbTile;
              });

              for (let c = 0; c < BOARD_SIZE; c++) {
                let bottom = BOARD_SIZE - 1;
                for (let r = BOARD_SIZE - 1; r >= 0; r--) {
                  if (next[r][c] !== null) {
                    if (bottom !== r) {
                      next[bottom][c] = { ...next[r][c], row: bottom };
                      next[r][c] = null as unknown as OrbTile;
                    }
                    bottom--;
                  }
                }
                for (let r = bottom; r >= 0; r--) {
                  next[r][c] = {
                    id: `orb_${r}_${c}_${Date.now()}_${Math.random()}`,
                    element: ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)],
                    row: r,
                    col: c,
                  };
                }
              }
              return applyAntiCascadeLockout(next);
            });

            finishEnemyTurn(updated);
            return updated;
          });
        }, 500);
      }, 700);
    } else {
      // Fallback direct attack if no match exists on board
      setTurnAnnouncement(`ENEMY ATTACK: ${attacker.name} strikes with basic attack!`);
      let rawDmg = Math.max(20, Math.round(attacker.baseAtk * 0.9));

      if (teamShieldPoints > 0) {
        if (teamShieldPoints >= rawDmg) {
          setTeamShieldPoints(prev => prev - rawDmg);
          rawDmg = 0;
        } else {
          rawDmg -= teamShieldPoints;
          setTeamShieldPoints(0);
        }
      }

      sound.playAttackHit();
      setFloatingDamage({ text: rawDmg === 0 ? '🛡️ BLOCKED!' : `-${rawDmg} HP`, isEnemy: false });
      setTimeout(() => setFloatingDamage(null), 1000);

      setPlayerTeam(prevPlayers => {
        const updated = applyDamageToPlayer(prevPlayers, rawDmg, false);
        finishEnemyTurn(updated);
        return updated;
      });
    }
  };

  const finishEnemyTurn = (updatedPlayers: Starmon[]) => {
    if (isPvP) return; // ZERO BOT IN PVP MODE!
    if (enemyAttackerQueueRef.current.length > 0) {
      setTimeout(() => executeEnemyTurn(), 500);
      return;
    }
    setActiveEnemyAttackerIndex(null);
    setAiHighlightedTiles(null);

    // Decrement turn counters
    setPlayerStoneGolemTauntTurns(prev => Math.max(0, prev - 1));
    setEnemyStoneGolemTauntTurns(prev => Math.max(0, prev - 1));
    setPlayerMineacleTauntTurns(prev => Math.max(0, prev - 1));
    setEnemyMineacleTauntTurns(prev => Math.max(0, prev - 1));
    setPlayerMosslothTauntTurns(prev => Math.max(0, prev - 1));
    setPlayerMosslothRegenTurns(prev => Math.max(0, prev - 1));
    setPlayerKhepriShroudTurns(prev => Math.max(0, prev - 1));
    setSunEffectTurns(prev => Math.max(0, prev - 1));
    setGolemDeathShieldTurns(prev => Math.max(0, prev - 1));
    setTidecrushBuffTurns(prev => Math.max(0, prev - 1));
    setTidecrushCooldownTurns(prev => Math.max(0, prev - 1));

    // Decrement Healing Block turns
    setPlayerHealingBlockTurns(prev => {
      const next: Record<number, number> = {};
      Object.entries(prev).forEach(([idx, t]) => {
        if (t > 1) next[Number(idx)] = t - 1;
      });
      return next;
    });
    setEnemyHealingBlockTurns(prev => {
      const next: Record<number, number> = {};
      Object.entries(prev).forEach(([idx, t]) => {
        if (t > 1) next[Number(idx)] = t - 1;
      });
      return next;
    });

    // Sluggish Metabolism: Heal 15% Max HP at the end of every turn
    if (playerMosslothRegenTurns > 0) {
      setPlayerTeam(prevPlayers => {
        const mossIdx = prevPlayers.findIndex(p => (p.id === 'mossloth' || p.avatarSeed === 'mossloth') && p.currentHp > 0);
        if (mossIdx !== -1) {
          const isBlocked = (playerHealingBlockTurns[mossIdx] || 0) > 0;
          if (!isBlocked) {
            const mossMon = prevPlayers[mossIdx];
            const heal = Math.round(mossMon.maxHp * 0.15);
            const nextHp = Math.min(mossMon.maxHp, mossMon.currentHp + heal);
            addBattleLog({
              phase: 'combat',
              source: 'player',
              unitName: 'Mossloth',
              actionType: 'status',
              message: `🐢 Sluggish Metabolism: Mossloth recovered +${heal} HP (15% Max HP)!`,
            });
            return prevPlayers.map((p, i) => i === mossIdx ? { ...p, currentHp: nextHp } : p);
          } else {
            addBattleLog({
              phase: 'combat',
              source: 'player',
              unitName: 'Mossloth',
              actionType: 'status',
              message: `🚫 Sluggish Metabolism: Mossloth's HP recovery was blocked by Healing Block!`,
            });
          }
        }
        return prevPlayers;
      });
    }

    // Decrement Frostbite turns
    setPlayerFrostbiteTurns(prev => {
      const next: Record<number, number> = {};
      Object.entries(prev).forEach(([idx, t]) => {
        if (t > 1) next[Number(idx)] = t - 1;
      });
      return next;
    });
    setEnemyFrostbiteTurns(prev => {
      const next: Record<number, number> = {};
      Object.entries(prev).forEach(([idx, t]) => {
        if (t > 1) next[Number(idx)] = t - 1;
      });
      return next;
    });

    // Decrement Silence turns
    setPlayerSilenceTurns(prev => {
      const next: Record<number, number> = {};
      Object.entries(prev).forEach(([idx, t]) => {
        if (t > 1) next[Number(idx)] = t - 1;
      });
      return next;
    });
    setEnemySilenceTurns(prev => {
      const next: Record<number, number> = {};
      Object.entries(prev).forEach(([idx, t]) => {
        if (t > 1) next[Number(idx)] = t - 1;
      });
      return next;
    });

    // Decrement Piercing turns
    setPlayerPiercingTurns(prev => {
      const next: Record<number, number> = {};
      Object.entries(prev).forEach(([idx, t]) => {
        if (t > 1) next[Number(idx)] = t - 1;
      });
      return next;
    });

    // Decrement Coralus shield duration (3 turns)
    setCoralusShieldTurns(prev => {
      const nextTurns = Math.max(0, prev - 1);
      if (nextTurns === 0 && prev > 0) {
        setTeamShieldPoints(sp => Math.max(0, sp - 200));
      }
      return nextTurns;
    });

    // Decrement Coralus DEF debuffs on enemies
    setEnemyDefDebuffs(prev => {
      const updated: Record<number, { percent: number; turns: number }> = {};
      Object.entries(prev).forEach(([idxStr, debuff]) => {
        const nextT = debuff.turns - 1;
        if (nextT > 0) {
          updated[Number(idxStr)] = { ...debuff, turns: nextT };
        }
      });
      return updated;
    });

    // Process Poison DoT on Enemies: Takes 5% max HP damage after turn
    setEnemyTeam(prevEnemies => {
      let changed = false;
      const nextEnemies = prevEnemies.map((e, idx) => {
        if ((enemyPoisonTurns[idx] || 0) > 0 && e.currentHp > 0) {
          changed = true;
          const pDmg = Math.max(5, Math.round(e.maxHp * 0.05));
          const nextHp = Math.max(0, e.currentHp - pDmg);
          addBattleLog({
            phase: 'combat',
            source: 'system',
            actionType: 'status',
            message: `🍄 Toxic Spore Poison: Enemy ${e.name} took ${pDmg} Poison DMG (5% max HP)!`,
          });
          return { ...e, currentHp: nextHp };
        }
        return e;
      });
      return changed ? nextEnemies : prevEnemies;
    });

    setEnemyPoisonTurns(prev => {
      const next: Record<number, number> = {};
      Object.entries(prev).forEach(([idx, t]) => {
        if (t > 1) next[Number(idx)] = t - 1;
      });
      return next;
    });

    // Process Poison DoT on Players: Takes 5% max HP damage after turn
    setPlayerTeam(prevPlayers => {
      let changed = false;
      const nextPlayers = prevPlayers.map((p, idx) => {
        if ((playerPoisonTurns[idx] || 0) > 0 && p.currentHp > 0) {
          changed = true;
          const pDmg = Math.max(5, Math.round(p.maxHp * 0.05));
          const nextHp = Math.max(0, p.currentHp - pDmg);
          addBattleLog({
            phase: 'combat',
            source: 'system',
            actionType: 'status',
            message: `🍄 Poison: Your ${p.name} took ${pDmg} Poison DMG!`,
          });
          return { ...p, currentHp: nextHp };
        }
        return p;
      });
      return changed ? nextPlayers : prevPlayers;
    });

    setPlayerPoisonTurns(prev => {
      const next: Record<number, number> = {};
      Object.entries(prev).forEach(([idx, t]) => {
        if (t > 1) next[Number(idx)] = t - 1;
      });
      return next;
    });

    // Decrement Vinedra Crit Bonus turns
    setVinedraCritBonusTurns(prev => {
      const next: Record<number, number> = {};
      Object.entries(prev).forEach(([idx, t]) => {
        if (t > 1) next[Number(idx)] = t - 1;
      });
      return next;
    });

    const allPlayersDead = updatedPlayers.every(p => p.currentHp <= 0);
    if (allPlayersDead) {
      setPhase('defeat');
      sound.playWrong();
      return;
    }

    setTimeout(() => {
      setCurrentRoundNumber(r => r + 1);
      setPhase('phase1_quiz');
      setActiveQuestionIndex(0);
      setQuestionTimer(QUESTION_TIME_LIMIT);
      setAnsweredState({});
      setUnlockedPositions(Array(partySize).fill(false));
      setIeltsAiResult(null);
      setSpokenTranscript('');
      setRecordingErrorNotice('');
      setCurrentQuizSet(getRandomQuizSet(partySize, soloQuizMode));
      sound.playSwoosh();
    }, 1300);
  };

  // Open Victory Chest: 100-500 Gold, 3-8 Cards of a random Starmon (obtained or unobtained)
  const handleOpenVictoryChest = () => {
    if (chestOpened) return;
    sound.playPackTear();

    // 100 to 500 gold
    const gold = Math.floor(Math.random() * (500 - 100 + 1)) + 100;
    // 3 to 8 cards
    const cards = Math.floor(Math.random() * (8 - 3 + 1)) + 3;

    // Random Starmon from entire roster (both obtained and unobtained)
    const rosterPool = (allRosterStarmons && allRosterStarmons.length > 0) ? allRosterStarmons : STARMON_ROSTER;
    const randomMon = rosterPool[Math.floor(Math.random() * rosterPool.length)];
    const isUnobtained = !playerStarmons.some(s => s.id === randomMon.id && s.unlocked);

    setTimeout(() => {
      sound.playRewardFanfare();
      try {
        confetti({
          particleCount: 180,
          spread: 95,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#fbbf24'],
        });
      } catch {}
      setChestRewards({
        gold,
        cards,
        starmon: randomMon,
        isUnobtained,
      });
      setChestOpened(true);
    }, 450);
  };

  const orbIcons: Record<ElementType, React.ReactNode> = {
    Fire: <Flame className="w-8 h-8 text-rose-100 fill-rose-500 drop-shadow" />,
    Water: <Droplet className="w-8 h-8 text-sky-100 fill-sky-500 drop-shadow" />,
    Electric: <Zap className="w-8 h-8 text-amber-100 fill-amber-300 drop-shadow" />,
    Wind: <Wind className="w-8 h-8 text-teal-100 fill-teal-400 drop-shadow" />,
    Earth: <Layers className="w-8 h-8 text-amber-200 fill-amber-700 drop-shadow" />,
    Metal: <Shield className="w-8 h-8 text-slate-100 fill-slate-400 drop-shadow" />,
  };

  return (
    <div className="w-full h-screen max-h-screen overflow-hidden flex flex-col justify-between bg-slate-950 text-slate-100 select-none">
      {/* TUTORIAL MODE TOP BANNER */}
      {tutorialStage && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 border-b-2 border-amber-400 px-3 md:px-5 py-2 flex items-center justify-between shadow-xl z-30 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs md:text-sm font-black font-game text-amber-300 tracking-wide truncate">
                  {tutorialStage === 1 && 'TUTORIAL 1: Game mechanics'}
                  {tutorialStage === 2 && 'TUTORIAL 2: PASSIVE & ACTIVE ABILITIES (Match 2/3)'}
                  {tutorialStage === 3 && 'TUTORIAL 3: ELEMENTAL WHEEL & COUNTERS (Match 3/3)'}
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black shrink-0">
                  PvE GUIDED MATCH
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                {tutorialStage === 1 && 'Step-by-step: Answering questions unlocks attack slots ➔ Match 3+ orbs to attack ➔ Defeat enemy!'}
                {tutorialStage === 2 && 'Passive abilities trigger automatically for free! Active abilities consume Mana & take your turn.'}
                {tutorialStage === 3 && 'Cycle: Water ➔ Fire ➔ Metal ➔ Earth ➔ Wind ➔ Electric ➔ Water! Same-Element: +10% DMG | Counter: +10% DMG | Resistance: -10% DMG.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="h-10 md:h-12 border-b border-slate-800 bg-slate-900/90 px-3 md:px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onExitBattle('loss')}
            className="px-2.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-[11px] font-bold rounded-lg text-slate-300 border border-slate-700 cursor-pointer active:scale-95"
          >
            Flee
          </button>
          <span className="text-xs md:text-sm font-black font-game text-amber-300 flex items-center gap-1.5">
            {isPvP ? (
              phase === 'phase1_quiz'
                ? `PHASE ${pvpFlowPhaseString} (Answer Question)`
                : `PHASE ${pvpFlowPhaseString} (Action)`
            ) : (
              phase === 'phase1_quiz'
                ? `${isPvP ? '' : `PVE LEVEL ${pveLevel} · `}PHASE 1: ANSWER STAGE (ROUND ${currentRoundNumber})`
                : `${isPvP ? '' : `PVE LEVEL ${pveLevel} · `}PHASE 2: MATCH-3 COMBAT ARENA`
            )}
          </span>
        </div>

        {/* Room Code & Info if in PvP */}
        {pvpRoomInfo && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950/90 border border-amber-400 text-xs font-mono shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
            <span className="text-amber-300 font-bold">PvP #{pvpRoomInfo.code}</span>
            <span className="text-slate-300 text-[11px] truncate max-w-[120px] md:max-w-none">vs {pvpRoomInfo.opponentName || pvpRoomInfo.hostName}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold hidden sm:inline">
              {pvpMySlot === 1 ? 'P1 (Host · Đi trước · 0 Mana)' : 'P2 (Guest · Đi sau · 20 Mana)'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 md:gap-3">
          {/* Battle Log Button */}
          <button
            onClick={() => {
              sound.playClick();
              setShowBattleLogModal(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-amber-600/30 via-slate-800 to-amber-600/20 hover:from-amber-600/50 hover:to-slate-700 border border-amber-400/60 rounded-xl text-xs font-bold text-amber-200 shadow cursor-pointer active:scale-95 transition-all group"
            title="Xem lịch sử trận đấu (Battle Log)"
          >
            <ScrollText className="w-3.5 h-3.5 text-amber-300 group-hover:rotate-6 transition-transform" />
            <span className="font-game hidden xs:inline">Battle Log</span>
            <span className="text-[10px] font-mono font-black px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full shadow-sm">
              {battleLogs.length}
            </span>
          </button>

          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
            PHASE 1: 120s ({isPvP ? 3 : currentQuizSet.length} CÂU) · MAX MANA 200
          </span>

          <button
            onClick={() => {
              sound.playClick();
              onToggleFullscreen();
            }}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white cursor-pointer active:scale-95"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 text-cyan-300" /> : <Maximize2 className="w-3.5 h-3.5 text-slate-300" />}
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* PHASE 1: ANSWER STAGE (40s per question + Skip Button) */}
      {/* ======================================================== */}
      {phase === 'phase1_quiz' && (
        <div className="flex-1 flex flex-col justify-between p-3 md:p-5 relative overflow-hidden">
          {/* Phase 1 Background Image from user */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            <img
              src={phase1Bg}
              alt="Phase 1 Background"
              className="w-full h-full object-cover select-none pointer-events-none"
            />
            {/* Dark glass tint for maximum contrast with questions */}
            <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-[0.5px] pointer-events-none" />
          </div>

          {/* REAL-TIME PVP: WAITING FOR OPPONENT SPEAKING OVERLAY */}
          {isPvP && pvpWaitingForOpponentSpeaking && (
            <div className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-300 mb-4 animate-pulse">
                <Clock className="w-8 h-8 animate-spin text-amber-300" />
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-xs font-black tracking-wider uppercase mb-2">
                ĐÃ HOÀN TẤT 3 CÂU HỎI PHASE 1
              </span>
              <h3 className="text-xl md:text-2xl font-black font-game text-amber-300 mb-2">
                Chờ Phase 1 hoàn tất...
              </h3>
              <p className="text-xs md:text-sm text-amber-200 font-bold max-w-lg leading-relaxed mb-3 bg-amber-950/40 border border-amber-500/40 px-4 py-2 rounded-xl">
                Phase 1: Bạn có tổng cộng 2 phút để trả lời 3 câu hỏi. Nếu hết giờ, những câu chưa được trả lời sẽ bị tính là 0 điểm
              </p>
              <p className="text-xs md:text-sm text-slate-300 max-w-md leading-relaxed mb-4">
                {pvpWaitingForPhaseTransition
                  ? 'Đã nhận đủ kết quả. Đang đồng bộ để cả hai người chơi cùng chuyển phase.'
                  : 'Sau 120 giây, hệ thống có tối đa 15 giây để đồng bộ kết quả. Nếu cả hai nộp sớm, trận đấu sẽ chuyển phase ngay.'}
              </p>

              {/* 120-second answer window; early completion skips the unused wait. */}
              <div className="w-full max-w-sm bg-slate-900/95 border-2 border-amber-400/80 rounded-2xl p-4 shadow-xl mb-4 flex flex-col items-center gap-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Thời gian đếm ngược còn lại của 120 giây:
                </span>
                <div className="flex items-center gap-2 text-4xl md:text-5xl font-black font-mono text-amber-300">
                  <Clock className="w-9 h-9 md:w-10 md:h-10 text-amber-400 animate-pulse" />
                  {pvpWaitingForPhaseTransition || questionTimer <= 0
                    ? <span className="text-base md:text-lg font-sans">Đang kết nối, vui lòng đợi</span>
                    : <>
                        <span>{Math.floor(questionTimer / 60)}:{String(questionTimer % 60).padStart(2, '0')}</span>
                        <span className="text-sm md:text-base text-amber-100/80">({questionTimer}s / 120s)</span>
                      </>}
                </div>
                <div className="w-full h-3 bg-slate-950 rounded-full border border-amber-400/60 p-0.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-400 transition-all duration-1000"
                    style={{ width: `${Math.max(0, Math.min(100, (questionTimer / QUESTION_TIME_LIMIT) * 100))}%` }}
                  />
                </div>
              </div>

              {/* Chờ đối thủ status button (replaces buggy Vào chiến đấu ngay button) */}
              <div className="px-6 py-3 bg-slate-900 border-2 border-amber-400/80 text-amber-300 font-black font-game text-sm md:text-base rounded-xl shadow-xl flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 text-amber-300 animate-spin" />
                <span>{pvpWaitingForPhaseTransition || questionTimer <= 0 ? 'Đang kết nối, vui lòng đợi' : `ĐANG CHỜ HẾT PHASE 1 (${questionTimer}s)`}</span>
              </div>
            </div>
          )}

          <div className="relative z-10 flex flex-col justify-between h-full">
          {/* Phase 1 Mandatory Notice Banner */}
          <div className="w-full max-w-2xl mx-auto mb-1 px-2">
            <div className="w-full py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-950/90 via-slate-900/95 to-amber-950/90 border border-amber-400/80 text-center shadow-md">
              <p className="text-[11px] md:text-xs font-black text-amber-300 tracking-wide">
                ⏱️ Phase 1: Bạn có 2 phút để trả lời {isPvP ? 3 : currentQuizSet.length} câu hỏi. Câu chưa trả lời sẽ bị tính là 0 điểm
              </p>
            </div>
          </div>

          {/* Top Rainbow Countdown Bar + Mode Switcher + Skip Button */}
          <div className="w-full max-w-2xl mx-auto flex flex-wrap items-center justify-between gap-2 px-2">
            {/* QUESTION MODE QUICK TOGGLE - HIDDEN IN TUTORIAL */}
            {!tutorialStage && !isPvP && (
              <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl p-1 shadow-sm shrink-0">
                <span className="text-[10px] text-slate-400 font-bold px-1 hidden sm:inline">Chế độ:</span>
                {(['random', 'part1_preference', 'part3_forecast_2026'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      onChangeQuestionMode?.(mode);
                      if (phase === 'phase1_quiz') {
                        setCurrentQuizSet(getRandomQuizSet(partySize, mode === 'random' || mode === 'part1_preference' ? 'speaking_only' : mode));
                        setActiveQuestionIndex(0);
                        setAnsweredState({});
                        pvpQuizAnswersRef.current = [];
                        setIeltsAiResult(null);
                        setQuestionTimer(QUESTION_TIME_LIMIT);
                      }
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-black font-game transition-all cursor-pointer ${
                      questionMode === mode
                        ? mode === 'random'
                          ? 'bg-amber-400 text-slate-950 shadow-md ring-1 ring-amber-300'
                          : mode === 'part1_preference'
                            ? 'bg-indigo-500 text-white shadow-md ring-1 ring-indigo-300'
                            : 'bg-cyan-500 text-slate-950 shadow-md ring-1 ring-cyan-300'
                        : 'text-slate-400 hover:text-white bg-slate-900/60'
                    }`}
                  >
                    {mode === 'random' ? '🎲 Random' : mode === 'part1_preference' ? '🗣️ Part 1 Preference' : '📚 Part 3 Forecast 2026'}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 min-w-[140px] flex flex-col items-center">
              <span className="text-sm md:text-lg font-black font-game tracking-wider text-amber-300 mb-1">
                THỜI GIAN PHASE 1: {Math.floor(questionTimer / 60)}:{String(questionTimer % 60).padStart(2, '0')} ({questionTimer}s / 120s)
              </span>
              <div className="w-full h-4 bg-slate-900 rounded-full border-2 border-amber-400/80 p-0.5 shadow-md overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-400 via-green-400 to-cyan-400 transition-all duration-1000"
                  style={{ width: `${(questionTimer / QUESTION_TIME_LIMIT) * 100}%` }}
                />
              </div>
            </div>

            {/* SKIP THIS QUESTION BUTTON - HIDDEN IN TUTORIAL */}
            {!tutorialStage && (
              <button
                onClick={handleSkipQuestion}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white text-xs font-bold font-game flex items-center gap-1.5 shadow transition-all cursor-pointer active:scale-95 shrink-0"
                title="Skip this question and advance immediately (Phase 2 if last question)"
              >
                <FastForward className="w-3.5 h-3.5 text-amber-300" />
                <span>SKIP THIS QUESTION</span>
              </button>
            )}
          </div>

          {/* Starmon Question Portrait Circles with explicit Position Mapping */}
          <div id="tutorial-top-avatars" className="flex items-center justify-center gap-4 md:gap-8 my-1 md:my-2">
            {currentQuizSet.map((q, idx) => {
              const isAnswered = answeredState[idx] !== undefined;
              const isCorrect = answeredState[idx] === true;
              const isActive = idx === activeQuestionIndex;
              const assignedMon = playerTeam[idx % playerTeam.length] || playerTeam[0];

              return (
                <div key={q.id} className="flex flex-col items-center">
                  <div
                    className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full border-3 flex items-center justify-center transition-all ${
                      isActive
                        ? 'border-amber-400 bg-slate-900 scale-110 shadow-lg shadow-amber-400/30 ring-2 ring-amber-300'
                        : isCorrect
                        ? 'border-emerald-400 bg-emerald-950/60'
                        : 'border-slate-700 bg-slate-900/60 opacity-60'
                    }`}
                  >
                    <StarmonAsset id={assignedMon.avatarSeed} size="sm" />
                    {isCorrect && (
                      <div className="absolute top-0 right-0 w-5 h-5 rounded-full bg-emerald-500 border border-white flex items-center justify-center text-slate-950 shadow">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                    {!isActive && !isCorrect && isAnswered && (
                      <div className="absolute top-0 right-0 w-5 h-5 rounded-full bg-rose-600 border border-white flex items-center justify-center text-white text-[10px] font-black shadow">
                        ✕
                      </div>
                    )}
                    {!isActive && !isAnswered && (
                      <div className="absolute top-0 right-0 w-5 h-5 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-400">
                        <Lock className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                  <span
                    className={`mt-1 text-[11px] font-bold px-2 py-0.2 rounded-full border ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                        : isCorrect
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    Q{idx + 1} → {assignedMon.name} (#{idx + 1})
                  </span>
                </div>
              );
            })}
          </div>

          {/* Question Challenge Box */}
          <div id="tutorial-question-box" className="w-full max-w-2xl mx-auto bg-gradient-to-b from-[#fef3c7] to-[#fde68a] text-slate-900 rounded-3xl p-4 md:p-5 shadow-2xl border-4 border-[#b45309] relative my-auto">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-0.5 bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700 border-2 border-white rounded-lg text-white font-black font-game text-xs tracking-wider uppercase shadow-md whitespace-nowrap">
              {currentQ.type === 'mcq'
                ? `${currentQ.title} (Unlocks Starmon #${activeQuestionIndex + 1})`
                : `IELTS SPEAKING PART 1 (AI EXAMINER: 4 CRITERIA)`}
            </div>

            {currentQ.type === 'mcq' ? (
              <div className="mt-2 text-center">
                {currentQ.sentence && (
                  <p className="text-xs md:text-sm font-bold text-amber-900 mb-2 italic">
                    "{currentQ.sentence}"
                  </p>
                )}
                <h4 id="tutorial-question-text" className="text-xs md:text-sm font-black font-game text-slate-900 mb-3 uppercase tracking-tight">
                  {currentQ.question}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {currentQ.options?.map((opt, oIdx) => {
                    const letter = ['A', 'B', 'C', 'D'][oIdx];
                    const hasAnswered = answeredState[activeQuestionIndex] !== undefined;
                    const isRight = oIdx === currentQ.correctIndex;

                    return (
                      <button
                        key={oIdx}
                        id={isRight ? "tutorial-correct-option" : undefined}
                        onClick={() => handleMcqOptionSelect(oIdx)}
                        disabled={hasAnswered || (tutorialStage === 1 && !isRight)}
                        className={`p-2.5 rounded-xl border-2 text-left font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
                          hasAnswered && isRight
                            ? 'bg-emerald-500 text-white border-emerald-700 shadow-md'
                            : tutorialStage === 1 && !isRight
                            ? 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-25 filter grayscale cursor-not-allowed'
                            : tutorialStage === 1 && isRight
                            ? 'bg-white text-slate-950 border-amber-400 ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-950 font-black shadow-xl active:scale-98'
                            : 'bg-white/90 hover:bg-white border-amber-600/70 text-slate-900 active:scale-98'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-lg border font-black flex items-center justify-center shrink-0 text-xs ${
                          tutorialStage === 1 && !isRight
                            ? 'bg-slate-800 border-slate-700 text-slate-500'
                            : 'bg-amber-400 border-amber-600 text-slate-950'
                        }`}>
                          {letter}
                        </span>
                        <span className="flex-1 truncate">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* REAL IELTS SPEAKING QUESTION WITH VOICE TRANSCRIPTION & AI 4-CRITERIA EVALUATION */
              <div id="tutorial-speaking-box" className="mt-2 text-center flex flex-col items-center">
                <div className="w-full flex items-center justify-between gap-2 mb-2 text-xs">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-700 text-white font-bold flex items-center gap-1 shadow">
                    <BookOpen className="w-3 h-3" />
                    {currentIeltsMetadata.topic}
                  </span>
                  {showSpeakingHints ? (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-200 border border-amber-400 text-amber-950 text-[10px] font-mono font-bold">
                      Idiom: "{currentIeltsMetadata.suggestedIdiom}"
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1">
                      <span>🔒 Chế độ thi thật (Gợi ý tắt)</span>
                    </span>
                  )}
                </div>

                <h3 id="tutorial-speaking-question" className="text-sm md:text-base font-black text-slate-900 mb-2 leading-snug">
                  "{currentQ.question}"
                </h3>

                {/* Model Answer Preview - ONLY SHOWN WHEN showSpeakingHints IS TRUE */}
                {showSpeakingHints ? (
                  <div className="p-3 bg-white/95 rounded-2xl border-2 border-amber-600 my-1 max-w-xl shadow-inner text-left w-full">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                        Band 7+ Model Response Suggestion:
                      </span>
                      <button
                        onClick={() => handlePlaySampleAudio(currentIeltsMetadata.sampleAnswer)}
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer active:scale-95"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>Listen Model</span>
                      </button>
                    </div>
                    <p className="text-xs md:text-sm font-semibold text-slate-800 italic leading-relaxed">
                      "{currentIeltsMetadata.sampleAnswer}"
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {currentIeltsMetadata.keywords.map(kw => (
                        <span key={kw} className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold border border-amber-300">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Clean exam banner when hints are turned off */
                  <div className="w-full max-w-xl my-1 p-2.5 bg-amber-950/20 rounded-xl border border-amber-600/40 text-left text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-800">
                      <HelpCircle className="w-4 h-4 text-amber-800 shrink-0" />
                      <span className="text-[11px] font-semibold">
                        Gợi ý & câu mẫu đang được ẩn. Bạn có thể bật lại trong phần <strong>Cài đặt (Settings)</strong>.
                      </span>
                    </div>
                  </div>
                )}

                {/* Live Real-time Transcribed Speech Box */}
                <div className="w-full max-w-xl mt-2 p-2.5 bg-slate-900 text-slate-100 rounded-xl border border-slate-700 text-left text-xs font-mono">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span className="flex items-center gap-1.5">
                      {isRecording && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />}
                      {isRecording ? 'Listening & transcribing speech in real-time...' : 'Your spoken response:'}
                    </span>
                    {spokenTranscript && !isRecording && (
                      <button
                        onClick={() => evaluateWithGeminiAi(spokenTranscript)}
                        disabled={isAiEvaluating}
                        className="text-cyan-400 hover:text-cyan-300 underline font-bold cursor-pointer"
                      >
                        Re-evaluate with AI
                      </button>
                    )}
                  </div>
                  <p className="text-slate-200 min-h-6">
                    {spokenTranscript ? `"${spokenTranscript}"` : isRecording ? 'Speak your response into the microphone now...' : 'No audio recorded yet. Click the green button below to start recording.'}
                  </p>
                </div>

                {recordingErrorNotice && (
                  <p className="text-xs font-bold text-rose-700 mt-1">
                    {recordingErrorNotice}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* REAL RECORDING BUTTON (GREEN WHEN IDLE, RED WHEN RECORDING) */}
          {currentQ.type === 'speaking' && (
            <div className="flex flex-col items-center my-2">
              <div className="flex items-center gap-3">
                <button
                  id="tutorial-mic-btn"
                  onClick={handleToggleRecording}
                  disabled={isAiEvaluating || answeredState[activeQuestionIndex] !== undefined}
                  className={`px-5 py-2.5 rounded-full border-2 flex items-center gap-2 shadow-xl transition-all active:scale-95 cursor-pointer font-black font-game text-xs tracking-wider uppercase ${
                    isRecording
                      ? 'bg-rose-600 hover:bg-rose-700 border-rose-300 text-white animate-pulse ring-8 ring-rose-400/40 shadow-rose-950/50'
                      : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white shadow-emerald-950/50 hover:scale-105'
                  }`}
                >
                  {isRecording ? (
                    <>
                      <Square className="w-4 h-4 fill-white animate-spin" />
                      <span>RECORDING... TAP TO STOP & EVALUATE</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5 text-white" />
                      <span>START RECORDING (VOICE ANSWER)</span>
                    </>
                  )}
                </button>

                {(showSpeakingHints || tutorialStage === 1) && (
                  <button
                    id="tutorial-sample-answer-btn"
                    onClick={() => {
                      const text = currentIeltsMetadata.sampleAnswer || 'Yes, I really enjoy reading books. It is a wonderful way to relax, broaden my horizons, and acquire useful knowledge in my daily life.';
                      handleUseSampleAnswer(text);
                    }}
                    disabled={isRecording || answeredState[activeQuestionIndex] !== undefined}
                    className="px-3.5 py-2 rounded-full bg-gradient-to-r from-indigo-700 to-purple-700 hover:from-indigo-600 hover:to-purple-600 border border-indigo-400 text-indigo-100 text-xs font-black flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-md shadow-indigo-950/50"
                    title="Sử dụng câu trả lời mẫu để hoàn thành câu hỏi"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Sử dụng câu trả lời mẫu</span>
                  </button>
                )}
              </div>

              {isRecording && (
                <div className="flex items-center gap-1 mt-2 h-4">
                  {[20, 50, 80, 100, 70, 40, 90, 60, 30].map((h, i) => (
                    <div
                      key={i}
                      className="w-1 bg-rose-400 rounded-full transition-all duration-75"
                      style={{
                        height: `${Math.max(4, Math.min(24, (audioVolumeLevel / 100) * h))}px`,
                      }}
                    />
                  ))}
                  <span className="text-[10px] text-rose-300 font-mono ml-1">Microphone signal active...</span>
                </div>
              )}

              {/* Background Evaluation Notice Banner */}
              {backgroundNotice && (
                <div className="flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-indigo-950/90 border border-indigo-400/80 text-xs font-bold text-indigo-200 animate-in fade-in duration-200 shadow-lg">
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse shrink-0" />
                  <span>{backgroundNotice}</span>
                </div>
              )}

              {/* Background Status Indicator when evaluating questions */}
              {Object.values(evaluatingMap).some(Boolean) && !backgroundNotice && (
                <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs font-bold text-amber-300 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    AI đang phân tích {Object.entries(evaluatingMap).filter(([_, v]) => v).map(([k]) => `Câu ${Number(k) + 1}`).join(', ')} trong nền...
                  </span>
                </div>
              )}

              <span className="text-[10px] text-slate-400 mt-1">
                Passing requirement: Overall Band ≥ {requiredSpeakingBand.toFixed(1)} unlocks Starmons for combat
              </span>
            </div>
          )}

          <div className="text-center text-[10px] text-slate-500">
            Phase 1 will repeat after each combat round until victory or defeat.
          </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3-TAB REPORT MODAL FOR ALL 3 QUESTIONS ON COMPLETION */}
      {/* ======================================================== */}
      {(showAllQuestionsReport || (ieltsAiResult && currentQuizSet.length === 1)) && phase === 'phase1_quiz' && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 md:p-5">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl p-4 md:p-6 max-w-2xl w-full text-slate-100 shadow-2xl flex flex-col gap-3 relative max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-6 h-6 text-amber-400" />
                <div>
                  <h3 className="text-base md:text-lg font-black font-game text-amber-300">
                    BÁO CÁO ĐÁNH GIÁ {currentQuizSet.length} CÂU IELTS SPEAKING
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Phân tích chi tiết Fluency, Ngữ pháp, Phát âm & Đề xuất luyện tập
                  </p>
                </div>
              </div>
              {(() => {
                const scores = currentQuizSet.map((_, i) => ieltsResultsMap[i]?.overall_score ?? ieltsResultsMap[i]?.overallBand).filter((s): s is number => typeof s === 'number');
                const avgScore = scores.length > 0 ? Math.floor((scores.reduce((a, b) => a + b, 0) / scores.length) * 2) / 2 : 0;
                const allPassed = scores.length === currentQuizSet.length && scores.every(s => s >= requiredSpeakingBand);
                return (
                  <div className={`px-3 py-1 rounded-xl border text-center font-black ${
                    allPassed || avgScore >= requiredSpeakingBand
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                      : 'bg-rose-950 border-rose-500 text-rose-300'
                  }`}>
                    <div className="text-[9px] uppercase tracking-wider">Điểm trung bình</div>
                    <div className="text-xl font-game">{scores.length > 0 ? avgScore : '...'}</div>
                  </div>
                );
              })()}
            </div>

            {/* TOP BAR: 3 TABS (ONE FOR EACH QUESTION) */}
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-950/90 rounded-2xl border-2 border-amber-400/60 shadow-inner">
              {currentQuizSet.map((q, idx) => {
                const isSelected = selectedReportTab === idx;
                const isEvaluating = evaluatingMap[idx];
                const res = ieltsResultsMap[idx];
                const score = res?.overall_score ?? res?.overallBand;
                const isPassed = score !== undefined && score >= requiredSpeakingBand;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setSelectedReportTab(idx);
                    }}
                    className={`flex-1 py-2 px-2.5 rounded-xl font-black font-game text-xs md:text-sm transition-all flex flex-col items-center justify-center cursor-pointer border ${
                      isSelected
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/25 scale-[1.02]'
                        : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>CÂU {idx + 1}</span>
                      {isEvaluating && <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />}
                    </div>
                    <div className="text-[10px] font-mono mt-0.5">
                      {isEvaluating ? (
                        <span className="text-amber-500 font-bold">Đang phân tích...</span>
                      ) : score !== undefined ? (
                        <span className={isPassed ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                          Band {score} {isPassed ? '✓' : '✗'}
                        </span>
                      ) : (
                        <span className="text-slate-400">Chờ kết quả</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ACTIVE TAB CONTENT */}
            {(() => {
              const activeQ = currentQuizSet[selectedReportTab] || currentQuizSet[0];
              const activeRes = ieltsResultsMap[selectedReportTab] || ieltsAiResult;
              const isEvaluating = evaluatingMap[selectedReportTab];
              const activeTranscript = questionTranscripts[selectedReportTab] || activeRes?.transcript || '';

              if (isEvaluating) {
                return (
                  <div className="p-8 rounded-2xl bg-slate-950/80 border border-amber-400/50 flex flex-col items-center justify-center text-center gap-3 my-2">
                    <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
                    <h4 className="text-base font-black font-game text-amber-300">
                      GIÁM KHẢO AI ĐANG PHÂN TÍCH CÂU {selectedReportTab + 1}...
                    </h4>
                    <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                      Đang đánh giá độ trôi chảy (ngắt nghỉ, vấp, khoảng dừng), chấm ngữ pháp chính xác (khung 6.5 - 7.5), và rà soát phát âm cụ thể theo chuẩn IPA.
                    </p>
                    {activeTranscript && (
                      <div className="mt-2 p-3 bg-slate-900 rounded-xl border border-slate-800 text-left text-xs italic text-slate-200 max-w-lg w-full">
                        "{activeTranscript}"
                      </div>
                    )}
                  </div>
                );
              }

              if (!activeRes) {
                return (
                  <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 text-center text-xs text-slate-400">
                    Chưa có dữ liệu bài nói cho Câu {selectedReportTab + 1}.
                  </div>
                );
              }

              const fbVi = activeRes.feedback_vi;
              const fluency = activeRes.fluency_detail;
              const grammarErrors = activeRes.grammar_errors || [];
              const pronunciationErrors = activeRes.pronunciation_errors || [];
              const score = activeRes.overall_score ?? activeRes.overallBand;
              const isPassed = score >= requiredSpeakingBand;

              return (
                <div className="space-y-3 animate-in fade-in duration-200">
                  {/* Status Banner */}
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    isPassed
                      ? 'bg-emerald-900/40 border-emerald-500 text-emerald-200'
                      : 'bg-rose-900/40 border-rose-500 text-rose-200'
                  }`}>
                    <span>
                      {isPassed
                        ? `🎉 CÂU ${selectedReportTab + 1} ĐẠT BAND ${score} (≥ ${requiredSpeakingBand.toFixed(1)}) — STARMON #${(activeQ?.assignedStarmonIndex ?? selectedReportTab) + 1} SẴN SÀNG!`
                        : `⚠️ CÂU ${selectedReportTab + 1} ĐẠT BAND ${score} (< ${requiredSpeakingBand.toFixed(1)}) — Cần cải thiện thêm`}
                    </span>
                    <span className="text-[10px] font-mono opacity-80">Mục tiêu: Band {requiredSpeakingBand.toFixed(1)}</span>
                  </div>

                  {/* Question & Transcript Box */}
                  <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 text-xs space-y-1.5 shadow-sm">
                    <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                      <span>Câu hỏi: "{activeQ?.question || activeRes.questionText}"</span>
                    </div>
                    {activeTranscript && (
                      <div className="pl-2 border-l-2 border-amber-400/50 italic text-slate-200 text-[11px]">
                        "{activeTranscript}"
                      </div>
                    )}
                  </div>

                  {/* 4 Criteria Quick Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-sky-500/40 flex flex-col items-center text-center shadow-inner">
                      <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">Fluency (FC)</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Trôi chảy & mạch lạc</span>
                      <span className="text-base font-black text-sky-200 font-mono mt-1">
                        Band {activeRes.criteria.fluencyCoherence.band}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 flex flex-col items-center text-center shadow-inner">
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Lexical (LR)</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Vốn từ vựng</span>
                      <span className="text-base font-black text-amber-200 font-mono mt-1">
                        Band {activeRes.criteria.lexicalResource.band}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 flex flex-col items-center text-center shadow-inner">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Grammar (GRA)</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Ngữ pháp & câu</span>
                      <span className="text-base font-black text-emerald-200 font-mono mt-1">
                        Band {activeRes.criteria.grammaticalRange.band}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-purple-500/40 flex flex-col items-center text-center shadow-inner">
                      <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Pronunciation (PR)</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Phát âm & âm vị</span>
                      <span className="text-base font-black text-purple-200 font-mono mt-1">
                        Band {activeRes.criteria.pronunciation.band}
                      </span>
                    </div>
                  </div>

                  {/* 1. PHÂN TÍCH FLUENCY (NÓI LẮP, VẤP, KHOẢNG DỪNG) */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/90 border-2 border-sky-500/60 shadow-lg space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-sky-500/30 pb-2">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-sky-400" />
                        <h4 className="font-black text-sky-300 font-game text-xs uppercase tracking-wide">
                          ⚡ Phân tích Fluency (Nói lắp, Vấp & Ngập ngừng):
                        </h4>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono font-bold">
                        Band {activeRes.criteria.fluencyCoherence.band}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Nói lắp / Lặp từ</span>
                        <span className="font-black text-amber-300 font-mono text-sm">{fluency?.stutterCount ?? 0} lần</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Từ đệm (uh/um)</span>
                        <span className="font-black text-amber-300 font-mono text-sm">{fluency?.hesitationCount ?? 0} lần</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Khoảng dừng (Pauses)</span>
                        <span className="font-black text-sky-300 font-mono text-sm">{fluency?.pauseCount ?? 0} lần</span>
                      </div>
                    </div>
                    {fluency?.stumbles && fluency.stumbles.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-sky-950/30 border border-sky-500/30 text-[11px] text-sky-200">
                        <span className="font-bold text-sky-300 block mb-1">Ghi nhận các đoạn vấp & ngập ngừng:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-200">
                          {fluency.stumbles.map((st, sIdx) => (
                            <li key={sIdx}>{st}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-300 leading-relaxed italic">
                      {fluency?.feedback || activeRes.criteria.fluencyCoherence.feedback}
                    </p>
                  </div>

                  {/* 2. CHI TIẾT LỖI NGỮ PHÁP (GRAMMAR ERRORS & CẤU TRÚC LUYỆN TẬP) */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/90 border-2 border-emerald-500/60 shadow-lg space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <h4 className="font-black text-emerald-300 font-game text-xs uppercase tracking-wide">
                          📝 Chi tiết Lỗi Ngữ Pháp & Cấu trúc cần luyện tập:
                        </h4>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
                        Band {activeRes.criteria.grammaticalRange.band} · {grammarErrors.length} Điểm lưu ý
                      </span>
                    </div>

                    {grammarErrors.length === 0 ? (
                      <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-200">
                        ✓ Ngữ pháp tự nhiên, chuẩn xác, không có lỗi sai cơ bản nghiêm trọng (Band 7.0 - 7.5).
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {grammarErrors.map((gErr, gIdx) => (
                          <div
                            key={gIdx}
                            className="bg-emerald-950/20 rounded-xl p-2.5 border border-emerald-500/30 text-[11px] space-y-1 text-slate-200"
                          >
                            <div className="text-amber-200 italic font-mono">
                              <span className="text-rose-400 font-bold not-italic">Câu gốc: </span>"{gErr.sentence}"
                            </div>
                            <div>
                              <span className="text-rose-300 font-bold">Sai ở đâu: </span>{gErr.error}
                            </div>
                            <div className="text-emerald-300 font-bold">
                              <span>Cách sửa chuẩn: </span>
                              <span className="bg-emerald-900/60 px-1.5 py-0.5 rounded border border-emerald-500/40">{gErr.correction}</span>
                            </div>
                            {gErr.practice_structure && (
                              <div className="text-amber-300 font-semibold bg-amber-950/40 p-1.5 rounded-lg border border-amber-500/30">
                                <span>🎯 Luyện tập cấu trúc: </span>
                                <span className="underline">{gErr.practice_structure}</span>
                              </div>
                            )}
                            <div className="text-slate-400 text-[10px]">
                              <span className="text-slate-300 font-bold">Giải thích: </span>{gErr.explanation}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. CHI TIẾT LỖI PHÁT ÂM (PRONUNCIATION ERRORS: TỪ NÀO, ÂM GÌ) */}
                  <div className="p-3.5 rounded-2xl bg-slate-950/90 border-2 border-purple-500/60 shadow-lg space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-purple-500/30 pb-2">
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-purple-400" />
                        <h4 className="font-black text-purple-300 font-game text-xs uppercase tracking-wide">
                          🗣️ Chi tiết Lỗi Phát Âm (Từ nào, Âm gì):
                        </h4>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono font-bold">
                        Band {activeRes.criteria.pronunciation.band} · {pronunciationErrors.length} Từ cần lưu ý
                      </span>
                    </div>

                    {pronunciationErrors.length === 0 ? (
                      <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-[11px] text-purple-200">
                        ✓ Phát âm rõ ràng, nhịp điệu và ngữ điệu tự nhiên, dễ hiểu.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {pronunciationErrors.map((pErr, pIdx) => (
                          <div
                            key={pIdx}
                            className="bg-purple-950/20 rounded-xl p-2.5 border border-purple-500/30 text-[11px] space-y-1 text-slate-200"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-black text-amber-300 text-xs">"{pErr.word}"</span>
                              <span className="px-1.5 py-0.2 rounded bg-purple-900/80 text-purple-200 font-mono text-[10px] border border-purple-400/40">
                                {pErr.phonetic}
                              </span>
                            </div>
                            {pErr.sound && (
                              <div className="text-purple-300 font-bold bg-purple-900/40 px-2 py-0.5 rounded border border-purple-500/30">
                                <span>Âm cần chú ý: </span>{pErr.sound}
                              </div>
                            )}
                            <div>
                              <span className="text-rose-300 font-bold">Vấn đề phát âm: </span>{pErr.issue}
                            </div>
                            <div className="text-emerald-300 text-[10px]">
                              <span className="font-bold">Hướng dẫn chuẩn xác: </span>{pErr.guide}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 4. NHẬN XÉT TỔNG QUAN & GỢI Ý CỦA GIÁM KHẢO */}
                  <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/50 shadow-md text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-300 font-black font-game uppercase">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Nhận xét Tổng quan của Giám khảo:</span>
                    </div>
                    <p className="text-slate-200 leading-relaxed text-[11px]">
                      {fbVi?.summary || activeRes.summary}
                    </p>
                    {fbVi?.suggestion && (
                      <div className="mt-2 pt-2 border-t border-amber-500/30 text-emerald-200 text-[11px]">
                        <span className="font-bold text-emerald-300">💡 Gợi ý cải thiện: </span>
                        {fbVi.suggestion}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* CONFIRMATION & ADVANCE BUTTON */}
            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleConfirmAllSpeakingQuestions}
                className="w-full py-3 bg-gradient-to-r from-amber-400 to-yellow-400 font-black font-game text-slate-950 rounded-xl shadow-xl hover:from-amber-300 hover:to-yellow-300 cursor-pointer active:scale-95 flex items-center justify-center gap-2 text-sm md:text-base"
              >
                <span>
                  {isPvP
                    ? `XÁC NHẬN BÁO CÁO & CHỜ ĐỐI THỦ VÀO TRANH ĐẤU (${questionTimer}s)`
                    : 'XÁC NHẬN BÁO CÁO & BƯỚC VÀO CHIẾN ĐẤU MATCH-3 (PHASE 2)'}
                </span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* PHASE 2: MATCH-3 COMBAT ARENA */}
      {/* ======================================================== */}
      {/* REAL-TIME PVP TURN BANNER SPLASH ("Player 1 moves first" / "Player 2 moves first") */}
      {pvpTurnBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none animate-in fade-in zoom-in duration-300">
          <div className="bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-slate-950 px-8 py-6 rounded-3xl shadow-2xl border-4 border-amber-300 flex flex-col items-center gap-2 transform animate-bounce">
            <div className="flex items-center gap-3">
              <Swords className="w-8 h-8 text-slate-950" />
              <span className="text-2xl md:text-4xl font-black font-game tracking-wider uppercase drop-shadow">
                {pvpTurnBanner}
              </span>
              <Swords className="w-8 h-8 text-slate-950 transform scale-x-[-1]" />
            </div>
            <span className="text-xs md:text-sm font-bold text-slate-900">
              Speaking Phase đã kết thúc! Bước vào Battle Phase!
            </span>
          </div>
        </div>
      )}

      {phase === 'phase2_combat' && (
        <div
          className="flex-1 flex flex-col justify-between p-2 md:p-3 relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(2,6,23,.68), rgba(15,23,42,.48), rgba(2,6,23,.72)), url("${currentArenaMap.preview}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Top Announcement Bar */}
          <div className={`w-full px-4 py-1.5 border rounded-xl flex items-center justify-between shadow ${
            isPvP
              ? isMyTurnInPvP
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
                : 'bg-indigo-950/90 border-indigo-500 text-indigo-200'
              : turnStatusType === 'missed'
              ? 'bg-rose-950/90 border-rose-600 text-rose-200'
              : turnStatusType === 'enemy'
              ? 'bg-purple-950/90 border-purple-600 text-purple-200'
              : 'bg-slate-900/90 border-slate-800 text-amber-300'
          }`}>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {isPvP ? (
                isMyTurnInPvP ? (
                  <Swords className="w-4 h-4 text-emerald-400 animate-bounce" />
                ) : (
                  <Clock className="w-4 h-4 text-indigo-300 animate-spin" />
                )
              ) : turnStatusType === 'enemy' ? (
                <Bot className="w-4 h-4 text-purple-400 animate-pulse" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-400" />
              )}
              <span className="min-w-0 text-xs md:text-sm font-black font-game tracking-wide break-words">
                {isPvP
                  ? (turnAnnouncement ||
                      (isMyTurnInPvP
                        ? `Phase ${pvpFlowPhaseString} ➔ LƯỢT CỦA BẠN! Chọn Đánh vật lý hoặc Dùng Kỹ năng`
                        : `Phase ${pvpFlowPhaseString} ➔ LƯỢT ĐỐI THỦ (${pvpCurrentTurnPlayerName || 'Đối thủ'})...`))
                  : (turnAnnouncement || 'Combat in Progress...')}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isPvP && pvpTurnTimer !== null && (
                <span className={`shrink-0 text-3xl md:text-4xl font-mono font-black px-4 py-1.5 rounded-lg border ${
                  pvpTurnTimer <= 5
                    ? 'bg-rose-950 border-rose-500 text-rose-300 animate-pulse'
                    : 'bg-slate-950 border-amber-400/60 text-amber-300'
                }`}>
                  {pvpWaitingForPhaseTransition || pvpTurnTimer <= 0
                    ? <span className="text-sm md:text-base font-sans">Đang kết nối, vui lòng đợi</span>
                    : <>⏱️ {pvpTurnTimer}s</>}
                </span>
              )}
              <span className="hidden sm:inline text-[11px] text-slate-400">
                {isPvP ? 'Đối thủ:' : 'Target:'} <strong className="text-rose-400">{enemyTeam[selectedEnemyIndex]?.name} (#{selectedEnemyIndex + 1})</strong>
              </span>
            </div>
          </div>

          {/* PvP Step Action Menu ("your_starmon_turn": chọn 1 trong 2 hành động: physical_attack hoặc use_ability) */}
          {isPvP && isMyTurnInPvP && pvpActionMenu && playerTeam[pvpActionMenu.starmonIndex] && (
            <div className="w-full mt-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-950/90 via-slate-900/95 to-indigo-950/90 border-2 border-amber-400 shadow-lg flex flex-wrap items-center justify-between gap-2 z-20">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-black font-game text-xs">
                  LƯỢT HÀNH ĐỘNG: {playerTeam[pvpActionMenu.starmonIndex].name}
                </span>
                <span className="text-xs text-slate-300 font-bold">
                  Chọn 1 trong 2 hành động (⏱️ {pvpTurnTimer ?? pvpActionMenu.timer}s):
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {pvpActionMenu.options.includes('physical_attack') && (
                  <button
                    onClick={() => {
                      sound.playClick();
                      setPvpActionMenu(prev => (prev ? { ...prev, selectedMode: 'physical_attack' } : null));
                    }}
                    className={`px-3 py-1.5 rounded-xl font-black font-game text-xs flex items-center gap-1.5 cursor-pointer transition-all border ${
                      pvpActionMenu.selectedMode === 'physical_attack'
                        ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-md scale-105'
                        : 'bg-slate-800 text-amber-300 border-amber-500/40 hover:bg-slate-700'
                    }`}
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>1. Đánh Vật Lý (Hoán đổi ngọc)</span>
                  </button>
                )}

                {pvpActionMenu.options.includes('use_ability') && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        sound.playClick();
                        setPvpActionMenu(prev => (prev ? { ...prev, selectedMode: 'use_ability' } : null));
                      }}
                      className={`px-3 py-1.5 rounded-xl font-black font-game text-xs flex items-center gap-1.5 cursor-pointer transition-all border ${
                        pvpActionMenu.selectedMode === 'use_ability'
                          ? 'bg-indigo-500 text-white border-indigo-300 shadow-md scale-105'
                          : 'bg-slate-800 text-indigo-300 border-indigo-500/40 hover:bg-slate-700'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>2. Dùng Kỹ Năng (Use Ability)</span>
                    </button>

                    {(() => {
                      const activeMon = playerTeam[pvpActionMenu.starmonIndex];
                      if (!activeMon) return null;
                      const canSkill1 = activeMon.currentMana >= activeMon.skill1.manaCost;
                      const isTide = activeMon.id === 'tidecrush';
                      const canSkill2 = !isTide
                        ? activeMon.currentMana >= activeMon.skill2.manaCost
                        : tidecrushCooldownTurns <= 0;
                      return (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCastAbility(1)}
                            disabled={!canSkill1}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition-all cursor-pointer ${
                              canSkill1
                                ? 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-300 shadow'
                                : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                            }`}
                          >
                            ⚡ {activeMon.skill1.name} ({activeMon.skill1.manaCost} Ma)
                          </button>
                          <button
                            onClick={() => handleCastAbility(2)}
                            disabled={!canSkill2}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition-all cursor-pointer ${
                              canSkill2
                                ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-300 shadow'
                                : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                            }`}
                          >
                            💥 {activeMon.skill2.name} ({isTide ? 'All Ma' : `${activeMon.skill2.manaCost} Ma`})
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tutorial Phase 2 Action Guidance Banner */}
          {tutorialStage && (
            <div className="w-full mt-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/60 flex items-center justify-between text-xs text-amber-200 shadow-md">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="leading-tight truncate sm:whitespace-normal">
                  {tutorialStage === 1 && (
                    <>
                      <strong>Hướng Dẫn 1 - Từng bước:</strong> 1) Hoán đổi 3 viên ngọc cùng màu ở bảng giữa để tấn công. 2) Nhấp vào thẻ đối thủ ở cột bên phải để đổi mục tiêu tấn công!
                    </>
                  )}
                  {tutorialStage === 2 && (
                    <>
                      <strong>Hướng Dẫn 2 - Từng bước:</strong> Passive tự động kích hoạt 0 tốn Mana/lượt. Nhấp vào chiêu Active (Skill 1/2) phía dưới Starmon để thi triển kỹ năng (tốn Mana và mất lượt đi)!
                    </>
                  )}
                  {tutorialStage === 3 && (
                    <>
                      <strong>Hướng Dẫn 3 - Từng bước:</strong> Ăn ngọc cùng nguyên tố Starmon: +10% DMG | Khắc hệ: +10% DMG | Bị khắc: -10% DMG. Vòng tròn: Water ➔ Fire ➔ Metal ➔ Earth ➔ Wind ➔ Electric ➔ Water!
                    </>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Floating Damage Popup */}
          {floatingDamage && (
            <div
              className={`absolute top-16 z-30 font-black font-game text-xl md:text-2xl animate-bounce drop-shadow-xl ${
                floatingDamage.isEnemy ? 'right-28 text-yellow-300' : 'left-28 text-cyan-300'
              }`}
            >
              {floatingDamage.text}
            </div>
          )}

          {/* Dynamic Visual Attack Projectile Animation (fromSide -> toSide) */}
          {attackAnim && (
            <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
              <div className={`w-full flex items-center ${attackAnim.fromSide === 'left' ? 'justify-start pl-24' : 'justify-end pr-24'}`}>
                <div
                  className={`h-4 bg-gradient-to-r ${
                    attackAnim.fromSide === 'left'
                      ? 'from-cyan-400 via-amber-300 to-rose-400'
                      : 'from-rose-400 via-amber-300 to-cyan-400'
                  } rounded-full shadow-lg shadow-amber-400/80 animate-pulse`}
                  style={{ width: '45%' }}
                />
              </div>
            </div>
          )}

          {/* MAIN ARENA: 3-COLUMN LAYOUT (LEFT UNITS - CENTER BIG BOARD - RIGHT UNITS) */}
          {/* Rule: Slot 1 (Host/P1) ALWAYS displays on LEFT, Slot 2 (Guest/P2) ALWAYS displays on RIGHT */}
          <div className={`flex-1 flex items-center justify-between gap-2 md:gap-4 my-1 overflow-hidden ${isPvP && pvpMySlot === 2 ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* ======================================================== */}
            {/* PLAYER UNITS COLUMN (Slot 1 = LEFT, Slot 2 = RIGHT) */}
            {/* ======================================================== */}
            <div className={`w-72 md:w-80 flex flex-col gap-2 shrink-0 h-full justify-center overflow-y-auto pr-1 rounded-2xl transition-all ${
              isPvP && pvpHighlightedAttackerSlot === pvpMySlot
                ? 'ring-2 ring-amber-400/60 bg-amber-950/10 p-1'
                : isPvP && pvpHighlightedTargetSlot === pvpMySlot
                ? 'ring-2 ring-rose-500/50 bg-rose-950/10 p-1'
                : ''
            }`}>
              <span className={`text-[11px] font-black text-sky-400 tracking-wider uppercase px-1 ${isPvP && pvpMySlot === 2 ? 'text-right' : 'text-left'}`}>
                {isPvP ? `Đội của bạn (P${pvpMySlot} · ${pvpMySlot === 1 ? 'TRÁI' : 'PHẢI'} · ${pvpRoomInfo?.myPlayerName || 'Bạn'})` : 'Player Team (Turns: 1 → 2 → 3)'}
              </span>

              {playerTeam.map((mon, idx) => {
                const isCurrentAttacker = isPvP
                  ? (isMyTurnInPvP && pvpActionMenu?.starmonIndex === idx && mon.currentHp > 0)
                  : (actingStepIndex === idx && unlockedPositions[idx] && mon.currentHp > 0);
                const isMissed = !unlockedPositions[idx];
                const isLostTurnNow = isPvP && pvpLostTurnEffect?.attackerSlot === pvpMySlot && pvpLostTurnEffect?.starmonIndex === idx;
                const isDead = mon.currentHp <= 0;
                const isTidecrush = mon.id === 'tidecrush';
                const hasTideBuff = isTidecrush && tidecrushBuffTurns > 0;
                const isTideOnCooldown = isTidecrush && tidecrushCooldownTurns > 0;
                const isCoralus = mon.id === 'coralus';
                const isStoneGolem = mon.id === 'stone_golem' || mon.avatarSeed === 'stone_golem';
                const isStunned = stunnedPlayerIndices.includes(idx);
                const hasTeamShield = teamShieldPoints > 0;

                return (
                  <div
                    key={mon.id}
                    id={idx === 0 ? "tutorial-player-starmon-0" : undefined}
                    className={`p-2.5 rounded-2xl border-2 transition-all relative ${
                      isLostTurnNow
                        ? 'bg-rose-950/90 border-rose-500 shadow-xl shadow-rose-500/40 ring-2 ring-rose-400 animate-pulse'
                        : isCurrentAttacker
                        ? 'bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-amber-400 shadow-xl shadow-amber-400/25 ring-2 ring-amber-300'
                        : isMissed
                        ? 'bg-slate-900/60 border-slate-800 opacity-65'
                        : 'bg-slate-900/80 border-slate-800'
                    }`}
                  >
                    {isLostTurnNow && (
                      <div className="absolute inset-0 z-20 rounded-2xl bg-rose-950/85 backdrop-blur-[1px] flex items-center justify-center pointer-events-none animate-in fade-in duration-150">
                        <span className="px-3 py-1 rounded-xl bg-rose-600 text-white font-black font-game text-xs border-2 border-rose-300 shadow-lg">
                          {pvpLostTurnEffect?.reason === 'timeout' ? '⏱️ HẾT 30s — MẤT LƯỢT!' : '❌ TRẢ LỜI SAI — MẤT LƯỢT!'}
                        </span>
                      </div>
                    )}
                    {/* Header Row: Slot badge, Turn Status, and STATUS EFFECT ICONS */}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black font-game px-1.5 py-0.2 rounded bg-slate-800 text-slate-200">
                          Slot #{idx + 1}
                        </span>

                        {/* REAL ACTIVE STATUS, BUFF & DEBUFF ICONS */}
                        {(playerFrostbiteTurns[idx] || 0) > 0 && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-cyan-950 border border-cyan-400 text-cyan-300 shadow"
                            title={`Frostbite: Reduces Attack by 10% (${playerFrostbiteTurns[idx]} turns left)`}
                          >
                            <span className="text-[10px]">❄️</span>
                            <span className="text-[8px] font-black">Frostbite [{playerFrostbiteTurns[idx]}t]</span>
                          </div>
                        )}

                        {(playerSilenceTurns[idx] || 0) > 0 && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-purple-950 border border-purple-400 text-purple-300 shadow"
                            title={`Silenced: Cannot cast Active Abilities (${playerSilenceTurns[idx]} turns left)`}
                          >
                            <span className="text-[10px]">🔇</span>
                            <span className="text-[8px] font-black">Silence [{playerSilenceTurns[idx]}t]</span>
                          </div>
                        )}

                        {isStunned && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-950 border border-amber-400 text-amber-300 animate-pulse shadow"
                            title="Stunned: Skips next turn"
                          >
                            <span className="text-[10px]">💫</span>
                            <span className="text-[8px] font-black">STUNNED</span>
                          </div>
                        )}

                        {playerDefDebuffs[idx] && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-rose-950 border border-rose-500 text-rose-300 shadow"
                            title={`DEF Reduced by ${(playerDefDebuffs[idx].percent * 100).toFixed(0)}% (${playerDefDebuffs[idx].turns}t)`}
                          >
                            <Shield className="w-2.5 h-2.5 text-rose-400" />
                            <span className="text-[8px] font-black">DEF -{(playerDefDebuffs[idx].percent * 100).toFixed(0)}% [{playerDefDebuffs[idx].turns}t]</span>
                          </div>
                        )}

                        {(playerPiercingTurns[idx] || 0) > 0 && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-emerald-950 border border-emerald-400 text-emerald-300 shadow"
                            title={`Piercing: Ignores 50% enemy DEF (${playerPiercingTurns[idx]} turns left)`}
                          >
                            <span className="text-[10px]">🗡️</span>
                            <span className="text-[8px] font-black">Pierce [{playerPiercingTurns[idx]}t]</span>
                          </div>
                        )}

                        {isStoneGolem && playerStoneGolemTauntTurns > 0 && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-950 border border-amber-400 text-amber-300 animate-pulse shadow"
                            title={`Fortress Bulwark: Taunting enemies for ${playerStoneGolemTauntTurns} more turns`}
                          >
                            <Crosshair className="w-3 h-3 text-amber-300" />
                            <span className="text-[8px] font-black">Taunt [{playerStoneGolemTauntTurns}t]</span>
                          </div>
                        )}

                        {hasTeamShield && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-indigo-950 border border-indigo-400 text-indigo-300 animate-pulse shadow"
                            title={`Bubble Fortress Shield: ${teamShieldPoints} Barrier HP`}
                          >
                            <Shield className="w-3 h-3 text-indigo-300 fill-indigo-400/40" />
                            <span className="text-[8px] font-black">Barrier: {teamShieldPoints}</span>
                          </div>
                        )}

                        {hasTideBuff && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-cyan-950 border border-cyan-400 text-cyan-300 animate-pulse shadow"
                            title={`Tidal Surge ATK Buff: +${tidecrushBonusAtk} ATK (${tidecrushBuffTurns} turns left)`}
                          >
                            <TrendingUp className="w-3 h-3 text-cyan-300" />
                            <span className="text-[8px] font-black">+{tidecrushBonusAtk} [{tidecrushBuffTurns}t]</span>
                          </div>
                        )}

                        {isCoralus && mon.currentHp > mon.maxHp * 0.5 && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-sky-950 border border-sky-400 text-sky-300 shadow"
                            title="Carapace Wall Passive: Reduces all incoming damage by 15%"
                          >
                            <Shield className="w-2.5 h-2.5 text-cyan-300 fill-cyan-400/40" />
                            <span className="text-[8px] font-bold">Carapace -15%</span>
                          </div>
                        )}

                        {isStoneGolem && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-stone-900 border border-amber-600/80 text-amber-200 shadow"
                            title="Unyielding Granite Passive: +5% HP shield per round, +25% HP shield on death"
                          >
                            <Shield className="w-2.5 h-2.5 text-amber-400 fill-amber-500/30" />
                            <span className="text-[8px] font-bold">Granite</span>
                          </div>
                        )}

                        {golemDeathShieldTurns > 0 && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-emerald-950 border border-emerald-400 text-emerald-300 shadow"
                            title={`Granite Legacy: ${golemDeathShieldTurns} turns remaining`}
                          >
                            <Shield className="w-2.5 h-2.5 text-emerald-300 fill-emerald-400/30" />
                            <span className="text-[8px] font-black">Legacy [{golemDeathShieldTurns}t]</span>
                          </div>
                        )}

                        {trojanShieldPoints > 0 && (mon.id === 'trojan_flare' || mon.avatarSeed === 'trojan_flare') && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-950 border border-amber-400 text-amber-300 animate-pulse shadow"
                            title={`Tactical Decoy: ${trojanShieldPoints} Shield (+10% ATK & Piercing active)`}
                          >
                            <Shield className="w-2.5 h-2.5 text-amber-400 fill-amber-400/40" />
                            <span className="text-[8px] font-black">Shield: {trojanShieldPoints}</span>
                          </div>
                        )}

                        {bubbleboonDoubleStrikeTurns > 0 && (mon.id === 'bubbleboon' || mon.avatarSeed === 'bubbleboon') && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-cyan-950 border border-cyan-400 text-cyan-300 animate-pulse shadow"
                            title="Double Strike: 2 consecutive orb switches"
                          >
                            <Zap className="w-2.5 h-2.5 text-cyan-400" />
                            <span className="text-[8px] font-black">Double Strike</span>
                          </div>
                        )}

                        {((mon.id === 'bubbleboon' || mon.avatarSeed === 'bubbleboon') || ((mon.id === 'trojan_flare' || mon.avatarSeed === 'trojan_flare') && trojanCurrentResonance)) && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-indigo-950 border border-indigo-400 text-indigo-300 shadow"
                            title="Resonance: Grants the Starmon an immediate continuation of action. Using an active ability does not consume the current turn's orb-switches, allowing the Starmon to continue moving orbs as if no skill was used in this step."
                          >
                            <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                            <span className="text-[8px] font-black">Resonance</span>
                          </div>
                        )}

                        {trojanHasClarity && (mon.id === 'trojan_flare' || mon.avatarSeed === 'trojan_flare') && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-emerald-950 border border-emerald-400 text-emerald-300 shadow"
                            title="Clarity: Immune to stun, frostbite, burn, poison"
                          >
                            <Shield className="w-2.5 h-2.5 text-emerald-400" />
                            <span className="text-[8px] font-black">Clarity</span>
                          </div>
                        )}

                        {(playerHealingBlockTurns[idx] || 0) > 0 && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-rose-950 border border-rose-500 text-rose-300 shadow animate-pulse"
                            title={`Healing Block: Prevents all HP regeneration (${playerHealingBlockTurns[idx]} turns left)`}
                          >
                            <span className="text-[10px]">🚫</span>
                            <span className="text-[8px] font-black">Heal Block [{playerHealingBlockTurns[idx]}t]</span>
                          </div>
                        )}

                        {(mon.id === 'mossloth' || mon.avatarSeed === 'mossloth') && playerMosslothTauntTurns > 0 && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-emerald-950 border border-emerald-400 text-emerald-300 animate-pulse shadow"
                            title={`Sluggish Metabolism: Taunting enemies & healing 15% Max HP/turn (${playerMosslothTauntTurns} turns left)`}
                          >
                            <Crosshair className="w-3 h-3 text-emerald-300" />
                            <span className="text-[8px] font-black">Taunt+Regen [{playerMosslothTauntTurns}t]</span>
                          </div>
                        )}

                        {(mon.id === 'mossloth' || mon.avatarSeed === 'mossloth') && mon.currentHp < mon.maxHp * 0.5 && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-lime-950 border border-lime-400 text-lime-300 shadow"
                            title="Mossy Camouflage: 20% chance to dodge attacks when below 50% HP"
                          >
                            <span className="text-[10px]">🍃</span>
                            <span className="text-[8px] font-black">Camouflage (20% Dodge)</span>
                          </div>
                        )}

                        {(mon.id === 'khepri' || mon.avatarSeed === 'khepri') && playerKhepriShroudTurns > 0 && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-950 border border-amber-400 text-amber-300 animate-pulse shadow"
                            title="Desert Shroud: 30% Evasiveness for 1 turn"
                          >
                            <span className="text-[10px]">🏜️</span>
                            <span className="text-[8px] font-black">Shroud (30% Evasion)</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Inspection Button to view Passive, Level, and Base Stats */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            sound.playClick();
                            const orig = getOriginalBaseStats(mon);
                            setInspectingStarmon({
                              mon,
                              isEnemy: false,
                              monIndex: idx,
                              originalBase: orig,
                            });
                          }}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 cursor-pointer text-[9px] font-bold flex items-center gap-0.5 border border-slate-700 shadow"
                          title="Click to view Passive, Level & Base Stats"
                        >
                          <Info className="w-2.5 h-2.5" />
                          <span>Stats</span>
                        </button>

                        {isCurrentAttacker ? (
                          <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-amber-400 text-slate-950 animate-pulse">
                            ▶ ACTIVE TURN
                          </span>
                        ) : isMissed ? (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800">
                            MISSED (Q{idx + 1})
                          </span>
                        ) : isDead ? (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-950 text-slate-500">
                            KO
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-slate-400">
                            Turn {idx + 1}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Unit Info Row */}
                    <div className="flex items-center gap-2">
                      <div
                        onClick={() => {
                          sound.playClick();
                          const orig = getOriginalBaseStats(mon);
                          setInspectingStarmon({
                            mon,
                            isEnemy: false,
                            monIndex: idx,
                            originalBase: orig,
                          });
                        }}
                        className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 relative cursor-pointer group hover:border-cyan-400 transition-all"
                        title="Click to view Passive, Level & Base Stats"
                      >
                        <StarmonAsset
                          id={mon.avatarSeed}
                          size="sm"
                          isDaPhucVersion={mon.isDaPhucVersion || mon.equippedItems?.includes('da_phuc_uniform')}
                        />
                        {hasTideBuff && (
                          <div className="absolute inset-0 rounded-xl border border-cyan-400 animate-ping opacity-30 pointer-events-none" />
                        )}
                        {hasTeamShield && (
                          <div className="absolute inset-0 rounded-xl border-2 border-indigo-400 opacity-60 pointer-events-none" />
                        )}
                        <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[8px] font-bold text-cyan-300 transition-opacity">
                          View
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span
                            onClick={() => {
                              sound.playClick();
                              const orig = getOriginalBaseStats(mon);
                              setInspectingStarmon({
                                mon,
                                isEnemy: false,
                                monIndex: idx,
                                originalBase: orig,
                              });
                            }}
                            className="text-xs font-black font-game text-white truncate cursor-pointer hover:text-cyan-300 transition-colors"
                            title="Click to view Passive, Level & Base Stats"
                          >
                            {mon.name}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className={`text-[9px] px-1 rounded font-bold ${ELEMENT_COLORS[mon.element]?.bg || 'bg-sky-500'} text-slate-950`}>
                              {mon.element}
                            </span>
                            {mon.secondaryElement && (
                              <span className={`text-[9px] px-1 rounded font-bold ${ELEMENT_COLORS[mon.secondaryElement]?.bg || 'bg-slate-400'} text-slate-950`}>
                                {mon.secondaryElement === 'Metal' ? (mon.id === 'moltenback' ? 'Steel' : 'Metal') : mon.secondaryElement}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* HP Bar */}
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mt-1">
                          <div
                            className="h-full bg-rose-500 transition-all duration-300"
                            style={{ width: `${Math.max(0, (mon.currentHp / mon.maxHp) * 100)}%` }}
                          />
                        </div>
                        {/* Stats Row: HP on left, ATK and DEF stacked on right */}
                        <div className="flex justify-between items-center text-[9px] text-slate-400 mt-0.5">
                          <span>HP: {mon.currentHp}/{mon.maxHp}</span>
                          <div className="flex flex-col items-end leading-tight">
                            <span className="font-bold text-amber-300">
                              ATK: {(playerFrostbiteTurns[idx] || 0) > 0 ? Math.round(mon.baseAtk * 0.9) : mon.baseAtk}
                              {(playerFrostbiteTurns[idx] || 0) > 0 && <span className="text-[7px] text-cyan-300 ml-0.5">(-10%)</span>}
                            </span>
                            <span className="font-bold text-sky-300">
                              DEF: {mon.def ?? 20}
                              {playerDefDebuffs[idx] && <span className="text-[7px] text-rose-300 ml-0.5">(-{(playerDefDebuffs[idx].percent * 100).toFixed(0)}%)</span>}
                            </span>
                          </div>
                        </div>
                        {/* Mana Bar (Max 200) */}
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mt-1">
                          <div
                            className="h-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-300"
                            style={{ width: `${Math.min(100, (mon.currentMana / 200) * 100)}%` }}
                          />
                        </div>
                        <div className="text-[9px] text-sky-300 font-mono text-right mt-0.5">
                          Mana: {mon.currentMana} / 200
                        </div>
                      </div>
                    </div>

                    {/* ABILITIES WITH DETAIL INSPECTION & ARROW ACTIVATION BUTTON */}
                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight flex items-center justify-between">
                        <span>Abilities (Tap to inspect & activate):</span>
                        {isCurrentAttacker && (
                          <span className="text-amber-300 font-black animate-pulse">Ready to act!</span>
                        )}
                      </span>

                      <div className="grid grid-cols-2 gap-1.5">
                        {/* Ability 1 Button */}
                        <div
                          id={idx === 0 ? "tutorial-starmon-skill-1" : undefined}
                          className="flex items-stretch rounded-xl border border-indigo-400/60 overflow-hidden bg-slate-950/70 hover:border-indigo-300 transition-all"
                        >
                          <button
                            onClick={() => {
                              sound.playClick();
                              setSelectedAbilityDetail({ mon, monIndex: idx, skillNum: 1 });
                            }}
                            className="flex-1 p-1.5 text-left flex flex-col justify-between cursor-pointer min-w-0"
                            title="Click to inspect ability details"
                          >
                            <span className="text-[10px] font-black font-game text-cyan-300 truncate">
                              ⚡ {mon.skill1.name}
                            </span>
                            <span className="text-[8px] text-slate-300 font-mono">
                              Cost: {mon.skill1.manaCost} Ma
                            </span>
                          </button>

                          {/* Arrow Head Button to Activate */}
                          {isCurrentAttacker && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCastAbility(1);
                              }}
                              disabled={mon.currentMana < mon.skill1.manaCost}
                              className={`w-7 flex items-center justify-center border-l transition-all cursor-pointer ${
                                mon.currentMana >= mon.skill1.manaCost
                                  ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white active:scale-90 shadow'
                                  : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                              }`}
                              title="Click arrow to activate Ability 1 immediately"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                          )}
                        </div>

                        {/* Ability 2 Button */}
                        <div className={`flex items-stretch rounded-xl border overflow-hidden transition-all ${
                          isTideOnCooldown
                            ? 'bg-slate-950/40 border-slate-800 opacity-60'
                            : 'bg-slate-950/70 border-purple-400/60 hover:border-purple-300'
                        }`}>
                          <button
                            onClick={() => {
                              sound.playClick();
                              setSelectedAbilityDetail({ mon, monIndex: idx, skillNum: 2 });
                            }}
                            className="flex-1 p-1.5 text-left flex flex-col justify-between cursor-pointer min-w-0"
                            title="Click to inspect ability details"
                          >
                            <span className="text-[10px] font-black font-game text-amber-300 truncate">
                              {isTidecrush ? '🌊 Tidal Surge' : `💥 ${mon.skill2.name}`}
                            </span>
                            <span className="text-[8px] text-amber-200/90 font-mono truncate">
                              {isTideOnCooldown
                                ? `⏳ CD: ${tidecrushCooldownTurns}t`
                                : isTidecrush
                                ? `All Ma → ATK (3t)`
                                : `${mon.skill2.manaCost} Ma`}
                            </span>
                          </button>

                          {/* Arrow Head Button to Activate */}
                          {isCurrentAttacker && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCastAbility(2);
                              }}
                              disabled={isTideOnCooldown || (mon.currentMana < mon.skill2.manaCost && !isTidecrush)}
                              className={`w-7 flex items-center justify-center border-l transition-all cursor-pointer ${
                                !isTideOnCooldown && (isTidecrush || mon.currentMana >= mon.skill2.manaCost)
                                  ? 'bg-purple-600 hover:bg-purple-500 border-purple-400 text-white active:scale-90 shadow'
                                  : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                              }`}
                              title={isTideOnCooldown ? `On Cooldown (${tidecrushCooldownTurns} turns)` : "Click arrow to activate Ability 2 immediately"}
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ======================================================== */}
            {/* CENTER: BIG 8x8 MATCH-3 BOARD (AI OPONENT MOVES ORBS HERE TOO) */}
            {/* ======================================================== */}
            <div className="flex-1 flex flex-col items-center justify-center h-full px-1 md:px-2 relative">
              {sunEffectTurns > 0 && (
                <div className="mb-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500/25 via-orange-500/35 to-yellow-500/25 border border-amber-400 text-amber-300 font-game font-black text-xs flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.45)] animate-pulse">
                  <span>☀️</span>
                  <span>Ritual of the Sun [{sunEffectTurns}t]: Fire +20% | Water -20% | Khepri ATK +20%</span>
                  <span>☀️</span>
                </div>
              )}
              <div id="tutorial-match-grid" className="relative bg-slate-950 border-4 border-slate-700 rounded-3xl p-3 shadow-2xl">
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-lg font-black font-game text-xs tracking-wider shadow whitespace-nowrap transition-all ${
                  isPvP
                    ? !isMyTurnInPvP
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white animate-pulse'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black'
                    : turnStatusType === 'enemy'
                    ? 'bg-gradient-to-r from-purple-600 to-rose-600 text-white animate-pulse'
                    : 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950'
                }`}>
                  {isPvP
                    ? (turnAnnouncement ||
                        `Đến Lượt ${pvpCurrentTurnPlayerName || 'Đối thủ'}'s ${playerTeam[actingStepIndex]?.name || 'Starmon'}`)
                    : turnStatusType === 'enemy'
                    ? 'OPPONENT MATCH-3 & ABILITY PHASE'
                    : 'SWAP MATCH-3 ORBS (+5 MANA / ORB)'}
                </div>

                <div
                  className="grid gap-1.5 md:gap-2 select-none"
                  style={{
                    gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
                    width: 'min(64vh, 560px)',
                    height: 'min(64vh, 560px)',
                  }}
                >
                  {board.length === 0 ? (
                    <div className="col-span-8 flex flex-col items-center justify-center h-full text-slate-400 font-bold animate-pulse text-xs gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                      <span>Đang kết nối bàn cờ chung từ server...</span>
                    </div>
                  ) : (() => {
                    const tutorialMove = (tutorialStage === 1 && board.length > 0)
                      ? (findValidTutorialMatchMove(board, 'Electric') || findValidTutorialMatchMove(board, 'Water') || findValidTutorialMatchMove(board, 'Fire') || findValidTutorialMatchMove(board, 'Wind') || findValidTutorialMatchMove(board, 'Earth') || findValidTutorialMatchMove(board, 'Metal'))
                      : null;

                    return board.map((row, r) =>
                      row.map((tile, c) => {
                        if (!tile) return <div key={`${r}-${c}`} className="rounded-xl md:rounded-2xl" />;
                        const isSelected = selectedTile?.row === r && selectedTile?.col === c;
                        const isAiSelected = aiHighlightedTiles?.some(t => t.row === r && t.col === c);
                        const isTutorialOrb1 = tutorialStage === 1 && tutorialMove && tutorialMove.r1 === r && tutorialMove.c1 === c;
                        const isTutorialOrb2 = tutorialStage === 1 && tutorialMove && tutorialMove.r2 === r && tutorialMove.c2 === c;
                        const isTutorialOrb = isTutorialOrb1 || isTutorialOrb2;

                        return (
                          <div
                            key={tile.id}
                            id={isTutorialOrb1 ? "tutorial-swap-orb-1" : isTutorialOrb2 ? "tutorial-swap-orb-2" : undefined}
                            onClick={() => handleTileClick(r, c)}
                            className={`rounded-xl md:rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-150 transform hover:scale-105 active:scale-90 border-2 select-none relative ${
                              tile.element === 'Fire'
                                ? 'bg-gradient-to-b from-rose-500 to-rose-700 border-rose-400 shadow-rose-900/50'
                                : tile.element === 'Water'
                                ? 'bg-gradient-to-b from-sky-400 to-blue-700 border-sky-300 shadow-blue-900/50'
                                : tile.element === 'Electric'
                                ? 'bg-gradient-to-b from-amber-300 to-yellow-600 border-amber-200 shadow-amber-900/50'
                                : tile.element === 'Wind'
                                ? 'bg-gradient-to-b from-teal-400 to-teal-700 border-teal-300 shadow-teal-900/50'
                                : tile.element === 'Earth'
                                ? 'bg-gradient-to-b from-amber-700 to-amber-900 border-amber-500 shadow-amber-950/50'
                                : 'bg-gradient-to-b from-slate-400 to-slate-700 border-slate-300 shadow-slate-900/50'
                            } ${
                              isAiSelected
                                ? 'ring-4 ring-rose-500 scale-110 shadow-2xl z-20 animate-pulse border-rose-300'
                                : isSelected
                                ? 'ring-4 ring-white scale-110 shadow-2xl z-10 animate-pulse'
                                : isTutorialOrb && !tutorialHasSwappedOrbs
                                ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-950 scale-110 z-20 shadow-2xl animate-pulse border-amber-300'
                                : 'shadow-md shadow-black/70'
                            }`}
                          >
                            {orbIcons[tile.element]}

                            {/* Tutorial Swap Indicator Badge */}
                            {isTutorialOrb && !tutorialHasSwappedOrbs && (
                              <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-950 text-[8px] font-black px-1.5 py-0.2 rounded-full border border-slate-900 animate-bounce shadow">
                                SWAP
                              </span>
                            )}

                            {/* AI Opponent cursor tag */}
                            {isAiSelected && (
                              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full border border-white animate-bounce shadow">
                                AI
                              </span>
                            )}
                          </div>
                        );
                      })
                    );
                  })()}
                </div>
              </div>

              {/* ABILITY DETAIL MODAL POPOVER WITH ARROW ACTIVATION BUTTON */}
              {selectedAbilityDetail && (
                <div className="absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-150">
                  {(() => {
                    const { mon, monIndex, skillNum } = selectedAbilityDetail;
                    const skill = skillNum === 1 ? mon.skill1 : mon.skill2;
                    const isTidecrush = mon.id === 'tidecrush';
                    const isTideSkill2 = isTidecrush && skillNum === 2;
                    const isTrojanSkill1 = (mon.id === 'trojan_flare' || mon.avatarSeed === 'trojan_flare') && skillNum === 1;
                    const isActing = isPvP
                      ? (isMyTurnInPvP && pvpActionMenu?.starmonIndex === monIndex && mon.currentHp > 0)
                      : (actingStepIndex === monIndex && unlockedPositions[monIndex] && mon.currentHp > 0);
                    const hasMana = isTideSkill2 || isTrojanSkill1 ? true : mon.currentMana >= skill.manaCost;
                    const isTrojanOnCooldown = isTrojanSkill1 && trojanCooldownTurns > 0;
                    const isOnCooldown = (isTideSkill2 && tidecrushCooldownTurns > 0) || isTrojanOnCooldown;
                    const canActivate = isActing && hasMana && !isOnCooldown;

                    return (
                      <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-3 relative text-slate-100">
                        <button
                          onClick={() => setSelectedAbilityDetail(null)}
                          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center shrink-0">
                            <StarmonAsset
                              id={mon.avatarSeed}
                              size="sm"
                              isDaPhucVersion={mon.isDaPhucVersion || mon.equippedItems?.includes('da_phuc_uniform')}
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                              {mon.name} · Ability #{skillNum}
                            </span>
                            <h3 className="text-base font-black font-game text-amber-300 mt-0.5">
                              {skill.name}
                            </h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400">Mana Cost</span>
                            <p className="font-bold font-mono text-cyan-300">
                              {isTideSkill2 ? 'All Mana' : `${skill.manaCost} Ma`}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400">Duration</span>
                            <p className="font-bold text-amber-300">
                              {isTideSkill2 ? '3 Turns' : 'Instant'}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400">Cooldown</span>
                            <p className="font-bold text-emerald-400">
                              {isTideSkill2 ? (tidecrushCooldownTurns > 0 ? `${tidecrushCooldownTurns}t left` : '3 Turns') : '0 Turns'}
                            </p>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed">
                          <p className="font-bold text-amber-300 mb-1 flex items-center gap-1">
                            <Info className="w-3.5 h-3.5" />
                            <span>Detailed Skill Effect:</span>
                          </p>
                          {isTideSkill2 ? (
                            <p>
                              Converts all current Mana ({mon.currentMana} Mana) into bonus Attack stat: <strong>1 Mana = +0.2% Base Attack</strong> (+{(mon.currentMana * 0.2).toFixed(1)}% ATK). 
                              <br /><span className="text-cyan-300">Lasts for 3 turns</span> with a <span className="text-rose-300">3-turn cooldown</span> (cannot be reused for 3 turns). <strong>Deals 0 direct damage</strong>.
                            </p>
                          ) : (
                            <p>
                              {skill.description || `Strikes the selected enemy target dealing ${Math.round(skill.damageMultiplier * 100)}% elemental damage.`}
                            </p>
                          )}
                        </div>

                        {/* ACTIVATION BUTTON WITH ARROW HEAD */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                          <button
                            onClick={() => setSelectedAbilityDetail(null)}
                            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-xs text-slate-300 cursor-pointer"
                          >
                            Close
                          </button>

                          <button
                            id="tutorial-cast-ability-btn"
                            onClick={() => handleCastAbility(skillNum)}
                            disabled={!canActivate}
                            className={`flex-1 py-2.5 px-4 rounded-xl font-black font-game text-xs flex items-center justify-center gap-2 transition-all ${
                              canActivate
                                ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-400/30 hover:scale-102 active:scale-95 cursor-pointer'
                                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                            }`}
                          >
                            <span>
                              {canActivate
                                ? 'CAST ABILITY NOW'
                                : mon.currentHp <= 0
                                ? 'STARMON HAS FAINTED (KO)'
                                : !isActing
                                ? 'NOT THIS STARMON\'S TURN'
                                : isOnCooldown
                                ? `ON COOLDOWN (${tidecrushCooldownTurns} TURNS)`
                                : 'NOT ENOUGH MANA'}
                            </span>
                            <Play className={`w-4 h-4 fill-current ${canActivate ? 'animate-pulse' : ''}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* ======================================================== */}
            {/* OPPONENT UNITS COLUMN (Slot 1 = LEFT, Slot 2 = RIGHT) */}
            {/* ======================================================== */}
            <div id="tutorial-enemy-team" className={`w-64 md:w-72 flex flex-col gap-2 shrink-0 h-full justify-center overflow-y-auto pl-1 rounded-2xl transition-all ${
              isPvP && pvpHighlightedAttackerSlot !== null && pvpHighlightedAttackerSlot !== pvpMySlot
                ? 'ring-2 ring-amber-400/60 bg-amber-950/10 p-1'
                : isPvP && pvpHighlightedTargetSlot !== null && pvpHighlightedTargetSlot !== pvpMySlot
                ? 'ring-2 ring-rose-500/50 bg-rose-950/10 p-1'
                : ''
            }`}>
              <span className={`text-[11px] font-black text-rose-400 tracking-wider uppercase px-1 ${
                isPvP && pvpMySlot === 2 ? 'text-left' : 'text-right'
              }`}>
                {isPvP ? `Đội đối thủ (P${pvpMySlot === 1 ? '2 · PHẢI' : '1 · TRÁI'} · ${pvpRoomInfo?.opponentName || 'Đối thủ'})` : 'Enemy Team (Opponent Acts Like Player)'}
              </span>

              {enemyTeam.map((enemy, idx) => {
                const isDead = enemy.currentHp <= 0;
                const isTarget = selectedEnemyIndex === idx && !isDead;
                const isEnemyAttacking = activeEnemyAttackerIndex === idx && !isDead;
                const isEnemyLostTurn = isPvP && pvpLostTurnEffect?.attackerSlot !== pvpMySlot && pvpLostTurnEffect?.starmonIndex === idx;

                return (
                  <div
                    key={enemy.id}
                    onClick={() => {
                      if (!isDead) {
                        if (isPvP && pvpActionMenu && !pvpActionMenu.validTargets.includes(idx)) return;
                        sound.playClick();
                        setSelectedEnemyIndex(idx);
                      }
                    }}
                    className={`p-2.5 rounded-2xl border-2 transition-all relative ${
                      isEnemyLostTurn
                        ? 'bg-rose-950/90 border-rose-500 shadow-xl shadow-rose-500/40 ring-2 ring-rose-400 animate-pulse'
                        : isEnemyAttacking
                        ? 'bg-gradient-to-l from-rose-950 via-purple-950 to-slate-900 border-purple-400 shadow-xl shadow-purple-500/30 ring-2 ring-purple-300'
                        : isTarget
                        ? 'bg-gradient-to-l from-rose-950 via-slate-900 to-slate-900 border-rose-500 shadow-xl shadow-rose-500/25 ring-2 ring-rose-400'
                        : isDead
                        ? 'bg-slate-950/60 border-slate-800 opacity-40 grayscale cursor-not-allowed pointer-events-none'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 cursor-pointer'
                    }`}
                  >
                    {isEnemyLostTurn && (
                      <div className="absolute inset-0 z-20 rounded-2xl bg-rose-950/85 backdrop-blur-[1px] flex items-center justify-center pointer-events-none animate-in fade-in duration-150">
                        <span className="px-3 py-1 rounded-xl bg-rose-600 text-white font-black font-game text-xs border-2 border-rose-300 shadow-lg">
                          {pvpLostTurnEffect?.reason === 'timeout' ? '⏱️ HẾT 30s — MẤT LƯỢT!' : '❌ TRẢ LỜI SAI — MẤT LƯỢT!'}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black font-game px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          Enemy #{idx + 1}
                        </span>

                        {/* REAL ACTIVE STATUS, BUFF & DEBUFF ICONS ON OPPONENTS */}
                        {(enemyFrostbiteTurns[idx] || 0) > 0 && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-cyan-950 border border-cyan-400 text-cyan-300 shadow"
                            title={`Frostbite: Reduces Attack by 10% (${enemyFrostbiteTurns[idx]} turns left)`}
                          >
                            <span className="text-[10px]">❄️</span>
                            <span className="text-[8px] font-black">Frostbite [{enemyFrostbiteTurns[idx]}t]</span>
                          </div>
                        )}

                        {(enemySilenceTurns[idx] || 0) > 0 && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-purple-950 border border-purple-400 text-purple-300 shadow"
                            title={`Silenced: Cannot cast Active Abilities (${enemySilenceTurns[idx]} turns left)`}
                          >
                            <span className="text-[10px]">🔇</span>
                            <span className="text-[8px] font-black">Silence [{enemySilenceTurns[idx]}t]</span>
                          </div>
                        )}

                        {stunnedEnemyIndices.includes(idx) && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-950 border border-amber-400 text-amber-300 animate-pulse shadow"
                            title="Stunned: Skips next action"
                          >
                            <span className="text-[10px]">💫</span>
                            <span className="text-[8px] font-black">STUNNED</span>
                          </div>
                        )}

                        {enemyDefDebuffs[idx] && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-rose-950 border border-rose-500 text-rose-300 shadow"
                            title={`DEF Reduced by ${(enemyDefDebuffs[idx].percent * 100).toFixed(0)}% (${enemyDefDebuffs[idx].turns}t)`}
                          >
                            <Shield className="w-2.5 h-2.5 text-rose-400" />
                            <span className="text-[8px] font-black">DEF -{(enemyDefDebuffs[idx].percent * 100).toFixed(0)}% [{enemyDefDebuffs[idx].turns}t]</span>
                          </div>
                        )}

                        {enemyStoneGolemTauntTurns > 0 && (enemy.id === 'enemy_golem' || enemy.avatarSeed === 'stone_golem') && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-950 border border-amber-400 text-amber-300 animate-pulse shadow"
                            title="Taunt Active: Absorbs incoming single-target attacks"
                          >
                            <Crosshair className="w-2.5 h-2.5 text-amber-300" />
                            <span className="text-[8px] font-black">TAUNT [{enemyStoneGolemTauntTurns}t]</span>
                          </div>
                        )}

                        {(enemyHealingBlockTurns[idx] || 0) > 0 && (
                          <div
                            className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-rose-950 border border-rose-500 text-rose-300 shadow animate-pulse"
                            title={`Healing Block: Prevents HP regeneration from all sources (${enemyHealingBlockTurns[idx]} turns left)`}
                          >
                            <span className="text-[10px]">🚫</span>
                            <span className="text-[8px] font-black">Heal Block [{enemyHealingBlockTurns[idx]}t]</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Inspection Button for Enemy Starmon */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            sound.playClick();
                            const orig = getOriginalBaseStats(enemy);
                            setInspectingStarmon({
                              mon: enemy,
                              isEnemy: true,
                              monIndex: idx,
                              originalBase: orig,
                            });
                          }}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 cursor-pointer text-[9px] font-bold flex items-center gap-0.5 border border-slate-700 shadow"
                          title="Click to view Passive, Level & Base Stats"
                        >
                          <Info className="w-2.5 h-2.5" />
                          <span>Stats</span>
                        </button>

                        {isEnemyAttacking ? (
                          <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-purple-500 text-white flex items-center gap-1 animate-pulse shadow">
                            <Bot className="w-3.5 h-3.5" />
                            ACTING
                          </span>
                        ) : isTarget ? (
                          <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-rose-500 text-white flex items-center gap-1 animate-pulse shadow">
                            <Crosshair className="w-3.5 h-3.5" />
                            TARGETED
                          </span>
                        ) : isDead ? (
                          <span className="text-[9px] font-black text-rose-500">DEFEATED</span>
                        ) : (
                          <span className="text-[9px] text-slate-500">Click to Target</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          sound.playClick();
                          const orig = getOriginalBaseStats(enemy);
                          setInspectingStarmon({
                            mon: enemy,
                            isEnemy: true,
                            monIndex: idx,
                            originalBase: orig,
                          });
                        }}
                        className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 cursor-pointer group hover:border-cyan-400 transition-all relative"
                        title="Click to view Passive, Level & Base Stats"
                      >
                        <StarmonAsset id={enemy.avatarSeed} size="sm" />
                        <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[8px] font-bold text-cyan-300 transition-opacity">
                          View
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              sound.playClick();
                              const orig = getOriginalBaseStats(enemy);
                              setInspectingStarmon({
                                mon: enemy,
                                isEnemy: true,
                                monIndex: idx,
                                originalBase: orig,
                              });
                            }}
                            className="text-xs font-black font-game text-white truncate cursor-pointer hover:text-cyan-300 transition-colors"
                            title="Click to view Passive, Level & Base Stats"
                          >
                            {enemy.name}
                          </span>
                          <div className="flex items-center gap-1">
                            <span className={`text-[9px] px-1 rounded font-bold ${ELEMENT_COLORS[enemy.element]?.bg || 'bg-rose-500'} text-slate-950`}>
                              {enemy.element}
                            </span>
                            {enemy.secondaryElement && (
                              <span className={`text-[9px] px-1 rounded font-bold ${ELEMENT_COLORS[enemy.secondaryElement]?.bg || 'bg-slate-400'} text-slate-950`}>
                                {enemy.secondaryElement === 'Metal' ? (enemy.id === 'moltenback' ? 'Steel' : 'Metal') : enemy.secondaryElement}
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          id={idx === 0 ? "tutorial-enemy-hp-0" : undefined}
                          className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mt-1"
                        >
                          <div
                            className="h-full bg-rose-500 transition-all duration-300"
                            style={{ width: `${Math.max(0, (enemy.currentHp / enemy.maxHp) * 100)}%` }}
                          />
                        </div>
                        {/* Stats Row: HP on left, ATK and DEF stacked on right */}
                        <div className="flex justify-between items-center text-[9px] text-slate-400 mt-0.5">
                          <span>HP: {enemy.currentHp}/{enemy.maxHp}</span>
                          <div className="flex flex-col items-end leading-tight">
                            <span className="font-bold text-amber-300">
                              ATK: {(enemyFrostbiteTurns[idx] || 0) > 0 ? Math.round(enemy.baseAtk * 0.9) : enemy.baseAtk}
                              {(enemyFrostbiteTurns[idx] || 0) > 0 && <span className="text-[7px] text-cyan-300 ml-0.5">(-10%)</span>}
                            </span>
                            <span className="font-bold text-sky-300">
                              DEF: {enemy.def ?? 20}
                              {enemyDefDebuffs[idx] && <span className="text-[7px] text-rose-300 ml-0.5">(-{(enemyDefDebuffs[idx].percent * 100).toFixed(0)}%)</span>}
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 mt-1">
                          <div
                            className="h-full bg-sky-400 transition-all duration-300"
                            style={{ width: `${Math.min(100, (enemy.currentMana / 200) * 100)}%` }}
                          />
                        </div>
                        <div className="text-[9px] text-sky-400 font-mono text-right mt-0.5">
                          Mana: {enemy.currentMana}/200
                        </div>
                      </div>
                    </div>

                    {/* Enemy Available Skills Bar */}
                    <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-400">
                      <span className="truncate">⚡ {enemy.skill1?.name || 'Tấn công'} ({enemy.skill1?.manaCost || 20} Ma)</span>
                      <span className="truncate">💥 {enemy.skill2?.name || 'Kỹ năng'} ({enemy.skill2?.manaCost || 40} Ma)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BOTTOM ELEMENTAL WHEEL & COUNTERS BAR */}
          <div
            id="tutorial-elemental-wheel"
            className="w-full mt-1 px-3 py-1 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 z-10"
          >
            {/* 6 Elements Cycle */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold py-0.5">
              <span className="text-amber-300 font-game text-[10px] uppercase shrink-0">Counter Cycle:</span>
              <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-600/40 shrink-0">Water 💧</span>
              <span className="text-slate-500">➔</span>
              <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-600/40 shrink-0">Fire 🔥</span>
              <span className="text-slate-500">➔</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-600/40 shrink-0">Metal 🛡️</span>
              <span className="text-slate-500">➔</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600/40 shrink-0">Earth 🪨</span>
              <span className="text-slate-500">➔</span>
              <span className="px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-600/40 shrink-0">Wind 🌪️</span>
              <span className="text-slate-500">➔</span>
              <span className="px-1.5 py-0.5 rounded bg-yellow-950 text-yellow-300 border border-yellow-600/40 shrink-0">Electric ⚡</span>
              <span className="text-slate-500">➔</span>
              <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-600/40 shrink-0">Water 💧</span>
            </div>

            {/* Live Counter & Resistance Status Badges for Current Active Unit */}
            {activeAttackingStarmon && enemyTeam[selectedEnemyIndex] && (
              <div className="flex items-center gap-2 shrink-0">
                {/* Counter Arrow Indicator */}
                <div
                  id="tutorial-counter-arrow"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-black ${
                    ELEMENT_COUNTERS[activeAttackingStarmon.element] === enemyTeam[selectedEnemyIndex].element
                      ? 'bg-emerald-950 border-emerald-400 text-emerald-300 animate-pulse'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                  title="Counter: Deals +10% damage"
                >
                  <ArrowRight className="w-3 h-3" />
                  <span>COUNTER (+10% DMG)</span>
                </div>

                {/* Resistance Badge Indicator */}
                <div
                  id="tutorial-resist-badge"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-black ${
                    ELEMENT_COUNTERS[enemyTeam[selectedEnemyIndex].element] === activeAttackingStarmon.element
                      ? 'bg-rose-950 border-rose-400 text-rose-300 animate-pulse'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                  title="Resisted: Deals -10% damage"
                >
                  <Shield className="w-3 h-3" />
                  <span>RESIST (-10% DMG)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VICTORY MODAL WITH INTERACTIVE CHEST & BATTLE PERFORMANCE SUMMARY */}
      {phase === 'victory' && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200 overflow-y-auto">
          {victoryViewTab === 'performance' ? (
            <div className="max-w-xl w-full my-auto animate-in zoom-in-95 duration-200">
              <BattlePerformanceSummary
                stats={performanceStats}
                playerTeamMetrics={playerTeam.map((m, idx) => ({
                  id: m.id,
                  name: m.name,
                  element: m.element,
                  avatarSeed: m.avatarSeed,
                  damageDealt: playerDmgDealt[idx] || 0,
                  damageTaken: playerDmgTaken[idx] || 0,
                }))}
                enemyTeamMetrics={enemyTeam.map((m, idx) => ({
                  id: m.id,
                  name: m.name,
                  element: m.element,
                  avatarSeed: m.avatarSeed,
                  damageDealt: enemyDmgDealt[idx] || 0,
                  damageTaken: enemyDmgTaken[idx] || 0,
                }))}
                enemyDamagePerElement={enemyDamagePerElement}
                onClose={() => setVictoryViewTab('rewards')}
                onReturnToHub={() =>
                  onExitBattle('win', chestRewards ? {
                    gold: chestRewards.gold,
                    cards: chestRewards.cards,
                    cardStarmonId: chestRewards.starmon.id,
                    exp: 100,
                  } : {
                    gold: 250,
                    cards: 5,
                    exp: 100,
                  })
                }
              />
            </div>
          ) : (
            <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl p-5 md:p-7 max-w-lg w-full text-center shadow-2xl flex flex-col items-center relative overflow-hidden my-auto">
              {/* Background Halo */}
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

              {/* Victory Header Switcher Tabs */}
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-slate-800 mb-3 relative z-10">
                <button
                  onClick={() => {
                    sound.playClick();
                    setVictoryViewTab('rewards');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    victoryViewTab === 'rewards'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>Spoils & Loot</span>
                </button>

                <button
                  onClick={() => {
                    sound.playClick();
                    setVictoryViewTab('performance');
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-white"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Performance Summary</span>
                </button>
              </div>

              {tutorialStage === 1 ? (
                /* TUTORIAL 1 COMPLETE DEDICATED VIEW */
                <div className="flex flex-col items-center my-1 relative z-10 w-full animate-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
                    <h2 className="text-2xl md:text-3xl font-black font-game text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-100">
                      Xin chúc mừng! Bạn đã hoàn thành Hướng dẫn 1.
                    </h2>
                  </div>
                  <p className="text-xs text-amber-200 font-bold mb-3 max-w-sm text-center leading-relaxed">
                    🎉 Chúc mừng bạn đã hoàn thành xuất sắc Hướng dẫn 1: Trắc nghiệm (MCQ), Ghép ngọc 8x8 & IELTS Speaking!
                  </p>

                  {/* 1000 Gold Reward Display Box */}
                  <div className="w-full max-w-sm bg-gradient-to-b from-amber-950/70 via-slate-900 to-slate-950 border-2 border-amber-400 rounded-3xl p-5 shadow-2xl flex flex-col items-center my-2 relative overflow-hidden">
                    <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400/60 flex items-center justify-center text-5xl mb-2 animate-pulse shadow-lg shadow-amber-500/20">
                      <img src={GOLD_IMAGE} alt="Gold" className="h-12 w-12 object-contain" />
                    </div>
                    <span className="text-[11px] font-black text-amber-300 uppercase tracking-widest">
                      Phần thưởng hoàn thành Hướng dẫn 1
                    </span>
                    <span className="text-3xl md:text-4xl font-black font-game text-amber-300 font-mono my-1 tracking-tight">
                      {hasClaimedTutorialReward ? '0 VÀNG' : '+1,000 VÀNG'}
                    </span>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold mt-2 ${
                      hasClaimedTutorialReward
                        ? 'bg-slate-800 border-slate-600 text-slate-300'
                        : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    }`}>
                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${hasClaimedTutorialReward ? 'text-slate-400' : 'text-emerald-400'}`} />
                      <span>{hasClaimedTutorialReward ? 'Đã hoàn thành trước đó (Không nhận lại thưởng)' : 'Đã nhận 1,000 Vàng vào tài khoản'}</span>
                    </div>
                  </div>

                  {/* Buttons */}
                  <button
                    onClick={() =>
                      onExitBattle('win', {
                        gold: hasClaimedTutorialReward ? 0 : 1000,
                        cards: 0,
                        exp: hasClaimedTutorialReward ? 50 : 100,
                      })
                    }
                    className="w-full max-w-sm mt-3 py-3.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black font-game text-sm md:text-base rounded-2xl shadow-xl shadow-amber-400/30 transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Home className="w-5 h-5 text-slate-950" />
                    <span>Back to Home Screen</span>
                  </button>

                  {tutorialStage < 3 && onNextTutorialStage && (
                    <button
                      onClick={() => {
                        sound.playClick();
                        onExitBattle('win', { gold: 1000, cards: 0, exp: 100 });
                        onNextTutorialStage(2);
                      }}
                      className="w-full max-w-sm mt-2 py-2.5 bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-500/50 text-indigo-200 font-black font-game text-xs md:text-sm rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Swords className="w-4 h-4 text-amber-300" />
                      <span>TIẾP TỤC: TUTORIAL 2</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : !chestOpened ? (
                /* CHEST UNOPENED STAGE */
                <div className="flex flex-col items-center my-1 relative z-10 w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-6 h-6 text-amber-300 animate-bounce" />
                    <h2 className="text-2xl md:text-3xl font-black font-game text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-100">
                      VICTORY!
                    </h2>
                  </div>
                  <p className="text-xs text-slate-300 mb-3 max-w-xs">
                    All enemy beasts were defeated! Tap your battle Victory Chest to reveal your rewards.
                  </p>

                  {/* Animated Treasure Chest */}
                  <div
                    onClick={handleOpenVictoryChest}
                    className="relative cursor-pointer group my-2 transition-transform hover:scale-105 active:scale-95"
                  >
                    <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/40 via-yellow-400/50 to-amber-500/40 rounded-full blur-xl animate-pulse" />
                    <div className="relative w-32 h-32 md:w-40 md:h-40 bg-gradient-to-b from-amber-950 via-slate-900 to-slate-950 border-4 border-amber-400 rounded-3xl p-4 shadow-2xl flex flex-col items-center justify-center">
                      <div className="text-5xl md:text-6xl animate-bounce mb-1">
                        🎁
                      </div>
                      <span className="text-[10px] md:text-xs font-black font-game text-amber-300 tracking-wider uppercase bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/40">
                        Tap to Open
                      </span>
                    </div>
                    <Sparkles className="w-5 h-5 text-amber-300 absolute -top-2 -right-2 animate-spin" />
                    <Sparkles className="w-4 h-4 text-yellow-200 absolute -bottom-1 -left-1 animate-pulse" />
                  </div>

                  <p className="text-[11px] text-amber-200/80 mb-3">
                    Contains: <strong>100–500 Gold</strong> & <strong>3–8 Separate Cards</strong> of a random Starmon!
                  </p>

                  <button
                    onClick={handleOpenVictoryChest}
                    className="w-full max-w-sm py-3 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black font-game text-sm md:text-base rounded-2xl shadow-xl shadow-amber-500/30 transform hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-amber-200 cursor-pointer"
                  >
                    <Gift className="w-5 h-5 text-amber-950" />
                    OPEN VICTORY CHEST
                  </button>

                  {tutorialStage && tutorialStage < 3 && onNextTutorialStage && (
                    <button
                      onClick={() => {
                        sound.playClick();
                        onNextTutorialStage((tutorialStage + 1) as 1 | 2 | 3);
                      }}
                      className="w-full max-w-sm mt-2 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 text-white font-black font-game text-xs md:text-sm rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Swords className="w-3.5 h-3.5 text-amber-300" />
                      <span>NEXT: TUTORIAL {tutorialStage + 1}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      sound.playClick();
                      setVictoryViewTab('performance');
                    }}
                    className="mt-2 text-xs font-bold text-indigo-300 hover:text-indigo-200 flex items-center gap-1.5 cursor-pointer hover:underline"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>View Battle Performance Summary (DMG, IELTS, Combos)</span>
                  </button>
                </div>
              ) : chestRewards ? (
                /* CHEST REWARDS OPENED STAGE */
                <div className="flex flex-col items-center my-1 relative z-10 w-full animate-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <h2 className="text-xl md:text-2xl font-black font-game text-amber-300">
                      CHEST REWARDS!
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">
                    Battle spoils successfully claimed:
                  </p>

                  {/* 3 Revealed Reward Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 md:gap-3 w-full my-2">
                    {/* Reward 1: Gold (100 to 500) */}
                    <div className="flex flex-col items-center bg-slate-950/80 border-2 border-amber-400/70 rounded-2xl p-3 shadow-lg">
                      <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mb-1 text-2xl">
                        <img src={GOLD_IMAGE} alt="Gold" className="h-8 w-8 object-contain" />
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold">Gold Loot</span>
                      <span className="text-lg font-black text-amber-300 font-mono">
                        +{chestRewards.gold}
                      </span>
                      <span className="text-[9px] text-slate-500 mt-0.5">(100–500 rolled)</span>
                    </div>

                    {/* Reward 2: Separate Starmon Cards (3 to 8) */}
                    <div className="flex flex-col items-center bg-gradient-to-b from-slate-900 to-indigo-950 border-2 border-cyan-400 rounded-2xl p-3 shadow-xl relative overflow-hidden">
                      <span className={`text-[8px] font-black px-1.5 py-0.2 rounded mb-1 ${
                        chestRewards.isUnobtained
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {chestRewards.isUnobtained ? 'UNOBTAINED' : 'OBTAINED'}
                      </span>
                      <div className="w-14 h-14 flex items-center justify-center my-0.5">
                        <StarmonAsset id={chestRewards.starmon.avatarSeed} size="sm" />
                      </div>
                      <h4 className="text-xs font-black font-game text-white truncate max-w-[120px]">
                        {chestRewards.starmon.name}
                      </h4>
                      <span className="text-base font-black text-cyan-300 mt-0.5">
                        +{chestRewards.cards} Cards
                      </span>
                      <span className="text-[9px] text-slate-400 mt-0.5">(3–8 rolled)</span>
                    </div>

                    {/* Reward 3: EXP */}
                    <div className="flex flex-col items-center bg-slate-950/80 border-2 border-emerald-400/70 rounded-2xl p-3 shadow-lg">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mb-1 text-2xl">
                        🌟
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold">Trainer EXP</span>
                      <span className="text-lg font-black text-emerald-300 font-mono">+100</span>
                      <span className="text-[9px] text-slate-500 mt-0.5">Player level progress</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-[11px] text-slate-300 my-1.5 w-full text-center">
                    🃏 <strong>Separate Cards System:</strong> Won <strong>+{chestRewards.cards} {chestRewards.starmon.name}</strong> cards! Collect cards to awaken or upgrade this specific Starmon.
                  </div>

                  {/* Button to open Battle Performance Summary */}
                  <button
                    onClick={() => {
                      sound.playClick();
                      setVictoryViewTab('performance');
                    }}
                    className="w-full max-w-sm my-1 py-2.5 bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-500/50 text-indigo-200 font-black font-game text-xs md:text-sm rounded-2xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                    <span>VIEW BATTLE PERFORMANCE SUMMARY</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  </button>

                  <button
                    onClick={() =>
                      onExitBattle('win', {
                        gold: chestRewards.gold,
                        cards: chestRewards.cards,
                        cardStarmonId: chestRewards.starmon.id,
                        exp: 100,
                      })
                    }
                    className="w-full max-w-sm mt-1 py-3 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 font-black font-game text-slate-950 text-sm md:text-base rounded-2xl shadow-xl shadow-amber-400/25 transition-transform active:scale-95 cursor-pointer"
                  >
                    COLLECT REWARDS & RETURN TO HUB
                  </button>

                  {tutorialStage && tutorialStage > 1 && tutorialStage < 3 && onNextTutorialStage && (
                    <button
                      onClick={() => {
                        sound.playClick();
                        onNextTutorialStage((tutorialStage + 1) as 1 | 2 | 3);
                      }}
                      className="w-full max-w-sm mt-2 py-3 bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-600 hover:from-indigo-400 text-white font-black font-game text-sm md:text-base rounded-2xl shadow-xl shadow-indigo-500/30 transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Swords className="w-4 h-4 text-amber-300" />
                      <span>CONTINUE TO TUTORIAL {tutorialStage + 1}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  {tutorialStage === 3 && (
                    <div className="w-full max-w-sm mt-2 p-2.5 rounded-2xl bg-emerald-950/80 border border-emerald-400 text-emerald-300 text-xs font-bold text-center">
                      🎉 TUTORIAL COMPLETE! You have mastered the Combat Academy!
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* DEFEAT MODAL */}
      {phase === 'defeat' && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          {victoryViewTab === 'performance' ? (
            <div className="max-w-xl w-full my-auto animate-in zoom-in-95 duration-200">
              <BattlePerformanceSummary
                stats={performanceStats}
                playerTeamMetrics={playerTeam.map((m, idx) => ({
                  id: m.id,
                  name: m.name,
                  element: m.element,
                  avatarSeed: m.avatarSeed,
                  damageDealt: playerDmgDealt[idx] || 0,
                  damageTaken: playerDmgTaken[idx] || 0,
                }))}
                enemyTeamMetrics={enemyTeam.map((m, idx) => ({
                  id: m.id,
                  name: m.name,
                  element: m.element,
                  avatarSeed: m.avatarSeed,
                  damageDealt: enemyDmgDealt[idx] || 0,
                  damageTaken: enemyDmgTaken[idx] || 0,
                }))}
                enemyDamagePerElement={enemyDamagePerElement}
                onClose={() => setVictoryViewTab('rewards')}
                onReturnToHub={() => onExitBattle('loss')}
              />
            </div>
          ) : (
            <div className="bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl flex flex-col items-center">
              <RotateCcw className="w-12 h-12 text-rose-400 mb-2" />
              <h2 className="text-2xl font-black font-game text-rose-400">DEFEAT</h2>
              <p className="text-xs text-slate-300 mt-1">Your team fainted. Answer questions accurately to avoid missing turns!</p>
              <button
                onClick={() => {
                  sound.playClick();
                  setVictoryViewTab('performance');
                }}
                className="mt-3 w-full py-2 bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-500/50 text-indigo-200 font-black font-game text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow"
              >
                <BarChart3 className="w-4 h-4 text-indigo-400" />
                <span>VIEW PERFORMANCE BREAKDOWN</span>
              </button>
              <button
                onClick={() => onExitBattle('loss')}
                className="mt-2 w-full py-2.5 bg-slate-800 hover:bg-slate-700 font-black font-game text-slate-200 rounded-xl cursor-pointer active:scale-95"
              >
                RETURN TO LOBBY
              </button>
            </div>
          )}
        </div>
      )}

      {/* BATTLE LOG MODAL (LỊCH SỬ TRẬN ĐẤU) */}
      {showBattleLogModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 md:p-5 animate-in fade-in duration-150">
          <div className="bg-slate-900 border-2 border-amber-400/80 rounded-3xl p-4 md:p-6 max-w-2xl w-full text-slate-100 shadow-2xl flex flex-col gap-3 relative max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                  <ScrollText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black font-game text-amber-300 flex items-center gap-2">
                    <span>BATTLE LOG · LỊCH SỬ TRẬN ĐẤU</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-amber-400/30 font-mono">
                      {battleLogs.length} sự kiện
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Nhật ký chi tiết các lượt đánh, đòn Match-3, kỹ năng, và kết quả câu hỏi Speaking / Quiz
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  sound.playClick();
                  setShowBattleLogModal(false);
                }}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold">
              {[
                { id: 'all', label: `Tất cả (${battleLogs.length})` },
                { id: 'player', label: `Phe ta (${battleLogs.filter(b => b.source === 'player').length})` },
                { id: 'enemy', label: `Phe địch (${battleLogs.filter(b => b.source === 'enemy').length})` },
                { id: 'skills', label: `Kỹ năng (${battleLogs.filter(b => b.actionType === 'skill').length})` },
                { id: 'quiz', label: `Học tập / Quiz (${battleLogs.filter(b => b.actionType === 'quiz').length})` },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => {
                    sound.playClick();
                    setBattleLogFilter(f.id as any);
                  }}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap text-xs ${
                    battleLogFilter === f.id
                      ? 'bg-amber-400 text-slate-950 font-black shadow'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Log Entries List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[55vh]">
              {(() => {
                const filtered = battleLogs.filter(entry => {
                  if (battleLogFilter === 'all') return true;
                  if (battleLogFilter === 'player') return entry.source === 'player';
                  if (battleLogFilter === 'enemy') return entry.source === 'enemy';
                  if (battleLogFilter === 'skills') return entry.actionType === 'skill';
                  if (battleLogFilter === 'quiz') return entry.actionType === 'quiz';
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      Chưa có ghi chép nào phù hợp với bộ lọc này.
                    </div>
                  );
                }

                return filtered.map(log => {
                  const isPlayer = log.source === 'player';
                  const isEnemy = log.source === 'enemy';

                  return (
                    <div
                      key={log.id}
                      className={`p-2.5 rounded-2xl border text-xs flex flex-col gap-1 transition-all ${
                        isPlayer
                          ? 'bg-slate-950/80 border-sky-500/40 hover:border-sky-400/70'
                          : isEnemy
                          ? 'bg-slate-950/80 border-rose-500/40 hover:border-rose-400/70'
                          : 'bg-slate-950/80 border-amber-500/40 hover:border-amber-400/70'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.2 rounded-full font-bold uppercase tracking-wider text-[9px] ${
                            isPlayer
                              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                              : isEnemy
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}>
                            {isPlayer ? 'Player' : isEnemy ? 'Opponent' : 'Battle System'}
                          </span>
                          {log.unitName && (
                            <span className="font-bold text-slate-200">
                              {log.unitName}
                            </span>
                          )}
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                            {log.actionType.toUpperCase()}
                          </span>
                        </div>
                        <span className="font-mono text-slate-500">
                          {log.timestamp}
                        </span>
                      </div>

                      <p className="font-bold text-slate-100 text-xs mt-0.5">
                        {log.message}
                      </p>

                      {log.detail && (
                        <p className="text-[11px] text-slate-400 font-mono bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800/80">
                          ↳ {log.detail}
                        </p>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <button
                onClick={() => {
                  sound.playClick();
                  setBattleLogs([
                    {
                      id: `log_init_${Date.now()}`,
                      turnNumber: 1,
                      phase: 'quiz',
                      source: 'system',
                      actionType: 'status',
                      message: '⚔️ Log cleared. Combat continuing...',
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    }
                  ]);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
              >
                Xóa lịch sử
              </button>
              <button
                onClick={() => {
                  sound.playClick();
                  setShowBattleLogModal(false);
                }}
                className="px-5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black font-game text-xs rounded-xl shadow cursor-pointer active:scale-95"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* STARMON FULL STATS & PASSIVE INSPECTION MODAL */}
      {/* ======================================================== */}
      {inspectingStarmon && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-150">
          <div className="bg-slate-900 border-2 border-cyan-400/80 rounded-3xl p-5 md:p-6 max-w-lg w-full text-slate-100 shadow-2xl flex flex-col gap-3.5 relative max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-950 border-2 border-cyan-400/50 flex items-center justify-center shadow-lg shrink-0">
                  <StarmonAsset
                    id={inspectingStarmon.mon.avatarSeed}
                    size="md"
                    isDaPhucVersion={inspectingStarmon.mon.isDaPhucVersion || inspectingStarmon.mon.equippedItems?.includes('da_phuc_uniform')}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base md:text-lg font-black font-game text-white">
                      {inspectingStarmon.mon.name}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 font-bold border border-cyan-500/30">
                      Lv. {inspectingStarmon.mon.level || 1}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-slate-950 ${ELEMENT_COLORS[inspectingStarmon.mon.element]?.bg || 'bg-sky-400'}`}>
                      {inspectingStarmon.mon.element}
                    </span>
                    {inspectingStarmon.mon.secondaryElement && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-slate-950 ${ELEMENT_COLORS[inspectingStarmon.mon.secondaryElement]?.bg || 'bg-slate-300'}`}>
                        {inspectingStarmon.mon.secondaryElement === 'Metal' ? (inspectingStarmon.mon.id === 'moltenback' ? 'Steel' : 'Metal') : inspectingStarmon.mon.secondaryElement}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {inspectingStarmon.mon.title || (inspectingStarmon.isEnemy ? 'Opponent Starmon' : 'Player Starmon')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  sound.playClick();
                  setInspectingStarmon(null);
                }}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* BASE STATS SECTION (Original Stats before battle / Roster) */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 block mb-2">
                📊 Base Stats (Original Roster Stats)
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold">Base ATK</span>
                  <span className="text-base font-black font-game text-amber-300">
                    {inspectingStarmon.originalBase?.baseAtk ?? inspectingStarmon.mon.baseAtk}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold">Max HP</span>
                  <span className="text-base font-black font-game text-rose-400">
                    {inspectingStarmon.originalBase?.maxHp ?? inspectingStarmon.mon.maxHp}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-bold">Base DEF</span>
                  <span className="text-base font-black font-game text-sky-400">
                    {inspectingStarmon.originalBase?.def ?? inspectingStarmon.mon.def ?? 20}
                  </span>
                </div>
              </div>
            </div>

            {/* CURRENT BATTLE VITALS */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 block">
                ⚔️ Current Battle State
              </span>
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                  <span>Current HP</span>
                  <span>{inspectingStarmon.mon.currentHp} / {inspectingStarmon.mon.maxHp}</span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-rose-500 transition-all duration-300"
                    style={{ width: `${Math.max(0, (inspectingStarmon.mon.currentHp / inspectingStarmon.mon.maxHp) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                  <span>Current Mana</span>
                  <span>{inspectingStarmon.mon.currentMana} / 200</span>
                </div>
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-sky-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, (inspectingStarmon.mon.currentMana / 200) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* PASSIVE ABILITY SECTION */}
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">✨</span>
                  <span className="text-xs font-black font-game text-amber-300">
                    PASSIVE: {inspectingStarmon.mon.passive?.name || 'Năng lực nội tại'}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/40 font-mono font-bold">
                  [{inspectingStarmon.mon.passive?.tag || 'Passive'}]
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {inspectingStarmon.mon.passive?.description || 'Năng lực nội tại tự động kích hoạt.'}
              </p>
              <div className="mt-2 text-[10px] text-amber-400/90 font-bold italic">
                💡 Passive abilities trigger automatically without costing mana or consuming your turn.
              </div>
            </div>

            {/* ACTIVE SKILLS SECTION */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                ⚡ Active Skills (Takes Turn & Consumes Mana)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* Skill 1 */}
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs">
                  <div className="flex items-center justify-between font-bold text-white mb-1">
                    <span className="font-game text-sky-300">1. {inspectingStarmon.mon.skill1?.name || 'Tấn công'}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-500/40 font-mono">
                      {inspectingStarmon.mon.skill1?.manaCost || 20} Mana
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    {inspectingStarmon.mon.skill1?.description || 'Kỹ năng chủ động.'}
                  </p>
                </div>

                {/* Skill 2 */}
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs">
                  <div className="flex items-center justify-between font-bold text-white mb-1">
                    <span className="font-game text-amber-300">2. {inspectingStarmon.mon.skill2?.name || 'Tuyệt chiêu'}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-500/40 font-mono">
                      {inspectingStarmon.mon.skill2?.manaCost || 40} Mana
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    {inspectingStarmon.mon.skill2?.description || 'Tuyệt chiêu chủ động.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => {
                sound.playClick();
                setInspectingStarmon(null);
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-black font-game text-xs rounded-xl cursor-pointer active:scale-95"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TUTORIAL 1 COMPLETION MODAL */}
      {/* ======================================================== */}
      {(isTutorial1Complete || (tutorialStage === 1 && phase === 'victory')) && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-slate-900 border-2 border-amber-400 rounded-3xl p-6 md:p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center relative overflow-hidden">
            {/* Ambient gold glow */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />

            <div className="w-16 h-16 rounded-2xl bg-amber-400/20 border-2 border-amber-400/60 flex items-center justify-center text-4xl mb-3 shadow-lg shadow-amber-500/20 animate-bounce">
              🏆
            </div>

            {/* Dòng chữ thông báo chính xác theo yêu cầu */}
            <h2 className="text-xl md:text-2xl font-black font-game text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-100 mb-2">
              Xin chúc mừng! Bạn đã hoàn thành Hướng dẫn 1.
            </h2>

            <p className="text-xs md:text-sm text-slate-300 mb-4 max-w-sm leading-relaxed font-semibold">
              🎉 Chúc mừng bạn đã hoàn thành xuất sắc toàn bộ hướng dẫn cơ bản: Trắc nghiệm (MCQ), Bảng ngọc Match-3 & Luyện nói IELTS Speaking!
            </p>

            {/* Reward Box */}
            <div className="w-full bg-gradient-to-b from-amber-950/60 to-slate-950/80 border border-amber-400/60 rounded-2xl p-3.5 mb-5 flex items-center justify-center gap-3 shadow-inner">
              <img src={GOLD_IMAGE} alt="Gold" className="h-8 w-8 object-contain" />
              <div className="text-left">
                <div className="text-[10px] font-black uppercase text-amber-300 tracking-wider">Phần thưởng hoàn thành</div>
                <div className="text-2xl font-black font-game font-mono text-amber-300">
                  {hasClaimedTutorialReward ? '0 VÀNG' : '+1,000 VÀNG'}
                </div>
                {hasClaimedTutorialReward && (
                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Đã hoàn thành trước đó (Không nhận lại thưởng)
                  </div>
                )}
              </div>
            </div>

            {/* Nút bấm: Về Màn Hình Chính */}
            <button
              onClick={() => {
                sound.playClick();
                onExitBattle('win', {
                  gold: hasClaimedTutorialReward ? 0 : 1000,
                  cards: 0,
                  exp: hasClaimedTutorialReward ? 50 : 100,
                });
              }}
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black font-game text-sm md:text-base rounded-2xl shadow-xl shadow-amber-400/30 transition-transform active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5 text-slate-950" />
              <span>Về Màn Hình Chính</span>
            </button>
          </div>
        </div>
      )}

      {/* GLOBAL TUTORIAL SPOTLIGHT & MASK OVERLAY */}
      {tutorialStage && !isTutorial1Complete && phase !== 'victory' && (
        <TutorialSpotlight
          stage={tutorialStage}
          phase={phase}
          currentQuestion={currentQ}
          selectedEnemyIndex={selectedEnemyIndex}
          playerTeam={playerTeam}
          enemyTeam={enemyTeam}
          hasSwappedOrbs={tutorialHasSwappedOrbs}
          hasRecordedSpeaking={tutorialHasRecordedSpeaking}
          hasSelectedAbility={Boolean(selectedAbilityDetail)}
          ieltsAiResult={ieltsAiResult}
          tutorialRound={tutorialRound}
          mcqCorrectSelected={tutorialMcqCorrect}
          onSkip={() => onSkipTutorial?.()}
          onNextStage={(next) => onNextTutorialStage?.(next)}
          onAdvanceToMatch3={handleAdvanceToMatch3FromTutorial}
          onAdvanceToSpeaking={handleAdvanceToSpeaking}
          onAdvanceToFinalAttack={handleAdvanceToFinalAttack}
        />
      )}
    </div>
  );
};
