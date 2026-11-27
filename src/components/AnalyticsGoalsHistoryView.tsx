import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  Clock,
  Lock,
  Plus,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import {
  LocalDiagnosticHeuristicEngine,
  type CEFRProgressionForecast,
  type LearningPatternInsight,
  type SkillWeaknessDiagnostic,
} from '../ai/FutureAIArchitecture';
import { ALL_ACTIVITIES, ALL_LEVELS, ALL_SKILLS } from '../services/timerBridge';
import type {
  AppState,
  CEFRLevel,
  SkillType,
  StudyGoals,
  StudySession,
  TimerActivity,
} from '../types/foco';
import {
  computeDashboardMetrics,
  computeMonthlyTrend,
  computeSkillBreakdown,
  evaluateAchievements,
  formatHoursMinutes,
  getMonthPrefixISO,
  getTodayISO,
  getWeekStartISO,
} from '../utils/analytics';
import { MonthlyTrendChart, SkillBarChart, SkillPieChart } from './SkillCharts';

/* ---------------- SKILL ANALYSIS & STATISTICS ---------------- */
export const SkillAnalysisView: React.FC<{ state: AppState }> = ({ state }) => {
  const breakdown = useMemo(() => computeSkillBreakdown(state.sessions), [state.sessions]);
  const monthlyTrend = useMemo(() => computeMonthlyTrend(state.sessions, 6), [state.sessions]);
  const achievements = useMemo(() => evaluateAchievements(state), [state]);

  const [diagnostic, setDiagnostic] = useState<SkillWeaknessDiagnostic | null>(null);
  const [forecast, setForecast] = useState<CEFRProgressionForecast | null>(null);
  const [pattern, setPattern] = useState<LearningPatternInsight | null>(null);

  useEffect(() => {
    const engine = new LocalDiagnosticHeuristicEngine();
    Promise.all([
      engine.analyzeSkillWeaknesses(state),
      engine.predictCEFRProgression(state),
      engine.detectLearningPatterns(state.sessions, state),
    ]).then(([d, f, p]) => {
      setDiagnostic(d);
      setForecast(f);
      setPattern(p);
    });
  }, [state]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
          Skill Analysis & Achievements
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Combined metrics from background timer sessions, manual time entries, and V1 imports.
        </p>
      </div>

      {/* Pie + Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Percentage Distribution
          </h2>
          <SkillPieChart data={breakdown} />
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Total Time by Skill
          </h2>
          <SkillBarChart data={breakdown} />
        </section>
      </div>

      {/* Monthly Trend */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Monthly Trend (Total Hours vs Speaking Focus)
        </h2>
        <MonthlyTrendChart data={monthlyTrend} />
      </section>

      {/* Future AI Architecture Local Heuristic Diagnostics */}
      {diagnostic && forecast && pattern && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Offline Fluency Diagnostics (Future AI Module Ready)
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              100% Local Engine · No Cloud Calls
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 space-y-1">
              <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                Speaking Balance
              </p>
              <p className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {diagnostic.speakingBalanceRatio}% speaking
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {diagnostic.recommendationSummary}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 space-y-1">
              <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                CEFR Target Projection ({forecast.currentLevel} → {forecast.targetLevel})
              </p>
              <p className="font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                ~{forecast.estimatedHoursRemaining}h remaining
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Est. date: {forecast.estimatedCompletionDate}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 space-y-1">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                Detected Study Pattern
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {pattern.peakStudyWindow}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Avg {pattern.averageSessionMinutes}m/session · {pattern.suggestedAction}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Achievements Grid */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Achievements & Milestones
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className={`rounded-2xl border p-4 space-y-2 ${
                ach.unlocked
                  ? 'border-teal-600/40 bg-teal-600/5 dark:bg-teal-500/10'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-85'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {ach.unlocked ? (
                    <Award className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0" />
                  ) : (
                    <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                  )}
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {ach.title}
                  </h3>
                </div>
                <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                  {ach.progressPercent}%
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{ach.description}</p>
              <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${ach.unlocked ? 'bg-teal-600' : 'bg-slate-400'}`}
                  style={{ width: `${ach.progressPercent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

/* ---------------- GOALS SYSTEM ---------------- */
export const GoalsView: React.FC<{
  state: AppState;
  onUpdateGoals: (goals: StudyGoals) => void;
}> = ({ state, onUpdateGoals }) => {
  const metrics = computeDashboardMetrics(state);
  const [dailyHours, setDailyHours] = useState((state.goals.dailyMinutes / 60).toFixed(1));
  const [weeklyHours, setWeeklyHours] = useState((state.goals.weeklyMinutes / 60).toFixed(1));
  const [monthlyHours, setMonthlyHours] = useState((state.goals.monthlyMinutes / 60).toFixed(1));
  const [currentLevel, setCurrentLevel] = useState<CEFRLevel>(state.goals.currentLevel);
  const [targetLevel, setTargetLevel] = useState<CEFRLevel>(state.goals.targetLevel);
  const [speakingTarget, setSpeakingTarget] = useState(state.goals.speakingFocusTargetPercent);
  const [savedToast, setSavedToast] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateGoals({
      dailyMinutes: Math.max(15, Math.round(Number(dailyHours) * 60) || 60),
      weeklyMinutes: Math.max(60, Math.round(Number(weeklyHours) * 60) || 600),
      monthlyMinutes: Math.max(120, Math.round(Number(monthlyHours) * 60) || 2400),
      currentLevel,
      targetLevel,
      speakingFocusTargetPercent: Math.min(90, Math.max(10, Number(speakingTarget) || 35)),
    });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const goalCards = [
    {
      title: 'Daily Goal',
      target: formatHoursMinutes(state.goals.dailyMinutes * 60),
      completed: formatHoursMinutes(metrics.todaySeconds),
      remaining: formatHoursMinutes(metrics.dailyRemainingSec),
      percent: metrics.dailyPercent,
    },
    {
      title: 'Weekly Goal',
      target: formatHoursMinutes(state.goals.weeklyMinutes * 60),
      completed: formatHoursMinutes(metrics.weekSeconds),
      remaining: formatHoursMinutes(metrics.weeklyRemainingSec),
      percent: metrics.weeklyPercent,
    },
    {
      title: 'Monthly Goal',
      target: formatHoursMinutes(state.goals.monthlyMinutes * 60),
      completed: formatHoursMinutes(metrics.monthSeconds),
      remaining: formatHoursMinutes(metrics.monthlyRemainingSec),
      percent: metrics.monthlyPercent,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
          Study Goals & CEFR Targets
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Track daily, weekly, and monthly targets plus your speaking priority balance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {goalCards.map((g) => (
          <div
            key={g.title}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {g.title} ({g.target})
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-teal-700 dark:text-teal-400">
                {g.percent}%
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-600 transition-all"
                style={{ width: `${g.percent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              <span>Completed: {g.completed}</span>
              <span>Remaining: {g.remaining}</span>
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5"
      >
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Configure Targets
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <label className="block">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Daily Goal (hours/day)
            </span>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="16"
              value={dailyHours}
              onChange={(e) => setDailyHours(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Weekly Goal (hours/week)
            </span>
            <input
              type="number"
              step="1"
              min="1"
              max="80"
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Monthly Goal (hours/month)
            </span>
            <input
              type="number"
              step="1"
              min="2"
              max="300"
              value={monthlyHours}
              onChange={(e) => setMonthlyHours(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <label className="block">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Current CEFR Level
            </span>
            <select
              value={currentLevel}
              onChange={(e) => setCurrentLevel(e.target.value as CEFRLevel)}
              className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3"
            >
              {ALL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Target CEFR Level
            </span>
            <select
              value={targetLevel}
              onChange={(e) => setTargetLevel(e.target.value as CEFRLevel)}
              className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3"
            >
              {ALL_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Speaking Focus Target (%)
            </span>
            <input
              type="number"
              min={10}
              max={90}
              value={speakingTarget}
              onChange={(e) => setSpeakingTarget(Number(e.target.value))}
              className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="min-h-[44px] px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-sm font-semibold text-white"
          >
            Save Goals
          </button>
          {savedToast && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400">
              <Check className="h-4 w-4" /> Goals updated
            </span>
          )}
        </div>
      </form>
    </div>
  );
};

/* ---------------- HISTORY & MANUAL TIME ENTRY ---------------- */
interface HistoryViewProps {
  state: AppState;
  onAddManualSession: (session: StudySession) => void;
  onDeleteSession: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  state,
  onAddManualSession,
  onDeleteSession,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [date, setDate] = useState(getTodayISO());
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(30);
  const [topicId, setTopicId] = useState(state.topics[0]?.id ?? '');
  const [skill, setSkill] = useState<SkillType>('Listening');
  const [level, setLevel] = useState<CEFRLevel>(state.goals.currentLevel);
  const [activity, setActivity] = useState<TimerActivity>('Listening Active');
  const [notes, setNotes] = useState('');

  const today = getTodayISO();
  const weekStart = getWeekStartISO();
  const monthPrefix = getMonthPrefixISO();

  const summarizeBySkill = (list: StudySession[]) => {
    const map = new Map<SkillType, number>();
    let total = 0;
    for (const s of list) {
      map.set(s.skill, (map.get(s.skill) ?? 0) + s.durationSeconds);
      total += s.durationSeconds;
    }
    const items = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return { total, items };
  };

  const todaySummary = summarizeBySkill(state.sessions.filter((s) => s.date === today));
  const weekSummary = summarizeBySkill(
    state.sessions.filter((s) => s.date >= weekStart && s.date <= today)
  );
  const monthSummary = summarizeBySkill(
    state.sessions.filter((s) => s.date.startsWith(monthPrefix))
  );
  const allSummary = summarizeBySkill(state.sessions);

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    const totalSeconds = Math.max(60, hours * 3600 + minutes * 60);
    const topic = state.topics.find((t) => t.id === topicId);
    onAddManualSession({
      id: `manual-${Date.now()}`,
      date,
      startTime: '09:00',
      endTime: '10:00',
      durationSeconds: totalSeconds,
      activity,
      topicId: topic?.id,
      topicTitle: topic?.title ?? 'Manual Study Entry',
      skill,
      level,
      notes: notes.trim(),
      source: 'manual',
      createdAt: Date.now(),
    });
    setNotes('');
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
            Study History & Manual Time Entry
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Includes timer logs, manually added hours, and imported FOCOENGLISH V1 records.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Manual Hours
        </button>
      </div>

      {/* Period Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Today', data: todaySummary },
          { label: 'This Week', data: weekSummary },
          { label: 'This Month', data: monthSummary },
          { label: 'All Time', data: allSummary },
        ].map((block) => (
          <div
            key={block.label}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {block.label}
              </span>
              <span className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">
                {formatHoursMinutes(block.data.total)}
              </span>
            </div>
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
              {block.data.items.slice(0, 3).map(([sk, sec]) => (
                <div key={sk} className="flex justify-between">
                  <span>{sk}</span>
                  <span className="font-mono tabular-nums">{formatHoursMinutes(sec)}</span>
                </div>
              ))}
              {block.data.items.length === 0 && <span>No entries yet</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Full Session Log */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
        {state.sessions.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No study sessions recorded yet. Start the Study Timer or insert manual hours.
          </div>
        ) : (
          state.sessions
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
            .map((s) => (
              <div key={s.id} className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-teal-700 dark:text-teal-400">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono">{s.date}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{s.skill}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{s.level}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{s.activity}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="capitalize">
                        {s.source === 'v1_import' ? 'V1 Import' : s.source}
                      </span>
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {s.topicTitle}
                    </p>
                    {s.notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">{s.notes}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatHoursMinutes(s.durationSeconds)}
                  </span>
                  <button
                    onClick={() => onDeleteSession(s.id)}
                    aria-label="Delete session"
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
        )}
      </div>

      {/* Manual Time Entry Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                Manual Study Time Entry
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-2 text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddManual} className="space-y-3.5 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Date</span>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Hours</span>
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={hours}
                    onChange={(e) => setHours(Math.max(0, Number(e.target.value)))}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Minutes</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={minutes}
                    onChange={(e) => setMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Skill</span>
                  <select
                    value={skill}
                    onChange={(e) => setSkill(e.target.value as SkillType)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3"
                  >
                    {ALL_SKILLS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Level</span>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as CEFRLevel)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3"
                  >
                    {ALL_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Topic</span>
                  <select
                    value={topicId}
                    onChange={(e) => setTopicId(e.target.value)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3"
                  >
                    {state.topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.level}] {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Activity</span>
                  <select
                    value={activity}
                    onChange={(e) => setActivity(e.target.value as TimerActivity)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3"
                  >
                    {ALL_ACTIVITIES.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Notes</span>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., BBC Learning English / FOCOENGLISH V1 log"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-xl bg-teal-600 text-xs font-semibold text-white"
                >
                  Save Hours
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
