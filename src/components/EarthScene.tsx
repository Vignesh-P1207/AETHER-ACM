import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useTheme } from '@/contexts/ThemeContext';

interface EarthSceneProps {
  showSatellites?: boolean;
  showDebris?: boolean;
  onSatelliteClick?: (satData: { id: string; fuel: number; status: string; period: number }) => void;
}

// Generate a procedural Earth-like texture on a canvas
function createEarthTexture(size = 512): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d')!;

  // Deep ocean base
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  oceanGrad.addColorStop(0, '#1a3a5c');
  oceanGrad.addColorStop(0.3, '#1e4d7b');
  oceanGrad.addColorStop(0.5, '#1a5276');
  oceanGrad.addColorStop(0.7, '#1e4d7b');
  oceanGrad.addColorStop(1, '#1a3a5c');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add subtle ocean variation
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = Math.random() * 8 + 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${200 + Math.random() * 20}, ${50 + Math.random() * 20}%, ${20 + Math.random() * 15}%, ${0.1 + Math.random() * 0.15})`;
    ctx.fill();
  }

  // Simplified continent shapes (Mercator-ish projection)
  const continents = [
    // North America
    { points: [[0.12,0.18],[0.08,0.25],[0.1,0.35],[0.15,0.42],[0.22,0.42],[0.28,0.35],[0.25,0.22],[0.2,0.15]], color: '#2d5a1e' },
    // South America
    { points: [[0.2,0.5],[0.18,0.55],[0.2,0.65],[0.22,0.75],[0.25,0.8],[0.28,0.72],[0.27,0.58],[0.24,0.5]], color: '#3a6b2a' },
    // Europe
    { points: [[0.45,0.18],[0.42,0.22],[0.44,0.3],[0.48,0.35],[0.55,0.32],[0.54,0.25],[0.5,0.18]], color: '#3a5c28' },
    // Africa
    { points: [[0.44,0.38],[0.42,0.45],[0.44,0.55],[0.48,0.65],[0.52,0.7],[0.56,0.62],[0.55,0.5],[0.52,0.4],[0.48,0.36]], color: '#5a7a32' },
    // Asia
    { points: [[0.55,0.15],[0.6,0.18],[0.7,0.2],[0.8,0.25],[0.82,0.32],[0.78,0.38],[0.7,0.42],[0.62,0.4],[0.58,0.35],[0.55,0.28]], color: '#3d6430' },
    // Australia
    { points: [[0.78,0.6],[0.75,0.65],[0.78,0.72],[0.85,0.72],[0.88,0.65],[0.84,0.58]], color: '#7a6e32' },
    // Antarctica hint
    { points: [[0.0,0.88],[0.3,0.9],[0.5,0.92],[0.7,0.9],[1.0,0.88],[1.0,1.0],[0.0,1.0]], color: '#d4dce8' },
    // Greenland
    { points: [[0.28,0.1],[0.25,0.14],[0.28,0.2],[0.33,0.2],[0.35,0.14],[0.32,0.1]], color: '#c8d8e0' },
  ];

  continents.forEach(cont => {
    ctx.beginPath();
    const pts = cont.points;
    ctx.moveTo(pts[0][0] * canvas.width, pts[0][1] * canvas.height);
    for (let i = 1; i < pts.length; i++) {
      // Use quadratic curves for smoother shapes
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx = (prev[0] + curr[0]) / 2 * canvas.width + (Math.random() - 0.5) * 8;
      const cpy = (prev[1] + curr[1]) / 2 * canvas.height + (Math.random() - 0.5) * 5;
      ctx.quadraticCurveTo(cpx, cpy, curr[0] * canvas.width, curr[1] * canvas.height);
    }
    ctx.closePath();
    ctx.fillStyle = cont.color;
    ctx.fill();

    // Add terrain variation within continents
    for (let j = 0; j < 600; j++) {
      const idx = Math.floor(Math.random() * pts.length);
      const px = pts[idx][0] * canvas.width + (Math.random() - 0.5) * 50;
      const py = pts[idx][1] * canvas.height + (Math.random() - 0.5) * 40;
      const sr = Math.random() * 3 + 0.5;
      ctx.beginPath();
      ctx.arc(px, py, sr, 0, Math.PI * 2);
      const shade = Math.random();
      if (shade > 0.7) {
        ctx.fillStyle = `hsla(${80 + Math.random() * 40}, ${30 + Math.random() * 30}%, ${25 + Math.random() * 15}%, 0.3)`;
      } else if (shade > 0.4) {
        ctx.fillStyle = `hsla(${30 + Math.random() * 20}, ${30 + Math.random() * 20}%, ${30 + Math.random() * 20}%, 0.25)`;
      } else {
        ctx.fillStyle = `hsla(${100 + Math.random() * 40}, ${20 + Math.random() * 30}%, ${20 + Math.random() * 15}%, 0.3)`;
      }
      ctx.fill();
    }
  });

  // Polar ice caps glow
  const polarGrad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.12);
  polarGrad.addColorStop(0, 'rgba(220, 235, 250, 0.6)');
  polarGrad.addColorStop(1, 'rgba(220, 235, 250, 0)');
  ctx.fillStyle = polarGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.12);

  // Cloud hints (white smudges)
  for (let i = 0; i < 60; i++) {
    const cx = Math.random() * canvas.width;
    const cy = Math.random() * canvas.height;
    const cw = 15 + Math.random() * 35;
    const ch = 3 + Math.random() * 8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw, ch, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.04 + Math.random() * 0.06})`;
    ctx.fill();
  }

  return canvas;
}

const EarthScene = ({ showSatellites = false, showDebris = false, onSatelliteClick }: EarthSceneProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const themeRef = useRef(theme);

  // Keep theme ref updated without recreating the scene
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    earth: THREE.Mesh;
    atmosphere: THREE.Mesh;
    satellites: { mesh: THREE.Mesh; trail: THREE.Line; trailIndex: number; trailPositions: Float32Array; speed: number; inclination: number; radius: number; angle: number; id: string; fuel: number; status: string; period: number }[];
    debris: { mesh: THREE.Mesh; speed: number; inclination: number; radius: number; angle: number; axisAngle: number }[];
    rings: THREE.Mesh[];
    stars: THREE.Points;
    ambientLight: THREE.AmbientLight;
    dirLight: THREE.DirectionalLight;
    pointLight: THREE.PointLight;
    animId: number;
    raycaster: THREE.Raycaster;
    mouse: THREE.Vector2;
  } | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 2, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    const themeHex = parseInt(themeRef.current.primaryHex.replace('#', ''), 16);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x445566, 0.8);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.4);
    dirLight.position.set(5, 3, 5);
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(themeHex, 0.3, 20);
    pointLight.position.set(-3, 2, -3);
    scene.add(pointLight);

    // Earth with procedural texture
    const earthGeo = new THREE.SphereGeometry(2, 64, 64);
    const earthTexture = new THREE.CanvasTexture(createEarthTexture(1024));
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTexture,
      bumpMap: earthTexture,
      specular: 0x444466,
      shininess: 25,
      bumpScale: 0.05,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // Atmosphere glow
    const atmosGeo = new THREE.SphereGeometry(2.12, 64, 64);
    const atmosMat = new THREE.MeshPhongMaterial({
      color: 0x88bbff,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    });
    const atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosphere);

    // Orbit rings — reduced tube segments (6 instead of 8) and radial segments (64 instead of 100)
    const rings: THREE.Mesh[] = [];
    [2.8, 3.5, 4.2].forEach((r, i) => {
      const ringGeo = new THREE.TorusGeometry(r, 0.01, 6, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: themeHex, transparent: true, opacity: 0.15 + i * 0.05 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2 + (i - 1) * 0.3;
      ring.rotation.y = i * 0.4;
      scene.add(ring);
      rings.push(ring);
    });

    // Satellites — reduced geometry (6 segments instead of 8)
    type SatType = NonNullable<typeof sceneRef.current>['satellites'][number];
    const satellites: SatType[] = [];
    const trailLength = showSatellites ? 40 : 20; // Fewer trail points

    if (showSatellites) {
      const satCount = 30; // Reduced from 50 to 30
      for (let i = 0; i < satCount; i++) {
        const satGeo = new THREE.SphereGeometry(0.04, 6, 6);
        const satMat = new THREE.MeshBasicMaterial({ color: themeHex });
        const satMesh = new THREE.Mesh(satGeo, satMat);
        scene.add(satMesh);

        // Pre-allocate trail buffer (no per-frame allocation)
        const trailPositions = new Float32Array(trailLength * 3);
        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        trailGeo.setDrawRange(0, 0);
        const trailMat = new THREE.LineBasicMaterial({ color: themeHex, transparent: true, opacity: 0.3 });
        const trail = new THREE.Line(trailGeo, trailMat);
        scene.add(trail);

        const statuses = ['NOMINAL', 'NOMINAL', 'NOMINAL', 'NOMINAL', 'WARNING'];
        satellites.push({
          mesh: satMesh,
          trail,
          trailIndex: 0,
          trailPositions,
          speed: 0.002 + Math.random() * 0.008,
          inclination: Math.random() * Math.PI,
          radius: 2.8 + Math.random() * 2.5,
          angle: Math.random() * Math.PI * 2,
          id: `SAT-${String(i + 1).padStart(3, '0')}`,
          fuel: 30 + Math.random() * 70,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          period: 90 + Math.random() * 30,
        });
      }
    } else {
      // Hero page: a few decorative satellites
      for (let i = 0; i < 6; i++) { // Reduced from 8 to 6
        const satGeo = new THREE.SphereGeometry(0.05, 6, 6);
        const satMat = new THREE.MeshBasicMaterial({ color: themeHex });
        const satMesh = new THREE.Mesh(satGeo, satMat);
        scene.add(satMesh);

        const trailPositions = new Float32Array(trailLength * 3);
        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        trailGeo.setDrawRange(0, 0);
        const trailMat = new THREE.LineBasicMaterial({ color: themeHex, transparent: true, opacity: 0.2 });
        const trail = new THREE.Line(trailGeo, trailMat);
        scene.add(trail);

        satellites.push({
          mesh: satMesh, trail, trailIndex: 0, trailPositions,
          speed: 0.003 + Math.random() * 0.005,
          inclination: Math.random() * Math.PI,
          radius: 3 + Math.random() * 1.5,
          angle: Math.random() * Math.PI * 2,
          id: `SAT-${i}`, fuel: 100, status: 'NOMINAL', period: 90,
        });
      }
    }

    // Debris — reduced count and geometry
    type DebType = NonNullable<typeof sceneRef.current>['debris'][number];
    const debris: DebType[] = [];
    if (showDebris) {
      const debrisCount = 100; // Reduced from 200 to 100
      // Share geometry across all debris (instancing-lite)
      const sharedDebGeo = new THREE.SphereGeometry(0.015, 3, 3);
      for (let i = 0; i < debrisCount; i++) {
        const debColor = Math.random() > 0.5 ? 0xff2a2a : 0xff6600;
        const debMat = new THREE.MeshBasicMaterial({ color: debColor });
        const debMesh = new THREE.Mesh(sharedDebGeo, debMat);
        scene.add(debMesh);
        debris.push({
          mesh: debMesh,
          speed: 0.001 + Math.random() * 0.01,
          inclination: Math.random() * Math.PI,
          radius: 2.5 + Math.random() * 3,
          angle: Math.random() * Math.PI * 2,
          axisAngle: Math.random() * Math.PI * 2,
        });
      }
    }

    // Stars — reduced count (600 instead of 1000 vertices)
    const starGeo = new THREE.BufferGeometry();
    const starVerts = new Float32Array(1800); // 600 stars * 3
    for (let i = 0; i < 1800; i++) starVerts[i] = (Math.random() - 0.5) * 100;
    starGeo.setAttribute('position', new THREE.BufferAttribute(starVerts, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xccddff, size: 0.1 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    sceneRef.current = { scene, camera, renderer, earth, atmosphere, satellites, debris, rings, stars, ambientLight, dirLight, pointLight, animId: 0, raycaster, mouse };

    // Click handler
    const handleClick = (e: MouseEvent) => {
      if (!sceneRef.current || !onSatelliteClick) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const satMeshes = sceneRef.current.satellites.map(s => s.mesh);
      const intersects = raycaster.intersectObjects(satMeshes);
      if (intersects.length > 0) {
        const idx = satMeshes.indexOf(intersects[0].object as THREE.Mesh);
        if (idx >= 0) {
          const s = sceneRef.current.satellites[idx];
          onSatelliteClick({ id: s.id, fuel: Math.round(s.fuel), status: s.status, period: Math.round(s.period) });
        }
      }
    };
    renderer.domElement.addEventListener('click', handleClick);

    // Throttle: render every 2nd frame on high-DPI, skip frames
    let frameCount = 0;
    const skipFrames = window.devicePixelRatio > 1.5 ? 1 : 0;

    const animate = () => {
      frameCount++;
      if (skipFrames && frameCount % 2 === 0) {
        sceneRef.current!.animId = requestAnimationFrame(animate);
        return;
      }

      earth.rotation.y += 0.002;
      rings.forEach((r, i) => { r.rotation.z += 0.0005 * (i + 1); });

      satellites.forEach(s => {
        s.angle += s.speed;
        const x = Math.cos(s.angle) * s.radius;
        const z = Math.sin(s.angle) * s.radius * Math.cos(s.inclination);
        const y = Math.sin(s.angle) * s.radius * Math.sin(s.inclination);
        s.mesh.position.set(x, y, z);

        // Update trail using ring buffer (no allocation)
        const idx3 = s.trailIndex * 3;
        s.trailPositions[idx3] = x;
        s.trailPositions[idx3 + 1] = y;
        s.trailPositions[idx3 + 2] = z;
        s.trailIndex = (s.trailIndex + 1) % trailLength;

        const posAttr = s.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
        posAttr.needsUpdate = true;
        const filled = Math.min(frameCount, trailLength);
        s.trail.geometry.setDrawRange(0, filled);
      });

      debris.forEach(d => {
        d.angle += d.speed;
        const x = Math.cos(d.angle) * d.radius;
        const z = Math.sin(d.angle) * d.radius * Math.cos(d.inclination);
        const y = Math.sin(d.angle) * d.radius * Math.sin(d.inclination) * Math.cos(d.axisAngle);
        d.mesh.position.set(x, y, z);
      });

      // Proximity warnings — check only every 5th frame and sample subset
      if (showDebris && showSatellites && frameCount % 5 === 0) {
        satellites.forEach(s => {
          let nearDebris = false;
          for (let i = 0; i < debris.length; i += 3) { // Check every 3rd debris
            if (s.mesh.position.distanceToSquared(debris[i].mesh.position) < 0.25) { // Use squared distance (0.5^2)
              nearDebris = true;
              break;
            }
          }
          (s.mesh.material as THREE.MeshBasicMaterial).color.setHex(nearDebris ? 0xffb300 : parseInt(themeRef.current.primaryHex.replace('#', ''), 16));
        });
      }

      renderer.render(scene, camera);
      sceneRef.current!.animId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !sceneRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      cancelAnimationFrame(sceneRef.current?.animId || 0);
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [showSatellites, showDebris, onSatelliteClick]);

  // Update Three.js material colors when theme changes (without recreating the scene)
  useEffect(() => {
    if (!sceneRef.current) return;
    const hex = parseInt(theme.primaryHex.replace('#', ''), 16);
    const sc = sceneRef.current;

    // Update point light
    sc.pointLight.color.setHex(hex);

    // Update orbit rings
    sc.rings.forEach(r => {
      (r.material as THREE.MeshBasicMaterial).color.setHex(hex);
    });

    // Update satellites and trails
    sc.satellites.forEach(s => {
      (s.mesh.material as THREE.MeshBasicMaterial).color.setHex(hex);
      (s.trail.material as THREE.LineBasicMaterial).color.setHex(hex);
    });
  }, [theme]);

  return <div ref={mountRef} className="absolute inset-0" />;
};

export default EarthScene;
