const store = new Map<string, string>();

const localStorageMock = {
  getItem(key: string) {
    return store.has(key) ? (store.get(key) as string) : null;
  },
  setItem(key: string, value: string) {
    store.set(key, value);
  },
  removeItem(key: string) {
    store.delete(key);
  },
  clear() {
    store.clear();
  },
};

class AudioMock {
  src = '';
  currentTime = 0;
  paused = true;
  volume = 1;
  loop = false;
  preload = 'none';
  oncanplaythrough: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onended: (() => void) | null = null;
  addEventListener() {}
  removeEventListener() {}
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

if (!(globalThis as any).localStorage) {
  (globalThis as any).localStorage = localStorageMock;
}

if (!(globalThis as any).Audio) {
  (globalThis as any).Audio = AudioMock;
}
