import type { LectureVideo } from '../api';

/** Same keys as the previous app, so a student's language / captions choices carry over. */
export const LANGUAGE_KEY = 'cbse_video_language';
export const CAPTIONS_KEYS = { board: 'cbse_video_captions', competitive: 'neet_video_captions' } as const;

export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
export const CONTROLS_HIDE_DELAY_MS = 3000;
/**
 * YouTube flashes its title bar, logo and "More videos" for ~3s after every play / resume / seek. Captions are
 * drawn in that same bottom strip, so they can only be uncropped once playback has settled past that window.
 */
export const YOUTUBE_SETTLE_DELAY_MS = 4500;
/** YouTube picks the quality itself, but still reports what it's playing; shown read-only next to CC. */
export const YOUTUBE_QUALITY_LABELS: Record<string, string> = {
  tiny: '144p',
  small: '240p',
  medium: '360p',
  large: '480p',
  hd720: '720p',
  hd1080: '1080p',
  hd1440: '1440p',
  hd2160: '4K',
  highres: '4K+',
};
export const HEYGEN_POSTER =
  'https://files2.heygen.ai/aws_pacific/avatar_tmp/ed2223f69d044b40829ae934ec52b237/913567c744e047fd825508822ef28cea.jpeg';

/** The video in the student's language (remembered across lectures), else the first one. */
export function pickVideo(videos: LectureVideo[], language: string | null): LectureVideo | null {
  return videos.find((video) => video.language === language) ?? videos[0] ?? null;
}

export const capitalize = (value: string) => (value ? value[0]!.toUpperCase() + value.slice(1) : value);

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatTime(time: number): string {
  if (!Number.isFinite(time) || time < 0) return '0:00';
  const hrs = Math.floor(time / 3600);
  const mins = Math.floor((time % 3600) / 60);
  const secs = Math.floor(time % 60)
    .toString()
    .padStart(2, '0');
  return hrs ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs}` : `${mins}:${secs}`;
}

export function readStorage(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable: the preference just won't persist
  }
}
