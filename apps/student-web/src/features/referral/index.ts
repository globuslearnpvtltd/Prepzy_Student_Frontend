/** Refer & earn logic. The page lives in ./ui. */
export {
  buildPlanOptions,
  capClause,
  describeEntry,
  findFeaturedPurchase,
  friendCredit,
  inr,
  maskPhone,
  pickExamplePlan,
  rateFor,
  referralApi,
  rewardFor,
  shareLabel,
  shareMessage,
  shareOf,
  shortDate,
  shortLink,
  toFriends,
  toggleNote,
  topperGainNote,
  toRates,
  toStatement,
  toSummary,
} from './api';
export type { EarnRate, Friend, Hub, PlanOption, Reward, StatementRow, Tier } from './api';
export { referralKeys, usePlanOptions, useReferralHub } from './hooks';
