import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, RefreshCw } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BESTIARY_ENTRIES } from '../game/constants';
import { detectSoftwareGl } from '../game/materials3d';
import {
  buildBitcoinProjectileMesh,
  createMonsterModel,
  createPickupAssets3D,
  MonsterMeshRig,
} from '../game/models3d';
import { MonsterKind } from '../game/types';

interface Bestiary3DViewerProps {
  kind: MonsterKind;
  name: string;
}

const MODEL_CENTER_Z_OFFSET: Record<MonsterKind, number> = {
  pike: 0.1,
  catfish: 0.0,
  minnow: 0.05,
  eel: 1.25,
  puffer: 0.0,
  ersh: 0.08,
  lin: 0.05,
  peskar: 0.05,
  karas: 0.06,
  croc_gena: 0.35,
  leviathan: 2.35,
  glass_ghost: 0.08,
  mirage_ray: 0.0,
  chrono_morok: 0.05,
  sky_jelly: 0.0,
  turtle_rift: 0.0,
};

function disposeObjectTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      geometries.add(mesh.geometry);
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => materials.add(m));
      } else {
        materials.add(mesh.material);
      }
    }
  });

  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}

export function Bestiary3DViewer({ kind, name }: Bestiary3DViewerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [animateSwim, setAnimateSwim] = useState(true);
  const [webglFailed, setWebglFailed] = useState(false);

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const animateSwimRef = useRef(animateSwim);
  animateSwimRef.current = animateSwim;

  const sceneApiRef = useRef<{
    setMonster: (nextKind: MonsterKind) => void;
    resetCamera: (nextKind?: MonsterKind) => void;
  } | null>(null);

  const currentKindRef = useRef<MonsterKind>(kind);
  currentKindRef.current = kind;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07111b');
    scene.fog = new THREE.FogExp2('#07111b', 0.032);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 120);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minPolarAngle = 0.28;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.autoRotateSpeed = 1.65;

    // 3-Point Warm/Cool Studio Lighting
    const hemiLight = new THREE.HemisphereLight('#7dd3fc', '#0b1824', 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#fef3c7', 2.0);
    keyLight.position.set(5.5, 8.5, 6.0);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 32;
      const d = 6.5;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 1.35);
    rimLight.position.set(-6.0, 4.5, -5.5);
    scene.add(rimLight);

    const accentPoint = new THREE.PointLight('#f59e0b', 2.1, 16, 1.4);
    accentPoint.position.set(3.2, 2.2, 3.8);
    scene.add(accentPoint);

    // Diorama Lake Pedestal (grounded, zero void floating)
    const pedestalGroup = new THREE.Group();
    scene.add(pedestalGroup);

    const stoneMat = new THREE.MeshStandardMaterial({
      color: '#121e2b',
      roughness: 0.82,
      metalness: 0.16,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: '#d97706',
      roughness: 0.28,
      metalness: 0.86,
    });
    const waterDiscMat = new THREE.MeshStandardMaterial({
      color: '#081b2a',
      roughness: 0.14,
      metalness: 0.58,
      envMapIntensity: 1.4,
    });
    const rippleMat = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const baseGeo = new THREE.CylinderGeometry(2.65, 2.95, 0.36, 48);
    const baseMesh = new THREE.Mesh(baseGeo, stoneMat);
    baseMesh.position.y = -0.42;
    baseMesh.receiveShadow = true;
    pedestalGroup.add(baseMesh);

    const trimGeo = new THREE.TorusGeometry(2.66, 0.055, 10, 48);
    trimGeo.rotateX(Math.PI / 2);
    const trimMesh = new THREE.Mesh(trimGeo, brassMat);
    trimMesh.position.y = -0.23;
    pedestalGroup.add(trimMesh);

    const waterGeo = new THREE.CylinderGeometry(2.58, 2.58, 0.06, 48);
    const waterMesh = new THREE.Mesh(waterGeo, waterDiscMat);
    waterMesh.position.y = -0.22;
    waterMesh.receiveShadow = true;
    pedestalGroup.add(waterMesh);

    const rippleGeo = new THREE.RingGeometry(1.15, 1.24, 36);
    rippleGeo.rotateX(-Math.PI / 2);
    const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
    rippleMesh.position.y = -0.17;
    pedestalGroup.add(rippleMesh);

    const pickupAssets = createPickupAssets3D();

    // Monster container pivot
    const modelPivot = new THREE.Group();
    scene.add(modelPivot);

    let activeRig: MonsterMeshRig | null = null;
    let activeBitcoin: THREE.Group | null = null;
    let activeKind: MonsterKind = currentKindRef.current;
    let targetPedestalScale = 1;
    let currentPedestalScale = 1;

    const getEntryViewDist = (k: MonsterKind) => {
      const found = BESTIARY_ENTRIES.find((e) => e.kind === k);
      return found?.viewDistance ?? 4.8;
    };

    const resetCamera = (k: MonsterKind = activeKind) => {
      const dist = getEntryViewDist(k);
      const targetY =
        k === 'sky_jelly' ? 1.45 : k === 'leviathan' ? 0.55 : k === 'croc_gena' ? 0.45 : 0.25;
      controls.target.set(0, targetY, 0);
      camera.position.set(dist * 0.72, dist * 0.44 + (k === 'sky_jelly' ? 0.8 : 0), dist * 0.85);
      controls.minDistance = Math.max(1.8, dist * 0.48);
      controls.maxDistance = dist * 2.1;
      controls.update();
    };

    const setMonster = (nextKind: MonsterKind) => {
      if (activeRig) {
        modelPivot.remove(activeRig.root);
        disposeObjectTree(activeRig.root);
        activeRig = null;
      }
      if (activeBitcoin) {
        modelPivot.remove(activeBitcoin);
        activeBitcoin = null;
      }

      activeKind = nextKind;
      const rig = createMonsterModel(nextKind);
      rig.root.position.set(0, 0, MODEL_CENTER_Z_OFFSET[nextKind] ?? 0);
      if (rig.telegraphLine) {
        rig.telegraphLine.visible = false;
      }
      modelPivot.add(rig.root);
      activeRig = rig;

      if (nextKind === 'croc_gena') {
        const btc = buildBitcoinProjectileMesh(pickupAssets);
        btc.position.set(1.15, 0.72, 0.85);
        btc.scale.setScalar(0.95);
        modelPivot.add(btc);
        activeBitcoin = btc;
      }

      targetPedestalScale =
        nextKind === 'leviathan'
          ? 2.25
          : nextKind === 'eel' || nextKind === 'turtle_rift' || nextKind === 'mirage_ray'
            ? 1.28
            : nextKind === 'minnow'
              ? 0.78
              : 1.05;
      resetCamera(nextKind);
    };

    sceneApiRef.current = { setMonster, resetCamera };
    setMonster(currentKindRef.current);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(container);

    let frameId = 0;
    let disposed = false;
    let simTime = 0;
    const clock = new THREE.Clock();

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    };

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta());

      currentPedestalScale = THREE.MathUtils.damp(currentPedestalScale, targetPedestalScale, 7, dt);
      pedestalGroup.scale.set(currentPedestalScale, 1, currentPedestalScale);

      if (animateSwimRef.current) {
        simTime += dt;
        const bobAmp = activeKind === 'leviathan' ? 0.14 : 0.08;
        modelPivot.position.y = Math.sin(simTime * 2.2) * bobAmp;

        if (activeRig?.tail) {
          activeRig.tail.rotation.y = Math.sin(simTime * 5.2) * 0.42;
        }
        if (activeRig && activeRig.segments.length > 0) {
          const swayFactor = activeKind === 'leviathan' ? 0.14 : 0.075;
          activeRig.segments.forEach((seg, idx) => {
            seg.position.x =
              (activeKind === 'sky_jelly' ? Math.cos((idx / 6) * Math.PI * 2) * 0.5 : 0) +
              Math.sin(simTime * 4.5 - idx * 0.65) * (activeKind === 'sky_jelly' ? 0.08 : idx * swayFactor);
          });
        }
        if (activeRig?.chronoRings && activeRig.chronoRings.length > 0) {
          activeRig.chronoRings[0].rotation.z += dt * 1.8;
          if (activeRig.chronoRings[1]) activeRig.chronoRings[1].rotation.z -= dt * 1.4;
        }
        if (activeBitcoin) {
          activeBitcoin.rotation.y += dt * 3.8;
          activeBitcoin.position.y = 0.72 + Math.sin(simTime * 3.4) * 0.12;
        }
        const ripplePulse = 1 + ((simTime * 0.55) % 1) * 0.75;
        rippleMesh.scale.setScalar(ripplePulse);
        rippleMat.opacity = 0.28 * (1 - ((simTime * 0.55) % 1));
      } else {
        modelPivot.position.y = THREE.MathUtils.damp(modelPivot.position.y, 0, 8, dt);
        if (activeRig?.tail) {
          activeRig.tail.rotation.y = THREE.MathUtils.damp(activeRig.tail.rotation.y, 0, 8, dt);
        }
        if (activeRig && activeRig.segments.length > 0) {
          activeRig.segments.forEach((seg) => {
            seg.position.x = THREE.MathUtils.damp(seg.position.x, 0, 8, dt);
          });
        }
      }

      controls.autoRotate = !isSoftwareGl && autoRotateRef.current;
      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      frameId = window.setTimeout(tick, 16);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObs.disconnect();
      controls.dispose();

      if (activeRig) {
        disposeObjectTree(activeRig.root);
      }
      pickupAssets.dispose();
      baseGeo.dispose();
      trimGeo.dispose();
      waterGeo.dispose();
      rippleGeo.dispose();
      stoneMat.dispose();
      brassMat.dispose();
      waterDiscMat.dispose();
      rippleMat.dispose();
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      sceneApiRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneApiRef.current?.setMonster(kind);
  }, [kind]);

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-lg border border-slate-200/15 bg-[#07111b] sm:h-[380px]">
      <div
        ref={mountRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        aria-label={`3D-модель: ${name}`}
      />

      {webglFailed && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#07111b] p-4 text-center text-xs text-slate-400">
          Не удалось инициализировать 3D-просмотр WebGL.
        </div>
      )}

      {/* Minimal Top-Left Hint */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-slate-200/10 bg-[#07111b]/90 px-2.5 py-1 text-[11px] text-slate-300">
        Тяните мышью для вращения · Колёсико — масштаб
      </div>

      {/* Bottom Centered Viewer Dock (solid/rgba surface, no backdrop-blur over WebGL) */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-lg border border-slate-200/15 bg-[#08121d]/92 p-1 shadow-lg">
        <button
          type="button"
          onClick={() => setAutoRotate((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
            autoRotate
              ? 'bg-amber-500/20 text-amber-300 border border-amber-400/35'
              : 'text-slate-300 hover:bg-slate-800/80 border border-transparent'
          }`}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Вращение</span>
        </button>

        <button
          type="button"
          onClick={() => setAnimateSwim((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
            animateSwim
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/35'
              : 'text-slate-300 hover:bg-slate-800/80 border border-transparent'
          }`}
        >
          {animateSwim ? (
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>Движение</span>
        </button>

        <button
          type="button"
          onClick={() => sceneApiRef.current?.resetCamera(kind)}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors whitespace-nowrap"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Сброс</span>
        </button>
      </div>
    </div>
  );
}
