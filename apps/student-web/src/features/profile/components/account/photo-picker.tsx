'use client';

import { useEffect, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import type { Profile } from '../../api';
import { useProfilePhoto } from '../../hooks';
import { Icon, outlineButton, primaryButton, Sheet, SheetIcon, sheetText, sheetTitle, showProfileToast } from '../kit';
import { Avatar } from './profile-card';

const MAX_BYTES = 5 * 1024 * 1024;
const MIN_SIDE = 800;
const RULE = 'Pick a JPG or PNG under 5 MB, at least 800 × 800.';

type SheetState =
  | { step: 'closed' }
  | { step: 'options' }
  | { step: 'uploading'; name: string; size: string; percent: number }
  | { step: 'invalid'; mobileReason: string; desktopReason: string };

export const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const readDimensions = (file: File) =>
  new Promise<{ width: number; height: number } | null>((resolve) => {
    if (typeof URL.createObjectURL !== 'function') return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

/** What is wrong with the file ("14 MB", "a HEIC file", "600 × 600"); null when it is fine. */
export const checkPhoto = async (file: File, dimensions = readDimensions): Promise<string | null> => {
  if (file.size > MAX_BYTES) return formatSize(file.size);
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
    const ext = file.name.includes('.') ? file.name.split('.').pop()?.toUpperCase() : undefined;
    return ext ? `a ${ext} file` : 'not a JPG or PNG';
  }
  const size = await dimensions(file);
  if (!size) return 'not a photo we can open';
  if (size.width < MIN_SIDE || size.height < MIN_SIDE) return `${size.width} × ${size.height}`;
  return null;
};

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

function Option({
  name,
  label,
  danger,
  onClick,
}: {
  name: string;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-account-line flex w-full items-center gap-[14px] border-t py-[14px] text-left"
    >
      <Icon name={name} size={20} />
      <span className={danger ? 'text-danger text-[15px] font-medium' : 'text-account-ink text-[15px] font-medium'}>
        {label}
      </span>
    </button>
  );
}

/**
 * The photo with its pen badge; opens the photo sheet (take / choose / remove). fetch() has no upload progress,
 * so the bar eases towards 90% while the upload runs and fills when it's done.
 */
export function PhotoPicker({ profile, checkFile = checkPhoto }: { profile: Profile; checkFile?: typeof checkPhoto }) {
  const { upload, remove } = useProfilePhoto();
  const [sheet, setSheet] = useState<SheetState>({ step: 'closed' });
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const busy = sheet.step === 'uploading';
  const close = () => {
    if (!busy) setSheet({ step: 'closed' });
  };

  /** Puts the previous photo back: re-uploads it, or removes the new one when there was none. */
  const undo = async (previous: string | null) => {
    try {
      if (!previous) {
        await remove.mutateAsync();
      } else {
        const blob = await fetch(previous).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.blob();
        });
        await upload.mutateAsync({ file: new File([blob], 'profile.jpg', { type: blob.type || 'image/jpeg' }) });
      }
      showProfileToast('Photo restored');
    } catch {
      showProfileToast('Couldn’t undo. Please pick the photo again.', { kind: 'error' });
    }
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const problem = await checkFile(file);
    if (problem) {
      setSheet({
        step: 'invalid',
        mobileReason: `It’s ${problem}. ${RULE}`,
        desktopReason: `${file.name} is ${problem}. ${RULE}`,
      });
      return;
    }

    const previous = profile.picture;
    const base = { step: 'uploading' as const, name: file.name, size: formatSize(file.size) };
    setSheet({ ...base, percent: 0 });
    timer.current = setInterval(
      () =>
        setSheet((s) =>
          s.step === 'uploading'
            ? { ...s, percent: Math.min(90, s.percent + Math.max(1, Math.round((90 - s.percent) / 8))) }
            : s,
        ),
      250,
    );
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await upload.mutateAsync({ file, signal: controller.signal });
      setSheet({ step: 'closed' });
      showProfileToast('Photo updated', { actionLabel: 'Undo', onAction: () => undo(previous) });
    } catch (error) {
      setSheet({ step: 'closed' });
      if (controller.signal.aborted || isAbort(error)) return;
      showProfileToast('Couldn’t upload your photo. Please try again.', { kind: 'error' });
    } finally {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      abortRef.current = null;
    }
  };

  const removePhoto = async () => {
    const previous = profile.picture;
    setSheet({ step: 'closed' });
    try {
      await remove.mutateAsync();
      showProfileToast('Photo updated', { actionLabel: 'Undo', onAction: () => undo(previous) });
    } catch {
      showProfileToast('Couldn’t remove your photo. Please try again.', { kind: 'error' });
    }
  };

  const pick = (input: RefObject<HTMLInputElement | null>) => input.current?.click();

  return (
    <>
      <button
        type="button"
        onClick={() => setSheet({ step: 'options' })}
        disabled={busy}
        aria-label="Change photo"
        title="Change photo"
        className="relative size-[96px] shrink-0 disabled:opacity-60 lg:size-[88px]"
      >
        <span className="lg:hidden">
          <Avatar profile={profile} size={96} />
        </span>
        <span className="hidden lg:block">
          <Avatar profile={profile} size={88} />
        </span>
        <span className="bg-brand border-surface absolute top-[66px] left-[66px] flex size-[32px] items-center justify-center rounded-full border-[3px] lg:top-[60px] lg:left-[60px] lg:size-[30px]">
          <Icon name="pen-badge.svg" size={15} />
        </span>
      </button>

      {/* Camera opens the front camera on phones; desktop browsers ignore capture */}
      <input
        ref={cameraInput}
        type="file"
        accept="image/png,image/jpeg"
        capture="user"
        className="hidden"
        aria-label="Take a photo"
        onChange={handleFile}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        aria-label="Choose a photo"
        onChange={handleFile}
      />

      {sheet.step === 'options' && (
        <Sheet onClose={close} label="Profile photo">
          <div className="contents lg:hidden">
            <p className={sheetTitle}>Profile photo</p>
            <p className="text-neutral-550 text-[12px] leading-normal">JPG or PNG, at least 800 × 800 px.</p>
            <div className="flex w-full flex-col">
              <Option name="photo-camera.svg" label="Take a photo" onClick={() => pick(cameraInput)} />
              <Option name="photo-gallery.svg" label="Choose from gallery" onClick={() => pick(galleryInput)} />
              {profile.picture && <Option name="photo-trash.svg" label="Remove photo" danger onClick={removePhoto} />}
            </div>
            <button type="button" onClick={close} className={outlineButton}>
              Cancel
            </button>
          </div>
          <div className="hidden w-full flex-col items-center gap-[16px] lg:flex">
            <p className={`${sheetTitle} w-full text-center leading-normal`}>Profile photo</p>
            <Avatar profile={profile} size={120} />
            <p className="text-neutral-550 w-full text-center text-[13px] leading-normal">
              JPG or PNG, at least 800 × 800 px. Your photo shows to your Parent / Teacher too.
            </p>
            <div className="flex w-full flex-col gap-[10px] pt-[8px]">
              <button type="button" onClick={() => pick(galleryInput)} className={primaryButton}>
                Upload new photo
              </button>
              {profile.picture && (
                <button
                  type="button"
                  onClick={removePhoto}
                  className="border-account-danger-line bg-surface text-danger hover:bg-danger-soft w-full rounded-full border py-[13px] text-[14px] font-semibold transition-colors"
                >
                  Remove photo
                </button>
              )}
              <button type="button" onClick={close} className={outlineButton}>
                Cancel
              </button>
            </div>
          </div>
        </Sheet>
      )}

      {sheet.step === 'uploading' && (
        <Sheet onClose={() => undefined} label="Uploading your photo">
          <SheetIcon name="photo-upload.svg" tone="info" />
          <p className={`${sheetTitle} leading-[1.5]`}>Uploading your photo</p>
          <div className="flex w-full flex-col gap-[8px]">
            <div className="bg-account-bone h-[8px] w-full overflow-hidden rounded-full">
              <div
                className="bg-brand h-[8px] rounded-full transition-[width]"
                style={{ width: `${sheet.percent}%` }}
              />
            </div>
            <p className="text-neutral-550 truncate text-[12px] leading-[1.5]">{`${sheet.name} · ${sheet.size} · ${sheet.percent}%`}</p>
          </div>
          <div className="w-full pt-[6px]">
            <button type="button" onClick={() => abortRef.current?.abort()} className={outlineButton}>
              Cancel upload
            </button>
          </div>
        </Sheet>
      )}

      {sheet.step === 'invalid' && (
        <Sheet onClose={close} label="This photo can’t be used">
          <SheetIcon name="photo-image-error.svg" tone="error" />
          <p className={`${sheetTitle} leading-[1.5]`}>This photo can’t be used</p>
          <p className={`${sheetText} break-words`}>
            <span className="lg:hidden">{sheet.mobileReason}</span>
            <span className="hidden lg:inline">{sheet.desktopReason}</span>
          </p>
          <div className="flex w-full flex-col gap-[10px] pt-[6px] lg:flex-row-reverse lg:gap-[12px]">
            <button type="button" onClick={() => pick(galleryInput)} className={`${primaryButton} lg:flex-1`}>
              Choose another
            </button>
            <button type="button" onClick={close} className={`${outlineButton} lg:flex-1`}>
              Cancel
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
