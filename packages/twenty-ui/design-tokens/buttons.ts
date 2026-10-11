import { ACCENT_TOKENS } from './accent';
import { token } from './token';

export const BUTTONS_TOKENS = {
  secondaryTextColor: ACCENT_TOKENS.accent11,
  primaryBackground: token({
    light: 'oklch(0.8348 0.1302 160.9080)',
    dark: 'oklch(0.4365 0.1044 156.7556)',
  }),
  primaryHover: token({
    light: 'oklch(0.7900 0.1302 160.9080)',
    dark: 'oklch(0.4800 0.1044 156.7556)',
  }),
  primaryTextColor: token({
    light: 'oklch(0.2626 0.0147 166.4589)',
    dark: 'oklch(0.9213 0.0135 167.1556)',
  }),
};
