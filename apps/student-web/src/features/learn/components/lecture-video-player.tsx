'use client';

import { cx } from '@prepzy/design-system';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import ReactPlayer from 'react-player';
import { track } from '@/shared/analytics/track';
import { resolveVideoSource, type LectureVideo } from '../api';
import {
  BackIcon,
  ClockIcon,
  ForwardIcon,
  FullscreenIcon,
  PauseIcon,
  PlayIcon,
  ReplayIcon,
  TranslateIcon,
  VolumeIcon,
} from './player-icons';
import {
  CAPTIONS_KEYS,
  capitalize,
  CONTROLS_HIDE_DELAY_MS,
  formatTime,
  HEYGEN_POSTER,
  LANGUAGE_KEY,
  pickVideo,
  readStorage,
  SPEED_OPTIONS,
  writeStorage,
  YOUTUBE_QUALITY_LABELS,
  YOUTUBE_SETTLE_DELAY_MS,
  youtubeCaptionRequests,
} from './player-utils';

/** The bits of the YouTube IFrame API the player uses (react-player's YouTube element exposes it as `api`). */
interface YouTubeApi {
  getPlaybackQuality?: () => string;
  loadModule?: (name: string) => void;
  unloadModule?: (name: string) => void;
  getOption?: (module: string, option: string) => unknown;
  setOption?: (module: string, option: string, value: unknown) => void;
  addEventListener?: (event: string, listener: (event: { data: number }) => void) => void;
}

/** The element react-player renders: a `<video>` for files, a `<youtube-video>` custom element for YouTube. */
type MediaElement = HTMLVideoElement & { api?: YouTubeApi | null; webkitEnterFullscreen?: () => void };

type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => void };

/**
 * Per-category differences of the previous app's two players (board LectureVideoPlayer, NEET VideoPlayer).
 * Everything else (controls, crop, keyboard, analytics) is shared.
 */
const VARIANTS = {
  board: {
    captionsKey: CAPTIONS_KEYS.board,
    autoHide: true,
    seekOnMobile: false,
    captionsOnFiles: false,
    minLanguages: 1,
    languageLabelOnMobile: false,
    quality: true,
    frame: 'rounded-md',
  },
  competitive: {
    captionsKey: CAPTIONS_KEYS.competitive,
    autoHide: false,
    seekOnMobile: true,
    captionsOnFiles: true,
    minLanguages: 2,
    languageLabelOnMobile: true,
    quality: false,
    frame:
      'rounded-2xl border-4 border-on-brand/10 shadow-player-frame md:rounded-lg md:border-0 md:ring-1 md:ring-on-brand/10',
  },
} as const;

export type PlayerVariant = keyof typeof VARIANTS;

export interface PlayerAnalytics {
  /** URL slug of the exam (e.g. "cbse"); sent as `exam_id`, as the previous app did. */
  examId: string;
  subject?: string | null;
  chapterName?: string;
  lectureTitle?: string;
}

export interface LectureVideoPlayerProps {
  /** One entry per language; `link` may be a YouTube URL, a direct file URL or a legacy HeyGen id. */
  videos: LectureVideo[];
  title?: string;
  thumbnail?: string | null;
  variant?: PlayerVariant;
  /** Shown instead of the poster until playback starts (NEET's chalkboard backdrop). */
  backdrop?: ReactNode;
  /** Controlled language (NEET). Without `onLanguageChange` the choice is remembered in localStorage. */
  language?: string | null;
  onLanguageChange?: (language: string) => void;
  /** The tutor chat or a live voice call is open: playback pauses and shortcuts are off while it is. */
  chatActive?: boolean;
  /** A modal is open: keyboard shortcuts are off while it is. */
  modalOpen?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  /** A file (HeyGen) video failed to load, so the page can refresh its signed URLs. */
  onError?: () => void;
  analytics?: PlayerAnalytics;
}

/** The previous app's lecture player: custom controls over a cropped YouTube embed or a file video. */
export function LectureVideoPlayer({
  videos,
  title,
  thumbnail,
  variant = 'board',
  backdrop,
  language: controlledLanguage,
  onLanguageChange,
  chatActive = false,
  modalOpen = false,
  onPlay,
  onPause,
  onEnded,
  onError,
  analytics,
}: LectureVideoPlayerProps) {
  const config = VARIANTS[variant];
  const mediaRef = useRef<MediaElement | null>(null);
  const [media, setMedia] = useState<MediaElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const volumeMenuRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [storedLanguage, setStoredLanguage] = useState<string | null>(() => readStorage(LANGUAGE_KEY));
  const controlled = onLanguageChange !== undefined;
  const language = controlled ? (controlledLanguage ?? null) : storedLanguage;
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [showVolumeMenu, setShowVolumeMenu] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [captionsOn, setCaptionsOn] = useState(() => readStorage(config.captionsKey) !== 'off');
  // YouTube reads cc_load_policy only when the embed loads; later toggles go through the captions module.
  const [youtubeConfig] = useState(() => ({
    rel: 0 as const,
    iv_load_policy: 3 as const,
    disablekb: 1 as const,
    fs: 0 as const,
    cc_load_policy: (captionsOn ? 1 : 0) as 0 | 1,
  }));

  const [youtubeSettled, setYoutubeSettled] = useState(false);
  const [youtubeQuality, setYoutubeQuality] = useState<string | null>(null);
  const [youtubePoster, setYoutubePoster] = useState<'maxresdefault' | 'hqdefault'>('maxresdefault');

  const [controlsActive, setControlsActive] = useState(true);
  const [stage, setStage] = useState({ width: 0, height: 0 });

  // Analytics: refs so the unmount handler sees the latest values.
  const analyticsRef = useRef(analytics);
  analyticsRef.current = analytics;
  const playedRef = useRef(0);
  const currentTimeRef = useRef(0);
  const hasStartedRef = useRef(false);
  const milestonesFired = useRef(new Set<number>());

  const currentVideo = pickVideo(videos, language);
  const source = resolveVideoSource(currentVideo?.link);
  const isYoutube = source?.kind === 'youtube';
  const languageOptions = videos.filter((video) => video.language);

  const posterUrl =
    thumbnail ||
    (source?.kind === 'youtube' ? `https://i.ytimg.com/vi/${source.id}/${youtubePoster}.jpg` : HEYGEN_POSTER);

  const attachMedia = useCallback((node: MediaElement | null) => {
    mediaRef.current = node;
    setMedia(node);
  }, []);

  const unsettleYoutube = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = null;
    setYoutubeSettled(false);
  };

  // Call on anything that makes YouTube flash its own UI (play, resume, seek).
  const restartYoutubeSettle = () => {
    unsettleYoutube();
    settleTimer.current = setTimeout(() => setYoutubeSettled(true), YOUTUBE_SETTLE_DELAY_MS);
  };

  // "unknown" before playback (or if YouTube stops reporting it) → just "Auto".
  const readYoutubeQuality = () => {
    if (!isYoutube) return;
    const quality = mediaRef.current?.api?.getPlaybackQuality?.();
    setYoutubeQuality((quality && YOUTUBE_QUALITY_LABELS[quality]) ?? null);
  };

  // Reset per-video state whenever the source changes. A new URL for the same language is the page
  // refreshing an expired signed link, so resume where the student was instead of starting over.
  const prevSource = useRef<{ language?: string; url?: string }>({});
  const resumeAt = useRef(0);
  useEffect(() => {
    const prev = prevSource.current;
    prevSource.current = { language: currentVideo?.language, url: source?.url };
    if (prev.url === undefined || prev.url === source?.url) return;
    const sameLanguage = prev.language === currentVideo?.language;
    resumeAt.current = sameLanguage ? currentTimeRef.current : 0;
    setReady(false);
    setHasStarted(false);
    setEnded(false);
    setBuffering(false);
    setLoadError(false);
    setYoutubePoster('maxresdefault');
    setYoutubeQuality(null);
    unsettleYoutube();
    if (!sameLanguage) {
      setPlayed(0);
      setCurrentTime(0);
      setDuration(0);
      playedRef.current = 0;
      currentTimeRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.url]);

  // Pause while the tutor chat / live voice is open.
  useEffect(() => {
    if (chatActive) setPlaying(false);
  }, [chatActive]);

  // Drive the element: react-player v3 would call play() without handling a rejected promise (autoplay
  // policy, a newer load interrupting it), which must not leave the UI showing "playing".
  useEffect(() => {
    if (!media) return;
    if (playing && !chatActive) {
      if (media.paused !== false) {
        void Promise.resolve(media.play()).catch(() => {
          setPlaying(false);
          setBuffering(false);
          // A link that failed before its error listener was attached still reports the error here.
          if (media.error) handleErrorRef.current();
        });
      }
    } else if (media.paused === false) {
      void Promise.resolve(media.pause()).catch(() => undefined);
    }
  }, [media, playing, chatActive, source?.url, reloadKey]);

  useEffect(() => {
    if (media) media.muted = muted;
  }, [media, muted]);

  // react-player v3 doesn't forward these to the file <video>: no download item, no picture-in-picture.
  useEffect(() => {
    if (!media || source?.kind !== 'file') return;
    media.setAttribute('controlslist', 'nodownload');
    media.disablePictureInPicture = true;
  }, [media, source?.kind]);

  // Size the 16:9 stage to the largest box that fits the wrapper, so the YouTube crop always lines up.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const fitWidth = Math.min(width, (height * 16) / 9);
      setStage({ width: fitWidth, height: (fitWidth * 9) / 16 });
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Show / hide captions on whichever player is underneath: a YouTube embed, or the subtitle tracks of an
  // uploaded file. YouTube ignores loadModule / unloadModule on their own (the CC button did nothing); captions
  // appear only when a caption language is chosen, and disappear when the choice is cleared.
  const applyCaptions = (on: boolean) => {
    const element = mediaRef.current;
    if (!element) return;
    const api = element.api;
    if (api && typeof api.setOption === 'function') {
      try {
        if (on) {
          api.loadModule?.('captions');
          // the best language last: YouTube ignores languages the video has no captions in
          for (const request of youtubeCaptionRequests(api, currentVideo?.language)) {
            api.setOption('captions', 'track', request);
          }
        } else {
          api.setOption('captions', 'track', {});
        }
      } catch {
        // The embed isn't ready yet; this runs again on ready and on play.
      }
      return;
    }
    if (isYoutube) return;
    Array.from(element.textTracks ?? []).forEach((track) => {
      if (track.kind === 'subtitles' || track.kind === 'captions') track.mode = on ? 'showing' : 'hidden';
    });
  };

  useEffect(() => {
    applyCaptions(captionsOn);
    writeStorage(config.captionsKey, captionsOn ? 'on' : 'off');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captionsOn]);

  const handleProgress = () => {
    const element = mediaRef.current;
    if (!element) return;
    const seconds = element.currentTime || 0;
    const total = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : 0;
    const fraction = total ? Math.min(seconds / total, 1) : 0;
    setPlayed(fraction);
    setCurrentTime(seconds);
    playedRef.current = fraction;
    currentTimeRef.current = seconds;
    if (total) setDuration(total);
    // YouTube adapts the quality mid-video.
    readYoutubeQuality();

    const meta = analyticsRef.current;
    if (!meta) return;
    const percent = Math.floor(fraction * 100);
    for (const milestone of [25, 50, 75, 100]) {
      if (percent >= milestone && !milestonesFired.current.has(milestone)) {
        milestonesFired.current.add(milestone);
        track('video_lecture_milestone', {
          milestone_percent: milestone,
          lecture_title: meta.lectureTitle ?? '',
          chapter_name: meta.chapterName ?? '',
          subject: meta.subject ?? null,
        });
      }
    }
    if (fraction >= 0.95 && !milestonesFired.current.has(999)) {
      milestonesFired.current.add(999);
      track('video_lecture_completed', {
        exam_id: meta.examId,
        video_type: 'lecture',
        subject: meta.subject ?? null,
        chapter_name: meta.chapterName ?? '',
        watch_time_seconds: Math.round(seconds),
      });
    }
  };

  useEffect(
    () => () => {
      const meta = analyticsRef.current;
      if (meta && hasStartedRef.current && !milestonesFired.current.has(999)) {
        track('video_lecture_exited', {
          percent_watched: Math.round(playedRef.current * 100),
          exam_id: meta.examId,
          video_type: 'lecture',
          subject: meta.subject ?? null,
          chapter_name: meta.chapterName ?? '',
        });
      }
    },
    [],
  );

  const handlePlay = () => {
    setPlaying(true);
    setHasStarted(true);
    setEnded(false);
    setBuffering(false);
    restartYoutubeSettle();
    // YouTube (re)loads its captions module once playback starts, so re-apply the choice here too.
    applyCaptions(captionsOn);
    onPlay?.();
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      const meta = analyticsRef.current;
      if (meta) {
        track('video_lecture_started', {
          exam_id: meta.examId,
          video_type: 'lecture',
          subject: meta.subject ?? null,
          chapter_name: meta.chapterName ?? '',
          lecture_title: meta.lectureTitle ?? '',
          class_id: null,
        });
      }
    }
  };

  const handlePause = () => {
    setPlaying(false);
    unsettleYoutube();
    onPause?.();
  };

  const handleBuffer = () => {
    setBuffering(true);
    unsettleYoutube();
  };

  // Playback (re)started: at the start, after buffering, after a seek. react-player v3 fires onPlay only once per
  // play, not when YouTube resumes after buffering (v2 did), and YouTube nearly always buffers right after play,
  // so the settle timer must restart here too. Without it the embed stayed cropped and hid the captions.
  const handleResumed = () => {
    setBuffering(false);
    if (!isYoutube) return;
    restartYoutubeSettle();
    // YouTube lists its caption tracks only once the video plays, so pick the track again now.
    applyCaptions(captionsOn);
  };

  const handleBufferRef = useRef(handleBuffer);
  handleBufferRef.current = handleBuffer;
  const handleResumedRef = useRef(handleResumed);
  handleResumedRef.current = handleResumed;

  // YouTube's element reports no "waiting" event, so buffering is read from the IFrame API's state changes.
  const watchedApis = useRef(new WeakSet<object>());
  const handleReady = () => {
    setReady(true);
    applyCaptions(captionsOn);
    const element = mediaRef.current;
    const api = element?.api;
    if (api?.addEventListener && !watchedApis.current.has(api)) {
      watchedApis.current.add(api);
      api.addEventListener('onStateChange', ({ data }) => {
        if (data === 3) handleBufferRef.current();
        else if (data === 1) handleResumedRef.current();
      });
    }
    if (element && resumeAt.current > 0) {
      element.currentTime = resumeAt.current;
      resumeAt.current = 0;
    }
    const total = element?.duration;
    if (total && Number.isFinite(total)) setDuration(total);
  };
  const handleEnded = () => {
    setPlaying(false);
    setEnded(true);
    unsettleYoutube();
    onEnded?.();
  };

  const handleError = () => {
    setPlaying(false);
    setBuffering(false);
    setLoadError(true);
    if (source?.kind === 'file') onError?.();
  };

  const handleErrorRef = useRef(handleError);
  handleErrorRef.current = handleError;

  const replay = () => {
    if (mediaRef.current) mediaRef.current.currentTime = 0;
    setEnded(false);
    setPlaying(true);
  };

  const togglePlay = () => {
    if (!source || loadError) return;
    if (ended) {
      replay();
      return;
    }
    setPlaying((p) => !p);
  };

  const seekBy = (seconds: number) => {
    const element = mediaRef.current;
    if (!element) return;
    const target = Math.max((element.currentTime || 0) + seconds, 0);
    element.currentTime = duration ? Math.min(target, duration) : target;
    if (seconds < 0) setEnded(false);
    if (playing) restartYoutubeSettle();
    handleProgress();
  };

  const seekTo = (fraction: number) => {
    setPlayed(fraction);
    setEnded(false);
    const element = mediaRef.current;
    if (element && duration) element.currentTime = fraction * duration;
    if (playing) restartYoutubeSettle();
  };

  const changeVolume = (value: number) => {
    setVolume(value);
    setMuted(value === 0);
  };

  const toggleFullscreen = () => {
    const doc = document as FullscreenDocument;
    const wrapper = wrapperRef.current as FullscreenElement | null;
    if (wrapper && (doc.fullscreenEnabled || doc.webkitFullscreenEnabled)) {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        if (doc.exitFullscreen) void doc.exitFullscreen().catch(() => undefined);
        else doc.webkitExitFullscreen?.();
      } else if (wrapper.requestFullscreen) {
        void wrapper.requestFullscreen().catch(() => undefined);
      } else {
        wrapper.webkitRequestFullscreen?.();
      }
      return;
    }
    // iPhone Safari has no element fullscreen: fall back to the native video one.
    mediaRef.current?.webkitEnterFullscreen?.();
  };

  const selectLanguage = (value: string) => {
    if (controlled) onLanguageChange(value);
    else {
      setStoredLanguage(value);
      writeStorage(LANGUAGE_KEY, value);
    }
    setShowLanguageMenu(false);
  };

  const retry = () => {
    setReady(false);
    setLoadError(false);
    setReloadKey((k) => k + 1);
  };

  const revealControls = () => {
    setControlsActive(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => setControlsActive(false), CONTROLS_HIDE_DELAY_MS);
  };

  useEffect(
    () => () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const showCaptionsToggle = isYoutube || (config.captionsOnFiles && !!source);

  // Keyboard shortcuts. The handler is re-assigned every render so it sees fresh state, while the
  // listener itself is attached once.
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => undefined);
  keyHandler.current = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (modalOpen || chatActive || !target || event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    // Our own controls keep focus after a click, so keys pressed on them are still player shortcuts,
    // except native keys on the speed menu and sliders.
    if (wrapperRef.current?.contains(target)) {
      if (target.closest('select')) return;
      if (target instanceof HTMLInputElement && key.startsWith('Arrow')) return;
      // Blur first, otherwise Space would also "click" the focused button.
      if (key === ' ' || key === 'k') target.blur();
    } else if (target.closest("input, textarea, select, button, [contenteditable='true']")) {
      return;
    }
    switch (key) {
      case ' ':
      case 'k':
        event.preventDefault();
        togglePlay();
        break;
      case 'ArrowRight':
        event.preventDefault();
        seekBy(10);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        seekBy(-10);
        break;
      case 'm':
        setMuted((m) => !m);
        break;
      case 'f':
        toggleFullscreen();
        break;
      case 'c':
        if (!showCaptionsToggle) return;
        setCaptionsOn((c) => !c);
        break;
      default:
        return;
    }
    revealControls();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => keyHandler.current(event);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) setShowLanguageMenu(false);
      if (!volumeMenuRef.current?.contains(event.target as Node)) setShowVolumeMenu(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const showPoster = !hasStarted || ended;
  // YouTube reports ready once its embed has loaded, so wait for it before offering play. Files only
  // report ready after they start loading, which iOS won't do until play is tapped, so for them only show
  // the loader once playback has been requested.
  const showLoader = !!source && ((isYoutube && !ready) || (playing && (buffering || !hasStarted)));
  const menuOpen = showLanguageMenu || showVolumeMenu;
  const showControls = !config.autoHide || !playing || controlsActive || menuOpen;
  // Uncropping is safe once YouTube's own UI has faded; pausing, seeking or buffering re-crops straight away.
  const cropYoutube = isYoutube && !(captionsOn && playing && youtubeSettled && !buffering && !ended && !chatActive);
  // YouTube also flashes a pause icon in the middle after play / seek; keep our opaque centre button over it.
  const coverYoutubeIcon = isYoutube && !youtubeSettled;
  const remaining = Math.max(duration - currentTime, 0);
  const iconButton = 'text-on-brand/70 hover:text-on-brand transition';

  return (
    <div
      ref={wrapperRef}
      data-testid="lecture-video-player"
      onContextMenu={(event) => event.preventDefault()}
      onPointerMove={revealControls}
      onPointerDown={revealControls}
      // isolate keeps the overlay z-indexes inside the player, so the floating tutor launcher stays on top
      className={cx(
        'group bg-player-stage relative isolate h-full w-full overflow-hidden',
        config.frame,
        !showControls && 'cursor-none',
      )}
    >
      {backdrop ? (
        <div
          aria-hidden
          className={cx('absolute inset-0 transition-opacity duration-700', playing ? 'opacity-0' : 'opacity-100')}
        >
          {backdrop}
        </div>
      ) : (
        showPoster && (
          // Blurred poster fills the letterbox area until playback starts.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
          />
        )
      )}

      {/* 16:9 stage, centred in whatever space the wrapper has */}
      <div ref={frameRef} className="absolute inset-0 flex items-center justify-center">
        <div
          className={cx('relative overflow-hidden', !backdrop && 'bg-player-ink')}
          style={stage.width ? { width: stage.width, height: stage.height } : { width: '100%', height: '100%' }}
        >
          {/* Video layer: never receives pointer events, so YouTube's own hover UI, links and context menu
              can't be reached. For YouTube the iframe is drawn 3x taller than the stage, so its title bar,
              logo and "More videos" strip land in the cropped-off parts (lifted for captions, see above). */}
          {source && (
            <div
              data-testid="video-layer"
              data-cropped={cropYoutube ? 'true' : 'false'}
              className="pointer-events-none absolute left-0 w-full"
              style={cropYoutube ? { top: '-100%', height: '300%' } : { top: 0, height: '100%' }}
            >
              <ReactPlayer
                key={reloadKey}
                ref={attachMedia}
                src={source.url}
                width="100%"
                height="100%"
                controls={false}
                playsInline
                volume={volume}
                playbackRate={playbackRate}
                config={{ youtube: youtubeConfig }}
                onLoadedMetadata={handleReady}
                onPlay={handlePlay}
                onPause={handlePause}
                onEnded={handleEnded}
                onError={handleError}
                onWaiting={handleBuffer}
                onPlaying={handleResumed}
                onDurationChange={() => {
                  const total = mediaRef.current?.duration;
                  if (total && Number.isFinite(total)) setDuration(total);
                }}
                onTimeUpdate={handleProgress}
              />
            </div>
          )}

          {/* Our own poster covers YouTube's cued screen and end screen. With a backdrop (NEET) it is still drawn for
              YouTube: its cued thumbnail inside the 3x-tall cropped iframe would show zoomed in. */}
          {showPoster && (!backdrop || isYoutube) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterUrl}
              alt=""
              onLoad={(event) => {
                // YouTube serves a 120px grey placeholder when there's no maxres thumbnail.
                if (
                  isYoutube &&
                  !thumbnail &&
                  event.currentTarget.naturalWidth > 0 &&
                  event.currentTarget.naturalWidth <= 120
                )
                  setYoutubePoster('hqdefault');
              }}
              onError={() => isYoutube && setYoutubePoster('hqdefault')}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
          )}

          {hasStarted && !playing && !ended && (
            <div className="bg-player-ink/30 pointer-events-none absolute inset-0" />
          )}
        </div>
      </div>

      {/* Full-area tap target: tapping anywhere on the video toggles play */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={togglePlay}
        className="absolute inset-0 z-10 cursor-pointer touch-manipulation bg-transparent"
      />

      {/* Top scrim + duration badge */}
      <div
        className={cx(
          'from-player-ink/60 pointer-events-none absolute inset-x-0 top-0 z-20 h-[96px] bg-linear-to-b to-transparent transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0',
        )}
      >
        {duration > 0 && (
          <div
            data-testid="duration"
            className="bg-player-ink/60 text-on-brand ring-on-brand/10 absolute top-[8px] right-[8px] flex items-center gap-[6px] rounded-full px-[10px] py-[4px] text-[11px] font-medium tabular-nums ring-1 backdrop-blur-sm sm:top-[12px] sm:right-[12px] sm:px-[12px] sm:py-[6px] sm:text-xs"
          >
            <ClockIcon className="size-[12px]" />
            {formatTime(duration)}
          </div>
        )}
      </div>

      {/* Centre state: error, spinner, replay or play / pause */}
      {loadError ? (
        <div className="bg-player-ink/70 text-on-brand absolute inset-0 z-30 flex flex-col items-center justify-center gap-[12px] px-[24px] text-center">
          <p role="alert" className="sm:text-md text-sm font-semibold">
            We couldn&apos;t load this video right now.
          </p>
          <button
            type="button"
            onClick={retry}
            className="bg-on-brand text-player-accent hover:bg-on-brand/90 rounded-full px-[20px] py-[8px] text-xs font-semibold transition"
          >
            Try again
          </button>
        </div>
      ) : showLoader ? (
        // Centred with flex, not translate: animate-spin overwrites transform.
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div
            role="status"
            aria-label="Loading video"
            className="border-on-brand/20 border-t-on-brand shadow-player-spinner h-[56px] w-[56px] animate-spin rounded-full border-[4px] border-solid sm:h-[64px] sm:w-[64px]"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={ended ? 'Replay video' : playing ? 'Pause video' : 'Play video'}
          className={cx(
            'bg-on-brand text-player-accent shadow-player-button absolute top-1/2 left-1/2 z-30 flex h-[64px] w-[64px] -translate-x-1/2 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full transition-all duration-200 hover:scale-105 active:scale-95 sm:h-[80px] sm:w-[80px]',
            menuOpen
              ? 'pointer-events-none opacity-0'
              : playing && !coverYoutubeIcon
                ? 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-90'
                : 'opacity-100',
          )}
        >
          {ended ? (
            <ReplayIcon className="h-[28px] w-[28px] sm:h-[32px] sm:w-[32px]" />
          ) : playing ? (
            <PauseIcon className="h-[28px] w-[28px] sm:h-[32px] sm:w-[32px]" />
          ) : (
            <PlayIcon className="ml-[4px] h-[28px] w-[28px] sm:h-[32px] sm:w-[32px]" />
          )}
        </button>
      )}

      {/* Bottom info + controls panel: the gradient / title area lets taps fall through to the video */}
      <div
        data-testid="controls"
        data-visible={showControls ? 'true' : 'false'}
        className={cx(
          'from-player-ink/85 via-player-ink/50 text-on-brand pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t to-transparent px-[12px] pt-[32px] pb-[12px] transition-opacity duration-300 sm:px-[20px] sm:pt-[40px] sm:pb-[16px]',
          showControls ? 'opacity-100' : 'opacity-0',
          // open menus pop up over the centre button / loader (both z-30)
          menuOpen ? 'z-40' : 'z-20',
        )}
      >
        {title && <h3 className="truncate text-sm font-semibold sm:text-lg">{title}</h3>}

        <div
          className={cx(
            'mt-[8px] flex flex-wrap items-center gap-x-[12px] gap-y-[8px] sm:mt-[12px] sm:gap-[16px]',
            showControls && 'pointer-events-auto',
          )}
        >
          <button
            type="button"
            onClick={togglePlay}
            className="text-on-brand/80 hover:text-on-brand transition"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <PauseIcon className="size-[18px]" /> : <PlayIcon className="size-[18px]" />}
          </button>
          {/* Board: seek buttons are desktop-only; on mobile the progress bar and arrow keys cover seeking. */}
          <button
            type="button"
            onClick={() => seekBy(-10)}
            className={cx(iconButton, !config.seekOnMobile && 'hidden sm:block')}
            aria-label="Back 10 seconds"
          >
            <BackIcon className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => seekBy(10)}
            className={cx(iconButton, !config.seekOnMobile && 'hidden sm:block')}
            aria-label="Forward 10 seconds"
          >
            <ForwardIcon className="size-[18px]" />
          </button>
          <div ref={volumeMenuRef} className="relative flex items-center gap-x-[12px] sm:gap-x-[16px]">
            {/* Desktop: the icon mutes and the inline slider sets volume. Mobile: the icon opens a vertical slider. */}
            <button
              type="button"
              onClick={() => {
                if (window.matchMedia?.('(min-width: 640px)').matches) setMuted((m) => !m);
                else setShowVolumeMenu((v) => !v);
              }}
              className={iconButton}
              aria-label={muted ? 'Unmute' : 'Mute'}
              aria-expanded={showVolumeMenu}
            >
              <VolumeIcon muted={muted || volume === 0} className="size-[18px]" />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step="0.01"
              value={muted ? 0 : volume}
              onChange={(event) => changeVolume(Number(event.target.value))}
              className="bg-on-brand/25 accent-on-brand hidden h-[4px] w-[64px] cursor-pointer appearance-none rounded-full sm:block"
              aria-label="Volume"
              aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
            />
            {showVolumeMenu && (
              <div className="bg-player-ink/90 ring-on-brand/10 absolute bottom-full left-1/2 mb-[10px] flex h-[112px] w-[36px] -translate-x-1/2 items-center justify-center rounded-full ring-1 backdrop-blur-sm sm:hidden">
                {/* A rotated horizontal range: bottom = silent, top = full */}
                <input
                  type="range"
                  min={0}
                  max={1}
                  step="0.01"
                  value={muted ? 0 : volume}
                  onChange={(event) => changeVolume(Number(event.target.value))}
                  className="bg-on-brand/25 accent-on-brand h-[4px] w-[84px] shrink-0 -rotate-90 cursor-pointer touch-none appearance-none rounded-full"
                  aria-label="Volume"
                  aria-orientation="vertical"
                  aria-valuetext={`${Math.round((muted ? 0 : volume) * 100)}%`}
                />
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-[12px] sm:gap-[16px]">
            {languageOptions.length >= config.minLanguages && (
              <div ref={languageMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowLanguageMenu((v) => !v)}
                  aria-label="Choose language"
                  aria-haspopup="menu"
                  aria-expanded={showLanguageMenu}
                  className={cx(iconButton, 'flex items-center gap-[4px]')}
                >
                  <TranslateIcon className="size-[18px]" />
                  <span className={cx('text-xs font-medium', !config.languageLabelOnMobile && 'hidden sm:inline')}>
                    {currentVideo?.language ? capitalize(currentVideo.language) : 'Language'}
                  </span>
                </button>
                {showLanguageMenu && (
                  <ul
                    role="menu"
                    aria-label="Video language"
                    className="bg-player-ink/90 ring-on-brand/10 absolute right-0 bottom-full mb-[8px] min-w-[130px] overflow-hidden rounded-md py-[6px] ring-1 backdrop-blur-sm"
                  >
                    {languageOptions.map((item, index) => (
                      <li key={`${item.language}-${index}`} role="none">
                        <button
                          type="button"
                          role="menuitemradio"
                          aria-checked={item === currentVideo}
                          onClick={() => selectLanguage(item.language)}
                          className={cx(
                            'hover:bg-on-brand/10 block w-full px-[16px] py-[6px] text-left text-xs font-medium transition',
                            item === currentVideo ? 'text-player-active' : 'text-on-brand/85',
                          )}
                        >
                          {capitalize(item.language)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {isYoutube && config.quality && (
              <span
                title="Quality adjusts automatically to your internet speed"
                className="text-on-brand/70 text-[11px] font-medium whitespace-nowrap tabular-nums"
              >
                <span className={youtubeQuality ? 'hidden sm:inline' : ''}>Auto</span>
                {youtubeQuality && (
                  <>
                    <span className="hidden sm:inline"> · </span>
                    {youtubeQuality}
                  </>
                )}
              </span>
            )}

            {showCaptionsToggle && (
              <button
                type="button"
                onClick={() => setCaptionsOn((c) => !c)}
                aria-label={captionsOn ? 'Turn off captions' : 'Turn on captions'}
                aria-pressed={captionsOn}
                className={cx(
                  'rounded-[6px] border-[1px] border-solid px-[6px] py-[2px] text-[11px] leading-none font-bold transition',
                  captionsOn
                    ? 'border-on-brand bg-on-brand text-player-ink'
                    : 'border-on-brand/40 text-on-brand/70 hover:text-on-brand line-through',
                )}
              >
                CC
              </button>
            )}

            <select
              value={playbackRate}
              onChange={(event) => setPlaybackRate(Number(event.target.value))}
              className="bg-player-ink/40 border-on-brand/20 text-on-brand rounded-[6px] border-[1px] border-solid px-[6px] py-[2px] text-xs outline-none"
              aria-label="Playback speed"
            >
              {SPEED_OPTIONS.map((speed) => (
                <option key={speed} value={speed} className="bg-player-ink">
                  {speed}x
                </option>
              ))}
            </select>

            <button type="button" onClick={toggleFullscreen} className={iconButton} aria-label="Toggle fullscreen">
              <FullscreenIcon className="size-[18px]" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div
          className={cx(
            'bg-on-brand/20 relative mt-[12px] h-[6px] w-full rounded-full',
            showControls && 'pointer-events-auto',
          )}
        >
          <div
            className="bg-on-brand pointer-events-none absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${played * 100}%` }}
          />
          <input
            type="range"
            min={0}
            max={0.999999}
            step="any"
            value={played}
            onChange={(event) => seekTo(Number(event.target.value))}
            aria-label="Seek"
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            className="[&::-webkit-slider-thumb]:bg-on-brand [&::-webkit-slider-thumb]:shadow-player-thumb [&::-moz-range-thumb]:bg-on-brand absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-[12px] [&::-moz-range-thumb]:w-[12px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:h-[12px] [&::-webkit-slider-thumb]:w-[12px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>

        <div className="text-on-brand/50 mt-[6px] flex items-center justify-between text-[11px] font-medium tracking-wide uppercase">
          <span>{formatTime(currentTime)} watched</span>
          <span>{formatTime(remaining)} remaining</span>
        </div>
      </div>
    </div>
  );
}

export default LectureVideoPlayer;
