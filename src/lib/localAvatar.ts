export type LocalAvatarKind = 'dicebear' | 'photo';

const AVATAR_STORAGE_KEY = 'cavern_local_avatar_v1';

export type StoredLocalAvatar =
  | { kind: 'dicebear'; seed: string }
  | { kind: 'photo'; dataUrl: string };

export function loadLocalAvatar(): StoredLocalAvatar | null {
  try {
    const raw = localStorage.getItem(AVATAR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLocalAvatar;
    if (parsed?.kind === 'dicebear' && typeof parsed.seed === 'string') return parsed;
    if (parsed?.kind === 'photo' && typeof parsed.dataUrl === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveLocalAvatar(next: StoredLocalAvatar) {
  localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(next));
}

export function clearLocalAvatar() {
  localStorage.removeItem(AVATAR_STORAGE_KEY);
}

/**
 * Convert an image to a pixel-art avatar completely locally.
 * - Crop center square
 * - Downscale to a tiny grid
 * - Posterize colors for a “game” look
 * - Upscale with nearest-neighbor to keep pixels crisp
 */
export async function imageToPixelAvatarDataUrl(params: {
  image: HTMLImageElement;
  pixelSize?: number; // small grid size (e.g. 32)
  outputSize?: number; // final output in px (e.g. 128)
  posterizeLevels?: number; // per-channel levels (e.g. 6)
}): Promise<string> {
  const pixelSize = params.pixelSize ?? 32;
  const outputSize = params.outputSize ?? 128;
  const posterizeLevels = Math.max(2, params.posterizeLevels ?? 6);

  const img = params.image;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const side = Math.min(w, h);
  const sx = Math.floor((w - side) / 2);
  const sy = Math.floor((h - side) / 2);

  const tiny = document.createElement('canvas');
  tiny.width = pixelSize;
  tiny.height = pixelSize;
  const tctx = tiny.getContext('2d', { willReadFrequently: true });
  if (!tctx) throw new Error('No canvas context');
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(img, sx, sy, side, side, 0, 0, pixelSize, pixelSize);

  // Simple posterization (fast, deterministic).
  const im = tctx.getImageData(0, 0, pixelSize, pixelSize);
  const d = im.data;
  const step = 255 / (posterizeLevels - 1);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.round(d[i] / step) * step;
    d[i + 1] = Math.round(d[i + 1] / step) * step;
    d[i + 2] = Math.round(d[i + 2] / step) * step;
    // keep alpha
  }
  tctx.putImageData(im, 0, 0);

  const out = document.createElement('canvas');
  out.width = outputSize;
  out.height = outputSize;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('No canvas context');
  octx.imageSmoothingEnabled = false;
  octx.drawImage(tiny, 0, 0, outputSize, outputSize);

  return out.toDataURL('image/png');
}

