/**
 * AETHER ACM — CDM Alert Feed (right sidebar)
 * Live conjunction alerts with collision probability & auto-evade.
 */
import { riskColor, formatCountdown } from '@/utils/geo';
import type { CDMData } from '@/hooks/useSimulation';

interface Props {
  cdms: CDMData[];
  selectedSatId: string | null;
  onSelectSat: (id: string) => void;
  onAutoEvade?: (satId: string) => void;
}

export default function CDMAlertFeed({ cdms, selectedSatId, onSelectSat, onAutoEvade }: Props) {
  const sorted = [...cdms].sort((a, b) => {
    const order: Record<string, number> = { CRITICAL: 0, WARNING: 1, CAUTION: 2 };
    return (order[a.risk_level] ?? 3) - (order[b.risk_level] ?? 3) || a.tca_seconds - b.tca_seconds;
  });

  const critCount = cdms.filter(c => c.risk_level === 'CRITICAL').length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          {critCount > 0 ? <span className="status-dot status-critical" /> : cdms.length > 0 ? <span className="status-dot status-warning" /> : <span className="status-dot status-nominal" />}
          <span className="font-orbitron text-[9px] tracking-[0.2em] text-muted-foreground">CDM ALERTS</span>
        </div>
        <span className="text-[9px] font-orbitron text-muted-foreground tabular-nums">{cdms.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-[10px] text-muted-foreground/40 font-mono mb-2">— NO ACTIVE CDMs —</div>
            <div className="text-[8px] text-muted-foreground/30">All clear</div>
          </div>
        ) : sorted.map((cdm, i) => {
          const color = riskColor(cdm.risk_level);
          const isCrit = cdm.risk_level === 'CRITICAL';
          const isWarn = cdm.risk_level === 'WARNING';
          const isActive = cdm.satellite_id === selectedSatId;

          return (
            <button key={`${cdm.satellite_id}-${cdm.debris_id}-${i}`} onClick={() => onSelectSat(cdm.satellite_id)}
              className={`w-full text-left px-3 py-2.5 border-b border-border/30 transition-colors hover:bg-primary/5 ${isActive ? 'bg-primary/5' : ''} ${isCrit ? 'blink-slow' : ''}`}
              style={{ borderLeft: `3px solid ${color}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-orbitron text-[10px] px-1.5 py-0.5 rounded-sm tracking-wider" style={{ color, background: `${color}15`, border: `1px solid ${color}30` }}>
                  {cdm.risk_level}
                </span>
                <span className="font-mono text-[10px] crt-glow tabular-nums">T-{formatCountdown(cdm.tca_seconds)}</span>
              </div>
              <div className="text-[9px] text-muted-foreground space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono">{cdm.satellite_id}</span>
                  <span className="text-muted-foreground/30 text-[8px]">↔</span>
                  <span className="font-mono text-muted-foreground/60">{cdm.debris_id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Miss: <span style={{ color }}>{cdm.miss_distance_km < 0.1 ? `${(cdm.miss_distance_km * 1000).toFixed(0)}m` : `${cdm.miss_distance_km.toFixed(2)}km`}</span></span>
                  <span>V<sub>rel</sub>: {cdm.relative_velocity_km_s.toFixed(1)}km/s</span>
                </div>
                {/* Collision probability — unique feature */}
                {cdm.collision_probability > 0 && (
                  <div className="flex justify-between">
                    <span>P<sub>c</sub>: <span style={{ color: cdm.collision_probability > 1e-4 ? '#ff3366' : cdm.collision_probability > 1e-6 ? '#ffaa00' : '#00ff88' }}>
                      {cdm.collision_probability.toExponential(2)}
                    </span></span>
                  </div>
                )}
              </div>
              {(isCrit || isWarn) && onAutoEvade && (
                <button onClick={(e) => { e.stopPropagation(); onAutoEvade(cdm.satellite_id); }}
                  className="w-full mt-2 py-1.5 text-[9px] font-orbitron tracking-[0.2em] rounded-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{ color: isCrit ? '#ff3366' : '#ffaa00', border: `1px solid ${isCrit ? '#ff336650' : '#ffaa0050'}`, background: isCrit ? 'rgba(255,51,102,0.08)' : 'rgba(255,170,0,0.08)', boxShadow: `0 0 10px ${isCrit ? 'rgba(255,51,102,0.15)' : 'rgba(255,170,0,0.1)'}` }}>
                  ⚡ AUTO-EVADE
                </button>
              )}
            </button>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t border-border text-[8px] text-muted-foreground/50 flex justify-between">
        <span>CRIT: {critCount}</span>
        <span>WARN: {cdms.filter(c => c.risk_level === 'WARNING').length}</span>
        <span>CAUT: {cdms.filter(c => c.risk_level === 'CAUTION').length}</span>
      </div>
    </div>
  );
}
