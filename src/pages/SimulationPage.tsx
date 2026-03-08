import { useState, useEffect, useRef } from 'react';
import EarthScene from '@/components/EarthScene';
import HudCorners from '@/components/HudCorners';

interface SimulationPageProps {
  onNavigate: (page: string) => void;
}

const SimulationPage = ({ onNavigate }: SimulationPageProps) => {
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [warnings, setWarnings] = useState(3);
  const [deltaV, setDeltaV] = useState(0);
  const [selectedSat, setSelectedSat] = useState<{ id: string; fuel: number; status: string; period: number } | null>(null);
  const tickRef = useRef(0);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!pausedRef.current) {
        tickRef.current += speedRef.current;
        setTick(Math.floor(tickRef.current));
        if (Math.random() < 0.1) setWarnings(Math.floor(2 + Math.random() * 6));
        setDeltaV(prev => prev + 0.02 * speedRef.current);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const reset = () => {
    tickRef.current = 0;
    setTick(0);
    setDeltaV(0);
    setWarnings(3);
    setPaused(false);
    setSpeed(1);
  };

  const simTime = new Date(Date.now() + tick * 100);

  return (
    <div className="fixed inset-0 bg-background grid-bg page-enter">
      <EarthScene showSatellites showDebris onSatelliteClick={setSelectedSat} />
      <HudCorners />

      {/* Top bar with enhanced styling */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3 border-b border-border bg-background/85 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="status-dot status-nominal blink-slow" />
          <span className="text-[9px] text-muted-foreground tracking-widest">LIVE</span>
        </div>
        <span className="font-orbitron text-xs tracking-[0.4em] crt-glow">
          SIMULATION RUNNING // TICK: {String(tick).padStart(6, '0')}
        </span>
        <span className="text-[9px] text-muted-foreground tracking-widest">
          {speed}x SPEED
        </span>
      </div>

      {/* Left HUD panel - enhanced */}
      <div className="absolute top-16 left-4 z-20 w-60 space-y-3">
        <div className="hud-panel hud-brackets p-4 bg-background/92 backdrop-blur-sm">
          <div className="text-[9px] text-muted-foreground tracking-[0.3em] mb-3 font-orbitron flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
            TELEMETRY
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-[9px] text-muted-foreground tracking-widest mb-1">SIM TIME (UTC)</div>
              <div className="font-orbitron text-base crt-glow tabular-nums">
                {simTime.toISOString().substring(11, 19)}
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[9px] text-muted-foreground tracking-widest mb-1">CDM WARNINGS</div>
                <div className={`font-orbitron text-2xl font-bold ${warnings > 4 ? 'crt-glow-warning text-secondary' : 'crt-glow'}`}>
                  {warnings}
                </div>
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground tracking-widest mb-1">NOMINAL</div>
                <div className="font-orbitron text-2xl font-bold crt-glow">{50 - warnings}</div>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
            <div>
              <div className="text-[9px] text-muted-foreground tracking-widest mb-1">TOTAL ΔV (m/s)</div>
              <div className="font-orbitron text-lg crt-glow tabular-nums">{deltaV.toFixed(2)}</div>
              <div className="fuel-bar mt-1">
                <div className="fuel-bar-fill" style={{ width: `${Math.min(deltaV * 2, 100)}%`, background: 'hsl(var(--primary))' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Mini orbit diagram */}
        <div className="hud-panel p-3 bg-background/92 backdrop-blur-sm">
          <div className="text-[8px] text-muted-foreground tracking-[0.3em] mb-2 font-orbitron">ORBIT VIEW</div>
          <svg viewBox="0 0 100 100" className="w-full">
            <circle cx="50" cy="50" r="10" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
            <circle cx="50" cy="50" r="25" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.2" strokeDasharray="2 2" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.15" strokeDasharray="2 2" />
            <circle cx="50" cy="50" r="6" fill="currentColor" opacity="0.15" />
            {Array.from({ length: 8 }, (_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const r = 20 + Math.random() * 20;
              return <circle key={i} cx={50 + Math.cos(angle) * r} cy={50 + Math.sin(angle) * r} r="1.5" fill="currentColor" opacity="0.6" />;
            })}
          </svg>
        </div>
      </div>

      {/* Satellite popup - enhanced */}
      {selectedSat && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 hud-panel hud-brackets p-6 bg-background/97 backdrop-blur-md min-w-[280px] animate-scale-in">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="status-dot status-nominal" />
              <span className="font-orbitron text-sm crt-glow">{selectedSat.id}</span>
            </div>
            <button className="text-muted-foreground hover:text-primary text-xs transition-colors w-6 h-6 flex items-center justify-center border border-border/50 rounded-sm hover:border-primary/50" onClick={() => setSelectedSat(null)}>✕</button>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent mb-4" />
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground tracking-widest text-[10px]">STATUS</span>
              <span className={`font-orbitron text-[11px] px-2 py-0.5 rounded-sm ${selectedSat.status === 'NOMINAL' ? 'crt-glow bg-primary/10' : 'crt-glow-warning text-secondary bg-secondary/10'}`}>{selectedSat.status}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground tracking-widest text-[10px]">FUEL REMAINING</span>
              <span className="crt-glow font-orbitron">{selectedSat.fuel}%</span>
            </div>
            <div className="fuel-bar mt-1">
              <div
                className="fuel-bar-fill"
                style={{
                  width: `${selectedSat.fuel}%`,
                  background: selectedSat.fuel > 50 ? 'hsl(152 100% 50%)' : selectedSat.fuel > 20 ? 'hsl(40 100% 50%)' : 'hsl(0 85% 55%)',
                }}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-muted-foreground tracking-widest text-[10px]">ORBITAL PERIOD</span>
              <span className="crt-glow font-orbitron">{selectedSat.period} min</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom controls - enhanced */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-3 py-4 px-6 border-t border-border bg-background/85 backdrop-blur-sm">
        <button className="hud-btn text-[10px]" onClick={() => onNavigate('hero')}>◁ BACK</button>
        <div className="w-px h-6 bg-border/50" />
        <button className={`hud-btn text-[10px] ${paused ? 'hud-btn-warning' : ''}`} onClick={() => setPaused(!paused)}>
          {paused ? '▶ RESUME' : '⏸ PAUSE'}
        </button>
        <button className="hud-btn text-[10px]" onClick={() => setSpeed(s => Math.min(s * 2, 16))}>
          ⏩ {speed}x
        </button>
        <button className="hud-btn hud-btn-warning text-[10px]" onClick={reset}>↺ RESET</button>
      </div>
    </div>
  );
};

export default SimulationPage;
