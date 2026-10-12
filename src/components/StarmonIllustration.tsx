import React from 'react';
import bubbleboonImg from '../assets/images/bubbleboon.png';
import trojanFlareImg from '../assets/images/trojan_flare.png';
import mosslothImg from '../assets/images/mossloth.png';
import khepriImg from '../assets/images/khepri.png';

interface Props {
  seed: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animated?: boolean;
}

export const StarmonIllustration: React.FC<Props> = ({
  seed,
  size = 'md',
  className = '',
  animated = false,
}) => {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-24 h-24',
    lg: 'w-44 h-44',
    xl: 'w-64 h-64',
  }[size];

  const animClass = animated ? 'animate-bounce-slow' : '';

  // Return custom crafted SVGs modeled after the user's uploaded images
  switch (seed) {
    case 'coralus':
      // Blue crab guardian from main hub
      return (
        <div className={`relative flex items-center justify-center ${sizeClasses} ${animClass} ${className}`}>
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="crabBody" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id="crabBelly" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="100%" stopColor="#fef9c3" />
              </linearGradient>
              <linearGradient id="crabClaw" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
            </defs>
            {/* Legs */}
            <path d="M 60 140 Q 40 165 50 175" stroke="#0284c7" strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M 75 145 Q 65 170 75 180" stroke="#0284c7" strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M 140 140 Q 160 165 150 175" stroke="#0284c7" strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M 125 145 Q 135 170 125 180" stroke="#0284c7" strokeWidth="8" strokeLinecap="round" fill="none" />
            {/* Main Shell */}
            <ellipse cx="100" cy="115" rx="55" ry="45" fill="url(#crabBody)" stroke="#0369a1" strokeWidth="4" />
            {/* Belly Plates */}
            <path d="M 68 105 Q 100 135 132 105 Q 132 140 100 148 Q 68 140 68 105 Z" fill="url(#crabBelly)" stroke="#ca8a04" strokeWidth="2.5" />
            <line x1="74" y1="120" x2="126" y2="120" stroke="#eab308" strokeWidth="2" strokeDasharray="3,2" />
            <line x1="80" y1="133" x2="120" y2="133" stroke="#eab308" strokeWidth="2" strokeDasharray="3,2" />
            {/* Eyes Stalks */}
            <path d="M 85 75 Q 80 50 78 45" stroke="#0369a1" strokeWidth="6" strokeLinecap="round" />
            <circle cx="78" cy="45" r="10" fill="#fef08a" stroke="#0369a1" strokeWidth="3" />
            <ellipse cx="78" cy="45" rx="4" ry="7" fill="#0f172a" />
            <circle cx="76" cy="43" r="2" fill="#ffffff" />

            <path d="M 115 75 Q 120 50 122 45" stroke="#0369a1" strokeWidth="6" strokeLinecap="round" />
            <circle cx="122" cy="45" r="10" fill="#fef08a" stroke="#0369a1" strokeWidth="3" />
            <ellipse cx="122" cy="45" rx="4" ry="7" fill="#0f172a" />
            <circle cx="120" cy="43" r="2" fill="#ffffff" />

            {/* Cute Face */}
            <path d="M 94 98 Q 100 104 106 98" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
            <circle cx="82" cy="98" r="4" fill="#fda4af" opacity="0.7" />
            <circle cx="118" cy="98" r="4" fill="#fda4af" opacity="0.7" />

            {/* Left Big Claw */}
            <g transform="rotate(-15 45 100)">
              <path d="M 45 105 Q 20 80 25 55 Q 38 65 42 75 Q 55 50 65 60 Q 55 85 45 105 Z" fill="url(#crabClaw)" stroke="#0369a1" strokeWidth="4" />
            </g>
            {/* Right Big Claw */}
            <g transform="rotate(15 155 100)">
              <path d="M 155 105 Q 180 80 175 55 Q 162 65 158 75 Q 145 50 135 60 Q 145 85 155 105 Z" fill="url(#crabClaw)" stroke="#0369a1" strokeWidth="4" />
            </g>
          </svg>
        </div>
      );

    case 'pyrokit':
      // Red nine-tailed fox with flame forehead
      return (
        <div className={`relative flex items-center justify-center ${sizeClasses} ${animClass} ${className}`}>
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="foxFur" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#e11d48" />
              </linearGradient>
              <linearGradient id="foxWhite" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#ffe4e6" />
              </linearGradient>
            </defs>
            {/* 9 Fluffy Tails Fan */}
            <g opacity="0.95">
              <path d="M 100 120 Q 30 70 35 40 Q 60 55 100 120 Z" fill="url(#foxFur)" />
              <path d="M 100 120 Q 50 50 65 25 Q 85 45 100 120 Z" fill="url(#foxFur)" />
              <path d="M 100 120 Q 80 30 100 15 Q 115 35 100 120 Z" fill="url(#foxFur)" />
              <path d="M 100 120 Q 120 30 135 25 Q 150 50 100 120 Z" fill="url(#foxFur)" />
              <path d="M 100 120 Q 150 55 165 40 Q 170 70 100 120 Z" fill="url(#foxFur)" />
              {/* White tail tips */}
              <circle cx="37" cy="45" r="7" fill="url(#foxWhite)" />
              <circle cx="67" cy="30" r="8" fill="url(#foxWhite)" />
              <circle cx="100" cy="20" r="9" fill="url(#foxWhite)" />
              <circle cx="133" cy="30" r="8" fill="url(#foxWhite)" />
              <circle cx="163" cy="45" r="7" fill="url(#foxWhite)" />
            </g>
            {/* Body */}
            <ellipse cx="100" cy="130" rx="36" ry="32" fill="url(#foxFur)" stroke="#9f1239" strokeWidth="3" />
            <path d="M 90 125 Q 100 145 110 125 Q 100 155 90 125 Z" fill="url(#foxWhite)" />
            {/* Head */}
            <circle cx="100" cy="100" r="30" fill="url(#foxFur)" stroke="#9f1239" strokeWidth="3" />
            {/* Ears */}
            <polygon points="78,82 65,50 88,68" fill="url(#foxFur)" stroke="#9f1239" strokeWidth="2.5" />
            <polygon points="80,78 72,58 86,70" fill="#fda4af" />
            <polygon points="122,82 135,50 112,68" fill="url(#foxFur)" stroke="#9f1239" strokeWidth="2.5" />
            <polygon points="120,78 128,58 114,70" fill="#fda4af" />
            {/* Face details */}
            <circle cx="89" cy="98" r="4.5" fill="#4c0519" />
            <circle cx="88" cy="96" r="1.5" fill="#ffffff" />
            <circle cx="111" cy="98" r="4.5" fill="#4c0519" />
            <circle cx="110" cy="96" r="1.5" fill="#ffffff" />
            <polygon points="98,104 102,104 100,107" fill="#4c0519" />
            <path d="M 96 109 Q 100 113 104 109" stroke="#4c0519" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Flame Forehead Symbol */}
            <path d="M 100 82 Q 104 88 100 93 Q 96 88 100 82 Z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1" />
            {/* Paws */}
            <ellipse cx="85" cy="155" rx="8" ry="6" fill="#881337" />
            <ellipse cx="115" cy="155" rx="8" ry="6" fill="#881337" />
          </svg>
        </div>
      );

    case 'ignisaur':
      // Red flame dragon
      return (
        <div className={`relative flex items-center justify-center ${sizeClasses} ${animClass} ${className}`}>
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="dragonRed" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="100%" stopColor="#b91c1c" />
              </linearGradient>
              <linearGradient id="dragonChest" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
            {/* Flame Tail */}
            <path d="M 70 145 Q 40 160 30 135 Q 25 105 38 95 Q 42 120 70 145 Z" fill="url(#dragonRed)" />
            <path d="M 32 105 Q 20 85 30 75 Q 45 90 35 110 Z" fill="#fbbf24" />
            <path d="M 30 85 Q 25 70 35 65 Q 40 75 32 90 Z" fill="#ef4444" />
            {/* Dragon Wings */}
            <path d="M 115 100 Q 145 75 160 85 Q 145 98 150 115 Q 130 110 115 100 Z" fill="#991b1b" stroke="#7f1d1d" strokeWidth="2" />
            {/* Body */}
            <ellipse cx="95" cy="130" rx="35" ry="38" fill="url(#dragonRed)" stroke="#7f1d1d" strokeWidth="3" />
            {/* Belly / Scale Plates */}
            <path d="M 85 110 Q 105 115 115 125 Q 115 155 90 162 Q 80 140 85 110 Z" fill="url(#dragonChest)" stroke="#ea580c" strokeWidth="2" />
            {/* Head & Horns */}
            <polygon points="85,70 70,50 90,62" fill="#7f1d1d" />
            <polygon points="110,68 125,48 105,62" fill="#7f1d1d" />
            <ellipse cx="98" cy="85" rx="26" ry="24" fill="url(#dragonRed)" stroke="#7f1d1d" strokeWidth="3" />
            {/* Dragon Eyes */}
            <ellipse cx="90" cy="82" rx="4.5" ry="6" fill="#fef08a" />
            <ellipse cx="90" cy="82" rx="1.5" ry="5" fill="#450a0a" />
            <ellipse cx="110" cy="82" rx="4.5" ry="6" fill="#fef08a" />
            <ellipse cx="110" cy="82" rx="1.5" ry="5" fill="#450a0a" />
            {/* Mouth / Teeth */}
            <path d="M 94 95 Q 102 102 110 95" stroke="#450a0a" strokeWidth="2" fill="none" />
            <polygon points="98,96 100,99 102,96" fill="#ffffff" />
            {/* Feet */}
            <path d="M 80 162 L 72 174 L 86 174 Z" fill="#7f1d1d" />
            <path d="M 110 162 L 102 174 L 118 174 Z" fill="#7f1d1d" />
          </svg>
        </div>
      );

    case 'tidecrush':
      // Blue Shark warrior with ice dual blades & coral armor
      return (
        <div className={`relative flex items-center justify-center ${sizeClasses} ${animClass} ${className}`}>
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="sharkBlue" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id="iceBlade" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0f2fe" />
                <stop offset="50%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
            </defs>
            {/* Coral Shoulder Pauldrons */}
            <path d="M 60 90 Q 50 70 65 72 Q 55 60 72 68 Q 80 85 75 95 Z" fill="#f43f5e" stroke="#be123c" strokeWidth="2" />
            <path d="M 140 90 Q 150 70 135 72 Q 145 60 128 68 Q 120 85 125 95 Z" fill="#f43f5e" stroke="#be123c" strokeWidth="2" />
            {/* Shark Body & Dorsal Fin */}
            <path d="M 100 50 Q 130 35 125 65 Z" fill="#0369a1" />
            <ellipse cx="100" cy="115" rx="36" ry="42" fill="url(#sharkBlue)" stroke="#0369a1" strokeWidth="3" />
            <ellipse cx="100" cy="120" rx="20" ry="30" fill="#f0f9ff" />
            {/* Shark Head */}
            <path d="M 75 85 Q 100 55 125 85 Q 100 102 75 85 Z" fill="url(#sharkBlue)" stroke="#0369a1" strokeWidth="3" />
            {/* Sharp Eyes */}
            <circle cx="88" cy="80" r="4.5" fill="#0284c7" />
            <circle cx="87" cy="79" r="1.5" fill="#ffffff" />
            <circle cx="112" cy="80" r="4.5" fill="#0284c7" />
            <circle cx="111" cy="79" r="1.5" fill="#ffffff" />
            {/* Smirk Teeth */}
            <path d="M 92 90 L 96 95 L 100 90 L 104 95 L 108 90" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Dual Ice Blades Crossed */}
            <path d="M 50 145 L 85 110 L 95 118 L 60 153 Z" fill="url(#iceBlade)" stroke="#0284c7" strokeWidth="2" />
            <path d="M 150 145 L 115 110 L 105 118 L 140 153 Z" fill="url(#iceBlade)" stroke="#0284c7" strokeWidth="2" />
          </svg>
        </div>
      );

    case 'glidron':
      // Flying squirrel with electric gliding wings
      return (
        <div className={`relative flex items-center justify-center ${sizeClasses} ${animClass} ${className}`}>
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="glideWing" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            {/* Glider Wings Expanded */}
            <path d="M 40 85 Q 90 120 60 140 Q 30 115 40 85 Z" fill="url(#glideWing)" opacity="0.9" stroke="#d97706" strokeWidth="2" />
            <path d="M 160 85 Q 110 120 140 140 Q 170 115 160 85 Z" fill="url(#glideWing)" opacity="0.9" stroke="#d97706" strokeWidth="2" />
            {/* Lightning bolts on wings */}
            <polygon points="50,95 44,108 52,108 46,122 58,105 51,105" fill="#ffffff" />
            <polygon points="150,95 144,108 152,108 146,122 158,105 151,105" fill="#ffffff" />
            {/* Squirrel Body */}
            <ellipse cx="100" cy="115" rx="30" ry="32" fill="#fafaf9" stroke="#78716c" strokeWidth="3" />
            <ellipse cx="100" cy="118" rx="18" ry="22" fill="#f5f5f4" />
            {/* Big Fluffy Tail */}
            <path d="M 118 135 Q 155 160 170 135 Q 185 110 155 125 Z" fill="#fafaf9" stroke="#78716c" strokeWidth="2.5" />
            {/* Head & Big Eyes */}
            <circle cx="100" cy="85" r="24" fill="#fafaf9" stroke="#78716c" strokeWidth="3" />
            <circle cx="84" cy="70" r="7" fill="#fafaf9" stroke="#78716c" strokeWidth="2" />
            <circle cx="116" cy="70" r="7" fill="#fafaf9" stroke="#78716c" strokeWidth="2" />
            {/* Anime Sparkle Eyes */}
            <circle cx="92" cy="85" r="6" fill="#3b82f6" />
            <circle cx="90" cy="83" r="2" fill="#ffffff" />
            <circle cx="108" cy="85" r="6" fill="#3b82f6" />
            <circle cx="106" cy="83" r="2" fill="#ffffff" />
            <circle cx="86" cy="92" r="3.5" fill="#f472b6" opacity="0.6" />
            <circle cx="114" cy="92" r="3.5" fill="#f472b6" opacity="0.6" />
            <ellipse cx="100" cy="91" rx="2" ry="1.5" fill="#44403c" />
          </svg>
        </div>
      );

    case 'voltlynx':
      // Electric tiger cub with black stripes & blue eyes
      return (
        <div className={`relative flex items-center justify-center ${sizeClasses} ${animClass} ${className}`}>
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="lynxGold" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#eab308" />
              </linearGradient>
            </defs>
            {/* Body */}
            <ellipse cx="100" cy="120" rx="38" ry="30" fill="url(#lynxGold)" stroke="#a16207" strokeWidth="3" />
            {/* Stripes */}
            <path d="M 90 105 L 85 125 L 94 122" stroke="#1c1917" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M 108 105 L 115 125 L 106 122" stroke="#1c1917" strokeWidth="3" strokeLinecap="round" fill="none" />
            {/* Long Tail with lightning tip */}
            <path d="M 135 125 Q 165 140 160 110 Q 155 85 170 80" stroke="url(#lynxGold)" strokeWidth="9" strokeLinecap="round" fill="none" />
            <path d="M 145 128 L 150 120" stroke="#1c1917" strokeWidth="3" />
            <path d="M 155 110 L 160 102" stroke="#1c1917" strokeWidth="3" />
            {/* Head */}
            <circle cx="85" cy="85" r="26" fill="url(#lynxGold)" stroke="#a16207" strokeWidth="3" />
            {/* Big Pointy Lynx Ears with tufts */}
            <polygon points="70,68 62,38 82,58" fill="url(#lynxGold)" stroke="#a16207" strokeWidth="2.5" />
            <line x1="62" y1="38" x2="58" y2="28" stroke="#1c1917" strokeWidth="3" strokeLinecap="round" />
            <polygon points="98,68 106,38 88,58" fill="url(#lynxGold)" stroke="#a16207" strokeWidth="2.5" />
            <line x1="106" y1="38" x2="110" y2="28" stroke="#1c1917" strokeWidth="3" strokeLinecap="round" />
            {/* Eyes */}
            <circle cx="78" cy="85" r="5" fill="#0284c7" />
            <circle cx="77" cy="83" r="1.5" fill="#ffffff" />
            <circle cx="95" cy="85" r="5" fill="#0284c7" />
            <circle cx="94" cy="83" r="1.5" fill="#ffffff" />
            <polygon points="85,91 88,91 86.5,94" fill="#a16207" />
            {/* Paws */}
            <ellipse cx="80" cy="150" rx="8" ry="6" fill="#ca8a04" stroke="#a16207" strokeWidth="2" />
            <ellipse cx="115" cy="150" rx="8" ry="6" fill="#ca8a04" stroke="#a16207" strokeWidth="2" />
          </svg>
        </div>
      );

    case 'obsidus':
      // Magma saber-toothed beast with obsidian armor & runes
      return (
        <div className={`relative flex items-center justify-center ${sizeClasses} ${animClass} ${className}`}>
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md">
            <defs>
              <linearGradient id="obsidianStone" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#451a03" />
                <stop offset="100%" stopColor="#1c1917" />
              </linearGradient>
              <linearGradient id="magmaGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
            </defs>
            {/* Armored Carapace Body */}
            <ellipse cx="100" cy="120" rx="44" ry="38" fill="url(#obsidianStone)" stroke="#78350f" strokeWidth="4" />
            {/* Glowing Magma Runes */}
            <circle cx="115" cy="115" r="8" fill="none" stroke="#f97316" strokeWidth="2.5" strokeDasharray="6,4" />
            <circle cx="85" cy="125" r="6" fill="none" stroke="#f97316" strokeWidth="2" strokeDasharray="4,3" />
            {/* Armored Plates */}
            <path d="M 65 105 Q 100 95 135 105" stroke="#f97316" strokeWidth="3" fill="none" />
            <path d="M 70 125 Q 100 115 130 125" stroke="#ea580c" strokeWidth="2" fill="none" />
            {/* Saber-Tooth Head */}
            <circle cx="85" cy="85" r="28" fill="url(#obsidianStone)" stroke="#78350f" strokeWidth="3.5" />
            {/* Fangs */}
            <polygon points="76,96 73,122 80,96" fill="#f8fafc" stroke="#475569" strokeWidth="1.5" />
            <polygon points="94,96 97,122 90,96" fill="#f8fafc" stroke="#475569" strokeWidth="1.5" />
            {/* Fierce Amber Eyes */}
            <ellipse cx="78" cy="80" rx="4.5" ry="3" fill="#f59e0b" />
            <circle cx="77" cy="80" r="1" fill="#ffffff" />
            <ellipse cx="94" cy="80" rx="4.5" ry="3" fill="#f59e0b" />
            <circle cx="93" cy="80" r="1" fill="#ffffff" />
            {/* Heavy Stone Paws */}
            <ellipse cx="68" cy="155" rx="12" ry="8" fill="#1c1917" stroke="#78350f" strokeWidth="2.5" />
            <ellipse cx="120" cy="155" rx="12" ry="8" fill="#1c1917" stroke="#78350f" strokeWidth="2.5" />
          </svg>
        </div>
      );

    case 'aquanymph':
      // Lotus Water Sprite with giant lotus leaf hat
      return (
        <div className={`relative flex items-center justify-center ${sizeClasses} ${animClass} ${className}`}>
          <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-md">
            {/* Giant Lotus Leaf Hat */}
            <ellipse cx="100" cy="70" rx="65" ry="25" fill="#4ade80" stroke="#16a34a" strokeWidth="3" />
            {/* Lotus Flower on top */}
            <path d="M 100 45 Q 90 25 100 15 Q 110 25 100 45 Z" fill="#f43f5e" />
            <path d="M 90 48 Q 78 32 88 22 Q 95 35 90 48 Z" fill="#fb7185" />
            <path d="M 110 48 Q 122 32 112 22 Q 105 35 110 48 Z" fill="#fb7185" />
            {/* Cute Nymph Body */}
            <ellipse cx="100" cy="120" rx="20" ry="28" fill="#a7f3d0" stroke="#059669" strokeWidth="2" />
            {/* Head */}
            <circle cx="100" cy="90" r="18" fill="#cbfbec" stroke="#059669" strokeWidth="2" />
            {/* Gentle Closed Smiling Eyes */}
            <path d="M 92 88 Q 96 92 100 88" stroke="#065f46" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M 104 88 Q 108 92 112 88" stroke="#065f46" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Bubbles */}
            <circle cx="70" cy="120" r="8" fill="#38bdf8" opacity="0.6" />
            <circle cx="130" cy="135" r="12" fill="#38bdf8" opacity="0.6" />
          </svg>
        </div>
      );

    case 'bubbleboon':
      return (
        <div className={`relative flex items-center justify-center ${sizeClasses} ${animClass} ${className}`}>
          <img src={bubbleboonImg} alt="Bubbleboon" className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none" />
        </div>
      );

    case 'trojan_flare':
    case 'trojanflare':
      return (
        <div className={`relative flex items-center justify-center ${sizeClasses} ${animClass} ${className}`}>
          <img src={trojanFlareImg} alt="Trojan Flare" className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none" />
        </div>
      );

    case 'mossloth':
      return (
        <div className={`relative flex items-center justify-center ${sizeClasses} ${animClass} ${className}`}>
          <img src={mosslothImg} alt="Mossloth" className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none" />
        </div>
      );

    case 'khepri':
      return (
        <div className={`relative flex items-center justify-center ${sizeClasses} ${animClass} ${className}`}>
          <img src={khepriImg} alt="Khepri" className="w-full h-full object-contain drop-shadow-md select-none pointer-events-none" />
        </div>
      );

    default:
      // Default elemental wisp
      return (
        <div className={`relative flex items-center justify-center ${sizeClasses} ${animClass} ${className}`}>
          <div className="w-full h-full rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-amber-300 flex items-center justify-center text-4xl shadow-xl">
            ✨
          </div>
        </div>
      );
  }
};
