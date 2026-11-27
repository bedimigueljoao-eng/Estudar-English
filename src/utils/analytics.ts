import { ACHIEVEMENT_DEFINITIONS } from '../data/initialData';
import type {
  AppState,
  CEFRLevel,
  RoadmapTopic,
  SkillType,
  StudySession,
  TimerActivity,
} from '../types/foco';

export function formatHMS(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function formatHoursMinutes(totalSeconds: number): string {
  const totalMin = Math.round(Math.max(0, totalSeconds) / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getWeekStartISO(): string {
  const now = new Date();
  const day = now.getDay(); // 0 Sun .. 6 Sat
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

export function getMonthPrefixISO(): string {
  return getTodayISO().slice(0, 7);
}

export function computeStreakDays(sessions: StudySession[]): number {
  const uniqueDates = new Set(sessions.filter((s) => s.durationSeconds >= 60).map((s) => s.date));
  if (uniqueDates.size === 0) return 0;

  const today = new Date();
  const formatD = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let cursor = new Date(today);
  if (!uniqueDates.has(formatD(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!uniqueDates.has(formatD(cursor))) {
      return 0;
    }
  }

  let streak = 0;
  while (uniqueDates.has(formatD(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function computeDashboardMetrics(state: AppState) {
  const today = getTodayISO();
  const weekStart = getWeekStartISO();
  const monthPrefix = getMonthPrefixISO();

  let totalSeconds = 0;
  let todaySeconds = 0;
  let weekSeconds = 0;
  let monthSeconds = 0;
  let speakingSeconds = 0;

  for (const s of state.sessions) {
    totalSeconds += s.durationSeconds;
    if (s.date === today) todaySeconds += s.durationSeconds;
    if (s.date >= weekStart && s.date <= today) weekSeconds += s.durationSeconds;
    if (s.date.startsWith(monthPrefix)) monthSeconds += s.durationSeconds;
    if (
      s.skill === 'Speaking' ||
      s.skill === 'Pronunciation' ||
      s.activity === 'Speaking' ||
      s.activity === 'Conversation Practice' ||
      s.activity === 'Shadowing'
    ) {
      speakingSeconds += s.durationSeconds;
    }
  }

  const dailyTargetSec = Math.max(60, state.goals.dailyMinutes * 60);
  const weeklyTargetSec = Math.max(60, state.goals.weeklyMinutes * 60);
  const monthlyTargetSec = Math.max(60, state.goals.monthlyMinutes * 60);

  return {
    totalSeconds,
    todaySeconds,
    weekSeconds,
    monthSeconds,
    speakingSeconds,
    speakingSharePercent: totalSeconds > 0 ? Math.round((speakingSeconds / totalSeconds) * 100) : 0,
    streakDays: computeStreakDays(state.sessions),
    dailyPercent: Math.min(100, Math.round((todaySeconds / dailyTargetSec) * 100)),
    weeklyPercent: Math.min(100, Math.round((weekSeconds / weeklyTargetSec) * 100)),
    monthlyPercent: Math.min(100, Math.round((monthSeconds / monthlyTargetSec) * 100)),
    dailyRemainingSec: Math.max(0, dailyTargetSec - todaySeconds),
    weeklyRemainingSec: Math.max(0, weeklyTargetSec - weekSeconds),
    monthlyRemainingSec: Math.max(0, monthlyTargetSec - monthSeconds),
  };
}

export function computeSkillBreakdown(sessions: StudySession[]) {
  const map = new Map<SkillType, number>();
  let totalSeconds = 0;
  for (const s of sessions) {
    map.set(s.skill, (map.get(s.skill) ?? 0) + s.durationSeconds);
    totalSeconds += s.durationSeconds;
  }

  const skills: SkillType[] = [
    'Speaking',
    'Listening',
    'Reading',
    'Vocabulary',
    'Grammar',
    'Writing',
    'Pronunciation',
    'Immersion',
  ];

  return skills
    .map((skill) => {
      const seconds = map.get(skill) ?? 0;
      const percent = totalSeconds > 0 ? Math.round((seconds / totalSeconds) * 100) : 0;
      return { skill, seconds, hours: Number((seconds / 3600).toFixed(1)), percent };
    })
    .sort((a, b) => b.seconds - a.seconds);
}

export function computeMonthlyTrend(sessions: StudySession[], monthsCount = 6) {
  const now = new Date();
  const buckets: Array<{ monthKey: string; label: string; totalHours: number; speakingHours: number }> = [];

  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short' });
    buckets.push({ monthKey: key, label, totalHours: 0, speakingHours: 0 });
  }

  for (const s of sessions) {
    const prefix = s.date.slice(0, 7);
    const b = buckets.find((x) => x.monthKey === prefix);
    if (b) {
      b.totalHours += s.durationSeconds / 3600;
      if (s.skill === 'Speaking' || s.skill === 'Pronunciation') {
        b.speakingHours += s.durationSeconds / 3600;
      }
    }
  }

  return buckets.map((b) => ({
    ...b,
    totalHours: Number(b.totalHours.toFixed(1)),
    speakingHours: Number(b.speakingHours.toFixed(1)),
  }));
}

export function evaluateAchievements(state: AppState) {
  const metrics = computeDashboardMetrics(state);
  const totalHours = metrics.totalSeconds / 3600;
  const speakingHours = metrics.speakingSeconds / 3600;
  const sessionCount = state.sessions.length;

  const isLevelFinished = (lvl: CEFRLevel) => {
    const lvlTopics = state.topics.filter((t) => t.level === lvl);
    return lvlTopics.length > 0 && lvlTopics.every((t) => t.status === 'mastered');
  };

  return ACHIEVEMENT_DEFINITIONS.map((def) => {
    let current = 0;
    let unlocked = false;

    if (def.id === 'ach-first-session') {
      current = sessionCount > 0 ? 1 : 0;
      unlocked = sessionCount >= 1;
    } else if (def.category === 'hours') {
      current = Math.floor(totalHours);
      unlocked = totalHours >= def.targetValue;
    } else if (def.category === 'streak') {
      current = metrics.streakDays;
      unlocked = metrics.streakDays >= def.targetValue;
    } else if (def.category === 'speaking') {
      current = Math.floor(speakingHours);
      unlocked = speakingHours >= def.targetValue;
    } else if (def.id === 'ach-finish-a1') {
      unlocked = isLevelFinished('A1');
      current = unlocked ? 1 : 0;
    } else if (def.id === 'ach-finish-a2') {
      unlocked = isLevelFinished('A2');
      current = unlocked ? 1 : 0;
    } else if (def.id === 'ach-finish-b1') {
      unlocked = isLevelFinished('B1');
      current = unlocked ? 1 : 0;
    }

    const progressPercent = Math.min(100, Math.round((current / def.targetValue) * 100));
    return { ...def, current, unlocked, progressPercent };
  });
}

export function getTopicDeadlineState(topic: RoadmapTopic): 'none' | 'completed' | 'overdue' | 'due_soon' | 'on_track' {
  if (topic.status === 'mastered') return 'completed';
  if (!topic.deadline) return 'none';
  const today = getTodayISO();
  if (topic.deadline < today) return 'overdue';
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);
  const soonISO = soon.toISOString().slice(0, 10);
  if (topic.deadline <= soonISO) return 'due_soon';
  return 'on_track';
}

export interface V1MigrationResult {
  valid: boolean;
  importedSessions: StudySession[];
  detectedLevel?: CEFRLevel;
  warnings: string[];
  errors: string[];
}

const VALID_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const VALID_SKILLS: SkillType[] = [
  'Listening',
  'Reading',
  'Vocabulary',
  'Speaking',
  'Writing',
  'Grammar',
  'Pronunciation',
  'Immersion',
];

function mapLegacyActivity(raw: string | undefined): TimerActivity {
  const lower = (raw ?? '').toLowerCase();
  if (lower.includes('shadow')) return 'Shadowing';
  if (lower.includes('convers')) return 'Conversation Practice';
  if (lower.includes('speak')) return 'Speaking';
  if (lower.includes('podcast')) return 'Podcasts';
  if (lower.includes('youtube')) return 'YouTube Learning';
  if (lower.includes('movie')) return 'Movies';
  if (lower.includes('series')) return 'Series';
  if (lower.includes('passive')) return 'Listening Passive';
  if (lower.includes('listen')) return 'Listening Active';
  if (lower.includes('read')) return 'Reading';
  if (lower.includes('writ')) return 'Writing';
  if (lower.includes('gram')) return 'Grammar';
  if (lower.includes('vocab')) return 'Vocabulary';
  if (lower.includes('pronunc')) return 'Pronunciation';
  return 'Immersion';
}

/**
 * Validates and migrates FOCOENGLISH MOBILE V1 JSON payloads into V2 StudySession records.
 */
export function validateAndMigrateV1Data(rawText: string): V1MigrationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      valid: false,
      importedSessions: [],
      warnings: [],
      errors: ['Invalid JSON syntax. Please verify the V1 export file.'],
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      valid: false,
      importedSessions: [],
      warnings: [],
      errors: ['Root V1 payload must be a JSON object or array.'],
    };
  }

  const obj = parsed as Record<string, unknown>;
  const rawRecords = Array.isArray(parsed)
    ? parsed
    : Array.isArray(obj.sessions)
      ? obj.sessions
      : Array.isArray(obj.history)
        ? obj.history
        : Array.isArray(obj.studyLogs)
          ? obj.studyLogs
          : null;

  if (!rawRecords) {
    return {
      valid: false,
      importedSessions: [],
      warnings: [],
      errors: ['Could not detect V1 records array (expected sessions, history, or studyLogs).'],
    };
  }

  const importedSessions: StudySession[] = [];
  rawRecords.forEach((item, idx) => {
    if (!item || typeof item !== 'object') {
      warnings.push(`Skipped malformed record at index ${idx}.`);
      return;
    }
    const r = item as Record<string, unknown>;
    const dateRaw = String(r.date ?? r.studyDate ?? getTodayISO()).slice(0, 10);
    const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : getTodayISO();
    if (dateValid !== dateRaw) {
      warnings.push(`Record ${idx + 1}: normalized invalid date "${dateRaw}" to today.`);
    }

    let durationSec = 0;
    if (typeof r.durationSeconds === 'number') durationSec = r.durationSeconds;
    else if (typeof r.durationMinutes === 'number') durationSec = r.durationMinutes * 60;
    else if (typeof r.minutes === 'number') durationSec = r.minutes * 60;
    else if (typeof r.hours === 'number') durationSec = Math.round(r.hours * 3600);

    if (durationSec <= 0) {
      warnings.push(`Record ${idx + 1}: skipped entry with 0 duration.`);
      return;
    }

    const rawSkill = String(r.skill ?? r.category ?? 'Listening');
    const matchedSkill =
      VALID_SKILLS.find((s) => s.toLowerCase() === rawSkill.toLowerCase()) ?? 'Listening';

    const rawLevel = String(r.level ?? obj.currentLevel ?? 'A1').toUpperCase() as CEFRLevel;
    const matchedLevel = VALID_LEVELS.includes(rawLevel) ? rawLevel : 'A1';

    importedSessions.push({
      id: `v1-${Date.now()}-${idx}`,
      date: dateValid,
      startTime: String(r.startTime ?? '09:00'),
      endTime: String(r.endTime ?? '10:00'),
      durationSeconds: Math.round(durationSec),
      activity: mapLegacyActivity(String(r.activity ?? matchedSkill)),
      topicTitle: String(r.topic ?? r.topicTitle ?? 'Imported V1 Topic'),
      skill: matchedSkill,
      level: matchedLevel,
      notes: String(r.notes ?? r.note ?? 'Migrated from FOCOENGLISH V1'),
      source: 'v1_import',
      createdAt: Date.now() + idx,
    });
  });

  if (importedSessions.length === 0) {
    errors.push('No valid study records with positive duration found in V1 payload.');
    return { valid: false, importedSessions: [], warnings, errors };
  }

  const rawDetectedLevel = String(obj.currentLevel ?? '').toUpperCase() as CEFRLevel;
  return {
    valid: true,
    importedSessions,
    detectedLevel: VALID_LEVELS.includes(rawDetectedLevel) ? rawDetectedLevel : undefined,
    warnings,
    errors,
  };
}
