import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Edit3,
  Plus,
  Repeat,
  RotateCcw,
  Search,
  Square,
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
import type { CEFRLevel, MistakeCategory, MistakeEntry } from '../types/foco';
import { computeNextSrsSchedule, isSrsDueToday } from '../utils/srs';

interface MistakesViewProps {
  mistakes: MistakeEntry[];
  onAddMistake: (m: MistakeEntry) => void;
  onUpdateMistake: (m: MistakeEntry) => void;
  onDeleteMistake: (id: string) => void;
}

const CATEGORIES: MistakeCategory[] = [
  'Grammar',
  'Prepositions',
  'Vocabulary',
  'Pronunciation',
  'Natural Phrasing',
];

export const MistakesView: React.FC<MistakesViewProps> = ({
  mistakes,
  onAddMistake,
  onUpdateMistake,
  onDeleteMistake,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'practicing' | 'fixed' | 'due'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | MistakeCategory>('all');
  const [shadowingId, setShadowingId] = useState<string | null>(null);
  const [shadowProgress, setShadowProgress] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MistakeEntry | null>(null);
  const [whatISaid, setWhatISaid] = useState('');
  const [naturalEnglish, setNaturalEnglish] = useState('');
  const [ruleOrTip, setRuleOrTip] = useState('');
  const [category, setCategory] = useState<MistakeCategory>('Natural Phrasing');
  const [level, setLevel] = useState<CEFRLevel>('B1');

  useEffect(() => {
    return () => stopAllSpeech();
  }, []);

  const canSpeak = isSpeechAvailable();

  const stats = useMemo(() => {
    const practicing = mistakes.filter((m) => m.status === 'practicing').length;
    const fixed = mistakes.filter((m) => m.status === 'fixed').length;
    const due = mistakes.filter((m) => m.status === 'practicing' && isSrsDueToday(m)).length;
    return { practicing, fixed, due };
  }, [mistakes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mistakes
      .filter((m) => {
        if (statusFilter === 'practicing') return m.status === 'practicing';
        if (statusFilter === 'fixed') return m.status === 'fixed';
        if (statusFilter === 'due') return m.status === 'practicing' && isSrsDueToday(m);
        return true;
      })
      .filter((m) => (categoryFilter === 'all' ? true : m.category === categoryFilter))
      .filter((m) => {
        if (!q) return true;
        return (
          m.whatISaid.toLowerCase().includes(q) ||
          m.naturalEnglish.toLowerCase().includes(q) ||
          m.ruleOrTip.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [mistakes, search, statusFilter, categoryFilter]);

  const openCreateModal = () => {
    setEditing(null);
    setWhatISaid('');
    setNaturalEnglish('');
    setRuleOrTip('');
    setCategory('Natural Phrasing');
    setLevel('B1');
    setModalOpen(true);
  };

  const openEditModal = (m: MistakeEntry) => {
    setEditing(m);
    setWhatISaid(m.whatISaid);
    setNaturalEnglish(m.naturalEnglish);
    setRuleOrTip(m.ruleOrTip);
    setCategory(m.category);
    setLevel(m.level);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatISaid.trim() || !naturalEnglish.trim()) return;

    if (editing) {
      onUpdateMistake({
        ...editing,
        whatISaid: whatISaid.trim(),
        naturalEnglish: naturalEnglish.trim(),
        ruleOrTip: ruleOrTip.trim(),
        category,
        level,
      });
    } else {
      onAddMistake({
        id: `mst-${Date.now()}`,
        whatISaid: whatISaid.trim(),
        naturalEnglish: naturalEnglish.trim(),
        ruleOrTip: ruleOrTip.trim(),
        category,
        level,
        status: 'practicing',
        practicedCount: 0,
        createdAt: Date.now(),
      });
    }
    setModalOpen(false);
  };

  const handleShadowToggle = (m: MistakeEntry) => {
    if (shadowingId === m.id) {
      stopAllSpeech();
      setShadowingId(null);
      setShadowProgress(null);
      return;
    }

    const prefs = loadVoicePrefs();
    setShadowingId(m.id);
    playShadowingLoop(m.naturalEnglish, {
      repeats: 3,
      preferredVoiceURI: prefs.preferredVoiceURI,
      rate: prefs.rate,
      onIterationChange: (iter, total) => {
        setShadowProgress(iter ? `${iter}/${total}` : null);
      },
      onComplete: () => {
        setShadowingId(null);
        setShadowProgress(null);
        onUpdateMistake({
          ...m,
          practicedCount: m.practicedCount + 1,
          ...computeNextSrsSchedule(m, 'good'),
        });
      },
    });
  };

  const handleToggleFixed = (m: MistakeEntry) => {
    const nextStatus = m.status === 'fixed' ? 'practicing' : 'fixed';
    onUpdateMistake({
      ...m,
      status: nextStatus,
      practicedCount: m.practicedCount + 1,
      ...computeNextSrsSchedule(m, nextStatus === 'fixed' ? 'easy' : 'again'),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
            Error Log & Natural Corrections
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Noticing Hypothesis bank: log recurring speaking mistakes, compare with natural English, and shadow 3× until automatic.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Log Mistake
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Practicing</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {stats.practicing}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Due Today</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-teal-700 dark:text-teal-400">
            {stats.due}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Fixed</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {stats.fixed}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search what you said, correction, or grammar tip..."
            className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 overflow-x-auto no-scrollbar max-w-full">
            {(
              [
                ['all', 'All'],
                ['practicing', 'Practicing'],
                ['due', 'Due Today'],
                ['fixed', 'Fixed'],
              ] as const
            ).map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setStatusFilter(val)}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  statusFilter === val
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | MistakeCategory)}
            className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mistake List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No logged errors match your filters. Add mistakes you catch during speaking or AI chats to rewire them cleanly.
          </div>
        ) : (
          filtered.map((m) => {
            const isShadowing = shadowingId === m.id;
            const isFixed = m.status === 'fixed';
            const due = !isFixed && isSrsDueToday(m);

            return (
              <article
                key={m.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-1.5">
                      <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                        {m.level}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{m.category}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-semibold ${
                          isFixed
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : due
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {isFixed ? 'Fixed' : due ? 'Due for Shadowing' : 'Practicing'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">Shadowed {m.practicedCount}×</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditModal(m)}
                      aria-label="Edit mistake"
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDeleteMistake(m.id)}
                      aria-label="Delete mistake"
                      className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Comparison Block */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 space-y-1">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      What I Said
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 line-through decoration-red-500/50">
                      “{m.whatISaid}”
                    </p>
                  </div>

                  <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-3 space-y-1">
                    <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5" />
                      Natural English
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      “{m.naturalEnglish}”
                    </p>
                  </div>
                </div>

                {m.ruleOrTip && (
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Why: </span>
                    {m.ruleOrTip}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {canSpeak && (
                    <>
                      <button
                        onClick={() => speakEnglishText(m.naturalEnglish)}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Volume2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                        Listen
                      </button>
                      <button
                        onClick={() => handleShadowToggle(m)}
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
                    onClick={() => handleToggleFixed(m)}
                    className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition ${
                      isFixed
                        ? 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        : 'bg-teal-600 hover:bg-teal-700 text-white'
                    }`}
                  >
                    {isFixed ? (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reopen Practice
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark Fixed
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 pb-safe space-y-4">
            <div className="sm:hidden w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-2" />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                {editing ? 'Edit Mistake Note' : 'Log Speaking / Writing Mistake'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-2 text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-sm">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">What I Said (Mistake)</span>
                <input
                  required
                  value={whatISaid}
                  onChange={(e) => setWhatISaid(e.target.value)}
                  placeholder="e.g., I have 25 years old."
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">Natural English</span>
                <input
                  required
                  value={naturalEnglish}
                  onChange={(e) => setNaturalEnglish(e.target.value)}
                  placeholder="e.g., I am 25 years old."
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Category</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MistakeCategory)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-medium text-slate-500">CEFR Level</span>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as CEFRLevel)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                  >
                    {ALL_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">Rule / Memory Tip</span>
                <textarea
                  rows={2}
                  value={ruleOrTip}
                  onChange={(e) => setRuleOrTip(e.target.value)}
                  placeholder="Why does native English say it this way?"
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100"
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
                  {editing ? 'Save Changes' : 'Save Mistake'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
