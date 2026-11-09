/** Icons of the live talk screens (same drawings as the previous app). */
type IconProps = { size?: number; strokeWidth?: number; className?: string };

const base = (size: number, strokeWidth: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  className,
});

export const MicIcon = ({ size = 20, strokeWidth = 2.4, className }: IconProps) => (
  <svg {...base(size, strokeWidth, className)}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
  </svg>
);

export const MicStandIcon = ({ size = 20, strokeWidth = 2.2, className }: IconProps) => (
  <svg {...base(size, strokeWidth, className)}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
  </svg>
);

export const MicOffIcon = ({ size = 20, strokeWidth = 2.4, className }: IconProps) => (
  <svg {...base(size, strokeWidth, className)}>
    <path d="M2 2l20 20M9 9v1a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.8M17 16.9A7 7 0 0 1 5 10M12 17v4" />
  </svg>
);

export const MicOffStandIcon = ({ size = 20, strokeWidth = 2.2, className }: IconProps) => (
  <svg {...base(size, strokeWidth, className)}>
    <path d="M2 2l20 20M9 9v1a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.8M17 16.9A7 7 0 0 1 5 10M12 17v5M8 22h8" />
  </svg>
);

export const SpeakerIcon = ({ size = 20, strokeWidth = 2.4, className }: IconProps) => (
  <svg {...base(size, strokeWidth, className)}>
    <path d="M11 5L6 9H2v6h4l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
  </svg>
);

export const DotsIcon = ({ size = 20, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <circle cx="5" cy="12" r="2.2" />
    <circle cx="12" cy="12" r="2.2" />
    <circle cx="19" cy="12" r="2.2" />
  </svg>
);

export const LanguageIcon = ({ size = 22, strokeWidth = 2, className }: IconProps) => (
  <svg {...base(size, strokeWidth, className)}>
    <path d="M4 5h8M8 3v2M10 5c-.8 3.6-3 6.4-6 8M6 9c1.2 1.9 3 3.4 5 4.3" />
    <path d="M12 21l4.5-10L21 21M13.6 17.5h5.8" />
  </svg>
);

export const CheckIcon = ({ size = 20, strokeWidth = 3, className }: IconProps) => (
  <svg {...base(size, strokeWidth, className)}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const HangUpIcon = ({ size = 22, strokeWidth = 2, className }: IconProps) => (
  <svg {...base(size, strokeWidth, className)}>
    <path d="M3 15.5c5-4.7 13-4.7 18 0l-2.3 2.3a1 1 0 0 1-1.3.1l-2.5-1.8a1 1 0 0 1-.4-.9l.2-2a11 11 0 0 0-5.4 0l.2 2a1 1 0 0 1-.4.9l-2.5 1.8a1 1 0 0 1-1.3-.1z" />
  </svg>
);

export const ChevronIcon = ({ size = 24, strokeWidth = 2, className }: IconProps) => (
  <svg {...base(size, strokeWidth, className)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const WarningIcon = ({ size = 30, strokeWidth = 2, className }: IconProps) => (
  <svg {...base(size, strokeWidth, className)}>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </svg>
);

export const InfoIcon = ({ size = 14, strokeWidth = 2.4, className }: IconProps) => (
  <svg {...base(size, strokeWidth, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

export const PlayIcon = ({ size = 18, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <path d="M7 4l13 8-13 8z" />
  </svg>
);

export const PauseIcon = ({ size = 18, strokeWidth = 3, className }: IconProps) => (
  <svg {...base(size, strokeWidth, className)}>
    <path d="M8 5v14M16 5v14" />
  </svg>
);

export const KeyboardIcon = ({ size = 20, strokeWidth = 2, className }: IconProps) => (
  <svg {...base(size, strokeWidth, className)}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01M8 16h8" />
  </svg>
);

export const HeadphonesIcon = ({ size = 22, strokeWidth = 2, className }: IconProps) => (
  <svg {...base(size, strokeWidth, className)}>
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z" />
  </svg>
);

export const WaveformIcon = ({ size = 16, strokeWidth = 2.4, className }: IconProps) => (
  <svg {...base(size, strokeWidth, className)}>
    <path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" />
  </svg>
);
