import type { AppState } from '../types/foco';
import { createInitialAppState } from '../data/initialData';

const DB_NAME = 'focoenglish_v2_offline_db';
const DB_VERSION = 1;
const STORE_STATE = 'app_state';
const STORE_PDFS = 'pdf_vault';
const STORE_AUDIO = 'speaking_audio';
const STATE_KEY = 'primary_state';
const LS_BACKUP_KEY = 'focoenglish_v2_state_backup';

interface StoredPdfRecord {
  key: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  blob: Blob;
  importedAt: number;
}

interface StoredAudioRecord {
  key: string;
  label: string;
  mimeType: string;
  blob: Blob;
  createdAt: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE);
      }
      if (!db.objectStoreNames.contains(STORE_PDFS)) {
        db.createObjectStore(STORE_PDFS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        db.createObjectStore(STORE_AUDIO, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function loadAppState(): Promise<AppState> {
  try {
    const db = await openDatabase();
    const record = await new Promise<AppState | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_STATE, 'readonly');
      const store = tx.objectStore(STORE_STATE);
      const req = store.get(STATE_KEY);
      req.onsuccess = () => resolve(req.result as AppState | undefined);
      req.onerror = () => reject(req.error);
    });
    if (record && Array.isArray(record.topics) && Array.isArray(record.sessions)) {
      return {
        ...record,
        dialogues: Array.isArray(record.dialogues) ? record.dialogues : createInitialAppState().dialogues,
        mistakes: Array.isArray(record.mistakes) ? record.mistakes : createInitialAppState().mistakes,
        activeTimer: {
          ...record.activeTimer,
          studyMode: record.activeTimer?.studyMode ?? (record.activeTimer?.topicId ? 'lesson' : 'skill'),
        },
      };
    }
  } catch {
    // Fallback to localStorage below
  }

  try {
    const raw = localStorage.getItem(LS_BACKUP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && Array.isArray(parsed.topics) && Array.isArray(parsed.sessions)) {
        return {
          ...parsed,
          dialogues: Array.isArray(parsed.dialogues) ? parsed.dialogues : createInitialAppState().dialogues,
          mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes : createInitialAppState().mistakes,
          activeTimer: {
            ...parsed.activeTimer,
            studyMode: parsed.activeTimer?.studyMode ?? (parsed.activeTimer?.topicId ? 'lesson' : 'skill'),
          },
        };
      }
    }
  } catch {
    // Ignore parse error
  }

  const fresh = createInitialAppState();
  await saveAppState(fresh);
  return fresh;
}

export async function saveAppState(state: AppState): Promise<void> {
  const payload: AppState = {
    ...state,
    lastUpdatedAt: Date.now(),
  };

  try {
    localStorage.setItem(LS_BACKUP_KEY, JSON.stringify(payload));
  } catch {
    // Quota fallback
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_STATE, 'readwrite');
      const store = tx.objectStore(STORE_STATE);
      const req = store.put(payload, STATE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // IndexedDB unavailable; localStorage already updated
  }
}

/**
 * Copies a user-selected PDF file into the app's private IndexedDB storage.
 * The original file on disk is NEVER modified or deleted.
 */
export async function importPdfCopyToPrivateVault(file: File): Promise<{
  key: string;
  fileName: string;
  sizeBytes: number;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const copiedBlob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const key = `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const record: StoredPdfRecord = {
    key,
    fileName: file.name,
    mimeType: 'application/pdf',
    sizeBytes: copiedBlob.size,
    blob: copiedBlob,
    importedAt: Date.now(),
  };

  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PDFS, 'readwrite');
    const store = tx.objectStore(STORE_PDFS);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  return {
    key,
    fileName: file.name,
    sizeBytes: copiedBlob.size,
  };
}

export async function getPdfBlobFromVault(key: string): Promise<StoredPdfRecord | null> {
  try {
    const db = await openDatabase();
    const rec = await new Promise<StoredPdfRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_PDFS, 'readonly');
      const store = tx.objectStore(STORE_PDFS);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as StoredPdfRecord | undefined);
      req.onerror = () => reject(req.error);
    });
    return rec ?? null;
  } catch {
    return null;
  }
}

export async function deletePdfFromVault(key: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PDFS, 'readwrite');
      const store = tx.objectStore(STORE_PDFS);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}

export async function saveSpeakingAudioNote(label: string, blob: Blob): Promise<string> {
  const key = `audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const record: StoredAudioRecord = {
    key,
    label,
    mimeType: blob.type || 'audio/webm',
    blob,
    createdAt: Date.now(),
  };
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO, 'readwrite');
    const store = tx.objectStore(STORE_AUDIO);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  return key;
}

export async function listSpeakingAudioNotes(): Promise<StoredAudioRecord[]> {
  try {
    const db = await openDatabase();
    return await new Promise<StoredAudioRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_AUDIO, 'readonly');
      const store = tx.objectStore(STORE_AUDIO);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result as StoredAudioRecord[]) ?? [];
        resolve(rows.sort((a, b) => b.createdAt - a.createdAt));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function deleteSpeakingAudioNote(key: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_AUDIO, 'readwrite');
      const store = tx.objectStore(STORE_AUDIO);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
}
