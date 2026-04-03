/**
 * Geo utility helpers — Mercator projection, formatting, color maps.
 */

export function latLonToMercator(lat: number, lon: number, width: number, height: number) {
  const x = ((lon + 180) / 360) * width;
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = height / 2 - (mercN * width) / (2 * Math.PI);
  return { x, y: Math.max(0, Math.min(height, y)) };
}

export function formatCountdown(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function riskColor(level: string): string {
  switch (level) {
    case 'CRITICAL': return '#ff3366';
    case 'WARNING': return '#ffaa00';
    case 'CAUTION': return '#ffd700';
    default: return '#00ff88';
  }
}

export function statusColor(status: string): string {
  switch (status) {
    case 'NOMINAL': return '#00ff88';
    case 'WARNING': return '#ffaa00';
    case 'CRITICAL': return '#ff3366';
    case 'EVADING': return '#00d4ff';
    case 'GRAVEYARD': return '#666666';
    default: return '#00ff88';
  }
}

export function fuelColor(percent: number): string {
  if (percent > 50) return '#00ff88';
  if (percent > 20) return '#ffaa00';
  if (percent > 5) return '#ff3366';
  return '#ff0000';
}
