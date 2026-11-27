import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Mic,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { ALL_LEVELS } from '../services/timerBridge';
import type { CEFRLevel, RoadmapTopic, TopicStatus } from '../types/foco';
import { formatHoursMinutes, getTopicDeadlineState } from '../utils/analytics';

interface LevelsRoadmapViewProps {
  topics: RoadmapTopic[];
  sessionSecondsByTopic: Record<string, number>;
  currentLevel: CEFRLevel;
  onUpdateTopic: (topic: RoadmapTopic) => void;
  onAddTopic: (topic: RoadmapTopic) => void;
  onDeleteTopic: (topicId: string) => void;
  onReorderTopic: (topicId: string, direction: 'up' | 'down') => void;
  onStartTimerForTopic: (topic: RoadmapTopic) => void;
}

const STATUS_LABELS: Record<TopicStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  consolidating: 'Consolidating',
  mastered: 'Mastered',
};

export const LevelsRoadmapView: React.FC<LevelsRoadmapViewProps> = ({
  topics,
  sessionSecondsByTopic,
  currentLevel,
  onUpdateTopic,
  onAddTopic,
  onDeleteTopic,
  onReorderTopic,
  onStartTimerForTopic,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel>(currentLevel);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TopicStatus | 'with_deadline'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Add/Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<RoadmapTopic | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formLevel, setFormLevel] = useState<CEFRLevel>(currentLevel);
  const [formDesc, setFormDesc] = useState('');
  const [formGrammar, setFormGrammar] = useState('');
  const [formVocab, setFormVocab] = useState('');
  const [formSpeakingPrompt, setFormSpeakingPrompt] = useState('');
  const [formDrills, setFormDrills] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formEstMinutes, setFormEstMinutes] = useState(90);

  const levelStats = useMemo(() => {
    return ALL_LEVELS.map((lvl) => {
      const list = topics.filter((t) => t.level === lvl);
      const mastered = list.filter((t) => t.status === 'mastered').length;
      return {
        level: lvl,
        total: list.length,
        mastered,
        percent: list.length > 0 ? Math.round((mastered / list.length) * 100) : 0,
      };
    });
  }, [topics]);

  const filteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return topics
      .filter((t) => t.level === selectedLevel)
      .filter((t) => {
        if (statusFilter === 'with_deadline') return !!t.deadline;
        if (statusFilter !== 'all') return t.status === statusFilter;
        return true;
      })
      .filter((t) => {
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.grammarFocus.toLowerCase().includes(q) ||
          t.speakingFocusPrompt.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.order - b.order);
  }, [topics, selectedLevel, statusFilter, searchQuery]);

  const openCreateModal = () => {
    setEditingTopic(null);
    setFormTitle('');
    setFormLevel(selectedLevel);
    setFormDesc('');
    setFormGrammar('');
    setFormVocab('');
    setFormSpeakingPrompt('');
    setFormDrills(
      'Record a 60-second monologue on this topic\nRoleplay a realistic dialogue aloud\nShadow a native audio clip 3 times'
    );
    setFormDeadline('');
    setFormEstMinutes(90);
    setModalOpen(true);
  };

  const openEditModal = (topic: RoadmapTopic) => {
    setEditingTopic(topic);
    setFormTitle(topic.title);
    setFormLevel(topic.level);
    setFormDesc(topic.description);
    setFormGrammar(topic.grammarFocus);
    setFormVocab(topic.keyVocabulary.join(', '));
    setFormSpeakingPrompt(topic.speakingFocusPrompt);
    setFormDrills(topic.speakingDrills.join('\n'));
    setFormDeadline(topic.deadline ?? '');
    setFormEstMinutes(topic.estimatedMinutes);
    setModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const vocabArr = formVocab
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    const drillsArr = formDrills
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean);

    if (editingTopic) {
      onUpdateTopic({
        ...editingTopic,
        title: formTitle.trim(),
        level: formLevel,
        description: formDesc.trim() || 'Focused English consolidation lesson.',
        grammarFocus: formGrammar.trim() || 'Core structural patterns',
        keyVocabulary: vocabArr.length ? vocabArr : ['Core phrase'],
        speakingFocusPrompt:
          formSpeakingPrompt.trim() || `Speak aloud for 90 seconds about ${formTitle.trim()}.`,
        speakingDrills: drillsArr.length
          ? drillsArr
          : [`Speak for 60 seconds on ${formTitle.trim()}`],
        deadline: formDeadline || null,
        estimatedMinutes: Math.max(15, Number(formEstMinutes) || 60),
      });
    } else {
      const maxOrder = topics.reduce((max, t) => Math.max(max, t.order), 0);
      const newTopic: RoadmapTopic = {
        id: `topic-custom-${Date.now()}`,
        level: formLevel,
        order: maxOrder + 1,
        title: formTitle.trim(),
        description: formDesc.trim() || 'Custom English study and speaking consolidation lesson.',
        grammarFocus: formGrammar.trim() || 'Practical spoken structures',
        keyVocabulary: vocabArr.length ? vocabArr : ['Key expression'],
        speakingFocusPrompt:
          formSpeakingPrompt.trim() || `Speak aloud for 90 seconds about ${formTitle.trim()}.`,
        speakingDrills: drillsArr.length
          ? drillsArr
          : [`Speak for 60 seconds about ${formTitle.trim()}`],
        estimatedMinutes: Math.max(15, Number(formEstMinutes) || 60),
        deadline: formDeadline || null,
        status: 'not_started',
        completedDrills: [],
        isCustom: true,
      };
      onAddTopic(newTopic);
      setSelectedLevel(formLevel);
    }
    setModalOpen(false);
  };

  const toggleDrill = (topic: RoadmapTopic, drillIndex: number) => {
    const exists = topic.completedDrills.includes(drillIndex);
    const nextDrills = exists
      ? topic.completedDrills.filter((i) => i !== drillIndex)
      : [...topic.completedDrills, drillIndex];

    let nextStatus = topic.status;
    if (nextDrills.length === topic.speakingDrills.length && topic.speakingDrills.length > 0) {
      nextStatus = 'mastered';
    } else if (nextDrills.length > 0 && topic.status === 'not_started') {
      nextStatus = 'in_progress';
    }

    onUpdateTopic({
      ...topic,
      completedDrills: nextDrills,
      status: nextStatus,
    });
  };

  return (
    <div className="space-y-5">
      {/* Header + Create Custom Topic Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
            CEFR A1–C2 Learning Roadmap
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {topics.length} structured lessons with speaking drills, grammar focus, and custom deadlines.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Custom Topic
        </button>
      </div>

      {/* Level Selector Strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {levelStats.map((item) => {
          const active = item.level === selectedLevel;
          return (
            <button
              key={item.level}
              onClick={() => setSelectedLevel(item.level)}
              className={`min-h-[56px] rounded-xl border p-2.5 text-left transition ${
                active
                  ? 'border-teal-600 bg-teal-600/10 dark:bg-teal-500/15 text-slate-900 dark:text-slate-50'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold">{item.level}</span>
                <span className="font-mono text-xs tabular-nums">{item.percent}%</span>
              </div>
              <p className="mt-1 font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                {item.mastered}/{item.total} done
              </p>
            </button>
          );
        })}
      </div>

      {/* Search & Status Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${selectedLevel} topics, grammar, or speaking prompts...`}
            className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 overflow-x-auto">
          {(
            [
              ['all', 'All'],
              ['in_progress', 'Active'],
              ['with_deadline', 'Deadlines'],
              ['mastered', 'Mastered'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                statusFilter === val
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Topics List */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
        {filteredTopics.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              No lessons match your current filter in {selectedLevel}.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : (
          filteredTopics.map((topic, idx) => {
            const isExpanded = expandedId === topic.id;
            const dState = getTopicDeadlineState(topic);
            const loggedSec = sessionSecondsByTopic[topic.id] ?? 0;

            const deadlineText = topic.deadline
              ? dState === 'overdue'
                ? `Overdue (${topic.deadline})`
                : dState === 'due_soon'
                  ? `Due soon (${topic.deadline})`
                  : `Due ${topic.deadline}`
              : 'No deadline';

            const deadlineColor =
              dState === 'overdue'
                ? 'text-red-600 dark:text-red-400'
                : dState === 'due_soon'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-500 dark:text-slate-400';

            return (
              <div key={topic.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : topic.id)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                        {topic.level} · {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{STATUS_LABELS[topic.status]}</span>
                      <span aria-hidden="true">·</span>
                      <span className={deadlineColor}>{deadlineText}</span>
                      {loggedSec > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatHoursMinutes(loggedSec)} logged
                          </span>
                        </>
                      )}
                    </div>
                    <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                      {topic.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                      {topic.description}
                    </p>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onStartTimerForTopic(topic)}
                      title="Practice speaking on this topic"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-teal-600/10 hover:bg-teal-600/20 text-teal-700 dark:text-teal-400 transition"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : topic.id)}
                      aria-label={isExpanded ? 'Collapse lesson' : 'Expand lesson'}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                    {/* Speaking Consolidation Box */}
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400">
                        <Mic className="h-4 w-4" />
                        Speaking Focus Prompt
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                        {topic.speakingFocusPrompt}
                      </p>

                      <div className="space-y-2 pt-1">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Oral Consolidation Drills ({topic.completedDrills.length}/{topic.speakingDrills.length})
                        </p>
                        {topic.speakingDrills.map((drill, dIdx) => {
                          const done = topic.completedDrills.includes(dIdx);
                          return (
                            <button
                              key={dIdx}
                              onClick={() => toggleDrill(topic, dIdx)}
                              className="w-full min-h-[42px] flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white dark:hover:bg-slate-800 transition"
                            >
                              <span
                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                                  done
                                    ? 'border-teal-600 bg-teal-600 text-white'
                                    : 'border-slate-300 dark:border-slate-600'
                                }`}
                              >
                                {done && <Check className="h-3.5 w-3.5" />}
                              </span>
                              <span
                                className={
                                  done
                                    ? 'line-through text-slate-400 dark:text-slate-500'
                                    : 'text-slate-700 dark:text-slate-300'
                                }
                              >
                                {drill}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Grammar & Key Vocabulary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Grammar Structure
                        </p>
                        <p className="mt-1 text-slate-800 dark:text-slate-200">
                          {topic.grammarFocus}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Target Expressions
                        </p>
                        <p className="mt-1 text-slate-800 dark:text-slate-200">
                          {topic.keyVocabulary.join(' · ')}
                        </p>
                      </div>
                    </div>

                    {/* Controls: Status, Deadline, Reorder, Edit, Delete */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <span>Status:</span>
                          <select
                            value={topic.status}
                            onChange={(e) =>
                              onUpdateTopic({
                                ...topic,
                                status: e.target.value as TopicStatus,
                              })
                            }
                            className="min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-900 dark:text-slate-100"
                          >
                            <option value="not_started">Not Started</option>
                            <option value="in_progress">In Progress</option>
                            <option value="consolidating">Consolidating</option>
                            <option value="mastered">Mastered</option>
                          </select>
                        </label>

                        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Deadline:</span>
                          <input
                            type="date"
                            value={topic.deadline ?? ''}
                            onChange={(e) =>
                              onUpdateTopic({
                                ...topic,
                                deadline: e.target.value || null,
                              })
                            }
                            className="min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-mono text-slate-900 dark:text-slate-100"
                          />
                        </label>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onReorderTopic(topic.id, 'up')}
                          title="Move topic up"
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onReorderTopic(topic.id, 'down')}
                          title="Move topic down"
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(topic)}
                          title="Edit topic"
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        {confirmDeleteId === topic.id ? (
                          <button
                            onClick={() => {
                              onDeleteTopic(topic.id);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[38px] px-3 rounded-lg bg-red-600 text-xs font-semibold text-white"
                          >
                            Confirm Delete
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(topic.id)}
                            title="Delete topic"
                            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Topic Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                {editingTopic ? 'Edit Roadmap Topic' : 'Add Custom Study Topic'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-3.5 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <label className="col-span-2 block">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Topic Title
                  </span>
                  <input
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g., Job Interview Mock Q&A"
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    CEFR Level
                  </span>
                  <select
                    value={formLevel}
                    onChange={(e) => setFormLevel(e.target.value as CEFRLevel)}
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
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Consolidation Goal / Description
                </span>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="What must you master to complete this lesson?"
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Speaking Focus Prompt
                </span>
                <textarea
                  rows={2}
                  value={formSpeakingPrompt}
                  onChange={(e) => setFormSpeakingPrompt(e.target.value)}
                  placeholder="Main oral task to prove fluency on this topic..."
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Speaking Drills (one per line)
                </span>
                <textarea
                  rows={3}
                  value={formDrills}
                  onChange={(e) => setFormDrills(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Grammar Focus
                  </span>
                  <input
                    value={formGrammar}
                    onChange={(e) => setFormGrammar(e.target.value)}
                    placeholder="e.g., Present Perfect vs Past Simple"
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Key Expressions (comma-separated)
                  </span>
                  <input
                    value={formVocab}
                    onChange={(e) => setFormVocab(e.target.value)}
                    placeholder="phrase 1, phrase 2"
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Lesson Deadline
                  </span>
                  <input
                    type="date"
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono text-slate-900 dark:text-slate-100"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Estimated Minutes
                  </span>
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={formEstMinutes}
                    onChange={(e) => setFormEstMinutes(Number(e.target.value))}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono text-slate-900 dark:text-slate-100"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-sm font-semibold text-white"
                >
                  {editingTopic ? 'Save Changes' : 'Create Topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
