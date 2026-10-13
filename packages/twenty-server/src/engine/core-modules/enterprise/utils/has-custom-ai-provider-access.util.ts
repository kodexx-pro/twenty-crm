/* @license Enterprise */

type HasCustomAiProviderAccessArgs = {
  isBillingEnabled: boolean;
  hasValidEnterprisePlan: boolean;
  seatCount: number;
};

// Retain the descriptor contract without imposing upstream license or seat limits.
export const hasCustomAiProviderAccess = (
  _options: HasCustomAiProviderAccessArgs,
): boolean => true;
