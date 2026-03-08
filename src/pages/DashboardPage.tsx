import { useState, useEffect } from 'react';
import HudCorners from '@/components/HudCorners';

interface DashboardPageProps {
  onNavigate: (page: string) => void;
}

const statuses = ['NOMINAL', 'NOMINAL', 'NOMINAL', 'NOMINAL', 'NOMINAL', 'WARNING', 'NOMINAL', 'CRITICAL', 'NOMINAL', 'NOMINAL'] as const;

const initSats = () => Array.from({ length: 10 }, (_, i) => ({
  id: `SAT-${String(i + 1).padStart(3, '0')}`,
  status: statuses[i] as string,
  fuel: 30 + Math.random() * 70,
  lastManeuver: `${Math.floor(Math.random() * 24)}h ${Math.floor(Math.random() * 60)}m ago`,
}));

const groundStations = [
  { name: 'GOLDSTONE', x: 18, y: 42 },
  { name: 'CANBERRA', x: 78, y: 72 },
  { name: 'MADRID', x: 48, y: 38 },
  { name: 'SVALBARD', x: 52, y: 15 },
  { name: 'HAWAII', x: 12, y: 48 },
  { name: 'SINGAPORE', x: 70, y: 55 },
];

const DashboardPage = ({ onNavigate }: DashboardPageProps) => {
  const [sats, setSats] = useState(initSats);
  const [metrics, setMetrics] = useState({ collisions: 0, deltaV: 0, uptime: 99.97, warnings: 3 });
  const [maneuverData, setManeuverData] = useState(() =>
    Array.from({ length: 5 }, (_, i) => ({
      id: `SAT-${String(i + 1).padStart(3, '0')}`,
      burns: Array.from({ length: 3 }, () => ({
        start: Math.random() * 60,
        duration: 2 + Math.random() * 5,
        cooldown: 10,
      })),
    }))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSats(prev => prev.map(s => ({
        ...s,
        fuel: Math.max(5, s.fuel - Math.random() * 0.5),
        status: Math.random() > 0.92 ? (Math.random() > 0.5 ? 'WARNING' : 'NOMINAL') : s.status,
      })));
      setMetrics(prev => ({
        collisions: prev.collisions + (Math.random() > 0.8 ? 1 : 0),
        deltaV: prev.deltaV + Math.random() * 0.1,
        uptime: Math.max(99.5, prev.uptime - Math.random() * 0.01),
        warnings: Math.floor(1 + Math.random() * 7),
      }));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const fuelColor = (f: number) => f > 60 ? 'hsl(152 100% 50%)' : f > 30 ? 'hsl(40 100% 50%)' : 'hsl(0 85% 55%)';
  const statusClass = (s: string) => s === 'NOMINAL' ? 'crt-glow' : s === 'WARNING' ? 'crt-glow-warning text-secondary blink-slow' : 'crt-glow-destructive text-destructive blink';

  // Conjunction data for polar chart
  const conjunctions = Array.from({ length: 12 }, () => ({
    angle: Math.random() * 360,
    distance: 0.2 + Math.random() * 0.8,
    color: Math.random() > 0.7 ? '#ff2a2a' : Math.random() > 0.4 ? '#ffb300' : '#00ff88',
  }));

  return (
    <div className="fixed inset-0 bg-background grid-bg page-enter overflow-auto">
      <HudCorners />

      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 border-b border-border bg-background/95">
        <button className="hud-btn text-[10px] py-2 px-4" onClick={() => onNavigate('hero')}>◁ BACK</button>
        <span className="font-orbitron text-xs tracking-[0.4em] crt-glow">ACM DASHBOARD // LIVE</span>
        <span className="text-[10px] text-muted-foreground tracking-widest blink-slow">● CONNECTED</span>
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-[1600px] mx-auto">

        {/* Panel 1: Fleet Status */}
        <div className="hud-panel hud-brackets p-4 md:col-span-2 xl:col-span-2">
          <h2 className="font-orbitron text-xs tracking-[0.3em] text-muted-foreground mb-3">FLEET STATUS</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-4">ID</th>
                  <th className="text-left py-2 pr-4">STATUS</th>
                  <th className="text-left py-2 pr-4">FUEL</th>
                  <th className="text-left py-2">LAST MANEUVER</th>
                </tr>
              </thead>
              <tbody>
                {sats.map(s => (
                  <tr key={s.id} className="border-b border-border/30">
                    <td className="py-2 pr-4 font-orbitron crt-glow">{s.id}</td>
                    <td className={`py-2 pr-4 font-orbitron text-[10px] ${statusClass(s.status)}`}>{s.status}</td>
                    <td className="py-2 pr-4 w-32">
                      <div className="fuel-bar">
                        <div className="fuel-bar-fill" style={{ width: `${s.fuel}%`, background: fuelColor(s.fuel) }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{s.fuel.toFixed(0)}%</span>
                    </td>
                    <td className="py-2 text-muted-foreground">{s.lastManeuver}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel 4: System Metrics */}
        <div className="hud-panel hud-brackets p-4">
          <h2 className="font-orbitron text-xs tracking-[0.3em] text-muted-foreground mb-3">SYSTEM METRICS</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'COLLISIONS AVOIDED', value: metrics.collisions, glow: 'crt-glow' },
              { label: 'TOTAL ΔV (m/s)', value: metrics.deltaV.toFixed(2), glow: 'crt-glow' },
              { label: 'FLEET UPTIME', value: `${metrics.uptime.toFixed(2)}%`, glow: 'crt-glow' },
              { label: 'ACTIVE WARNINGS', value: metrics.warnings, glow: metrics.warnings > 4 ? 'crt-glow-warning' : 'crt-glow' },
            ].map(m => (
              <div key={m.label} className="hud-panel p-3 text-center">
                <div className={`font-orbitron text-xl ${m.glow} ${m.label === 'ACTIVE WARNINGS' && metrics.warnings > 4 ? 'text-secondary' : ''}`}>
                  {m.value}
                </div>
                <div className="text-[9px] text-muted-foreground tracking-widest mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 2: Conjunction Bullseye */}
        <div className="hud-panel hud-brackets p-4">
          <h2 className="font-orbitron text-xs tracking-[0.3em] text-muted-foreground mb-3">CONJUNCTION BULLSEYE</h2>
          <svg viewBox="0 0 200 200" className="w-full max-w-[250px] mx-auto">
            {/* Rings */}
            {[80, 60, 40, 20].map(r => (
              <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#00ff8833" strokeWidth="0.5" />
            ))}
            {/* Cross */}
            <line x1="100" y1="20" x2="100" y2="180" stroke="#00ff8822" strokeWidth="0.5" />
            <line x1="20" y1="100" x2="180" y2="100" stroke="#00ff8822" strokeWidth="0.5" />
            {/* Debris approach vectors */}
            {conjunctions.map((c, i) => {
              const rad = (c.angle * Math.PI) / 180;
              const dist = c.distance * 75;
              const x = 100 + Math.cos(rad) * dist;
              const y = 100 + Math.sin(rad) * dist;
              return (
                <g key={i}>
                  <line x1="100" y1="100" x2={x} y2={y} stroke={c.color} strokeWidth="0.5" opacity="0.4" />
                  <circle cx={x} cy={y} r="3" fill={c.color} opacity="0.8" />
                </g>
              );
            })}
            <circle cx="100" cy="100" r="4" fill="#00ff88" />
          </svg>
          <div className="flex justify-center gap-4 mt-2 text-[9px] text-muted-foreground">
            <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: '#00ff88' }} />SAFE</span>
            <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: '#ffb300' }} />CAUTION</span>
            <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: '#ff2a2a' }} />DANGER</span>
          </div>
        </div>

        {/* Panel 3: Maneuver Timeline */}
        <div className="hud-panel hud-brackets p-4">
          <h2 className="font-orbitron text-xs tracking-[0.3em] text-muted-foreground mb-3">MANEUVER TIMELINE</h2>
          <div className="space-y-2">
            {maneuverData.map(sat => (
              <div key={sat.id} className="flex items-center gap-2">
                <span className="text-[10px] font-orbitron crt-glow w-16 shrink-0">{sat.id}</span>
                <div className="relative h-4 flex-1 bg-muted/30 rounded-sm overflow-hidden">
                  {sat.burns.map((b, i) => (
                    <div key={i}>
                      {/* Burn window */}
                      <div
                        className="absolute h-full rounded-sm"
                        style={{
                          left: `${(b.start / 80) * 100}%`,
                          width: `${(b.duration / 80) * 100}%`,
                          background: 'hsl(152 100% 50% / 0.7)',
                        }}
                      />
                      {/* Cooldown */}
                      <div
                        className="absolute h-full rounded-sm"
                        style={{
                          left: `${((b.start + b.duration) / 80) * 100}%`,
                          width: `${(b.cooldown / 80) * 100}%`,
                          background: 'hsl(40 100% 50% / 0.25)',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-[9px] text-muted-foreground">
            <span><span className="inline-block w-3 h-2 rounded-sm mr-1" style={{ background: 'hsl(152 100% 50% / 0.7)' }} />BURN</span>
            <span><span className="inline-block w-3 h-2 rounded-sm mr-1" style={{ background: 'hsl(40 100% 50% / 0.25)' }} />COOLDOWN</span>
          </div>
        </div>

        {/* Panel 5: Ground Station Coverage */}
        <div className="hud-panel hud-brackets p-4">
          <h2 className="font-orbitron text-xs tracking-[0.3em] text-muted-foreground mb-3">GROUND STATION COVERAGE</h2>
          <svg viewBox="0 0 100 60" className="w-full">
            {/* Simplified continents */}
            <rect x="15" y="20" width="18" height="25" rx="2" fill="none" stroke="#00ff8833" strokeWidth="0.5" />
            <rect x="38" y="15" width="22" height="20" rx="2" fill="none" stroke="#00ff8833" strokeWidth="0.5" />
            <rect x="60" y="18" width="15" height="18" rx="2" fill="none" stroke="#00ff8833" strokeWidth="0.5" />
            <rect x="42" y="38" width="12" height="15" rx="2" fill="none" stroke="#00ff8833" strokeWidth="0.5" />
            <rect x="72" y="38" width="14" height="18" rx="2" fill="none" stroke="#00ff8833" strokeWidth="0.5" />
            <rect x="5" y="25" width="8" height="10" rx="1" fill="none" stroke="#00ff8833" strokeWidth="0.5" />
            {/* Stations */}
            {groundStations.map(gs => (
              <g key={gs.name}>
                <circle cx={gs.x} cy={gs.y} r="8" fill="none" stroke="#00ff8844" strokeWidth="0.3" strokeDasharray="2 1" />
                <circle cx={gs.x} cy={gs.y} r="1.5" fill="#00ff88" className="pulse-glow" />
                <text x={gs.x} y={gs.y + 5} textAnchor="middle" fill="#00ff88" fontSize="2.5" fontFamily="'Share Tech Mono'">{gs.name}</text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
