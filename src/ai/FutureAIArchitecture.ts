import type { AppState, CEFRLevel, SkillType, StudySession } from '../types/foco';

/**
 * FUTURE AI MODULE ARCHITECTURE (OFFLINE-FIRST PORT)
 * ---------------------------------------------------
 * Cloud AI is intentionally disabled in V2.0 so the app operates 100% offline.
 * This interface defines the exact domain contract for a future local/cloud AI
 * coaching engine (e.g., on-device Gemma / Gemini API adapter in V3.0).
 */

export interface SkillWeaknessDiagnostic {
  weakestSkills: Array<{
    skill: SkillType;
    sharePercent: number;
    deficitMinutesPerWeek: number;
    rationale: string;
  }>;
  speakingBalanceRatio: number;
  recommendationSummary: string;
}

export interface StudyPlanRecommendation {
  generatedAt: number;
  targetLevel: CEFRLevel;
  dailySpeakingMinutes: number;
  dailyInputMinutes: number;
  priorityTopicIds: string[];
  weeklyFocusBlocks: Array<{
    dayLabel: string;
    activity: string;
    minutes: number;
    topicTitle: string;
  }>;
}

export interface CEFRProgressionForecast {
  currentLevel: CEFRLevel;
  targetLevel: CEFRLevel;
  estimatedHoursRemaining: number;
  estimatedCompletionDate: string | null;
  confidenceNote: string;
}

export interface LearningPatternInsight {
  peakStudyWindow: string;
  averageSessionMinutes: number;
  consistencyScore: number;
  overdueTopicsCount: number;
  suggestedAction: string;
}

export interface FocoAIEnginePort {
  readonly engineId: string;
  readonly isAvailableOffline: boolean;
  analyzeSkillWeaknesses(state: AppState): Promise<SkillWeaknessDiagnostic>;
  recommendStudyPlan(state: AppState): Promise<StudyPlanRecommendation>;
  predictCEFRProgression(state: AppState): Promise<CEFRProgressionForecast>;
  detectLearningPatterns(sessions: StudySession[], state: AppState): Promise<LearningPatternInsight>;
}

/**
 * Deterministic Local Heuristic Implementation (Zero External Calls)
 * Provides immediate offline structural diagnostics without any LLM or network.
 */
export class LocalDiagnosticHeuristicEngine implements FocoAIEnginePort {
  readonly engineId = 'foco-local-heuristic-v2';
  readonly isAvailableOffline = true;

  async analyzeSkillWeaknesses(state: AppState): Promise<SkillWeaknessDiagnostic> {
    const totals = new Map<SkillType, number>();
    let totalSec = 0;
    for (const s of state.sessions) {
      if (s.skill) {
        totals.set(s.skill, (totals.get(s.skill) ?? 0) + s.durationSeconds);
        totalSec += s.durationSeconds;
      }
    }

    const speakingSec = totals.get('Speaking') ?? 0;
    const speakingRatio = totalSec > 0 ? Math.round((speakingSec / totalSec) * 100) : 0;

    const skills: SkillType[] = ['Speaking', 'Listening', 'Reading', 'Vocabulary', 'Grammar', 'Writing', 'Pronunciation'];
    const weakest = skills
      .map((skill) => {
        const sec = totals.get(skill) ?? 0;
        const pct = totalSec > 0 ? Math.round((sec / totalSec) * 100) : 0;
        const targetPct = skill === 'Speaking' ? state.goals.speakingFocusTargetPercent : 12;
        const deficit = Math.max(0, Math.round(((targetPct - pct) / 100) * state.goals.weeklyMinutes));
        return {
          skill,
          sharePercent: pct,
          deficitMinutesPerWeek: deficit,
          rationale:
            skill === 'Speaking' && pct < state.goals.speakingFocusTargetPercent
              ? `Speaking is ${pct}% vs your ${state.goals.speakingFocusTargetPercent}% target.`
              : `${skill} accounts for ${pct}% of logged study time.`,
        };
      })
      .sort((a, b) => b.deficitMinutesPerWeek - a.deficitMinutesPerWeek)
      .slice(0, 3);

    return {
      weakestSkills: weakest,
      speakingBalanceRatio: speakingRatio,
      recommendationSummary:
        speakingRatio < state.goals.speakingFocusTargetPercent
          ? 'Prioritize Shadowing and Question Bank oral drills to lift speaking output.'
          : 'Speaking ratio is aligned with your fluency target.',
    };
  }

  async recommendStudyPlan(state: AppState): Promise<StudyPlanRecommendation> {
    const upcomingTopics = state.topics
      .filter((t) => t.status !== 'mastered')
      .sort((a, b) => {
        if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        return a.order - b.order;
      })
      .slice(0, 5);

    const dailySpeak = Math.round((state.goals.dailyMinutes * state.goals.speakingFocusTargetPercent) / 100);
    const dailyInput = Math.max(15, state.goals.dailyMinutes - dailySpeak);

    return {
      generatedAt: Date.now(),
      targetLevel: state.goals.targetLevel,
      dailySpeakingMinutes: dailySpeak,
      dailyInputMinutes: dailyInput,
      priorityTopicIds: upcomingTopics.map((t) => t.id),
      weeklyFocusBlocks: upcomingTopics.map((topic, i) => ({
        dayLabel: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][i] ?? 'Sat',
        activity: i % 2 === 0 ? 'Conversation Practice' : 'Shadowing',
        minutes: dailySpeak,
        topicTitle: topic.title,
      })),
    };
  }

  async predictCEFRProgression(state: AppState): Promise<CEFRProgressionForecast> {
    const levelHours: Record<CEFRLevel, number> = {
      A1: 90,
      A2: 180,
      B1: 350,
      B2: 550,
      C1: 800,
      C2: 1050,
    };
    const loggedHours = state.sessions.reduce((acc, s) => acc + s.durationSeconds / 3600, 0);
    const targetHours = levelHours[state.goals.targetLevel];
    const remaining = Math.max(0, Math.round(targetHours - loggedHours));
    const weeklyHours = Math.max(1, state.goals.weeklyMinutes / 60);
    const weeksLeft = remaining / weeklyHours;
    const estDate = new Date(Date.now() + weeksLeft * 7 * 86400000).toISOString().slice(0, 10);

    return {
      currentLevel: state.goals.currentLevel,
      targetLevel: state.goals.targetLevel,
      estimatedHoursRemaining: remaining,
      estimatedCompletionDate: remaining === 0 ? new Date().toISOString().slice(0, 10) : estDate,
      confidenceNote: 'Calculated locally from CEFR guided-learning benchmarks and your weekly study goal.',
    };
  }

  async detectLearningPatterns(sessions: StudySession[], state: AppState): Promise<LearningPatternInsight> {
    const today = new Date().toISOString().slice(0, 10);
    const overdueCount = state.topics.filter(
      (t) => t.status !== 'mastered' && t.deadline && t.deadline < today
    ).length;

    const avgMin =
      sessions.length > 0
        ? Math.round(sessions.reduce((sum, s) => sum + s.durationSeconds, 0) / sessions.length / 60)
        : 0;

    const morning = sessions.filter((s) => Number(s.startTime.split(':')[0]) < 12).length;
    const afternoon = sessions.filter((s) => {
      const h = Number(s.startTime.split(':')[0]);
      return h >= 12 && h < 18;
    }).length;
    const evening = sessions.length - morning - afternoon;

    let peak = 'Evening (18:00+)';
    if (morning >= afternoon && morning >= evening) peak = 'Morning (06:00–12:00)';
    else if (afternoon >= morning && afternoon >= evening) peak = 'Afternoon (12:00–18:00)';

    return {
      peakStudyWindow: sessions.length ? peak : 'No sessions logged yet',
      averageSessionMinutes: avgMin,
      consistencyScore: Math.min(100, Math.round((new Set(sessions.map((s) => s.date)).size / 30) * 100)),
      overdueTopicsCount: overdueCount,
      suggestedAction:
        overdueCount > 0
          ? `Review ${overdueCount} overdue roadmap lesson${overdueCount > 1 ? 's' : ''} and adjust deadlines.`
          : 'Maintain daily speaking drills to keep your fluency momentum.',
    };
  }
}
