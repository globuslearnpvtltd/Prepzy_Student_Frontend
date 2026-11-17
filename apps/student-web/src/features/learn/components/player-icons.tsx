/** Icons of the lecture video player, drawn exactly as in the previous app's LectureVideoPlayer. */
type IconProps = { className?: string };

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 } as const;

export const PlayIcon = ({ className }: IconProps) => (
  <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const PauseIcon = ({ className }: IconProps) => (
  <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);

export const ReplayIcon = ({ className }: IconProps) => (
  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
    <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
    <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const BackIcon = ({ className }: IconProps) => (
  <svg aria-hidden viewBox="0 0 24 24" {...stroke} className={className}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 5v5h5" />
  </svg>
);

export const ForwardIcon = ({ className }: IconProps) => (
  <svg aria-hidden viewBox="0 0 24 24" {...stroke} className={className}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 5v5h-5" />
  </svg>
);

export const VolumeIcon = ({ muted, className }: IconProps & { muted: boolean }) => (
  <svg aria-hidden viewBox="0 0 24 24" {...stroke} className={className}>
    <path d="M11 5 6 9H2v6h4l5 4V5Z" />
    {muted ? (
      <>
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </>
    ) : (
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    )}
  </svg>
);

export const TranslateIcon = ({ className }: IconProps) => (
  <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
  </svg>
);

export const FullscreenIcon = ({ className }: IconProps) => (
  <svg aria-hidden viewBox="0 0 24 24" {...stroke} className={className}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);

export const ClockIcon = ({ className }: IconProps) => (
  <svg aria-hidden viewBox="0 0 24 24" {...stroke} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" strokeLinecap="round" />
  </svg>
);
