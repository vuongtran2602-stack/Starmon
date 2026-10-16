import sunkenSands from '../assets/images/arenas/sunken_sands_blur.png';
import sunnyBeach from '../assets/images/arenas/sunny_beach_blur.png';
import atlantis from '../assets/images/arenas/atlantis_blur.png';
import silentSwamp from '../assets/images/arenas/silent_swamp_blur.png';
import twilightGate from '../assets/images/arenas/twilight_gate_blur.png';
import verdiantCanopy from '../assets/images/arenas/verdiant_canopy_blur.png';
import winterWonderland from '../assets/images/arenas/winter_wonderland_blur.png';
import hiddenChamber from '../assets/images/arenas/hidden_chamber_blur.png';
import candyLand from '../assets/images/arenas/candy_land_blur.png';
import cityOfLight from '../assets/images/arenas/city_of_light_blur.png';
import hellGateBlur from '../assets/images/arenas/hell_gate_blur.png';
import hellGate from '../assets/images/arenas/hell_gate.png';
import abyssalTrenchBlur from '../assets/images/arenas/abyssal_trench_blur.png';
import abyssalTrench from '../assets/images/arenas/abyssal_trench.png';
import abandonedMineBlur from '../assets/images/arenas/abandoned_mine_blur.png';
import abandonedMine from '../assets/images/arenas/abandoned_mine.png';

export interface ArenaMap {
  name: string;
  description: string;
  background: string;
  preview: string;
}

export const ARENA_MAPS: ArenaMap[] = [
  { name: 'Sunken Sands', description: 'Sunken desert', background: sunkenSands, preview: sunkenSands },
  { name: 'Sunny Beach', description: 'Sunny shoreline', background: sunnyBeach, preview: sunnyBeach },
  { name: 'The Atlantis', description: 'Lost underwater city', background: atlantis, preview: atlantis },
  { name: 'The Silent Swamp', description: 'Quiet marshland', background: silentSwamp, preview: silentSwamp },
  { name: 'The Twilight Gate', description: 'Gate at dusk', background: twilightGate, preview: twilightGate },
  { name: 'Verdiant Canopy', description: 'Verdant forest canopy', background: verdiantCanopy, preview: verdiantCanopy },
  { name: 'Winter Wonderland', description: 'Frozen landscape', background: winterWonderland, preview: winterWonderland },
  { name: 'The Hidden Chamber', description: 'Sealed pyramid chamber', background: hiddenChamber, preview: hiddenChamber },
  { name: 'Candy Land', description: 'Colorful candy realm', background: candyLand, preview: candyLand },
  { name: 'City of Light', description: 'Radiant cityscape', background: cityOfLight, preview: cityOfLight },
  { name: 'Hell Gate', description: 'Infernal gateway', background: hellGateBlur, preview: hellGate },
  { name: 'Abyssal Trench', description: 'Deep ocean trench', background: abyssalTrenchBlur, preview: abyssalTrench },
  { name: 'Abandoned Mine', description: 'Forgotten mine', background: abandonedMineBlur, preview: abandonedMine },
];

export function getArenaMap(name?: string) {
  return ARENA_MAPS.find(map => map.name === name) || ARENA_MAPS[0];
}
