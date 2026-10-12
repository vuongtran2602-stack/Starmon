import { StarmonClass } from '../types';

/**
 * Combat Power (CP) Formula from PDF:
 * CP = HP × 1 + ATK × 7 + DEF × 13
 * 1 HP = 1 CP
 * 1 ATK = 7 CP
 * 1 DEF = 13 CP
 */
export function calculateCP(hp: number, atk: number, def: number): number {
  return Math.round(hp * 1 + atk * 7 + def * 13);
}

/**
 * 2. BASE STATS LEVEL 1 (From Section 2 of PDF)
 */
export const CLASS_BASE_STATS_L1: Record<StarmonClass, { hp: number; atk: number; def: number; cp: number }> = {
  'Tank 1': { hp: 620, atk: 30, def: 42, cp: 1366 },
  'Tank 2': { hp: 550, atk: 30, def: 48, cp: 1384 },
  'Tank 3': { hp: 590, atk: 42, def: 40, cp: 1366 },
  'Warrior 1': { hp: 520, atk: 60, def: 28, cp: 1324 },
  'Warrior 2': { hp: 480, atk: 72, def: 26, cp: 1322 },
  'Warrior 3': { hp: 500, atk: 66, def: 28, cp: 1326 },
  'Attacker 1': { hp: 370, atk: 80, def: 22, cp: 1276 },
  'Attacker 2': { hp: 420, atk: 72, def: 24, cp: 1296 },
  'Attacker 3': { hp: 490, atk: 65, def: 25, cp: 1300 },
  'Support 1 (Caster Support)': { hp: 490, atk: 42, def: 48, cp: 1378 },
  'Support 2 (Tank Support)': { hp: 550, atk: 38, def: 45, cp: 1391 },
};

/**
 * 6. GAIN MỖI LEVEL THEO CLASS (From Section 6 of PDF)
 * Growth stages:
 * Early: Level 1–30
 * Mid 1: Level 31–45
 * Mid 2: Level 46–60
 * Mid 3: Level 61–75
 * Late: Level 76–100
 */
export const CLASS_GROWTH_TABLE: Record<
  StarmonClass,
  {
    early: { hp: number; atk: number; def: number };
    mid1: { hp: number; atk: number; def: number };
    mid2: { hp: number; atk: number; def: number };
    mid3: { hp: number; atk: number; def: number };
    late: { hp: number; atk: number; def: number };
  }
> = {
  'Tank 1': {
    early: { hp: 61.2, atk: 1.6, def: 2.2 },
    mid1: { hp: 101.0, atk: 2.6, def: 3.8 },
    mid2: { hp: 140.8, atk: 3.7, def: 5.2 },
    mid3: { hp: 183.6, atk: 4.8, def: 6.8 },
    late: { hp: 241.7, atk: 6.3, def: 9.0 },
  },
  'Tank 2': {
    early: { hp: 44.4, atk: 1.6, def: 3.5 },
    mid1: { hp: 73.3, atk: 2.6, def: 5.8 },
    mid2: { hp: 102.2, atk: 3.6, def: 8.0 },
    mid3: { hp: 133.3, atk: 4.8, def: 10.5 },
    late: { hp: 175.6, atk: 6.3, def: 13.8 },
  },
  'Tank 3': {
    early: { hp: 52.5, atk: 4.0, def: 2.3 },
    mid1: { hp: 86.6, atk: 6.5, def: 3.8 },
    mid2: { hp: 120.7, atk: 9.1, def: 5.3 },
    mid3: { hp: 157.4, atk: 11.8, def: 6.8 },
    late: { hp: 207.2, atk: 15.5, def: 9.0 },
  },
  'Warrior 1': {
    early: { hp: 47.0, atk: 4.6, def: 1.6 },
    mid1: { hp: 77.6, atk: 7.5, def: 2.7 },
    mid2: { hp: 108.1, atk: 10.5, def: 3.7 },
    mid3: { hp: 141.0, atk: 13.7, def: 4.8 },
    late: { hp: 185.7, atk: 18.1, def: 6.4 },
  },
  'Warrior 2': {
    early: { hp: 39.1, atk: 6.2, def: 1.6 },
    mid1: { hp: 64.6, atk: 10.2, def: 2.6 },
    mid2: { hp: 90.0, atk: 14.2, def: 3.6 },
    mid3: { hp: 117.4, atk: 18.5, def: 4.8 },
    late: { hp: 154.6, atk: 24.4, def: 6.3 },
  },
  'Warrior 3': {
    early: { hp: 42.4, atk: 5.3, def: 1.6 },
    mid1: { hp: 70.0, atk: 8.8, def: 2.7 },
    mid2: { hp: 97.6, atk: 12.2, def: 3.7 },
    mid3: { hp: 127.3, atk: 15.9, def: 4.8 },
    late: { hp: 167.5, atk: 21.0, def: 6.4 },
  },
  'Attacker 1': {
    early: { hp: 22.5, atk: 8.5, def: 1.2 },
    mid1: { hp: 37.2, atk: 14.1, def: 2.0 },
    mid2: { hp: 51.8, atk: 19.6, def: 2.8 },
    mid3: { hp: 67.6, atk: 25.6, def: 3.7 },
    late: { hp: 89.0, atk: 33.7, def: 4.9 },
  },
  'Attacker 2': {
    early: { hp: 30.4, atk: 7.4, def: 1.2 },
    mid1: { hp: 50.1, atk: 12.3, def: 2.0 },
    mid2: { hp: 69.9, atk: 17.1, def: 2.8 },
    mid3: { hp: 91.1, atk: 22.3, def: 3.7 },
    late: { hp: 120.0, atk: 29.4, def: 4.9 },
  },
  'Attacker 3': {
    early: { hp: 36.3, atk: 6.6, def: 1.2 },
    mid1: { hp: 59.8, atk: 10.8, def: 2.0 },
    mid2: { hp: 83.4, atk: 15.1, def: 2.8 },
    mid3: { hp: 108.8, atk: 19.6, def: 3.7 },
    late: { hp: 143.3, atk: 25.9, def: 4.9 },
  },
  'Support 1 (Caster Support)': {
    early: { hp: 36.4, atk: 3.9, def: 2.9 },
    mid1: { hp: 60.0, atk: 6.4, def: 4.7 },
    mid2: { hp: 83.6, atk: 8.9, def: 6.6 },
    mid3: { hp: 109.1, atk: 11.6, def: 8.6 },
    late: { hp: 143.6, atk: 15.3, def: 11.3 },
  },
  'Support 2 (Tank Support)': {
    early: { hp: 46.5, atk: 2.9, def: 2.6 },
    mid1: { hp: 76.7, atk: 4.8, def: 4.3 },
    mid2: { hp: 107.0, atk: 6.7, def: 6.0 },
    mid3: { hp: 139.5, atk: 8.7, def: 7.9 },
    late: { hp: 183.6, atk: 11.5, def: 10.4 },
  },
};

/**
 * Exact Starmon -> Class Mapping from PDF & prompt
 */
export const STARMON_CLASS_MAP: Record<string, StarmonClass> = {
  // Tank 2: Stone Golem, Moltenback, Mineacle, Mossloth
  stone_golem: 'Tank 2',
  moltenback: 'Tank 2',
  mineacle: 'Tank 2',
  mossloth: 'Tank 2',

  // Tank 3: Coralus, Cyborgnid
  coralus: 'Tank 3',
  cyborgnid: 'Tank 3',

  // Attacker 2: Pyrokit, Ignisaur, Glidron, Zapwing
  pyrokit: 'Attacker 2',
  ignisaur: 'Attacker 2',
  glidron: 'Attacker 2',
  zapwing: 'Attacker 2',

  // Attacker 3: Voltlynx, Frostmoth, Vinedra
  voltlynx: 'Attacker 3',
  frostmoth: 'Attacker 3',
  vinedra: 'Attacker 3',

  // Warrior 1: Obsidus, Tidecrush
  obsidus: 'Warrior 1',
  tidecrush: 'Warrior 1',

  // Warrior 3: Bubbleboon, Trojan Flare, Zephyrion
  bubbleboon: 'Warrior 3',
  trojan_flare: 'Warrior 3',
  zephyrion: 'Warrior 3',

  // Support 1 (Caster Support): Aquanymph, Teslarion, Khepri
  aquanymph: 'Support 1 (Caster Support)',
  teslarion: 'Support 1 (Caster Support)',
  khepri: 'Support 1 (Caster Support)',
};

/**
 * Get the Starmon class by ID or fallback
 */
export function getStarmonClass(id: string): StarmonClass {
  const cleanId = (id || '').toLowerCase().trim();
  return STARMON_CLASS_MAP[cleanId] || 'Attacker 2';
}

/**
 * Get stat gain for leveling up to `targetLevel` (from `targetLevel - 1`)
 */
export function getLevelUpStatGain(
  starmonClass: StarmonClass,
  targetLevel: number
): { hp: number; atk: number; def: number; cp: number } {
  const growth = CLASS_GROWTH_TABLE[starmonClass] || CLASS_GROWTH_TABLE['Attacker 2'];
  let g = growth.early;
  if (targetLevel > 75) {
    g = growth.late;
  } else if (targetLevel > 60) {
    g = growth.mid3;
  } else if (targetLevel > 45) {
    g = growth.mid2;
  } else if (targetLevel > 30) {
    g = growth.mid1;
  }

  const hpGain = Math.round(g.hp);
  const atkGain = Math.round(g.atk);
  const defGain = Math.round(g.def);
  const cpGain = calculateCP(hpGain, atkGain, defGain);

  return { hp: hpGain, atk: atkGain, def: defGain, cp: cpGain };
}

/**
 * Computes base stats at a given level for a specific class
 */
export function getStatsForLevel(
  starmonClass: StarmonClass,
  level: number
): { hp: number; atk: number; def: number; cp: number } {
  const base = CLASS_BASE_STATS_L1[starmonClass] || CLASS_BASE_STATS_L1['Attacker 2'];
  let hp = base.hp;
  let atk = base.atk;
  let def = base.def;

  const validLevel = Math.max(1, Math.min(100, level));
  for (let lvl = 2; lvl <= validLevel; lvl++) {
    const gain = getLevelUpStatGain(starmonClass, lvl);
    hp += gain.hp;
    atk += gain.atk;
    def += gain.def;
  }

  const cp = calculateCP(hp, atk, def);
  return { hp, atk, def, cp };
}

/**
 * Helper to calculate total Squad CP from an array of Starmons
 */
export function calculateSquadCP(starmons: Array<{ hp?: number; maxHp?: number; baseAtk?: number; def?: number; cp?: number }>): number {
  if (!Array.isArray(starmons) || starmons.length === 0) return 0;
  return starmons.reduce((sum, s) => {
    if (!s) return sum;
    if (typeof s.cp === 'number' && s.cp > 0) return sum + s.cp;
    const hp = s.maxHp || s.hp || 0;
    const atk = s.baseAtk || 0;
    const def = s.def || 0;
    return sum + calculateCP(hp, atk, def);
  }, 0);
}
