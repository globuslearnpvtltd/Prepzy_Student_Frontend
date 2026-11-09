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

const COMPETITIVE: Record<string, SubjectArt> = {
  physics: art('neet-physics', 292, 109, 0, { right: 0 }),
  chemistry: art('neet-chemistry', 315, 115, 0, { right: 4 }),
  botany: art('neet-botany', 318, 86, 0, { left: 8 }),
  zoology: art('neet-zoology', 325, 87, 0, { left: 8 }),
};

export function boardSubjectArt(subject: string): SubjectArt {
  return BOARD[subject.trim().toLowerCase()] ?? BOARD_DEFAULT;
}

export function competitiveSubjectArt(subject: string): SubjectArt | null {
  return COMPETITIVE[subject.trim().toLowerCase()] ?? null;
}
