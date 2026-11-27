import React, { useMemo, useState } from 'react';
import {
  ExternalLink,
  FileText,
  Globe,
  Plus,
  Search,
  Trash2,
  Upload,
  Video,
  X,
} from 'lucide-react';
import {
  deletePdfFromVault,
  getPdfBlobFromVault,
  importPdfCopyToPrivateVault,
} from '../storage/offlineDb';
import type { ResourceKind, RoadmapTopic, StudyResource } from '../types/foco';

interface ResourcesViewProps {
  resources: StudyResource[];
  topics: RoadmapTopic[];
  onAddResource: (res: StudyResource) => void;
  onDeleteResource: (id: string) => void;
}

export const ResourcesView: React.FC<ResourcesViewProps> = ({
  resources,
  topics,
  onAddResource,
  onDeleteResource,
}) => {
  const [kindFilter, setKindFilter] = useState<'all' | ResourceKind>('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Add Form
  const [kind, setKind] = useState<ResourceKind>('website');
  const [topicId, setTopicId] = useState(topics[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [channelName, setChannelName] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Offline PDF Viewer Modal
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState<string>('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources
      .filter((r) => (kindFilter === 'all' ? true : r.kind === kindFilter))
      .filter((r) => {
        if (!q) return true;
        return (
          r.title.toLowerCase().includes(q) ||
          r.topicTitle.toLowerCase().includes(q) ||
          (r.channelName ?? '').toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [resources, kindFilter, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const topic = topics.find((t) => t.id === topicId) ?? topics[0];
    if (!topic) return;

    if (kind === 'pdf') {
      if (!selectedPdf) {
        setErrorMsg('Select a PDF file to copy into private offline storage.');
        return;
      }
      setImporting(true);
      try {
        const stored = await importPdfCopyToPrivateVault(selectedPdf);
        onAddResource({
          id: `res-${Date.now()}`,
          kind: 'pdf',
          topicId: topic.id,
          topicTitle: topic.title,
          level: topic.level,
          title: title.trim() || stored.fileName.replace(/\.pdf$/i, ''),
          pdfStorageKey: stored.key,
          pdfFileName: stored.fileName,
          pdfSizeBytes: stored.sizeBytes,
          notes: notes.trim(),
          createdAt: Date.now(),
        });
        setModalOpen(false);
        resetForm();
      } catch {
        setErrorMsg('Failed to copy PDF into private app storage.');
      } finally {
        setImporting(false);
      }
      return;
    }

    if (!title.trim() || !url.trim()) {
      setErrorMsg('Title and URL are required.');
      return;
    }

    onAddResource({
      id: `res-${Date.now()}`,
      kind,
      topicId: topic.id,
      topicTitle: topic.title,
      level: topic.level,
      title: title.trim(),
      url: url.trim(),
      channelName: kind === 'youtube' ? channelName.trim() : undefined,
      notes: notes.trim(),
      createdAt: Date.now(),
    });
    setModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setUrl('');
    setChannelName('');
    setNotes('');
    setSelectedPdf(null);
    setErrorMsg(null);
  };

  const handleOpenPdf = async (res: StudyResource) => {
    if (!res.pdfStorageKey) return;
    const rec = await getPdfBlobFromVault(res.pdfStorageKey);
    if (!rec) {
      setErrorMsg('Offline PDF copy not found in private storage.');
      return;
    }
    const objUrl = URL.createObjectURL(rec.blob);
    setViewerTitle(res.title);
    setViewerUrl(objUrl);
  };

  const closePdfViewer = () => {
    if (viewerUrl) URL.revokeObjectURL(viewerUrl);
    setViewerUrl(null);
    setViewerTitle('');
  };

  const handleDelete = async (res: StudyResource) => {
    if (res.kind === 'pdf' && res.pdfStorageKey) {
      await deletePdfFromVault(res.pdfStorageKey);
    }
    onDeleteResource(res.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
            Study Resources & Private PDF Vault
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Save websites, YouTube channels, and offline PDF copies per lesson. Original PDFs are never deleted.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Resource
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources by title, topic, or channel..."
            className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 overflow-x-auto no-scrollbar">
          {(
            [
              ['all', 'All'],
              ['website', 'Websites'],
              ['youtube', 'YouTube'],
              ['pdf', 'Offline PDFs'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setKindFilter(val)}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                kindFilter === val
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Resource List */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            No study resources saved yet. Add a website, YouTube lesson, or import an offline PDF copy.
          </div>
        ) : (
          filtered.map((res) => {
            const Icon = res.kind === 'pdf' ? FileText : res.kind === 'youtube' ? Video : Globe;
            return (
              <div key={res.id} className="p-4 sm:p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-teal-700 dark:text-teal-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                        {res.level}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{res.topicTitle}</span>
                      {res.kind === 'youtube' && res.channelName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{res.channelName}</span>
                        </>
                      )}
                      {res.kind === 'pdf' && res.pdfSizeBytes && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {Math.max(1, Math.round(res.pdfSizeBytes / 1024))} KB offline copy
                          </span>
                        </>
                      )}
                    </div>
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                      {res.title}
                    </h3>
                    {res.notes && (
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        {res.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {res.kind === 'pdf' ? (
                    <button
                      onClick={() => handleOpenPdf(res)}
                      className="min-h-[40px] px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-xs font-semibold text-white whitespace-nowrap"
                    >
                      Open PDF
                    </button>
                  ) : (
                    res.url && (
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[40px] inline-flex items-center gap-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        Open <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )
                  )}
                  <button
                    onClick={() => handleDelete(res)}
                    aria-label="Delete resource"
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Resource Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 pb-safe space-y-4">
            <div className="sm:hidden w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-1 mb-2" />
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                Add Study Resource
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              {(
                [
                  ['website', 'Website'],
                  ['youtube', 'YouTube'],
                  ['pdf', 'PDF Copy'],
                ] as const
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`min-h-[40px] rounded-lg text-xs font-semibold transition ${
                    kind === k
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-sm">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Linked Topic
                </span>
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
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Resource Title
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={kind === 'pdf' ? 'Optional (defaults to file name)' : 'e.g., BBC 6 Minute English'}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                />
              </label>

              {kind === 'pdf' ? (
                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-5 cursor-pointer hover:border-teal-500">
                    <Upload className="h-6 w-6 text-teal-600 dark:text-teal-400 mb-1.5" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {selectedPdf ? selectedPdf.name : 'Choose PDF to Copy into Private Vault'}
                    </span>
                    <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 text-center">
                      Original file stays untouched; a private copy is stored offline inside the app.
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => setSelectedPdf(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              ) : (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {kind === 'youtube' ? 'YouTube Video URL' : 'Website URL'}
                    </span>
                    <input
                      type="url"
                      required
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://..."
                      className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                    />
                  </label>
                  {kind === 'youtube' && (
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Channel Name
                      </span>
                      <input
                        value={channelName}
                        onChange={(e) => setChannelName(e.target.value)}
                        placeholder="e.g., English with Lucy"
                        className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100"
                      />
                    </label>
                  )}
                </>
              )}

              <label className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Study Notes
                </span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Key chapters, timestamps, or shadowing focus..."
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-slate-900 dark:text-slate-100"
                />
              </label>

              {errorMsg && <p className="text-xs text-red-600 dark:text-red-400">{errorMsg}</p>}

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
                  disabled={importing}
                  className="min-h-[44px] px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {importing ? 'Copying PDF...' : 'Save Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Embedded Offline PDF Viewer Modal */}
      {viewerUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900 text-slate-100">
            <span className="text-sm font-semibold truncate">{viewerTitle}</span>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={viewerUrl}
                download={`${viewerTitle}.pdf`}
                className="min-h-[38px] inline-flex items-center px-3 rounded-lg bg-slate-800 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                Download Copy
              </a>
              <button
                onClick={closePdfViewer}
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <iframe
            src={viewerUrl}
            title={viewerTitle}
            className="flex-1 w-full bg-white"
          />
        </div>
      )}
    </div>
  );
};
