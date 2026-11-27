import React, { useState } from 'react';
import {
  ArrowRightLeft,
  Check,
  Cpu,
  Download,
  Moon,
  RotateCcw,
  Smartphone,
  Sun,
  Upload,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import type { AppSettings, AppState, CEFRLevel, StudySession } from '../types/foco';
import { validateAndMigrateV1Data, type V1MigrationResult } from '../utils/analytics';

interface SettingsBackupViewProps {
  state: AppState;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onRestoreFullBackup: (nextState: AppState) => void;
  onImportV1Sessions: (sessions: StudySession[], detectedLevel?: CEFRLevel) => void;
  onResetAllData: () => void;
}

export const SettingsBackupView: React.FC<SettingsBackupViewProps> = ({
  state,
  onUpdateSettings,
  onRestoreFullBackup,
  onImportV1Sessions,
  onResetAllData,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [v1Text, setV1Text] = useState('');
  const [v1Preview, setV1Preview] = useState<V1MigrationResult | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleExportJSON = () => {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `focoenglish-v2-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as AppState;
      if (!parsed || !Array.isArray(parsed.topics) || !Array.isArray(parsed.sessions)) {
        setRestoreMessage('Invalid V2 backup JSON structure.');
        return;
      }
      onRestoreFullBackup({
        ...parsed,
        dialogues: Array.isArray(parsed.dialogues) ? parsed.dialogues : [],
      });
      setRestoreMessage(`Restored backup (${parsed.sessions.length} sessions, ${parsed.topics.length} topics).`);
    } catch {
      setRestoreMessage('Could not parse backup JSON file.');
    }
  };

  const handleValidateV1 = (text: string) => {
    setV1Text(text);
    if (!text.trim()) {
      setV1Preview(null);
      return;
    }
    setV1Preview(validateAndMigrateV1Data(text));
  };

  const handleUploadV1File = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    handleValidateV1(text);
  };

  const handleLoadSampleV1 = () => {
    const sample = JSON.stringify(
      {
        app: 'FOCOENGLISH_V1',
        currentLevel: 'A2',
        sessions: [
          {
            date: '2026-09-14',
            hours: 2.5,
            skill: 'Listening',
            level: 'A2',
            topic: 'BBC Learning English',
            notes: 'V1 historical listening log',
          },
          {
            date: '2026-09-16',
            minutes: 90,
            skill: 'Speaking',
            level: 'A2',
            topic: 'Travel & Hotel Check-in',
            notes: 'Roleplay speaking practice from V1',
          },
        ],
      },
      null,
      2
    );
    handleValidateV1(sample);
  };

  const handleCommitV1 = () => {
    if (!v1Preview?.valid) return;
    onImportV1Sessions(v1Preview.importedSessions, v1Preview.detectedLevel);
    setRestoreMessage(`Imported ${v1Preview.importedSessions.length} V1 historical sessions.`);
    setV1Preview(null);
    setV1Text('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
          Settings, Backup & V1 Migration
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Offline preferences, full JSON backup/restore, FOCOENGLISH V1 migration, and Android APK pipeline.
        </p>
      </div>

      {/* Appearance & App Preferences */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Theme & Preferences
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Theme Mode</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Switch between Dark and Light interface
              </p>
            </div>
            <button
              onClick={() =>
                onUpdateSettings({ theme: state.settings.theme === 'dark' ? 'light' : 'dark' })
              }
              className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              {state.settings.theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400" /> Light Mode
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-slate-700" /> Dark Mode
                </>
              )}
            </button>
          </div>

          <label className="flex flex-col justify-center rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Learner Name
            </span>
            <input
              value={state.settings.learnerName}
              onChange={(e) => onUpdateSettings({ learnerName: e.target.value })}
              className="mt-1 min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
            />
          </label>
        </div>

        {/* PWA Install Widget */}
        {!isInstalled && (isInstallable || isIOS) && (
          <div className="flex items-center justify-between rounded-xl border border-teal-600/30 bg-teal-600/5 p-4">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Install FOCOENGLISH Offline App
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Run standalone from your Android/iOS home screen without internet.
                </p>
              </div>
            </div>
            {isInstallable ? (
              <button
                onClick={install}
                className="min-h-[42px] px-4 rounded-xl bg-teal-600 text-xs font-semibold text-white"
              >
                Install App
              </button>
            ) : (
              <button
                onClick={() => setShowIOSGuide(true)}
                className="min-h-[42px] px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                Install on iOS
              </button>
            )}
          </div>
        )}
      </section>

      {/* Backup & Restore JSON */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Backup & Restore (JSON)
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Export your entire study history, roadmap topics, deadlines, phrase bank, question bank, movies log, and goals to a local JSON file.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportJSON}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 text-xs font-semibold text-white"
          >
            <Download className="h-4 w-4" />
            Export JSON Backup
          </button>

          <label className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
            <Upload className="h-4 w-4" />
            Import & Restore JSON
            <input type="file" accept="application/json,.json" className="hidden" onChange={handleImportRestoreFile} />
          </label>

          {confirmReset ? (
            <button
              onClick={() => {
                onResetAllData();
                setConfirmReset(false);
                setRestoreMessage('Reset to clean default V2 dataset.');
              }}
              className="min-h-[44px] px-4 rounded-xl bg-red-600 text-xs font-semibold text-white"
            >
              Confirm Factory Reset
            </button>
          ) : (
            <button
              onClick={() => setConfirmReset(true)}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-4 text-xs font-semibold text-red-600 dark:text-red-400"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Data
            </button>
          )}
        </div>

        {restoreMessage && (
          <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 inline-flex items-center gap-1.5">
            <Check className="h-4 w-4" /> {restoreMessage}
          </p>
        )}
      </section>

      {/* Migration from FOCOENGLISH MOBILE V1 */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Migration from FOCOENGLISH MOBILE V1
            </h2>
          </div>
          <button
            onClick={handleLoadSampleV1}
            className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline"
          >
            Load Sample V1 JSON
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Detects V1 exports, validates dates/durations/skills/levels, and merges historical study hours without overwriting your V2 roadmap.
        </p>

        <div className="flex flex-wrap gap-3">
          <label className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 text-xs font-semibold cursor-pointer">
            <Upload className="h-4 w-4" />
            Select V1 JSON File
            <input type="file" accept=".json,application/json" className="hidden" onChange={handleUploadV1File} />
          </label>
        </div>

        <textarea
          rows={4}
          value={v1Text}
          onChange={(e) => handleValidateV1(e.target.value)}
          placeholder='Paste V1 JSON export here (e.g. {"currentLevel":"A2","sessions":[...]})'
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 font-mono text-xs text-slate-900 dark:text-slate-100"
        />

        {v1Preview && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-2 text-xs">
            {v1Preview.valid ? (
              <>
                <p className="font-semibold text-teal-700 dark:text-teal-400">
                  Validated {v1Preview.importedSessions.length} V1 study records
                  {v1Preview.detectedLevel ? ` · Detected Level: ${v1Preview.detectedLevel}` : ''}
                </p>
                {v1Preview.warnings.map((w, i) => (
                  <p key={i} className="text-amber-600 dark:text-amber-400">
                    {w}
                  </p>
                ))}
                <button
                  onClick={handleCommitV1}
                  className="min-h-[40px] px-4 rounded-xl bg-teal-600 text-xs font-semibold text-white"
                >
                  Import V1 History Now
                </button>
              </>
            ) : (
              v1Preview.errors.map((err, i) => (
                <p key={i} className="text-red-600 dark:text-red-400">
                  {err}
                </p>
              ))
            )}
          </div>
        )}
      </section>

      {/* Future AI Architecture & Native Android APK Info */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Native Android APK & Future AI Architecture
          </h2>
        </div>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          This repository includes the Android 10+ native project under <code className="font-mono">/android</code> (Kotlin <code className="font-mono">StudyTimerService.kt</code> Foreground Service, persistent notification with Pause/Resume/Stop actions, status bar timer, and <code className="font-mono">PdfVaultPlugin.kt</code>) plus the automated GitHub Actions APK pipeline in <code className="font-mono">.github/workflows/build-apk.yml</code>. Cloud AI is intentionally omitted in V2.0; <code className="font-mono">src/ai/FutureAIArchitecture.ts</code> defines the <code className="font-mono">FocoAIEnginePort</code> contract for future adaptive coaching.
        </p>
      </section>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
              Install on iPhone / iPad
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              1. Tap the <strong>Share</strong> button in Safari.<br />
              2. Scroll down and tap <strong>Add to Home Screen</strong>.
            </p>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
