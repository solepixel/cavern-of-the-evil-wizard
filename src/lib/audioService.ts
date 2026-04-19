const AUDIO_PREFS_KEY = 'cavern_evaw_audio_v2';

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
    return { ambientVolume: 0.3, sfxVolume: 0.3, muted: false, ambientMuted: false, sfxMuted: false };
  try {
    const raw = localStorage.getItem(AUDIO_PREFS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AudioPreferences> & { volume?: number };
      const legacyVolume =
        typeof p.volume === 'number' && !Number.isNaN(p.volume) ? clamp01(p.volume) : undefined;
      const ambientVolume =
        typeof p.ambientVolume === 'number' && !Number.isNaN(p.ambientVolume) ? clamp01(p.ambientVolume) : legacyVolume ?? 0.3;
      const sfxVolume =
        typeof p.sfxVolume === 'number' && !Number.isNaN(p.sfxVolume) ? clamp01(p.sfxVolume) : legacyVolume ?? 0.3;
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
  return { ambientVolume: 0.3, sfxVolume: 0.3, muted: false, ambientMuted: false, sfxMuted: false };
}

export function saveAudioPreferences(prefs: AudioPreferences) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

// Simple Audio Service for retro sounds
class AudioService {
  private ambient: HTMLAudioElement | null = null;
  private ambientVolume: number = 0.3;
  private sfxVolume: number = 0.3;
  private isMuted: boolean = false;
  private isAmbientMuted: boolean = false;
  private isSfxMuted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Calmer, slower-paced ambient track for the start
      this.ambient = new Audio('/assets/audio/bg-music-1-1000_Handz_-_Embers.mp3'); 
      this.ambient.loop = true;
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
    if (this.ambient && !this.isMuted && !this.isAmbientMuted) {
      this.ambient.play().catch(() => console.log('Autoplay blocked'));
    }
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
    return this.isSfxMuted;
  }

  playSound(type: 'click' | 'success' | 'error' | 'item' | 'achievement') {
    if (this.isMuted || this.isSfxMuted) return;
    
    const sounds = {
      click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
      success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
      error: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
      item: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
      achievement: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'
    };

    const audio = new Audio(sounds[type]);
    audio.volume = this.sfxVolume;
    audio.play().catch(() => {});
  }
}

export const audioService = new AudioService();
