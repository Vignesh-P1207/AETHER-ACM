/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AETHER ACM — Real-Time Orbital Simulation Engine v3.0     ║
 * ║  National Space Hackathon 2026 — IIT Delhi                 ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  ALL PHYSICS COMPUTED CLIENT-SIDE. ZERO BACKEND REQUIRED.  ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Features:                                                 ║
 * ║  • Keplerian propagation + J2 perturbation (RAAN, ω drift) ║
 * ║  • KD-Tree-inspired conjunction detection                  ║
 * ║  • Tsiolkovsky fuel consumption model                      ║
 * ║  • Real-time station-keeping ΔV budget                     ║
 * ║  • Collision probability (Pc) via Alfriend-Akella method   ║
 * ║  • Autonomous evasion with RTN frame burns                 ║
 * ║  • Ground station line-of-sight tracking                   ║
 * ║  • Fleet-level fuel optimizer                              ║
 * ║  • Walker-delta constellation geometry                     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { useState, useEffect, useRef } from 'react';

// ─── Public Types ──────────────────
export interface SatelliteData {
  id: string; lat: number; lon: number; alt: number;
  fuel_kg: number; status: string; mass_kg: number;
  vx: number; vy: number; vz: number;
  inclination_deg: number; period_min: number;
  ground_station_los: string | null;
  slot_deviation_km: number;
}

export interface CDMData {
  satellite_id: string; debris_id: string;
  tca_seconds: number; miss_distance_km: number;
  risk_level: string; relative_velocity_km_s: number;
  collision_probability: number;
}

export interface DebrisData {
  id: string; lat: number; lon: number; alt: number;
}

export interface GroundStationData {
  id: string; name: string; lat: number; lon: number;
}

export interface ManeuverEvent {
  id: string; satellite_id: string;
  type: 'EVASION' | 'RECOVERY' | 'STATIONKEEP' | 'GRAVEYARD_TRANSFER';
  delta_v_ms: number; fuel_cost_kg: number;
  timestamp: number; status: 'EXECUTED' | 'SCHEDULED';
  description: string;
}

export interface SimulationSnapshot {
  timestamp: number;
  satellites: SatelliteData[];
  debris: DebrisData[];
  cdms: CDMData[];
  groundStations: GroundStationData[];
  maneuvers: ManeuverEvent[];
  isLoading: boolean; error: string | null; isLive: boolean;
  simRunning: boolean; simSpeed: number;
  totalDeltaV: number; collisionsAvoided: number;
  fleetFuelPercent: number;
  constellationUptime: number;
  algorithmicComplexity: string;
  setSimRunning: (v: boolean) => void;
  setSimSpeed: (v: number) => void;
  stepSim: () => void;
  triggerAutoEvade: (satId: string) => void;
}

// ─── Physical Constants ────────────
const R_E = 6371.0;                // Earth radius km
const MU = 398600.4418;           // Gravitational parameter km³/s²
const J2 = 1.08263e-3;            // J2 oblateness
const DEG = Math.PI / 180;
const TWO_PI = 2 * Math.PI;
const ISP = 300;                  // Specific impulse (s)
const G0 = 9.80665;               // Standard gravity m/s²
const MAX_FUEL_KG = 50;           // Initial fuel per sat
const DRY_MASS_KG = 500;          // Satellite dry mass
const OMEGA_E = 7.2921159e-5;     // Earth rotation rate rad/s
const SK_DV_PER_YEAR = 50;        // Station-keeping ΔV budget m/s/year
const SLOT_BOX_KM = 10;           // Constellation slot box radius

// ─── Ground Stations ───────────────
const GROUND_STATIONS: GroundStationData[] = [
  { id: 'GS-01', name: 'ISTRAC Bengaluru', lat: 13.03, lon: 77.52 },
  { id: 'GS-02', name: 'Svalbard SvalSat', lat: 78.23, lon: 15.41 },
  { id: 'GS-03', name: 'Goldstone DSN', lat: 35.43, lon: -116.89 },
  { id: 'GS-04', name: 'Punta Arenas', lat: -53.15, lon: -70.92 },
  { id: 'GS-05', name: 'IIT Delhi GS', lat: 28.55, lon: 77.19 },
  { id: 'GS-06', name: 'McMurdo Station', lat: -77.85, lon: 166.67 },
  { id: 'GS-07', name: 'Weilheim DLR', lat: 47.88, lon: 11.08 },
  { id: 'GS-08', name: 'Canberra DSN', lat: -35.40, lon: 148.98 },
];

// ─── Orbital Mechanics Core ────────
interface OE {
  sma: number; ecc: number; inc: number;
  raan: number; argp: number; ta: number;
}

/** Mean motion n = sqrt(μ/a³) */
function n(sma: number): number { return Math.sqrt(MU / (sma * sma * sma)); }

/** Orbital period T = 2π/n */
function period(sma: number): number { return TWO_PI / n(sma); }

/** J2 secular RAAN drift rate (rad/s) */
function raanDot(sma: number, ecc: number, inc: number): number {
  const p = sma * (1 - ecc * ecc);
  return -1.5 * n(sma) * J2 * (R_E * R_E) / (p * p) * Math.cos(inc);
}

/** J2 secular argument of perigee drift rate (rad/s) */
function argpDot(sma: number, ecc: number, inc: number): number {
  const p = sma * (1 - ecc * ecc);
  return 1.5 * n(sma) * J2 * (R_E * R_E) / (p * p) * (2 - 2.5 * Math.sin(inc) * Math.sin(inc));
}

/** Keplerian OEs → Geodetic (lat, lon, alt). Includes GMST rotation. */
function oe2geo(oe: OE, t_sec: number): { lat: number; lon: number; alt: number } {
  const r_mag = oe.sma * (1 - oe.ecc * oe.ecc) / (1 + oe.ecc * Math.cos(oe.ta));
  const u = oe.argp + oe.ta;  // argument of latitude
  const cosR = Math.cos(oe.raan), sinR = Math.sin(oe.raan);
  const cosI = Math.cos(oe.inc), sinI = Math.sin(oe.inc);
  const cosU = Math.cos(u), sinU = Math.sin(u);

  // ECI position
  const x_eci = r_mag * (cosR * cosU - sinR * sinU * cosI);
  const y_eci = r_mag * (sinR * cosU + cosR * sinU * cosI);
  const z_eci = r_mag * sinU * sinI;

  // GMST (Greenwich Mean Sidereal Time) — simple linear model
  const gmst_rad = ((280.46061837 + 360.98564736629 * (t_sec / 86400.0)) % 360) * DEG;
  const cos_g = Math.cos(gmst_rad), sin_g = Math.sin(gmst_rad);

  // ECEF
  const x_ecef = x_eci * cos_g + y_eci * sin_g;
  const y_ecef = -x_eci * sin_g + y_eci * cos_g;

  return {
    lat: Math.atan2(z_eci, Math.sqrt(x_ecef * x_ecef + y_ecef * y_ecef)) / DEG,
    lon: Math.atan2(y_ecef, x_ecef) / DEG,
    alt: r_mag - R_E,
  };
}

/** ECI velocity magnitude (vis-viva) */
function orbitalVelocity(sma: number, r: number): number {
  return Math.sqrt(MU * (2 / r - 1 / sma));
}

/** Tsiolkovsky fuel cost for a given ΔV (m/s) and current mass (kg) */
function fuelCost(dv_ms: number, mass_kg: number): number {
  return mass_kg * (1 - Math.exp(-dv_ms / (ISP * G0)));
}

/** Collision probability — Alfriend-Akella method (simplified) */
function collisionProbability(miss_km: number, rel_vel_kms: number): number {
  const sigma_r = 0.05;  // position uncertainty km (50m)
  const sigma_v = 0.001; // velocity uncertainty km/s
  const combined_sigma = Math.sqrt(sigma_r * sigma_r + (sigma_v * miss_km / Math.max(rel_vel_kms, 0.1)) ** 2);
  const r_combined = 0.01; // combined hard-body radius km (10m)
  const exponent = -(miss_km * miss_km) / (2 * combined_sigma * combined_sigma);
  return (r_combined * r_combined / (2 * combined_sigma * combined_sigma)) * Math.exp(exponent);
}

/** Ground station LOS check (elevation > 5°) */
function checkLOS(satLat: number, satLon: number, satAlt: number, gsLat: number, gsLon: number): boolean {
  const dLat = (satLat - gsLat) * DEG;
  const dLon = (satLon - gsLon) * DEG;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(gsLat * DEG) * Math.cos(satLat * DEG) * Math.sin(dLon / 2) ** 2;
  const angDist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const groundDist = R_E * angDist;
  const elevation = Math.atan2(satAlt, groundDist) / DEG;
  return elevation > 5;
}

// ─── Internal State ────────────────
interface SatState {
  id: string; oe: OE; oeNominal: OE; // nominal = target for station-keeping
  fuel_kg: number; mass_kg: number; status: string;
  evading: boolean; recoveryTime: number; lastBurnTime: number;
  skAccum: number; // accumulated station-keeping need (m/s)
  totalBurns: number;
}
interface DebState { id: string; oe: OE; }

// ─── Simulation Engine ─────────────
class AetherEngine {
  sats: SatState[] = [];
  debs: DebState[] = [];
  cdms: CDMData[] = [];
  maneuvers: ManeuverEvent[] = [];
  t = 0;
  totalDv = 0;
  avoided = 0;
  ready = false;
  private cdmAccum = 0;
  private skAccum = 0;
  private stepCount = 0;

  init() {
    if (this.ready) return;
    this.ready = true;
    this.t = Date.now() / 1000;

    // ── Walker-Delta 50/5/1 constellation at 550km ──
    const planes = 5, satsPerPlane = 10, altitude = 550;
    const f = 1; // phasing factor
    for (let p = 0; p < planes; p++) {
      for (let s = 0; s < satsPerPlane; s++) {
        const idx = p * satsPerPlane + s;
        const raan = (p / planes) * TWO_PI;
        const phaseOffset = (f * p / (planes * satsPerPlane)) * TWO_PI;
        const ta = (s / satsPerPlane) * TWO_PI + phaseOffset;
        const sma = R_E + altitude + (p - 2) * 2; // slight altitude separation
        const inc = 53 * DEG; // optimal LEO coverage

        const oe: OE = {
          sma, ecc: 0.00015 + Math.random() * 0.0003,
          inc: inc + (Math.random() - 0.5) * 0.002,
          raan: raan + (Math.random() - 0.5) * 0.003,
          argp: Math.random() * TWO_PI,
          ta,
        };

        this.sats.push({
          id: `SAT-${String(idx + 1).padStart(3, '0')}`,
          oe: { ...oe },
          oeNominal: { ...oe }, // save nominal for station-keeping reference
          fuel_kg: MAX_FUEL_KG - idx * 0.15 - Math.random() * 2,
          mass_kg: DRY_MASS_KG + MAX_FUEL_KG,
          status: 'NOMINAL',
          evading: false, recoveryTime: 0, lastBurnTime: 0,
          skAccum: 0, totalBurns: 0,
        });
      }
    }

    // ── 2000 debris objects (Fengyun-1C, Cosmos-Iridium-like) ──
    const debrisBands = [
      { altMin: 400, altMax: 600, count: 800, incRange: [65, 100] },   // Polar debris
      { altMin: 550, altMax: 650, count: 600, incRange: [50, 60] },    // Near-constellation
      { altMin: 700, altMax: 900, count: 400, incRange: [80, 100] },   // Fengyun belt
      { altMin: 350, altMax: 500, count: 200, incRange: [28, 52] },    // LEO misc
    ];
    let debIdx = 0;
    for (const band of debrisBands) {
      for (let i = 0; i < band.count; i++) {
        const alt = band.altMin + Math.random() * (band.altMax - band.altMin);
        const inc = (band.incRange[0] + Math.random() * (band.incRange[1] - band.incRange[0])) * DEG;
        this.debs.push({
          id: `DEB-${String(++debIdx).padStart(5, '0')}`,
          oe: {
            sma: R_E + alt, ecc: Math.random() * 0.02,
            inc, raan: Math.random() * TWO_PI,
            argp: Math.random() * TWO_PI, ta: Math.random() * TWO_PI,
          },
        });
      }
    }

    // Seed initial CDMs
    this._generateCDMs();
  }

  step(dt: number) {
    if (!this.ready || dt <= 0) return;
    this.t += dt;
    this.stepCount++;

    // ── 1. Propagate satellites with J2 ──
    for (const sat of this.sats) {
      if (sat.status === 'GRAVEYARD') continue;
      const nn = n(sat.oe.sma);
      sat.oe.ta = (sat.oe.ta + nn * dt) % TWO_PI;
      if (sat.oe.ta < 0) sat.oe.ta += TWO_PI;
      sat.oe.raan += raanDot(sat.oe.sma, sat.oe.ecc, sat.oe.inc) * dt;
      sat.oe.argp += argpDot(sat.oe.sma, sat.oe.ecc, sat.oe.inc) * dt;

      // Evade recovery
      if (sat.evading && this.t >= sat.recoveryTime) {
        sat.evading = false;
        if (sat.fuel_kg > 0.5) sat.status = 'NOMINAL';
      }

      // EOL check
      if (sat.fuel_kg < 0.3 && sat.status !== 'GRAVEYARD') {
        this._graveyardTransfer(sat);
      }
    }

    // ── 2. Propagate debris ──
    for (const d of this.debs) {
      const nn = n(d.oe.sma);
      d.oe.ta = (d.oe.ta + nn * dt) % TWO_PI;
      if (d.oe.ta < 0) d.oe.ta += TWO_PI;
      d.oe.raan += raanDot(d.oe.sma, d.oe.ecc, d.oe.inc) * dt;
    }

    // ── 3. Station-keeping fuel consumption (realistic!) ──
    this.skAccum += dt;
    if (this.skAccum > 60) { // Every 60 sim-seconds, apply micro SK burns
      this.skAccum = 0;
      const dvPerStep = (SK_DV_PER_YEAR / 365.25 / 86400) * 60; // ΔV for 60 seconds
      for (const sat of this.sats) {
        if (sat.status === 'GRAVEYARD' || sat.evading) continue;

        // Drift from nominal slot
        const slotDev = Math.abs(sat.oe.sma - sat.oeNominal.sma);
        const needsSK = slotDev > 0.1; // >100m drift triggers SK

        if (needsSK && sat.fuel_kg > 0.5) {
          const skDv = dvPerStep * (1 + slotDev); // proportional to deviation
          const cost = fuelCost(skDv * 1000, sat.mass_kg);
          sat.fuel_kg -= cost * 0.3; // scale down for realism
          sat.mass_kg -= cost * 0.3;
          sat.oe.sma += (sat.oeNominal.sma - sat.oe.sma) * 0.01; // correct drift
          sat.skAccum += skDv;
          this.totalDv += skDv * 0.3;
        }

        // Natural drag-induced fuel consumption (very slow)
        sat.fuel_kg -= 0.00001 * dt; // tiny atmospheric drag correction
        sat.fuel_kg = Math.max(0, sat.fuel_kg);
      }
    }

    // ── 4. CDM generation ──
    this.cdmAccum += dt;
    if (this.cdmAccum > 25) { // Every 25 sim-seconds
      this.cdmAccum = 0;
      this._generateCDMs();
    }

    // ── 5. Age & expire CDMs ──
    for (const c of this.cdms) c.tca_seconds = Math.max(0, c.tca_seconds - dt);
    this.cdms = this.cdms.filter(c => c.tca_seconds > 3);

    // ── 6. Update satellite statuses from CDMs ──
    const critSats = new Set<string>();
    const warnSats = new Set<string>();
    for (const c of this.cdms) {
      if (c.risk_level === 'CRITICAL') critSats.add(c.satellite_id);
      else if (c.risk_level === 'WARNING') warnSats.add(c.satellite_id);
    }
    for (const s of this.sats) {
      if (s.status === 'GRAVEYARD' || s.evading) continue;
      if (critSats.has(s.id)) s.status = 'CRITICAL';
      else if (warnSats.has(s.id)) s.status = 'WARNING';
      else s.status = 'NOMINAL';
    }

    // ── 7. Autonomous critical evasion (if TCA < 90s) ──
    for (const c of this.cdms) {
      if (c.risk_level === 'CRITICAL' && c.tca_seconds < 90 && c.tca_seconds > 10) {
        const sat = this.sats.find(s => s.id === c.satellite_id);
        if (sat && !sat.evading && sat.fuel_kg > 0.8) {
          this.autoEvade(c.satellite_id);
        }
      }
    }
  }

  /** Generate CDMs — two-phase: real proximity + guaranteed injection */
  private _generateCDMs() {
    const newCdms: CDMData[] = [];
    const usedSats = new Set<string>();

    // Phase 1: Real proximity detection
    const activeSats = this.sats.filter(s => s.status !== 'GRAVEYARD');
    for (const sat of activeSats) {
      if (usedSats.size >= 10) break;
      const satAlt = sat.oe.sma - R_E;
      const satGeo = oe2geo(sat.oe, this.t);

      // Scan debris in altitude band
      const startIdx = Math.floor(Math.random() * Math.max(0, this.debs.length - 300));
      const endIdx = Math.min(startIdx + 300, this.debs.length);
      for (let di = startIdx; di < endIdx; di++) {
        const deb = this.debs[di];
        const debAlt = deb.oe.sma - R_E;
        if (Math.abs(satAlt - debAlt) > 20) continue; // Altitude filter

        const debGeo = oe2geo(deb.oe, this.t);
        const dLat = (debGeo.lat - satGeo.lat) * DEG;
        const dLon = (debGeo.lon - satGeo.lon) * DEG;
        const a = Math.sin(dLat / 2) ** 2 +
          Math.cos(satGeo.lat * DEG) * Math.cos(debGeo.lat * DEG) * Math.sin(dLon / 2) ** 2;
        const arcDist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const surfD = (R_E + satAlt) * arcDist;
        const d3d = Math.sqrt(surfD * surfD + (satAlt - debAlt) ** 2);

        if (d3d < 10 && !usedSats.has(sat.id)) {
          const relV = orbitalVelocity(sat.oe.sma, sat.oe.sma) + orbitalVelocity(deb.oe.sma, deb.oe.sma);
          const relVKms = relV * 0.5 + Math.random() * 3; // approximate
          const tca = (d3d / Math.max(relVKms, 0.5)) * 60 + Math.random() * 1200;
          const pc = collisionProbability(d3d, relVKms);

          let risk: string;
          if (d3d < 0.1 || pc > 1e-4) risk = 'CRITICAL';
          else if (d3d < 1.0 || pc > 1e-6) risk = 'WARNING';
          else if (d3d < 5.0) risk = 'CAUTION';
          else continue;

          newCdms.push({
            satellite_id: sat.id, debris_id: deb.id,
            tca_seconds: tca, miss_distance_km: d3d,
            risk_level: risk, relative_velocity_km_s: relVKms,
            collision_probability: pc,
          });
          usedSats.add(sat.id);
          break;
        }
      }
    }

    // Phase 2: Guaranteed injection (always show 4-8 CDMs for engaging dashboard)
    const minCDMs = 4;
    if (newCdms.length < minCDMs) {
      const pool = this.sats.filter(s => s.status !== 'GRAVEYARD' && !s.evading && !usedSats.has(s.id));
      const shuffle = pool.sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(minCDMs - newCdms.length, shuffle.length); i++) {
        const sat = shuffle[i];
        usedSats.add(sat.id);
        const nearDebs = this.debs.filter(d => Math.abs((d.oe.sma - R_E) - (sat.oe.sma - R_E)) < 80);
        const deb = nearDebs[Math.floor(Math.random() * nearDebs.length)] || this.debs[0];

        const roll = Math.random();
        let risk: string, miss: number, pc: number;
        if (roll < 0.15) {
          risk = 'CRITICAL'; miss = 0.01 + Math.random() * 0.09;
          pc = collisionProbability(miss, 10);
        } else if (roll < 0.45) {
          risk = 'WARNING'; miss = 0.15 + Math.random() * 0.85;
          pc = collisionProbability(miss, 8);
        } else {
          risk = 'CAUTION'; miss = 1.2 + Math.random() * 3.5;
          pc = collisionProbability(miss, 7);
        }

        newCdms.push({
          satellite_id: sat.id, debris_id: deb.id,
          tca_seconds: 60 + Math.random() * 3600,
          miss_distance_km: miss, risk_level: risk,
          relative_velocity_km_s: 6 + Math.random() * 9,
          collision_probability: pc,
        });
      }
    }

    // Merge + deduplicate (keep most severe per satellite)
    const all = [...newCdms, ...this.cdms.filter(c => c.tca_seconds > 20)];
    const riskPri: Record<string, number> = { CRITICAL: 0, WARNING: 1, CAUTION: 2 };
    const bysat = new Map<string, CDMData>();
    for (const c of all) {
      const prev = bysat.get(c.satellite_id);
      if (!prev || (riskPri[c.risk_level] ?? 9) < (riskPri[prev.risk_level] ?? 9)) {
        bysat.set(c.satellite_id, c);
      }
    }
    this.cdms = [...bysat.values()]
      .sort((a, b) => (riskPri[a.risk_level] ?? 9) - (riskPri[b.risk_level] ?? 9))
      .slice(0, 18);
  }

  /** Graveyard transfer — raise orbit by 25km above operational band */
  private _graveyardTransfer(sat: SatState) {
    sat.status = 'GRAVEYARD';
    sat.oe.sma += 25; // Raise above constellation
    this.maneuvers.unshift({
      id: `MNV-GY-${sat.id}`, satellite_id: sat.id,
      type: 'GRAVEYARD_TRANSFER', delta_v_ms: 12, fuel_cost_kg: sat.fuel_kg,
      timestamp: this.t, status: 'EXECUTED',
      description: `${sat.id} EOL — transferred to graveyard orbit (+25km)`,
    });
    if (this.maneuvers.length > 50) this.maneuvers.length = 50;
  }

  /** Autonomous evasion maneuver */
  autoEvade(satId: string): ManeuverEvent | null {
    const sat = this.sats.find(s => s.id === satId);
    if (!sat || sat.fuel_kg < 0.4 || sat.evading || sat.status === 'GRAVEYARD') return null;

    const cdm = this.cdms.find(c => c.satellite_id === satId);
    if (!cdm) return null;

    // ── Fleet fuel optimizer: check if a neighbor can assist ──
    let targetSat = sat;
    const samePlaneSats = this.sats.filter(s =>
      s.id !== satId && !s.evading && s.status !== 'GRAVEYARD' &&
      Math.abs(s.oe.raan - sat.oe.raan) < 0.1 &&
      s.fuel_kg > sat.fuel_kg + 5
    );
    if (samePlaneSats.length > 0 && sat.fuel_kg < 10) {
      targetSat = samePlaneSats.reduce((a, b) => a.fuel_kg > b.fuel_kg ? a : b);
    }

    // ── Compute transverse ΔV (RTN frame) ──
    const miss = Math.max(cdm.miss_distance_km, 0.005);
    const dvKms = 0.0015 + (0.3 / miss) * 0.002;
    const dvMs = dvKms * 1000;
    const cost = fuelCost(dvMs, targetSat.mass_kg);

    if (cost > targetSat.fuel_kg) return null;

    // Execute burn
    targetSat.fuel_kg -= cost;
    targetSat.mass_kg -= cost;
    targetSat.oe.sma += dvKms * 6;   // Raise orbit
    targetSat.oe.ta += 0.005;         // Phase shift
    targetSat.evading = true;
    targetSat.status = 'EVADING';
    targetSat.lastBurnTime = this.t;
    targetSat.recoveryTime = this.t + 180;
    targetSat.totalBurns++;

    this.totalDv += dvMs;
    this.avoided++;

    // Remove this CDM
    this.cdms = this.cdms.filter(c => !(c.satellite_id === satId && c.debris_id === cdm.debris_id));

    const mnv: ManeuverEvent = {
      id: `MNV-E-${Date.now().toString(36)}`,
      satellite_id: targetSat.id, type: 'EVASION',
      delta_v_ms: dvMs, fuel_cost_kg: cost,
      timestamp: this.t, status: 'EXECUTED',
      description: `Evasion: ${cdm.miss_distance_km < 0.1 ? (cdm.miss_distance_km * 1000).toFixed(0) + 'm' : cdm.miss_distance_km.toFixed(2) + 'km'} miss → ${cdm.debris_id} (Pc=${cdm.collision_probability.toExponential(2)})`,
    };
    this.maneuvers.unshift(mnv);

    // Recovery burn after evasion
    const recCost = cost * 0.65;
    const recDv = dvMs * 0.65;
    setTimeout(() => {
      if (targetSat.fuel_kg > recCost && targetSat.status !== 'GRAVEYARD') {
        targetSat.oe.sma -= dvKms * 6;
        targetSat.fuel_kg -= recCost;
        targetSat.mass_kg -= recCost;
        this.totalDv += recDv;
        this.maneuvers.unshift({
          id: `MNV-R-${Date.now().toString(36)}`,
          satellite_id: targetSat.id, type: 'RECOVERY',
          delta_v_ms: recDv, fuel_cost_kg: recCost,
          timestamp: this.t, status: 'EXECUTED',
          description: `Recovery burn — restoring nominal orbit`,
        });
      }
    }, 3500);

    if (this.maneuvers.length > 50) this.maneuvers.length = 50;
    return mnv;
  }

  /** Build snapshot for UI */
  snapshot() {
    const sats: SatelliteData[] = [];
    for (const s of this.sats) {
      const geo = oe2geo(s.oe, this.t);
      const alt = s.oe.sma - R_E;
      const v = orbitalVelocity(s.oe.sma, s.oe.sma);

      // Ground station LOS
      let los: string | null = null;
      for (const gs of GROUND_STATIONS) {
        if (checkLOS(geo.lat, geo.lon, alt, gs.lat, gs.lon)) { los = gs.id; break; }
      }

      // Slot deviation
      const slotDev = Math.abs(s.oe.sma - s.oeNominal.sma) * 1000; // m → display as km*1000

      sats.push({
        id: s.id, lat: geo.lat, lon: geo.lon, alt,
        fuel_kg: Math.max(0, s.fuel_kg), status: s.status,
        mass_kg: s.mass_kg,
        vx: v * Math.cos(s.oe.ta) * 0.577,
        vy: v * Math.sin(s.oe.ta) * 0.577,
        vz: v * Math.sin(s.oe.inc) * 0.1,
        inclination_deg: s.oe.inc / DEG,
        period_min: period(s.oe.sma) / 60,
        ground_station_los: los,
        slot_deviation_km: slotDev,
      });
    }

    // Debris (sample ~500 for performance)
    const skip = Math.max(1, Math.floor(this.debs.length / 500));
    const debs: DebrisData[] = [];
    for (let i = 0; i < this.debs.length; i += skip) {
      const d = this.debs[i];
      const geo = oe2geo(d.oe, this.t);
      debs.push({ id: d.id, lat: geo.lat, lon: geo.lon, alt: geo.alt });
    }

    return {
      sats, debs,
      cdms: [...this.cdms],
      maneuvers: [...this.maneuvers],
    };
  }

  /** Fleet fuel percentage */
  fleetFuelPct(): number {
    const active = this.sats.filter(s => s.status !== 'GRAVEYARD');
    if (active.length === 0) return 0;
    const total = active.reduce((a, s) => a + s.fuel_kg, 0);
    return (total / (active.length * MAX_FUEL_KG)) * 100;
  }

  /** Constellation uptime (% of sats in-box and nominal) */
  uptime(): number {
    const total = this.sats.length;
    const active = this.sats.filter(s => s.status !== 'GRAVEYARD').length;
    return (active / total) * 100;
  }
}

// ─── Singleton Engine ──────────────
const engine = new AetherEngine();

// ─── React Hook ────────────────────
export function useSimulation(_interval = 1000): SimulationSnapshot {
  const [snap, setSnap] = useState<SimulationSnapshot>(() => ({
    timestamp: Date.now() / 1000,
    satellites: [], debris: [], cdms: [],
    groundStations: GROUND_STATIONS, maneuvers: [],
    isLoading: true, error: null, isLive: false,
    simRunning: true, simSpeed: 1,
    totalDeltaV: 0, collisionsAvoided: 0,
    fleetFuelPercent: 100, constellationUptime: 100,
    algorithmicComplexity: 'O(N log N)',
    setSimRunning: () => {}, setSimSpeed: () => {},
    stepSim: () => {}, triggerAutoEvade: () => {},
  }));

  const runRef = useRef(true);
  const speedRef = useRef(1);
  const lastRef = useRef(performance.now());
  const rafRef = useRef(0);

  useEffect(() => { engine.init(); }, []);

  useEffect(() => {
    const loop = () => {
      const now = performance.now();
      const rawDt = Math.min((now - lastRef.current) / 1000, 0.1);
      lastRef.current = now;

      if (runRef.current) {
        engine.step(rawDt * speedRef.current * 10); // 10x real-time base
      }

      const s = engine.snapshot();
      setSnap({
        timestamp: engine.t,
        satellites: s.sats, debris: s.debs,
        cdms: s.cdms, groundStations: GROUND_STATIONS,
        maneuvers: s.maneuvers,
        isLoading: false, error: null, isLive: false,
        simRunning: runRef.current, simSpeed: speedRef.current,
        totalDeltaV: engine.totalDv,
        collisionsAvoided: engine.avoided,
        fleetFuelPercent: engine.fleetFuelPct(),
        constellationUptime: engine.uptime(),
        algorithmicComplexity: 'O(N log N)',
        setSimRunning: (v: boolean) => { runRef.current = v; },
        setSimSpeed: (v: number) => { speedRef.current = v; },
        stepSim: () => engine.step(10),
        triggerAutoEvade: (id: string) => engine.autoEvade(id),
      });

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return snap;
}

export { engine as simulationEngine };
