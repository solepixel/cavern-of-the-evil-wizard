import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, Shuffle, Trash2, X } from 'lucide-react';
import { audioService } from '../lib/audioService';
import { DicebearProfile } from '../lib/dicebearAvatar';

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarSrc: string;
  draftAvatarSrc: string;
  hasCustomAvatar: boolean;
  isDirty: boolean;
  onPickRandom: () => void;
  onUsePhoto: (file: File) => void;
  onClearCustom: () => void;
  onApply: () => void;
  dicebearProfile: DicebearProfile;
  onDicebearProfileChange: (profile: DicebearProfile) => void;
}

export default function AvatarPickerModal({
  isOpen,
  onClose,
  currentAvatarSrc,
  draftAvatarSrc,
  onPickRandom,
  onUsePhoto,
  onClearCustom,
  hasCustomAvatar,
  isDirty,
  onApply,
  dicebearProfile,
  onDicebearProfileChange,
}: AvatarPickerModalProps) {
  const hoverUi = () => audioService.playHoverThrottled();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const canUseCamera = useMemo(() => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia), []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setCameraError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = s;
      setStreaming(true);
    } catch (e: any) {
      setCameraError(e?.message ?? 'Camera unavailable.');
      stopStream();
    }
  };

  // Attach the stream only after the <video> exists.
  useEffect(() => {
    if (!streaming) return;
    const v = videoRef.current;
    const s = streamRef.current;
    if (!v || !s) return;
    v.srcObject = s;
    const tryPlay = async () => {
      try {
        await v.play();
      } catch {
        // ignore; user gesture may be required in some browsers
      }
    };
    if (v.readyState >= 2) {
      void tryPlay();
      return;
    }
    const onMeta = () => void tryPlay();
    v.addEventListener('loadedmetadata', onMeta);
    return () => v.removeEventListener('loadedmetadata', onMeta);
  }, [streaming]);

  const takePhoto = async () => {
    const v = videoRef.current;
    if (!v) return;
    const w = v.videoWidth || 640;
    const h = v.videoHeight || 640;
    const side = Math.min(w, h);
    const sx = Math.floor((w - side) / 2);
    const sy = Math.floor((h - side) / 2);
    const c = document.createElement('canvas');
    c.width = side;
    c.height = side;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, sx, sy, side, side, 0, 0, side, side);
    const blob: Blob | null = await new Promise((resolve) => c.toBlob(resolve, 'image/png'));
    if (!blob) return;
    const file = new File([blob], 'avatar.png', { type: 'image/png' });
    onUsePhoto(file);
    stopStream();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto overscroll-y-contain p-3 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 8 }}
            className="relative z-10 my-2 w-full max-w-lg border-4 border-[#35ebeb] bg-[#131313] p-5 sm:my-0 sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black uppercase tracking-widest text-[#ffaaf6]">Avatar</h2>
              </div>
              <button type="button" onMouseEnter={hoverUi} onClick={onClose} className="text-[#35ebeb] hover:text-white" aria-label="Close">
                <X size={22} />
              </button>
            </div>

            <div className="mb-4 border border-[#353535] bg-[#0f0f0f] p-3">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#35ebeb]">Preview</div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-[#353535] bg-[#131313]">
                    <img src={currentAvatarSrc} alt="" className="h-full w-full object-cover" />
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-[#e2e2e2]/60">Current</span>
                </div>
                <div className="h-8 w-px bg-[#353535]" />
                <div className="flex items-center gap-2">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-[#35ebeb] bg-[#131313]">
                    <img src={draftAvatarSrc} alt="" className="h-full w-full object-cover" />
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-[#35ebeb]">Draft</span>
                </div>
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-widest text-[#e2e2e2]/60">
                Current stays until you apply.
              </div>
            </div>

            {!streaming ? (
              <div className="space-y-3">
                <div className="border border-[#353535] bg-[#1b1b1b] p-3">
                  <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#35ebeb]">Dicebear profile</div>
                  <div className="flex gap-2">
                    {(['neutral', 'male', 'female'] as const).map((profile) => (
                      <button
                        key={profile}
                        type="button"
                        onMouseEnter={hoverUi}
                        onClick={() => {
                          audioService.playSound('click');
                          onDicebearProfileChange(profile);
                        }}
                        className={`flex-1 border px-2 py-2 text-[10px] font-black uppercase tracking-widest ${
                          dicebearProfile === profile
                            ? 'border-[#35ebeb] bg-[#35ebeb] text-[#002020]'
                            : 'border-[#353535] text-[#e2e2e2]/80 hover:bg-[#353535]'
                        }`}
                      >
                        {profile}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onMouseEnter={hoverUi}
                  onClick={() => {
                    audioService.playSound('click');
                    onPickRandom();
                  }}
                  className="flex w-full items-center justify-between gap-3 border-2 border-[#35ebeb] bg-[#1b1b1b] px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-[#35ebeb] hover:bg-[#35ebeb] hover:text-[#002020]"
                >
                  <span className="flex items-center gap-2">
                    <Shuffle size={18} /> Random
                  </span>
                  <span className="text-[10px] opacity-70">Dicebear</span>
                </button>

                <button
                  type="button"
                  onMouseEnter={hoverUi}
                  onClick={() => {
                    audioService.playSound('click');
                    if (canUseCamera) startCamera();
                    else fileRef.current?.click();
                  }}
                  className="flex w-full items-center justify-between gap-3 border-2 border-[#ffaaf6] bg-[#1b1b1b] px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-[#ffaaf6] hover:bg-[#ffaaf6] hover:text-[#131313]"
                >
                  <span className="flex items-center gap-2">
                    <Camera size={18} /> Use photo
                  </span>
                  <span className="text-[10px] opacity-70">{canUseCamera ? 'Camera' : 'Upload'}</span>
                </button>

                {hasCustomAvatar && (
                  <button
                    type="button"
                    onMouseEnter={hoverUi}
                    onClick={() => {
                      audioService.playSound('click');
                      onClearCustom();
                    }}
                    className="flex w-full items-center justify-between gap-3 border border-[#353535] bg-transparent px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-[#e2e2e2]/70 hover:bg-[#353535]"
                  >
                    <span className="flex items-center gap-2">
                      <Trash2 size={18} /> Clear photo avatar
                    </span>
                  </button>
                )}

                {cameraError && (
                  <div className="border-l-4 border-[#ffaaf6] bg-[#1b1b1b] p-3 text-[11px] text-[#e2e2e2]/80">
                    {cameraError}
                  </div>
                )}

                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onMouseEnter={hoverUi}
                    onClick={() => {
                      audioService.playSound('click');
                      onApply();
                    }}
                    disabled={!isDirty}
                    className="flex-1 border-2 border-[#35ebeb] py-3 text-xs font-black uppercase tracking-widest text-[#35ebeb] enabled:hover:bg-[#35ebeb] enabled:hover:text-[#002020] disabled:opacity-40"
                  >
                    APPLY CHANGES
                  </button>
                  <button
                    type="button"
                    onMouseEnter={hoverUi}
                    onClick={onClose}
                    className="border border-[#353535] px-4 py-3 text-xs font-black uppercase tracking-widest text-[#e2e2e2]/70 hover:bg-[#353535]"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-hidden border border-[#353535] bg-black">
                  <video ref={videoRef} playsInline muted autoPlay className="h-72 w-full object-cover" />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onMouseEnter={hoverUi}
                    onClick={takePhoto}
                    className="flex-1 border-2 border-[#35ebeb] py-3 text-xs font-black uppercase tracking-widest text-[#35ebeb] hover:bg-[#35ebeb] hover:text-[#002020]"
                  >
                    SNAP
                  </button>
                  <button
                    type="button"
                    onMouseEnter={hoverUi}
                    onClick={stopStream}
                    className="border border-[#353535] px-4 py-3 text-xs font-black uppercase tracking-widest text-[#e2e2e2]/70 hover:bg-[#353535]"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  audioService.playSound('click');
                  onUsePhoto(f);
                }
              }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

