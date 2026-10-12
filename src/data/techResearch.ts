import { ElementType, ResearchTechLevels } from '../types';

export type ResearchNodeId =
  | 'basic_combat' | 'basic_vitality' | 'basic_defense'
  | 'precision' | 'endurance' | 'well_equipped_1'
  | 'refined_combat' | 'refined_defense' | 'refined_vitality'
  | 'well_equipped_2' | 'advanced_combat' | 'advanced_defense'
  | 'advanced_vitality' | 'well_equipped_3';

export interface ResearchCost { energy: number; gold: number; hours: number; royalTokens?: number }
export interface ResearchNode {
  id: ResearchNodeId;
  name: string;
  effect: string;
  maxLevel: number;
  cost: ResearchCost;
  requirements: { node: ResearchNodeId; level: number }[];
  row: number;
  col: number;
  stat?: 'atk' | 'hp' | 'def' | 'crit' | 'reduction' | 'slot';
  image: string;
}

const image = (path: string, key: string) => `https://dl.dropboxusercontent.com/scl/fi/${path}?rlkey=${key}&raw=1`;

export const TECH_BRANCH_IMAGES: Record<ElementType, string> = {
  Fire: image('ce9ajhd59t31xd1m9w340/Fire-Tech.png', 'i3qmwbv3qh8f6tpgsgyiervkl'),
  Wind: image('zp74ot39w4iz2jbh28s28/Wind-Tech.png', 'nmndi0br4csp157g6qn411wck'),
  Metal: image('q5vf8gfvqowelmho31juy/Metal-Tech.png', 'cflgplakp50nihg6w15x0qo3e'),
  Electric: image('pyg1f5hrvg4xa01v9i9t4/Electric-Tech.png', 'tfm4rt2i6bnye99pkjsotrgrp'),
  Earth: image('nowujopo75pym7hq59a1p/Earth-Tech.png', '75rgn19ct8d1q2z1qduumht0n'),
  Water: image('afp56qlzylcljtqjkdftn/Water-Tech.png', 'awvsd5qggf6p5s4leot2654vj'),
};

export const TECH_NODE_IMAGES = {
  locked: image('8h0l9kpxtg3zgurruffyc/Locked.png', 'g278cvbt8v14qhcb96l5k2hip'),
  hp: image('rdu1yfiglsb7ojat9rr5d/HP.png', 'kwnc4com0r51wnnb1yqpp3cmy'),
  atk: image('ga0ds7frflecoppbjxx9p/ATK-removebg.png', '5pxt3urw4xhoeztyo40w9tvfg'),
  def: image('x1a80bznju61lyxmagg32/DEF.png', '0l1c7cqr36v b55217so9vdxa0'.replace(' ', '')),
  crit: image('2ooc9oroweuha2ky9lppe/Crit.png', '4kh2iv7dax9wr6vnya4cbtqrl'),
  reduction: image('34862f7owf7133mn3tle0/DMG-taken.png', 'uh0lbl54t5bedkzvjm3ltc8v4'),
  slot: image('b8tqxd0ui01bv4kmq5nzf/Item.png', '2tqeb7xa2f6gxds9ihbqgs4p8'),
};

const basicReq: ResearchNode['requirements'] = [];
const well1: ResearchNode['requirements'] = [{ node: 'basic_vitality', level: 5 }, { node: 'precision', level: 3 }, { node: 'endurance', level: 3 }];
const well2: ResearchNode['requirements'] = [{ node: 'refined_vitality', level: 5 }, { node: 'refined_combat', level: 5 }, { node: 'refined_defense', level: 5 }];
const well3: ResearchNode['requirements'] = [{ node: 'advanced_combat', level: 10 }, { node: 'advanced_vitality', level: 10 }, { node: 'advanced_defense', level: 10 }];

export const RESEARCH_NODES: ResearchNode[] = [
  { id: 'basic_combat', name: 'Basic Combat Training', effect: '+1% base ATK per upgrade (max +5%)', maxLevel: 5, cost: { energy: 20, gold: 200, hours: 3 }, requirements: basicReq, row: 0, col: 0, stat: 'atk', image: TECH_NODE_IMAGES.atk },
  { id: 'basic_vitality', name: 'Basic Vitality Training', effect: '+1% base HP per upgrade (max +5%)', maxLevel: 5, cost: { energy: 20, gold: 200, hours: 3 }, requirements: basicReq, row: 0, col: 1, stat: 'hp', image: TECH_NODE_IMAGES.hp },
  { id: 'basic_defense', name: 'Basic Defense Training', effect: '+1% base DEF per upgrade (max +5%)', maxLevel: 5, cost: { energy: 20, gold: 200, hours: 3 }, requirements: basicReq, row: 0, col: 2, stat: 'def', image: TECH_NODE_IMAGES.def },
  { id: 'precision', name: 'Precision Training', effect: '+1% Critical Chance per upgrade (max +5%)', maxLevel: 5, cost: { energy: 30, gold: 450, hours: 5 }, requirements: [{ node: 'basic_combat', level: 5 }], row: 1, col: 0, stat: 'crit', image: TECH_NODE_IMAGES.crit },
  { id: 'endurance', name: 'Endurance Training', effect: '+1% damage reduction against orb-matching physical attacks (max +5%)', maxLevel: 5, cost: { energy: 30, gold: 450, hours: 5 }, requirements: [{ node: 'basic_defense', level: 5 }], row: 1, col: 2, stat: 'reduction', image: TECH_NODE_IMAGES.reduction },
  { id: 'well_equipped_1', name: 'Well Equipped I', effect: `Unlock ${'Item Slot 2'} for all ${'Fire'} Starmons`, maxLevel: 1, cost: { energy: 80, gold: 1000, hours: 24 }, requirements: well1, row: 2, col: 1, stat: 'slot', image: TECH_NODE_IMAGES.slot },
  { id: 'refined_combat', name: 'Refined Combat Training', effect: '+1% base ATK per upgrade (max +5%)', maxLevel: 5, cost: { energy: 50, gold: 600, hours: 7.5 }, requirements: [{ node: 'well_equipped_1', level: 1 }], row: 3, col: 0, stat: 'atk', image: TECH_NODE_IMAGES.atk },
  { id: 'refined_vitality', name: 'Refined Vitality Training', effect: '+1% base HP per upgrade (max +5%)', maxLevel: 5, cost: { energy: 50, gold: 600, hours: 7.5 }, requirements: [{ node: 'well_equipped_1', level: 1 }], row: 3, col: 1, stat: 'hp', image: TECH_NODE_IMAGES.hp },
  { id: 'refined_defense', name: 'Refined Defense Training', effect: '+1% base DEF per upgrade (max +5%)', maxLevel: 5, cost: { energy: 50, gold: 600, hours: 7.5 }, requirements: [{ node: 'well_equipped_1', level: 1 }], row: 3, col: 2, stat: 'def', image: TECH_NODE_IMAGES.def },
  { id: 'well_equipped_2', name: 'Well Equipped II', effect: 'Unlock Item Slot 3 for all Fire Starmons', maxLevel: 1, cost: { energy: 100, gold: 1500, hours: 32, royalTokens: 100 }, requirements: well2, row: 4, col: 1, stat: 'slot', image: TECH_NODE_IMAGES.slot },
  { id: 'advanced_combat', name: 'Advanced Combat Training', effect: '+1% base ATK per upgrade (max +10%)', maxLevel: 10, cost: { energy: 70, gold: 800, hours: 9 }, requirements: [{ node: 'well_equipped_2', level: 1 }], row: 5, col: 0, stat: 'atk', image: TECH_NODE_IMAGES.atk },
  { id: 'advanced_vitality', name: 'Advanced Vitality Training', effect: '+1% base HP per upgrade (max +10%)', maxLevel: 10, cost: { energy: 70, gold: 800, hours: 9 }, requirements: [{ node: 'well_equipped_2', level: 1 }], row: 5, col: 1, stat: 'hp', image: TECH_NODE_IMAGES.hp },
  { id: 'advanced_defense', name: 'Advanced Defense Training', effect: '+1% base DEF per upgrade (max +10%)', maxLevel: 10, cost: { energy: 70, gold: 800, hours: 9 }, requirements: [{ node: 'well_equipped_2', level: 1 }], row: 5, col: 2, stat: 'def', image: TECH_NODE_IMAGES.def },
  { id: 'well_equipped_3', name: 'Well Equipped III', effect: 'Unlock Item Slot 4 for all Fire Starmons', maxLevel: 1, cost: { energy: 200, gold: 5000, hours: 72, royalTokens: 450 }, requirements: well3, row: 6, col: 1, stat: 'slot', image: TECH_NODE_IMAGES.slot },
];

export const TOTAL_RESEARCH_UPGRADES = RESEARCH_NODES.reduce((total, node) => total + node.maxLevel, 0);

export function getResearchLevel(levels: ResearchTechLevels | undefined, element: ElementType, nodeId: ResearchNodeId): number {
  return levels?.[element]?.[nodeId] || 0;
}

export function getResearchProgress(levels: ResearchTechLevels | undefined, element: ElementType) {
  const elementLevels = levels?.[element] || {};
  const completed = RESEARCH_NODES.reduce((total, node) => total + Math.min(node.maxLevel, elementLevels[node.id] || 0), 0);
  return { completed, total: TOTAL_RESEARCH_UPGRADES, percent: Math.floor((completed / TOTAL_RESEARCH_UPGRADES) * 100) };
}

export function isResearchNodeUnlocked(levels: ResearchTechLevels | undefined, element: ElementType, node: ResearchNode) {
  return node.requirements.every(req => getResearchLevel(levels, element, req.node) >= req.level);
}

export function getResearchStatBonuses(levels: ResearchTechLevels | undefined, element: ElementType) {
  const get = (id: ResearchNodeId) => getResearchLevel(levels, element, id);
  return {
    atk: get('basic_combat') + get('refined_combat') + get('advanced_combat'),
    hp: get('basic_vitality') + get('refined_vitality') + get('advanced_vitality'),
    def: get('basic_defense') + get('refined_defense') + get('advanced_defense'),
    crit: get('precision'),
    reduction: get('endurance'),
  };
}

export function getUnlockedItemSlots(levels: ResearchTechLevels | undefined, element: ElementType): boolean[] {
  const unlocked = getResearchLevel(levels, element, 'well_equipped_1') >= 1;
  const unlocked2 = getResearchLevel(levels, element, 'well_equipped_2') >= 1;
  const unlocked3 = getResearchLevel(levels, element, 'well_equipped_3') >= 1;
  return [true, unlocked, unlocked2, unlocked3, false, false];
}
