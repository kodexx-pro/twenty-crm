import { token } from './token';

const scale = {
  accent1: token({ light: '#f5fcf8', dark: '#101d16' }),
  accent2: token({ light: '#ecfaf2', dark: '#14251b' }),
  accent3: token({ light: '#ddf6e8', dark: '#183222' }),
  accent4: token({ light: '#c8efd9', dark: '#1e412b' }),
  accent5: token({ light: '#a9e5c3', dark: '#245234' }),
  accent6: token({ light: '#85d8a9', dark: '#2b6440' }),
  accent7: token({ light: '#61c78e', dark: '#33794b' }),
  accent8: token({ light: '#38ad71', dark: '#3d925a' }),
  accent9: token({ light: '#238653', dark: '#30a46c' }),
  accent10: token({ light: '#1d7347', dark: '#4cbd82' }),
  accent11: token({ light: '#19633d', dark: '#82dca9' }),
  accent12: token({ light: '#153d2a', dark: '#c4f4d8' }),
};

export const ACCENT_TOKENS = {
  primary: scale.accent5,
  secondary: scale.accent5,
  tertiary: scale.accent3,
  quaternary: scale.accent2,
  accent3570: scale.accent8,
  accent4060: scale.accent8,
  ...scale,
};
