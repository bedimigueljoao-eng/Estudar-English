export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type SkillType =
  | 'Listening'
  | 'Reading'
  | 'Vocabulary'
  | 'Speaking'
  | 'Writing'
  | 'Grammar'
  | 'Pronunciation'
  | 'Immersion';

export type TimerActivity =
  | 'Listening Active'
  | 'Listening Passive'
  | 'Speaking'
  | 'Reading'
  | 'Writing'
  | 'Grammar'
  | 'Vocabulary'
  | 'Pronunciation'
  | 'Movies'
  | 'Series'
  | 'Podcasts'
  | 'YouTube Learning'
  | 'Conversation Practice'
  | 'Shadowing'
  | 'Immersion'
  | 'Custom Activities';

export type TopicStatus = 'not_started' | 'in_progress' | 'consolidating' | 'mastered';

export interface RoadmapTopic {
  id: string;
  level: CEFRLevel;
  order: number;
  title: string;
  description: string;
  grammarFocus: string;
  keyVocabulary: string[];
  speakingFocusPrompt: string;
  speakingDrills: string[];
  estimatedMinutes: number;
  deadline: string | null; // YYYY-MM-DD
  status: TopicStatus;
  completedDrills: number[]; // indices of completed speaking drills
  isCustom?: boolean;
  notes?: string;
}

export interface StudySession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationSeconds: number;
  activity: TimerActivity;
  customActivityName?: string;
  topicId?: string;
  topicTitle: string;
  skill: SkillType;
  level: CEFRLevel;
  notes: string;
  source: 'timer' | 'manual' | 'v1_import';
  createdAt: number;
}

export interface ActiveTimerState {
  sessionId: string | null;
  status: 'idle' | 'running' | 'paused';
  startedAtMs: number | null; // initial start wall-clock
  lastResumedAtMs: number | null; // current running segment start
  accumulatedMs: number; // total ms accumulated before current running segment
  activity: TimerActivity;
  customActivityName: string;
  topicId: string;
  topicTitle: string;
  skill: SkillType;
  level: CEFRLevel;
  notes: string;
}

export interface StudyGoals {
  dailyMinutes: number;
  weeklyMinutes: number;
  monthlyMinutes: number;
  currentLevel: CEFRLevel;
  targetLevel: CEFRLevel;
  speakingFocusTargetPercent: number;
}

export type ResourceKind = 'website' | 'youtube' | 'pdf';

export interface StudyResource {
  id: string;
  kind: ResourceKind;
  topicId: string;
  topicTitle: string;
  level: CEFRLevel;
  title: string;
  url?: string;
  channelName?: string;
  pdfStorageKey?: string;
  pdfFileName?: string;
  pdfSizeBytes?: number;
  notes: string;
  createdAt: number;
}

export type MediaType = 'Movie' | 'Series' | 'Cartoon' | 'Documentary';

export interface MediaEntry {
  id: string;
  type: MediaType;
  title: string;
  durationMinutes: number;
  platform: string;
  audioLanguage: string;
  subtitleLanguage: string;
  date: string; // YYYY-MM-DD
  understandingScore: number; // 1-10
  newWordsLearned: string;
  notes: string;
  createdAt: number;
}

export interface PhraseEntry {
  id: string;
  englishSentence: string;
  translation: string;
  exampleUsage: string;
  topicId: string;
  topicTitle: string;
  level: CEFRLevel;
  isFavourite: boolean;
  createdAt: number;
}

export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';

export interface QuestionEntry {
  id: string;
  question: string;
  suggestedAnswer: string;
  topicId: string;
  topicTitle: string;
  difficulty: QuestionDifficulty;
  level: CEFRLevel;
  practicedCount: number;
  lastPracticedAt?: number;
  createdAt: number;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: 'hours' | 'streak' | 'level' | 'speaking';
  targetValue: number;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  notificationsEnabled: boolean;
  keepScreenAwakeHint: boolean;
  learnerName: string;
  speakingPriorityMode: boolean;
}

export interface AppState {
  version: number;
  topics: RoadmapTopic[];
  sessions: StudySession[];
  goals: StudyGoals;
  resources: StudyResource[];
  media: MediaEntry[];
  phrases: PhraseEntry[];
  questions: QuestionEntry[];
  settings: AppSettings;
  activeTimer: ActiveTimerState;
  lastUpdatedAt: number;
}

export type AppSection =
  | 'dashboard'
  | 'journey'
  | 'levels'
  | 'timer'
  | 'resources'
  | 'phrases'
  | 'questions'
  | 'movies'
  | 'statistics'
  | 'goals'
  | 'history'
  | 'settings';
