import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Flame,
  Mic,
  Play,
  Target,
  TrendingUp,
} from 'lucide-react';
import { LocalDiagnosticHeuristicEngine, type SkillWeaknessDiagnostic } from '../ai/FutureAIArchitecture';
import type { AppSection, AppState, RoadmapTopic, TimerActivity } from '../types/foco';
import {
  computeDashboardMetrics,
  computeSkillBreakdown,
  evaluateAchievements,
  formatHoursMinutes,
  getTopicDeadlineState,
} from '../utils/analytics';

interface DashboardJourneyViewProps {
  mode: 'dashboard' | 'journey';
  state: AppState;
  onNavigate: (section: AppSection) => void;
  onQuickStartTimer: (activity: TimerActivity, topic?: RoadmapTopic) => void;
}

const ProgressRing: React.FC<{ percent: number; label: string; subtext: string }> = ({
  percent,
  label,
  subtext,
}) => {
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, percent)) / 100) * c;

  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-slate-100 dark:text-slate-800"
          />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke="#0D9488"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold tabular-nums text-slate-900 dark:text-slate-100">
          {percent}%
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
          {subtext}
        </p>
      </div>
    </div>
  );
};

export const DashboardJourneyView: React.FC<DashboardJourneyViewProps> = ({
  mode,
  state,
  onNavigate,
  onQuickStartTimer,
}) => {
  const metrics = computeDashboardMetrics(state);
  const skills = computeSkillBreakdown(state.sessions);
  const achievements = evaluateAchievements(state);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const [diagnostic, setDiagnostic] = useState<SkillWeaknessDiagnostic | null>(null);

  useEffect(() => {
    const engine = new LocalDiagnosticHeuristicEngine();
    engine.analyzeSkillWeaknesses(state).then(setDiagnostic);
  }, [state]);

  const upcomingDeadlines = state.topics
    .filter((t) => t.status !== 'mastered' && t.deadline)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    .slice(0, 4);

  const nextSpeakingTopic =
    state.topics.find((t) => t.level === state.goals.currentLevel && t.status !== 'mastered') ??
    state.topics.find((t) => t.status !== 'mastered') ??
    state.topics[0];

  const masteredCount = state.topics.filter((t) => t.status === 'mastered').length;
  const totalTopicsCount = state.topics.length;

  return (
    <div className="space-y-6">
      {/* Primary Journey Hero Anchor */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2">
            <p className="text-xs font-medium text-teal-700 dark:text-teal-400">
              {mode === 'journey' ? 'English Journey' : 'Study Overview'} · Offline Personal Companion
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              {formatHoursMinutes(metrics.totalSeconds)} studied
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Current Level <span className="font-semibold text-slate-900 dark:text-slate-100">{state.goals.currentLevel}</span>
              <span aria-hidden="true"> · </span>
              Target Level <span className="font-semibold text-slate-900 dark:text-slate-100">{state.goals.targetLevel}</span>
              <span aria-hidden="true"> · </span>
              Speaking Share <span className="font-mono font-semibold tabular-nums text-teal-700 dark:text-teal-400">{metrics.speakingSharePercent}%</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onQuickStartTimer('Speaking', nextSpeakingTopic)}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] px-5 py-2.5 text-sm font-semibold text-white transition"
            >
              <Mic className="h-4 w-4" />
              <span className="whitespace-nowrap">Start Speaking Drill</span>
            </button>
            <button
              onClick={() => onNavigate('timer')}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 transition"
            >
              <Play className="h-4 w-4" />
              <span className="whitespace-nowrap">Open Timer</span>
            </button>
          </div>
        </div>

        {/* Key Journey Numbers Strip */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-slate-200 dark:border-slate-800 pt-5">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Current Streak</p>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              <Flame className="h-5 w-5 text-amber-500" />
              {metrics.streakDays} {metrics.streakDays === 1 ? 'day' : 'days'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Speaking Invested</p>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
              {formatHoursMinutes(metrics.speakingSeconds)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Roadmap Mastery</p>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {masteredCount} / {totalTopicsCount} lessons
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Milestones Unlocked</p>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {unlockedCount} / {achievements.length}
            </p>
          </div>
        </div>
      </section>

      {/* Daily, Weekly, Monthly Goal Rings */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ProgressRing
          percent={metrics.dailyPercent}
          label="Daily Goal"
          subtext={`${formatHoursMinutes(metrics.todaySeconds)} / ${formatHoursMinutes(state.goals.dailyMinutes * 60)}`}
        />
        <ProgressRing
          percent={metrics.weeklyPercent}
          label="Weekly Goal"
          subtext={`${formatHoursMinutes(metrics.weekSeconds)} / ${formatHoursMinutes(state.goals.weeklyMinutes * 60)}`}
        />
        <ProgressRing
          percent={metrics.monthlyPercent}
          label="Monthly Goal"
          subtext={`${formatHoursMinutes(metrics.monthSeconds)} / ${formatHoursMinutes(state.goals.monthlyMinutes * 60)}`}
        />
      </section>

      {/* Two-Column Actionable Priorities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Speaking Priority & Deadlines */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Lesson Deadlines & Speaking Queue
              </h2>
            </div>
            <button
              onClick={() => onNavigate('levels')}
              className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1"
            >
              View Roadmap <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {nextSpeakingTopic && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4 space-y-2">
              <p className="text-xs font-medium text-teal-700 dark:text-teal-400">
                Active Focus · {nextSpeakingTopic.level} · {nextSpeakingTopic.deadline ? `Due ${nextSpeakingTopic.deadline}` : 'No deadline set'}
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {nextSpeakingTopic.title}
              </p>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {nextSpeakingTopic.speakingFocusPrompt}
              </p>
            </div>
          )}

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {upcomingDeadlines.length === 0 ? (
              <p className="py-4 text-sm text-slate-500 dark:text-slate-400">
                No lesson deadlines set yet. Open Levels Roadmap to assign target completion dates.
              </p>
            ) : (
              upcomingDeadlines.map((topic) => {
                const dState = getTopicDeadlineState(topic);
                const statusLabel =
                  dState === 'overdue' ? 'Overdue' : dState === 'due_soon' ? 'Due soon' : 'On track';
                const statusTone =
                  dState === 'overdue'
                    ? 'text-red-600 dark:text-red-400'
                    : dState === 'due_soon'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400';

                return (
                  <div key={topic.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {topic.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {topic.level} · Due {topic.deadline} ·{' '}
                        <span className={`font-medium ${statusTone}`}>{statusLabel}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => onQuickStartTimer('Speaking', topic)}
                      className="min-h-[40px] shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      Practice
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Skill Balance & Offline Local Heuristic Summary */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Skill Distribution & Focus Balance
              </h2>
            </div>
            <button
              onClick={() => onNavigate('statistics')}
              className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1"
            >
              Skill Analysis <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {skills.slice(0, 5).map((item) => (
              <div key={item.skill} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">{item.skill}</span>
                <div className="flex items-center gap-3">
                  <div className="w-28 sm:w-36 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.skill === 'Speaking' ? 'bg-teal-600' : 'bg-blue-600/80'
                      }`}
                      style={{ width: `${Math.max(item.seconds > 0 ? 4 : 0, item.percent)}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs tabular-nums w-20 text-right text-slate-600 dark:text-slate-400">
                    {formatHoursMinutes(item.seconds)} · {item.percent}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {diagnostic && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Target className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Local Study Balance Check (Offline)
              </div>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {diagnostic.recommendationSummary}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
