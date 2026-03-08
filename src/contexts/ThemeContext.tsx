import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ThemeColors {
  name: string;
  label: string;
  primary: string;       // HSL values only
  primaryHex: string;    // For Three.js / SVG
  glow: string;          // CSS glow string
  glowSoft: string;
}

export const themes: ThemeColors[] = [
  {
    name: 'matrix',
    label: 'MATRIX GREEN',
    primary: '152 100% 50%',
    primaryHex: '#00ff88',
    glow: '0 0 10px hsl(152 100% 50% / 0.5), 0 0 30px hsl(152 100% 50% / 0.2)',
    glowSoft: '0 0 5px hsl(152 100% 50% / 0.8), 0 0 15px hsl(152 100% 50% / 0.4), 0 0 30px hsl(152 100% 50% / 0.2)',
  },
  {
    name: 'cyber',
    label: 'CYBER BLUE',
    primary: '195 100% 50%',
    primaryHex: '#00d4ff',
    glow: '0 0 10px hsl(195 100% 50% / 0.5), 0 0 30px hsl(195 100% 50% / 0.2)',
    glowSoft: '0 0 5px hsl(195 100% 50% / 0.8), 0 0 15px hsl(195 100% 50% / 0.4), 0 0 30px hsl(195 100% 50% / 0.2)',
  },
  {
    name: 'plasma',
    label: 'PLASMA VIOLET',
    primary: '275 100% 65%',
    primaryHex: '#b44dff',
    glow: '0 0 10px hsl(275 100% 65% / 0.5), 0 0 30px hsl(275 100% 65% / 0.2)',
    glowSoft: '0 0 5px hsl(275 100% 65% / 0.8), 0 0 15px hsl(275 100% 65% / 0.4), 0 0 30px hsl(275 100% 65% / 0.2)',
  },
  {
    name: 'ember',
    label: 'EMBER ORANGE',
    primary: '25 100% 55%',
    primaryHex: '#ff7a1a',
    glow: '0 0 10px hsl(25 100% 55% / 0.5), 0 0 30px hsl(25 100% 55% / 0.2)',
    glowSoft: '0 0 5px hsl(25 100% 55% / 0.8), 0 0 15px hsl(25 100% 55% / 0.4), 0 0 30px hsl(25 100% 55% / 0.2)',
  },
  {
    name: 'arctic',
    label: 'ARCTIC WHITE',
    primary: '210 20% 85%',
    primaryHex: '#cdd5de',
    glow: '0 0 10px hsl(210 20% 85% / 0.5), 0 0 30px hsl(210 20% 85% / 0.2)',
    glowSoft: '0 0 5px hsl(210 20% 85% / 0.8), 0 0 15px hsl(210 20% 85% / 0.4), 0 0 30px hsl(210 20% 85% / 0.2)',
  },
  {
    name: 'crimson',
    label: 'CRIMSON RED',
    primary: '0 100% 60%',
    primaryHex: '#ff3333',
    glow: '0 0 10px hsl(0 100% 60% / 0.5), 0 0 30px hsl(0 100% 60% / 0.2)',
    glowSoft: '0 0 5px hsl(0 100% 60% / 0.8), 0 0 15px hsl(0 100% 60% / 0.4), 0 0 30px hsl(0 100% 60% / 0.2)',
  },
];

interface ThemeContextType {
  theme: ThemeColors;
  setTheme: (name: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: themes[0],
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeColors>(themes[0]);

  const setTheme = useCallback((name: string) => {
    const found = themes.find(t => t.name === name);
    if (!found) return;
    setThemeState(found);

    // Apply CSS variables dynamically
    const root = document.documentElement;
    root.style.setProperty('--primary', found.primary);
    root.style.setProperty('--foreground', found.primary);
    root.style.setProperty('--card-foreground', found.primary);
    root.style.setProperty('--accent', found.primary);
    root.style.setProperty('--ring', found.primary);
    root.style.setProperty('--border', found.primary.replace(/50%$/, '20%').replace(/65%$/, '20%').replace(/55%$/, '20%').replace(/85%$/, '30%').replace(/60%$/, '20%'));
    root.style.setProperty('--glow-primary', found.glow);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
