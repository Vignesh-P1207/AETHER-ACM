import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface EarthSceneProps {
  showSatellites?: boolean;
  showDebris?: boolean;
  onSatelliteClick?: (satData: { id: string; fuel: number; status: string; period: number }) => void;
}

const EarthScene = ({ showSatellites = false, showDebris = false, onSatelliteClick }: EarthSceneProps) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    earth: THREE.Mesh;
    satellites: { mesh: THREE.Mesh; trail: THREE.Line; trailPoints: THREE.Vector3[]; speed: number; inclination: number; radius: number; angle: number; id: string; fuel: number; status: string; period: number }[];
    debris: { mesh: THREE.Mesh; speed: number; inclination: number; radius: number; angle: number; axisAngle: number }[];
    rings: THREE.Mesh[];
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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x113322, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0x00ff88, 1.2);
    dirLight.position.set(5, 3, 5);
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(0x00ff88, 0.5, 20);
    pointLight.position.set(-3, 2, -3);
    scene.add(pointLight);

    // Earth
    const earthGeo = new THREE.SphereGeometry(2, 48, 48);
    const earthMat = new THREE.MeshPhongMaterial({
      color: 0x0a3020,
      emissive: 0x001a0a,
      specular: 0x00ff88,
      shininess: 15,
      wireframe: false,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // Atmosphere glow
    const atmosGeo = new THREE.SphereGeometry(2.15, 48, 48);
    const atmosMat = new THREE.MeshPhongMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    });
    scene.add(new THREE.Mesh(atmosGeo, atmosMat));

    // Orbit rings
    const rings: THREE.Mesh[] = [];
    [2.8, 3.5, 4.2].forEach((r, i) => {
      const ringGeo = new THREE.TorusGeometry(r, 0.01, 8, 100);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.15 + i * 0.05 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2 + (i - 1) * 0.3;
      ring.rotation.y = i * 0.4;
      scene.add(ring);
      rings.push(ring);
    });

    // Satellites
    const satellites: typeof sceneRef.current extends null ? never : NonNullable<typeof sceneRef.current>['satellites'] = [];
    if (showSatellites) {
      const satCount = 50;
      for (let i = 0; i < satCount; i++) {
        const satGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const satMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
        const satMesh = new THREE.Mesh(satGeo, satMat);
        scene.add(satMesh);

        // Trail
        const trailPoints: THREE.Vector3[] = [];
        for (let t = 0; t < 60; t++) trailPoints.push(new THREE.Vector3());
        const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPoints);
        const trailMat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.3 });
        const trail = new THREE.Line(trailGeo, trailMat);
        scene.add(trail);

        const statuses = ['NOMINAL', 'NOMINAL', 'NOMINAL', 'NOMINAL', 'WARNING'];
        satellites.push({
          mesh: satMesh,
          trail,
          trailPoints,
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
      for (let i = 0; i < 8; i++) {
        const satGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const satMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
        const satMesh = new THREE.Mesh(satGeo, satMat);
        scene.add(satMesh);
        const trailPoints: THREE.Vector3[] = [];
        for (let t = 0; t < 30; t++) trailPoints.push(new THREE.Vector3());
        const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPoints);
        const trailMat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.2 });
        const trail = new THREE.Line(trailGeo, trailMat);
        scene.add(trail);
        satellites.push({
          mesh: satMesh, trail, trailPoints,
          speed: 0.003 + Math.random() * 0.005,
          inclination: Math.random() * Math.PI,
          radius: 3 + Math.random() * 1.5,
          angle: Math.random() * Math.PI * 2,
          id: `SAT-${i}`, fuel: 100, status: 'NOMINAL', period: 90,
        });
      }
    }

    // Debris
    const debris: typeof sceneRef.current extends null ? never : NonNullable<typeof sceneRef.current>['debris'] = [];
    if (showDebris) {
      for (let i = 0; i < 200; i++) {
        const debGeo = new THREE.SphereGeometry(0.015, 4, 4);
        const debColor = Math.random() > 0.5 ? 0xff2a2a : 0xff6600;
        const debMat = new THREE.MeshBasicMaterial({ color: debColor });
        const debMesh = new THREE.Mesh(debGeo, debMat);
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

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starVerts = new Float32Array(3000);
    for (let i = 0; i < 3000; i++) starVerts[i] = (Math.random() - 0.5) * 100;
    starGeo.setAttribute('position', new THREE.BufferAttribute(starVerts, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x88ffbb, size: 0.1 });
    scene.add(new THREE.Points(starGeo, starMat));

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    sceneRef.current = { scene, camera, renderer, earth, satellites, debris, rings, animId: 0, raycaster, mouse };

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

    // Animate
    let tick = 0;
    const animate = () => {
      tick++;
      earth.rotation.y += 0.002;
      rings.forEach((r, i) => { r.rotation.z += 0.0005 * (i + 1); });

      satellites.forEach(s => {
        s.angle += s.speed;
        const x = Math.cos(s.angle) * s.radius;
        const z = Math.sin(s.angle) * s.radius * Math.cos(s.inclination);
        const y = Math.sin(s.angle) * s.radius * Math.sin(s.inclination);
        s.mesh.position.set(x, y, z);

        // Update trail
        s.trailPoints.pop();
        s.trailPoints.unshift(new THREE.Vector3(x, y, z));
        const trailGeo = new THREE.BufferGeometry().setFromPoints(s.trailPoints);
        s.trail.geometry.dispose();
        s.trail.geometry = trailGeo;
      });

      debris.forEach(d => {
        d.angle += d.speed;
        const x = Math.cos(d.angle) * d.radius;
        const z = Math.sin(d.angle) * d.radius * Math.cos(d.inclination);
        const y = Math.sin(d.angle) * d.radius * Math.sin(d.inclination) * Math.cos(d.axisAngle);
        d.mesh.position.set(x, y, z);
      });

      // Check proximity for warnings (flash satellites yellow if near debris)
      if (showDebris && showSatellites) {
        satellites.forEach(s => {
          let nearDebris = false;
          for (const d of debris) {
            if (s.mesh.position.distanceTo(d.mesh.position) < 0.5) {
              nearDebris = true;
              break;
            }
          }
          (s.mesh.material as THREE.MeshBasicMaterial).color.setHex(nearDebris ? 0xffb300 : 0x00ff88);
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

  return <div ref={mountRef} className="absolute inset-0" />;
};

export default EarthScene;
