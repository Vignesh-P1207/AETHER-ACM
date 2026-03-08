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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [maneuverData] = useState(() =>
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
      setCurrentTime(new Date());
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
  const statusBgClass = (s: string) => s === 'NOMINAL' ? 'bg-primary/10' : s === 'WARNING' ? 'bg-secondary/10' : 'bg-destructive/10';

  const conjunctions = Array.from({ length: 15 }, () => ({
    angle: Math.random() * 360,
    distance: 0.15 + Math.random() * 0.85,
    color: Math.random() > 0.7 ? '#ff2a2a' : Math.random() > 0.4 ? '#ffb300' : '#00ff88',
  }));

  return (
    <div className="fixed inset-0 bg-background grid-bg page-enter overflow-auto">
      <HudCorners />

      {/* Top bar */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
        <button className="hud-btn text-[10px] py-2 px-4" onClick={() => onNavigate('hero')}>◁ BACK</button>
        <div className="flex items-center gap-4">
          <span className="font-orbitron text-xs tracking-[0.4em] crt-glow">ACM DASHBOARD</span>
          <span className="text-[9px] text-muted-foreground font-orbitron tabular-nums">{currentTime.toISOString().substring(11, 19)} UTC</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="status-dot status-nominal blink-slow" />
          <span className="text-[9px] text-muted-foreground tracking-widest">CONNECTED</span>
        </div>
      </div>

      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-[1600px] mx-auto pb-8">

        {/* System Metrics - TOP ROW spanning full width */}
        <div className="md:col-span-2 xl:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'COLLISIONS AVOIDED', value: metrics.collisions, icon: '◆', warn: false },
            { label: 'TOTAL ΔV (m/s)', value: metrics.deltaV.toFixed(2), icon: '▲', warn: false },
            { label: 'FLEET UPTIME', value: `${metrics.uptime.toFixed(2)}%`, icon: '●', warn: false },
            { label: 'ACTIVE WARNINGS', value: metrics.warnings, icon: '⚠', warn: metrics.warnings > 4 },
          ].map(m => (
            <div key={m.label} className="hud-panel hud-brackets p-4 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="text-[9px] text-muted-foreground tracking-[0.2em] mb-2">{m.icon} {m.label}</div>
              <div className={`font-orbitron text-2xl md:text-3xl font-bold tabular-nums ${m.warn ? 'crt-glow-warning text-secondary' : 'crt-glow'}`}>
                {m.value}
              </div>
            </div>
          ))}
        </div>

        {/* Fleet Status */}
        <div className="hud-panel hud-brackets p-4 md:col-span-2 xl:col-span-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-orbitron text-xs tracking-[0.3em] text-muted-foreground flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              FLEET STATUS
            </h2>
            <span className="text-[9px] text-muted-foreground">{sats.filter(s => s.status === 'NOMINAL').length}/10 NOMINAL</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-4 text-[9px] tracking-widest">ID</th>
                  <th className="text-left py-2 pr-4 text-[9px] tracking-widest">STATUS</th>
                  <th className="text-left py-2 pr-4 text-[9px] tracking-widest">FUEL</th>
                  <th className="text-left py-2 text-[9px] tracking-widest">LAST MANEUVER</th>
                </tr>
              </thead>
              <tbody>
                {sats.map(s => (
                  <tr key={s.id} className="border-b border-border/20 hover:bg-primary/5 transition-colors">
                    <td className="py-2.5 pr-4 font-orbitron text-[11px] crt-glow">{s.id}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`font-orbitron text-[10px] px-2 py-0.5 rounded-sm ${statusClass(s.status)} ${statusBgClass(s.status)}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 w-36">
                      <div className="flex items-center gap-2">
                        <div className="fuel-bar flex-1">
                          <div className="fuel-bar-fill" style={{ width: `${s.fuel}%`, background: fuelColor(s.fuel) }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{s.fuel.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-muted-foreground text-[10px]">{s.lastManeuver}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Conjunction Bullseye */}
        <div className="hud-panel hud-brackets p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <h2 className="font-orbitron text-xs tracking-[0.3em] text-muted-foreground mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
            CONJUNCTION BULLSEYE
          </h2>
          <svg viewBox="0 0 200 200" className="w-full max-w-[260px] mx-auto">
            {/* Rings with labels */}
            {[
              { r: 80, label: '5km' },
              { r: 60, label: '2km' },
              { r: 40, label: '1km' },
              { r: 20, label: '0.5km' },
            ].map(ring => (
              <g key={ring.r}>
                <circle cx="100" cy="100" r={ring.r} fill="none" stroke="#00ff8822" strokeWidth="0.5" />
                <text x={102} y={100 - ring.r + 8} fill="#00ff8844" fontSize="5" fontFamily="'Orbitron'">{ring.label}</text>
              </g>
            ))}
            <line x1="100" y1="15" x2="100" y2="185" stroke="#00ff8815" strokeWidth="0.5" />
            <line x1="15" y1="100" x2="185" y2="100" stroke="#00ff8815" strokeWidth="0.5" />
            <line x1="30" y1="30" x2="170" y2="170" stroke="#00ff8810" strokeWidth="0.3" />
            <line x1="170" y1="30" x2="30" y2="170" stroke="#00ff8810" strokeWidth="0.3" />
            {conjunctions.map((c, i) => {
              const rad = (c.angle * Math.PI) / 180;
              const dist = c.distance * 78;
              const x = 100 + Math.cos(rad) * dist;
              const y = 100 + Math.sin(rad) * dist;
              return (
                <g key={i}>
                  <line x1="100" y1="100" x2={x} y2={y} stroke={c.color} strokeWidth="0.4" opacity="0.3" />
                  <circle cx={x} cy={y} r="3.5" fill={c.color} opacity="0.7" />
                  <circle cx={x} cy={y} r="5" fill="none" stroke={c.color} strokeWidth="0.3" opacity="0.3" />
                </g>
              );
            })}
            <circle cx="100" cy="100" r="5" fill="#00ff88" opacity="0.8" />
            <circle cx="100" cy="100" r="8" fill="none" stroke="#00ff88" strokeWidth="0.5" opacity="0.4" />
          </svg>
          <div className="flex justify-center gap-6 mt-3 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: '#00ff88', boxShadow: '0 0 4px #00ff88' }} />SAFE</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: '#ffb300', boxShadow: '0 0 4px #ffb300' }} />CAUTION</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: '#ff2a2a', boxShadow: '0 0 4px #ff2a2a' }} />DANGER</span>
          </div>
        </div>

        {/* Maneuver Timeline */}
        <div className="hud-panel hud-brackets p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <h2 className="font-orbitron text-xs tracking-[0.3em] text-muted-foreground mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
            MANEUVER TIMELINE
          </h2>
          {/* Time axis */}
          <div className="flex justify-between text-[7px] text-muted-foreground/50 mb-1 pl-[72px]">
            {['T+0m', 'T+20m', 'T+40m', 'T+60m', 'T+80m'].map(t => <span key={t}>{t}</span>)}
          </div>
          <div className="space-y-2">
            {maneuverData.map(sat => (
              <div key={sat.id} className="flex items-center gap-2 group">
                <span className="text-[10px] font-orbitron crt-glow w-16 shrink-0 group-hover:text-primary transition-colors">{sat.id}</span>
                <div className="relative h-5 flex-1 bg-muted/20 rounded-sm overflow-hidden border border-border/20">
                  {sat.burns.map((b, i) => (
                    <div key={i}>
                      <div
                        className="absolute h-full rounded-sm"
                        style={{
                          left: `${(b.start / 80) * 100}%`,
                          width: `${(b.duration / 80) * 100}%`,
                          background: 'linear-gradient(180deg, hsl(152 100% 50% / 0.8), hsl(152 100% 50% / 0.5))',
                        }}
                      />
                      <div
                        className="absolute h-full rounded-sm"
                        style={{
                          left: `${((b.start + b.duration) / 80) * 100}%`,
                          width: `${(b.cooldown / 80) * 100}%`,
                          background: 'repeating-linear-gradient(90deg, hsl(40 100% 50% / 0.2), hsl(40 100% 50% / 0.2) 2px, transparent 2px, transparent 4px)',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-6 mt-4 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block w-4 h-2.5 rounded-sm" style={{ background: 'linear-gradient(180deg, hsl(152 100% 50% / 0.8), hsl(152 100% 50% / 0.5))' }} />BURN WINDOW</span>
            <span className="flex items-center gap-1"><span className="inline-block w-4 h-2.5 rounded-sm" style={{ background: 'repeating-linear-gradient(90deg, hsl(40 100% 50% / 0.3), hsl(40 100% 50% / 0.3) 2px, transparent 2px, transparent 4px)' }} />COOLDOWN</span>
          </div>
        </div>

        {/* Ground Station Coverage */}
        <div className="hud-panel hud-brackets p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <h2 className="font-orbitron text-xs tracking-[0.3em] text-muted-foreground mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
            GROUND STATION COVERAGE
          </h2>
          <svg viewBox="0 0 100 60" className="w-full">
            {/* Grid lines */}
            {Array.from({ length: 11 }, (_, i) => (
              <line key={`v${i}`} x1={i * 10} y1="0" x2={i * 10} y2="60" stroke="#00ff8808" strokeWidth="0.2" />
            ))}
            {Array.from({ length: 7 }, (_, i) => (
              <line key={`h${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="#00ff8808" strokeWidth="0.2" />
            ))}
            {/* Continents */}
            <path d="M15,22 L20,20 L30,22 L33,28 L30,40 L25,45 L18,42 L15,35 Z" fill="none" stroke="#00ff8825" strokeWidth="0.5" />
            <path d="M38,16 L48,14 L58,17 L60,22 L55,30 L48,33 L40,30 L38,22 Z" fill="none" stroke="#00ff8825" strokeWidth="0.5" />
            <path d="M60,20 L70,18 L75,22 L73,32 L65,35 L60,28 Z" fill="none" stroke="#00ff8825" strokeWidth="0.5" />
            <path d="M44,38 L50,36 L54,40 L52,50 L46,52 L42,46 Z" fill="none" stroke="#00ff8825" strokeWidth="0.5" />
            <path d="M72,38 L82,36 L86,42 L84,52 L76,55 L72,48 Z" fill="none" stroke="#00ff8825" strokeWidth="0.5" />
            <path d="M5,26 L10,24 L13,28 L11,34 L7,35 L5,30 Z" fill="none" stroke="#00ff8825" strokeWidth="0.5" />
            {/* Stations with animated coverage */}
            {groundStations.map(gs => (
              <g key={gs.name}>
                <circle cx={gs.x} cy={gs.y} r="10" fill="none" stroke="#00ff8830" strokeWidth="0.3" strokeDasharray="1.5 1" />
                <circle cx={gs.x} cy={gs.y} r="6" fill="#00ff8808" stroke="#00ff8820" strokeWidth="0.2" />
                <circle cx={gs.x} cy={gs.y} r="1.8" fill="#00ff88" />
                <circle cx={gs.x} cy={gs.y} r="3" fill="none" stroke="#00ff8866" strokeWidth="0.3">
                  <animate attributeName="r" from="1.8" to="5" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
                <text x={gs.x} y={gs.y + 6} textAnchor="middle" fill="#00ff8888" fontSize="2" fontFamily="'Orbitron'" letterSpacing="0.5">{gs.name}</text>
              </g>
            ))}
          </svg>
          <div className="mt-2 text-center text-[8px] text-muted-foreground tracking-widest">
            {groundStations.length} STATIONS • GLOBAL COVERAGE 94.2%
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
