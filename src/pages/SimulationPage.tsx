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

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center py-3 border-b border-border bg-background/80">
        <span className="font-orbitron text-xs tracking-[0.4em] crt-glow">
          SIMULATION RUNNING // TICK: {String(tick).padStart(6, '0')}
        </span>
      </div>

      {/* Left HUD panel */}
      <div className="absolute top-16 left-4 z-20 w-56 hud-panel hud-brackets p-4 space-y-4 bg-background/90">
        <div>
          <div className="text-[10px] text-muted-foreground tracking-widest mb-1">SIM TIME</div>
          <div className="font-orbitron text-sm crt-glow">
            {simTime.toISOString().substring(11, 19)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground tracking-widest mb-1">CDM WARNINGS</div>
          <div className={`font-orbitron text-2xl ${warnings > 4 ? 'crt-glow-warning text-secondary' : 'crt-glow'}`}>
            {warnings}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground tracking-widest mb-1">SATS NOMINAL</div>
          <div className="font-orbitron text-2xl crt-glow">{50 - warnings}</div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground tracking-widest mb-1">TOTAL ΔV (m/s)</div>
          <div className="font-orbitron text-lg crt-glow">{deltaV.toFixed(2)}</div>
        </div>
      </div>

      {/* Satellite popup */}
      {selectedSat && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 hud-panel hud-brackets p-6 bg-background/95 min-w-[250px]">
          <div className="flex justify-between items-center mb-4">
            <span className="font-orbitron text-sm crt-glow">{selectedSat.id}</span>
            <button className="text-muted-foreground hover:text-primary text-xs" onClick={() => setSelectedSat(null)}>✕</button>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">STATUS</span>
              <span className={selectedSat.status === 'NOMINAL' ? 'crt-glow' : 'crt-glow-warning text-secondary'}>{selectedSat.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">FUEL</span>
              <span className="crt-glow">{selectedSat.fuel}%</span>
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
            <div className="flex justify-between mt-2">
              <span className="text-muted-foreground">ORBITAL PERIOD</span>
              <span className="crt-glow">{selectedSat.period} min</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-4 py-4 border-t border-border bg-background/80">
        <button className="hud-btn" onClick={() => onNavigate('hero')}>◁ BACK</button>
        <button className={`hud-btn ${paused ? 'hud-btn-warning' : ''}`} onClick={() => setPaused(!paused)}>
          {paused ? '▶ RESUME' : '⏸ PAUSE'}
        </button>
        <button className="hud-btn" onClick={() => setSpeed(s => Math.min(s * 2, 16))}>
          ⏩ SPEED {speed}x
        </button>
        <button className="hud-btn hud-btn-warning" onClick={reset}>↺ RESET</button>
      </div>
    </div>
  );
};

export default SimulationPage;
