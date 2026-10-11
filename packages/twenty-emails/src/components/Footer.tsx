import { type I18n } from '@lingui/core';
import { Container } from 'react-email';
import { ShadowText } from 'src/components/ShadowText';

type FooterProps = { i18n: I18n };

export const Footer = (_props: FooterProps) => (
  <Container style={{ marginTop: '12px' }}>
    <ShadowText>Kodexx One</ShadowText>
  </Container>
);
