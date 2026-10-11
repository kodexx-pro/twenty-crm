import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsLabContent } from '@/settings/lab/components/SettingsLabContent';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { t } from '@lingui/core/macro';
import { Section } from 'twenty-ui/components/layout';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath } from 'twenty-shared/utils';

export const SettingsCommunity = () => (
  <SettingsPageLayout
    title={t`Community`}
    links={[
      { children: t`Other`, href: getSettingsPath(SettingsPath.Community) },
      { children: t`Community` },
    ]}
  >
    <SettingsPageContainer>
      <Section.Root>
        <Section.Header
          title="Kodexx One"
          description={t`Try our upcoming features. Note they are still in beta. Please bear with us and report any issues you find.`}
        />
        <SettingsLabContent />
      </Section.Root>
    </SettingsPageContainer>
  </SettingsPageLayout>
);
