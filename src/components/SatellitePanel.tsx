/**
 * AETHER ACM — SatellitePanel (left sidebar)
 * Fleet list with detailed telemetry including LOS, slot deviation, orbital period.
 */
import { statusColor, fuelColor } from '@/utils/geo';
import type { SatelliteData } from '@/hooks/useSimulation';

interface Props {
  satellites: SatelliteData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function SatellitePanel({ satellites, selectedId, onSelect }: Props) {
  const selected = satellites.find(s => s.id === selectedId);
  const sorted = [...satellites].sort((a, b) => a.id.localeCompare(b.id));
  const nominalCount = satellites.filter(s => s.status === 'NOMINAL').length;
  const statusCls = (s: string) => s === 'NOMINAL' ? 'crt-glow' : s === 'EVADING' ? 'text-[#00d4ff]' : s === 'WARNING' ? 'crt-glow-warning text-secondary' : s === 'CRITICAL' ? 'crt-glow-destructive text-destructive' : 'text-muted-foreground';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="font-orbitron text-[10px] tracking-[0.2em] text-muted-foreground">◈ FLEET STATUS</span>
        <span className="text-[9px] text-muted-foreground font-mono">{nominalCount}/{satellites.length}</span>
      </div>

      {/* Selected satellite detail */}
      {selected && (
        <div className="px-3 py-3 border-b border-primary/20 bg-primary/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-orbitron text-sm crt-glow">{selected.id}</span>
            <span className={`font-orbitron text-[9px] px-2 py-0.5 rounded-sm ${statusCls(selected.status)} bg-primary/10`}>{selected.status}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div><div className="text-muted-foreground text-[8px] tracking-widest">LAT</div><div className="font-mono tabular-nums">{selected.lat.toFixed(2)}°</div></div>
            <div><div className="text-muted-foreground text-[8px] tracking-widest">LON</div><div className="font-mono tabular-nums">{selected.lon.toFixed(2)}°</div></div>
            <div><div className="text-muted-foreground text-[8px] tracking-widest">ALT</div><div className="font-mono tabular-nums">{selected.alt.toFixed(1)} km</div></div>
            <div><div className="text-muted-foreground text-[8px] tracking-widest">MASS</div><div className="font-mono tabular-nums">{selected.mass_kg.toFixed(1)} kg</div></div>
            <div><div className="text-muted-foreground text-[8px] tracking-widest">INC</div><div className="font-mono tabular-nums">{selected.inclination_deg?.toFixed(1) || '—'}°</div></div>
            <div><div className="text-muted-foreground text-[8px] tracking-widest">PERIOD</div><div className="font-mono tabular-nums">{selected.period_min?.toFixed(1) || '—'} min</div></div>
          </div>
          {/* GS LOS indicator */}
          {selected.ground_station_los && (
            <div className="flex items-center gap-1 text-[9px]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ boxShadow: '0 0 4px hsl(var(--primary))' }} />
              <span className="text-muted-foreground">LOS:</span>
              <span className="crt-glow font-mono">{selected.ground_station_los}</span>
            </div>
          )}
          {/* Fuel bar */}
          <div>
            <div className="flex justify-between text-[9px] mb-1">
              <span className="text-muted-foreground tracking-widest text-[8px]">FUEL</span>
              <span className="font-mono" style={{ color: fuelColor((selected.fuel_kg / 50) * 100) }}>
                {selected.fuel_kg.toFixed(2)} kg ({((selected.fuel_kg / 50) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="fuel-bar">
              <div className="fuel-bar-fill" style={{ width: `${(selected.fuel_kg / 50) * 100}%`, background: fuelColor((selected.fuel_kg / 50) * 100) }} />
            </div>
          </div>
        </div>
      )}

      {/* Fleet list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map(sat => {
          const pct = (sat.fuel_kg / 50) * 100;
          const hasLOS = !!sat.ground_station_los;
          return (
            <button key={sat.id} onClick={() => onSelect(sat.id)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-primary/5 transition-colors border-b border-border/20 ${sat.id === selectedId ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusColor(sat.status), boxShadow: `0 0 4px ${statusColor(sat.status)}` }} />
              <span className="font-mono text-[10px] text-foreground/80 flex-1">{sat.id}</span>
              {hasLOS && <span className="w-1 h-1 rounded-full bg-primary/50 flex-shrink-0" title="Ground Station LOS" />}
              <div className="w-12 fuel-bar">
                <div className="fuel-bar-fill" style={{ width: `${pct}%`, background: fuelColor(pct) }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
