'use client';

import dynamic from 'next/dynamic';

/** The lecture video player, downloaded only on pages that show one (react-player stays out of the page bundle). */
export const LectureVideoPlayer = dynamic(() => import('./lecture-video-player').then((m) => m.LectureVideoPlayer), {
  ssr: false,
  loading: () => <div aria-busy="true" aria-label="Loading player" className="bg-player-stage h-full w-full rounded-md" />,
});
