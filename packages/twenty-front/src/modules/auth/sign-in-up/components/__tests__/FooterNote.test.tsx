import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FooterNote } from '@/auth/sign-in-up/components/FooterNote';
import { useWorkspaceBypass } from '@/auth/sign-in-up/hooks/useWorkspaceBypass';
import { useIsCurrentLocationOnAWorkspace } from '@/domain-manager/hooks/useIsCurrentLocationOnAWorkspace';

jest.mock('@/auth/sign-in-up/hooks/useWorkspaceBypass');
jest.mock('@/domain-manager/hooks/useIsCurrentLocationOnAWorkspace');

describe('FooterNote on the fork', () => {
  const enableBypass = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    i18n.load('en', {});
    i18n.activate('en');
    jest
      .mocked(useWorkspaceBypass)
      .mockReturnValue({
        shouldOfferBypass: true,
        shouldUseBypass: false,
        enableBypass,
      });
    jest
      .mocked(useIsCurrentLocationOnAWorkspace)
      .mockReturnValue({ isOnAWorkspace: true });
  });

  const renderFooter = () =>
    render(
      <I18nProvider i18n={i18n}>
        <FooterNote secondaryAgreement="dataProcessingAgreement" />
      </I18nProvider>,
    );

  it('does not show Twenty cloud agreements on global sign-up', () => {
    jest
      .mocked(useIsCurrentLocationOnAWorkspace)
      .mockReturnValue({ isOnAWorkspace: false });
    const { container } = renderFooter();
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps the workspace SSO bypass action', async () => {
    renderFooter();
    await userEvent.click(screen.getByRole('button', { name: 'Bypass SSO' }));
    expect(enableBypass).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('hides the bypass action when already enabled', () => {
    jest
      .mocked(useWorkspaceBypass)
      .mockReturnValue({
        shouldOfferBypass: true,
        shouldUseBypass: true,
        enableBypass,
      });
    const { container } = renderFooter();
    expect(container).toBeEmptyDOMElement();
  });
});
