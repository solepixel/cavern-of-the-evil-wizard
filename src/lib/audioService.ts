// Simple Audio Service for retro sounds
class AudioService {
  private ambient: HTMLAudioElement | null = null;
  private volume: number = 0.3;
  private isMuted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Calmer, slower-paced ambient track for the start
      this.ambient = new Audio('/assets/audio/bg-music-1-1000_Handz_-_Embers.mp3'); 
      this.ambient.loop = true;
      this.ambient.volume = this.volume;
    }
  }

  playAmbient() {
    if (this.ambient && !this.isMuted) {
      this.ambient.play().catch(e => console.log("Autoplay blocked"));
    }
  }

  stopAmbient() {
    this.ambient?.pause();
  }

  setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.ambient) this.ambient.volume = this.volume;
  }

  getVolume() {
    return this.volume;
  }

  adjustVolume(delta: number) {
    this.setVolume(this.volume + delta);
    return this.volume;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.ambient) {
      if (this.isMuted) this.ambient.pause();
      else this.ambient.play();
    }
    return this.isMuted;
  }

  playSound(type: 'click' | 'success' | 'error' | 'item') {
    if (this.isMuted) return;
    
    const sounds = {
      click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
      success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
      error: 'https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3',
      item: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3'
    };

    const audio = new Audio(sounds[type]);
    audio.volume = this.volume;
    audio.play().catch(() => {});
  }
}

export const audioService = new AudioService();
