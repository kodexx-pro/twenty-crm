import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type * as Router from 'react-router-dom';

import { SettingsEnterpriseFeatureGateCard } from '@/settings/components/SettingsEnterpriseFeatureGateCard';
import { OrganizationAdornment } from '@/settings/enterprise/components/OrganizationAdornment';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { SettingsAdmin } from '~/pages/settings/admin-panel/SettingsAdmin';
import { SettingsEnterprise } from '~/pages/settings/enterprise/SettingsEnterprise';
import { SettingsGeneral } from '~/pages/settings/general/SettingsGeneral';
import { PermissionFlagType } from '~/generated-metadata/graphql';

let mockPermissions = new Set<PermissionFlagType>();
let mockStateValues = {
  isBillingEnabled: false,
  canAccessFullAdminPanel: true,
  canImpersonate: false,
};

jest.mock('@/ui/utilities/state/jotai/hooks/useAtomStateValue', () => ({
  useAtomStateValue: () => mockStateValues,
}));
jest.mock('@/settings/roles/hooks/useHasPermissionFlag', () => ({
  useHasPermissionFlag: (permission: PermissionFlagType) =>
    mockPermissions.has(permission),
}));
jest.mock('@/settings/components/layout/SettingsPageLayout', () => ({
  SettingsPageLayout: ({
    secondaryBar,
    children,
  }: {
    secondaryBar?: ReactNode;
    children: ReactNode;
  }) => (
    <main>
      {secondaryBar}
      {children}
    </main>
  ),
}));
jest.mock('@/settings/components/SettingsPageContainer', () => ({
  SettingsPageContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock('@/settings/components/layout/SettingsTabBar', () => {
  const { Link, useLocation } = jest.requireActual(
    'react-router-dom',
  ) as typeof Router;
  return {
    SettingsTabBar: ({ tabs }: { tabs: { id: string; title: string }[] }) => {
      const location = useLocation();
      return (
        <nav>
          {tabs.map((tab) => (
            <Link key={tab.id} to={{ ...location, hash: tab.id }} role="tab">
              {tab.title}
            </Link>
          ))}
        </nav>
      );
    },
  };
});
jest.mock('@/settings/admin-panel/components/SettingsAdminTabContent', () => ({
  SettingsAdminTabContent: ({ activeTabId }: { activeTabId: string }) => (
    <section aria-label="Instance configuration">{activeTabId}</section>
  ),
}));
jest.mock('@/settings/workspace/components/WorkspaceLogoUploader', () => ({
  WorkspaceLogoUploader: () => null,
}));
jest.mock('@/settings/workspace/components/NameField', () => ({
  NameField: () => <div>Workspace name</div>,
}));
jest.mock('@/settings/domains/components/SettingsWorkspaceDomainCard', () => ({
  SettingsWorkspaceDomainCard: () => null,
}));
jest.mock('@/settings/profile/components/DeleteWorkspace', () => ({
  DeleteWorkspace: () => null,
}));
jest.mock('@/settings/security/components/SettingsSecuritySettings', () => ({
  SettingsSecuritySettings: () => <div>Security configuration</div>,
}));
jest.mock('@/settings/event-logs/components/SettingsLogs', () => ({
  SettingsLogs: () => <div>Workspace logs</div>,
}));
jest.mock('@/workspace-branch/components/SettingsWorkspaceBranches', () => ({
  SettingsWorkspaceBranches: () => (
    <section aria-label="Branch configuration">Branches</section>
  ),
}));

const Location = () => {
  const location = useLocation();
  return (
    <output aria-label="Current location">
      {location.pathname + location.hash}
    </output>
  );
};

const renderPage = (page: ReactNode, entry: string) =>
  render(
    <JotaiProvider store={jotaiStore}>
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={[entry]}>
          {page}
          <Location />
        </MemoryRouter>
      </I18nProvider>
    </JotaiProvider>,
  );

beforeEach(() => {
  resetJotaiStore();
  i18n.loadAndActivate({ locale: 'en', messages: {} });
  mockPermissions = new Set([PermissionFlagType.ROLES]);
  mockStateValues = {
    isBillingEnabled: false,
    canAccessFullAdminPanel: true,
    canImpersonate: false,
  };
});

it('offers a branch tab to role managers even without security permissions', async () => {
  renderPage(<SettingsGeneral />, '/settings/general');
  expect(screen.getByText('Workspace name')).toBeInTheDocument();
  expect(
    screen.queryByRole('region', { name: 'Branch configuration' }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'Branches' }));
  expect(
    screen.getByRole('region', { name: 'Branch configuration' }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Current location')).toHaveTextContent(
    '/settings/general#branches',
  );
});

it('opens branches directly from the link', () => {
  renderPage(<SettingsGeneral />, '/settings/general#branches');
  expect(
    screen.getByRole('region', { name: 'Branch configuration' }),
  ).toBeInTheDocument();
});

it('does not mount branch administration for users without role permissions', () => {
  mockPermissions = new Set([PermissionFlagType.SECURITY]);
  renderPage(<SettingsGeneral />, '/settings/general#branches');
  expect(
    screen.queryByRole('tab', { name: 'Branches' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('region', { name: 'Branch configuration' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Security' })).toBeInTheDocument();
});

it('removes organization activation from the instance tabs', () => {
  renderPage(<SettingsAdmin />, '/settings/admin-panel');
  expect(screen.getByRole('tab', { name: 'General' })).toBeInTheDocument();
  expect(
    screen.queryByRole('tab', { name: 'Organization' }),
  ).not.toBeInTheDocument();
});

it.each(['organization', 'enterprise'])(
  'redirects the obsolete %s tab to instance settings',
  async (tab) => {
    renderPage(<SettingsAdmin />, `/settings/admin-panel#${tab}`);
    await waitFor(() =>
      expect(screen.getByLabelText('Current location')).toHaveTextContent(
        '/settings/admin-panel#general',
      ),
    );
    expect(
      screen.getByRole('region', { name: 'Instance configuration' }),
    ).toHaveTextContent('general');
  },
);

it('replaces the legacy license page with workspace settings', async () => {
  renderPage(<SettingsEnterprise />, '/settings/enterprise');
  await waitFor(() =>
    expect(screen.getByLabelText('Current location')).toHaveTextContent(
      '/settings/general',
    ),
  );
  expect(screen.queryByText('Get Organization Key')).not.toBeInTheDocument();
});

it('does not display license offers or organization badges on self-hosted instances', () => {
  renderPage(
    <>
      <SettingsEnterpriseFeatureGateCard
        title="Organization feature"
        description="Activate a key"
        buttonTitle="Upgrade"
      />
      <OrganizationAdornment />
    </>,
    '/settings/general',
  );
  expect(screen.queryByText('Organization feature')).not.toBeInTheDocument();
  expect(screen.queryByText('Organization')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Upgrade' }),
  ).not.toBeInTheDocument();
});
