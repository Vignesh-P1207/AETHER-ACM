/**
 * AETHER ACM — StatsHeader
 * Top bar with live KPIs, UTC clock, and navigation.
 */
import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { fuelColor } from '@/utils/geo';
import type { SatelliteData, CDMData } from '@/hooks/useSimulation';

interface Props {
  satellites: SatelliteData[];
  cdms: CDMData[];
  isConnected: boolean;
  onNavigate: (page: string) => void;
}

export default function StatsHeader({ satellites, cdms, isConnected, onNavigate }: Props) {
  const { theme } = useTheme();
  const [clock, setClock] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(t); }, []);

  const active = satellites.filter(s => s.status !== 'GRAVEYARD').length;
  const totalFuel = satellites.reduce((a, s) => a + s.fuel_kg, 0);
  const fleetPct = satellites.length > 0 ? (totalFuel / (satellites.length * 50)) * 100 : 0;
  const critCDMs = cdms.filter(c => c.risk_level === 'CRITICAL').length;
  const evading = satellites.filter(s => s.status === 'EVADING').length;
  const losCount = satellites.filter(s => s.ground_station_los).length;

  const kpis: { label: string; value: string | number; warn: boolean; color?: string }[] = [
    { label: 'ACTIVE', value: active, warn: active < 45 },
    { label: 'CDMs', value: cdms.length, warn: cdms.length > 5 },
    { label: 'FUEL', value: `${fleetPct.toFixed(1)}%`, warn: fleetPct < 40, color: fuelColor(fleetPct) },
    { label: 'CRITICAL', value: critCDMs, warn: critCDMs > 0 },
  ];
  if (evading > 0) kpis.push({ label: 'EVADING', value: evading, warn: true });
  if (losCount > 0) kpis.push({ label: 'LOS', value: losCount, warn: false });

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/95 backdrop-blur-sm z-50">
      <div className="flex items-center gap-3">
        <button className="hud-btn text-[10px] py-1.5 px-3" onClick={() => onNavigate('hero')}>◁ BACK</button>
        <button className="hud-btn text-[10px] py-1.5 px-3" onClick={() => onNavigate('simulation')}>🌍 3D</button>
        <div className="w-px h-5 bg-border" />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ boxShadow: theme.glowSoft }} />
          <span className="font-orbitron text-xs tracking-[0.3em] crt-glow">AETHER ACM</span>
        </div>
        <span className="text-[8px] text-muted-foreground tracking-wider font-mono hidden xl:block">ORBITAL INSIGHT</span>
      </div>

      <div className="flex items-center gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="text-center">
            <div className="text-[7px] text-muted-foreground tracking-[0.12em] font-orbitron">{kpi.label}</div>
            <div className={`font-orbitron text-lg font-bold tabular-nums leading-tight ${kpi.warn ? 'crt-glow-warning text-secondary' : ''}`}
              style={kpi.color ? { color: kpi.color, textShadow: `0 0 8px ${kpi.color}50` } : undefined}>
              {!kpi.color && !kpi.warn && <span className="crt-glow">{kpi.value}</span>}
              {(kpi.color || kpi.warn) && kpi.value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {clock.toISOString().substring(11, 19)} <span className="text-[7px]">UTC</span>
        </span>
        <div className="w-px h-5 bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="status-dot status-nominal blink-slow" />
          <span className="text-[8px] text-muted-foreground tracking-widest">REAL-TIME</span>
        </div>
      </div>
    </div>
  );
}
