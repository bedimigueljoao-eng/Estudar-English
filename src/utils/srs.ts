import type { SRSFields, SRSRating } from '../types/foco';
import { getTodayISO } from './analytics';

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isSrsDueToday(item: SRSFields, today = getTodayISO()): boolean {
  if (!item.srsNextReviewDate) return true;
  return item.srsNextReviewDate <= today;
}

/**
 * Evidence-based SM-2 inspired spaced repetition schedule.
 * Keeps intervals motivating and practical for daily spoken recall.
 */
export function computeNextSrsSchedule(current: SRSFields, rating: SRSRating): SRSFields {
  const prevInterval = current.srsIntervalDays ?? 0;
  const prevEase = current.srsEase ?? 2.3;
  const prevReps = current.srsReps ?? 0;

  let nextInterval = 1;
  let nextEase = prevEase;
  let nextReps = prevReps;

  if (rating === 'again') {
    nextReps = 0;
    nextInterval = 1;
    nextEase = Math.max(1.4, Number((prevEase - 0.2).toFixed(2)));
  } else if (rating === 'hard') {
    nextReps = Math.max(1, prevReps);
    nextInterval = prevInterval <= 1 ? 2 : Math.max(2, Math.round(prevInterval * 1.3));
    nextEase = Math.max(1.5, Number((prevEase - 0.1).toFixed(2)));
  } else if (rating === 'good') {
    nextReps = prevReps + 1;
    if (nextReps === 1) nextInterval = 1;
    else if (nextReps === 2) nextInterval = 4;
    else nextInterval = Math.max(4, Math.round(prevInterval * prevEase));
  } else {
    // easy / automatic
    nextReps = prevReps + 1;
    nextEase = Math.min(2.8, Number((prevEase + 0.15).toFixed(2)));
    if (nextReps === 1) nextInterval = 3;
    else if (nextReps === 2) nextInterval = 7;
    else nextInterval = Math.max(7, Math.round(prevInterval * nextEase));
  }

  return {
    srsIntervalDays: nextInterval,
    srsEase: nextEase,
    srsReps: nextReps,
    srsNextReviewDate: addDaysISO(nextInterval),
    srsLastRating: rating,
  };
}

export function previewNextIntervalLabel(current: SRSFields, rating: SRSRating): string {
  const next = computeNextSrsSchedule(current, rating);
  const days = next.srsIntervalDays ?? 1;
  return days === 1 ? '1d' : `${days}d`;
}
