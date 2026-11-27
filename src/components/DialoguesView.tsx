import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  MessagesSquare,
  Plus,
  Search,
  Square,
  Star,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import {
  getRankedEnglishVoices,
  isSpeechAvailable,
  loadVoicePrefs,
  playDialogueTurns,
  saveVoicePrefs,
  speakEnglishText,
  stopAllSpeech,
} from '../services/speechVoice';
import { ALL_LEVELS } from '../services/timerBridge';
import type { CEFRLevel, DialogueEntry, RoadmapTopic } from '../types/foco';

interface DialoguesViewProps {
  dialogues: DialogueEntry[];
  topics: RoadmapTopic[];
  onAddDialogue: (d: DialogueEntry) => void;
  onUpdateDialogue: (d: DialogueEntry) => void;
  onDeleteDialogue: (id: string) => void;
}

const SOURCE_PRESETS = ['AI Tutor Summary', 'Roleplay', 'Real Conversation', 'Podcast / Video Script'];

const SPEED_OPTIONS = [
  { label: '0.75× Slow', value: 0.75 },
  { label: '0.92× Clear', value: 0.92 },
  { label: '1.0× Natural', value: 1.0 },
  { label: '1.15× Fast', value: 1.15 },
];

function parseTurn(line: string): { speaker: string | null; text: string } {
  const match = line.match(/^([A-Za-zÀ-ÿ0-9 _-]{1,22}):\s*(.+)$/);
  if (!match) return { speaker: null, text: line };
  return { speaker: match[1].trim(), text: match[2].trim() };
}

export const DialoguesView: React.FC<DialoguesViewProps> = ({
  dialogues,
  topics,
  onAddDialogue,
  onUpdateDialogue,
  onDeleteDialogue,
}) => {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | CEFRLevel>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(dialogues[0]?.id ?? null);
  const [hideMyLinesMap, setHideMyLinesMap] = useState<Record<string, boolean>>({});
  const [revealedTurns, setRevealedTurns] = useState<Record<string, boolean>>({});
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [activeTurnIdx, setActiveTurnIdx] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Voice & Speed controls
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voicePrefs, setVoicePrefs] = useState(() => loadVoicePrefs());

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDialogue, setEditingDialogue] = useState<DialogueEntry | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formTopicId, setFormTopicId] = useState(topics[0]?.id ?? '');
  const [formLevel, setFormLevel] = useState<CEFRLevel>('A1');
  const [formSource, setFormSource] = useState('AI Tutor Summary');
  const [formScript, setFormScript] = useState('');
  const [formTakeaways, setFormTakeaways] = useState('');

  useEffect(() => {
    const refreshVoices = () => setVoices(getRankedEnglishVoices());
    refreshVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', refreshVoices);
        stopAllSpeech();
      };
    }
    return () => stopAllSpeech();
  }, []);

  const updateVoicePrefs = (patch: Partial<typeof voicePrefs>) => {
    const next = { ...voicePrefs, ...patch };
    setVoicePrefs(next);
    saveVoicePrefs(next);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dialogues
      .filter((d) => (levelFilter === 'all' ? true : d.level === levelFilter))
      .filter((d) => (favOnly ? d.isFavourite : true))
      .filter((d) => {
        if (!q) return true;
        return (
          d.title.toLowerCase().includes(q) ||
          d.script.toLowerCase().includes(q) ||
          d.takeaways.toLowerCase().includes(q) ||
          d.topicTitle.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [dialogues, search, levelFilter, favOnly]);

  const openCreateModal = () => {
    setEditingDialogue(null);
    setFormTitle('');
    const firstTopic = topics[0];
    setFormTopicId(firstTopic?.id ?? '');
    setFormLevel(firstTopic?.level ?? 'A1');
    setFormSource('AI Tutor Summary');
    setFormScript('AI: \nYou: \nAI: \nYou: ');
    setFormTakeaways('');
    setModalOpen(true);
  };

  const openEditModal = (d: DialogueEntry) => {
    setEditingDialogue(d);
    setFormTitle(d.title);
    setFormTopicId(d.topicId);
    setFormLevel(d.level);
    setFormSource(d.sourceLabel);
    setFormScript(d.script);
    setFormTakeaways(d.takeaways);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formScript.trim()) return;
    const topic = topics.find((t) => t.id === formTopicId);

    if (editingDialogue) {
      onUpdateDialogue({
        ...editingDialogue,
        title: formTitle.trim(),
        level: formLevel,
        topicId: topic?.id ?? editingDialogue.topicId,
        topicTitle: topic?.title ?? editingDialogue.topicTitle,
        sourceLabel: formSource.trim() || 'AI Tutor Summary',
        script: formScript.trim(),
        takeaways: formTakeaways.trim(),
      });
    } else {
      const created: DialogueEntry = {
        id: `dlg-${Date.now()}`,
        title: formTitle.trim(),
        level: formLevel,
        topicId: topic?.id ?? 'custom',
        topicTitle: topic?.title ?? 'General Speaking',
        sourceLabel: formSource.trim() || 'AI Tutor Summary',
        script: formScript.trim(),
        takeaways: formTakeaways.trim(),
        isFavourite: false,
        practicedCount: 0,
        createdAt: Date.now(),
      };
      onAddDialogue(created);
      setExpandedId(created.id);
    }
    setModalOpen(false);
  };

  const handlePlayDialogue = (d: DialogueEntry) => {
    if (speakingId === d.id) {
      stopAllSpeech();
      setSpeakingId(null);
      setActiveTurnIdx(null);
      return;
    }

    const lines = d.script
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const turns = lines.map((line) => {
      const { speaker, text } = parseTurn(line);
      const isSelf =
        speaker !== null &&
        ['you', 'eu', 'me', 'student', 'learner'].includes(speaker.toLowerCase());
      return { text, isSelf };
    });

    setSpeakingId(d.id);
    playDialogueTurns(turns, {
      preferredVoiceURI: voicePrefs.preferredVoiceURI,
      rate: voicePrefs.rate,
      onTurnChange: (idx) => setActiveTurnIdx(idx),
      onComplete: () => {
        setSpeakingId(null);
        setActiveTurnIdx(null);
      },
    });
  };

  const canSpeak = isSpeechAvailable();

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
            Saved Dialogues & AI Conversation Recaps
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Save text dialogues and AI conversation summaries to review corrections, hide your lines, and practice speaking with dual-voice playback.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Save Dialogue
        </button>
      </div>

      {/* Natural English Voice & Pace Bar */}
      {canSpeak && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Volume2 className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <label className="flex items-center gap-2 text-xs min-w-0 flex-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                English Voice:
              </span>
              <select
                value={voicePrefs.preferredVoiceURI || voices[0]?.voiceURI || ''}
                onChange={(e) => updateVoicePrefs({ preferredVoiceURI: e.target.value })}
                className="min-h-[38px] w-full max-w-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs text-slate-900 dark:text-slate-100 truncate"
              >
                {voices.length === 0 ? (
                  <option value="">System English Voice</option>
                ) : (
                  voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-x-auto">
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateVoicePrefs({ rate: opt.value })}
                className={`min-h-[34px] px-2.5 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition ${
                  Math.abs(voicePrefs.rate - opt.value) < 0.02
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved dialogues, AI corrections, or lines..."
            className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex items-center gap-2">
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

      {/* Dialogues List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No saved dialogues match your filter. Paste an AI chat summary or conversation script to practice anytime offline.
          </div>
        ) : (
          filtered.map((d) => {
            const isExpanded = expandedId === d.id;
            const hideMyLines = !!hideMyLinesMap[d.id];
            const isPlayingThis = speakingId === d.id;
            const lines = d.script
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean);

            return (
              <article
                key={d.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : d.id)}
                    className="flex-1 text-left min-w-0 space-y-1"
                  >
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                        {d.level}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>{d.sourceLabel}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{d.topicTitle}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono tabular-nums">
                        Practiced {d.practicedCount}×
                      </span>
                    </p>
                    <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <MessagesSquare className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
                      <span className="truncate">{d.title}</span>
                    </h2>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onUpdateDialogue({ ...d, isFavourite: !d.isFavourite })}
                      aria-label="Toggle favourite"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          d.isFavourite ? 'fill-amber-500 text-amber-500' : 'text-slate-400'
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => openEditModal(d)}
                      aria-label="Edit dialogue"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    {confirmDeleteId === d.id ? (
                      <button
                        onClick={() => {
                          onDeleteDialogue(d.id);
                          setConfirmDeleteId(null);
                        }}
                        className="min-h-[38px] px-3 rounded-lg bg-red-600 text-xs font-semibold text-white"
                      >
                        Delete
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(d.id)}
                        aria-label="Delete dialogue"
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {/* Practice Toolbar */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() =>
                          setHideMyLinesMap((prev) => ({ ...prev, [d.id]: !prev[d.id] }))
                        }
                        className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition ${
                          hideMyLines
                            ? 'border-teal-600 bg-teal-600/10 text-teal-700 dark:text-teal-400'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {hideMyLines ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                        {hideMyLines ? 'Show My Lines' : 'Practice Mode (Hide "You:")'}
                      </button>

                      {canSpeak && (
                        <button
                          onClick={() => handlePlayDialogue(d)}
                          className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition ${
                            isPlayingThis
                              ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400'
                              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {isPlayingThis ? (
                            <>
                              <Square className="h-3.5 w-3.5" /> Stop Audio
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" /> Listen Full Dialogue
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() =>
                          onUpdateDialogue({
                            ...d,
                            practicedCount: d.practicedCount + 1,
                            lastPracticedAt: Date.now(),
                          })
                        }
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 px-3.5 text-xs font-semibold text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Mark Practiced
                      </button>
                    </div>

                    {/* Turn-by-turn script */}
                    <div className="space-y-2.5">
                      {lines.map((line, idx) => {
                        const { speaker, text } = parseTurn(line);
                        const isSelf =
                          speaker !== null &&
                          ['you', 'eu', 'me', 'student', 'learner'].includes(
                            speaker.toLowerCase()
                          );
                        const turnKey = `${d.id}-${idx}`;
                        const isHidden = hideMyLines && isSelf && !revealedTurns[turnKey];
                        const isCurrentlySpoken = isPlayingThis && activeTurnIdx === idx;

                        return (
                          <div
                            key={turnKey}
                            className={`rounded-xl border p-3.5 flex items-start justify-between gap-3 transition ${
                              isCurrentlySpoken
                                ? 'border-teal-500 ring-1 ring-teal-500/40 bg-teal-500/10'
                                : isSelf
                                  ? 'border-teal-600/25 bg-teal-600/5 dark:bg-teal-500/10'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50'
                            }`}
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              {speaker && (
                                <p
                                  className={`text-xs font-semibold ${
                                    isSelf
                                      ? 'text-teal-700 dark:text-teal-400'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {speaker}
                                </p>
                              )}
                              {isHidden ? (
                                <button
                                  onClick={() =>
                                    setRevealedTurns((prev) => ({ ...prev, [turnKey]: true }))
                                  }
                                  className="text-xs font-semibold text-teal-700 dark:text-teal-400 underline underline-offset-2"
                                >
                                  Speak your reply aloud, then tap to reveal line
                                </button>
                              ) : (
                                <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                                  {text}
                                </p>
                              )}
                            </div>
                            {canSpeak && !isHidden && (
                              <button
                                onClick={() =>
                                  speakEnglishText(text, {
                                    preferredVoiceURI: voicePrefs.preferredVoiceURI,
                                    rate: voicePrefs.rate,
                                  })
                                }
                                aria-label="Listen to line"
                                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 shrink-0"
                              >
                                <Volume2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Key Takeaways / AI Corrections */}
                    {d.takeaways && (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5 space-y-1">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Corrections & Consolidation Takeaways
                        </p>
                        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 whitespace-pre-line">
                          {d.takeaways}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Add / Edit Dialogue Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                {editingDialogue ? 'Edit Saved Dialogue' : 'Save Dialogue / AI Recap'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-2 text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-sm">
              <label className="block">
                <span className="text-xs font-medium text-slate-500">Dialogue Title</span>
                <input
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Job Interview Practice with AI"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Source</span>
                  <select
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3"
                  >
                    {SOURCE_PRESETS.map((src) => (
                      <option key={src} value={src}>
                        {src}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">CEFR Level</span>
                  <select
                    value={formLevel}
                    onChange={(e) => setFormLevel(e.target.value as CEFRLevel)}
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
                  <span className="text-xs font-medium text-slate-500">Linked Topic</span>
                  <select
                    value={formTopicId}
                    onChange={(e) => {
                      const found = topics.find((t) => t.id === e.target.value);
                      setFormTopicId(e.target.value);
                      if (found) setFormLevel(found.level);
                    }}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3"
                  >
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.level}] {t.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">
                  Dialogue Text (prefix turns with "AI:" and "You:" for Practice Mode)
                </span>
                <textarea
                  required
                  rows={7}
                  value={formScript}
                  onChange={(e) => setFormScript(e.target.value)}
                  placeholder={'AI: How was your weekend?\nYou: It was great, I practiced speaking for two hours.'}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 font-sans text-sm text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">
                  AI Corrections, Feedback & Key Expressions
                </span>
                <textarea
                  rows={3}
                  value={formTakeaways}
                  onChange={(e) => setFormTakeaways(e.target.value)}
                  placeholder="Paste the AI summary, grammar fixes, or new phrases to consolidate..."
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-slate-100"
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
                  {editingDialogue ? 'Save Changes' : 'Save Dialogue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
