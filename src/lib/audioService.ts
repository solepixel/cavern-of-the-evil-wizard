import type { GameSfxSpec } from '../types';

const AUDIO_PREFS_KEY = 'cavern_evaw_audio_v2';
const DEFAULT_AMBIENT_VOLUME = 0.1;
const DEFAULT_SFX_VOLUME = 0.35;

const AMBIENT_GLOBAL_KEY = '__cavernEvilWizardAmbientAudio__' as const;
export const DEFAULT_AMBIENT_SRC = '/assets/audio/Cavern_of_the_Evil_Wizard_(Intro)-v3.mp3';

/** One shared looping element so HMR / duplicate service instances cannot stack BGM. */
function getSharedAmbientElement(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  const g = window as unknown as Record<string, HTMLAudioElement | undefined>;
  let el = g[AMBIENT_GLOBAL_KEY];
  if (!el) {
    el = new Audio(DEFAULT_AMBIENT_SRC);
    el.loop = true;
    el.preload = 'auto';
    g[AMBIENT_GLOBAL_KEY] = el;
  }
  return el;
}

/** Short UI hover blips — throttled in `playHoverThrottled`. */
let lastHoverPlayMs = 0;
const HOVER_COOLDOWN_MS = 110;

export type AudioPreferences = {
  ambientVolume: number;
  sfxVolume: number;
  muted: boolean;
  ambientMuted: boolean;
  sfxMuted: boolean;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function loadAudioPreferences(): AudioPreferences {
  if (typeof window === 'undefined')
    return {
      ambientVolume: DEFAULT_AMBIENT_VOLUME,
      sfxVolume: DEFAULT_SFX_VOLUME,
      muted: false,
      ambientMuted: false,
      sfxMuted: false,
    };
  try {
    const raw = localStorage.getItem(AUDIO_PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AudioPreferences> & { volume?: number };
      const legacyVolume =
        typeof p.volume === 'number' && !Number.isNaN(p.volume) ? clamp01(p.volume) : undefined;
      const ambientVolume =
        typeof p.ambientVolume === 'number' && !Number.isNaN(p.ambientVolume)
          ? clamp01(p.ambientVolume)
          : legacyVolume ?? DEFAULT_AMBIENT_VOLUME;
      const sfxVolume =
        typeof p.sfxVolume === 'number' && !Number.isNaN(p.sfxVolume)
          ? clamp01(p.sfxVolume)
          : legacyVolume ?? DEFAULT_SFX_VOLUME;
      return {
        ambientVolume,
        sfxVolume,
        muted: Boolean(p.muted),
        ambientMuted: Boolean(p.ambientMuted),
        sfxMuted: Boolean(p.sfxMuted),
      };
    }
  } catch {
    /* ignore */
  }
  return {
    ambientVolume: DEFAULT_AMBIENT_VOLUME,
    sfxVolume: DEFAULT_SFX_VOLUME,
    muted: false,
    ambientMuted: false,
    sfxMuted: false,
  };
}

export function saveAudioPreferences(prefs: AudioPreferences) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

/** Add new keys here — this is the only manifest for playable SFX ids. */
const SFX_URLS: Record<string, string> = {
  click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  error: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
  item: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
  achievement: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
  hover: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  terminal_blip: 'https://assets.mixkit.co/active_storage/sfx/270/270-preview.mp3',
  wood_creak_open: '/assets/audio/mixkit-creaky-door-open-195.wav',
  wood_creak_close: '/assets/audio/mixkit-creaky-closing-wood-door-189.wav',
  metal_clack: 'https://assets.mixkit.co/active_storage/sfx/2184/2184-preview.mp3',
  bone_break: '/assets/audio/mixkit-bone-breaking-with-echo-2937.wav',
  death_rattle: '/assets/audio/mixkit-arcade-space-shooter-dead-notification-272.wav',
  door_unlock: '/assets/audio/706893__gaussthewizard__unlock.wav',
  rattle_noise: '/assets/audio/mixkit-educational-rattle-toy-shaker-2818.wav',
  retrieve_clothing: '/assets/audio/189462__sangtao__clothes.wav',
  // Loop-friendly; used in parents' bedroom until sister is soothed.
  crying_child: '/assets/audio/636956__sergequadrado__child-crying.wav',
};

// Simple Audio Service for retro sounds
class AudioService {
  private ambient: HTMLAudioElement | null = null;
  private loopingSfx: Record<string, HTMLAudioElement> = {};
  /** Last SFX id or chain label for dev debug panel. */
  private lastSfxDebugLabel: string | null = null;
  private ambientVolume: number = DEFAULT_AMBIENT_VOLUME;
  private sfxVolume: number = DEFAULT_SFX_VOLUME;
  private isMuted: boolean = false;
  private isAmbientMuted: boolean = false;
  private isSfxMuted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.ambient = getSharedAmbientElement();
      const prefs = loadAudioPreferences();
      this.ambientVolume = prefs.ambientVolume;
      this.sfxVolume = prefs.sfxVolume;
      this.isMuted = prefs.muted;
      this.isAmbientMuted = prefs.ambientMuted;
      this.isSfxMuted = prefs.sfxMuted;
      this.ambient.volume = this.ambientVolume;
    }
  }

  /** Sync internal state + element from saved prefs (e.g. after hydrate) */
  applyPreferences(prefs: AudioPreferences) {
    this.ambientVolume = clamp01(prefs.ambientVolume);
    this.sfxVolume = clamp01(prefs.sfxVolume);
    this.isMuted = prefs.muted;
    this.isAmbientMuted = prefs.ambientMuted;
    this.isSfxMuted = prefs.sfxMuted;
    if (this.ambient) {
      this.ambient.volume = this.ambientVolume;
      if (this.isMuted || this.isAmbientMuted) this.ambient.pause();
    }
    this.refreshLoopingSfxPlayback();
  }

  getPreferences(): AudioPreferences {
    return {
      ambientVolume: this.ambientVolume,
      sfxVolume: this.sfxVolume,
      muted: this.isMuted,
      ambientMuted: this.isAmbientMuted,
      sfxMuted: this.isSfxMuted,
    };
  }

  getMuted() {
    return this.isMuted;
  }

  getAmbientMuted() {
    return this.isAmbientMuted;
  }

  getSfxMuted() {
    return this.isSfxMuted;
  }

  playAmbient() {
    if (!this.ambient || this.isMuted || this.isAmbientMuted) return;
    // Avoid overlapping decode/play stacks from repeated play() (StrictMode, effects, unlock).
    if (!this.ambient.paused) return;
    this.ambient.play().catch(() => console.log('Autoplay blocked'));
  }

  stopAmbient() {
    this.ambient?.pause();
  }

  setAmbientVolume(val: number) {
    this.ambientVolume = clamp01(val);
    if (this.ambient) this.ambient.volume = this.ambientVolume;
  }

  getAmbientVolume() {
    return this.ambientVolume;
  }

  setSfxVolume(val: number) {
    this.sfxVolume = clamp01(val);
  }

  getSfxVolume() {
    return this.sfxVolume;
  }

  adjustBoth(delta: number) {
    this.setAmbientVolume(this.ambientVolume + delta);
    this.setSfxVolume(this.sfxVolume + delta);
    return { ambientVolume: this.ambientVolume, sfxVolume: this.sfxVolume };
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.ambient) {
      if (this.isMuted || this.isAmbientMuted) this.ambient.pause();
      else this.ambient.play();
    }
    this.refreshLoopingSfxPlayback();
    return this.isMuted;
  }

  toggleAmbientMute() {
    this.isAmbientMuted = !this.isAmbientMuted;
    if (this.ambient) {
      if (this.isMuted || this.isAmbientMuted) this.ambient.pause();
      else this.ambient.play();
    }
    return this.isAmbientMuted;
  }

  toggleSfxMute() {
    this.isSfxMuted = !this.isSfxMuted;
    this.refreshLoopingSfxPlayback();
    return this.isSfxMuted;
  }

  startLoopingSound(id: string) {
    if (this.isMuted || this.isSfxMuted) return;
    const url = SFX_URLS[id];
    if (!url) return;
    const existing = this.loopingSfx[id];
    if (existing && !existing.paused) return;
    const audio = existing ?? new Audio(url);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = this.sfxVolume;
    this.loopingSfx[id] = audio;
    audio.play().catch(() => {
      /* ignore */
    });
  }

  stopLoopingSound(id: string) {
    const audio = this.loopingSfx[id];
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      /* ignore */
    }
    delete this.loopingSfx[id];
  }

  private refreshLoopingSfxPlayback() {
    for (const a of Object.values(this.loopingSfx)) {
      try {
        a.volume = this.sfxVolume;
        if (this.isMuted || this.isSfxMuted) a.pause();
        else if (a.paused) a.play().catch(() => undefined);
      } catch {
        /* ignore */
      }
    }
  }

  playSound(type: GameSfxSpec) {
    if (this.isMuted || this.isSfxMuted) {
      this.lastSfxDebugLabel = '(blocked: muted)';
      return;
    }
    const list = (Array.isArray(type) ? type : [type]) as string[];
    if (list.length) {
      this.lastSfxDebugLabel = list.length > 1 ? list.join(' → ') : list[0];
    }
    this.playSfxChain(list, 0);
  }

  private playSfxChain(ids: string[], index: number) {
    if (index >= ids.length) return;

    const id = ids[index];
    if (ids.length > 1) {
      this.lastSfxDebugLabel = `${ids.join(' → ')} (clip ${index + 1}/${ids.length}: ${id})`;
    } else {
      this.lastSfxDebugLabel = id;
    }
    const url = SFX_URLS[id];
    if (!url) {
      this.playSfxChain(ids, index + 1);
      return;
    }
    const audio = new Audio(url);
    audio.volume = id === 'hover' ? Math.min(1, this.sfxVolume * 0.55) : this.sfxVolume;
    audio.addEventListener('ended', () => this.playSfxChain(ids, index + 1));
    audio.play().catch(() => this.playSfxChain(ids, index + 1));
  }

  /** Dev debug panel: ambient element state + last SFX label. */
  getDebugAudioSnapshot() {
    const el = this.ambient;
    return {
      ambientSrc: DEFAULT_AMBIENT_SRC,
      ambientPaused: el ? el.paused : true,
      ambientCurrentTimeSec: el && !Number.isNaN(el.currentTime) ? el.currentTime : null,
      ambientVolume: this.ambientVolume,
      lastSfx: this.lastSfxDebugLabel,
      preferences: this.getPreferences(),
    };
  }

  /** Throttled hover tick so dense UIs do not spam audio. */
  playHoverThrottled() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastHoverPlayMs < HOVER_COOLDOWN_MS) return;
    lastHoverPlayMs = now;
    this.playSound('hover');
  }
}

export const audioService = new AudioService();
