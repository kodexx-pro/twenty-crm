import { styled } from '@linaria/react';
import { Trans } from '@lingui/react/macro';
import { type ReactNode } from 'react';

import { useWorkspaceBypass } from '@/auth/sign-in-up/hooks/useWorkspaceBypass';
import { useIsCurrentLocationOnAWorkspace } from '@/domain-manager/hooks/useIsCurrentLocationOnAWorkspace';
import { themeCssVariables } from 'twenty-ui/theme';

const StyledLinksContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex-wrap: nowrap;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  justify-content: center;
  max-width: 100%;
  text-align: center;
  white-space: nowrap;

  & > a,
  & > button {
    background: none;
    border: none;
    color: ${themeCssVariables.font.color.tertiary};
    cursor: pointer;
    font: inherit;
    padding: 0;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

type FooterNoteProps = {
  secondaryAgreement?: 'privacyPolicy' | 'dataProcessingAgreement';
};

export const FooterNote: (props: FooterNoteProps) => ReactNode = () => {
  const { isOnAWorkspace } = useIsCurrentLocationOnAWorkspace();
  const { shouldOfferBypass, shouldUseBypass, enableBypass } =
    useWorkspaceBypass();

  if (!isOnAWorkspace || !shouldOfferBypass || shouldUseBypass) {
    return null;
  }

  return (
    <StyledLinksContainer>
      <button type="button" onClick={enableBypass}>
        <Trans>Bypass SSO</Trans>
      </button>
    </StyledLinksContainer>
  );
};
