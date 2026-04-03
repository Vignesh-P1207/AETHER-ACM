/**
 * AETHER ACM — GroundTrack Component
 * Canvas-based 2D Mercator ground track map with satellites, debris, ground stations.
 * Integrates with the existing ThemeContext for dynamic color theming.
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import { latLonToMercator, statusColor } from '@/utils/geo';
import { useTheme } from '@/contexts/ThemeContext';
import type { SatelliteData, DebrisData, GroundStationData, CDMData } from '@/hooks/useSimulation';

interface Props {
  satellites: SatelliteData[];
  debris: DebrisData[];
  groundStations: GroundStationData[];
  cdms: CDMData[];
  selectedSatId: string | null;
  onSelectSat: (id: string) => void;
}

export default function GroundTrack({ satellites, debris, groundStations, cdms, selectedSatId, onSelectSat }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 400 });
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);
  const trailsRef = useRef<Map<string, { x: number; y: number }[]>>(new Map());
  const { theme } = useTheme();

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const cdmSatIds = new Set(cdms.map(c => c.satellite_id));
  const primaryHex = theme.primaryHex;

  // Convert hex to rgba helper
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = size;
    canvas.width = w * window.devicePixelRatio;
    canvas.height = h * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    frameRef.current++;

    // Background
    ctx.fillStyle = 'hsl(170 100% 2%)';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = hexToRgba(primaryHex, 0.04);
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    // Coastlines
    drawWorldOutlines(ctx, w, h, primaryHex);

    // Equator
    ctx.strokeStyle = hexToRgba(primaryHex, 0.06);
    ctx.setLineDash([4, 4]);
    const eq = latLonToMercator(0, -180, w, h);
    ctx.beginPath(); ctx.moveTo(0, eq.y); ctx.lineTo(w, eq.y); ctx.stroke();
    ctx.setLineDash([]);

    // Ground stations
    groundStations.forEach(gs => {
      const { x, y } = latLonToMercator(gs.lat, gs.lon, w, h);

      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(primaryHex, 0.15);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = primaryHex;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing ring
      const pulseR = 3 + ((frameRef.current % 60) / 60) * 8;
      const pulseA = 1 - (frameRef.current % 60) / 60;
      ctx.strokeStyle = hexToRgba(primaryHex, pulseA * 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, pulseR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = hexToRgba(primaryHex, 0.5);
      ctx.font = '7px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(gs.name.replace(/_/g, ' '), x, y + 12);
    });

    // Debris cloud
    if (debris.length > 0) {
      ctx.fillStyle = 'rgba(255,80,60,0.3)';
      debris.forEach(d => {
        const { x, y } = latLonToMercator(d.lat, d.lon, w, h);
        ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
      });
    }

    // Satellites
    satellites.forEach(sat => {
      const { x, y } = latLonToMercator(sat.lat, sat.lon, w, h);
      const isSelected = sat.id === selectedSatId;
      const hasCDM = cdmSatIds.has(sat.id);
      const color = sat.status === 'NOMINAL' ? primaryHex : statusColor(sat.status);

      // Trail
      if (!trailsRef.current.has(sat.id)) trailsRef.current.set(sat.id, []);
      const trail = trailsRef.current.get(sat.id)!;
      trail.push({ x, y });
      if (trail.length > 60) trail.shift();

      if (trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = hexToRgba(color === primaryHex ? primaryHex : color, 0.3);
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // CDM warning halo
      if (hasCDM) {
        const haloR = 8 + Math.sin(frameRef.current * 0.1) * 3;
        ctx.beginPath();
        ctx.arc(x, y, haloR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,51,102,${0.4 + Math.sin(frameRef.current * 0.1) * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Station keeping circle
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(primaryHex, 0.3);
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Satellite dot
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Glow
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color === primaryHex ? primaryHex : color, 0.15);
      ctx.fill();

      // Label
      if (isSelected || hasCDM) {
        ctx.fillStyle = isSelected ? primaryHex : color;
        ctx.font = `${isSelected ? 9 : 7}px "Orbitron", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(sat.id, x, y - 8);
      }
    });

    // Terminator line
    const now = new Date();
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
    const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear + 284) * Math.PI) / 180);
    const hourAngle = ((now.getUTCHours() + now.getUTCMinutes() / 60) / 24) * 360 - 180;

    ctx.beginPath();
    for (let lon = -180; lon <= 180; lon += 2) {
      const termLat = Math.atan(-Math.cos((lon - hourAngle) * Math.PI / 180) / Math.tan(declination * Math.PI / 180)) * 180 / Math.PI;
      const { x, y } = latLonToMercator(termLat, lon, w, h);
      if (lon === -180) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(255,170,0,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    animRef.current = requestAnimationFrame(draw);
  }, [satellites, debris, groundStations, cdms, selectedSatId, size, primaryHex]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    let closest: string | null = null;
    let minDist = 15;
    satellites.forEach(sat => {
      const { x, y } = latLonToMercator(sat.lat, sat.lon, size.w, size.h);
      const d = Math.sqrt((cx - x) ** 2 + (cy - y) ** 2);
      if (d < minDist) { minDist = d; closest = sat.id; }
    });
    if (closest) onSelectSat(closest);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas ref={canvasRef} style={{ width: size.w, height: size.h }} onClick={handleClick} className="cursor-crosshair" />
      <div className="absolute top-2 left-3 text-[8px] font-orbitron text-muted-foreground tracking-[0.2em]">
        GROUND TRACK — MERCATOR
      </div>
      <div className="absolute bottom-2 right-3 flex gap-4 text-[8px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: primaryHex }} />SAT</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-500/40" />DEBRIS</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border" style={{ borderColor: `${primaryHex}66` }} />GS</span>
      </div>
    </div>
  );
}

function drawWorldOutlines(ctx: CanvasRenderingContext2D, w: number, h: number, primaryHex: string) {
  const r = parseInt(primaryHex.slice(1, 3), 16);
  const g = parseInt(primaryHex.slice(3, 5), 16);
  const b = parseInt(primaryHex.slice(5, 7), 16);
  const regions = [
    [[48,-125],[50,-95],[45,-65],[30,-80],[25,-100],[30,-118],[48,-125]],
    [[10,-75],[5,-35],[-15,-40],[-35,-55],[-55,-70],[-20,-70],[10,-75]],
    [[35,-10],[45,0],[55,10],[70,30],[60,40],[50,30],[40,25],[35,20],[35,-10]],
    [[35,10],[30,30],[10,40],[0,42],[-15,40],[-35,25],[-35,18],[-5,-10],[5,-15],[35,-5],[35,10]],
    [[30,30],[40,50],[50,60],[55,70],[60,90],[50,100],[35,105],[25,120],[40,130],[55,140],[70,140],[70,180],[50,160],[40,130],[20,100],[10,105],[5,80],[25,65],[30,50],[30,30]],
    [[-15,130],[-20,115],[-35,115],[-38,145],[-30,155],[-15,145],[-15,130]],
  ];
  ctx.strokeStyle = `rgba(${r},${g},${b},0.08)`;
  ctx.lineWidth = 0.8;
  regions.forEach(pts => {
    ctx.beginPath();
    pts.forEach(([lat, lon], i) => {
      const p = latLonToMercator(lat, lon, w, h);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = `rgba(${r},${g},${b},0.02)`;
    ctx.fill();
    ctx.stroke();
  });
}
