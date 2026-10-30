export type ElementType = 'Fire' | 'Water' | 'Electric' | 'Wind' | 'Earth' | 'Metal';

export interface StarmonSkill {
  id: string;
  name: string;
  description: string;
  manaCost: number;
  damageMultiplier: number; // e.g. 2.0 = 200%
  targetType: 'single' | 'aoe' | 'self';
  statusEffect?: string;
  cooldownTurns?: number;
  effectDetail?: string;
}

export interface StarmonPassive {
  name: string;
  description: string;
  tag: string;
  effectDetail?: string;
}

export interface EquipmentItem {
  id: string; // 'old_pickaxe' | 'da_phuc_uniform'
  name: string;
  description: string;
  bulletStats?: string[]; // e.g. ['+1% ATK', '+1% max HP']
  imageUrl: string;
  targetStarmonId?: string; // e.g. 'aquanymph'
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  slotType?: 'headwear' | 'body_armor' | 'boots' | 'handheld' | 'handheld_shield' | 'relic' | 'special';
}

export interface CraftingJob {
  slot: number;
  itemId: string;
  completesAt: number;
}

export type ResearchNodeLevels = Record<string, number>;
export type ResearchTechLevels = Partial<Record<ElementType, ResearchNodeLevels>>;

export interface ResearchJob {
  slot: number;
  element: ElementType;
  nodeId: string;
  completesAt: number;
}

export type StarmonClass =
  | 'Tank 1'
  | 'Tank 2'
  | 'Tank 3'
  | 'Warrior 1'
  | 'Warrior 2'
  | 'Warrior 3'
  | 'Attacker 1'
  | 'Attacker 2'
  | 'Attacker 3'
  | 'Support 1 (Caster Support)'
  | 'Support 2 (Tank Support)';

export interface Starmon {
  id: string;
  name: string;
  title: string;
  element: ElementType;
  secondaryElement?: ElementType;
  role: 'Spell Caster' | 'DPS' | 'Guardian' | 'Support';
  starmonClass?: StarmonClass;
  cp?: number;
  level: number;
  cards: number;
  baseAtk: number;
  maxHp: number;
  def: number;
  currentHp: number;
  currentMana: number;
  maxMana: number;
  passive: StarmonPassive;
  skill1: StarmonSkill;
  skill2: StarmonSkill;
  unlocked: boolean;
  avatarSeed: string; // for custom stylized vector art
  imageUrl?: string;
  equippedItems?: (string | null)[]; // 6 equipment slots
  equippedItemLevels?: (number | null)[];
  equippedItemEnhancements?: (number | null)[];
  unlockedSlots?: boolean[]; // 6 slots: boolean flag
  researchCritChance?: number;
  researchPhysicalDamageReduction?: number;
  isDaPhucVersion?: boolean;
  battleTauntTurns?: number;
  battleDamageReduction?: number;
  battleDamageReductionTurns?: number;
  battleDefenseBuffAmount?: number;
  battleDefenseBuffTurns?: number;
  battleShieldPoints?: number;
  battleDecoyHp?: number;
  battleDecoyTurns?: number;
  battleAttackBuffAmount?: number;
  battleAttackBuffTurns?: number;
  battleCritChanceBonus?: number;
  battleCritChanceTurns?: number;
  battleBaseDef?: number;
  berryReserveUsed?: boolean;
}

export type QuizQuestionMode = 'random' | 'part1_preference' | 'part3_forecast_2026' | 'mixed' | 'mcq_only' | 'speaking_only';

export interface SpeakingLogEntry {
  id: string;
  createdAt: number;
  question: string;
  transcript: string;
  overallBand: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  criteria: Partial<Record<'fluencyCoherence' | 'lexicalResource' | 'grammaticalRange' | 'pronunciation', { band: number; feedback: string }>>;
  feedbackVi?: SpeakingFeedbackVi;
  fluencyDetail?: FluencyDetail;
  grammarErrors: GrammarErrorDetail[];
  pronunciationErrors: PronunciationErrorDetail[];
}

export interface PlayerProfile {
  name: string;
  username?: string;
  googleId?: string; // Google User ID for cross-account PvP matching
  googleEmail?: string;
  level: number;
  exp: number;
  nextExp: number;
  gold: number;
  gems: number;
  royalTokens?: number;
  omniStarmonCards?: number;
  commonItemPacks?: number;
  dailyRewardProgress?: DailyRewardProgress;
  energy: number; // Current Energy (base 100/100, free regen caps at 100, batteries can exceed 100)
  maxEnergy: number; // Maximum natural energy capacity (100)
  lastEnergyRegenTime?: number; // Timestamp of last regen cycle (1 energy per 10 minutes)
  energyBatteries?: {
    battery50: number;
    battery100: number;
    battery200: number;
  };
  specialItems?: {
    starShard: number; // Used to Level Up equipment
    goldenAnvil: number; // Used to Enhance equipment
  };
  starterPacksCount: number;
  isNewPlayer: boolean;
  hasClaimedBeginnerPack: boolean;
  hasCompletedOnboardingTutorial?: boolean;
  hasClaimedTutorial1Reward?: boolean;
  completedTutorialStages?: number[];
  activeCompanionId: string;
  battleParty?: string[]; // IDs of 1 to 3 Starmons currently in the battle lineup
  unitTestExpiry?: number; // timestamp when UnitTest 0-cost mode expires
  redeemedCodes?: string[]; // Gift codes already claimed by this player account
  equipmentInventory?: { itemId: string; count: number; level?: number; enhancement?: number }[];
  craftingJobs?: CraftingJob[];
  techResearchLevels?: ResearchTechLevels;
  researchJobs?: ResearchJob[];
  elementalPacks?: Partial<Record<ElementType, number>>;
  claimedAquanymphDaPhucPack?: boolean;
  mailUnreadCount: number;
  soundEnabled: boolean;
  musicEnabled: boolean;
  showSpeakingHints?: boolean;
  quizQuestionMode?: QuizQuestionMode;
  speakingLog?: SpeakingLogEntry[];
  graphicsQuality: 'High' | 'Medium';
}

export interface DailyRewardProgress {
  cycleStartedOn: string;
  claimedDays: number[];
  allRewardsUnlocked?: boolean;
  lastClaimedOn?: string;
  cardRewardStarmonId?: string;
}

export type MysteryReward =
  | { type: 'elementalPack'; element: ElementType }
  | { type: 'gems'; amount: number }
  | { type: 'gold'; amount: number }
  | { type: 'goldenAnvil'; amount: 1 }
  | { type: 'commonItemPack'; amount: 1 }
  | { type: 'starShard'; amount: number }
  | { type: 'omniCards'; amount: number };

export interface BattleLogEntry {
  id: string;
  turnNumber: number;
  phase: 'quiz' | 'combat';
  source: 'player' | 'enemy' | 'system';
  unitName?: string;
  actionType: 'match' | 'skill' | 'quiz' | 'status' | 'defeat';
  message: string;
  detail?: string;
  timestamp: string;
  badgeColor?: string;
  phaseLabel?: string;
  effects?: string[];
}

export interface GrammarErrorDetail {
  sentence: string;
  error: string;
  correction: string;
  practice_structure?: string; // Cấu trúc ngữ pháp cần luyện tập
  explanation: string;
}

export interface PronunciationErrorDetail {
  word: string;
  sound?: string; // Âm/phiên âm cụ thể cần chú ý
  phonetic: string;
  issue: string;
  guide: string;
}

export interface FluencyDetail {
  stutterCount?: number;
  hesitationCount?: number;
  pauseCount?: number;
  stumbles?: string[];
  feedback?: string;
}

export interface VietnameseMistakePoint {
  title: string;
  where: string;
  mistake: string;
  why: string;
  solution: string;
}

export interface SpeakingFeedbackVi {
  summary: string;
  weaknesses: string[];
  suggestion: string;
  grammar_summary?: string;
  pronunciation_summary?: string;
}

export interface VietnameseSpeakingAnalysis {
  grammarMistakes: VietnameseMistakePoint[];
  pronunciationMistakes: VietnameseMistakePoint[];
  vietnameseTips: string[];
}

export interface UserAccount {
  username: string;
  pin?: string;
  googleId?: string;
  email?: string;
  createdAt: string;
  lastPlayedAt: string;
  player: PlayerProfile;
  starmons: Starmon[];
  quests?: QuestItem[];
}

export interface StarmonSaveFile {
  app: string;
  version: string;
  exportedAt: string;
  username: string;
  player: PlayerProfile;
  starmons: Starmon[];
  quests?: QuestItem[];
}

export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'speaking';
  title: string;
  category: 'Vocabulary' | 'Grammar' | 'IELTS Speaking';
  sentence?: string;
  question: string;
  options?: string[];
  correctIndex?: number;
  speakingPrompt?: string;
  minBand?: number; // e.g. 5.5
  assignedStarmonIndex: number;
}

export interface OrbTile {
  id: string;
  element: ElementType;
  row: number;
  col: number;
  isMatched?: boolean;
  isNew?: boolean;
}

export interface BattlePerformanceStats {
  damagePerElement: Record<ElementType, number>;
  totalDamageDealt: number;
  ieltsQuestionsTotal: number;
  ieltsQuestionsCorrect: number;
  ieltsSpeakingCount: number;
  ieltsSpeakingBandSum: number;
  totalMatchesMade: number;
  totalOrbsCleared: number;
  maxMatchSize: number;
  totalTurns: number;
}

export type BattlePhase = 'phase1_quiz' | 'phase2_combat' | 'victory' | 'defeat';

export interface CombatLog {
  id: string;
  text: string;
  type: 'damage' | 'heal' | 'skill' | 'info' | 'critical';
}

// ==========================================
// QUEST SYSTEM (Daily, Weekly, Monthly, Legend)
// ==========================================
export type QuestCategory = 'daily' | 'weekly' | 'monthly' | 'legend';

export interface QuestItem {
  id: string;
  title: string;
  description: string;
  category: QuestCategory;
  currentProgress: number;
  maxProgress: number;
  rewardType: 'gold' | 'gems' | 'pack' | 'cards' | 'crest';
  rewardAmount: number;
  rewardLabel: string;
  claimed: boolean;
  icon: string;
}

// ==========================================
// INVENTORY SYSTEM
// ==========================================
export type InventoryCategory = 'consumables' | 'items' | 'shards' | 'materials' | 'badges';

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  description: string;
  quantity: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  image?: string;
  element?: ElementType;
  actionLabel?: string;
  starmonId?: string;
  batteryAmount?: 50 | 100 | 200;
  subType?: 'pack' | 'battery' | 'level_up' | 'enhance' | 'resource';
}

// ==========================================
// CHAT SYSTEM (World, Clan, Private)
// ==========================================
export type ChatChannel = 'world' | 'clan' | 'private';

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  senderName: string;
  senderBadge?: string;
  senderAvatarSeed?: string;
  message: string;
  timestamp: string;
  isSystem?: boolean;
  isSelf?: boolean;
  whisperTarget?: string;
}

// ==========================================
// REAL-TIME PVP MULTIPLAYER LOBBY & ROOM
// ==========================================
export interface PlayerInRoom {
  id: string;
  name: string;
  level: number;
  isHost: boolean;
  isReady: boolean;
  slot?: 1 | 2;
  starmons?: Array<{
    id: string;
    name: string;
    element: string;
    level: number;
    maxHp: number;
    baseAtk: number;
    def: number;
    avatarSeed: string;
    ownerSlot?: 1 | 2;
    skill1?: any;
    skill2?: any;
    passive?: any;
  }>;
}

export interface PvpSpeakingSubmission {
  playerId: string;
  playerName: string;
  completionTime: number; // in seconds
  overallBand?: number;
  unlockedPositions: boolean[];
  submittedAt: number;
  isTimeout?: boolean;
}

export interface PvpMatchState {
  roomCode: string;
  turn?: number;
  roundNumber: number;
  phase: string;
  subPhase?: number | string;
  attackerSlot?: 1 | 2 | null;
  targetSlot?: 1 | 2 | null;
  speakingSubmissions?: Record<string, PvpSpeakingSubmission>;
  board?: any;
  lastAction?: any;
  updatedAt?: number;
}

export interface PvpRoom {
  room_code: string;
  code: string;
  host_id: string;
  hostName: string;
  hostLevel: number;
  guestName?: string;
  guestLevel?: number;
  arena: string;
  status: 'WAITING' | 'IN_GAME' | 'FINISHED';
  players: PlayerInRoom[];
  matchState?: PvpMatchState;
  createdAt: number;
  updatedAt: number;
}

