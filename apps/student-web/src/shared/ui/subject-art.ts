/**
 * Subject illustrations from the previous app (exported to /public/illustrations/subjects) and where each sits on
 * its card: pixel offsets from the card's bottom-right (or bottom-left) corner, as the old cards placed them.
 */
export interface SubjectArt {
  src: string;
  width: number;
  height: number;
  bottom: number;
  right?: number;
  left?: number;
}

const art = (file: string, width: number, height: number, bottom: number, side: { right: number } | { left: number }) => ({
  src: `/illustrations/subjects/${file}.svg`,
  width,
  height,
  bottom,
  ...side,
});

const BOARD: Record<string, SubjectArt> = {
  maths: art('board-maths', 120, 90, 0, { right: 0 }),
  mathematics: art('board-maths', 120, 90, 0, { right: 0 }),
  science: art('board-science', 120, 90, 0, { right: 0 }),
  hindi: art('board-hindi', 170, 90, 0, { right: 0 }),
  english: art('board-english', 150, 90, 0, { right: 0 }),
  'social science': art('board-social-science', 80, 66, 0, { right: 0 }),
  history: art('board-history', 95, 98, 0, { right: 2 }),
  'political science': art('board-political-science', 95, 75, 0, { right: 0 }),
  geography: art('board-geography', 133, 89, 1, { right: 0 }),
  economics: art('board-economics', 118, 74, 0, { right: 0 }),
  sociology: art('board-sociology', 110, 90, 0, { right: 0 }),
  physics: art('board-physics', 118, 98, 0, { right: 0 }),
  'business studies': art('board-business-studies', 126, 53, 0, { right: 0 }),
  commerce: art('board-commerce', 118, 86, 0, { right: 0 }),
  chemistry: art('board-chemistry', 94, 90, 0, { right: 4 }),
  biology: art('board-biology', 118, 95, 0, { right: 0 }),
  accounts: art('board-accounts', 118, 97, 0, { right: 0 }),
  accountancy: art('board-accounts', 118, 97, 0, { right: 0 }),
};

const BOARD_DEFAULT = art('board-default', 126, 90, 0, { right: 0 });

/**
 * Competitive (NEET-style) subject illustrations. The files are colour-free masks: `src` is the resting artwork
 * (shapes at 30% alpha), `hoverSrc` the 1px outline of the same shapes that the previous app drew in orange when the
 * card was hovered. `CompetitiveSubjectArt` paints them with design-token colours.
 */
export interface CompetitiveArt extends SubjectArt {
  hoverSrc: string;
}

const competitiveArt = (file: string, width: number, height: number, side: { right: number } | { left: number }): CompetitiveArt => ({
  ...art(file, width, height, 0, side),
  hoverSrc: `/illustrations/subjects/${file}-hover.svg`,
});

const COMPETITIVE: Record<string, CompetitiveArt> = {
  physics: competitiveArt('neet-physics', 292, 109, { right: 0 }),
  chemistry: competitiveArt('neet-chemistry', 315, 115, { right: 4 }),
  botany: competitiveArt('neet-botany', 318, 86, { left: 8 }),
  zoology: competitiveArt('neet-zoology', 325, 87, { left: 8 }),
};

/** Any other subject: the previous app's default artwork (solid, filled orange and outlined on hover). */
const COMPETITIVE_DEFAULT = competitiveArt('neet-default', 150, 90, { right: 0 });

export function boardSubjectArt(subject: string): SubjectArt {
  return BOARD[subject.trim().toLowerCase()] ?? BOARD_DEFAULT;
}

/** Matched by subject name (case-insensitive, an exam prefix such as "NEET-" ignored), else the default artwork. */
export function competitiveSubjectArt(subject: string): CompetitiveArt {
  const name = subject.trim().toLowerCase();
  return COMPETITIVE[name] ?? COMPETITIVE[name.replace(/^[^-]+-\s*/, '')] ?? COMPETITIVE_DEFAULT;
}
