export type DicebearProfile = 'neutral' | 'male' | 'female';

const DICEBEAR_PROFILE_KEY = 'cavern_avatar_dicebear_profile_v1';

export function loadDicebearProfile(): DicebearProfile {
  try {
    const raw = localStorage.getItem(DICEBEAR_PROFILE_KEY);
    if (raw === 'male' || raw === 'female' || raw === 'neutral') return raw;
  } catch {
    // ignore
  }
  return 'neutral';
}

export function saveDicebearProfile(profile: DicebearProfile) {
  localStorage.setItem(DICEBEAR_PROFILE_KEY, profile);
}

/**
 * Retro GameBoy-ish defaults for Dicebear.
 * We keep this centralized so all UI surfaces (HUD, load modal, picker preview) match.
 */
export function buildDicebearAvatarUrl(seed: string, profile: DicebearProfile): string {
  // Keep classic retro pixel look.
  const style = profile === 'female' ? 'pixel-art-neutral' : 'pixel-art';
  const routeSeed = `${profile}-${seed}`;
  const params = new URLSearchParams({
    seed: routeSeed,
    // GameBoy green-ish palette.
    backgroundColor: '0f380f,306230,8bac0f,9bbc0f,c4f0c2',
    radius: '0',
    size: '128',
    scale: '90',
  });

  // Optional hints; unsupported params are ignored by Dicebear, safe to include.
  if (profile === 'male') {
    params.set('beardProbability', '80');
    params.set('hair', 'short01,short02,short03,short04,short05');
  } else if (profile === 'female') {
    params.set('beardProbability', '0');
    params.set('hair', 'long01,long02,long03,long04,long05,long06,long07');
  } else {
    params.set('beardProbability', '20');
    params.set('hair', 'short01,short02,short03,long01,long02,long03');
  }

  return `https://api.dicebear.com/7.x/${style}/svg?${params.toString()}`;
}

