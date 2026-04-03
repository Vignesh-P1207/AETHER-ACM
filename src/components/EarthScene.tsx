/**
 * AETHER ACM — EarthScene (Performance Optimized)
 * ================================================
 * Procedural Earth with realistic continents, smooth rotation,
 * InstancedMesh debris, and delta-time animation.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useTheme } from '@/contexts/ThemeContext';

interface EarthSceneProps {
  showSatellites?: boolean;
  showDebris?: boolean;
  paused?: boolean;
  speed?: number;
  onSatelliteClick?: (satData: { id: string; fuel: number; status: string; period: number }) => void;
}

// ─── Procedural Earth Texture (Equirectangular) ──────
function createEarthTexture(size = 1024): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = size;
  const h = size / 2;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Deep ocean gradient
  const oceanGrad = ctx.createRadialGradient(w * 0.65, h * 0.35, 0, w * 0.5, h * 0.5, w * 0.7);
  oceanGrad.addColorStop(0, '#1a4a7a');
  oceanGrad.addColorStop(0.3, '#14365c');
  oceanGrad.addColorStop(0.7, '#0e2a4a');
  oceanGrad.addColorStop(1, '#0a1e36');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, w, h);

  // Ocean depth variation
  for (let i = 0; i < 3000; i++) {
    const ox = Math.random() * w;
    const oy = Math.random() * h;
    const or = Math.random() * 8 + 1;
    ctx.beginPath();
    ctx.arc(ox, oy, or, 0, Math.PI * 2);
    const hue = 195 + Math.random() * 25;
    const light = 15 + Math.random() * 10;
    ctx.fillStyle = `hsla(${hue}, 55%, ${light}%, ${0.04 + Math.random() * 0.06})`;
    ctx.fill();
  }

  // ── Realistic continent shapes (equirectangular projection) ──
  function drawContinent(paths: number[][], baseColor: string, variation: string) {
    ctx.beginPath();
    const startX = paths[0][0] * w;
    const startY = paths[0][1] * h;
    ctx.moveTo(startX, startY);

    for (let i = 1; i < paths.length; i++) {
      const px = paths[i][0] * w;
      const py = paths[i][1] * h;
      const cpx = (paths[i - 1][0] * w + px) / 2 + (Math.random() - 0.5) * 4;
      const cpy = (paths[i - 1][1] * h + py) / 2 + (Math.random() - 0.5) * 3;
      ctx.quadraticCurveTo(cpx, cpy, px, py);
    }
    ctx.closePath();

    // Base fill
    ctx.fillStyle = baseColor;
    ctx.fill();

    // Save continent path for detail overlay
    ctx.save();
    ctx.clip();

    // Terrain noise inside continent
    for (let j = 0; j < 600; j++) {
      const pi = Math.floor(Math.random() * paths.length);
      const pi2 = (pi + 1) % paths.length;
      const t = Math.random();
      const nx = (paths[pi][0] * (1 - t) + paths[pi2][0] * t) * w + (Math.random() - 0.5) * 50;
      const ny = (paths[pi][1] * (1 - t) + paths[pi2][1] * t) * h + (Math.random() - 0.5) * 40;
      ctx.beginPath();
      ctx.arc(nx, ny, Math.random() * 4 + 0.5, 0, Math.PI * 2);
      ctx.fillStyle = variation;
      ctx.fill();
    }

    // Mountain/highland dots
    for (let j = 0; j < 200; j++) {
      const pi = Math.floor(Math.random() * paths.length);
      const nx = paths[pi][0] * w + (Math.random() - 0.5) * 30;
      const ny = paths[pi][1] * h + (Math.random() - 0.5) * 20;
      ctx.beginPath();
      ctx.arc(nx, ny, Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${35 + Math.random() * 30}, ${20 + Math.random() * 15}%, ${30 + Math.random() * 15}%, 0.2)`;
      ctx.fill();
    }

    ctx.restore();
  }

  // North America
  drawContinent([
    [0.08, 0.15], [0.06, 0.18], [0.04, 0.22], [0.05, 0.28], [0.08, 0.32],
    [0.10, 0.36], [0.14, 0.40], [0.16, 0.42], [0.19, 0.40], [0.20, 0.38],
    [0.22, 0.34], [0.21, 0.30], [0.19, 0.26], [0.18, 0.22], [0.16, 0.18],
    [0.15, 0.15], [0.12, 0.12], [0.10, 0.13],
  ], '#2a5e20', 'hsla(110, 35%, 28%, 0.15)');

  // South America
  drawContinent([
    [0.18, 0.50], [0.17, 0.54], [0.16, 0.58], [0.17, 0.64], [0.18, 0.70],
    [0.20, 0.76], [0.21, 0.80], [0.22, 0.78], [0.23, 0.72], [0.24, 0.66],
    [0.23, 0.60], [0.22, 0.54], [0.21, 0.50], [0.19, 0.48],
  ], '#2d6a22', 'hsla(120, 40%, 22%, 0.15)');

  // Europe
  drawContinent([
    [0.44, 0.16], [0.43, 0.19], [0.44, 0.22], [0.46, 0.26], [0.48, 0.28],
    [0.50, 0.30], [0.52, 0.29], [0.53, 0.26], [0.52, 0.22], [0.50, 0.19],
    [0.48, 0.17], [0.46, 0.15],
  ], '#3a6830', 'hsla(100, 30%, 32%, 0.15)');

  // Africa
  drawContinent([
    [0.46, 0.34], [0.44, 0.38], [0.43, 0.44], [0.44, 0.50], [0.46, 0.58],
    [0.48, 0.64], [0.50, 0.68], [0.52, 0.66], [0.54, 0.60], [0.55, 0.54],
    [0.56, 0.48], [0.55, 0.42], [0.53, 0.38], [0.51, 0.34], [0.49, 0.32],
  ], '#5a7a2e', 'hsla(60, 40%, 35%, 0.12)');

  // Asia (large landmass)
  drawContinent([
    [0.54, 0.14], [0.58, 0.13], [0.64, 0.14], [0.70, 0.16], [0.76, 0.18],
    [0.80, 0.22], [0.82, 0.28], [0.80, 0.34], [0.76, 0.38], [0.72, 0.40],
    [0.68, 0.42], [0.64, 0.40], [0.60, 0.38], [0.56, 0.34], [0.54, 0.30],
    [0.53, 0.24], [0.52, 0.18],
  ], '#3d6430', 'hsla(90, 30%, 30%, 0.12)');

  // India subcontinent
  drawContinent([
    [0.64, 0.38], [0.63, 0.42], [0.64, 0.48], [0.65, 0.52], [0.67, 0.50],
    [0.68, 0.46], [0.67, 0.40],
  ], '#4a7228', 'hsla(95, 35%, 30%, 0.15)');

  // Australia
  drawContinent([
    [0.78, 0.58], [0.76, 0.62], [0.77, 0.68], [0.80, 0.72], [0.84, 0.72],
    [0.87, 0.68], [0.88, 0.63], [0.86, 0.58], [0.82, 0.56],
  ], '#7a6e2e', 'hsla(42, 45%, 35%, 0.15)');

  // Antarctica
  drawContinent([
    [0.0, 0.90], [0.15, 0.91], [0.30, 0.93], [0.50, 0.94], [0.70, 0.93],
    [0.85, 0.91], [1.0, 0.90], [1.0, 1.0], [0.0, 1.0],
  ], '#c8d8e8', 'hsla(210, 30%, 85%, 0.2)');

  // Greenland / Arctic islands
  drawContinent([
    [0.24, 0.08], [0.22, 0.10], [0.22, 0.14], [0.24, 0.17], [0.27, 0.17],
    [0.29, 0.14], [0.29, 0.10], [0.27, 0.08],
  ], '#b8c8d6', 'hsla(200, 20%, 78%, 0.2)');

  // ── Polar ice caps ──
  const northCap = ctx.createLinearGradient(0, 0, 0, h * 0.06);
  northCap.addColorStop(0, 'rgba(200, 220, 245, 0.55)');
  northCap.addColorStop(1, 'rgba(200, 220, 245, 0)');
  ctx.fillStyle = northCap;
  ctx.fillRect(0, 0, w, h * 0.06);

  // ── Wispy cloud layer ──
  for (let i = 0; i < 60; i++) {
    const cx = Math.random() * w;
    const cy = h * 0.15 + Math.random() * h * 0.7;
    const rx = 15 + Math.random() * 40;
    const ry = 2 + Math.random() * 5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.02 + Math.random() * 0.04})`;
    ctx.fill();
  }

  // ── Subtle grid lines for realism ──
  ctx.strokeStyle = 'rgba(100, 160, 220, 0.04)';
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 18; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (h / 18) * i);
    ctx.lineTo(w, (h / 18) * i);
    ctx.stroke();
  }
  for (let i = 1; i < 36; i++) {
    ctx.beginPath();
    ctx.moveTo((w / 36) * i, 0);
    ctx.lineTo((w / 36) * i, h);
    ctx.stroke();
  }

  return canvas;
}

const EarthScene = ({ showSatellites = true, showDebris = true, paused = false, speed = 1 }: EarthSceneProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);

  useEffect(() => { themeRef.current = theme; }, [theme]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    earth: THREE.Mesh;
    atmosphere: THREE.Mesh;
    cloudLayer: THREE.Mesh;
    rings: THREE.Mesh[];
    satellites: THREE.Points | null;
    debris: THREE.Points | null;
    stars: THREE.Points;
    pointLight: THREE.PointLight;
    animId: number;
    clock: THREE.Clock;
    elapsedTime: number;
  } | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 1.5, 7.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const themeHex = parseInt(themeRef.current.primaryHex.replace('#', ''), 16);
    const clock = new THREE.Clock();

    // ── Lights ──
    const ambient = new THREE.AmbientLight(0x334466, 0.6);
    scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.5);
    sunLight.position.set(5, 3, 4);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x4488cc, 0.3);
    rimLight.position.set(-4, -1, -3);
    scene.add(rimLight);

    const pointLight = new THREE.PointLight(themeHex, 0.25, 20);
    pointLight.position.set(-3, 2, -3);
    scene.add(pointLight);

    // ── Earth ──
    const earthGeo = new THREE.SphereGeometry(2, 96, 64);
    const earthTex = new THREE.CanvasTexture(createEarthTexture(1024));
    earthTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTex,
      bumpMap: earthTex,
      bumpScale: 0.03,
      specular: 0x222244,
      shininess: 15,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // ── Atmosphere glow ──
    const atmosGeo = new THREE.SphereGeometry(2.08, 64, 64);
    const atmosMat = new THREE.MeshPhongMaterial({
      color: 0x4488cc, transparent: true, opacity: 0.06,
      side: THREE.BackSide, depthWrite: false,
    });
    const atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosphere);

    // ── Cloud layer (separate sphere rotating slightly faster) ──
    const cloudGeo = new THREE.SphereGeometry(2.03, 48, 32);
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 512; cloudCanvas.height = 256;
    const cctx = cloudCanvas.getContext('2d')!;
    cctx.clearRect(0, 0, 512, 256);
    for (let i = 0; i < 120; i++) {
      cctx.beginPath();
      cctx.ellipse(
        Math.random() * 512, Math.random() * 256,
        8 + Math.random() * 35, 2 + Math.random() * 8,
        Math.random() * Math.PI, 0, Math.PI * 2
      );
      cctx.fillStyle = `rgba(255, 255, 255, ${0.04 + Math.random() * 0.06})`;
      cctx.fill();
    }
    const cloudTex = new THREE.CanvasTexture(cloudCanvas);
    const cloudMat = new THREE.MeshPhongMaterial({
      map: cloudTex, transparent: true, opacity: 0.35,
      depthWrite: false, side: THREE.FrontSide,
    });
    const cloudLayer = new THREE.Mesh(cloudGeo, cloudMat);
    scene.add(cloudLayer);

    // ── Orbit rings ──
    const rings: THREE.Mesh[] = [];
    [2.8, 3.4, 4.0].forEach((r, i) => {
      const geo = new THREE.TorusGeometry(r, 0.006, 4, 100);
      const mat = new THREE.MeshBasicMaterial({
        color: themeHex, transparent: true, opacity: 0.10 + i * 0.03, depthWrite: false,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2 + (i - 1) * 0.25;
      ring.rotation.y = i * 0.35;
      scene.add(ring);
      rings.push(ring);
    });

    // ── Visual Satellites (GPU only, zero JS lag) ──
    let satellites: THREE.Points | null = null;
    if (showSatellites) {
      const satGeo = new THREE.BufferGeometry();
      const satCount = 200;
      const satVerts = new Float32Array(satCount * 3);
      for (let i = 0; i < satCount; i++) {
        const r = 2.4 + Math.random() * 1.5;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        satVerts[i*3] = r * Math.sin(phi) * Math.cos(theta);
        satVerts[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        satVerts[i*3+2] = r * Math.cos(phi);
      }
      satGeo.setAttribute('position', new THREE.BufferAttribute(satVerts, 3));
      satellites = new THREE.Points(satGeo, new THREE.PointsMaterial({
        color: themeHex, size: 0.04, transparent: true, opacity: 0.9, sizeAttenuation: true
      }));
      scene.add(satellites);
    }

    // ── Visual Debris (GPU only, zero JS lag) ──
    let debris: THREE.Points | null = null;
    if (showDebris) {
      const debGeo = new THREE.BufferGeometry();
      const debCount = 1500;
      const debVerts = new Float32Array(debCount * 3);
      for (let i = 0; i < debCount; i++) {
        const r = 2.2 + Math.random() * 2.5;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        debVerts[i*3] = r * Math.sin(phi) * Math.cos(theta);
        debVerts[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        debVerts[i*3+2] = r * Math.cos(phi);
      }
      debGeo.setAttribute('position', new THREE.BufferAttribute(debVerts, 3));
      debris = new THREE.Points(debGeo, new THREE.PointsMaterial({
        color: 0xff4444, size: 0.015, transparent: true, opacity: 0.8, sizeAttenuation: true
      }));
      scene.add(debris);
    }

    // ── Stars ──
    const starGeo = new THREE.BufferGeometry();
    const starVerts = new Float32Array(2000 * 3);
    for (let i = 0; i < starVerts.length; i += 3) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 40 + Math.random() * 60;
      starVerts[i] = r * Math.sin(phi) * Math.cos(theta);
      starVerts[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      starVerts[i + 2] = r * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starVerts, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xccddff, size: 0.08, sizeAttenuation: true,
    }));
    scene.add(stars);

    sceneRef.current = {
      scene, camera, renderer, earth, atmosphere, cloudLayer,
      rings, satellites, debris, stars, pointLight, animId: 0, clock, elapsedTime: 0,
    };

    // ── Animation Loop ──
    const EARTH_ROTATION_SPEED = 0.08;   // rad/s base rotation — always smooth
    const CLOUD_ROTATION_SPEED = 0.11;   // clouds rotate slightly faster

    let lastTime = performance.now() * 0.001;

    const animate = (time: number) => {
      const rawTimeSeconds = time * 0.001;
      const rawDt = Math.min(rawTimeSeconds - lastTime, 0.05); // Cap dt to avoid jumps when tab is hidden
      lastTime = rawTimeSeconds;

      const effectiveSpeed = pausedRef.current ? 0 : speedRef.current;
      const dt = rawDt * effectiveSpeed;

      sceneRef.current!.elapsedTime += dt;
      const simTime = sceneRef.current!.elapsedTime;

      // ── Earth rotation: smooth steady spin based purely on real time ──
      earth.rotation.y = rawTimeSeconds * EARTH_ROTATION_SPEED + simTime * 0.06;
      cloudLayer.rotation.y = rawTimeSeconds * CLOUD_ROTATION_SPEED + simTime * 0.08;

      // Subtle axial tilt wobble
      earth.rotation.x = 0.15 * Math.sin(earth.rotation.y * 0.05);

      // Atmosphere follows earth
      atmosphere.rotation.y = earth.rotation.y;

      // Orbit rings — slow elegant tumble
      rings.forEach((r, i) => {
        r.rotation.z = rawTimeSeconds * 0.02 * (i + 1) + simTime * 0.02;
      });

      // Visual Satellites and Debris Swarm rotation
      if (satellites) {
        satellites.rotation.y = simTime * 0.15;
        satellites.rotation.x = simTime * 0.05;
      }
      if (debris) {
        debris.rotation.y = -(simTime * 0.2);
        debris.rotation.z = simTime * 0.08;
      }

      renderer.render(scene, camera);
      sceneRef.current!.animId = requestAnimationFrame(animate);
    };
    sceneRef.current!.animId = requestAnimationFrame(animate);

    // ── Resize ──
    const handleResize = () => {
      if (!container || !sceneRef.current) return;
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(sceneRef.current?.animId || 0);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [showSatellites, showDebris]); // Component remounts only on toggle

  // Theme-reactive color updates
  useEffect(() => {
    if (!sceneRef.current) return;
    const hex = parseInt(theme.primaryHex.replace('#', ''), 16);
    const sc = sceneRef.current;
    sc.pointLight.color.setHex(hex);
    sc.rings.forEach(r => { (r.material as THREE.MeshBasicMaterial).color.setHex(hex); });
    if (sc.satellites) { (sc.satellites.material as THREE.PointsMaterial).color.setHex(hex); }
  }, [theme]);

  return <div ref={mountRef} className="absolute inset-0" />;
};

export default EarthScene;
