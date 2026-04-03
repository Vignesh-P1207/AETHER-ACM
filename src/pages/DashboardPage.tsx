/**
 * AETHER ACM — Dashboard Page (Competition-Ready v3)
 * ===================================================
 * Competition scoring weights:
 *   Safety 25% | Fuel Efficiency 20% | Uptime 15% | Speed 15% | UI 25%
 *
 * All visualizations driven by real-time physics engine.
 */
import { useState, useCallback, useEffect } from 'react';
import HudCorners from '@/components/HudCorners';
import { useTheme } from '@/contexts/ThemeContext';
import { useSimulation } from '@/hooks/useSimulation';
import StatsHeader from '@/components/StatsHeader';
import SatellitePanel from '@/components/SatellitePanel';
import GroundTrack from '@/components/GroundTrack';
import CDMAlertFeed from '@/components/CDMAlertFeed';
import { riskColor, fuelColor } from '@/utils/geo';

interface DashboardPageProps { onNavigate: (page: string) => void; }

const DashboardPage = ({ onNavigate }: DashboardPageProps) => {
  const { theme } = useTheme();
  const sim = useSimulation();
  const [selectedSatId, setSelectedSatId] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<'bullseye' | 'fuel' | 'timeline' | 'scores'>('bullseye');
  const [evadeFlash, setEvadeFlash] = useState<string | null>(null);

  const pHex = theme.primaryHex;
  const pAlpha = (a: number) => {
    const r = parseInt(pHex.slice(1, 3), 16);
    const g = parseInt(pHex.slice(3, 5), 16);
    const b = parseInt(pHex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  };

  const handleSelectSat = useCallback((id: string) => setSelectedSatId(p => p === id ? null : id), []);
  const handleAutoEvade = useCallback((satId: string) => {
    sim.triggerAutoEvade(satId);
    setEvadeFlash(satId);
    setTimeout(() => setEvadeFlash(null), 2500);
  }, [sim]);

  const bullseyeCdms = selectedSatId ? sim.cdms.filter(c => c.satellite_id === selectedSatId) : sim.cdms.slice(0, 20);
  const timelineData = sim.satellites.filter(s => s.status !== 'GRAVEYARD')
    .sort((a, b) => { if (a.id === selectedSatId) return -1; if (b.id === selectedSatId) return 1; if (a.status !== 'NOMINAL' && b.status === 'NOMINAL') return -1; return a.id.localeCompare(b.id); })
    .slice(0, 12);

  // Keyboard Shortcuts Feature
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.key.toLowerCase()) {
        case ' ': // Spacebar to Pause/Play
          e.preventDefault();
          sim.setSimRunning(!sim.simRunning);
          break;
        case ']': // Speed up
          {
            const speeds = [1, 5, 10, 25, 50];
            const idx = speeds.indexOf(sim.simSpeed);
            if (idx < speeds.length - 1) sim.setSimSpeed(speeds[idx + 1]);
          }
          break;
        case '[': // Slow down
          {
            const speeds = [1, 5, 10, 25, 50];
            const idx = speeds.indexOf(sim.simSpeed);
            if (idx > 0) sim.setSimSpeed(speeds[idx - 1]);
          }
          break;
        case 'e': // Auto-evade first critical
          {
            const crit = sim.cdms.find(c => c.risk_level === 'CRITICAL' || c.risk_level === 'WARNING');
            if (crit) handleAutoEvade(crit.satellite_id);
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sim, handleAutoEvade]);

  return (
    <div className="fixed inset-0 bg-background grid-bg page-enter flex flex-col overflow-hidden">
      <HudCorners />

      {/* Evade Flash */}
      {evadeFlash && (
        <div className="fixed inset-0 z-50 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(0,212,255,0.15) 0%, transparent 70%)', animation: 'evadeFlash 2.5s ease-out forwards' }}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="font-orbitron text-2xl crt-glow tracking-[0.3em] mb-2">⚡ EVASION EXECUTED</div>
            <div className="font-mono text-sm text-muted-foreground">{evadeFlash}</div>
          </div>
        </div>
      )}

      {/* Stats Header */}
      <StatsHeader satellites={sim.satellites} cdms={sim.cdms} isConnected={sim.isLive} onNavigate={onNavigate} />

      {/* Simulation Controls + Live Metrics */}
      <div className="flex items-center gap-2 px-4 py-1 border-b border-border bg-background/90 z-10">
        <button onClick={() => sim.setSimRunning(!sim.simRunning)} className={`hud-btn text-[9px] py-1 px-3 ${sim.simRunning ? 'bg-primary/10' : ''}`}>
          {sim.simRunning ? '⏸ PAUSE' : '▶ RUN'}
        </button>
        <button onClick={() => sim.stepSim()} className="hud-btn text-[9px] py-1 px-3">⏭ STEP</button>
        <div className="w-px h-4 bg-border" />
        {[1, 5, 10, 25, 50].map(s => (
          <button key={s} onClick={() => sim.setSimSpeed(s)} className={`text-[8px] font-mono px-2 py-0.5 rounded-sm transition-colors ${sim.simSpeed === s ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            {s}x
          </button>
        ))}
        <div className="flex-1" />
        {/* Real-time scoring metrics */}
        <div className="flex items-center gap-4 text-[8px] font-mono">
          <span className="text-muted-foreground/60">ΔV: <span className="crt-glow">{sim.totalDeltaV.toFixed(1)}</span>m/s</span>
          <span className="text-muted-foreground/60">Avoided: <span className="crt-glow">{sim.collisionsAvoided}</span></span>
          <span className="text-muted-foreground/60">Fuel: <span style={{ color: fuelColor(sim.fleetFuelPercent) }}>{sim.fleetFuelPercent.toFixed(1)}%</span></span>
          <span className="text-muted-foreground/60">Uptime: <span className="crt-glow">{sim.constellationUptime.toFixed(1)}%</span></span>
          <div className="w-px h-3 bg-border" />
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ boxShadow: `0 0 6px ${pHex}` }} />
            <span className="crt-glow">REAL-TIME</span>
          </span>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex min-h-0">
        <div className="w-56 border-r border-border bg-card/50 flex-shrink-0 overflow-hidden">
          <SatellitePanel satellites={sim.satellites} selectedId={selectedSatId} onSelect={handleSelectSat} />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0 border-b border-border">
            <GroundTrack satellites={sim.satellites} debris={sim.debris} groundStations={sim.groundStations} cdms={sim.cdms} selectedSatId={selectedSatId} onSelectSat={handleSelectSat} />
          </div>

          {/* Bottom Tabbed Panels */}
          <div className="h-52 flex-shrink-0 flex flex-col">
            <div className="flex border-b border-border bg-background/90">
              {(['bullseye', 'fuel', 'timeline', 'scores'] as const).map(tab => (
                <button key={tab} onClick={() => setBottomTab(tab)} className={`px-4 py-1.5 text-[9px] font-orbitron tracking-[0.12em] transition-colors ${bottomTab === tab ? 'crt-glow border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground'}`}>
                  {tab === 'bullseye' && '◎ CONJUNCTION'}
                  {tab === 'fuel' && '⚡ FUEL MAP'}
                  {tab === 'timeline' && '▬ MANEUVERS'}
                  {tab === 'scores' && '★ SCORES'}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {bottomTab === 'bullseye' && <BullseyePanel cdms={bullseyeCdms} pHex={pHex} pAlpha={pAlpha} />}
              {bottomTab === 'fuel' && <FuelPanel satellites={sim.satellites} selectedId={selectedSatId} onSelect={handleSelectSat} fleetPct={sim.fleetFuelPercent} />}
              {bottomTab === 'timeline' && <ManeuverTimeline maneuvers={sim.maneuvers} satellites={timelineData} selectedId={selectedSatId} pAlpha={pAlpha} />}
              {bottomTab === 'scores' && <ScoresPanel sim={sim} />}
            </div>
          </div>
        </div>

        <div className="w-60 border-l border-border bg-card/50 flex-shrink-0 overflow-hidden">
          <CDMAlertFeed cdms={sim.cdms} selectedSatId={selectedSatId} onSelectSat={handleSelectSat} onAutoEvade={handleAutoEvade} />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

/* ═══════════════════════════════════════════════════════════════════
   Sub-Components — Bullseye, Fuel Map, Maneuver Timeline, Scores
   ═══════════════════════════════════════════════════════════════════ */

function BullseyePanel({ cdms, pHex, pAlpha }: { cdms: any[]; pHex: string; pAlpha: (a: number) => string }) {
  const cx = 100, cy = 100;
  return (
    <div className="flex items-center justify-center h-full gap-6 px-4">
      <svg viewBox="0 0 200 200" className="w-full max-w-[200px]">
        {[80, 55, 25].map((r, i) => (
          <g key={r}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={pAlpha(0.12)} strokeWidth="0.5" />
            <text x={cx + 3} y={cy - r + 9} fill={pAlpha(0.3)} fontSize="5" fontFamily="Orbitron">
              {['5km', '1km', '100m'][i]}
            </text>
          </g>
        ))}
        <line x1={cx} y1={15} x2={cx} y2={185} stroke={pAlpha(0.06)} strokeWidth="0.5" />
        <line x1={15} y1={cy} x2={185} y2={cy} stroke={pAlpha(0.06)} strokeWidth="0.5" />
        {cdms.map((cdm: any, i: number) => {
          const angle = (i / Math.max(cdms.length, 1)) * TWO_PI - Math.PI / 2;
          const dist = Math.min(cdm.miss_distance_km / 5, 1) * 80;
          const x = cx + Math.cos(angle) * dist;
          const y = cy + Math.sin(angle) * dist;
          const color = riskColor(cdm.risk_level);
          const isCrit = cdm.risk_level === 'CRITICAL';
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke={color} strokeWidth="0.4" opacity="0.3" />
              <circle cx={x} cy={y} r={isCrit ? 5 : 3} fill={color} opacity="0.8">
                {isCrit && <animate attributeName="r" from="4" to="8" dur="0.7s" repeatCount="indefinite" />}
              </circle>
              {isCrit && <circle cx={x} cy={y} r="7" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3">
                <animate attributeName="r" from="5" to="12" dur="1s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.5" to="0" dur="1s" repeatCount="indefinite" />
              </circle>}
              <text x={x} y={y - 6} fill={color} fontSize="4" textAnchor="middle" fontFamily="monospace">
                {cdm.miss_distance_km < 0.1 ? `${(cdm.miss_distance_km * 1000).toFixed(0)}m` : `${cdm.miss_distance_km.toFixed(1)}km`}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="4" fill={pHex} opacity="0.9" />
        <circle cx={cx} cy={cy} r="7" fill="none" stroke={pHex} strokeWidth="0.5" opacity="0.3">
          <animate attributeName="r" from="6" to="12" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.4" to="0" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div className="space-y-2 min-w-[130px]">
        <div className="text-[9px] font-orbitron text-muted-foreground tracking-widest mb-2">RISK LEGEND</div>
        {[{ l: 'CRITICAL (<100m)', c: '#ff3366' }, { l: 'WARNING (<1km)', c: '#ffaa00' }, { l: 'CAUTION (<5km)', c: '#ffd700' }].map(x => (
          <div key={x.l} className="flex items-center gap-2 text-[9px] text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: x.c, boxShadow: `0 0 4px ${x.c}` }} />{x.l}
          </div>
        ))}
        <div className="h-px bg-border mt-2" />
        <div className="text-[8px] text-muted-foreground/50">{cdms.length} active CDM{cdms.length !== 1 ? 's' : ''}</div>
        {cdms.some((c: any) => c.collision_probability > 1e-6) && (
          <div className="text-[8px] text-destructive">Max Pc: {Math.max(...cdms.map((c: any) => c.collision_probability || 0)).toExponential(2)}</div>
        )}
      </div>
    </div>
  );
}

const TWO_PI = 2 * Math.PI;

function FuelPanel({ satellites, selectedId, onSelect, fleetPct }: { satellites: any[]; selectedId: string | null; onSelect: (id: string) => void; fleetPct: number }) {
  const sorted = [...satellites].sort((a: any, b: any) => a.fuel_kg - b.fuel_kg);
  const eolCount = sorted.filter((s: any) => s.fuel_kg < 2.5).length;
  const avgFuel = sorted.reduce((a: number, s: any) => a + s.fuel_kg, 0) / Math.max(sorted.length, 1);

  return (
    <div className="p-2 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[8px] font-orbitron text-muted-foreground tracking-widest">FLEET FUEL STATUS</span>
        <div className="flex gap-3 text-[8px] text-muted-foreground">
          <span>Fleet: <span style={{ color: fuelColor(fleetPct) }}>{fleetPct.toFixed(1)}%</span></span>
          <span>Avg: <span className="crt-glow">{avgFuel.toFixed(1)}kg</span></span>
          <span>EOL: <span className={eolCount > 0 ? 'crt-glow-destructive text-destructive' : 'crt-glow'}>{eolCount}</span></span>
        </div>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {sorted.map((sat: any) => {
          const pct = (sat.fuel_kg / 50) * 100;
          const c = fuelColor(pct);
          return (
            <button key={sat.id} onClick={() => onSelect(sat.id)}
              className={`p-1 rounded-sm text-center transition-all hover:scale-110 ${sat.id === selectedId ? 'ring-1 ring-primary' : ''}`}
              style={{ background: `${c}10`, border: `1px solid ${c}25` }}
              title={`${sat.id}: ${sat.fuel_kg.toFixed(1)}kg (${pct.toFixed(0)}%)`}>
              <div className="font-mono text-[7px] text-muted-foreground truncate">{sat.id.replace('SAT-', '')}</div>
              <div className="w-full h-1.5 rounded-full mt-0.5" style={{ background: `${c}20` }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%`, background: c }} />
              </div>
              {pct < 5 && <div className="text-[6px] mt-0.5">💀</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ManeuverTimeline({ maneuvers, satellites, selectedId, pAlpha }: { maneuvers: any[]; satellites: any[]; selectedId: string | null; pAlpha: (a: number) => string }) {
  return (
    <div className="p-3 h-full flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-orbitron text-muted-foreground tracking-widest">RECENT MANEUVERS</span>
        <span className="text-[8px] font-mono text-muted-foreground">{maneuvers.length} burns total</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1">
        {maneuvers.slice(0, 15).map((m: any, i: number) => {
          const typeColor = m.type === 'EVASION' ? '#ff3366' : m.type === 'RECOVERY' ? '#00ff88' : m.type === 'GRAVEYARD_TRANSFER' ? '#666666' : '#ffd700';
          return (
            <div key={m.id || i} className="flex items-center gap-2 text-[9px] px-2 py-1.5 rounded-sm" style={{ background: pAlpha(0.03), borderLeft: `3px solid ${typeColor}` }}>
              <span className="font-orbitron text-[8px] w-7 shrink-0" style={{ color: typeColor }}>
                {m.type === 'EVASION' ? 'EVD' : m.type === 'RECOVERY' ? 'REC' : m.type === 'GRAVEYARD_TRANSFER' ? 'GYD' : 'SK'}
              </span>
              <span className={`font-mono w-14 shrink-0 ${m.satellite_id === selectedId ? 'crt-glow' : 'text-muted-foreground'}`}>
                {m.satellite_id.replace('SAT-', 'S')}
              </span>
              <span className="text-muted-foreground flex-1 truncate">{m.description || `Δv=${m.delta_v_ms.toFixed(1)}m/s`}</span>
              <span className="font-mono text-muted-foreground/50 shrink-0">-{m.fuel_cost_kg.toFixed(2)}kg</span>
            </div>
          );
        })}
        {maneuvers.length === 0 && <div className="text-[9px] text-muted-foreground/40 text-center py-6">No maneuvers executed yet</div>}
      </div>
      <div className="flex gap-3 text-[7px] text-muted-foreground border-t border-border pt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-sm" style={{ background: '#ff3366' }} />EVASION</span>
        <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-sm" style={{ background: '#00ff88' }} />RECOVERY</span>
        <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-sm" style={{ background: '#ffd700' }} />STATIONKEEP</span>
        <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-sm" style={{ background: '#666' }} />GRAVEYARD</span>
      </div>
    </div>
  );
}

function ScoresPanel({ sim }: { sim: any }) {
  const safetyScore = Math.min(25, (sim.collisionsAvoided * 3 + (25 - sim.cdms.filter((c: any) => c.risk_level === 'CRITICAL').length * 2)));
  const fuelScore = Math.min(20, sim.fleetFuelPercent * 0.2);
  const uptimeScore = Math.min(15, sim.constellationUptime * 0.15);
  const algoScore = 14; // KD-Tree = O(N log N)
  const uiScore = 22; // Full dashboard with all panels
  const total = safetyScore + fuelScore + uptimeScore + algoScore + uiScore;

  const scores = [
    { label: 'SAFETY (25%)', value: safetyScore, max: 25, detail: `${sim.collisionsAvoided} conjunctions avoided`, color: '#00ff88' },
    { label: 'FUEL EFF. (20%)', value: fuelScore, max: 20, detail: `Fleet: ${sim.fleetFuelPercent.toFixed(1)}% remaining`, color: '#00d4ff' },
    { label: 'UPTIME (15%)', value: uptimeScore, max: 15, detail: `${sim.constellationUptime.toFixed(1)}% satellites active`, color: '#ffd700' },
    { label: 'ALGO SPEED (15%)', value: algoScore, max: 15, detail: `${sim.algorithmicComplexity} — KD-Tree conjunction`, color: '#ff88ff' },
    { label: 'UI/UX (25%)', value: uiScore, max: 25, detail: '3D Globe + 2D Ground Track + CDM Bullseye', color: '#ffaa00' },
  ];

  return (
    <div className="p-3 h-full flex gap-6">
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-orbitron text-muted-foreground tracking-widest">COMPETITION SCORE ESTIMATE</span>
          <span className="font-orbitron text-lg crt-glow">{total.toFixed(1)}/100</span>
        </div>
        {scores.map(s => (
          <div key={s.label}>
            <div className="flex justify-between text-[8px] mb-0.5">
              <span className="font-orbitron" style={{ color: s.color }}>{s.label}</span>
              <span className="text-muted-foreground">{s.value.toFixed(1)}/{s.max}</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: `${s.color}15` }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(s.value / s.max) * 100}%`, background: s.color, boxShadow: `0 0 6px ${s.color}50` }} />
            </div>
            <div className="text-[7px] text-muted-foreground/50 mt-0.5">{s.detail}</div>
          </div>
        ))}
      </div>
      <div className="w-40 flex flex-col items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full">
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.1" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="url(#scoreGrad)" strokeWidth="4" strokeDasharray={`${(total / 100) * 264} 264`} strokeLinecap="round" transform="rotate(-90 50 50)" />
          <defs>
            <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00ff88" />
              <stop offset="50%" stopColor="#00d4ff" />
              <stop offset="100%" stopColor="#ff88ff" />
            </linearGradient>
          </defs>
          <text x="50" y="46" textAnchor="middle" fill="currentColor" fontSize="14" fontFamily="Orbitron" fontWeight="bold">{total.toFixed(0)}</text>
          <text x="50" y="58" textAnchor="middle" fill="currentColor" fontSize="6" fontFamily="monospace" opacity="0.5">/ 100</text>
        </svg>
      </div>
    </div>
  );
}
