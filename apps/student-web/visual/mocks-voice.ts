/** Live voice talk (start / save) responses for visual comparison (spread into MOCKS in mocks.ts). */
const answer = { success: true, message: 'Voice call answer generated', data: { sdp: 'v=0 stub-answer', type: 'answer', pc_id: 'visual' } };
const saved = { success: true, message: 'Voice transcript saved', data: { chat_id: 77, saved: 2 } };

export const VOICE_MOCKS: Record<string, unknown> = Object.fromEntries(
  ['/api/v1/chat', '/api/neet/chat'].flatMap((base) =>
    ['dashboard', 'lecture', 'post-assessment'].flatMap((kind) => [
      [`${base}/${kind}-voice/start`, answer],
      [`${base}/${kind}-voice/save`, saved],
    ]),
  ),
);
