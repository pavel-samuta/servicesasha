import * as THREE from 'three';
import { waterHeightAt } from './materials3d';

const DROPLET_POOL = 280;
const RING_POOL = 72;

// Module-scope scratch helpers (Zero GC in tick loop)
const _dummy = new THREE.Object3D();
const _velDir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _colorFoam = new THREE.Color('#e0f2fe');
const _colorMist = new THREE.Color('#7dd3fc');
const _colorTmp = new THREE.Color();

export class WaterSplashSystem3D {
  private scene: THREE.Scene;

  // Pooled 3D water spray droplets
  private dropletGeo: THREE.SphereGeometry;
  private dropletMat: THREE.MeshStandardMaterial;
  private dropletMesh: THREE.InstancedMesh;
  private dropActive = new Uint8Array(DROPLET_POOL);
  private dropX = new Float32Array(DROPLET_POOL);
  private dropY = new Float32Array(DROPLET_POOL);
  private dropZ = new Float32Array(DROPLET_POOL);
  private dropVx = new Float32Array(DROPLET_POOL);
  private dropVy = new Float32Array(DROPLET_POOL);
  private dropVz = new Float32Array(DROPLET_POOL);
  private dropAge = new Float32Array(DROPLET_POOL);
  private dropLife = new Float32Array(DROPLET_POOL);
  private dropSize = new Float32Array(DROPLET_POOL);
  private dropCursor = 0;

  // Pooled expanding water surface splash rings
  private ringGeo: THREE.RingGeometry;
  private ringMat: THREE.MeshBasicMaterial;
  private ringMesh: THREE.InstancedMesh;
  private ringActive = new Uint8Array(RING_POOL);
  private ringX = new Float32Array(RING_POOL);
  private ringZ = new Float32Array(RING_POOL);
  private ringAge = new Float32Array(RING_POOL);
  private ringLife = new Float32Array(RING_POOL);
  private ringStart = new Float32Array(RING_POOL);
  private ringEnd = new Float32Array(RING_POOL);
  private ringCursor = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.dropletGeo = new THREE.SphereGeometry(0.16, 6, 5);
    this.dropletMat = new THREE.MeshStandardMaterial({
      color: '#e0f2fe',
      emissive: '#38bdf8',
      emissiveIntensity: 0.42,
      roughness: 0.22,
      metalness: 0.08,
      transparent: true,
      opacity: 0.88,
    });
    this.dropletMesh = new THREE.InstancedMesh(this.dropletGeo, this.dropletMat, DROPLET_POOL);
    this.dropletMesh.frustumCulled = false;
    this.dropletMesh.count = DROPLET_POOL;

    for (let i = 0; i < DROPLET_POOL; i++) {
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.dropletMesh.setMatrixAt(i, _dummy.matrix);
      _colorTmp.copy(i % 2 === 0 ? _colorFoam : _colorMist);
      this.dropletMesh.setColorAt(i, _colorTmp);
    }
    this.dropletMesh.instanceMatrix.needsUpdate = true;
    if (this.dropletMesh.instanceColor) this.dropletMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.dropletMesh);

    this.ringGeo = new THREE.RingGeometry(0.62, 1.0, 18);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: '#bae6fd',
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.ringMesh = new THREE.InstancedMesh(this.ringGeo, this.ringMat, RING_POOL);
    this.ringMesh.frustumCulled = false;
    this.ringMesh.count = RING_POOL;

    for (let i = 0; i < RING_POOL; i++) {
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.ringMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.ringMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.ringMesh);
  }

  public emitSplash(
    x: number,
    z: number,
    intensity = 1.0,
    dirVx = 0,
    dirVz = 0,
    waterY = 0
  ) {
    const count = Math.min(28, Math.max(8, Math.round(13 * intensity)));
    const speedScale = 0.75 + Math.sqrt(intensity) * 0.65;
    const hasDir = Math.abs(dirVx) + Math.abs(dirVz) > 0.1;
    const dirLen = hasDir ? Math.hypot(dirVx, dirVz) : 1;
    const ndx = hasDir ? dirVx / dirLen : 0;
    const ndz = hasDir ? dirVz / dirLen : 0;

    for (let i = 0; i < count; i++) {
      const idx = this.dropCursor;
      this.dropCursor = (this.dropCursor + 1) % DROPLET_POOL;

      const isPlume = i < count * 0.4;
      const angle = Math.random() * Math.PI * 2;
      const radialSpd = isPlume
        ? (0.6 + Math.random() * 2.2) * speedScale
        : (2.4 + Math.random() * 4.4) * speedScale;

      this.dropActive[idx] = 1;
      this.dropX[idx] = x + (Math.random() - 0.5) * 0.35;
      this.dropY[idx] = waterY + 0.15;
      this.dropZ[idx] = z + (Math.random() - 0.5) * 0.35;
      this.dropVx[idx] = Math.sin(angle) * radialSpd + ndx * (hasDir ? 3.2 * speedScale : 0);
      this.dropVz[idx] = Math.cos(angle) * radialSpd + ndz * (hasDir ? 3.2 * speedScale : 0);
      this.dropVy[idx] = isPlume
        ? (6.4 + Math.random() * 4.5) * speedScale
        : (3.2 + Math.random() * 3.8) * speedScale;
      this.dropAge[idx] = 0;
      this.dropLife[idx] = 0.42 + Math.random() * 0.34;
      this.dropSize[idx] = (0.7 + Math.random() * 0.7) * Math.min(1.5, 0.75 + intensity * 0.35);
    }

    // Expanding surface foam ripple rings
    const ringCount = intensity >= 1.4 ? 2 : 1;
    for (let r = 0; r < ringCount; r++) {
      const rIdx = this.ringCursor;
      this.ringCursor = (this.ringCursor + 1) % RING_POOL;
      this.ringActive[rIdx] = 1;
      this.ringX[rIdx] = x;
      this.ringZ[rIdx] = z;
      this.ringAge[rIdx] = -r * 0.08;
      this.ringLife[rIdx] = 0.48 + intensity * 0.14;
      this.ringStart[rIdx] = 0.25 + r * 0.2;
      this.ringEnd[rIdx] = (1.55 + r * 0.85) * Math.min(2.1, 0.7 + intensity * 0.55);
    }
  }

  public update(dt: number, worldTime: number, waveAmp: number) {
    let dropletsDirty = false;
    for (let i = 0; i < DROPLET_POOL; i++) {
      if (!this.dropActive[i]) continue;
      dropletsDirty = true;

      this.dropAge[i] += dt;
      this.dropVy[i] -= 19.5 * dt;
      this.dropX[i] += this.dropVx[i] * dt;
      this.dropY[i] += this.dropVy[i] * dt;
      this.dropZ[i] += this.dropVz[i] * dt;

      const wy = waterHeightAt(this.dropX[i], this.dropZ[i], worldTime, waveAmp);
      const t = this.dropAge[i] / this.dropLife[i];

      if (t >= 1 || (this.dropVy[i] < 0 && this.dropY[i] < wy - 0.1)) {
        this.dropActive[i] = 0;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.dropletMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      const scaleBase = this.dropSize[i] * (1 - t * 0.55);
      _velDir.set(this.dropVx[i], this.dropVy[i], this.dropVz[i]);
      const spd = _velDir.length();
      if (spd > 0.05) {
        _velDir.divideScalar(spd);
        _quat.setFromUnitVectors(_upAxis, _velDir);
        _dummy.quaternion.copy(_quat);
      } else {
        _dummy.quaternion.identity();
      }

      const stretch = 1 + Math.min(1.8, spd * 0.12);
      _dummy.position.set(this.dropX[i], this.dropY[i], this.dropZ[i]);
      _dummy.scale.set(scaleBase * 0.82, scaleBase * stretch, scaleBase * 0.82);
      _dummy.updateMatrix();
      this.dropletMesh.setMatrixAt(i, _dummy.matrix);
    }
    if (dropletsDirty) {
      this.dropletMesh.instanceMatrix.needsUpdate = true;
    }

    let ringsDirty = false;
    for (let i = 0; i < RING_POOL; i++) {
      if (!this.ringActive[i]) continue;
      ringsDirty = true;

      this.ringAge[i] += dt;
      if (this.ringAge[i] < 0) continue;

      const t = this.ringAge[i] / this.ringLife[i];
      if (t >= 1) {
        this.ringActive[i] = 0;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.ringMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      const s = THREE.MathUtils.lerp(this.ringStart[i], this.ringEnd[i], t) * (1 - t * 0.12);
      const wy = waterHeightAt(this.ringX[i], this.ringZ[i], worldTime, waveAmp);
      _dummy.position.set(this.ringX[i], wy + 0.11, this.ringZ[i]);
      _dummy.quaternion.identity();
      _dummy.scale.set(s, 1, s);
      _dummy.updateMatrix();
      this.ringMesh.setMatrixAt(i, _dummy.matrix);
    }
    if (ringsDirty) {
      this.ringMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public reset() {
    this.dropActive.fill(0);
    this.ringActive.fill(0);
    for (let i = 0; i < DROPLET_POOL; i++) {
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.dropletMesh.setMatrixAt(i, _dummy.matrix);
    }
    for (let i = 0; i < RING_POOL; i++) {
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0);
      _dummy.updateMatrix();
      this.ringMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.dropletMesh.instanceMatrix.needsUpdate = true;
    this.ringMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose() {
    this.scene.remove(this.dropletMesh, this.ringMesh);
    this.dropletGeo.dispose();
    this.dropletMat.dispose();
    this.ringGeo.dispose();
    this.ringMat.dispose();
  }
}
