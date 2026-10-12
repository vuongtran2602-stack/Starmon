import { EquipmentItem } from '../types';
import oldPickaxeImg from '../assets/images/old_pickaxe.png';
import daPhucUniformImg from '../assets/images/da_phuc_uniform.png';
import aquanymphDpImg from '../assets/images/aquanymph_dp.png';
import hatcheryImg from '../assets/images/hatchery.png';
import blacksmithImg from '../assets/images/blacksmith.png';
import shroomlabImg from '../assets/images/shroomlab.png';
import transparentCloudImg from '../assets/images/transparent_cloud.jpeg';
import newCloudImg from '../assets/images/new_cloud.png';
import cyborgnidImg from '../assets/images/cyborgnid.png';
import mineacleImg from '../assets/images/mineacle.png';
import zephyrionImg from '../assets/images/zephyrion.png';
import mosslothImg from '../assets/images/mossloth.png';
import khepriImg from '../assets/images/khepri.png';

export function toDirectDropboxUrl(url: string): string {
  if (!url) return '';
  let direct = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
  if (direct.includes('dl=0')) {
    direct = direct.replace('dl=0', 'raw=1');
  } else if (!direct.includes('raw=1')) {
    direct += (direct.includes('?') ? '&' : '?') + 'raw=1';
  }
  return direct;
}

// -------------------------------------------------------------
// EQUIPMENT UPGRADE & ENHANCE ITEMS
// -------------------------------------------------------------
export const STAR_SHARD_IMAGE = toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/2p76tf6dvki6j2baz1ksp/Star_Shard-removebg.png?rlkey=t778famb7l7dp7ok3alzkz82w&st=612rc8xh&dl=0'
);

export const ROYAL_TOKENS_IMAGE = toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/eq4l3dfm7ye5315fctcul/Royal_Tokens-removebg.png?rlkey=2p8n3fw31mzwmiklcux98pm94&st=dmjvfetl&dl=0'
);

export const GOLDEN_ANVIL_IMAGE = toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/osxxt4jpd9x19ulpyr2s3/Golden_Anvil-removebg.png?rlkey=w5b8e7dolmjejl352aalzxoqj&st=28ukah6o&dl=0'
);

// -------------------------------------------------------------
// ENERGY BAR IMAGES (0-10, 11-29, 30-59, 60-79, 80-100+)
// -------------------------------------------------------------
export const ENERGY_BAR_0_10_IMAGE = toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/u4qujjphw1tfz716f4gwv/0-Energy-bar.png?rlkey=26hhkk5fdk2928rwdsp6apuv1&st=0na0gf42&dl=0'
);

export const ENERGY_BAR_11_29_IMAGE = toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/7fte9nxo9bxnimvbt4wyb/30-Energy-bar.png?rlkey=qbwd9vzzhi0kt05q3te7c19ad&st=jnpor9vv&dl=0'
);

export const ENERGY_BAR_30_59_IMAGE = toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/70uuzr405v8am1vrlb94e/50-Energy-bar.png?rlkey=nulqtx1h07l25rv7kdib4jp1s&st=epk0gmc7&dl=0'
);

export const ENERGY_BAR_60_79_IMAGE = toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/7u6g6rgxmhahnjrrnm8bj/70-Energy-bar.png?rlkey=3lqzjqp10ulb3vvoh164a5s35&st=ssvk4l3x&dl=0'
);

export const ENERGY_BAR_80_100_IMAGE = toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/pws1ruro3l4lkxkxpsqxi/100-Energy-bar.png?rlkey=7jx77q8ga7r3ltszrbbvcq4ra&st=3cav66z6&dl=0'
);

export function getEnergyBarImage(energy: number): string {
  if (energy <= 10) {
    return ENERGY_BAR_0_10_IMAGE;
  } else if (energy <= 29) {
    return ENERGY_BAR_11_29_IMAGE;
  } else if (energy <= 59) {
    return ENERGY_BAR_30_59_IMAGE;
  } else if (energy <= 79) {
    return ENERGY_BAR_60_79_IMAGE;
  } else {
    return ENERGY_BAR_80_100_IMAGE;
  }
}

// -------------------------------------------------------------
// ENERGY BATTERY ITEMS (50🗲, 100🗲, 200🗲)
// -------------------------------------------------------------
export const ENERGY_BATTERY_50_IMAGE = toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/pqmbkjg0b5rc3axukakc3/50_Energy-removebg.png?rlkey=4pmlbq9n96i76ebaaf27ppzbd&st=t3vpekgs&dl=0'
);

export const ENERGY_BATTERY_100_IMAGE = toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/o0fmjpn6hpk08g5fgfeol/100_Energy-removebg.png?rlkey=rvggzvrufn65cb26gh07f7fcf&st=5876d19q&dl=0'
);

export const ENERGY_BATTERY_200_IMAGE = toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/gz0c2i3ub69jts4olhd4f/200_Energy-removebg.png?rlkey=ahfhpsvpgco5sfriugzr97bqt&st=5hsu8lyv&dl=0'
);

export const NEW_CLOUD_IMAGE = newCloudImg || toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/m072lushrjohbnzpvitv5/download-removebg-preview.png?rlkey=l4dd6piovwuc05zrysagp4z0j&st=tyxpuxld&dl=0'
);

export const TRANSPARENT_CLOUD_IMAGE = NEW_CLOUD_IMAGE;

export const CYBORGNID_IMAGE = cyborgnidImg || toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/4z3qm3wcb33im3palhrjd/Cyborgnid-removebg.png?rlkey=zu6qafz4hh90vchx4c9dn1c82&st=hhpugm1t&dl=0'
);

export const MINEACLE_IMAGE = mineacleImg || toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/loszcd16rfax6elpatuek/Mineacle-removebg.png?rlkey=b2chrssmmjv6qqixkeqgavn5e&st=tmb45nbc&dl=0'
);

export const ZEPHYRION_IMAGE = zephyrionImg || toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/t5ckbb2bu9h3nq1evgvwj/Zypherion-removebg.png?rlkey=yp1dqto8k1jkwoh8c6wxqazv9&st=1htkq5cv&dl=0'
);

export const MOSSLOTH_IMAGE = mosslothImg || toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/43ez40i15cd2q8kv7h56m/Mossloth-removebg-preview.png?rlkey=xhn3gql75kfe90e5a4t21jfnr&st=7qqhkxm4&dl=0'
);

export const KHEPRI_IMAGE = khepriImg || toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/k1ygbqfu4jcd2u4igoc0p/Khepri-removebg.png?rlkey=uxgb2uswbt3hozbgkiuzj56vy&st=57xxj366&dl=0'
);

export const OLD_PICKAXE_IMAGE = oldPickaxeImg || toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/85qo5lfq6vtj6043xkpe3/Wooden_Pickaxe-removebg.png?rlkey=nyz2bo49jjfzfocww4pur22ou&st=4eyf8m43&dl=0'
);

export const DA_PHUC_UNIFORM_IMAGE = daPhucUniformImg || toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/q2k1gg2zpbnzb0egyufpw/Da-Phuc-Uniform.png?rlkey=zh55og1c842i8eq4eus6zmas5&st=7d4tsvyr&dl=0'
);

export const AQUANYMPH_DA_PHUC_IMAGE = aquanymphDpImg || toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/43i8rxojz14s9nittcw9j/Aquanymph-DP.png?rlkey=4ykgx5s7jxeivz7ado4kdnhy7&st=c36b8twk&dl=0'
);

export const HATCHERY_IMAGE = hatcheryImg || toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/hqucobmnhzpi7fcqavipi/Hatchery.png?rlkey=2klxifr00z7jyw8hda3yg2bso&st=aip42mci&dl=0'
);

export const BLACKSMITH_IMAGE = blacksmithImg || toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/fwx867hguhej4kp0trxnj/Blacksmith-removebg.png?rlkey=fc2b6ot9fuiwh2gf030qxg913&st=y9k7wr4e&dl=0'
);

export const SHROOMLAB_IMAGE = shroomlabImg || toDirectDropboxUrl(
  'https://www.dropbox.com/scl/fi/4tjwfq5p50anu16gvt05z/ShroomLab-removebg.png?rlkey=shwh6g5gpnfcqwco8o44iovj5&st=dzgjzs2o&dl=0'
);

export const EQUIPMENT_ITEMS_CATALOG: Record<string, EquipmentItem> = {
  old_pickaxe: {
    id: 'old_pickaxe',
    name: 'Old Pickaxe',
    description: 'A common handheld item. Its ATK increases as it levels up.',
    bulletStats: ['ATK +8 (Level 1)'],
    imageUrl: OLD_PICKAXE_IMAGE,
    rarity: 'common',
    slotType: 'handheld',
  },
  da_phuc_uniform: {
    id: 'da_phuc_uniform',
    name: 'Da Phuc Uniform',
    description: 'Equip on Aquanymph to awaken the exclusive scholar form: Aquanymph Da Phuc.',
    bulletStats: [
      'Exclusive Da Phuc Academy School Uniform',
      'Awakens special form: Aquanymph Da Phuc',
    ],
    imageUrl: DA_PHUC_UNIFORM_IMAGE,
    targetStarmonId: 'aquanymph',
    rarity: 'legendary',
    slotType: 'special',
  },
};
