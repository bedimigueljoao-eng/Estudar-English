import { Capacitor, registerPlugin } from '@capacitor/core';
import type { ActiveTimerState, CEFRLevel, SkillType, TimerActivity } from '../types/foco';
import { formatHMS } from '../utils/analytics';

interface StudyTimerNativePlugin {
  startSession(options: {
    activity: string;
    skill: string;
    level: string;
    topicTitle: string;
    startedAtMs: number;
    accumulatedMs: number;
  }): Promise<void>;
  pauseSession(options: { accumulatedMs: number }): Promise<void>;
  resumeSession(options: { resumedAtMs: number; accumulatedMs: number }): Promise<void>;
  stopSession(): Promise<void>;
  getActiveSession(): Promise<{
    isRunning: boolean;
    isPaused: boolean;
    accumulatedMs: number;
    lastResumedAtMs: number;
    action?: 'pause' | 'resume' | 'stop' | null;
  }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
}

const StudyTimerNative = registerPlugin<StudyTimerNativePlugin>('StudyTimer');

export const isNativeAndroid = (): boolean =>
  typeof window !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export function computeElapsedMs(timer: ActiveTimerState, nowMs = Date.now()): number {
  if (timer.status === 'idle') return 0;
  if (timer.status === 'paused') return Math.max(0, timer.accumulatedMs);
  const delta = timer.lastResumedAtMs ? Math.max(0, nowMs - timer.lastResumedAtMs) : 0;
  return Math.max(0, timer.accumulatedMs + delta);
}

export async function syncNativeTimerStart(timer: ActiveTimerState): Promise<void> {
  if (isNativeAndroid()) {
    try {
      await StudyTimerNative.startSession({
        activity: timer.activity === 'Custom Activities' && timer.customActivityName ? timer.customActivityName : timer.activity,
        skill: timer.skill,
        level: timer.level,
        topicTitle: timer.topicTitle,
        startedAtMs: timer.startedAtMs ?? Date.now(),
        accumulatedMs: timer.accumulatedMs,
      });
    } catch {
      // ignore if native bridge unavailable
    }
  }
  updateWebNotificationAndTitle(timer);
}

export async function syncNativeTimerPause(timer: ActiveTimerState): Promise<void> {
  if (isNativeAndroid()) {
    try {
      await StudyTimerNative.pauseSession({ accumulatedMs: timer.accumulatedMs });
    } catch {
      // ignore
    }
  }
  updateWebNotificationAndTitle(timer);
}

export async function syncNativeTimerResume(timer: ActiveTimerState): Promise<void> {
  if (isNativeAndroid()) {
    try {
      await StudyTimerNative.resumeSession({
        resumedAtMs: timer.lastResumedAtMs ?? Date.now(),
        accumulatedMs: timer.accumulatedMs,
      });
    } catch {
      // ignore
    }
  }
  updateWebNotificationAndTitle(timer);
}

export async function syncNativeTimerStop(): Promise<void> {
  if (isNativeAndroid()) {
    try {
      await StudyTimerNative.stopSession();
    } catch {
      // ignore
    }
  }
  if (typeof document !== 'undefined') {
    document.title = 'FOCOENGLISH MOBILE V2.0';
  }
  closeWebTimerNotification();
}

export async function pullNativeTimerState(): Promise<Awaited<ReturnType<StudyTimerNativePlugin['getActiveSession']>> | null> {
  if (!isNativeAndroid()) return null;
  try {
    return await StudyTimerNative.getActiveSession();
  } catch {
    return null;
  }
}

export async function requestTimerNotificationPermission(): Promise<boolean> {
  if (isNativeAndroid()) {
    try {
      const res = await StudyTimerNative.requestNotificationPermission();
      return res.granted;
    } catch {
      return false;
    }
  }
  if (typeof Notification !== 'undefined') {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const res = await Notification.requestPermission();
      return res === 'granted';
    }
  }
  return false;
}

const TIMER_NOTIFICATION_TAG = 'focoenglish-active-timer';

export function updateWebNotificationAndTitle(timer: ActiveTimerState): void {
  if (typeof document === 'undefined') return;
  const elapsedSec = Math.floor(computeElapsedMs(timer) / 1000);
  const clock = formatHMS(elapsedSec);

  if (timer.status === 'running') {
    document.title = `${clock} · ${timer.skill} ${timer.level} · FOCOENGLISH`;
  } else if (timer.status === 'paused') {
    document.title = `Paused ${clock} · FOCOENGLISH`;
  } else {
    document.title = 'FOCOENGLISH MOBILE V2.0';
  }

  // Update MediaSession metadata for lock screen visibility if supported
  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${timer.activity} (${timer.level})`,
        artist: `${timer.topicTitle} · ${clock}`,
        album: 'FOCOENGLISH MOBILE V2.0',
      });
      navigator.mediaSession.playbackState = timer.status === 'running' ? 'playing' : 'paused';
    } catch {
      // ignore
    }
  }
}

export async function showBrowserPersistentNotification(
  timer: ActiveTimerState,
  enabled: boolean
): Promise<void> {
  if (!enabled || isNativeAndroid()) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const elapsedSec = Math.floor(computeElapsedMs(timer) / 1000);
  const clock = formatHMS(elapsedSec);
  const label =
    timer.activity === 'Custom Activities' && timer.customActivityName
      ? timer.customActivityName
      : timer.activity;

  const title = `FOCOENGLISH · ${label} ${timer.level}`;
  const body = `${timer.status === 'paused' ? 'Paused' : 'Active'} · ${clock} · ${timer.topicTitle}`;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          tag: TIMER_NOTIFICATION_TAG,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          silent: true,
          requireInteraction: timer.status === 'running',
        });
        return;
      }
    }
    new Notification(title, {
      body,
      tag: TIMER_NOTIFICATION_TAG,
      icon: '/pwa-192x192.png',
      silent: true,
    });
  } catch {
    // Browser may restrict direct Notification construction in some contexts
  }
}

export async function closeWebTimerNotification(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const notifications = await reg.getNotifications({ tag: TIMER_NOTIFICATION_TAG });
        notifications.forEach((n) => n.close());
      }
    }
  } catch {
    // ignore
  }
}

export const ACTIVITY_DEFAULT_SKILL: Record<TimerActivity, SkillType> = {
  'Listening Active': 'Listening',
  'Listening Passive': 'Listening',
  Speaking: 'Speaking',
  Reading: 'Reading',
  Writing: 'Writing',
  Grammar: 'Grammar',
  Vocabulary: 'Vocabulary',
  Pronunciation: 'Pronunciation',
  Movies: 'Immersion',
  Series: 'Immersion',
  Podcasts: 'Listening',
  'YouTube Learning': 'Listening',
  'Conversation Practice': 'Speaking',
  Shadowing: 'Speaking',
  Immersion: 'Immersion',
  'Custom Activities': 'Speaking',
};

export const ALL_ACTIVITIES: TimerActivity[] = [
  'Speaking',
  'Conversation Practice',
  'Shadowing',
  'Pronunciation',
  'Listening Active',
  'Listening Passive',
  'Podcasts',
  'YouTube Learning',
  'Reading',
  'Vocabulary',
  'Grammar',
  'Writing',
  'Movies',
  'Series',
  'Immersion',
  'Custom Activities',
];

export const ALL_SKILLS: SkillType[] = [
  'Speaking',
  'Listening',
  'Reading',
  'Vocabulary',
  'Grammar',
  'Writing',
  'Pronunciation',
  'Immersion',
];

export const ALL_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
