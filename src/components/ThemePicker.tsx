import { useState } from 'react';
import { themes, useTheme } from '@/contexts/ThemeContext';

const ThemePicker = () => {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed top-4 right-20 z-50">
      <button
        onClick={() => setOpen(!open)}
        className="hud-btn text-[10px] py-2 px-3 flex items-center gap-2"
        title="Change theme color"
      >
        <span
          className="w-3 h-3 rounded-full border border-primary"
          style={{ background: `hsl(${theme.primary})`, boxShadow: theme.glow }}
        />
        <span className="hidden md:inline">THEME</span>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 hud-panel hud-brackets p-3 min-w-[200px] bg-background/98 backdrop-blur-sm">
          <div className="text-[9px] text-muted-foreground tracking-[0.3em] mb-3 font-orbitron">
            SELECT COLOR SCHEME
          </div>
          <div className="space-y-1">
            {themes.map(t => (
              <button
                key={t.name}
                onClick={() => { setTheme(t.name); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-xs tracking-widest transition-all group
                  ${theme.name === t.name 
                    ? 'bg-primary/10 border border-primary/30' 
                    : 'hover:bg-muted/50 border border-transparent'}`}
              >
                <span
                  className="w-4 h-4 rounded-full shrink-0 transition-transform group-hover:scale-125"
                  style={{
                    background: `hsl(${t.primary})`,
                    boxShadow: theme.name === t.name ? t.glow : 'none',
                  }}
                />
                <span
                  className="font-orbitron text-[10px]"
                  style={{ color: `hsl(${t.primary})` }}
                >
                  {t.label}
                </span>
                {theme.name === t.name && (
                  <span className="ml-auto text-[8px] tracking-wider" style={{ color: `hsl(${t.primary})` }}>
                    ACTIVE
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-border/30 text-[8px] text-muted-foreground text-center tracking-widest">
            COLORS APPLY GLOBALLY
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemePicker;
