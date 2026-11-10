/** Live voice talk (start / save) responses for visual comparison (spread into MOCKS in mocks.ts). */
const answer = { success: true, message: 'Voice call answer generated', data: { sdp: 'v=0 stub-answer', type: 'answer', pc_id: 'visual' } };
const saved = { success: true, message: 'Voice transcript saved', data: { chat_id: 77, saved: 2 } };

export const VOICE_MOCKS: Record<string, unknown> = Object.fromEntries([
  // previous app
  ...['/api/v1/chat', '/api/neet/chat'].flatMap((base) =>
    ['dashboard', 'lecture', 'post-assessment'].flatMap((kind) => [
      [`${base}/${kind}-voice/start`, answer],
      [`${base}/${kind}-voice/save`, saved],
    ]),
  ),
  // new app (v4): Atlas of each exam and the lecture tutors of the sample courses (board 5, NEET 214)
  ...['/api/v4/chat/board/1/voice/dashboard', '/api/v4/chat/competitive/2/voice/dashboard', '/api/v4/chat/board/1/voice/lectures/5', '/api/v4/chat/competitive/2/voice/lectures/214'].flatMap(
    (base) => [
      [`${base}/start`, answer],
      [`${base}/save`, saved],
    ],
  ),
]);
