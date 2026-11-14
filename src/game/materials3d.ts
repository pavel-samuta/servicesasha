import * as THREE from 'three';

export function detectSoftwareGl(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function waterHeightAt(x: number, z: number, time: number, waveAmp = 1): number {
  return (
    (Math.sin(x * 0.28 + time * 1.65) * 0.14 +
      Math.cos(z * 0.34 - time * 1.35) * 0.12 +
      Math.sin((x + z) * 0.16 + time * 2.1) * 0.07) *
    waveAmp
  );
}

export function createWoodTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#5c2d14';
  ctx.fillRect(0, 0, 256, 256);

  // Plank seams & wood grain
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = '#381908';
    ctx.fillRect(0, y, 256, 2);
    for (let g = 0; g < 18; g++) {
      ctx.fillStyle = g % 2 === 0 ? 'rgba(130, 68, 30, 0.28)' : 'rgba(42, 18, 6, 0.25)';
      ctx.fillRect(0, y + 3 + ((g * 7) % 27), 256, 1.5);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = maxAniso;
  return tex;
}

export function createRockTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1f2937';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 420; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    const r = 3 + (i % 9);
    ctx.fillStyle = i % 3 === 0 ? 'rgba(71, 85, 105, 0.32)' : 'rgba(15, 23, 42, 0.45)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

export interface LakeMaterials {
  waterMaterial: THREE.MeshStandardMaterial;
  waterUniforms: {
    uTime: { value: number };
    uBoatPos: { value: THREE.Vector3 };
    uWaveAmp: { value: number };
    uRainRipples: { value: number };
  };
  woodHull: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
  brassMetal: THREE.MeshStandardMaterial;
  steelMetal: THREE.MeshStandardMaterial;
  slickerFabric: THREE.MeshStandardMaterial;
  skinTone: THREE.MeshStandardMaterial;
  lanternGlow: THREE.MeshStandardMaterial;
  beamMaterial: THREE.MeshBasicMaterial;
  rockMaterial: THREE.MeshStandardMaterial;
  pineFoliage: THREE.MeshStandardMaterial;
  pineTrunk: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createLakeMaterials(maxAniso: number): LakeMaterials {
  const woodTex = createWoodTexture(maxAniso);
  const rockTex = createRockTexture(maxAniso);

  const waterUniforms = {
    uTime: { value: 0 },
    uBoatPos: { value: new THREE.Vector3(0, 0, 0) },
    uWaveAmp: { value: 1.0 },
    uRainRipples: { value: 0.0 },
  };

  // Physically-based dark lake water with animated vertex waves and shimmering moonlight surface
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#07131e'),
    roughness: 0.16,
    metalness: 0.55,
    envMapIntensity: 1.35,
  });

  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.uniforms.uBoatPos = waterUniforms.uBoatPos;
    shader.uniforms.uWaveAmp = waterUniforms.uWaveAmp;
    shader.uniforms.uRainRipples = waterUniforms.uRainRipples;

    shader.vertexShader =
      `
      uniform float uTime;
      uniform float uWaveAmp;
      varying vec3 vWorldPos;
      varying float vWaveH;
      ` +
      shader.vertexShader
        .replace(
          '#include <beginnormal_vertex>',
          `
          #include <beginnormal_vertex>
          float wx = position.x;
          float wz = -position.y;
          float dx = (0.28 * 0.14 * cos(wx * 0.28 + uTime * 1.65) + 0.16 * 0.07 * cos((wx + wz) * 0.16 + uTime * 2.1)) * uWaveAmp;
          float dz = (-0.34 * 0.12 * sin(wz * 0.34 - uTime * 1.35) + 0.16 * 0.07 * cos((wx + wz) * 0.16 + uTime * 2.1)) * uWaveAmp;
          objectNormal = normalize(vec3(-dx, dz, 1.0));
          `
        )
        .replace(
          '#include <begin_vertex>',
          `
          #include <begin_vertex>
          float wpx = position.x;
          float wpz = -position.y;
          float wh = (sin(wpx * 0.28 + uTime * 1.65) * 0.14
                   + cos(wpz * 0.34 - uTime * 1.35) * 0.12
                   + sin((wpx + wpz) * 0.16 + uTime * 2.1) * 0.07) * uWaveAmp;
          transformed.z += wh;
          vWaveH = wh;
          vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          `
        );

    shader.fragmentShader =
      `
      uniform float uTime;
      uniform vec3 uBoatPos;
      uniform float uRainRipples;
      varying vec3 vWorldPos;
      varying float vWaveH;
      ` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        float crest = smoothstep(0.14, 0.36, vWaveH);
        vec3 deepCol = vec3(0.02, 0.055, 0.095);
        vec3 crestCol = vec3(0.07, 0.16, 0.23);
        diffuseColor.rgb = mix(deepCol, crestCol, crest * 0.65);

        // Subtle boat lantern ring & shoreline foam shimmer
        float dBoat = length(vWorldPos.xz - uBoatPos.xz);
        float ripple = sin(dBoat * 2.6 - uTime * 5.0) * exp(-dBoat * 0.16);
        diffuseColor.rgb += vec3(0.04, 0.07, 0.09) * max(0.0, ripple);

        // Procedural raindrop shimmer across the dark surface during rain & storm
        if (uRainRipples > 0.01) {
          float p1 = sin(vWorldPos.x * 2.3 + uTime * 9.0) * cos(vWorldPos.z * 2.7 - uTime * 8.0);
          float p2 = sin((vWorldPos.x - vWorldPos.z) * 3.1 - uTime * 11.0);
          float rainSpark = smoothstep(0.78, 0.99, p1 * p2);
          diffuseColor.rgb += vec3(0.05, 0.09, 0.12) * rainSpark * uRainRipples;
        }
        `
      );
  };

  const woodHull = new THREE.MeshStandardMaterial({
    map: woodTex,
    color: new THREE.Color('#9a5226'),
    roughness: 0.72,
    metalness: 0.05,
  });

  const woodDark = new THREE.MeshStandardMaterial({
    map: woodTex,
    color: new THREE.Color('#4a2511'),
    roughness: 0.85,
    metalness: 0.04,
  });

  const brassMetal = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d97706'),
    roughness: 0.26,
    metalness: 0.88,
  });

  const steelMetal = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#94a3b8'),
    roughness: 0.32,
    metalness: 0.86,
  });

  const slickerFabric = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1e293b'),
    roughness: 0.68,
    metalness: 0.05,
  });

  const skinTone = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e6b88a'),
    roughness: 0.6,
    metalness: 0.02,
  });

  const lanternGlow = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fef3c7'),
    emissive: new THREE.Color('#f59e0b'),
    emissiveIntensity: 2.8,
    roughness: 0.15,
    metalness: 0.1,
  });

  const beamMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#fde68a'),
    transparent: true,
    opacity: 0.075,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const rockMaterial = new THREE.MeshStandardMaterial({
    map: rockTex,
    color: new THREE.Color('#334155'),
    roughness: 0.88,
    metalness: 0.08,
    flatShading: true,
  });

  const pineFoliage = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0f2922'),
    roughness: 0.86,
    metalness: 0.02,
    flatShading: true,
  });

  const pineTrunk = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2c1d14'),
    roughness: 0.92,
    metalness: 0.0,
  });

  return {
    waterMaterial,
    waterUniforms,
    woodHull,
    woodDark,
    brassMetal,
    steelMetal,
    slickerFabric,
    skinTone,
    lanternGlow,
    beamMaterial,
    rockMaterial,
    pineFoliage,
    pineTrunk,
    dispose: () => {
      woodTex.dispose();
      rockTex.dispose();
      waterMaterial.dispose();
      woodHull.dispose();
      woodDark.dispose();
      brassMetal.dispose();
      steelMetal.dispose();
      slickerFabric.dispose();
      skinTone.dispose();
      lanternGlow.dispose();
      beamMaterial.dispose();
      rockMaterial.dispose();
      pineFoliage.dispose();
      pineTrunk.dispose();
    },
  };
}
