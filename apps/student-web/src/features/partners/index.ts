/** Partners (affiliate) portal logic. Screens live in ./ui. */
export {
  partnerApi,
  partnerBaseUrl,
  partnerClient,
  partnerRoutes,
  toBankDetails,
  toFriends,
  toPartnerTypes,
  toPayouts,
  toProfile,
  toStatement,
  toSummary,
} from './api';
export type {
  BankDetails,
  KycStatus,
  PartnerFriend,
  PartnerProfile,
  PartnerStatementRow,
  PartnerSummary,
  PartnerType,
  Payout,
  PayoutStatus,
} from './api';
export { formatCity, suggestCities } from './cities';
export { arrangement, describeEntry, formatDate, inr, initials, toNameChars, toTenDigits } from './format';
export { partnerKeys, usePartnerLogout } from './hooks';
export { bankDetailsSchema, loginSchema, payoutSchema, signupDetailsSchema, signupSchema } from './schemas';
