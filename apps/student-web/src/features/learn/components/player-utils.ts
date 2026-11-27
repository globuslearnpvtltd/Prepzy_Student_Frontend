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

interface YouTubeCaptionTrack {
  languageCode?: string;
  languageName?: string;
  displayName?: string;
}

/**
 * Caption languages to try for a lecture language, best first. "Hinglish" lectures are auto-captioned by YouTube
 * as Hindi (spoken Hindi with English terms), else English.
 */
const CAPTION_CODES: Record<string, string[]> = { english: ['en'], hindi: ['hi'], hinglish: ['hi', 'en'] };
const FALLBACK_CAPTION_CODES = ['en', 'hi'];
/** Lectures in these languages always get captions in that language: other captions are translated into it. */
const CAPTION_TARGETS: Record<string, { languageCode: string; languageName: string }> = {
  english: { languageCode: 'en', languageName: 'English' },
  hindi: { languageCode: 'hi', languageName: 'Hindi' },
};

/** One `setOption('captions', 'track', …)` value: a caption language, optionally translated by YouTube. */
export interface CaptionRequest {
  languageCode: string;
  translationLanguage?: { languageCode: string; languageName: string };
}

/**
 * The caption requests to send to YouTube, in order (the best one **last**).
 *
 * Auto-generated captions (most lectures) are never in YouTube's track list and the API never says whether a
 * request worked; a request for captions the video doesn't have is simply ignored, keeping what is shown. So every
 * likely language is requested, the least likely first: the last one the video has wins.
 *
 * An English (or Hindi) lecture always shows English (or Hindi) captions (user, 2026-11-27): the video's own
 * captions in that language win; otherwise its captions in another language are shown translated by YouTube
 * (e.g. a lecture tagged English whose speech YouTube auto-captions as Hindi). Other lectures (Hinglish) show the
 * best available language untranslated: a listed track named like the lecture's language, its codes, English,
 * Hindi, the first listed track.
 */
export function youtubeCaptionRequests(
  api: { getOption?: (module: string, option: string) => unknown },
  videoLanguage?: string | null,
): CaptionRequest[] {
  let list: YouTubeCaptionTrack[] = [];
  try {
    const value = api.getOption?.('captions', 'tracklist');
    if (Array.isArray(value)) list = value as YouTubeCaptionTrack[];
  } catch {
    list = [];
  }
  const wanted = videoLanguage?.trim().toLowerCase() ?? '';
  // A listed track that matches a code (e.g. "en-IN" for "en") is used as listed.
  const listed = (code: string) =>
    list.find((track) => track.languageCode?.toLowerCase().startsWith(code.toLowerCase()))?.languageCode ?? code;
  const target = CAPTION_TARGETS[wanted];
  if (target) {
    const own = listed(target.languageCode);
    const others = [...FALLBACK_CAPTION_CODES.map(listed), ...list.map((track) => track.languageCode)]
      .filter((code): code is string => !!code && code !== own && !code.toLowerCase().startsWith(target.languageCode));
    return [
      ...[...new Set(others)].reverse().map((languageCode) => ({ languageCode, translationLanguage: target })),
      { languageCode: own },
    ];
  }
  const named = list.find((track) =>
    [track.languageName, track.displayName].some((name) => !!wanted && !!name && name.toLowerCase().startsWith(wanted)),
  );
  const best = [
    named?.languageCode,
    ...(CAPTION_CODES[wanted] ?? []),
    ...FALLBACK_CAPTION_CODES,
    list[0]?.languageCode,
  ].filter((code): code is string => !!code);
  return [...new Set(best.map(listed))].reverse().map((languageCode) => ({ languageCode }));
}
