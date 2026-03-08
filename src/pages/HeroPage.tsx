import { useEffect, useState } from 'react';
import EarthScene from '@/components/EarthScene';
import HudCorners from '@/components/HudCorners';

interface HeroPageProps {
  onNavigate: (page: string) => void;
}

const HeroPage = ({ onNavigate }: HeroPageProps) => {
  const [satCount, setSatCount] = useState(0);
  const [debrisCount, setDebrisCount] = useState(0);

  useEffect(() => {
    // Count-up animation
    const satTarget = 50;
    const debrisTarget = 10247;
    let frame = 0;
    const totalFrames = 60;
    const interval = setInterval(() => {
      frame++;
      setSatCount(Math.round((frame / totalFrames) * satTarget));
      setDebrisCount(Math.round((frame / totalFrames) * debrisTarget));
      if (frame >= totalFrames) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-background grid-bg page-enter">
      <EarthScene />
      <HudCorners />

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full pointer-events-none">
        <h1 className="font-orbitron text-5xl md:text-7xl font-black tracking-[0.3em] text-primary crt-glow mb-4">
          ORBITAL INSIGHT
        </h1>
        <p className="font-orbitron text-xs md:text-sm tracking-[0.5em] text-muted-foreground mb-12">
          AUTONOMOUS CONSTELLATION MANAGER // NSH 2026
        </p>

        {/* Status indicators */}
        <div className="flex gap-8 mb-12 text-xs tracking-widest">
          <div className="flex items-center gap-2">
            <span className="status-dot status-nominal blink-slow" />
            <span className="crt-glow">SYSTEM ONLINE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="status-dot status-nominal" />
            <span className="crt-glow">TRACKING: {satCount} SATS</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="status-dot status-warning" />
            <span className="crt-glow-warning text-secondary">DEBRIS OBJECTS: {debrisCount.toLocaleString()}+</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 pointer-events-auto">
          <button className="hud-btn" onClick={() => onNavigate('simulation')}>
            ▶ LAUNCH SIMULATION
          </button>
          <button className="hud-btn" onClick={() => onNavigate('dashboard')}>
            ◈ VIEW DASHBOARD
          </button>
        </div>
      </div>
    </div>
  );
};

export default HeroPage;
