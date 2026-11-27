import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Film,
  Layers,
  MessageSquare,
  Plus,
  Repeat,
  Search,
  Square,
  Star,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import {
  isSpeechAvailable,
  loadVoicePrefs,
  playShadowingLoop,
  speakEnglishText,
  stopAllSpeech,
} from '../services/speechVoice';
import { ALL_LEVELS } from '../services/timerBridge';
import type {
  CEFRLevel,
  MediaEntry,
  MediaType,
  PhraseEntry,
  QuestionDifficulty,
  QuestionEntry,
  RoadmapTopic,
  SRSRating,
} from '../types/foco';
import { formatHoursMinutes, getMonthPrefixISO, getTodayISO } from '../utils/analytics';
import {
  computeNextSrsSchedule,
  isSrsDueToday,
  previewNextIntervalLabel,
} from '../utils/srs';

/* ---------------- PHRASE BANK ---------------- */
interface PhraseBankProps {
  phrases: PhraseEntry[];
  topics: RoadmapTopic[];
  onAddPhrase: (p: PhraseEntry) => void;
  onUpdatePhrase: (p: PhraseEntry) => void;
  onToggleFav: (id: string) => void;
  onDeletePhrase: (id: string) => void;
}

export const PhraseBankView: React.FC<PhraseBankProps> = ({
  phrases,
  topics,
  onAddPhrase,
  onUpdatePhrase,
  onToggleFav,
  onDeletePhrase,
}) => {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | CEFRLevel>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [dueOnly, setDueOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Active Recall SRS session
  const [recallOpen, setRecallOpen] = useState(false);
  const [recallRevealed, setRecallRevealed] = useState(false);

  // Shadowing 3x state
  const [shadowId, setShadowId] = useState<string | null>(null);
  const [shadowProgress, setShadowProgress] = useState<string | null>(null);

  const [sentence, setSentence] = useState('');
  const [translation, setTranslation] = useState('');
  const [example, setExample] = useState('');
  const [topicId, setTopicId] = useState(topics[0]?.id ?? '');

  useEffect(() => {
    return () => stopAllSpeech();
  }, []);

  const canSpeak = isSpeechAvailable();

  const duePhrases = useMemo(() => {
    return phrases
      .filter((p) => isSrsDueToday(p))
      .sort((a, b) => Number(b.isFavourite) - Number(a.isFavourite) || a.createdAt - b.createdAt);
  }, [phrases]);

  const activeRecallCard = duePhrases[0] ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return phrases
      .filter((p) => (levelFilter === 'all' ? true : p.level === levelFilter))
      .filter((p) => (favOnly ? p.isFavourite : true))
      .filter((p) => (dueOnly ? isSrsDueToday(p) : true))
      .filter((p) => {
        if (!q) return true;
        return (
          p.englishSentence.toLowerCase().includes(q) ||
          p.translation.toLowerCase().includes(q) ||
          p.exampleUsage.toLowerCase().includes(q) ||
          p.topicTitle.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [phrases, search, levelFilter, favOnly, dueOnly]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentence.trim()) return;
    const topic = topics.find((t) => t.id === topicId) ?? topics[0];
    onAddPhrase({
      id: `phr-${Date.now()}`,
      englishSentence: sentence.trim(),
      translation: translation.trim(),
      exampleUsage: example.trim(),
      topicId: topic?.id ?? 'custom',
      topicTitle: topic?.title ?? 'General English',
      level: topic?.level ?? 'A1',
      isFavourite: false,
      createdAt: Date.now(),
    });
    setSentence('');
    setTranslation('');
    setExample('');
    setModalOpen(false);
  };

  const handleShadowToggle = (id: string, text: string) => {
    if (shadowId === id) {
      stopAllSpeech();
      setShadowId(null);
      setShadowProgress(null);
      return;
    }
    const prefs = loadVoicePrefs();
    setShadowId(id);
    playShadowingLoop(text, {
      repeats: 3,
      preferredVoiceURI: prefs.preferredVoiceURI,
      rate: prefs.rate,
      onIterationChange: (iter, total) => setShadowProgress(iter ? `${iter}/${total}` : null),
      onComplete: () => {
        setShadowId(null);
        setShadowProgress(null);
      },
    });
  };

  const handleRatePhrase = (p: PhraseEntry, rating: SRSRating) => {
    stopAllSpeech();
    setShadowId(null);
    setShadowProgress(null);
    onUpdatePhrase({
      ...p,
      ...computeNextSrsSchedule(p, rating),
    });
    setRecallRevealed(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
            Phrase Bank
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Spaced repetition (SM-2) chunk vault: recall spoken English from memory and shadow 3× until automatic.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setRecallOpen((v) => !v);
              setRecallRevealed(false);
            }}
            className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition ${
              recallOpen
                ? 'border-teal-600 bg-teal-600/10 text-teal-700 dark:text-teal-400'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span className="font-mono tabular-nums">
              {recallOpen ? 'Close Recall' : `Active Recall (${duePhrases.length} due)`}
            </span>
          </button>

          <button
            onClick={() => setModalOpen(true)}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Add Phrase
          </button>
        </div>
      </div>

      {/* SM-2 Active Recall Session Card */}
      {recallOpen && (
        <section className="rounded-2xl border border-teal-500/30 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 font-mono tabular-nums">
              ACTIVE RECALL QUEUE · {duePhrases.length} REMAINING TODAY
            </p>
            <button
              onClick={() => setRecallOpen(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Exit
            </button>
          </div>

          {!activeRecallCard ? (
            <div className="py-6 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                All due phrases reviewed for today!
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your chunks are scheduled via SM-2 spaced repetition so they come back right before you forget them.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                    {activeRecallCard.level}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span>{activeRecallCard.topicTitle}</span>
                </p>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Speak this English chunk aloud from memory:
                </p>
                <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {activeRecallCard.translation || activeRecallCard.exampleUsage || activeRecallCard.topicTitle}
                </p>
                {activeRecallCard.translation && activeRecallCard.exampleUsage && !recallRevealed && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                    Context: {activeRecallCard.exampleUsage}
                  </p>
                )}
              </div>

              {!recallRevealed ? (
                <button
                  onClick={() => {
                    setRecallRevealed(true);
                    if (canSpeak) {
                      speakEnglishText(activeRecallCard.englishSentence);
                    }
                  }}
                  className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-sm font-semibold text-white"
                >
                  <Eye className="h-4 w-4" />
                  Reveal & Listen
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-4 space-y-2">
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-50">
                      “{activeRecallCard.englishSentence}”
                    </p>
                    {activeRecallCard.exampleUsage && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                        Example: {activeRecallCard.exampleUsage}
                      </p>
                    )}
                    {canSpeak && (
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <button
                          onClick={() => speakEnglishText(activeRecallCard.englishSentence)}
                          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                        >
                          <Volume2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                          Listen
                        </button>
                        <button
                          onClick={() =>
                            handleShadowToggle(
                              `recall-${activeRecallCard.id}`,
                              activeRecallCard.englishSentence
                            )
                          }
                          className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold ${
                            shadowId === `recall-${activeRecallCard.id}`
                              ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {shadowId === `recall-${activeRecallCard.id}` ? (
                            <>
                              <Square className="h-3.5 w-3.5" />
                              Stop Shadow ({shadowProgress ?? '...'})
                            </>
                          ) : (
                            <>
                              <Repeat className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                              Shadow 3×
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      How effortlessly did you recall & speak it?
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(
                        [
                          { rating: 'again', label: 'Forgot', tone: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400' },
                          { rating: 'hard', label: 'Hesitated', tone: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
                          { rating: 'good', label: 'Natural', tone: 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-400' },
                          { rating: 'easy', label: 'Instant', tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
                        ] as const
                      ).map((btn) => (
                        <button
                          key={btn.rating}
                          onClick={() => handleRatePhrase(activeRecallCard, btn.rating)}
                          className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold flex flex-col items-center justify-center transition hover:opacity-90 ${btn.tone}`}
                        >
                          <span>{btn.label}</span>
                          <span className="font-mono text-[11px] opacity-80">
                            {previewNextIntervalLabel(activeRecallCard, btn.rating)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search English sentence, translation, or topic..."
            className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as 'all' | CEFRLevel)}
            className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            <option value="all">All Levels</option>
            {ALL_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <button
            onClick={() => setDueOnly(!dueOnly)}
            className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition ${
              dueOnly
                ? 'border-teal-600 bg-teal-600/10 text-teal-700 dark:text-teal-400'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Layers className="h-4 w-4" />
            Due ({duePhrases.length})
          </button>
          <button
            onClick={() => setFavOnly(!favOnly)}
            className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition ${
              favOnly
                ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Star className={`h-4 w-4 ${favOnly ? 'fill-amber-500' : ''}`} />
            Favourites
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No phrases match your filters.
          </div>
        ) : (
          filtered.map((p) => {
            const isShadowing = shadowId === p.id;
            const due = isSrsDueToday(p);

            return (
              <div key={p.id} className="p-4 sm:p-5 flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                      {p.level}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span>{p.topicTitle}</span>
                    <span aria-hidden="true"> · </span>
                    <span
                      className={`font-mono ${
                        due ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
                      }`}
                    >
                      {due ? 'Due today' : `Next ${p.srsNextReviewDate}`}
                    </span>
                  </p>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-50">
                    “{p.englishSentence}”
                  </p>
                  {p.translation && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">{p.translation}</p>
                  )}
                  {p.exampleUsage && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                      Example: {p.exampleUsage}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {canSpeak && (
                    <>
                      <button
                        onClick={() => speakEnglishText(p.englishSentence)}
                        aria-label="Listen to phrase"
                        title="Listen in English"
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleShadowToggle(p.id, p.englishSentence)}
                        aria-label="Shadow phrase 3 times"
                        title="Shadow 3× with mimicry pauses"
                        className={`min-h-[40px] px-2.5 flex items-center justify-center gap-1 rounded-lg text-xs font-semibold transition ${
                          isShadowing
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isShadowing ? (
                          <>
                            <Square className="h-3.5 w-3.5" />
                            <span className="font-mono">{shadowProgress ?? '...'}</span>
                          </>
                        ) : (
                          <>
                            <Repeat className="h-3.5 w-3.5" />
                            <span>3×</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => onToggleFav(p.id)}
                    aria-label="Toggle favourite"
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Star
                      className={`h-4 w-4 ${
                        p.isFavourite ? 'fill-amber-500 text-amber-500' : 'text-slate-400'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => onDeletePhrase(p.id)}
                    aria-label="Delete phrase"
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 pb-safe space-y-4">
            <div className="sm:hidden w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-2" />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                Save New English Phrase
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-2 text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3.5 text-sm">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">English Sentence</span>
                <input
                  required
                  value={sentence}
                  onChange={(e) => setSentence(e.target.value)}
                  placeholder="e.g., I'm running a bit behind schedule."
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Translation</span>
                <input
                  value={translation}
                  onChange={(e) => setTranslation(e.target.value)}
                  placeholder="Meaning in your native language"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Example Usage</span>
                <input
                  value={example}
                  onChange={(e) => setExample(e.target.value)}
                  placeholder="Real context where you would speak this"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Topic</span>
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.level}] {t.title}
                    </option>
                  ))}
                </select>
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
                  Save Phrase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------- QUESTION BANK ---------------- */
interface QuestionBankProps {
  questions: QuestionEntry[];
  topics: RoadmapTopic[];
  onAddQuestion: (q: QuestionEntry) => void;
  onUpdateQuestion: (q: QuestionEntry) => void;
  onMarkPracticed: (id: string) => void;
  onDeleteQuestion: (id: string) => void;
}

export const QuestionBankView: React.FC<QuestionBankProps> = ({
  questions,
  topics,
  onAddQuestion,
  onUpdateQuestion,
  onMarkPracticed,
  onDeleteQuestion,
}) => {
  const [levelFilter, setLevelFilter] = useState<'all' | CEFRLevel>('all');
  const [diffFilter, setDiffFilter] = useState<'all' | QuestionDifficulty>('all');
  const [dueOnly, setDueOnly] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);

  // Active Recall Speaking Session
  const [recallOpen, setRecallOpen] = useState(false);
  const [recallRevealed, setRecallRevealed] = useState(false);
  const [shadowId, setShadowId] = useState<string | null>(null);
  const [shadowProgress, setShadowProgress] = useState<string | null>(null);

  const [questionText, setQuestionText] = useState('');
  const [suggestedAnswer, setSuggestedAnswer] = useState('');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('Medium');
  const [topicId, setTopicId] = useState(topics[0]?.id ?? '');

  useEffect(() => {
    return () => stopAllSpeech();
  }, []);

  const canSpeak = isSpeechAvailable();

  const dueQuestions = useMemo(() => {
    return questions
      .filter((q) => isSrsDueToday(q))
      .sort((a, b) => a.practicedCount - b.practicedCount || a.createdAt - b.createdAt);
  }, [questions]);

  const activeRecallQuestion = dueQuestions[0] ?? null;

  const filtered = useMemo(() => {
    return questions
      .filter((q) => (levelFilter === 'all' ? true : q.level === levelFilter))
      .filter((q) => (diffFilter === 'all' ? true : q.difficulty === diffFilter))
      .filter((q) => (dueOnly ? isSrsDueToday(q) : true))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [questions, levelFilter, diffFilter, dueOnly]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;
    const topic = topics.find((t) => t.id === topicId) ?? topics[0];
    onAddQuestion({
      id: `q-${Date.now()}`,
      question: questionText.trim(),
      suggestedAnswer: suggestedAnswer.trim(),
      topicId: topic?.id ?? 'custom',
      topicTitle: topic?.title ?? 'General Speaking',
      difficulty,
      level: topic?.level ?? 'A1',
      practicedCount: 0,
      createdAt: Date.now(),
    });
    setQuestionText('');
    setSuggestedAnswer('');
    setModalOpen(false);
  };

  const handleShadowToggle = (id: string, text: string) => {
    if (shadowId === id) {
      stopAllSpeech();
      setShadowId(null);
      setShadowProgress(null);
      return;
    }
    const prefs = loadVoicePrefs();
    setShadowId(id);
    playShadowingLoop(text, {
      repeats: 3,
      preferredVoiceURI: prefs.preferredVoiceURI,
      rate: prefs.rate,
      onIterationChange: (iter, total) => setShadowProgress(iter ? `${iter}/${total}` : null),
      onComplete: () => {
        setShadowId(null);
        setShadowProgress(null);
      },
    });
  };

  const handleRateQuestion = (q: QuestionEntry, rating: SRSRating) => {
    stopAllSpeech();
    setShadowId(null);
    setShadowProgress(null);
    onUpdateQuestion({
      ...q,
      practicedCount: q.practicedCount + 1,
      lastPracticedAt: Date.now(),
      ...computeNextSrsSchedule(q, rating),
    });
    setRecallRevealed(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
            Speaking Question Bank
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Spaced speaking prompts: answer aloud before revealing the model answer, then shadow 3× for fluency.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setRecallOpen((v) => !v);
              setRecallRevealed(false);
            }}
            className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition ${
              recallOpen
                ? 'border-teal-600 bg-teal-600/10 text-teal-700 dark:text-teal-400'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span className="font-mono tabular-nums">
              {recallOpen ? 'Close Session' : `Active Recall (${dueQuestions.length} due)`}
            </span>
          </button>

          <button
            onClick={() => setModalOpen(true)}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Add Question
          </button>
        </div>
      </div>

      {/* Active Recall Question Session */}
      {recallOpen && (
        <section className="rounded-2xl border border-teal-500/30 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 font-mono tabular-nums">
              SPOKEN RECALL SESSION · {dueQuestions.length} DUE TODAY
            </p>
            <button
              onClick={() => setRecallOpen(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Exit
            </button>
          </div>

          {!activeRecallQuestion ? (
            <div className="py-6 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                All speaking prompts due today are complete!
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Spaced repetition will surface each question again right on schedule.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                    {activeRecallQuestion.level}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span>{activeRecallQuestion.difficulty}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{activeRecallQuestion.topicTitle}</span>
                </p>
                <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {activeRecallQuestion.question}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Speak a 30–60 second response aloud first, then compare with the model answer.
                </p>
                {canSpeak && (
                  <button
                    onClick={() => speakEnglishText(activeRecallQuestion.question)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    Listen Question
                  </button>
                )}
              </div>

              {!recallRevealed ? (
                <button
                  onClick={() => setRecallRevealed(true)}
                  className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-sm font-semibold text-white"
                >
                  <Eye className="h-4 w-4" />
                  I Answered Aloud · Show Model Answer
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-4 space-y-2.5">
                    <p className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                      Model Spoken Answer
                    </p>
                    <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                      {activeRecallQuestion.suggestedAnswer ||
                        'No reference script saved — evaluate your fluency and clarity.'}
                    </p>
                    {canSpeak && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          onClick={() =>
                            speakEnglishText(
                              activeRecallQuestion.suggestedAnswer || activeRecallQuestion.question
                            )
                          }
                          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
                        >
                          <Volume2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                          Listen Answer
                        </button>
                        <button
                          onClick={() =>
                            handleShadowToggle(
                              `q-recall-${activeRecallQuestion.id}`,
                              activeRecallQuestion.suggestedAnswer || activeRecallQuestion.question
                            )
                          }
                          className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold ${
                            shadowId === `q-recall-${activeRecallQuestion.id}`
                              ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {shadowId === `q-recall-${activeRecallQuestion.id}` ? (
                            <>
                              <Square className="h-3.5 w-3.5" />
                              Stop Shadow ({shadowProgress ?? '...'})
                            </>
                          ) : (
                            <>
                              <Repeat className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                              Shadow 3×
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      How smoothly did you answer aloud?
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(
                        [
                          { rating: 'again', label: 'Stuck', tone: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400' },
                          { rating: 'hard', label: 'Hesitated', tone: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
                          { rating: 'good', label: 'Natural', tone: 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-400' },
                          { rating: 'easy', label: 'Fluent', tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
                        ] as const
                      ).map((btn) => (
                        <button
                          key={btn.rating}
                          onClick={() => handleRateQuestion(activeRecallQuestion, btn.rating)}
                          className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold flex flex-col items-center justify-center transition hover:opacity-90 ${btn.tone}`}
                        >
                          <span>{btn.label}</span>
                          <span className="font-mono text-[11px] opacity-80">
                            {previewNextIntervalLabel(activeRecallQuestion, btn.rating)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as 'all' | CEFRLevel)}
          className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200"
        >
          <option value="all">All Levels</option>
          {ALL_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 overflow-x-auto no-scrollbar max-w-full">
          {(['all', 'Easy', 'Medium', 'Hard'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDiffFilter(d)}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                diffFilter === d
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {d === 'all' ? 'All Difficulties' : d}
            </button>
          ))}
        </div>

        <button
          onClick={() => setDueOnly(!dueOnly)}
          className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition ${
            dueOnly
              ? 'border-teal-600 bg-teal-600/10 text-teal-700 dark:text-teal-400'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Layers className="h-4 w-4" />
          Due ({dueQuestions.length})
        </button>
      </div>

      <div className="space-y-3">
        {filtered.map((q) => {
          const revealed = !!revealedIds[q.id];
          const isShadowing = shadowId === q.id;
          const due = isSrsDueToday(q);

          return (
            <div
              key={q.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                      {q.level}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span>{q.difficulty}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{q.topicTitle}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-mono tabular-nums">
                      Spoken {q.practicedCount}×
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span
                      className={`font-mono ${
                        due ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
                      }`}
                    >
                      {due ? 'Due today' : `Next ${q.srsNextReviewDate}`}
                    </span>
                  </p>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 mt-1 shrink-0 text-teal-600 dark:text-teal-400" />
                    <span>{q.question}</span>
                  </h3>
                </div>
                <button
                  onClick={() => onDeleteQuestion(q.id)}
                  aria-label="Delete question"
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {revealed && q.suggestedAnswer && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-3.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {q.suggestedAnswer}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {canSpeak && (
                  <>
                    <button
                      onClick={() =>
                        speakEnglishText(
                          revealed && q.suggestedAnswer
                            ? `${q.question}. ${q.suggestedAnswer}`
                            : q.question
                        )
                      }
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Volume2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                      {revealed ? 'Listen Q&A' : 'Listen Question'}
                    </button>
                    <button
                      onClick={() =>
                        handleShadowToggle(q.id, q.suggestedAnswer || q.question)
                      }
                      className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition ${
                        isShadowing
                          ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isShadowing ? (
                        <>
                          <Square className="h-3.5 w-3.5" />
                          Stop Shadow ({shadowProgress ?? '...'})
                        </>
                      ) : (
                        <>
                          <Repeat className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                          Shadow 3×
                        </>
                      )}
                    </button>
                  </>
                )}
                <button
                  onClick={() =>
                    setRevealedIds((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                  }
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {revealed ? 'Hide Suggested Answer' : 'Show Suggested Answer'}
                </button>
                <button
                  onClick={() => onMarkPracticed(q.id)}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-teal-600/10 hover:bg-teal-600/20 px-3.5 text-xs font-semibold text-teal-700 dark:text-teal-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark Spoken Aloud
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 pb-safe space-y-4">
            <div className="sm:hidden w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-2" />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                Add Speaking Question
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-2 text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3.5 text-sm">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Question</span>
                <textarea
                  required
                  rows={2}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="e.g., How do you handle tight deadlines at work?"
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Suggested Answer</span>
                <textarea
                  rows={3}
                  value={suggestedAnswer}
                  onChange={(e) => setSuggestedAnswer(e.target.value)}
                  placeholder="Write a natural spoken reference answer..."
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Topic</span>
                  <select
                    value={topicId}
                    onChange={(e) => setTopicId(e.target.value)}
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
                  <span className="text-xs font-medium text-slate-500">Difficulty</span>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </label>
              </div>
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
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------- MOVIES & SERIES TRACKER ---------------- */
interface MoviesSeriesProps {
  media: MediaEntry[];
  onAddMedia: (m: MediaEntry) => void;
  onDeleteMedia: (id: string) => void;
}

export const MoviesSeriesView: React.FC<MoviesSeriesProps> = ({
  media,
  onAddMedia,
  onDeleteMedia,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [type, setType] = useState<MediaType>('Series');
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [platform, setPlatform] = useState('Netflix');
  const [audioLang, setAudioLang] = useState('English');
  const [subLang, setSubLang] = useState('English');
  const [date, setDate] = useState(getTodayISO());
  const [score, setScore] = useState(7);
  const [newWords, setNewWords] = useState('');
  const [notes, setNotes] = useState('');

  const monthPrefix = getMonthPrefixISO();
  const totalSec = media.reduce((acc, m) => acc + m.durationMinutes * 60, 0);
  const monthSec = media
    .filter((m) => m.date.startsWith(monthPrefix))
    .reduce((acc, m) => acc + m.durationMinutes * 60, 0);
  const avgScore =
    media.length > 0
      ? (media.reduce((acc, m) => acc + m.understandingScore, 0) / media.length).toFixed(1)
      : '0.0';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAddMedia({
      id: `med-${Date.now()}`,
      type,
      title: title.trim(),
      durationMinutes: Math.max(1, Number(durationMinutes) || 30),
      platform: platform.trim() || 'Offline',
      audioLanguage: audioLang.trim() || 'English',
      subtitleLanguage: subLang.trim() || 'None',
      date,
      understandingScore: Math.min(10, Math.max(1, Number(score) || 7)),
      newWordsLearned: newWords.trim(),
      notes: notes.trim(),
      createdAt: Date.now(),
    });
    setTitle('');
    setNewWords('');
    setNotes('');
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
            Movies & Series Tracker
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track immersion hours, subtitle choices, comprehension scores, and vocabulary mined.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Log Media
        </button>
      </div>

      {/* Media Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Watched</p>
          <p className="mt-1 font-mono text-lg sm:text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {formatHoursMinutes(totalSec)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">This Month</p>
          <p className="mt-1 font-mono text-lg sm:text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {formatHoursMinutes(monthSec)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Avg Understanding</p>
          <p className="mt-1 font-mono text-lg sm:text-xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
            {avgScore} / 10
          </p>
        </div>
      </div>

      {/* Media List */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
        {media.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No movies, series, cartoons, or documentaries logged yet.
          </div>
        ) : (
          media
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((m) => (
              <div key={m.id} className="p-4 sm:p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
                    <Film className="h-5 w-5" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <span>{m.type}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{m.platform}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono tabular-nums">{m.durationMinutes}m</span>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono">{m.date}</span>
                    </p>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {m.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Audio: {m.audioLanguage} · Subtitles: {m.subtitleLanguage} · Comprehension:{' '}
                      <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                        {m.understandingScore}/10
                      </span>
                    </p>
                    {m.newWordsLearned && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        New words: {m.newWordsLearned}
                      </p>
                    )}
                    {m.notes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic">{m.notes}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onDeleteMedia(m.id)}
                  aria-label="Delete media entry"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 pb-safe space-y-4">
            <div className="sm:hidden w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-2" />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                Log Immersion Media
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-2 text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Category</span>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as MediaType)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3"
                  >
                    <option value="Movie">Movie</option>
                    <option value="Series">Series</option>
                    <option value="Cartoon">Cartoon</option>
                    <option value="Documentary">Documentary</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Title</span>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., The Office S2E4"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3"
                />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Minutes</span>
                  <input
                    type="number"
                    min={1}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Platform</span>
                  <input
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Score (1-10)</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={score}
                    onChange={(e) => setScore(Number(e.target.value))}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Audio Language</span>
                  <input
                    value={audioLang}
                    onChange={(e) => setAudioLang(e.target.value)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Subtitle Language</span>
                  <input
                    value={subLang}
                    onChange={(e) => setSubLang(e.target.value)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">New Words Learned</span>
                <input
                  value={newWords}
                  onChange={(e) => setNewWords(e.target.value)}
                  placeholder="comma-separated expressions"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Notes</span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3"
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
                  Save Media
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
