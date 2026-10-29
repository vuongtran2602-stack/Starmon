import React, { useEffect, useRef } from 'react';
import type { ElementType } from '../types';
import circle01 from '../assets/images/kenney-particles/circle_01.png';
import circle02 from '../assets/images/kenney-particles/circle_02.png';
import fire01 from '../assets/images/kenney-particles/fire_01.png';
import flame01 from '../assets/images/kenney-particles/flame_01.png';
import flame02 from '../assets/images/kenney-particles/flame_02.png';
import flare01 from '../assets/images/kenney-particles/flare_01.png';
import light01 from '../assets/images/kenney-particles/light_01.png';
import magic01 from '../assets/images/kenney-particles/magic_01.png';
import smoke01 from '../assets/images/kenney-particles/smoke_01.png';
import spark01 from '../assets/images/kenney-particles/spark_01.png';
import spark02 from '../assets/images/kenney-particles/spark_02.png';
import trace01 from '../assets/images/kenney-particles/trace_01.png';
import trace02 from '../assets/images/kenney-particles/trace_02.png';
import twirl01 from '../assets/images/kenney-particles/twirl_01.png';

export interface BattleVfxRequest {
  id: number;
  element: ElementType;
  mode: 'projectile' | 'on-target';
  fromSelector: string;
  toSelector: string;
}

const textureUrls = {
  circle01, circle02, fire01, flame01, flame02, flare01, light01,
  magic01, smoke01, spark01, spark02, trace01, trace02, twirl01,
};
type TextureName = keyof typeof textureUrls;
const imageCache = new Map<TextureName, HTMLImageElement>();
const tintedCache = new Map<string, HTMLCanvasElement>();

function getImage(name: TextureName) {
  let image = imageCache.get(name);
  if (!image) {
    image = new Image();
    image.src = textureUrls[name];
    imageCache.set(name, image);
  }
  return image;
}

function getTintedImage(name: TextureName, color: string) {
  const key = `${name}:${color}`;
  const cached = tintedCache.get(key);
  if (cached) return cached;
  const image = getImage(name);
  if (!image.complete || !image.naturalWidth) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(256, image.naturalWidth);
  canvas.height = Math.min(256, image.naturalHeight);
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  tintedCache.set(key, canvas);
  return canvas;
}

const palettes: Record<ElementType, { main: string; light: string; dark: string }> = {
  Fire: { main: '#ff4b16', light: '#fff1a3', dark: '#a91d25' },
  Water: { main: '#21a9ff', light: '#d7ffff', dark: '#514dff' },
  Electric: { main: '#ffe642', light: '#ffffff', dark: '#ff9b20' },
  Wind: { main: '#d8fff2', light: '#ffffff', dark: '#b9a2ff' },
  Earth: { main: '#a8d34b', light: '#f3ffc4', dark: '#72512a' },
  Metal: { main: '#d5e7ff', light: '#ffffff', dark: '#8295cf' },
};

const recipes: Record<ElementType, { trail: TextureName[]; burst: TextureName[]; particles: TextureName[] }> = {
  Fire: { trail: ['flame01', 'flame02', 'fire01'], burst: ['fire01', 'flare01', 'smoke01'], particles: ['spark01', 'spark02', 'flame01'] },
  Water: { trail: ['circle01', 'circle02', 'light01'], burst: ['circle02', 'flare01', 'light01'], particles: ['circle01', 'circle02', 'spark02'] },
  Electric: { trail: ['trace01', 'trace02', 'light01'], burst: ['flare01', 'spark01', 'light01'], particles: ['spark01', 'spark02', 'trace01'] },
  Wind: { trail: ['trace01', 'twirl01', 'trace02'], burst: ['twirl01', 'light01', 'flare01'], particles: ['trace02', 'twirl01', 'circle01'] },
  Earth: { trail: ['smoke01', 'circle01', 'flame02'], burst: ['smoke01', 'flare01', 'circle02'], particles: ['circle02', 'spark02', 'smoke01'] },
  Metal: { trail: ['magic01', 'trace02', 'light01'], burst: ['flare01', 'magic01', 'spark01'], particles: ['spark01', 'magic01', 'circle02'] },
};

interface Particle {
  x: number; y: number; vx: number; vy: number; size: number; rotation: number;
  spin: number; age: number; life: number; texture: TextureName; color: string;
}

export const BattleSkillVfx: React.FC<{ request: BattleVfxRequest | null }> = ({ request }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !request) return;
    let frame = 0;
    let startAt = 0;
    let emitAt = 0;
    let previousFrame = 0;
    let from = { x: 0, y: 0 };
    let to = { x: 0, y: 0 };
    let mode: BattleVfxRequest['mode'] = 'projectile';
    let colors = palettes.Fire;
    let recipe = recipes.Fire;
    let particles: Particle[] = [];
    let impactAdded = false;
    const sourceRect = document.querySelector<HTMLElement>(request.fromSelector)?.getBoundingClientRect();
    const targetRect = document.querySelector<HTMLElement>(request.toSelector)?.getBoundingClientRect();
    if (!sourceRect || !targetRect) return;
    mode = request.mode;
    from = { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 };
    to = { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 };
    colors = palettes[request.element];
    recipe = recipes[request.element];

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const addParticle = (x: number, y: number, impact = false) => {
      const textureList = impact ? recipe.burst : recipe.particles;
      const angle = Math.random() * Math.PI * 2;
      const speed = impact ? 45 + Math.random() * 210 : 20 + Math.random() * 100;
      particles.push({
        x: x + (Math.random() - 0.5) * (impact ? 22 : 12),
        y: y + (Math.random() - 0.5) * (impact ? 22 : 12),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (recipe === recipes.Fire ? 15 : 0),
        size: impact ? 28 + Math.random() * 84 : 16 + Math.random() * 42,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 4,
        age: 0,
        life: impact ? 0.3 + Math.random() * 0.42 : 0.22 + Math.random() * 0.32,
        texture: textureList[Math.floor(Math.random() * textureList.length)],
        color: [colors.main, colors.light, colors.dark][Math.floor(Math.random() * 3)],
      });
    };

    const drawSprite = (name: TextureName, color: string, x: number, y: number, size: number, rotation: number, alpha: number) => {
      const sprite = getTintedImage(name, color);
      if (!sprite) return;
      context.save();
      context.globalAlpha = alpha;
      context.globalCompositeOperation = 'lighter';
      context.translate(x, y);
      context.rotate(rotation);
      context.drawImage(sprite, -size / 2, -size / 2, size, size);
      context.restore();
    };

    const animate = (now: number) => {
      if (!startAt) startAt = now;
      const dt = Math.min(0.05, Math.max(0, (now - previousFrame) / 1000));
      previousFrame = now;
      emitAt ||= startAt;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      {
        const elapsed = now - startAt;
        const travelMs = mode === 'projectile' ? 620 : 0;
        const progress = mode === 'projectile' ? Math.min(1, elapsed / travelMs) : 1;
        const eased = 1 - (1 - progress) ** 3;
        const arc = Math.sin(progress * Math.PI) * -34;
        const head = { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased + arc };

        if (mode === 'projectile' && now - emitAt >= 23 && progress < 1) {
          addParticle(head.x, head.y);
          addParticle(head.x, head.y);
          emitAt = now;
        }
        if (progress >= 1 && !impactAdded) {
          impactAdded = true;
          for (let i = 0; i < 22; i++) addParticle(to.x, to.y, true);
        }

        if (mode === 'projectile' && progress < 1) {
          drawSprite(recipe.trail[0], colors.main, head.x, head.y, 112, Math.atan2(to.y - from.y, to.x - from.x), 0.82);
          drawSprite(recipe.trail[1], colors.light, head.x, head.y, 72, -Math.atan2(to.y - from.y, to.x - from.x), 0.84);
          drawSprite('flare01', colors.light, head.x, head.y, 52, 0, 0.8);
        }

        particles = particles.filter(p => p.age < p.life);
        for (const particle of particles) {
          particle.age += dt;
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          particle.vx *= 0.975;
          particle.vy *= 0.975;
          particle.rotation += particle.spin * dt;
          const life = Math.max(0, 1 - particle.age / particle.life);
          drawSprite(particle.texture, particle.color, particle.x, particle.y, particle.size * (1.25 - life * 0.35), particle.rotation, life * 0.72);
        }
        if (mode === 'on-target' && elapsed < 260) {
          drawSprite(recipe.burst[1], colors.light, to.x, to.y, 215 * (elapsed / 300 + 0.35), 0, 1 - elapsed / 340);
        }
        if (elapsed <= travelMs + 720) frame = window.requestAnimationFrame(animate);
      }
    };

    resize();
    frame = window.requestAnimationFrame(animate);
    window.addEventListener('resize', resize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [request?.id]);

  return <canvas ref={canvasRef} aria-hidden="true" className="fixed inset-0 z-[120] pointer-events-none" />;
};
