/** Atlas chat logic (cheap to import). The panels live in ./ui. */
export { assistantApi, atlasEndpoints, imageSrc, reviewApi, toAnswer, toAvatar, toConversation, toHistory, toMessage } from './api';
export type { AtlasSurface, ChatMessage, HistoryItem, ReviewContext } from './api';
export { atlasKeys, useAtlasChat, useAtlasHistory, useReviewChat } from './hooks';
export { OPEN_ATLAS_EVENT, openAtlas, useAtlas } from './store';
export { readEvents, readReply, splitFrames, type StreamEvent } from './stream';
