import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  Compass,
  Film,
  FolderOpen,
  History,
  LayoutDashboard,
  Map as MapIcon,
  MessageSquare,
  MessagesSquare,
  Moon,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Target,
  Timer,
} from 'lucide-react';
import {
  GoalsView,
  HistoryView,
  SkillAnalysisView,
} from './components/AnalyticsGoalsHistoryView';
import { DashboardJourneyView } from './components/DashboardJourneyView';
import { DialoguesView } from './components/DialoguesView';
import { LevelsRoadmapView } from './components/LevelsRoadmapView';
import {
  MoviesSeriesView,
  PhraseBankView,
  QuestionBankView,
} from './components/PracticeBanksView';
import { ResourcesView } from './components/ResourcesView';
import { SettingsBackupView } from './components/SettingsBackupView';
import { StudyTimerView } from './components/StudyTimerView';
import { createInitialAppState } from './data/initialData';
import { useOnlineStatus } from './hooks/usePWAInstall';
import {
  ACTIVITY_DEFAULT_SKILL,
  computeElapsedMs,
  pullNativeTimerState,
  showBrowserPersistentNotification,
  syncNativeTimerPause,
  syncNativeTimerResume,
  syncNativeTimerStart,
  syncNativeTimerStop,
  updateWebNotificationAndTitle,
} from './services/timerBridge';
import { loadAppState, saveAppState } from './storage/offlineDb';
import type {
  ActiveTimerState,
  AppSection,
  AppSettings,
  AppState,
  CEFRLevel,
  RoadmapTopic,
  StudyGoals,
  StudySession,
  TimerActivity,
} from './types/foco';
import { formatHMS, getTodayISO } from './utils/analytics';

const NAV_GROUPS: Array<{
  group: string;
  items: Array<{ id: AppSection; label: string; icon: React.ComponentType<{ className?: string }> }>;
}> = [
  {
    group: 'Core Journey',
    items: [
      { id: 'journey', label: 'English Journey', icon: Compass },
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'levels', label: 'Levels Roadmap', icon: MapIcon },
      { id: 'timer', label: 'Study Timer', icon: Timer },
    ],
  },
  {
    group: 'Library & Speaking',
    items: [
      { id: 'resources', label: 'Resources', icon: FolderOpen },
      { id: 'dialogues', label: 'Dialogues', icon: MessagesSquare },
      { id: 'phrases', label: 'Phrase Bank', icon: BookOpen },
      { id: 'questions', label: 'Question Bank', icon: MessageSquare },
      { id: 'movies', label: 'Movies & Series', icon: Film },
    ],
  },
  {
    group: 'Analytics & System',
    items: [
      { id: 'statistics', label: 'Skill Analysis', icon: BarChart3 },
      { id: 'goals', label: 'Goals', icon: Target },
      { id: 'history', label: 'History', icon: History },
      { id: 'settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];

const PRACTICE_SECTIONS: AppSection[] = ['resources', 'dialogues', 'phrases', 'questions', 'movies'];
const INSIGHTS_SECTIONS: AppSection[] = ['statistics', 'goals', 'history', 'settings'];

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [section, setSection] = useState<AppSection>('journey');
  const [tickNow, setTickNow] = useState(Date.now());
  const isOnline = useOnlineStatus();

  // Load persisted offline state
  useEffect(() => {
    let mounted = true;
    loadAppState().then(async (loaded) => {
      if (!mounted) return;
      // Reconcile native Android foreground timer if returning from background
      const nativeState = await pullNativeTimerState();
      if (nativeState && (nativeState.isRunning || nativeState.isPaused)) {
        loaded = {
          ...loaded,
          activeTimer: {
            ...loaded.activeTimer,
            status: nativeState.isRunning ? 'running' : 'paused',
            accumulatedMs: nativeState.accumulatedMs,
            lastResumedAtMs: nativeState.isRunning ? nativeState.lastResumedAtMs : null,
          },
        };
      }
      setState(loaded);
    });
    const onOpenTimer = () => setSection('timer');
    window.addEventListener('foco-open-timer', onOpenTimer);
    return () => {
      mounted = false;
      window.removeEventListener('foco-open-timer', onOpenTimer);
    };
  }, []);

  // Sync theme class on <html>
  useEffect(() => {
    if (!state) return;
    const root = document.documentElement;
    if (state.settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [state?.settings.theme]);

  // Persist every state change locally
  useEffect(() => {
    if (!state) return;
    saveAppState(state);
  }, [state]);

  // Background wall-clock ticker for document title & persistent notifications
  useEffect(() => {
    if (!state) return;
    updateWebNotificationAndTitle(state.activeTimer);
    if (state.activeTimer.status !== 'running') return;

    const id = window.setInterval(() => {
      setTickNow(Date.now());
      updateWebNotificationAndTitle(state.activeTimer);
    }, 1000);

    const onVisibility = async () => {
      if (document.visibilityState === 'visible') {
        setTickNow(Date.now());
        const nativeState = await pullNativeTimerState();
        if (nativeState) {
          setState((prev) => {
            if (!prev) return prev;
            if (!nativeState.isRunning && !nativeState.isPaused) return prev;
            return {
              ...prev,
              activeTimer: {
                ...prev.activeTimer,
                status: nativeState.isRunning ? 'running' : 'paused',
                accumulatedMs: nativeState.accumulatedMs,
                lastResumedAtMs: nativeState.isRunning ? nativeState.lastResumedAtMs : null,
              },
            };
          });
        }
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [state?.activeTimer]);

  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setState((prev) => (prev ? updater(prev) : prev));
  }, []);

  // Timer Handlers
  const handleStartTimer = useCallback(() => {
    updateState((prev) => {
      const now = Date.now();
      const nextTimer: ActiveTimerState = {
        ...prev.activeTimer,
        sessionId: prev.activeTimer.sessionId ?? `sess-${now}`,
        status: 'running',
        startedAtMs: prev.activeTimer.startedAtMs ?? now,
        lastResumedAtMs: now,
      };
      syncNativeTimerStart(nextTimer);
      showBrowserPersistentNotification(nextTimer, prev.settings.notificationsEnabled);
      return { ...prev, activeTimer: nextTimer };
    });
  }, [updateState]);

  const handlePauseTimer = useCallback(() => {
    updateState((prev) => {
      if (prev.activeTimer.status !== 'running') return prev;
      const now = Date.now();
      const elapsed = computeElapsedMs(prev.activeTimer, now);
      const nextTimer: ActiveTimerState = {
        ...prev.activeTimer,
        status: 'paused',
        accumulatedMs: elapsed,
        lastResumedAtMs: null,
      };
      syncNativeTimerPause(nextTimer);
      showBrowserPersistentNotification(nextTimer, prev.settings.notificationsEnabled);
      return { ...prev, activeTimer: nextTimer };
    });
  }, [updateState]);

  const handleResumeTimer = useCallback(() => {
    updateState((prev) => {
      if (prev.activeTimer.status !== 'paused') return prev;
      const now = Date.now();
      const nextTimer: ActiveTimerState = {
        ...prev.activeTimer,
        status: 'running',
        lastResumedAtMs: now,
      };
      syncNativeTimerResume(nextTimer);
      showBrowserPersistentNotification(nextTimer, prev.settings.notificationsEnabled);
      return { ...prev, activeTimer: nextTimer };
    });
  }, [updateState]);

  const handleStopAndSaveTimer = useCallback(() => {
    updateState((prev) => {
      const now = Date.now();
      const totalSec = Math.max(1, Math.floor(computeElapsedMs(prev.activeTimer, now) / 1000));
      const startDate = new Date(prev.activeTimer.startedAtMs ?? now - totalSec * 1000);
      const endDate = new Date(now);
      const fmtTime = (d: Date) =>
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      const isLesson = prev.activeTimer.studyMode === 'lesson';
      const newSession: StudySession = {
        id: prev.activeTimer.sessionId ?? `timer-${now}`,
        studyMode: prev.activeTimer.studyMode,
        date: getTodayISO(),
        startTime: fmtTime(startDate),
        endTime: fmtTime(endDate),
        durationSeconds: totalSec,
        activity: prev.activeTimer.activity,
        customActivityName:
          prev.activeTimer.activity === 'Custom Activities'
            ? prev.activeTimer.customActivityName
            : undefined,
        topicId: isLesson ? prev.activeTimer.topicId || undefined : undefined,
        topicTitle: isLesson ? prev.activeTimer.topicTitle : '',
        skill: isLesson
          ? prev.activeTimer.skill
          : prev.activeTimer.skill ?? ACTIVITY_DEFAULT_SKILL[prev.activeTimer.activity],
        level: prev.activeTimer.level,
        notes: prev.activeTimer.notes,
        source: 'timer',
        createdAt: now,
      };

      syncNativeTimerStop();

      const resetTimer: ActiveTimerState = {
        ...prev.activeTimer,
        sessionId: null,
        status: 'idle',
        startedAtMs: null,
        lastResumedAtMs: null,
        accumulatedMs: 0,
        notes: '',
      };

      return {
        ...prev,
        sessions: [newSession, ...prev.sessions],
        activeTimer: resetTimer,
      };
    });
  }, [updateState]);

  const handleDiscardTimer = useCallback(() => {
    syncNativeTimerStop();
    updateState((prev) => ({
      ...prev,
      activeTimer: {
        ...prev.activeTimer,
        sessionId: null,
        status: 'idle',
        startedAtMs: null,
        lastResumedAtMs: null,
        accumulatedMs: 0,
      },
    }));
  }, [updateState]);

  const handleEditElapsedSeconds = useCallback(
    (seconds: number) => {
      updateState((prev) => {
        const now = Date.now();
        const nextTimer: ActiveTimerState = {
          ...prev.activeTimer,
          accumulatedMs: seconds * 1000,
          lastResumedAtMs: prev.activeTimer.status === 'running' ? now : null,
        };
        return { ...prev, activeTimer: nextTimer };
      });
    },
    [updateState]
  );

  const handleQuickStartTimer = useCallback(
    (activity: TimerActivity, topic?: RoadmapTopic) => {
      updateState((prev) => {
        const now = Date.now();
        const isLesson = Boolean(topic);
        const nextTimer: ActiveTimerState = {
          sessionId: `sess-${now}`,
          studyMode: isLesson ? 'lesson' : 'skill',
          status: 'running',
          startedAtMs: now,
          lastResumedAtMs: now,
          accumulatedMs: 0,
          activity,
          customActivityName: '',
          topicId: topic ? topic.id : '',
          topicTitle: topic ? topic.title : '',
          skill: isLesson ? null : ACTIVITY_DEFAULT_SKILL[activity],
          level: topic ? topic.level : prev.goals.currentLevel,
          notes: '',
        };
        syncNativeTimerStart(nextTimer);
        showBrowserPersistentNotification(nextTimer, prev.settings.notificationsEnabled);
        return { ...prev, activeTimer: nextTimer };
      });
      setSection('timer');
    },
    [updateState]
  );

  const sessionSecondsByTopic = useMemo(() => {
    const map: Record<string, number> = {};
    if (!state) return map;
    for (const s of state.sessions) {
      if (s.topicId) {
        map[s.topicId] = (map[s.topicId] ?? 0) + s.durationSeconds;
      }
    }
    return map;
  }, [state?.sessions]);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B1120] text-slate-600 dark:text-slate-300 text-sm">
        Loading FOCOENGLISH MOBILE V2.0...
      </div>
    );
  }

  const activeElapsedSec = Math.floor(computeElapsedMs(state.activeTimer, tickNow) / 1000);
  const timerIsActive = state.activeTimer.status !== 'idle';

  const mobileTabGroup =
    section === 'journey' || section === 'dashboard'
      ? 'journey'
      : section === 'levels'
        ? 'levels'
        : section === 'timer'
          ? 'timer'
          : PRACTICE_SECTIONS.includes(section)
            ? 'practice'
            : 'insights';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="h-14 px-5 flex items-center border-b border-slate-200 dark:border-slate-800">
          <span className="font-display text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap">
            FOCOENGLISH
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {NAV_GROUPS.map((grp) => (
            <div key={grp.group} className="space-y-1">
              <p className="px-3 text-xs font-semibold text-slate-400 dark:text-slate-500">
                {grp.group}
              </p>
              {grp.items.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSection(item.id)}
                    className={`w-full min-h-[42px] flex items-center gap-3 px-3 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                      active
                        ? 'bg-teal-600/10 text-teal-700 dark:text-teal-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.id === 'timer' && timerIsActive && (
                      <span className="ml-auto font-mono text-xs tabular-nums text-teal-600 dark:text-teal-400">
                        {formatHMS(activeElapsedSec)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={() =>
              updateState((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  theme: prev.settings.theme === 'dark' ? 'light' : 'dark',
                },
              }))
            }
            className="min-h-[40px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {state.settings.theme === 'dark' ? (
              <>
                <Sun className="h-4 w-4 text-amber-400" /> Light Theme
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" /> Dark Theme
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Compact Top Bar (Mobile <= 48px, Desktop 56px, strict 3-zone) */}
        <header className="sticky top-0 z-30 h-12 lg:h-14 px-4 sm:px-6 flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
          <span className="lg:hidden font-display text-sm font-extrabold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0">
            FOCOENGLISH
          </span>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
            <button
              onClick={() => setSection('journey')}
              className={`hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap shrink-0 ${
                section === 'journey' ? 'text-slate-900 dark:text-slate-50 font-semibold' : ''
              }`}
            >
              Journey
            </button>
            <button
              onClick={() => setSection('levels')}
              className={`hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap shrink-0 ${
                section === 'levels' ? 'text-slate-900 dark:text-slate-50 font-semibold' : ''
              }`}
            >
              Roadmap
            </button>
            <button
              onClick={() => setSection('questions')}
              className={`hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap shrink-0 ${
                section === 'questions' ? 'text-slate-900 dark:text-slate-50 font-semibold' : ''
              }`}
            >
              Speaking Bank
            </button>
            <button
              onClick={() => setSection('statistics')}
              className={`hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap shrink-0 ${
                section === 'statistics' ? 'text-slate-900 dark:text-slate-50 font-semibold' : ''
              }`}
            >
              Skill Analysis
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() =>
                updateState((prev) => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    theme: prev.settings.theme === 'dark' ? 'light' : 'dark',
                  },
                }))
              }
              aria-label="Toggle theme"
              className="lg:hidden min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300"
            >
              {state.settings.theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            <button
              onClick={() => setSection('timer')}
              className={`min-h-[36px] lg:min-h-[40px] inline-flex items-center gap-2 rounded-xl px-3.5 text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                timerIsActive
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
              }`}
            >
              <Timer className="h-3.5 w-3.5" />
              {timerIsActive ? (
                <span className="font-mono tabular-nums">{formatHMS(activeElapsedSec)}</span>
              ) : (
                <span>Study Timer</span>
              )}
            </button>
          </div>
        </header>

        {/* Offline Indicator Banner */}
        {!isOnline && (
          <div className="px-4 py-1.5 bg-amber-500/15 border-b border-amber-500/30 text-xs font-medium text-amber-700 dark:text-amber-300 text-center">
            Offline Mode Active — All data, timers, and PDFs work locally without internet.
          </div>
        )}

        {/* Mobile Contextual Sub-Tabs for Multi-Section Hubs */}
        {mobileTabGroup === 'journey' && (
          <div className="lg:hidden px-4 pt-3 flex items-center gap-2">
            <button
              onClick={() => setSection('journey')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                section === 'journey'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              English Journey
            </button>
            <button
              onClick={() => setSection('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                section === 'dashboard'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Dashboard
            </button>
          </div>
        )}

        {mobileTabGroup === 'practice' && (
          <div className="lg:hidden px-4 pt-3 flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                ['resources', 'Resources'],
                ['dialogues', 'Dialogues'],
                ['phrases', 'Phrase Bank'],
                ['questions', 'Question Bank'],
                ['movies', 'Movies & Series'],
              ] as const
            ).map(([id, lbl]) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  section === id
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        )}

        {mobileTabGroup === 'insights' && (
          <div className="lg:hidden px-4 pt-3 flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                ['statistics', 'Skill Analysis'],
                ['goals', 'Goals'],
                ['history', 'History'],
                ['settings', 'Settings'],
              ] as const
            ).map(([id, lbl]) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  section === id
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable Content Viewport */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 pb-24 lg:pb-10">
          {(section === 'journey' || section === 'dashboard') && (
            <DashboardJourneyView
              mode={section}
              state={state}
              onNavigate={setSection}
              onQuickStartTimer={handleQuickStartTimer}
            />
          )}

          {section === 'levels' && (
            <LevelsRoadmapView
              topics={state.topics}
              sessionSecondsByTopic={sessionSecondsByTopic}
              currentLevel={state.goals.currentLevel}
              onUpdateTopic={(updated) =>
                updateState((prev) => ({
                  ...prev,
                  topics: prev.topics.map((t) => (t.id === updated.id ? updated : t)),
                }))
              }
              onAddTopic={(newTopic) =>
                updateState((prev) => ({
                  ...prev,
                  topics: [...prev.topics, newTopic],
                }))
              }
              onDeleteTopic={(id) =>
                updateState((prev) => ({
                  ...prev,
                  topics: prev.topics.filter((t) => t.id !== id),
                }))
              }
              onReorderTopic={(id, direction) =>
                updateState((prev) => {
                  const target = prev.topics.find((t) => t.id === id);
                  if (!target) return prev;
                  const sameLevel = prev.topics
                    .filter((t) => t.level === target.level)
                    .sort((a, b) => a.order - b.order);
                  const idx = sameLevel.findIndex((t) => t.id === id);
                  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
                  if (swapIdx < 0 || swapIdx >= sameLevel.length) return prev;
                  const other = sameLevel[swapIdx];
                  return {
                    ...prev,
                    topics: prev.topics.map((t) => {
                      if (t.id === target.id) return { ...t, order: other.order };
                      if (t.id === other.id) return { ...t, order: target.order };
                      return t;
                    }),
                  };
                })
              }
              onStartTimerForTopic={(topic) => handleQuickStartTimer('Speaking', topic)}
            />
          )}

          {section === 'timer' && (
            <StudyTimerView
              timer={state.activeTimer}
              topics={state.topics}
              notificationsEnabled={state.settings.notificationsEnabled}
              onUpdateTimerConfig={(patch) =>
                updateState((prev) => {
                  const nextMode = patch.studyMode ?? prev.activeTimer.studyMode;
                  const nextActivity = patch.activity ?? prev.activeTimer.activity;
                  const nextSkill =
                    patch.skill !== undefined
                      ? patch.skill
                      : nextMode === 'skill' && patch.activity
                        ? ACTIVITY_DEFAULT_SKILL[nextActivity]
                        : prev.activeTimer.skill;
                  return {
                    ...prev,
                    activeTimer: {
                      ...prev.activeTimer,
                      ...patch,
                      studyMode: nextMode,
                      skill: nextSkill,
                    },
                  };
                })
              }
              onStart={handleStartTimer}
              onPause={handlePauseTimer}
              onResume={handleResumeTimer}
              onStopAndSave={handleStopAndSaveTimer}
              onDiscard={handleDiscardTimer}
              onEditElapsedSeconds={handleEditElapsedSeconds}
              onToggleNotifications={(enabled) =>
                updateState((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, notificationsEnabled: enabled },
                }))
              }
            />
          )}

          {section === 'resources' && (
            <ResourcesView
              resources={state.resources}
              topics={state.topics}
              onAddResource={(res) =>
                updateState((prev) => ({
                  ...prev,
                  resources: [res, ...prev.resources],
                }))
              }
              onDeleteResource={(id) =>
                updateState((prev) => ({
                  ...prev,
                  resources: prev.resources.filter((r) => r.id !== id),
                }))
              }
            />
          )}

          {section === 'dialogues' && (
            <DialoguesView
              dialogues={state.dialogues}
              topics={state.topics}
              onAddDialogue={(d) =>
                updateState((prev) => ({
                  ...prev,
                  dialogues: [d, ...prev.dialogues],
                }))
              }
              onUpdateDialogue={(updated) =>
                updateState((prev) => ({
                  ...prev,
                  dialogues: prev.dialogues.map((d) => (d.id === updated.id ? updated : d)),
                }))
              }
              onDeleteDialogue={(id) =>
                updateState((prev) => ({
                  ...prev,
                  dialogues: prev.dialogues.filter((d) => d.id !== id),
                }))
              }
            />
          )}

          {section === 'phrases' && (
            <PhraseBankView
              phrases={state.phrases}
              topics={state.topics}
              onAddPhrase={(p) =>
                updateState((prev) => ({
                  ...prev,
                  phrases: [p, ...prev.phrases],
                }))
              }
              onToggleFav={(id) =>
                updateState((prev) => ({
                  ...prev,
                  phrases: prev.phrases.map((p) =>
                    p.id === id ? { ...p, isFavourite: !p.isFavourite } : p
                  ),
                }))
              }
              onDeletePhrase={(id) =>
                updateState((prev) => ({
                  ...prev,
                  phrases: prev.phrases.filter((p) => p.id !== id),
                }))
              }
            />
          )}

          {section === 'questions' && (
            <QuestionBankView
              questions={state.questions}
              topics={state.topics}
              onAddQuestion={(q) =>
                updateState((prev) => ({
                  ...prev,
                  questions: [q, ...prev.questions],
                }))
              }
              onMarkPracticed={(id) =>
                updateState((prev) => ({
                  ...prev,
                  questions: prev.questions.map((q) =>
                    q.id === id
                      ? { ...q, practicedCount: q.practicedCount + 1, lastPracticedAt: Date.now() }
                      : q
                  ),
                }))
              }
              onDeleteQuestion={(id) =>
                updateState((prev) => ({
                  ...prev,
                  questions: prev.questions.filter((q) => q.id !== id),
                }))
              }
            />
          )}

          {section === 'movies' && (
            <MoviesSeriesView
              media={state.media}
              onAddMedia={(m) =>
                updateState((prev) => ({
                  ...prev,
                  media: [m, ...prev.media],
                }))
              }
              onDeleteMedia={(id) =>
                updateState((prev) => ({
                  ...prev,
                  media: prev.media.filter((m) => m.id !== id),
                }))
              }
            />
          )}

          {section === 'statistics' && <SkillAnalysisView state={state} />}

          {section === 'goals' && (
            <GoalsView
              state={state}
              onUpdateGoals={(goals: StudyGoals) =>
                updateState((prev) => ({ ...prev, goals }))
              }
            />
          )}

          {section === 'history' && (
            <HistoryView
              state={state}
              onAddManualSession={(sess) =>
                updateState((prev) => ({
                  ...prev,
                  sessions: [sess, ...prev.sessions],
                }))
              }
              onDeleteSession={(id) =>
                updateState((prev) => ({
                  ...prev,
                  sessions: prev.sessions.filter((s) => s.id !== id),
                }))
              }
            />
          )}

          {section === 'settings' && (
            <SettingsBackupView
              state={state}
              onUpdateSettings={(patch: Partial<AppSettings>) =>
                updateState((prev) => ({
                  ...prev,
                  settings: { ...prev.settings, ...patch },
                }))
              }
              onRestoreFullBackup={(restored) => setState(restored)}
              onImportV1Sessions={(importedSessions, detectedLevel?: CEFRLevel) =>
                updateState((prev) => ({
                  ...prev,
                  sessions: [...importedSessions, ...prev.sessions],
                  goals: detectedLevel
                    ? { ...prev.goals, currentLevel: detectedLevel }
                    : prev.goals,
                }))
              }
              onResetAllData={() => setState(createInitialAppState())}
            />
          )}
        </main>
      </div>

      {/* Fixed Mobile Bottom Navigation Bar (56px height, <=15% total viewport sticky cap) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-5 h-14 items-center">
          {(
            [
              { id: 'journey', label: 'Journey', icon: Compass, group: 'journey' },
              { id: 'levels', label: 'Roadmap', icon: CalendarClock, group: 'levels' },
              { id: 'timer', label: 'Timer', icon: Timer, group: 'timer' },
              { id: 'resources', label: 'Library', icon: Sparkles, group: 'practice' },
              { id: 'statistics', label: 'Stats', icon: BarChart3, group: 'insights' },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = mobileTabGroup === tab.group;
            return (
              <button
                key={tab.group}
                onClick={() => setSection(tab.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition ${
                  active
                    ? 'text-teal-600 dark:text-teal-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
