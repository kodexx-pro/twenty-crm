import { useQuery } from '@apollo/client/react';
import { useLingui } from '@lingui/react/macro';
import { isDefined } from 'twenty-shared/utils';
import { billingState } from '@/client-config/states/billingState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { useApolloAdminClient } from '@/settings/admin-panel/apollo/hooks/useApolloAdminClient';
import { GET_CUSTOM_AI_PROVIDER_ACCESS } from '@/settings/admin-panel/ai/graphql/queries/getCustomAiProviderAccess';
import { type GetCustomAiProviderAccessResult } from '@/settings/admin-panel/ai/types/GetCustomAiProviderAccessResult';

export const useCustomAiProviderAccess = () => {
  const { t } = useLingui();
  const apolloAdminClient = useApolloAdminClient();
  const billing = useAtomStateValue(billingState);

  const { data, loading } = useQuery<GetCustomAiProviderAccessResult>(
    GET_CUSTOM_AI_PROVIDER_ACCESS,
    { client: apolloAdminClient },
  );

  const access = data?.getCustomAiProviderAccess;

  // Assume access only while loading, so the section never flashes locked; with no answer, creation stays closed.
  const hasAccess = access?.hasAccess ?? loading;

  const tooltipContent = !isDefined(access)
    ? undefined
    : access.hasAccess
      ? t`Custom providers are complimentary for organizations of up to ${access.seatThreshold} seats. Above that, an Organization plan is required.`
      : t`Custom providers are complimentary for organizations of up to ${access.seatThreshold} seats. This instance has ${access.seatCount} seats, so an Organization plan is required.`;

  const gateDescription = !isDefined(access)
    ? t`Could not check custom provider access. Reload the page to try again.`
    : billing?.isBillingEnabled
      ? t`Custom providers are complimentary up to ${access.seatThreshold} seats. This instance has ${access.seatCount}. Upgrade to add more.`
      : t`Custom providers are not enabled for this instance.`;

  return {
    hasAccess,
    tooltipContent,
    gateDescription,
  };
};
