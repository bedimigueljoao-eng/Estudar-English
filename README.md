# FOCOENGLISH MOBILE V2.0

An **offline-first English Study Management System** (CEFR A1–C2) built for serious English learners focused on speaking fluency, detailed time tracking, lesson deadlines, and long-term progress visibility.

## Core Architecture

1. **100% Offline Local Storage (`src/storage/offlineDb.ts`)**
   - Uses **IndexedDB** (`focoenglish_v2_offline_db`) with a `localStorage` resilient mirror.
   - **Private PDF Vault**: Importing a PDF copies the binary `Blob` into private app storage (`pdf_vault` store on web/PWA, `context.filesDir/pdf_vault/` on Android). Original PDF files are never modified or deleted.
   - **Offline Voice Self-Check**: Built-in `MediaRecorder` stores speaking practice audio locally in `speaking_audio`.

2. **Background Study Timer (`src/services/timerBridge.ts` & `android/.../StudyTimerService.kt`)**
   - Uses wall-clock timestamp math (`startedAtMs`, `lastResumedAtMs`, `accumulatedMs`) so study time is never lost when minimized, locked, or closed.
   - Supports 16 study modes (`Speaking`, `Conversation Practice`, `Shadowing`, `Pronunciation`, `Listening Active`, `Listening Passive`, `Podcasts`, `YouTube Learning`, `Reading`, `Vocabulary`, `Grammar`, `Writing`, `Movies`, `Series`, `Immersion`, `Custom Activities`).
   - On Android 10+ (`minSdk = 29`), `StudyTimerService.kt` runs as a `START_STICKY` Foreground Service displaying a persistent status bar icon and notification (`Pause`, `Resume`, `Stop` actions via `TimerActionReceiver.kt`). Tapping the notification returns directly to the active session.

3. **90-Topic CEFR A1–C2 Roadmap (`src/data/roadmapSeed.ts`)**
   - 15 structured lessons per CEFR level (A1 through C2) with descriptions, grammar focus, key vocabulary, speaking focus prompts, interactive 3-step oral consolidation drills, custom deadlines, and full add/edit/delete/reorder controls.

4. **Skill Analytics, Goals, History & V1 Migration (`src/utils/analytics.ts`)**
   - Pie chart, horizontal bar chart, and 6-month trend chart combining timer logs, manual entries, and imported V1 records.
   - Daily, weekly, and monthly goal rings plus achievement milestones.
   - Full JSON Backup/Restore and FOCOENGLISH V1 JSON validator/importer.

5. **Future AI Module Port (`src/ai/FutureAIArchitecture.ts`)**
   - Defines `FocoAIEnginePort` for future skill diagnostics, study plan recommendations, CEFR completion forecasting, and pattern detection. Cloud AI is intentionally disabled in V2.0; `LocalDiagnosticHeuristicEngine` runs deterministically offline.

## Building the Android APK

### Automated Pipeline (GitHub Actions)
Push to `main` or trigger **Build FOCOENGLISH Android APK** (`.github/workflows/build-apk.yml`) to generate and download `focoenglish-mobile-v2-debug-apk` and `focoenglish-mobile-v2-release-apk`.

### Local Build
```bash
npm install
npm run build
mkdir -p android/app/src/main/assets/public
cp -r dist/* android/app/src/main/assets/public/
cd android && gradle assembleDebug
```
