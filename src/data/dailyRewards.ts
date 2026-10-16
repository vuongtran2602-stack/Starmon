import { DailyRewardProgress } from '../types';

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDateNumber(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function getDailyRewardStatus(progress?: DailyRewardProgress, now = new Date()) {
  const today = localDateKey(now);
  const hasValidStart = !!progress?.cycleStartedOn && /^\d{4}-\d{2}-\d{2}$/.test(progress.cycleStartedOn);
  const elapsedDays = hasValidStart ? localDateNumber(today) - localDateNumber(progress!.cycleStartedOn) : 0;
  const resetCycle = !hasValidStart || elapsedDays < 0 || elapsedDays >= 7;
  const cycleStartedOn = resetCycle ? today : progress!.cycleStartedOn;
  const day = resetCycle ? 1 : elapsedDays + 1;
  const claimedDays = resetCycle ? [] : (progress?.claimedDays || []);
  return {
    today,
    cycleStartedOn,
    day,
    claimedDays,
    canClaimToday: !claimedDays.includes(day),
  };
}
