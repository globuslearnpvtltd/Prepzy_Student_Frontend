/** Parents portal logic: API, queries and helpers. The screens live in ./ui. */
export { parentsApi } from './api';
export type { Child, Parent } from './api';
export { parentKeys, useChildren, useParent, useParentLogout } from './hooks';
export { buildWeek, formatMinutes, formatSince, initials } from './model';
