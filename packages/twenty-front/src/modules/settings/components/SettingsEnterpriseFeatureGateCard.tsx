import { billingState } from '@/client-config/states/billingState';
import { SettingsOptionCardContentButton } from '@/settings/components/SettingsOptions/SettingsOptionCardContentButton';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { SettingsPath } from 'twenty-shared/types';
import { IconArrowUp, IconLock } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/primitives/input';
import { Card } from 'twenty-ui/primitives/surfaces';
import { useNavigateSettings } from '~/hooks/useNavigateSettings';

export const SettingsEnterpriseFeatureGateCard = ({
  title,
  description,
  buttonTitle,
}: {
  title: string;
  description: string;
  buttonTitle: string;
}) => {
  const billing = useAtomStateValue(billingState);
  const navigateSettings = useNavigateSettings();

  const isBillingEnabled = billing?.isBillingEnabled ?? false;

  if (!isBillingEnabled) return null;

  return (
    <Card.Root rounded>
      <SettingsOptionCardContentButton
        Icon={IconLock}
        title={title}
        description={description}
        Button={
          <Button
            size="sm"
            startIcon={<IconArrowUp />}
            onClick={() => navigateSettings(SettingsPath.BillingPlans)}
            variant="solid"
            color="accent"
          >
            {buttonTitle}
          </Button>
        }
      />
    </Card.Root>
  );
};
