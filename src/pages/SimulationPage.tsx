/**
 * AETHER ACM — 3D Globe Simulation Page
 * With satellite selector panel, CDM alerts, and auto-evade.
 */
import { useState, useMemo } from 'react';
import EarthScene from '@/components/EarthScene';
import HudCorners from '@/components/HudCorners';
import { useSimulation } from '@/hooks/useSimulation';
import { riskColor, fuelColor, formatCountdown, statusColor } from '@/utils/geo';

interface SimulationPageProps { onNavigate: (page: string) => void; }

const SimulationPage = ({ onNavigate }: SimulationPageProps) => {
  const sim = useSimulation();
  const [selectedSatId, setSelectedSatId] = useState<string | null>(null);
  const [satPanelOpen, setSatPanelOpen] = useState(true);
  const [satFilter, setSatFilter] = useState('');
  const [clickedSat, setClickedSat] = useState<{ id: string; fuel: number; status: string; period: number } | null>(null);

  const critCDMs = sim.cdms.filter(c => c.risk_level === 'CRITICAL').length;
  const selectedSat = sim.satellites.find(s => s.id === selectedSatId);

  // Filter satellites for the panel
  const filteredSats = useMemo(() => {
    const q = satFilter.toLowerCase();
    return sim.satellites
      .filter(s => s.id.toLowerCase().includes(q) || s.status.toLowerCase().includes(q))
      .sort((a, b) => {
        // Selected first, then by status severity, then by id
        if (a.id === selectedSatId) return -1;
        if (b.id === selectedSatId) return 1;
        const statusOrder: Record<string, number> = { CRITICAL: 0, EVADING: 1, WARNING: 2, NOMINAL: 3, GRAVEYARD: 4 };
        return (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5) || a.id.localeCompare(b.id);
      });
  }, [sim.satellites, satFilter, selectedSatId]);

  const handleGlobeClick = (satData: { id: string; fuel: number; status: string; period: number }) => {
    setSelectedSatId(satData.id);
    setClickedSat(satData);
  };

  const handlePanelSelect = (id: string) => {
    setSelectedSatId(prev => prev === id ? null : id);
    setClickedSat(null);
  };

  return (
    <div className="fixed inset-0 bg-background grid-bg page-enter">
      <EarthScene showSatellites showDebris paused={!sim.simRunning} speed={sim.simSpeed} onSatelliteClick={handleGlobeClick} />
      <HudCorners />

      {/* ═══ Top bar ═══ */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3 border-b border-border bg-background/85 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="status-dot status-nominal blink-slow" />
          <span className="text-[9px] text-muted-foreground tracking-widest">REAL-TIME</span>
        </div>
        <span className="font-orbitron text-xs tracking-[0.4em] crt-glow">
          {sim.simRunning ? 'RUNNING' : 'PAUSED'} // {sim.simSpeed}x
        </span>
        <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground">
          <span>Avoided: <span className="crt-glow">{sim.collisionsAvoided}</span></span>
          <span>Fuel: <span style={{ color: fuelColor(sim.fleetFuelPercent) }}>{sim.fleetFuelPercent.toFixed(1)}%</span></span>
        </div>
      </div>

      {/* ═══ Left: Satellite Selector Panel ═══ */}
      <div className={`absolute top-14 left-0 z-20 h-[calc(100%-7.5rem)] transition-all duration-300 ${satPanelOpen ? 'w-64' : 'w-8'}`}>
        {/* Toggle button */}
        <button
          onClick={() => setSatPanelOpen(!satPanelOpen)}
          className="absolute top-2 -right-3 z-30 w-6 h-12 flex items-center justify-center bg-background/90 border border-border rounded-r-md text-[10px] text-muted-foreground hover:text-primary transition-colors"
          title={satPanelOpen ? 'Hide panel' : 'Show satellite panel'}
        >
          {satPanelOpen ? '◂' : '▸'}
        </button>

        {satPanelOpen && (
          <div className="h-full bg-background/92 backdrop-blur-sm border-r border-border flex flex-col">
            {/* Header */}
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="font-orbitron text-[9px] tracking-[0.2em] text-muted-foreground">◈ SELECT SATELLITE</span>
              <span className="text-[8px] font-mono text-muted-foreground">{sim.satellites.length}</span>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-border/50">
              <input
                type="text"
                placeholder="Search SAT-001, CRITICAL..."
                value={satFilter}
                onChange={e => setSatFilter(e.target.value)}
                className="w-full bg-transparent border border-border/50 rounded-sm px-2 py-1 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
              />
            </div>

            {/* Status filter quick buttons */}
            <div className="flex gap-1 px-2 py-1.5 border-b border-border/30">
              {['ALL', 'CRITICAL', 'WARNING', 'EVADING'].map(f => (
                <button
                  key={f}
                  onClick={() => setSatFilter(f === 'ALL' ? '' : f)}
                  className={`text-[7px] px-1.5 py-0.5 rounded-sm font-orbitron tracking-wider transition-colors ${
                    (f === 'ALL' && !satFilter) || satFilter.toUpperCase() === f
                      ? 'bg-primary/15 text-primary border border-primary/30'
                      : 'text-muted-foreground/50 hover:text-muted-foreground border border-transparent'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Satellite list */}
            <div className="flex-1 overflow-y-auto">
              {filteredSats.map(sat => {
                const pct = (sat.fuel_kg / 50) * 100;
                const isSelected = sat.id === selectedSatId;
                const color = statusColor(sat.status);
                const hasCDM = sim.cdms.some(c => c.satellite_id === sat.id);

                return (
                  <button
                    key={sat.id}
                    onClick={() => handlePanelSelect(sat.id)}
                    className={`w-full text-left px-3 py-2 border-b border-border/15 transition-all hover:bg-primary/5 ${
                      isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: color, boxShadow: `0 0 4px ${color}` }}
                      />
                      <span className={`font-mono text-[10px] flex-1 ${isSelected ? 'crt-glow' : 'text-foreground/80'}`}>
                        {sat.id}
                      </span>
                      <span className="text-[7px] font-orbitron px-1 py-0.5 rounded-sm" style={{ color, background: `${color}15`, border: `1px solid ${color}25` }}>
                        {sat.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-border/20">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: fuelColor(pct) }} />
                      </div>
                      <span className="text-[8px] font-mono text-muted-foreground/60 w-10 text-right tabular-nums">{pct.toFixed(0)}%</span>
                    </div>
                    {hasCDM && (
                      <div className="text-[7px] text-destructive mt-0.5 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-destructive animate-pulse" />
                        CDM ACTIVE
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Panel footer */}
            <div className="px-3 py-1.5 border-t border-border text-[7px] text-muted-foreground/40 flex justify-between">
              <span>NOM: {sim.satellites.filter(s => s.status === 'NOMINAL').length}</span>
              <span>EVD: {sim.satellites.filter(s => s.status === 'EVADING').length}</span>
              <span>CRIT: {sim.satellites.filter(s => s.status === 'CRITICAL').length}</span>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Selected Satellite Detail (floating card) ═══ */}
      {selectedSat && (
        <div className={`absolute z-20 ${satPanelOpen ? 'left-[17.5rem]' : 'left-12'} top-20 hud-panel hud-brackets p-4 bg-background/95 backdrop-blur-md min-w-[240px] animate-scale-in transition-all`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: statusColor(selectedSat.status), boxShadow: `0 0 6px ${statusColor(selectedSat.status)}` }} />
              <span className="font-orbitron text-sm crt-glow">{selectedSat.id}</span>
            </div>
            <button onClick={() => setSelectedSatId(null)} className="text-muted-foreground hover:text-primary text-xs w-5 h-5 flex items-center justify-center border border-border/50 rounded-sm">✕</button>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent mb-3" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
            <div>
              <div className="text-muted-foreground text-[8px] tracking-widest">STATUS</div>
              <div className="font-orbitron" style={{ color: statusColor(selectedSat.status) }}>{selectedSat.status}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[8px] tracking-widest">ALT</div>
              <div className="font-mono tabular-nums crt-glow">{selectedSat.alt.toFixed(1)} km</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[8px] tracking-widest">LAT</div>
              <div className="font-mono tabular-nums">{selectedSat.lat.toFixed(2)}°</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[8px] tracking-widest">LON</div>
              <div className="font-mono tabular-nums">{selectedSat.lon.toFixed(2)}°</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[8px] tracking-widest">INC</div>
              <div className="font-mono tabular-nums">{selectedSat.inclination_deg?.toFixed(1)}°</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[8px] tracking-widest">PERIOD</div>
              <div className="font-mono tabular-nums">{selectedSat.period_min?.toFixed(1)} min</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[8px] tracking-widest">MASS</div>
              <div className="font-mono tabular-nums">{selectedSat.mass_kg.toFixed(0)} kg</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[8px] tracking-widest">LOS</div>
              <div className="font-mono tabular-nums">
                {selectedSat.ground_station_los ? (
                  <span className="crt-glow">{selectedSat.ground_station_los}</span>
                ) : (
                  <span className="text-muted-foreground/40">NONE</span>
                )}
              </div>
            </div>
          </div>
          {/* Fuel bar */}
          <div className="mt-3">
            <div className="flex justify-between text-[9px] mb-1">
              <span className="text-muted-foreground text-[8px] tracking-widest">FUEL</span>
              <span className="font-mono" style={{ color: fuelColor((selectedSat.fuel_kg / 50) * 100) }}>
                {selectedSat.fuel_kg.toFixed(2)} kg ({((selectedSat.fuel_kg / 50) * 100).toFixed(1)}%)
              </span>
            </div>
            <div className="fuel-bar">
              <div className="fuel-bar-fill" style={{ width: `${(selectedSat.fuel_kg / 50) * 100}%`, background: fuelColor((selectedSat.fuel_kg / 50) * 100) }} />
            </div>
          </div>
          {/* CDM for this satellite */}
          {sim.cdms.filter(c => c.satellite_id === selectedSatId).map((cdm, i) => (
            <div key={i} className="mt-2 p-2 rounded-sm border" style={{ borderColor: `${riskColor(cdm.risk_level)}30`, background: `${riskColor(cdm.risk_level)}08` }}>
              <div className="flex justify-between text-[9px]">
                <span className="font-orbitron" style={{ color: riskColor(cdm.risk_level) }}>{cdm.risk_level}</span>
                <span className="font-mono text-muted-foreground">T-{formatCountdown(cdm.tca_seconds)}</span>
              </div>
              <div className="text-[8px] text-muted-foreground mt-0.5">
                Miss: {cdm.miss_distance_km < 0.1 ? `${(cdm.miss_distance_km * 1000).toFixed(0)}m` : `${cdm.miss_distance_km.toFixed(2)}km`}
                {cdm.collision_probability > 0 && <span> · Pc: {cdm.collision_probability.toExponential(1)}</span>}
              </div>
              <button
                onClick={() => sim.triggerAutoEvade(cdm.satellite_id)}
                className="w-full mt-1.5 py-1 text-[8px] font-orbitron tracking-wider rounded-sm transition-all hover:scale-[1.02]"
                style={{ color: riskColor(cdm.risk_level), border: `1px solid ${riskColor(cdm.risk_level)}40`, background: `${riskColor(cdm.risk_level)}10` }}
              >
                ⚡ AUTO-EVADE
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Right CDM panel ═══ */}
      {sim.cdms.length > 0 && (
        <div className="absolute top-16 right-4 z-20 w-52 max-h-[60vh] overflow-y-auto">
          <div className="hud-panel p-2 bg-background/92 backdrop-blur-sm">
            <div className="text-[8px] text-muted-foreground tracking-[0.3em] mb-2 font-orbitron flex items-center gap-1">
              <span className="status-dot status-critical" />CDM ALERTS
            </div>
            {sim.cdms.slice(0, 8).map((cdm, i) => {
              const color = riskColor(cdm.risk_level);
              const isActive = cdm.satellite_id === selectedSatId;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedSatId(cdm.satellite_id)}
                  className={`w-full text-left text-[9px] py-1.5 border-t border-border/30 transition-colors hover:bg-primary/5 ${isActive ? 'bg-primary/5' : ''}`}
                  style={{ borderLeft: `2px solid ${color}`, paddingLeft: 6 }}
                >
                  <div className="flex justify-between mb-0.5">
                    <span className="font-orbitron" style={{ color }}>{cdm.risk_level}</span>
                    <span className="font-mono text-muted-foreground tabular-nums">T-{formatCountdown(cdm.tca_seconds)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground/60">
                    <span>{cdm.satellite_id}</span>
                    <span>{cdm.miss_distance_km < 0.1 ? `${(cdm.miss_distance_km * 1000).toFixed(0)}m` : `${cdm.miss_distance_km.toFixed(2)}km`}</span>
                  </div>
                  {(cdm.risk_level === 'CRITICAL' || cdm.risk_level === 'WARNING') && (
                    <button onClick={(e) => { e.stopPropagation(); sim.triggerAutoEvade(cdm.satellite_id); }}
                      className="w-full mt-1 py-0.5 text-[7px] font-orbitron tracking-wider border rounded-sm"
                      style={{ color, borderColor: `${color}50`, background: `${color}10` }}>
                      ⚡ EVADE
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Bottom controls ═══ */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-3 py-4 px-6 border-t border-border bg-background/85 backdrop-blur-sm">
        <button className="hud-btn text-[10px]" onClick={() => onNavigate('hero')}>◁ BACK</button>
        <div className="w-px h-6 bg-border/50" />
        <button className="hud-btn text-[10px]" onClick={() => onNavigate('dashboard')}>▦ DASHBOARD</button>
        <div className="w-px h-6 bg-border/50" />
        <button className={`hud-btn text-[10px] ${!sim.simRunning ? 'hud-btn-warning' : ''}`} onClick={() => sim.setSimRunning(!sim.simRunning)}>
          {sim.simRunning ? '⏸ PAUSE' : '▶ RESUME'}
        </button>
        <button className="hud-btn text-[10px]" onClick={() => sim.setSimSpeed(Math.min(sim.simSpeed * 2, 50))}>⏩ {sim.simSpeed}x</button>
        <button className="hud-btn text-[10px]" onClick={() => sim.setSimSpeed(1)}>↺ 1x</button>
        <div className="w-px h-6 bg-border/50" />
        <button className="hud-btn text-[10px]" onClick={() => setSatPanelOpen(!satPanelOpen)}>
          {satPanelOpen ? '◂ HIDE LIST' : '▸ SAT LIST'}
        </button>
      </div>
    </div>
  );
};

export default SimulationPage;
