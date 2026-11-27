import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CheckSquare,
  Clock,
  Edit3,
  Mic,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Square,
  Trash2,
} from 'lucide-react';
import {
  ALL_ACTIVITIES,
  ALL_LEVELS,
  ALL_SKILLS,
  computeElapsedMs,
  requestTimerNotificationPermission,
} from '../services/timerBridge';
import {
  deleteSpeakingAudioNote,
  listSpeakingAudioNotes,
  saveSpeakingAudioNote,
} from '../storage/offlineDb';
import type {
  ActiveTimerState,
  CEFRLevel,
  PhraseEntry,
  QuestionEntry,
  RoadmapTopic,
  SkillType,
  TimerActivity,
} from '../types/foco';
import { formatHMS } from '../utils/analytics';
import { isSrsDueToday } from '../utils/srs';

interface StudyTimerViewProps {
  timer: ActiveTimerState;
  topics: RoadmapTopic[];
  phrases: PhraseEntry[];
  questions: QuestionEntry[];
  notificationsEnabled: boolean;
  onUpdateTimerConfig: (patch: Partial<ActiveTimerState>) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStopAndSave: () => void;
  onDiscard: () => void;
  onEditElapsedSeconds: (seconds: number) => void;
  onToggleNotifications: (enabled: boolean) => void;
}

interface AudioRecordingItem {
  key: string;
  label: string;
  mimeType: string;
  blob: Blob;
  createdAt: number;
}

export const StudyTimerView: React.FC<StudyTimerViewProps> = ({
  timer,
  topics,
  phrases,
  questions,
  notificationsEnabled,
  onUpdateTimerConfig,
  onStart,
  onPause,
  onResume,
  onStopAndSave,
  onDiscard,
  onEditElapsedSeconds,
  onToggleNotifications,
}) => {
  const [nowMs, setNowMs] = useState(Date.now());
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editHours, setEditHours] = useState(0);
  const [editMinutes, setEditMinutes] = useState(0);
  const [editSeconds, setEditSeconds] = useState(0);

  // Output Challenge: Speak Saved Chunks
  const [challengeSeed, setChallengeSeed] = useState(0);
  const [usedChunkIds, setUsedChunkIds] = useState<Record<string, boolean>>({});

  // Offline Speaking Voice Self-Check Recorder
  const [isRecording, setIsRecording] = useState(false);
  const [recorderError, setRecorderError] = useState<string | null>(null);
  const [audioNotes, setAudioNotes] = useState<AudioRecordingItem[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (timer.status !== 'running') return;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timer.status]);

  useEffect(() => {
    listSpeakingAudioNotes().then(setAudioNotes);
  }, []);

  const elapsedSeconds = Math.floor(computeElapsedMs(timer, nowMs) / 1000);
  const isLessonMode = timer.studyMode === 'lesson';
  const selectedTopic = useMemo(
    () => (isLessonMode ? topics.find((t) => t.id === timer.topicId) ?? topics[0] : undefined),
    [isLessonMode, topics, timer.topicId]
  );

  const outputChallenge = useMemo(() => {
    const prioritizedPhrases = [...phrases].sort((a, b) => {
      const scoreA = (isSrsDueToday(a) ? 2 : 0) + (a.isFavourite ? 1 : 0);
      const scoreB = (isSrsDueToday(b) ? 2 : 0) + (b.isFavourite ? 1 : 0);
      return scoreB - scoreA;
    });
    const phraseOffset =
      prioritizedPhrases.length > 0 ? (challengeSeed * 3) % prioritizedPhrases.length : 0;
    const pickedPhrases: PhraseEntry[] = [];
    for (let i = 0; i < Math.min(3, prioritizedPhrases.length); i++) {
      pickedPhrases.push(prioritizedPhrases[(phraseOffset + i) % prioritizedPhrases.length]);
    }

    const prioritizedQuestions = [...questions].sort(
      (a, b) => Number(isSrsDueToday(b)) - Number(isSrsDueToday(a)) || a.practicedCount - b.practicedCount
    );
    const pickedQuestion =
      prioritizedQuestions.length > 0
        ? prioritizedQuestions[challengeSeed % prioritizedQuestions.length]
        : null;

    return { phrases: pickedPhrases, question: pickedQuestion };
  }, [phrases, questions, challengeSeed]);

  const openEditTimeModal = () => {
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);
    const s = elapsedSeconds % 60;
    setEditHours(h);
    setEditMinutes(m);
    setEditSeconds(s);
    setEditModalOpen(true);
  };

  const applyEditedTime = (e: React.FormEvent) => {
    e.preventDefault();
    const total = Math.max(0, editHours * 3600 + editMinutes * 60 + editSeconds);
    onEditElapsedSeconds(total);
    setEditModalOpen(false);
  };

  const startVoiceRecording = async () => {
    setRecorderError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecorderError('Microphone recording is not supported in this browser context.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const label = isLessonMode && timer.topicTitle
          ? `${timer.level} · ${timer.topicTitle}`
          : `${timer.level} · ${timer.skill ?? timer.activity} (Skill)`;
        await saveSpeakingAudioNote(label, blob);
        const updated = await listSpeakingAudioNotes();
        setAudioNotes(updated);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecording(true);
    } catch {
      setRecorderError('Microphone permission denied or unavailable.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleEnableNotifications = async () => {
    const granted = await requestTimerNotificationPermission();
    onToggleNotifications(granted);
  };

  const displayActivity =
    timer.activity === 'Custom Activities' && timer.customActivityName
      ? timer.customActivityName
      : timer.activity;

  const switchStudyMode = (mode: 'skill' | 'lesson') => {
    if (mode === timer.studyMode) return;
    if (mode === 'skill') {
      onUpdateTimerConfig({
        studyMode: 'skill',
        topicId: '',
        topicTitle: '',
        skill: timer.skill ?? 'Speaking',
      });
    } else {
      const firstMatch = topics.find((t) => t.level === timer.level) ?? topics[0];
      onUpdateTimerConfig({
        studyMode: 'lesson',
        topicId: firstMatch?.id ?? '',
        topicTitle: firstMatch?.title ?? '',
        level: firstMatch?.level ?? timer.level,
        skill: null,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
            Background Study Timer
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Wall-clock persisted stopwatch — keeps counting across minimized, locked, or closed states.
          </p>
        </div>
        <button
          onClick={handleEnableNotifications}
          className={`min-h-[42px] inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
            notificationsEnabled
              ? 'border-teal-600/40 bg-teal-600/10 text-teal-700 dark:text-teal-400'
              : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Bell className="h-4 w-4" />
          {notificationsEnabled ? 'Persistent Alerts Active' : 'Enable Timer Notification'}
        </button>
      </div>

      {/* Main Stopwatch Card */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8">
        <div className="flex flex-col items-center text-center space-y-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-teal-700 dark:text-teal-400">
              {isLessonMode ? 'Lesson Study' : 'Skill Practice'}
            </span>
            <span aria-hidden="true"> · </span>
            <span>{displayActivity}</span>
            {timer.skill && (
              <>
                <span aria-hidden="true"> · </span>
                <span>{timer.skill}</span>
              </>
            )}
            <span aria-hidden="true"> · </span>
            <span>{timer.level}</span>
            {isLessonMode && timer.topicTitle && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="text-slate-800 dark:text-slate-200">{timer.topicTitle}</span>
              </>
            )}
            {isLessonMode && !timer.skill && (
              <>
                <span aria-hidden="true"> · </span>
                <span>No Skill Linked</span>
              </>
            )}
          </div>

          <div className="font-mono text-5xl sm:text-6xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-50">
            {formatHMS(elapsedSeconds)}
          </div>

          {/* Primary Controls (48px+ touch hitboxes) */}
          <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md">
            {timer.status === 'idle' && (
              <button
                onClick={onStart}
                className="flex-1 min-w-[160px] min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] px-6 text-base font-semibold text-white transition"
              >
                <Play className="h-5 w-5" />
                Start Session
              </button>
            )}

            {timer.status === 'running' && (
              <button
                onClick={onPause}
                className="flex-1 min-w-[140px] min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] px-5 text-base font-semibold text-white transition"
              >
                <Pause className="h-5 w-5" />
                Pause
              </button>
            )}

            {timer.status === 'paused' && (
              <button
                onClick={onResume}
                className="flex-1 min-w-[140px] min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-[0.98] px-5 text-base font-semibold text-white transition"
              >
                <Play className="h-5 w-5" />
                Resume
              </button>
            )}

            {timer.status !== 'idle' && (
              <>
                <button
                  onClick={onStopAndSave}
                  className="flex-1 min-w-[140px] min-h-[52px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 active:scale-[0.98] px-5 text-base font-semibold transition"
                >
                  <Save className="h-5 w-5" />
                  Stop & Save
                </button>
                <button
                  onClick={openEditTimeModal}
                  className="min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-4 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit Time
                </button>
                <button
                  onClick={onDiscard}
                  title="Reset / Discard"
                  className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-red-600 hover:border-red-300"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Study Mode Separation + Configuration Fields */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                What are you timing right now?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isLessonMode
                  ? 'Lesson Study logs time to a Roadmap Lesson. Linking a Skill is optional.'
                  : 'Skill Practice logs pure skill time independently — no Roadmap Lesson is attached.'}
              </p>
            </div>
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => switchStudyMode('skill')}
                className={`min-h-[38px] px-4 rounded-lg text-xs font-semibold transition ${
                  !isLessonMode
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Skill Practice
              </button>
              <button
                type="button"
                onClick={() => switchStudyMode('lesson')}
                className={`min-h-[38px] px-4 rounded-lg text-xs font-semibold transition ${
                  isLessonMode
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Lesson Study
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {isLessonMode ? (
              <>
                <label className="block sm:col-span-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Roadmap Lesson
                  </span>
                  <select
                    value={timer.topicId || selectedTopic?.id || ''}
                    onChange={(e) => {
                      const found = topics.find((t) => t.id === e.target.value);
                      if (found) {
                        onUpdateTimerConfig({
                          topicId: found.id,
                          topicTitle: found.title,
                          level: found.level,
                        });
                      }
                    }}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                  >
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.level}] {t.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Link to Skill (Optional)
                  </span>
                  <select
                    value={timer.skill ?? ''}
                    onChange={(e) =>
                      onUpdateTimerConfig({
                        skill: e.target.value ? (e.target.value as SkillType) : null,
                      })
                    }
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">None (Lesson Only)</option>
                    {ALL_SKILLS.map((sk) => (
                      <option key={sk} value={sk}>
                        {sk}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Study Activity
                  </span>
                  <select
                    value={timer.activity}
                    onChange={(e) => onUpdateTimerConfig({ activity: e.target.value as TimerActivity })}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                  >
                    {ALL_ACTIVITIES.map((act) => (
                      <option key={act} value={act}>
                        {act}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Practiced Skill
                  </span>
                  <select
                    value={timer.skill ?? 'Speaking'}
                    onChange={(e) => onUpdateTimerConfig({ skill: e.target.value as SkillType })}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                  >
                    {ALL_SKILLS.map((sk) => (
                      <option key={sk} value={sk}>
                        {sk}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block sm:col-span-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Study Activity (16 Modes)
                  </span>
                  <select
                    value={timer.activity}
                    onChange={(e) => onUpdateTimerConfig({ activity: e.target.value as TimerActivity })}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                  >
                    {ALL_ACTIVITIES.map((act) => (
                      <option key={act} value={act}>
                        {act}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    CEFR Level
                  </span>
                  <select
                    value={timer.level}
                    onChange={(e) => onUpdateTimerConfig({ level: e.target.value as CEFRLevel })}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                  >
                    {ALL_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {timer.activity === 'Custom Activities' && (
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Custom Activity Name
                </span>
                <input
                  type="text"
                  value={timer.customActivityName}
                  onChange={(e) => onUpdateTimerConfig({ customActivityName: e.target.value })}
                  placeholder="e.g., Anki Spoken Sentence Mining"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                />
              </label>
            )}

            <label className="block sm:col-span-2 lg:col-span-4">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Session Study Notes
              </span>
              <input
                type="text"
                value={timer.notes}
                onChange={(e) => onUpdateTimerConfig({ notes: e.target.value })}
                placeholder={
                  isLessonMode
                    ? 'What did you consolidate in this lesson?'
                    : 'What did you practice in this skill session?'
                }
                className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
              />
            </label>
          </div>
        </div>
      </section>

      {/* Two-Column Companion: Active Speaking Drill + Offline Voice Self-Check + Android Notification Mirror */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Speaking Drill & Offline Audio Recorder */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Speaking Drill & Offline Self-Check
              </h2>
            </div>
            {!isRecording ? (
              <button
                onClick={startVoiceRecording}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 px-3.5 py-2 text-xs font-semibold text-white"
              >
                <Mic className="h-3.5 w-3.5" />
                Record Voice
              </button>
            ) : (
              <button
                onClick={stopVoiceRecording}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 px-3.5 py-2 text-xs font-semibold text-white"
              >
                <Square className="h-3.5 w-3.5" />
                Stop Recording
              </button>
            )}
          </div>

          {selectedTopic ? (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-3.5 space-y-1.5">
              <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                Lesson Prompt · {selectedTopic.title}
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {selectedTopic.speakingFocusPrompt}
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-3.5 space-y-1.5">
              <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                Independent Skill Practice · {timer.skill ?? 'Speaking'} ({timer.level})
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Record a 60–90 second voice self-check to test fluency and pronunciation for this skill session.
              </p>
            </div>
          )}

          {recorderError && <p className="text-xs text-red-600 dark:text-red-400">{recorderError}</p>}

          {/* Pushed Output Challenge: Speak Saved Chunks */}
          {(outputChallenge.phrases.length > 0 || outputChallenge.question) && (
            <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                  Output Challenge · Speak Saved Chunks Aloud
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setChallengeSeed((s) => s + 1);
                    setUsedChunkIds({});
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400"
                >
                  <RefreshCw className="h-3 w-3" />
                  New Set
                </button>
              </div>
              {outputChallenge.question && (
                <p className="text-xs text-slate-700 dark:text-slate-200 font-medium">
                  Prompt: “{outputChallenge.question.question}”
                </p>
              )}
              {outputChallenge.phrases.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Tap each chunk as you use it naturally while speaking:
                  </p>
                  {outputChallenge.phrases.map((ph) => {
                    const checked = !!usedChunkIds[ph.id];
                    return (
                      <button
                        key={ph.id}
                        type="button"
                        onClick={() =>
                          setUsedChunkIds((prev) => ({ ...prev, [ph.id]: !prev[ph.id] }))
                        }
                        className={`w-full text-left rounded-lg border px-3 py-2 text-xs flex items-center gap-2 transition ${
                          checked
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 line-through'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <CheckSquare
                          className={`h-3.5 w-3.5 shrink-0 ${
                            checked ? 'text-emerald-500' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate font-medium">“{ph.englishSentence}”</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Saved Offline Voice Checks ({audioNotes.length})
            </p>
            {audioNotes.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Record yourself speaking aloud to audit fluency, rhythm, and pronunciation 100% offline.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {audioNotes.map((rec) => (
                  <AudioPlaybackRow
                    key={rec.key}
                    rec={rec}
                    onDelete={async () => {
                      await deleteSpeakingAudioNote(rec.key);
                      setAudioNotes((prev) => prev.filter((x) => x.key !== rec.key));
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Android Persistent Notification & Status Bar Preview */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Android Foreground Service & Status Bar
            </h2>
          </div>

          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            In the native Android APK, <code className="font-mono">StudyTimerService.kt</code> runs as an ongoing Foreground Service. Below is the live notification state mirrored from your active session:
          </p>

          {/* Simulated Android Shade Notification */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                🎓 FOCOENGLISH
              </span>
              <span className="font-mono tabular-nums">{formatHMS(elapsedSeconds)}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                🎧 {displayActivity} {timer.level}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {isLessonMode
                  ? `${timer.topicTitle || 'Lesson Study'}${timer.skill ? ` (${timer.skill})` : ' (Lesson Only)'}`
                  : `${timer.skill ?? displayActivity} (Skill Practice)`}{' '}
                · {timer.status === 'running' ? 'Counting in background' : timer.status === 'paused' ? 'Paused' : 'Ready to start'}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={timer.status === 'running' ? onPause : timer.status === 'paused' ? onResume : onStart}
                className="min-h-[36px] px-3 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                {timer.status === 'running' ? 'Pause' : 'Resume'}
              </button>
              {timer.status !== 'idle' && (
                <button
                  onClick={onStopAndSave}
                  className="min-h-[36px] px-3 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Edit Elapsed Time Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={applyEditedTime}
            className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
              Edit Session Elapsed Time
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs text-slate-500">Hours</span>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={editHours}
                  onChange={(e) => setEditHours(Math.max(0, Number(e.target.value)))}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Minutes</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(Math.min(59, Math.max(0, Number(e.target.value))))}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Seconds</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={editSeconds}
                  onChange={(e) => setEditSeconds(Math.min(59, Math.max(0, Number(e.target.value))))}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono text-slate-900 dark:text-slate-100"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="min-h-[42px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[42px] px-4 rounded-xl bg-teal-600 text-xs font-semibold text-white"
              >
                Apply Time
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const AudioPlaybackRow: React.FC<{ rec: AudioRecordingItem; onDelete: () => void }> = ({
  rec,
  onDelete,
}) => {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    const objUrl = URL.createObjectURL(rec.blob);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [rec.blob]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
          {rec.label}
        </span>
        <button
          onClick={onDelete}
          aria-label="Delete recording"
          className="text-slate-400 hover:text-red-500 p-1"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {url && <audio controls src={url} className="w-full h-8" />}
    </div>
  );
};
