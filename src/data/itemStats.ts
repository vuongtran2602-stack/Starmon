import { EquipmentItem } from '../types';
import { EQUIPMENT_ITEMS_CATALOG } from './itemsData';
import miningExpeditionImage from '../assets/images/mining_expedition.jpg';

export type EquipmentStage = 'early' | 'mid1' | 'mid2' | 'mid3' | 'late';

// Item stat gains and Level Up costs transcribed from Item Stat.pdf.
export const OLD_PICKAXE_GAINS: Record<EquipmentStage, { atk: number }> = {
  early: { atk: 3.6 },
  mid1: { atk: 6.0 },
  mid2: { atk: 8.4 },
  mid3: { atk: 12.0 },
  late: { atk: 21.3 },
};

export const ITEM_CRAFT_COST = { gold: 200, starShards: 50, energy: 50, minutes: 60 } as const;

type ItemSlotType = NonNullable<EquipmentItem['slotType']>;
type ItemStats = { hp: number; atk: number; def: number };

const ITEM_BASE_STATS: Record<ItemSlotType, ItemStats> = {
  headwear: { hp: 20, atk: 0, def: 3 },
  body_armor: { hp: 40, atk: 0, def: 1 },
  boots: { hp: 25, atk: 0, def: 2 },
  handheld: { hp: 0, atk: 8, def: 0 },
  handheld_shield: { hp: 0, atk: 2, def: 5 },
  relic: { hp: 25, atk: 2, def: 3 },
  special: { hp: 0, atk: 0, def: 0 },
};

const ITEM_LEVEL_GAINS: Record<EquipmentStage, Record<ItemSlotType, ItemStats>> = {
  early: {
    headwear: { hp: 12.1, atk: 0, def: 1.0 }, body_armor: { hp: 22.4, atk: 0, def: 0.3 },
    boots: { hp: 15.5, atk: 0, def: 0.7 }, handheld: { hp: 0, atk: 3.6, def: 0 },
    handheld_shield: { hp: 0, atk: 0.4, def: 1.7 }, relic: { hp: 12.1, atk: 0.7, def: 1.0 }, special: { hp: 0, atk: 0, def: 0 },
  },
  mid1: {
    headwear: { hp: 20.1, atk: 0, def: 1.7 }, body_armor: { hp: 37.4, atk: 0, def: 0.6 },
    boots: { hp: 25.9, atk: 0, def: 1.2 }, handheld: { hp: 0, atk: 6.0, def: 0 },
    handheld_shield: { hp: 0, atk: 0.7, def: 2.8 }, relic: { hp: 20.1, atk: 1.2, def: 1.7 }, special: { hp: 0, atk: 0, def: 0 },
  },
  mid2: {
    headwear: { hp: 28.2, atk: 0, def: 2.4 }, body_armor: { hp: 52.3, atk: 0, def: 0.8 },
    boots: { hp: 36.2, atk: 0, def: 1.7 }, handheld: { hp: 0, atk: 8.4, def: 0 },
    handheld_shield: { hp: 0, atk: 0.9, def: 4.0 }, relic: { hp: 28.2, atk: 1.6, def: 2.4 }, special: { hp: 0, atk: 0, def: 0 },
  },
  mid3: {
    headwear: { hp: 40.3, atk: 0, def: 3.4 }, body_armor: { hp: 74.7, atk: 0, def: 1.1 },
    boots: { hp: 51.7, atk: 0, def: 2.5 }, handheld: { hp: 0, atk: 12.0, def: 0 },
    handheld_shield: { hp: 0, atk: 1.3, def: 5.7 }, relic: { hp: 40.3, atk: 2.3, def: 3.4 }, special: { hp: 0, atk: 0, def: 0 },
  },
  late: {
    headwear: { hp: 71.4, atk: 0, def: 6.1 }, body_armor: { hp: 132.4, atk: 0, def: 2.0 },
    boots: { hp: 91.7, atk: 0, def: 4.4 }, handheld: { hp: 0, atk: 21.3, def: 0 },
    handheld_shield: { hp: 0, atk: 2.4, def: 10.1 }, relic: { hp: 71.4, atk: 4.1, def: 6.1 }, special: { hp: 0, atk: 0, def: 0 },
  },
};

type CostBand = { from: number; to: number; shards: number; gold: number; shardsTo?: number; goldTo?: number };

const UPGRADE_COST_BANDS: CostBand[] = [
  { from: 2, to: 5, shards: 5, gold: 100 },
  { from: 6, to: 10, shards: 10, gold: 250 },
  { from: 11, to: 15, shards: 15, gold: 400 },
  { from: 16, to: 20, shards: 20, gold: 800 },
  { from: 21, to: 25, shards: 25, gold: 1200 },
  { from: 26, to: 30, shards: 30, gold: 1600, shardsTo: 150, goldTo: 5000 },
  { from: 31, to: 35, shards: 180, gold: 8000 },
  { from: 36, to: 40, shards: 240, gold: 10000 },
  { from: 41, to: 45, shards: 400, gold: 12000 },
  { from: 46, to: 50, shards: 550, gold: 15000, shardsTo: 700, goldTo: 30000 },
  { from: 51, to: 55, shards: 750, gold: 35000 },
  { from: 56, to: 60, shards: 900, gold: 40000 },
  { from: 61, to: 65, shards: 1150, gold: 45000 },
  { from: 66, to: 70, shards: 1200, gold: 50000, shardsTo: 2400, goldTo: 100000 },
  { from: 71, to: 75, shards: 2600, gold: 120000 },
  { from: 76, to: 80, shards: 3000, gold: 140000 },
  { from: 81, to: 85, shards: 4600, gold: 160000 },
  { from: 86, to: 90, shards: 5200, gold: 180000, shardsTo: 8000, goldTo: 300000 },
  { from: 91, to: 95, shards: 8500, gold: 350000 },
  { from: 96, to: 100, shards: 9000, gold: 400000 },
];

const interpolate = (start: number, end: number, index: number, count: number) =>
  Math.round(start + ((end - start) * index) / Math.max(1, count - 1));

export function getEquipmentUpgradeCost(targetLevel: number): { shards: number; gold: number } | null {
  const band = UPGRADE_COST_BANDS.find(entry => targetLevel >= entry.from && targetLevel <= entry.to);
  if (!band) return null;
  if (!band.shardsTo || !band.goldTo) return { shards: band.shards, gold: band.gold };
  const index = targetLevel - band.from;
  const count = band.to - band.from + 1;
  return {
    shards: interpolate(band.shards, band.shardsTo, index, count),
    gold: interpolate(band.gold, band.goldTo, index, count),
  };
}

export function getItemLevelStats(itemId: string, level: number): { hp: number; atk: number; def: number } {
  const slotType = EQUIPMENT_ITEMS_CATALOG[itemId]?.slotType;
  if (!slotType) return { hp: 0, atk: 0, def: 0 };
  const stats = { ...ITEM_BASE_STATS[slotType] };
  const boundedLevel = Math.max(1, Math.min(100, level));
  for (let target = 2; target <= boundedLevel; target += 1) {
    const stage: EquipmentStage = target > 75 ? 'late'
      : target > 60 ? 'mid3'
      : target > 45 ? 'mid2'
      : target > 30 ? 'mid1'
      : 'early';
    const gain = ITEM_LEVEL_GAINS[stage][slotType];
    stats.hp += Math.round(gain.hp);
    stats.atk += Math.round(gain.atk);
    stats.def += Math.round(gain.def);
  }
  return stats;
}

export const BLACKSMITH_OPTION_IMAGES = {
  upgrade: 'https://www.dropbox.com/scl/fi/6jfchf1qc9o8kfh69qvis/Upgrade-Item.png?rlkey=5rs8dmw51xyoycaq7qtfl67av&st=dqir6qlk&raw=1',
  craft: 'https://www.dropbox.com/scl/fi/lp83r1q4trltwbu8xe2bn/Craft-Item.png?rlkey=zu72h4hdeqlcaewjo5p2036oq&st=0ywrhdrt&raw=1',
  miningExpedition: miningExpeditionImage,
  forge: 'https://www.dropbox.com/scl/fi/mm2ylb00phhnuknsniigq/Magical-Craft.png?rlkey=qq697rqffs2imp0z47z3aofa1&st=carl77j8&raw=1',
};

export const ITEM_STAT_SUMMARY: Record<string, Pick<EquipmentItem, 'bulletStats' | 'description'>> = {
  old_pickaxe: {
    bulletStats: ['ATK +8 (Level 1)', 'Handheld'],
    description: 'A common handheld item. Its ATK increases as it levels up.',
  },
};
