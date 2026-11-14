import * as THREE from 'three';
import { soundEngine } from './audio';
import { LakeMaterials, waterHeightAt } from './materials3d';
import { WeatherKind } from './types';

interface WeatherProfile {
  kind: WeatherKind;
  label: string;
  fogDensity: number;
  skyColor: THREE.Color;
  moonIntensity: number;
  hemiIntensity: number;
  waveAmp: number;
  mistOpacity: number;
  rainOpacity: number;
  rainSpeed: number;
  windX: number;
  starsOpacity: number;
}

export const WEATHER_LABELS: Record<WeatherKind, string> = {
  clear: 'Лунная ночь',
  mist: 'Густой туман',
  rain: 'Ночной ливень',
  storm: 'Гроза над бездной',
};

const WEATHER_ORDER: WeatherKind[] = ['clear', 'mist', 'rain', 'storm'];

const WEATHER_PROFILES: Record<WeatherKind, WeatherProfile> = {
  clear: {
    kind: 'clear',
    label: WEATHER_LABELS.clear,
    fogDensity: 0.0105,
    skyColor: new THREE.Color('#040911'),
    moonIntensity: 1.45,
    hemiIntensity: 0.9,
    waveAmp: 1.0,
    mistOpacity: 0.0,
    rainOpacity: 0.0,
    rainSpeed: 28,
    windX: 1.2,
    starsOpacity: 0.95,
  },
  mist: {
    kind: 'mist',
    label: WEATHER_LABELS.mist,
    fogDensity: 0.0245,
    skyColor: new THREE.Color('#0b1620'),
    moonIntensity: 0.82,
    hemiIntensity: 0.82,
    waveAmp: 0.85,
    mistOpacity: 0.24,
    rainOpacity: 0.0,
    rainSpeed: 26,
    windX: 2.2,
    starsOpacity: 0.2,
  },
  rain: {
    kind: 'rain',
    label: WEATHER_LABELS.rain,
    fogDensity: 0.0175,
    skyColor: new THREE.Color('#050b14'),
    moonIntensity: 0.95,
    hemiIntensity: 0.72,
    waveAmp: 1.32,
    mistOpacity: 0.08,
    rainOpacity: 0.44,
    rainSpeed: 34,
    windX: 5.8,
    starsOpacity: 0.12,
  },
  storm: {
    kind: 'storm',
    label: WEATHER_LABELS.storm,
    fogDensity: 0.0225,
    skyColor: new THREE.Color('#03070e'),
    moonIntensity: 0.65,
    hemiIntensity: 0.56,
    waveAmp: 1.65,
    mistOpacity: 0.14,
    rainOpacity: 0.64,
    rainSpeed: 42,
    windX: 9.5,
    starsOpacity: 0.0,
  },
};

const MIST_COUNT = 28;
const RAIN_COUNT = 720;
const SPLASH_COUNT = 48;

const RAIN_SPAN_X = 72;
const RAIN_SPAN_Y = 26;
const RAIN_SPAN_Z = 62;

// Module-scope scratch helpers (Zero GC in update loop)
const _dummy = new THREE.Object3D();
const _skyTmp = new THREE.Color();
const _flashColor = new THREE.Color('#1d3557');

function createMistTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(186, 214, 235, 0.75)');
  grad.addColorStop(0.45, 'rgba(134, 168, 196, 0.34)');
  grad.addColorStop(1, 'rgba(70, 98, 125, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface WeatherSceneHandles {
  scene: THREE.Scene;
  moonLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  moonMat: THREE.MeshBasicMaterial;
  starsMat: THREE.PointsMaterial;
  materials: LakeMaterials;
}

export class WeatherSystem3D {
  private handles: WeatherSceneHandles;
  private currentKind: WeatherKind = 'clear';
  private cycleTimer = 24;

  // Smoothed continuous atmospheric state
  private fogDensity = WEATHER_PROFILES.clear.fogDensity;
  private baseSkyColor = WEATHER_PROFILES.clear.skyColor.clone();
  private moonIntensity = WEATHER_PROFILES.clear.moonIntensity;
  private hemiIntensity = WEATHER_PROFILES.clear.hemiIntensity;
  private waveAmp = WEATHER_PROFILES.clear.waveAmp;
  private mistOpacity = 0;
  private rainOpacity = 0;
  private rainSpeed = WEATHER_PROFILES.clear.rainSpeed;
  private windX = WEATHER_PROFILES.clear.windX;
  private starsOpacity = WEATHER_PROFILES.clear.starsOpacity;

  // Lightning state
  private lightningTimer = 7;
  private lightningFlash = 0;

  // Mist banks (InstancedMesh)
  private mistTex: THREE.CanvasTexture;
  private mistGeo: THREE.PlaneGeometry;
  private mistMat: THREE.MeshBasicMaterial;
  private mistMesh: THREE.InstancedMesh;
  private mistX = new Float32Array(MIST_COUNT);
  private mistY = new Float32Array(MIST_COUNT);
  private mistZ = new Float32Array(MIST_COUNT);
  private mistScale = new Float32Array(MIST_COUNT);
  private mistRot = new Float32Array(MIST_COUNT);
  private mistDrift = new Float32Array(MIST_COUNT);

  // Falling 3D rain streaks (LineSegments)
  private rainGeo: THREE.BufferGeometry;
  private rainMat: THREE.LineBasicMaterial;
  private rainLines: THREE.LineSegments;
  private rainPositions = new Float32Array(RAIN_COUNT * 6);
  private rainOx = new Float32Array(RAIN_COUNT);
  private rainOy = new Float32Array(RAIN_COUNT);
  private rainOz = new Float32Array(RAIN_COUNT);
  private rainLen = new Float32Array(RAIN_COUNT);

  // Raindrop water ripples (InstancedMesh)
  private splashGeo: THREE.RingGeometry;
  private splashMat: THREE.MeshBasicMaterial;
  private splashMesh: THREE.InstancedMesh;
  private splashX = new Float32Array(SPLASH_COUNT);
  private splashZ = new Float32Array(SPLASH_COUNT);
  private splashAge = new Float32Array(SPLASH_COUNT);
  private splashLife = new Float32Array(SPLASH_COUNT);

  constructor(handles: WeatherSceneHandles) {
    this.handles = handles;

    // 1. Low-lying drifting mist clouds over Black Lake
    this.mistTex = createMistTexture();
    this.mistGeo = new THREE.PlaneGeometry(22, 22);
    this.mistGeo.rotateX(-Math.PI / 2);
    this.mistMat = new THREE.MeshBasicMaterial({
      map: this.mistTex,
      color: '#93b4cc',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mistMesh = new THREE.InstancedMesh(this.mistGeo, this.mistMat, MIST_COUNT);
    this.mistMesh.frustumCulled = false;
    this.mistMesh.visible = false;
    this.mistMesh.renderOrder = 1;

    for (let i = 0; i < MIST_COUNT; i++) {
      this.mistX[i] = (Math.random() - 0.5) * 116;
      this.mistY[i] = 0.65 + Math.random() * 1.6;
      this.mistZ[i] = (Math.random() - 0.5) * 86;
      this.mistScale[i] = 0.75 + Math.random() * 0.9;
      this.mistRot[i] = Math.random() * Math.PI * 2;
      this.mistDrift[i] = 0.6 + Math.random() * 0.8;
    }
    this.handles.scene.add(this.mistMesh);

    // 2. 3D slanted night rain streaks
    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rainMat = new THREE.LineBasicMaterial({
      color: '#93c5fd',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(this.rainGeo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    this.rainLines.renderOrder = 2;

    for (let i = 0; i < RAIN_COUNT; i++) {
      this.rainOx[i] = (Math.random() - 0.5) * RAIN_SPAN_X;
      this.rainOy[i] = Math.random() * RAIN_SPAN_Y;
      this.rainOz[i] = (Math.random() - 0.5) * RAIN_SPAN_Z;
      this.rainLen[i] = 0.9 + Math.random() * 0.7;
    }
    this.handles.scene.add(this.rainLines);

    // 3. Raindrop surface ripple rings
    this.splashGeo = new THREE.RingGeometry(0.22, 0.34, 12);
    this.splashGeo.rotateX(-Math.PI / 2);
    this.splashMat = new THREE.MeshBasicMaterial({
      color: '#94a3b8',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.splashMesh = new THREE.InstancedMesh(this.splashGeo, this.splashMat, SPLASH_COUNT);
    this.splashMesh.frustumCulled = false;
    this.splashMesh.visible = false;

    for (let i = 0; i < SPLASH_COUNT; i++) {
      this.splashX[i] = (Math.random() - 0.5) * 60;
      this.splashZ[i] = (Math.random() - 0.5) * 48;
      this.splashAge[i] = Math.random() * 0.4;
      this.splashLife[i] = 0.3 + Math.random() * 0.2;
    }
    this.handles.scene.add(this.splashMesh);
  }

  public reset(startKind: WeatherKind = 'clear') {
    this.currentKind = startKind;
    this.cycleTimer = 22 + Math.random() * 8;
    this.lightningTimer = 6 + Math.random() * 6;
    this.lightningFlash = 0;
  }

  public getWeather(): WeatherKind {
    return this.currentKind;
  }

  public getWaveAmp(): number {
    return this.waveAmp;
  }

  public setWeather(kind: WeatherKind) {
    this.currentKind = kind;
    this.cycleTimer = 24 + Math.random() * 8;
    if (kind === 'storm') {
      this.lightningTimer = 2.0 + Math.random() * 3.0;
    }
  }

  public cycleWeather(): WeatherKind {
    const idx = WEATHER_ORDER.indexOf(this.currentKind);
    const next = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
    this.setWeather(next);
    return next;
  }

  public update(dt: number, worldTime: number, boatX: number, boatZ: number, waveNum: number): WeatherKind | null {
    // Dynamic progression: cycle weather periodically, favoring mist/rain/storm as waves deepen
    let shiftedTo: WeatherKind | null = null;
    this.cycleTimer -= dt;
    if (this.cycleTimer <= 0) {
      this.cycleTimer = 24 + Math.random() * 10;
      const next = this.pickNextWeather(waveNum);
      if (next !== this.currentKind) {
        this.setWeather(next);
        shiftedTo = next;
      }
    }

    const target = WEATHER_PROFILES[this.currentKind];

    // Smoothly interpolate atmospheric parameters
    this.fogDensity = THREE.MathUtils.damp(this.fogDensity, target.fogDensity, 0.9, dt);
    this.baseSkyColor.lerp(target.skyColor, 1 - Math.exp(-0.9 * dt));
    this.moonIntensity = THREE.MathUtils.damp(this.moonIntensity, target.moonIntensity, 1.1, dt);
    this.hemiIntensity = THREE.MathUtils.damp(this.hemiIntensity, target.hemiIntensity, 1.1, dt);
    this.waveAmp = THREE.MathUtils.damp(this.waveAmp, target.waveAmp, 0.85, dt);
    this.mistOpacity = THREE.MathUtils.damp(this.mistOpacity, target.mistOpacity, 1.0, dt);
    this.rainOpacity = THREE.MathUtils.damp(this.rainOpacity, target.rainOpacity, 1.2, dt);
    this.rainSpeed = THREE.MathUtils.damp(this.rainSpeed, target.rainSpeed, 1.5, dt);
    this.windX = THREE.MathUtils.damp(this.windX, target.windX, 1.2, dt);
    this.starsOpacity = THREE.MathUtils.damp(this.starsOpacity, target.starsOpacity, 1.1, dt);

    // Storm lightning flashes
    if (this.currentKind === 'storm' || (this.currentKind === 'rain' && waveNum >= 3)) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = this.currentKind === 'storm' ? 6 + Math.random() * 8 : 14 + Math.random() * 10;
        this.lightningFlash = 1.0;
        soundEngine.playThunder();
      }
    }
    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 4.5);
    }

    // Apply fog, sky, lights, and water wave uniforms
    const flashBoost = this.lightningFlash > 0.45 ? this.lightningFlash : this.lightningFlash * 0.35;
    _skyTmp.copy(this.baseSkyColor).lerp(_flashColor, flashBoost * 0.72);

    if (this.handles.scene.background instanceof THREE.Color) {
      this.handles.scene.background.copy(_skyTmp);
    }
    if (this.handles.scene.fog instanceof THREE.FogExp2) {
      this.handles.scene.fog.color.copy(_skyTmp);
      this.handles.scene.fog.density = this.fogDensity;
    }

    this.handles.moonLight.intensity = this.moonIntensity + flashBoost * 3.8;
    this.handles.hemiLight.intensity = this.hemiIntensity + flashBoost * 1.1;
    this.handles.moonMat.opacity = Math.max(0.08, this.starsOpacity);
    this.handles.moonMat.transparent = true;
    this.handles.starsMat.opacity = this.starsOpacity;
    this.handles.starsMat.transparent = true;

    this.handles.materials.waterUniforms.uWaveAmp.value = this.waveAmp;
    this.handles.materials.waterUniforms.uRainRipples.value = Math.min(1, this.rainOpacity * 1.65);

    this.updateMist(dt, worldTime);
    this.updateRain(dt, boatX, boatZ);
    this.updateSplashes(dt, worldTime, boatX, boatZ);

    return shiftedTo;
  }

  private pickNextWeather(waveNum: number): WeatherKind {
    const candidates = WEATHER_ORDER.filter((w) => w !== this.currentKind);
    if (waveNum >= 3) {
      const r = Math.random();
      if (r < 0.35 && this.currentKind !== 'storm') return 'storm';
      if (r < 0.65 && this.currentKind !== 'rain') return 'rain';
      if (r < 0.88 && this.currentKind !== 'mist') return 'mist';
      return 'clear';
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private updateMist(dt: number, worldTime: number) {
    if (this.mistOpacity <= 0.008) {
      this.mistMesh.visible = false;
      return;
    }
    this.mistMesh.visible = true;
    this.mistMat.opacity = this.mistOpacity;

    for (let i = 0; i < MIST_COUNT; i++) {
      this.mistX[i] += this.windX * 0.48 * this.mistDrift[i] * dt;
      this.mistRot[i] += 0.04 * this.mistDrift[i] * dt;
      if (this.mistX[i] > 62) this.mistX[i] = -62;

      const bob = Math.sin(worldTime * 0.6 + i) * 0.16;
      _dummy.position.set(this.mistX[i], this.mistY[i] + bob, this.mistZ[i]);
      _dummy.rotation.set(0, this.mistRot[i], 0);
      _dummy.scale.setScalar(this.mistScale[i]);
      _dummy.updateMatrix();
      this.mistMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.mistMesh.instanceMatrix.needsUpdate = true;
  }

  private updateRain(dt: number, boatX: number, boatZ: number) {
    if (this.rainOpacity <= 0.01) {
      this.rainLines.visible = false;
      return;
    }
    this.rainLines.visible = true;
    this.rainMat.opacity = this.rainOpacity;

    const halfX = RAIN_SPAN_X * 0.5;
    const halfZ = RAIN_SPAN_Z * 0.5;
    const streakSlantX = -this.windX * 0.045;
    const streakSlantZ = -0.04;

    for (let i = 0; i < RAIN_COUNT; i++) {
      let ox = this.rainOx[i] + this.windX * dt;
      let oy = this.rainOy[i] - this.rainSpeed * dt;
      let oz = this.rainOz[i] + 1.1 * dt;

      if (oy < 0) {
        oy += RAIN_SPAN_Y;
        ox = (Math.random() - 0.5) * RAIN_SPAN_X;
        oz = (Math.random() - 0.5) * RAIN_SPAN_Z;
      }
      if (ox > halfX) ox -= RAIN_SPAN_X;
      else if (ox < -halfX) ox += RAIN_SPAN_X;
      if (oz > halfZ) oz -= RAIN_SPAN_Z;
      else if (oz < -halfZ) oz += RAIN_SPAN_Z;

      this.rainOx[i] = ox;
      this.rainOy[i] = oy;
      this.rainOz[i] = oz;

      const wx = boatX + ox;
      const wz = boatZ + oz;
      const len = this.rainLen[i];
      const base = i * 6;

      this.rainPositions[base] = wx;
      this.rainPositions[base + 1] = oy;
      this.rainPositions[base + 2] = wz;

      this.rainPositions[base + 3] = wx + streakSlantX * len;
      this.rainPositions[base + 4] = oy + len;
      this.rainPositions[base + 5] = wz + streakSlantZ * len;
    }

    const attr = this.rainGeo.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }

  private updateSplashes(dt: number, worldTime: number, boatX: number, boatZ: number) {
    if (this.rainOpacity <= 0.06) {
      this.splashMesh.visible = false;
      return;
    }
    this.splashMesh.visible = true;
    this.splashMat.opacity = Math.min(0.42, this.rainOpacity * 0.72);

    for (let i = 0; i < SPLASH_COUNT; i++) {
      this.splashAge[i] += dt;
      if (this.splashAge[i] >= this.splashLife[i]) {
        this.splashAge[i] = 0;
        this.splashLife[i] = 0.28 + Math.random() * 0.22;
        this.splashX[i] = boatX + (Math.random() - 0.5) * 56;
        this.splashZ[i] = boatZ + (Math.random() - 0.5) * 46;
      }

      const t = this.splashAge[i] / this.splashLife[i];
      const s = 0.25 + t * 1.45;
      const wy = waterHeightAt(this.splashX[i], this.splashZ[i], worldTime, this.waveAmp);
      _dummy.position.set(this.splashX[i], wy + 0.08, this.splashZ[i]);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.setScalar(s * (1 - t * 0.15));
      _dummy.updateMatrix();
      this.splashMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.splashMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose() {
    this.handles.scene.remove(this.mistMesh, this.rainLines, this.splashMesh);
    this.mistTex.dispose();
    this.mistGeo.dispose();
    this.mistMat.dispose();
    this.rainGeo.dispose();
    this.rainMat.dispose();
    this.splashGeo.dispose();
    this.splashMat.dispose();
  }
}
