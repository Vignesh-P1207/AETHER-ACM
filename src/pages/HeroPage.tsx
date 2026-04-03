import { useEffect, useState } from 'react';
import EarthScene from '@/components/EarthScene';
import HudCorners from '@/components/HudCorners';

interface HeroPageProps {
  onNavigate: (page: string) => void;
}

const HeroPage = ({ onNavigate }: HeroPageProps) => {
  const [satCount, setSatCount] = useState(0);
  const [debrisCount, setDebrisCount] = useState(0);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    setTimeout(() => setShowContent(true), 200);
    const satTarget = 50;
    const debrisBase = 10247;
    let frame = 0;
    const totalFrames = 60;
    const interval = setInterval(() => {
      frame++;
      if (frame <= totalFrames) {
        setSatCount(Math.round((frame / totalFrames) * satTarget));
        setDebrisCount(Math.round((frame / totalFrames) * debrisBase));
      } else {
        // Real-time tracking fluctuations
        setDebrisCount(debrisBase + Math.floor(Math.random() * 15) - 5);
      }
    }, 70); // Slightly slower tick so the real-time fluctuations are readable
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-background grid-bg page-enter">
      <EarthScene />
      <HudCorners />

      {/* Radial gradient overlay for depth */}
      <div className="absolute inset-0 z-[2]" style={{
        background: 'radial-gradient(ellipse at center, transparent 30%, hsl(170 100% 2% / 0.7) 70%)',
      }} />

      {/* Content overlay */}
      <div className={`relative z-10 flex flex-col items-center justify-center h-full pointer-events-none transition-all duration-1000 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        
        {/* Decorative top line */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-px bg-gradient-to-r from-transparent to-primary/60" />
          <span className="text-[9px] tracking-[0.6em] text-muted-foreground font-orbitron">◈ NATIONAL SPACE HACKATHON 2026 ◈</span>
          <div className="w-16 h-px bg-gradient-to-l from-transparent to-primary/60" />
        </div>

        <h1 className="font-orbitron text-5xl md:text-8xl font-black tracking-[0.2em] text-primary crt-glow mb-2 text-center leading-tight">
          ORBITAL
          <br />
          <span className="text-3xl md:text-5xl tracking-[0.5em] text-primary/80">INSIGHT</span>
        </h1>

        {/* Decorative line under title */}
        <div className="w-48 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent my-4" />

        <p className="font-orbitron text-[10px] md:text-xs tracking-[0.5em] text-muted-foreground mb-8">
          AUTONOMOUS CONSTELLATION MANAGER
        </p>

        {/* Animated data strip */}
        <div className="w-full max-w-2xl mx-auto mb-10">
          <div className="flex justify-between px-8 py-3 border-y border-primary/20">
            <div className="flex items-center gap-2">
              <span className="status-dot status-nominal blink-slow" />
              <span className="text-[10px] tracking-[0.3em] crt-glow">SYSTEM ONLINE</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="status-dot status-nominal" />
              <span className="text-[10px] tracking-[0.3em] crt-glow">TRACKING: {satCount} SATS</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="status-dot status-warning" />
              <span className="text-[10px] tracking-[0.3em] crt-glow-warning text-secondary">DEBRIS: {debrisCount.toLocaleString()}+</span>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-6 pointer-events-auto">
          <button className="hud-btn group" onClick={() => onNavigate('simulation')}>
            <span className="relative z-10">▶ LAUNCH SIMULATION</span>
            <span className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors" />
          </button>
          <button className="hud-btn group" onClick={() => onNavigate('dashboard')}>
            <span className="relative z-10">◈ VIEW DASHBOARD</span>
            <span className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors" />
          </button>
        </div>

        {/* Bottom decorative element */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <span className="text-[8px] tracking-[0.5em] text-muted-foreground font-orbitron">SCROLL INHIBITED</span>
          <div className="w-px h-6 bg-gradient-to-b from-primary/40 to-transparent" />
        </div>
      </div>
    </div>
  );
};

export default HeroPage;
