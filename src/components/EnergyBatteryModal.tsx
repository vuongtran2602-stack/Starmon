import React, { useState, useEffect } from 'react';
import { PlayerProfile } from '../types';
import {
  ENERGY_BATTERY_50_IMAGE,
  ENERGY_BATTERY_100_IMAGE,
  ENERGY_BATTERY_200_IMAGE,
  getEnergyBarImage,
} from '../data/itemsData';
import { sound } from '../services/sound';
import { X, Zap, Plus, Minus, BatteryCharging, Sparkles, Check, Clock } from 'lucide-react';

interface Props {
  player: PlayerProfile;
  onClose: () => void;
  onUseBatteries: (tier: 50 | 100 | 200, count: number) => void;
  initialTier?: 50 | 100 | 200;
}

export const EnergyBatteryModal: React.FC<Props> = ({
  player,
  onClose,
  onUseBatteries,
  initialTier,
}) => {
  const [selectedTier, setSelectedTier] = useState<50 | 100 | 200 | null>(initialTier || null);
  const [sliderAmount, setSliderAmount] = useState<number>(1);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Time until next energy regen (1 energy per 10 minutes = 600,000 ms)
  const [secondsUntilNext, setSecondsUntilNext] = useState<number>(() => {
    if (player.energy >= 100) return 0;
    const last = player.lastEnergyRegenTime || Date.now();
    const elapsed = Date.now() - last;
    const cycle = 10 * 60 * 1000;
    const remaining = Math.max(0, cycle - (elapsed % cycle));
    return Math.floor(remaining / 1000);
  });

  useEffect(() => {
    if (player.energy >= 100) {
      setSecondsUntilNext(0);
      return;
    }
    const timer = setInterval(() => {
      const last = player.lastEnergyRegenTime || Date.now();
      const elapsed = Date.now() - last;
      const cycle = 10 * 60 * 1000;
      const remaining = Math.max(0, cycle - (elapsed % cycle));
      setSecondsUntilNext(Math.floor(remaining / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [player.energy, player.lastEnergyRegenTime]);

  const batteries = [
    {
      tier: 50 as const,
      name: 'Energy Battery 50 🗲',
      description: 'Hồi phục +50 Energy cho huấn luyện viên.',
      count: player.energyBatteries?.battery50 || 0,
      image: ENERGY_BATTERY_50_IMAGE,
      badgeColor: 'from-sky-500 to-blue-600',
    },
    {
      tier: 100 as const,
      name: 'Energy Battery 100 🗲',
      description: 'Hồi phục +100 Energy cho huấn luyện viên.',
      count: player.energyBatteries?.battery100 || 0,
      image: ENERGY_BATTERY_100_IMAGE,
      badgeColor: 'from-amber-500 to-orange-600',
    },
    {
      tier: 200 as const,
      name: 'Energy Battery 200 🗲',
      description: 'Hồi phục +200 Energy cực đại cho huấn luyện viên.',
      count: player.energyBatteries?.battery200 || 0,
      image: ENERGY_BATTERY_200_IMAGE,
      badgeColor: 'from-purple-500 to-indigo-600',
    },
  ];

  const activeBattery = selectedTier ? batteries.find(b => b.tier === selectedTier) : null;
  const maxAvailable = activeBattery ? activeBattery.count : 0;

  // Whenever user picks a tier, reset slider to 1 (if available)
  const handleSelectTier = (tier: 50 | 100 | 200) => {
    sound.playClick();
    setSelectedTier(tier);
    setSliderAmount(1);
  };

  const handleConfirmUse = () => {
    if (!selectedTier || maxAvailable <= 0) {
      sound.playWrong();
      return;
    }
    const amountToUse = Math.min(sliderAmount, maxAvailable);
    if (amountToUse <= 0) return;

    sound.playRewardFanfare();
    onUseBatteries(selectedTier, amountToUse);

    const energyAdded = amountToUse * selectedTier;
    setToastMessage(`⚡ Đã nạp thành công +${energyAdded} Energy!`);
    setTimeout(() => {
      setToastMessage(null);
      setSelectedTier(null);
    }, 1800);
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-400/80 rounded-3xl p-5 md:p-6 max-w-xl w-full shadow-2xl text-slate-100 flex flex-col justify-between max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 shadow-lg flex items-center justify-center">
              <Zap className="w-7 h-7 text-slate-950 fill-slate-950" />
            </div>
            <div>
              <h3 className="text-xl font-black font-game text-white flex items-center gap-2">
                Energy Battery Vault
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 font-mono">
                  {player.energy}/100 🗲
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Hồi phục năng lượng cho breeding, hatching, forging & researching.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Energy Status Banner */}
        <div className="bg-slate-950/90 rounded-2xl border border-amber-400/40 p-3.5 mb-4 shadow-inner flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 font-bold mb-1">
              <BatteryCharging className="w-4 h-4 text-amber-400" />
              <span>Năng Lượng Hiện Tại (Energy)</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-game text-amber-300 font-mono drop-shadow">
                {player.energy} / 100 🗲
              </span>
              {player.energy >= 100 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-bold">
                  {player.energy > 100 ? 'Overcapped 🔥' : 'Tối Đa (Max)'}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {player.energy < 100 ? (
                <span>Hồi +1 🗲 sau: <strong className="text-sky-300 font-mono">{formatTimer(secondsUntilNext)}</strong> (10 phút/1🗲)</span>
              ) : (
                <span className="text-slate-400">Đã đạt mức 100/100. Dùng pin để nạp thêm vượt mức!</span>
              )}
            </div>
          </div>

          {/* Energy Bar Graphic Display */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black font-game text-amber-200 mb-0.5">
              {player.energy}/100
            </span>
            <div className="h-6 w-36 sm:w-40 flex items-center justify-center p-0.5 bg-slate-900 rounded-lg border border-slate-700">
              <img
                src={getEnergyBarImage(player.energy)}
                alt="Energy Bar"
                className="max-h-full max-w-full object-contain drop-shadow"
              />
            </div>
          </div>
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="mb-3 p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-400 text-emerald-200 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Battery Cards List */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
            <span>Chọn loại bình Energy Battery để sử dụng:</span>
            <span className="text-[11px] text-amber-400">Đầu bên trái: 1 | Đầu bên phải: n</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {batteries.map(battery => {
              const isSelected = selectedTier === battery.tier;
              const hasItems = battery.count > 0;

              return (
                <div
                  key={battery.tier}
                  onClick={() => {
                    if (hasItems) {
                      handleSelectTier(battery.tier);
                    } else {
                      sound.playWrong();
                    }
                  }}
                  className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center text-center relative cursor-pointer select-none ${
                    isSelected
                      ? 'bg-amber-950/60 border-amber-400 shadow-lg shadow-amber-500/20 scale-102'
                      : hasItems
                      ? 'bg-slate-950/80 border-slate-800 hover:border-slate-600 hover:bg-slate-900/60'
                      : 'bg-slate-950/50 border-slate-900 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {/* Quantity Badge */}
                  <span
                    className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-mono font-black border shadow ${
                      hasItems
                        ? 'bg-amber-500 text-slate-950 border-amber-300'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                  >
                    x{battery.count}
                  </span>

                  {/* Battery Image */}
                  <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-center p-2 mb-2 group-hover:scale-105 transition-transform">
                    <img
                      src={battery.image}
                      alt={battery.name}
                      className="max-h-full max-w-full object-contain drop-shadow"
                    />
                  </div>

                  <h4 className="font-black font-game text-xs sm:text-sm text-white">
                    +{battery.tier} 🗲
                  </h4>
                  <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                    {battery.name}
                  </p>

                  <button
                    disabled={!hasItems}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasItems) handleSelectTier(battery.tier);
                    }}
                    className={`mt-2.5 w-full py-1.5 rounded-xl font-black font-game text-xs transition-transform cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 shadow-md'
                        : hasItems
                        ? 'bg-slate-800 hover:bg-slate-700 text-white'
                        : 'bg-slate-900 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {hasItems ? (isSelected ? 'ĐANG CHỌN' : 'SỬ DỤNG') : 'HẾT PIN'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Battery Interactive Slider Area (1 to n) */}
        {activeBattery && maxAvailable > 0 && (
          <div className="bg-slate-950/95 border-2 border-amber-400/90 rounded-2xl p-4 shadow-xl animate-in zoom-in-95 duration-150 mb-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-black text-sm">⚡</span>
                <span className="text-sm font-black font-game text-white">
                  Điều Chỉnh Số Lượng: {activeBattery.name}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-400/30">
                Sở hữu: {maxAvailable} bình
              </span>
            </div>

            {/* Range Slider: min 1, max n */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="text-slate-400 font-mono">1 (Tối thiểu)</span>
                <div className="text-base font-black font-game text-amber-300 bg-slate-900 px-3 py-1 rounded-xl border border-amber-400/40">
                  {sliderAmount} / {maxAvailable} bình
                </div>
                <span className="text-amber-400 font-mono">{maxAvailable} (Toàn bộ n)</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setSliderAmount(prev => Math.max(1, prev - 1));
                  }}
                  disabled={sliderAmount <= 1}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white flex items-center justify-center font-bold text-base cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <input
                  type="range"
                  min={1}
                  max={maxAvailable}
                  value={sliderAmount}
                  onChange={(e) => {
                    setSliderAmount(Number(e.target.value));
                  }}
                  className="flex-1 h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setSliderAmount(prev => Math.min(maxAvailable, prev + 1));
                  }}
                  disabled={sliderAmount >= maxAvailable}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white flex items-center justify-center font-bold text-base cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setSliderAmount(maxAvailable);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 text-[10px] font-black font-game uppercase cursor-pointer"
                >
                  MAX (n)
                </button>
              </div>

              {/* Energy Calculation Preview */}
              <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Năng lượng nạp thêm:</span>
                  <span className="font-black text-amber-300 font-mono text-sm">
                    +{sliderAmount * activeBattery.tier} 🗲
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Năng lượng sau khi nạp:</span>
                  <span className="font-black text-emerald-300 font-mono text-sm">
                    {player.energy + (sliderAmount * activeBattery.tier)} / 100 🗲
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setSelectedTier(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUse}
                  className="flex-[2] py-2.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black font-game text-xs rounded-xl shadow-lg shadow-amber-500/30 flex items-center justify-center gap-1.5 cursor-pointer transform active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  XÁC NHẬN SỬ DỤNG (+{sliderAmount * activeBattery.tier} 🗲)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3 mt-1 shrink-0">
          <span className="text-[11px] text-slate-400">
            Energy tự hồi: 1 🗲 / 10 phút (tối đa 100 🗲 tự nhiên)
          </span>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
