import React, { useState, useEffect } from 'react';
import { sound } from '../services/sound';
import { Maximize2, BookOpen, Sparkles } from 'lucide-react';

interface Props {
  isActive: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onStartTutorial: () => void;
}

export const OnboardingSpotlight: React.FC<Props> = ({
  isActive,
  isFullscreen,
  onToggleFullscreen,
  onStartTutorial,
}) => {
  // Step 1: 'fullscreen' -> Step 2: 'tutorial'
  const [currentStep, setCurrentStep] = useState<'fullscreen' | 'tutorial'>('fullscreen');
  const [targetRect, setTargetRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // If fullscreen is activated while in Step 1, advance immediately to Step 2!
  useEffect(() => {
    if (isFullscreen && currentStep === 'fullscreen') {
      sound.playRewardFanfare();
      setCurrentStep('tutorial');
    }
  }, [isFullscreen, currentStep]);

  // Measure element rect for active step
  const updateRect = () => {
    const targetId = currentStep === 'fullscreen' ? 'hub-fullscreen-btn' : 'hub-tutorial-btn';
    const el = document.getElementById(targetId);
    if (el) {
      const rect = el.getBoundingClientRect();
      const padding = 8;
      setTargetRect({
        x: Math.max(0, rect.left - padding),
        y: Math.max(0, rect.top - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    } else {
      // Fallback
      if (currentStep === 'fullscreen') {
        setTargetRect({
          x: window.innerWidth - 180,
          y: 12,
          width: 52,
          height: 52,
        });
      } else {
        setTargetRect({
          x: window.innerWidth - 110,
          y: 12,
          width: 58,
          height: 58,
        });
      }
    }
  };

  useEffect(() => {
    if (!isActive) return;
    updateRect();
    const interval = setInterval(updateRect, 400);
    window.addEventListener('resize', updateRect);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', updateRect);
    };
  }, [isActive, currentStep]);

  if (!isActive) return null;

  const handleFullscreenHotspotClick = () => {
    sound.playClick();
    onToggleFullscreen();
    setCurrentStep('tutorial');
  };

  const handleTutorialHotspotClick = () => {
    sound.playClick();
    onStartTutorial();
  };

  const handLeft = targetRect
    ? targetRect.x + targetRect.width / 2
    : window.innerWidth - 120;
  const handTop = targetRect
    ? targetRect.y + targetRect.height + 42
    : 80;

  return (
    <div className="fixed inset-0 z-50 select-none overflow-hidden">
      {/* 1. SVG DARK OVERLAY / MASK (Blocks all background clicks) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="onboarding-spotlight-mask">
            {/* White covers entire screen */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cuts out the spotlight hole for the active button */}
            {targetRect && (
              <rect
                x={targetRect.x}
                y={targetRect.y}
                width={targetRect.width}
                height={targetRect.height}
                rx="18"
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Dark mask overlay (88% opacity) */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(5, 10, 25, 0.88)"
          mask="url(#onboarding-spotlight-mask)"
        />
        {/* Pulsing golden border framing the active button */}
        {targetRect && (
          <rect
            x={targetRect.x}
            y={targetRect.y}
            width={targetRect.width}
            height={targetRect.height}
            rx="18"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="3.5"
            strokeDasharray="8 6"
            className="animate-pulse"
          />
        )}
      </svg>

      {/* 2. EXCLUSIVE CLICKABLE HOTSPOT OVER THE SPOTLIGHTED BUTTON */}
      {targetRect && (
        <button
          onClick={currentStep === 'fullscreen' ? handleFullscreenHotspotClick : handleTutorialHotspotClick}
          style={{
            position: 'absolute',
            left: `${targetRect.x}px`,
            top: `${targetRect.y}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
          }}
          className="z-50 rounded-2xl cursor-pointer pointer-events-auto ring-4 ring-amber-400/50 hover:ring-amber-300 transition-all active:scale-95 bg-transparent"
          title={currentStep === 'fullscreen' ? 'Bấm để chọn Full Screen' : 'Bấm để vào Hướng Dẫn'}
        />
      )}

      {/* 3. GUIDE HAND POINTER */}
      {targetRect && (
        <div
          className="absolute z-50 pointer-events-none transition-all duration-300 ease-out flex flex-col items-center"
          style={{
            left: `${handLeft}px`,
            top: `${handTop}px`,
            transform: 'translateX(-50%)',
          }}
        >
          {/* Animated Bouncing Up Hand Pointer */}
          <div className="relative flex flex-col items-center animate-bounce">
            <div className="text-4xl md:text-5xl filter drop-shadow-[0_4px_12px_rgba(251,191,36,0.9)] select-none -rotate-90">
              👉
            </div>
            <div className="w-4 h-4 rounded-full bg-amber-400/40 animate-ping absolute -top-1" />
          </div>
        </div>
      )}

      {/* 4. INSTRUCTION DIALOGUE CARD */}
      <div
        className="absolute z-50 pointer-events-auto transition-all duration-300"
        style={{
          left: targetRect
            ? Math.min(
                window.innerWidth - 320,
                Math.max(16, targetRect.x + targetRect.width / 2 - 150)
              )
            : '50%',
          top: targetRect
            ? Math.min(window.innerHeight - 180, targetRect.y + targetRect.height + 90)
            : '40%',
          transform: targetRect ? 'none' : 'translate(-50%, -50%)',
          width: '300px',
        }}
      >
        <div className="bg-slate-900/95 border-2 border-amber-400 rounded-3xl p-4 shadow-2xl backdrop-blur-md text-white flex flex-col gap-2.5 relative">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-black tracking-wider uppercase text-amber-400 block font-mono">
                {currentStep === 'fullscreen' ? 'BƯỚC 1 / 2' : 'BƯỚC 2 / 2'}
              </span>
              <h3 className="text-xs md:text-sm font-black font-game text-white leading-tight">
                {currentStep === 'fullscreen' ? 'Bắt buộc chọn Full Screen' : 'Bắt buộc chọn Hướng Dẫn'}
              </h3>
            </div>
          </div>

          <p className="text-xs text-slate-200 font-semibold leading-relaxed">
            {currentStep === 'fullscreen'
              ? 'Vui lòng nhấn vào biểu tượng Toàn màn hình (Full Screen) để mở rộng tầm nhìn và tối ưu trải nghiệm.'
              : 'Tuyệt vời! Bây giờ hãy nhấn vào nút Hướng Dẫn để bắt đầu lượt chơi hướng dẫn đầu tiên của bạn.'}
          </p>

          {currentStep === 'fullscreen' ? (
            <button
              onClick={handleFullscreenHotspotClick}
              className="mt-1 w-full py-2.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black font-game text-xs rounded-xl shadow-lg cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 transition-all"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Bật Full Screen ngay ➔</span>
            </button>
          ) : (
            <button
              onClick={handleTutorialHotspotClick}
              className="mt-1 w-full py-2.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 text-slate-950 font-black font-game text-xs rounded-xl shadow-lg cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 transition-all"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Vào Hướng Dẫn ngay ➔</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
