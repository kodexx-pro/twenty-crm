/**
 * @jest-environment-options {"url":"https://app.crm.example.test"}
 */
import { renderHook } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';

import { isMultiWorkspaceEnabledState } from '@/client-config/states/isMultiWorkspaceEnabledState';
import { useIsCurrentLocationOnAWorkspace } from '@/domain-manager/hooks/useIsCurrentLocationOnAWorkspace';
import { useIsCurrentLocationOnDefaultDomain } from '@/domain-manager/hooks/useIsCurrentLocationOnDefaultDomain';
import { domainConfigurationState } from '@/domain-manager/states/domainConfigurationState';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';

const wrapper = ({ children }: { children: ReactNode }) => (
  <JotaiProvider store={jotaiStore}>{children}</JotaiProvider>
);

beforeEach(() => resetJotaiStore());

const configureDomain = (
  frontDomain: string,
  defaultSubdomain = 'app',
  multiWorkspace = true,
) => {
  jotaiStore.set(isMultiWorkspaceEnabledState.atom, multiWorkspace);
  jotaiStore.set(domainConfigurationState.atom, {
    frontDomain,
    defaultSubdomain,
    publicFunctionDomain: undefined,
    serverUrl: `https://${frontDomain}`,
  });
};

const useAuthenticationDomain = () => ({
  ...useIsCurrentLocationOnDefaultDomain(),
  ...useIsCurrentLocationOnAWorkspace(),
});

it('uses global sign-in on the configured bare frontend domain', () => {
  configureDomain('app.crm.example.test');
  const { result } = renderHook(useAuthenticationDomain, { wrapper });
  expect(result.current).toEqual({
    isDefaultDomain: true,
    isOnAWorkspace: false,
  });
});

it('also uses global sign-in on the configured default subdomain', () => {
  configureDomain('crm.example.test');
  const { result } = renderHook(useAuthenticationDomain, { wrapper });
  expect(result.current).toEqual({
    isDefaultDomain: true,
    isOnAWorkspace: false,
  });
});

it('keeps other subdomains on the workspace-specific authentication path', () => {
  configureDomain('crm.example.test', 'portal');
  const { result } = renderHook(useAuthenticationDomain, { wrapper });
  expect(result.current).toEqual({
    isDefaultDomain: false,
    isOnAWorkspace: true,
  });
});

it('does not treat a custom domain as the global sign-in portal', () => {
  configureDomain('other.example.test');
  const { result } = renderHook(useAuthenticationDomain, { wrapper });
  expect(result.current).toEqual({
    isDefaultDomain: false,
    isOnAWorkspace: true,
  });
});

it('preserves workspace authentication in single-workspace mode', () => {
  configureDomain('app.crm.example.test', 'app', false);
  const { result } = renderHook(useAuthenticationDomain, { wrapper });
  expect(result.current).toEqual({
    isDefaultDomain: true,
    isOnAWorkspace: true,
  });
});
