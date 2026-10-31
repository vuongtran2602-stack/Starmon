import React from 'react';
import coralusImg from '../assets/images/coralus.png';
import ignisaurImg from '../assets/images/ignisaur.png';
import tidecrushImg from '../assets/images/tidecrush.png';
import voltlynxImg from '../assets/images/voltlynx.png';
import obsidusImg from '../assets/images/obsidus.png';
import moltenbackImg from '../assets/images/moltenback.png';
import glidronImg from '../assets/images/glidron.png';
import aquanymphImg from '../assets/images/aquanymph.png';
import frostmothImg from '../assets/images/frostmoth.png';
import stoneGolemImg from '../assets/images/stone_golem.png';
import pyrokitImg from '../assets/images/pyrokit.png';
import zapwingImg from '../assets/images/zapwing.png';
import vinedraImg from '../assets/images/vinedra.png';
import bubbleboonImg from '../assets/images/bubbleboon.png';
import trojanFlareImg from '../assets/images/trojan_flare.png';
import aquanymphDpImg from '../assets/images/aquanymph_dp.png';
import cyborgnidImg from '../assets/images/cyborgnid.png';
import mineacleImg from '../assets/images/mineacle.png';
import zephyrionImg from '../assets/images/zephyrion.png';
import mosslothImg from '../assets/images/mossloth.png';
import khepriImg from '../assets/images/khepri.png';
import cottontailImg from '../assets/images/cottontail.jpeg';
import dreadhornImg from '../assets/images/dreadhorn.jpg';
import bambloomImg from '../assets/images/bambloom.jpeg';
import volzardImg from '../assets/images/volzard.jpeg';
import dandylmaneImg from '../assets/images/dandylmane.jpeg';
import manta1Img from '../assets/images/manta1.png';
import pumpyreImg from '../assets/images/pumpyre.jpeg';
import whiskerteerImg from '../assets/images/whiskerteer.jpeg';
import seaponiImg from '../assets/images/seaponi.jpeg';
import teslarionImg from '../assets/images/teslarion.png';
import {
  AQUANYMPH_DA_PHUC_IMAGE,
  CYBORGNID_IMAGE,
  MINEACLE_IMAGE,
  ZEPHYRION_IMAGE,
  MOSSLOTH_IMAGE,
  KHEPRI_IMAGE,
} from '../data/itemsData';

interface StarmonAssetProps {
  id: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  className?: string;
  animated?: boolean;
  customSrc?: string;
  isDaPhucVersion?: boolean;
}

export const StarmonAsset: React.FC<StarmonAssetProps> = ({
  id,
  size = 'md',
  className = '',
  animated = false,
  customSrc,
  isDaPhucVersion = false,
}) => {
  const safeId = typeof id === 'string' ? id : (id ? String(id) : '');
  let normId = safeId.toLowerCase().replace(/[-_]removebg/g, '').replace(/[-_]/g, '');

  // If this is Aquanymph and isDaPhucVersion is true, render Da Phuc form
  if (normId === 'aquanymph' && isDaPhucVersion) {
    normId = 'aquanymphdaphuc';
  }
  const forceUpdatedLocalArt = ['teslarion', 'aquanymph', 'aquanymphdaphuc', 'aquanymphdp', 'daphuc', 'pyrokit', 'obsidus'].includes(normId);

  // Keep Ignisaur, Coralus, and Voltlynx at 100% scale, reduce all other Starmons by 20% (scale 0.8)
  const isPreserved = ['ignisaur', 'coralus', 'voltlynx'].includes(normId);

  const sizeClasses = {
    xs: 'w-8 h-8',
    sm: 'w-12 h-12',
    md: 'w-20 h-20 md:w-24 md:h-24',
    lg: 'w-36 h-36 md:w-44 md:h-44',
    xl: 'w-48 h-48 md:w-60 md:h-60',
    custom: '',
  }[size];

  const anim = animated ? 'animate-bounce-slow' : '';

  return (
    <div className={`relative flex items-center justify-center shrink-0 ${sizeClasses} ${anim} ${className}`}>
      <div
        className="w-full h-full flex items-center justify-center transition-transform"
        style={isPreserved ? undefined : { transform: 'scale(0.8)', transformOrigin: 'center' }}
      >
        {customSrc && !forceUpdatedLocalArt ? (
          <img
            src={customSrc}
            alt={id}
            className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
          />
        ) : (
          renderGraphic(normId)
        )}
      </div>
    </div>
  );
};

function renderGraphic(id: string) {
  // Use provided official transparent PNG images
  switch (id) {
    case 'coralus':
      return (
        <img
          src={coralusImg}
          alt="Coralus"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        />
      );

    case 'ignisaur':
      return (
        <img
          src={ignisaurImg}
          alt="Ignisaur"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        />
      );

    case 'tidecrush':
      return (
        <img
          src={tidecrushImg}
          alt="Tidecrush"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        />
      );

    case 'voltlynx':
      return (
        <img
          src={voltlynxImg}
          alt="Voltlynx"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        />
      );

    case 'obsidus':
      return (
        <img
          src={obsidusImg}
          alt="Obsidus"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        />
      );

    case 'stonegolem':
    case 'stone_golem':
    case 'golem':
      return (
        <img
          src={stoneGolemImg}
          alt="Stone Golem"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        />
      );

    case 'moltenback':
      return (
        <img
          src={moltenbackImg}
          alt="Moltenback"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        />
      );

    case 'glidron':
      return (
        <img
          src={glidronImg}
          alt="Glidron"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        />
      );

    case 'aquanymph':
      return (
        <img
          src={aquanymphImg}
          alt="Aquanymph"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        />
      );

    case 'aquanymphdaphuc':
    case 'aquanymph_daphuc':
    case 'aquanymphdp':
    case 'aquanymph_dp':
    case 'daphuc':
      return (
        <img
          src={aquanymphDpImg}
          alt="Aquanymph Đa Phúc"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
          onError={(e) => {
            (e.target as HTMLImageElement).src = AQUANYMPH_DA_PHUC_IMAGE;
          }}
        />
      );

    case 'frostmoth':
      return (
        <img
          src={frostmothImg}
          alt="Frostmoth"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        />
      );

    case 'pyrokit':
    case 'piyrokit':
      return (
        <img
          src={pyrokitImg}
          alt="Pyrokit"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        />
      );

    case 'zapwing':
      return (
        <img
          src={zapwingImg}
          alt="Zapwing"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        />
      );

    case 'vinedra':
      return (
        <img
          src={vinedraImg}
          alt="Vinedra"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        />
      );

    case 'bubbleboon':
    case 'bubblebaboon':
      return (
        <img
          src={bubbleboonImg}
          alt="Bubbleboon"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        />
      );

    case 'trojanflare':
    case 'trojan_flare':
      return (
        <img
          src={trojanFlareImg}
          alt="Trojan Flare"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
        />
      );

    case 'cyborgnid':
      return (
        <img
          src={cyborgnidImg}
          alt="Cyborgnid"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
          onError={(e) => {
            (e.target as HTMLImageElement).src = CYBORGNID_IMAGE;
          }}
        />
      );

    case 'mineacle':
      return (
        <img
          src={mineacleImg}
          alt="Mineacle"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
          onError={(e) => {
            (e.target as HTMLImageElement).src = MINEACLE_IMAGE;
          }}
        />
      );

    case 'zephyrion':
    case 'zypherion':
      return (
        <img
          src={zephyrionImg}
          alt="Zephyrion"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none transform scale-[0.8]"
          onError={(e) => {
            (e.target as HTMLImageElement).src = ZEPHYRION_IMAGE;
          }}
        />
      );

    case 'mossloth':
      return (
        <img
          src={mosslothImg}
          alt="Mossloth"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
          onError={(e) => {
            (e.target as HTMLImageElement).src = MOSSLOTH_IMAGE;
          }}
        />
      );

    case 'khepri':
      return (
        <img
          src={khepriImg}
          alt="Khepri"
          className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none"
          onError={(e) => {
            (e.target as HTMLImageElement).src = KHEPRI_IMAGE;
          }}
        />
      );

    case 'cottontail':
      return <img src={cottontailImg} alt="Cottontail" className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none" />;

    case 'dreadhorn':
      return <img src={dreadhornImg} alt="Dreadhorn" className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none" />;

    case 'bambloom':
      return <img src={bambloomImg} alt="Bambloom" className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none" />;

    case 'volzard':
      return <img src={volzardImg} alt="Volzard" className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none" />;
    case 'dandylmane':
      return <img src={dandylmaneImg} alt="Dandylmane" className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none" />;
    case 'manta1':
      return <img src={manta1Img} alt="Manta-1" className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none" />;
    case 'pumpyre':
      return <img src={pumpyreImg} alt="Pumpyre" className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none" />;
    case 'whiskerteer':
      return <img src={whiskerteerImg} alt="Whiskerteer" className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none" />;
    case 'seaponi':
      return <img src={seaponiImg} alt="Seaponi" className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none" />;

    case 'teslarion':
      return (
        <img src={teslarionImg} alt="Teslarion" className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none" />
      );

    default:
      return (
        <div className="w-full h-full rounded-2xl bg-indigo-900/60 border border-indigo-400 flex items-center justify-center text-3xl">
          ✨
        </div>
      );
  }
}
