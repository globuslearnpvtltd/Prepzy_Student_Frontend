/** Institute feature restrictions: the catalog, the access query and the dialog store. Screens and locks live in ./ui. */
export { featureAccessApi, toRestricted } from './api';
export {
  featureAccessKeys,
  showFeatureRestricted,
  useFeatureAccess,
  useFeatureGuard,
  useFeatureRestrictedDialog,
  type FeatureAccess,
} from './hooks';
export {
  assessmentFeature,
  featureList,
  isRestrictableFeature,
  RESTRICTABLE_FEATURES,
  RESTRICTED_COPY,
  TEST_TYPE_FEATURE,
  type FeatureKeys,
  type RestrictableFeature,
} from './keys';
