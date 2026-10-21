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
  const allRewardsUnlocked = Boolean(progress?.allRewardsUnlocked);
  const resetCycle = !allRewardsUnlocked && (!hasValidStart || elapsedDays < 0 || elapsedDays >= 7);
  const cycleStartedOn = resetCycle ? today : progress!.cycleStartedOn;
  const day = resetCycle ? 1 : allRewardsUnlocked
    ? Math.max(1, Math.min(7, elapsedDays + 1))
    : elapsedDays + 1;
  const claimedDays = resetCycle ? [] : (progress?.claimedDays || []);
  const canClaimToday = allRewardsUnlocked
    ? ![1, 2, 3, 4, 5, 6, 7].every(rewardDay => claimedDays.includes(rewardDay))
    : !claimedDays.includes(day);
  return {
    today,
    cycleStartedOn,
    day,
    claimedDays,
    canClaimToday,
    allRewardsUnlocked,
  };
}
