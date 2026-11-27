/**
 * Offline English Speech Synthesis Engine
 * Ranks natural/neural English voices ahead of generic system voices,
 * supports dual-speaker dialogue playback with turn pauses,
 * and falls back to native Android TextToSpeech via FocoAndroidBridge.
 */

export interface VoicePrefs {
  preferredVoiceURI: string;
  rate: number; // 0.75 | 0.9 | 1.0 | 1.15
}

const VOICE_PREFS_KEY = 'focoenglish_voice_prefs_v2';

export function loadVoicePrefs(): VoicePrefs {
  try {
    const raw = localStorage.getItem(VOICE_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VoicePrefs>;
      return {
        preferredVoiceURI: parsed.preferredVoiceURI ?? '',
        rate: typeof parsed.rate === 'number' ? parsed.rate : 0.92,
      };
    }
  } catch {
    // ignore
  }
  return { preferredVoiceURI: '', rate: 0.92 };
}

export function saveVoicePrefs(prefs: VoicePrefs): void {
  try {
    localStorage.setItem(VOICE_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function scoreEnglishVoice(v: SpeechSynthesisVoice): number {
  const lang = v.lang.toLowerCase();
  if (!lang.startsWith('en')) return -100;

  let score = 0;
  if (lang === 'en-us' || lang === 'en_us') score += 25;
  else if (lang === 'en-gb' || lang === 'en_gb') score += 22;
  else score += 15;

  const name = v.name.toLowerCase();
  if (name.includes('natural')) score += 50;
  if (name.includes('neural')) score += 45;
  if (name.includes('online')) score += 35;
  if (name.includes('google us english') || name.includes('google uk english')) score += 40;
  if (name.includes('enhanced') || name.includes('premium') || name.includes('siri')) score += 35;
  if (
    name.includes('aria') ||
    name.includes('jenny') ||
    name.includes('guy') ||
    name.includes('ava') ||
    name.includes('samantha') ||
    name.includes('daniel') ||
    name.includes('libby') ||
    name.includes('ryan')
  ) {
    score += 30;
  }
  if (name.includes('espeak') || name.includes('compact')) score -= 30;
  if (!v.localService) score += 8; // Higher-quality system/network voices when cached/available
  return score;
}

export function getRankedEnglishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const all = window.speechSynthesis.getVoices();
  return all
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => scoreEnglishVoice(b) - scoreEnglishVoice(a));
}

export function pickBestVoices(preferredURI?: string): {
  primary: SpeechSynthesisVoice | null;
  secondary: SpeechSynthesisVoice | null;
} {
  const ranked = getRankedEnglishVoices();
  if (ranked.length === 0) return { primary: null, secondary: null };

  const primary =
    (preferredURI ? ranked.find((v) => v.voiceURI === preferredURI) : null) ?? ranked[0];
  const secondary = ranked.find((v) => v.voiceURI !== primary.voiceURI) ?? primary;
  return { primary, secondary };
}

export function isSpeechAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.speechSynthesis !== 'undefined') return true;
  return Boolean(window.FocoAndroidBridge?.speakText);
}

let activePlaybackToken = 0;
let pauseTimerId: number | null = null;

export function stopAllSpeech(): void {
  activePlaybackToken++;
  if (pauseTimerId !== null) {
    window.clearTimeout(pauseTimerId);
    pauseTimerId = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  const bridge = typeof window !== 'undefined' ? window.FocoAndroidBridge : undefined;
  if (bridge?.stopSpeaking) {
    try {
      bridge.stopSpeaking();
    } catch {
      // ignore
    }
  }
}

export function speakEnglishText(
  text: string,
  options?: {
    preferredVoiceURI?: string;
    rate?: number;
    pitch?: number;
    onEnd?: () => void;
  }
): void {
  const clean = text.trim();
  if (!clean) {
    options?.onEnd?.();
    return;
  }

  stopAllSpeech();
  const token = activePlaybackToken;
  const rate = options?.rate ?? loadVoicePrefs().rate;
  const voiceURI = options?.preferredVoiceURI ?? loadVoicePrefs().preferredVoiceURI;
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  const bridge = typeof window !== 'undefined' ? window.FocoAndroidBridge : undefined;

  if (synth && (getRankedEnglishVoices().length > 0 || !bridge?.speakText)) {
    const { primary } = pickBestVoices(voiceURI);
    const utter = new SpeechSynthesisUtterance(clean);
    if (primary) {
      utter.voice = primary;
      utter.lang = primary.lang;
    } else {
      utter.lang = 'en-US';
    }
    utter.rate = rate;
    utter.pitch = options?.pitch ?? 1.0;
    utter.onend = () => {
      if (token === activePlaybackToken) options?.onEnd?.();
    };
    utter.onerror = () => {
      if (token === activePlaybackToken) options?.onEnd?.();
    };
    synth.speak(utter);
    return;
  }

  // Native Android WebView TTS fallback
  if (bridge?.speakText) {
    try {
      bridge.speakText(clean, rate);
    } catch {
      // ignore
    }
  }
  options?.onEnd?.();
}

export interface DialogueTurnInput {
  text: string;
  isSelf: boolean;
}

export function playDialogueTurns(
  turns: DialogueTurnInput[],
  options: {
    preferredVoiceURI?: string;
    rate?: number;
    onTurnChange?: (index: number | null) => void;
    onComplete?: () => void;
  }
): void {
  if (turns.length === 0) {
    options.onComplete?.();
    return;
  }

  stopAllSpeech();
  const token = activePlaybackToken;
  const rate = options.rate ?? loadVoicePrefs().rate;
  const voiceURI = options.preferredVoiceURI ?? loadVoicePrefs().preferredVoiceURI;
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  const bridge = typeof window !== 'undefined' ? window.FocoAndroidBridge : undefined;

  if (!synth || (getRankedEnglishVoices().length === 0 && bridge?.speakText)) {
    const joined = turns.map((t) => t.text).join('. ');
    speakEnglishText(joined, { rate, onEnd: options.onComplete });
    return;
  }

  const { primary, secondary } = pickBestVoices(voiceURI);

  const speakAt = (idx: number) => {
    if (token !== activePlaybackToken) return;
    if (idx >= turns.length) {
      options.onTurnChange?.(null);
      options.onComplete?.();
      return;
    }

    const turn = turns[idx];
    options.onTurnChange?.(idx);

    const utter = new SpeechSynthesisUtterance(turn.text);
    const chosenVoice = turn.isSelf ? primary : secondary;
    if (chosenVoice) {
      utter.voice = chosenVoice;
      utter.lang = chosenVoice.lang;
    } else {
      utter.lang = 'en-US';
    }
    utter.rate = rate;
    // Slight subtle pitch distinction if device only has 1 English voice
    utter.pitch =
      primary && secondary && primary.voiceURI === secondary.voiceURI
        ? turn.isSelf
          ? 1.03
          : 0.94
        : 1.0;

    utter.onend = () => {
      if (token !== activePlaybackToken) return;
      pauseTimerId = window.setTimeout(() => speakAt(idx + 1), 320);
    };
    utter.onerror = () => {
      if (token !== activePlaybackToken) return;
      options.onTurnChange?.(null);
      options.onComplete?.();
    };
    window.speechSynthesis.speak(utter);
  };

  speakAt(0);
}
