/** Practical palette — muted stone, clear accent. Avoid purple/cream AI defaults. */
const tint = '#0F766E';

export default {
  light: {
    text: '#1C1917',
    textSecondary: '#78716C',
    background: '#F5F5F4',
    surface: '#FFFFFF',
    tint,
    tabIconDefault: '#A8A29E',
    tabIconSelected: tint,
    border: '#E7E5E4',
    danger: '#B91C1C',
  },
  dark: {
    text: '#FAFAF9',
    textSecondary: '#A8A29E',
    background: '#1C1917',
    surface: '#292524',
    tint: '#2DD4BF',
    tabIconDefault: '#78716C',
    tabIconSelected: '#2DD4BF',
    border: '#44403C',
    danger: '#F87171',
  },
};
