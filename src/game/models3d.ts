import * as THREE from 'three';
import { LakeMaterials } from './materials3d';
import { MonsterKind } from './types';

export interface SashaBoatRig {
  root: THREE.Group;
  hullGroup: THREE.Group;
  turretGroup: THREE.Group;
  harpoonRecoilGroup: THREE.Group;
  propeller: THREE.Group;
  lanternLight: THREE.PointLight;
  searchSpot: THREE.SpotLight;
  searchTarget: THREE.Object3D;
}

export function createSashaBoatModel(mats: LakeMaterials): SashaBoatRig {
  const root = new THREE.Group();
  const hullGroup = new THREE.Group();
  root.add(hullGroup);

  const crimsonBaronMat = new THREE.MeshStandardMaterial({
    color: '#881337',
    roughness: 0.55,
    metalness: 0.12,
  });
  const oilJewelMat = new THREE.MeshStandardMaterial({
    color: '#1e1b18',
    emissive: '#92400e',
    emissiveIntensity: 0.6,
    roughness: 0.15,
    metalness: 0.85,
  });

  // 1. Extruded wooden boat hull silhouette (pointed bow at +Z)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, 1.6);
  hullShape.quadraticCurveTo(0.88, 0.78, 0.8, -1.28);
  hullShape.lineTo(-0.8, -1.28);
  hullShape.quadraticCurveTo(-0.88, 0.78, 0, 1.6);

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 0.48,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.07,
    bevelSegments: 2,
  });
  hullGeo.rotateX(Math.PI / 2);
  hullGeo.translate(0, 0.34, 0);

  const hullMesh = new THREE.Mesh(hullGeo, mats.woodHull);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  hullGroup.add(hullMesh);

  // 2. Inner recessed deck & wooden bench thwarts
  const deckGeo = new THREE.BoxGeometry(1.1, 0.08, 2.08);
  const deckMesh = new THREE.Mesh(deckGeo, mats.woodDark);
  deckMesh.position.set(0, 0.25, -0.05);
  deckMesh.receiveShadow = true;
  hullGroup.add(deckMesh);

  const benchGeo = new THREE.BoxGeometry(1.24, 0.09, 0.3);
  const frontBench = new THREE.Mesh(benchGeo, mats.woodHull);
  frontBench.position.set(0, 0.36, 0.48);
  frontBench.castShadow = true;
  hullGroup.add(frontBench);

  const rearBench = new THREE.Mesh(benchGeo, mats.woodHull);
  rearBench.position.set(0, 0.36, -0.82);
  rearBench.castShadow = true;
  hullGroup.add(rearBench);

  // 3. Baron Gilded Gunwale Rails & Bow "Нефтебульба" Crest
  const railSideGeo = new THREE.BoxGeometry(0.06, 0.07, 1.85);
  const leftRail = new THREE.Mesh(railSideGeo, mats.brassMetal);
  leftRail.position.set(-0.77, 0.46, -0.25);
  const rightRail = leftRail.clone();
  rightRail.position.x = 0.77;
  hullGroup.add(leftRail, rightRail);

  const bowTrimGeo = new THREE.ConeGeometry(0.2, 0.5, 6);
  bowTrimGeo.rotateX(Math.PI / 2);
  const bowTrim = new THREE.Mesh(bowTrimGeo, mats.brassMetal);
  bowTrim.position.set(0, 0.4, 1.56);
  hullGroup.add(bowTrim);

  // Golden Neftebulba crest mounted on bow deck
  const crestRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 16), mats.brassMetal);
  crestRing.rotation.x = Math.PI / 2;
  crestRing.position.set(0, 0.43, 0.92);
  hullGroup.add(crestRing);

  const bulbaEmblem = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), oilJewelMat);
  bulbaEmblem.scale.set(1.2, 0.75, 0.9);
  bulbaEmblem.position.set(0, 0.44, 0.92);
  hullGroup.add(bulbaEmblem);

  // 4. Bow Lantern (brass post + glowing amber glass + point light)
  const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.38, 8), mats.brassMetal);
  lanternPost.position.set(0, 0.52, 1.26);
  hullGroup.add(lanternPost);

  const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.22, 8), mats.lanternGlow);
  lanternGlass.position.set(0, 0.74, 1.26);
  hullGroup.add(lanternGlass);

  const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 8), mats.brassMetal);
  lanternCap.position.set(0, 0.89, 1.26);
  hullGroup.add(lanternCap);

  const lanternLight = new THREE.PointLight('#f59e0b', 6.8, 19, 1.5);
  lanternLight.position.set(0, 1.1, 1.26);
  hullGroup.add(lanternLight);

  // 5. Stern Outboard Motor & Spinning Brass Propeller
  const motorBody = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.38), mats.steelMetal);
  motorBody.position.set(0, 0.42, -1.4);
  motorBody.castShadow = true;
  hullGroup.add(motorBody);

  const motorCap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.4), mats.brassMetal);
  motorCap.position.set(0, 0.67, -1.4);
  hullGroup.add(motorCap);

  const motorShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.55, 8), mats.steelMetal);
  motorShaft.position.set(0, 0.1, -1.48);
  hullGroup.add(motorShaft);

  const propeller = new THREE.Group();
  propeller.position.set(0, -0.14, -1.54);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.02), mats.brassMetal);
    blade.rotation.z = (i / 3) * Math.PI * 2;
    blade.rotation.y = 0.35;
    propeller.add(blade);
  }
  hullGroup.add(propeller);

  // 6. Pivoting Harpoon Turret + Барон Песковской Нефтебульбы Саша
  const turretGroup = new THREE.Group();
  turretGroup.position.set(0, 0.34, 0.05);
  root.add(turretGroup);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.31, 0.28, 12), mats.brassMetal);
  pedestal.position.set(0, 0.14, 0.22);
  turretGroup.add(pedestal);

  // Baron Sasha Coat & Crimson Sash
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.33, 0.6, 10), mats.slickerFabric);
  torso.position.set(0, 0.45, -0.14);
  torso.castShadow = true;
  turretGroup.add(torso);

  const crimsonCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.26, 0.14, 10), crimsonBaronMat);
  crimsonCollar.position.set(0, 0.68, -0.14);
  turretGroup.add(crimsonCollar);

  // Golden Baron Epaulettes
  const epGeo = new THREE.BoxGeometry(0.16, 0.06, 0.14);
  const epL = new THREE.Mesh(epGeo, mats.brassMetal);
  epL.position.set(-0.27, 0.72, -0.14);
  epL.rotation.z = 0.18;
  const epR = epL.clone();
  epR.position.x = 0.27;
  epR.rotation.z = -0.18;
  turretGroup.add(epL, epR);

  // Arms gripping turret handles
  const armGeo = new THREE.CylinderGeometry(0.065, 0.06, 0.44, 8);
  armGeo.rotateX(Math.PI / 2.3);
  const leftArm = new THREE.Mesh(armGeo, mats.slickerFabric);
  leftArm.position.set(-0.23, 0.56, 0.08);
  leftArm.rotation.y = -0.25;
  turretGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, mats.slickerFabric);
  rightArm.position.set(0.23, 0.56, 0.08);
  rightArm.rotation.y = 0.25;
  turretGroup.add(rightArm);

  // Head & Ornate Baron Hat with Gold Trim
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 10), mats.skinTone);
  head.position.set(0, 0.87, -0.14);
  head.castShadow = true;
  turretGroup.add(head);

  // Baron moustache
  const stache = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.035, 0.06), mats.woodDark);
  stache.position.set(0, 0.82, 0.02);
  turretGroup.add(stache);

  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.035, 14), mats.slickerFabric);
  hatBrim.position.set(0, 0.98, -0.14);
  hatBrim.rotation.x = 0.08;
  turretGroup.add(hatBrim);

  const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.18, 12), mats.slickerFabric);
  hatCrown.position.set(0, 1.07, -0.14);
  turretGroup.add(hatCrown);

  const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 12), mats.brassMetal);
  hatBand.position.set(0, 1.01, -0.14);
  turretGroup.add(hatBand);

  const hatCrest = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), mats.lanternGlow);
  hatCrest.position.set(0, 1.07, 0.06);
  turretGroup.add(hatCrest);

  // Harpoon Rail & Recoil Group
  const harpoonRecoilGroup = new THREE.Group();
  harpoonRecoilGroup.position.set(0, 0.54, 0.3);
  turretGroup.add(harpoonRecoilGroup);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.98), mats.steelMetal);
  rail.position.set(0, 0, 0.25);
  rail.castShadow = true;
  harpoonRecoilGroup.add(rail);

  const brassGuard = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 8), mats.brassMetal);
  brassGuard.rotation.x = Math.PI / 2;
  brassGuard.position.set(0, 0, 0.65);
  harpoonRecoilGroup.add(brassGuard);

  const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.36, 6), mats.lanternGlow);
  spearTip.rotation.x = Math.PI / 2;
  spearTip.position.set(0, 0, 0.87);
  harpoonRecoilGroup.add(spearTip);

  // Searchlight Cone attached to Turret Aim
  const searchSpot = new THREE.SpotLight('#fef3c7', 16, 28, Math.PI / 5.5, 0.55, 1.3);
  searchSpot.position.set(0, 0.8, 0.35);
  const searchTarget = new THREE.Object3D();
  searchTarget.position.set(0, 0, 12);
  turretGroup.add(searchTarget);
  searchSpot.target = searchTarget;
  turretGroup.add(searchSpot);

  const coneGeo = new THREE.ConeGeometry(2.6, 11, 16, 1, true);
  coneGeo.translate(0, -5.5, 0);
  coneGeo.rotateX(-Math.PI / 2);
  const coneMesh = new THREE.Mesh(coneGeo, mats.beamMaterial);
  coneMesh.position.set(0, 0.66, 0.45);
  turretGroup.add(coneMesh);

  return {
    root,
    hullGroup,
    turretGroup,
    harpoonRecoilGroup,
    propeller,
    lanternLight,
    searchSpot,
    searchTarget,
  };
}

export interface MonsterMeshRig {
  root: THREE.Group;
  segments: THREE.Object3D[];
  tail: THREE.Object3D | null;
  bodyMat: THREE.MeshStandardMaterial;
  accentMat: THREE.MeshStandardMaterial;
  eyeMat: THREE.MeshStandardMaterial;
  telegraphLine: THREE.Mesh | null;
}

export function createMonsterModel(kind: MonsterKind): MonsterMeshRig {
  const root = new THREE.Group();
  const segments: THREE.Object3D[] = [];
  let tail: THREE.Object3D | null = null;
  let telegraphLine: THREE.Mesh | null = null;

  let primaryHex = '#1f423b';
  let accentHex = '#488878';
  let eyeHex = '#fbbf24';

  if (kind === 'catfish') {
    primaryHex = '#232e3c';
    accentHex = '#52677f';
    eyeHex = '#e2e8f0';
  } else if (kind === 'eel') {
    primaryHex = '#143146';
    accentHex = '#38bdf8';
    eyeHex = '#7dd3fc';
  } else if (kind === 'puffer') {
    primaryHex = '#4b1f27';
    accentHex = '#ef4444';
    eyeHex = '#fca5a5';
  } else if (kind === 'minnow') {
    primaryHex = '#2e3848';
    accentHex = '#f87171';
    eyeHex = '#fca5a5';
  } else if (kind === 'leviathan') {
    primaryHex = '#0c272c';
    accentHex = '#10b981';
    eyeHex = '#bef264';
  } else if (kind === 'croc_gena') {
    primaryHex = '#15803d';
    accentHex = '#b91c1c'; // Iconic villainous red coat!
    eyeHex = '#facc15';
  } else if (kind === 'ersh') {
    primaryHex = '#4a5d23';
    accentHex = '#eab308';
    eyeHex = '#fb923c';
  } else if (kind === 'lin') {
    primaryHex = '#14532d';
    accentHex = '#84cc16';
    eyeHex = '#bef264';
  } else if (kind === 'peskar') {
    primaryHex = '#92400e';
    accentHex = '#fde047';
    eyeHex = '#fef08a';
  } else if (kind === 'karas') {
    primaryHex = '#7c2d12';
    accentHex = '#fb923c';
    eyeHex = '#f87171';
  }

  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(primaryHex),
    roughness: 0.42,
    metalness: 0.18,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentHex),
    roughness: 0.35,
    metalness: 0.28,
    emissive:
      kind === 'eel' || kind === 'leviathan' || kind === 'lin'
        ? new THREE.Color(accentHex)
        : new THREE.Color('#000000'),
    emissiveIntensity: kind === 'eel' ? 0.55 : kind === 'leviathan' ? 0.4 : kind === 'lin' ? 0.28 : 0,
  });

  const eyeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(eyeHex),
    emissive: new THREE.Color(eyeHex),
    emissiveIntensity: 2.2,
    roughness: 0.15,
  });

  if (kind === 'croc_gena') {
    // Злодейский крокодил Гена: green croc snout with white teeth, red coat, dark bowler hat, articulated tail!
    const hatMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.5, metalness: 0.1 });
    const toothMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.3 });

    // Torso in red coat
    const coatBody = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.72, 1.55), accentMat);
    coatBody.position.set(0, 0.38, -0.1);
    coatBody.castShadow = true;
    root.add(coatBody);

    // Snout & Jaw
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.34, 1.15), bodyMat);
    snout.position.set(0, 0.44, 1.05);
    snout.castShadow = true;
    root.add(snout);

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 1.05), bodyMat);
    jaw.position.set(0, 0.2, 1.0);
    root.add(jaw);

    // Jagged crocodile teeth along snout
    const toothGeo = new THREE.ConeGeometry(0.055, 0.15, 4);
    for (let t = 0; t < 4; t++) {
      for (const side of [-1, 1]) {
        const tooth = new THREE.Mesh(toothGeo, toothMat);
        tooth.rotation.x = Math.PI;
        tooth.position.set(side * 0.29, 0.27, 0.65 + t * 0.25);
        root.add(tooth);
      }
    }

    // Glowing mischievous eyes
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), eyeMat);
    eyeL.position.set(-0.24, 0.66, 0.62);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.24;
    root.add(eyeL, eyeR);

    // Villainous Bowler/Top Hat
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 12), hatMat);
    brim.position.set(0, 0.78, 0.42);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.34, 12), hatMat);
    crown.position.set(0, 0.96, 0.42);
    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.06, 12), accentMat);
    hatBand.position.set(0, 0.84, 0.42);
    root.add(brim, crown, hatBand);

    // Four Paws
    const pawGeo = new THREE.BoxGeometry(0.32, 0.2, 0.44);
    for (const sx of [-0.7, 0.7]) {
      for (const sz of [-0.55, 0.35]) {
        const paw = new THREE.Mesh(pawGeo, bodyMat);
        paw.position.set(sx, 0.14, sz);
        root.add(paw);
      }
    }

    // Articulated Croc Tail
    tail = new THREE.Group();
    tail.position.set(0, 0.26, -0.88);
    for (let segIdx = 0; segIdx < 3; segIdx++) {
      const w = 0.65 - segIdx * 0.17;
      const tailSeg = new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.65, 0.55), bodyMat);
      tailSeg.position.set(0, 0, -0.25 - segIdx * 0.48);
      const ridge = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 4), bodyMat);
      ridge.position.set(0, w * 0.42, -0.25 - segIdx * 0.48);
      tail.add(tailSeg, ridge);
    }
    root.add(tail);
  } else if (kind === 'eel') {
    // 6-segment articulated glowing sea-eel
    for (let i = 0; i < 6; i++) {
      const r = 0.42 * (1 - i * 0.12);
      const seg = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), i % 2 === 0 ? bodyMat : accentMat);
      body.scale.set(0.95, 0.85, 1.35);
      body.castShadow = true;
      seg.add(body);

      if (i === 0) {
        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
        eyeL.position.set(-0.22, 0.16, 0.28);
        const eyeR = eyeL.clone();
        eyeR.position.x = 0.22;
        seg.add(eyeL, eyeR);
      } else {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 4), accentMat);
        fin.position.set(0, r + 0.1, 0);
        fin.rotation.x = -0.3;
        seg.add(fin);
      }

      seg.position.set(0, 0.15, -i * 0.52);
      root.add(seg);
      segments.push(seg);
    }
  } else if (kind === 'leviathan') {
    const head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1.55, 14, 12), bodyMat);
    skull.scale.set(1.05, 0.72, 1.35);
    skull.castShadow = true;
    head.add(skull);

    for (let p = 0; p < 3; p++) {
      const plate = new THREE.Mesh(new THREE.ConeGeometry(0.42 - p * 0.08, 0.95, 5), accentMat);
      plate.position.set(0, 0.95, 0.55 - p * 0.75);
      plate.rotation.x = -0.35;
      head.add(plate);
    }

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), eyeMat);
    eyeL.position.set(-0.88, 0.42, 1.15);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.88;
    head.add(eyeL, eyeR);

    for (const side of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.85, 0.1, 1.45),
        new THREE.Vector3(side * 1.95, 0.35, 1.85),
        new THREE.Vector3(side * 2.35, 0.15, 0.85),
      ]);
      const barbel = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.065, 6, false), accentMat);
      head.add(barbel);
    }

    head.position.set(0, 0.32, 0.4);
    root.add(head);
    segments.push(head);

    for (let i = 1; i <= 6; i++) {
      const seg = new THREE.Group();
      const r = 1.42 * (1 - i * 0.12);
      const body = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), i % 2 === 0 ? bodyMat : accentMat);
      body.scale.set(0.95, 0.76, 1.18);
      body.castShadow = true;
      seg.add(body);

      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.72, 4), accentMat);
      spine.position.set(0, r * 0.85, 0);
      spine.rotation.x = -0.4;
      seg.add(spine);

      seg.position.set(0, 0.25, -i * 1.18);
      root.add(seg);
      segments.push(seg);
    }

    const teleGeo = new THREE.PlaneGeometry(0.45, 18);
    teleGeo.rotateX(-Math.PI / 2);
    teleGeo.translate(0, 0.12, 9);
    const teleMat = new THREE.MeshBasicMaterial({
      color: '#ef4444',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    telegraphLine = new THREE.Mesh(teleGeo, teleMat);
    telegraphLine.visible = false;
    root.add(telegraphLine);
  } else if (kind === 'puffer') {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.76, 14, 12), bodyMat);
    core.position.y = 0.25;
    core.castShadow = true;
    root.add(core);

    const spineGeo = new THREE.ConeGeometry(0.11, 0.52, 5);
    for (let s = 0; s < 14; s++) {
      const phi = Math.acos(1 - (2 * (s + 0.5)) / 14);
      const theta = Math.PI * (1 + Math.sqrt(5)) * s;
      const spike = new THREE.Mesh(spineGeo, accentMat);
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      );
      spike.position.copy(dir).multiplyScalar(0.75).add(new THREE.Vector3(0, 0.25, 0));
      spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      root.add(spike);
    }

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), eyeMat);
    eyeL.position.set(-0.35, 0.45, 0.62);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.35;
    root.add(eyeL, eyeR);
  } else if (kind === 'ersh') {
    // Ёрш Передрёш: spiky olive-bronze hull with tall thorny dorsal crest and spiked gill plates
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.58, 12, 10), bodyMat);
    torso.scale.set(0.95, 0.88, 1.48);
    torso.position.set(0, 0.28, 0);
    torso.castShadow = true;
    root.add(torso);

    // 6-spine spiky dorsal ruffe crest
    const spineGeo = new THREE.ConeGeometry(0.11, 0.52, 4);
    for (let s = 0; s < 6; s++) {
      const sp = new THREE.Mesh(spineGeo, accentMat);
      sp.position.set(0, 0.72 - s * 0.03, 0.45 - s * 0.23);
      sp.rotation.x = -0.35 - s * 0.05;
      root.add(sp);
    }

    // Flared spiky cheek gill spines
    const cheekGeo = new THREE.ConeGeometry(0.12, 0.48, 4);
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(cheekGeo, accentMat);
      cheek.position.set(side * 0.58, 0.26, 0.36);
      cheek.rotation.z = -side * 1.1;
      cheek.rotation.x = -0.3;
      root.add(cheek);

      const pec = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.34), bodyMat);
      pec.position.set(side * 0.52, 0.16, 0.02);
      pec.rotation.y = side * -0.45;
      root.add(pec);
    }

    tail = new THREE.Group();
    tail.position.set(0, 0.26, -0.82);
    const tailBlade = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.72, 4), accentMat);
    tailBlade.rotation.x = -Math.PI / 2;
    tailBlade.scale.set(0.32, 1, 1.25);
    tailBlade.position.z = -0.25;
    tail.add(tailBlade);
    root.add(tail);

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), eyeMat);
    eyeL.position.set(-0.28, 0.42, 0.62);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.28;
    root.add(eyeL, eyeR);
  } else if (kind === 'lin') {
    // Линь Жминь: thick plump swamp-emerald grazer with broad rounded paddle fins & mouth barbels
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.76, 14, 12), bodyMat);
    torso.scale.set(1.05, 0.92, 1.45);
    torso.position.set(0, 0.32, 0);
    torso.castShadow = true;
    root.add(torso);

    // Rounded thick lime-green dorsal crest & belly ridge
    const dorsal = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 0.92, 8), accentMat);
    dorsal.rotation.x = Math.PI / 2;
    dorsal.position.set(0, 0.92, -0.05);
    root.add(dorsal);

    // Wide rounded paddle fins
    const finGeo = new THREE.SphereGeometry(0.36, 8, 8);
    finGeo.scale(1.4, 0.22, 0.85);
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(finGeo, accentMat);
      fin.position.set(side * 0.78, 0.2, 0.16);
      fin.rotation.y = side * -0.42;
      root.add(fin);

      // Fleshy mouth barbels
      const barbel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.015, 0.45, 5), accentMat);
      barbel.position.set(side * 0.34, 0.18, 1.06);
      barbel.rotation.z = side * 0.7;
      barbel.rotation.x = 0.5;
      root.add(barbel);
    }

    tail = new THREE.Group();
    tail.position.set(0, 0.3, -1.04);
    const tailPad = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), accentMat);
    tailPad.scale.set(0.28, 1.05, 1.3);
    tailPad.position.z = -0.3;
    tail.add(tailPad);
    root.add(tail);

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), eyeMat);
    eyeL.position.set(-0.36, 0.48, 0.82);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.36;
    root.add(eyeL, eyeR);
  } else if (kind === 'peskar') {
    // Пескарь Натаскарь: sleek sandy-gold thief fish with shovel snout, barbels & brass loot sack
    const sackMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.45, metalness: 0.35 });
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), bodyMat);
    torso.scale.set(0.88, 0.72, 1.82);
    torso.position.set(0, 0.22, 0);
    torso.castShadow = true;
    root.add(torso);

    // Broad shovel snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.2, 0.44), accentMat);
    snout.position.set(0, 0.16, 0.72);
    root.add(snout);

    // Downward thief barbels
    for (const side of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.01, 0.48, 5), accentMat);
      b.position.set(side * 0.24, 0.06, 0.88);
      b.rotation.z = side * 0.55;
      b.rotation.x = 0.45;
      root.add(b);

      const pec = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.26), accentMat);
      pec.position.set(side * 0.42, 0.15, 0.18);
      pec.rotation.y = side * -0.5;
      root.add(pec);
    }

    // Strapped brass loot-pack on back ("Натаскарь")
    const lootSack = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), sackMat);
    lootSack.position.set(0, 0.52, -0.05);
    lootSack.scale.set(1.1, 0.85, 1.25);
    root.add(lootSack);

    tail = new THREE.Group();
    tail.position.set(0, 0.22, -0.78);
    const tailBlade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.62, 4), accentMat);
    tailBlade.rotation.x = -Math.PI / 2;
    tailBlade.scale.set(0.28, 1, 1.35);
    tailBlade.position.z = -0.22;
    tail.add(tailBlade);
    root.add(tail);

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), eyeMat);
    eyeL.position.set(-0.22, 0.34, 0.56);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.22;
    root.add(eyeL, eyeR);
  } else if (kind === 'karas') {
    // Карась Вырубась: tall copper-bronze disc fish with heavy forehead ram crest & orange paddles
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.68, 14, 12), bodyMat);
    torso.scale.set(0.74, 1.18, 1.32);
    torso.position.set(0, 0.44, 0);
    torso.castShadow = true;
    root.add(torso);

    // Armored battering forehead plate
    const ramCrest = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.46), accentMat);
    ramCrest.position.set(0, 0.52, 0.72);
    ramCrest.rotation.x = 0.35;
    root.add(ramCrest);

    const dorsal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.72), accentMat);
    dorsal.position.set(0, 1.16, -0.1);
    dorsal.rotation.x = -0.25;
    root.add(dorsal);

    for (const side of [-1, 1]) {
      const pec = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.38), accentMat);
      pec.position.set(side * 0.54, 0.26, 0.2);
      pec.rotation.y = side * -0.4;
      root.add(pec);
    }

    tail = new THREE.Group();
    tail.position.set(0, 0.42, -0.88);
    const tailBlade = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.74, 4), accentMat);
    tailBlade.rotation.x = -Math.PI / 2;
    tailBlade.scale.set(0.3, 1, 1.25);
    tailBlade.position.z = -0.26;
    tail.add(tailBlade);
    root.add(tail);

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), eyeMat);
    eyeL.position.set(-0.34, 0.6, 0.58);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.34;
    root.add(eyeL, eyeR);

    const teleGeo = new THREE.PlaneGeometry(0.36, 13);
    teleGeo.rotateX(-Math.PI / 2);
    teleGeo.translate(0, 0.1, 6.5);
    const teleMat = new THREE.MeshBasicMaterial({
      color: '#fb923c',
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    telegraphLine = new THREE.Mesh(teleGeo, teleMat);
    telegraphLine.visible = false;
    root.add(telegraphLine);
  } else {
    // Pike, Catfish, Minnow
    const scale = kind === 'catfish' ? 1.4 : kind === 'minnow' ? 0.58 : 1.0;
    const lenRatio = kind === 'pike' ? 1.55 : 1.15;

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.55 * scale, 12, 10), bodyMat);
    torso.scale.set(0.85, 0.72, lenRatio * 1.45);
    torso.position.set(0, 0.2 * scale, 0);
    torso.castShadow = true;
    root.add(torso);

    const dorsalGeo = new THREE.ConeGeometry(0.15 * scale, 0.55 * scale, 4);
    const dorsal = new THREE.Mesh(dorsalGeo, accentMat);
    dorsal.position.set(0, 0.58 * scale, -0.1 * scale);
    dorsal.rotation.x = -0.45;
    root.add(dorsal);

    const pecGeo = new THREE.BoxGeometry(0.55 * scale, 0.05 * scale, 0.28 * scale);
    const pecL = new THREE.Mesh(pecGeo, accentMat);
    pecL.position.set(-0.48 * scale, 0.14 * scale, 0.15 * scale);
    pecL.rotation.y = 0.45;
    const pecR = pecL.clone();
    pecR.position.x = 0.48 * scale;
    pecR.rotation.y = -0.45;
    root.add(pecL, pecR);

    tail = new THREE.Group();
    tail.position.set(0, 0.2 * scale, -0.78 * scale * lenRatio);
    const tailBlade = new THREE.Mesh(new THREE.ConeGeometry(0.38 * scale, 0.68 * scale, 4), accentMat);
    tailBlade.rotation.x = -Math.PI / 2;
    tailBlade.scale.set(0.32, 1, 1.3);
    tailBlade.position.z = -0.25 * scale;
    tail.add(tailBlade);
    root.add(tail);

    if (kind === 'catfish') {
      for (const side of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.01, 0.75, 5), accentMat);
        w.rotation.z = side * 1.1;
        w.rotation.x = 0.45;
        w.position.set(side * 0.55, 0.15, 0.85);
        root.add(w);
      }
    }

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.1 * scale, 8, 8), eyeMat);
    eyeL.position.set(-0.26 * scale, 0.34 * scale, 0.58 * scale * lenRatio);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.26 * scale;
    root.add(eyeL, eyeR);

    if (kind === 'pike') {
      const teleGeo = new THREE.PlaneGeometry(0.28, 12);
      teleGeo.rotateX(-Math.PI / 2);
      teleGeo.translate(0, 0.1, 6);
      const teleMat = new THREE.MeshBasicMaterial({
        color: '#ef4444',
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      telegraphLine = new THREE.Mesh(teleGeo, teleMat);
      telegraphLine.visible = false;
      root.add(telegraphLine);
    }
  }

  return {
    root,
    segments,
    tail,
    bodyMat,
    accentMat,
    eyeMat,
    telegraphLine,
  };
}

// ==================== THEMED 3D PICKUPS & BITCOIN PROJECTILE ====================

export interface PickupAssets3D {
  coinGeo: THREE.OctahedronGeometry;
  coinMat: THREE.MeshStandardMaterial;
  bulbaMat: THREE.MeshStandardMaterial;
  sproutMat: THREE.MeshStandardMaterial;
  garlicMat: THREE.MeshStandardMaterial;
  harpoonPowerMat: THREE.MeshStandardMaterial;
  glowRingGeo: THREE.RingGeometry;
  healRingMat: THREE.MeshBasicMaterial;
  garlicRingMat: THREE.MeshBasicMaterial;
  powerRingMat: THREE.MeshBasicMaterial;
  bitcoinMat: THREE.MeshStandardMaterial;
  dispose: () => void;
}

export function createPickupAssets3D(): PickupAssets3D {
  const coinGeo = new THREE.OctahedronGeometry(0.34, 0);
  const coinMat = new THREE.MeshStandardMaterial({
    color: '#fbbf24',
    emissive: '#d97706',
    emissiveIntensity: 1.4,
    roughness: 0.22,
    metalness: 0.7,
  });

  const bulbaMat = new THREE.MeshStandardMaterial({
    color: '#c28d48',
    emissive: '#3f2e12',
    emissiveIntensity: 0.55,
    roughness: 0.72,
    metalness: 0.05,
  });

  const sproutMat = new THREE.MeshStandardMaterial({
    color: '#34d399',
    emissive: '#10b981',
    emissiveIntensity: 1.6,
    roughness: 0.4,
  });

  const garlicMat = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    emissive: '#cbd5e1',
    emissiveIntensity: 0.85,
    roughness: 0.38,
    metalness: 0.05,
  });

  const harpoonPowerMat = new THREE.MeshStandardMaterial({
    color: '#fbbf24',
    emissive: '#ef4444',
    emissiveIntensity: 1.85,
    roughness: 0.22,
    metalness: 0.75,
  });

  const glowRingGeo = new THREE.RingGeometry(0.55, 0.72, 20);
  glowRingGeo.rotateX(-Math.PI / 2);

  const healRingMat = new THREE.MeshBasicMaterial({
    color: '#10b981',
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const garlicRingMat = new THREE.MeshBasicMaterial({
    color: '#e2e8f0',
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const powerRingMat = new THREE.MeshBasicMaterial({
    color: '#f97316',
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const bitcoinMat = new THREE.MeshStandardMaterial({
    color: '#fbbf24',
    emissive: '#f59e0b',
    emissiveIntensity: 2.3,
    roughness: 0.18,
    metalness: 0.85,
  });

  return {
    coinGeo,
    coinMat,
    bulbaMat,
    sproutMat,
    garlicMat,
    harpoonPowerMat,
    glowRingGeo,
    healRingMat,
    garlicRingMat,
    powerRingMat,
    bitcoinMat,
    dispose: () => {
      coinGeo.dispose();
      coinMat.dispose();
      bulbaMat.dispose();
      sproutMat.dispose();
      garlicMat.dispose();
      harpoonPowerMat.dispose();
      glowRingGeo.dispose();
      healRingMat.dispose();
      garlicRingMat.dispose();
      powerRingMat.dispose();
      bitcoinMat.dispose();
    },
  };
}

export function buildBulbaPickupMesh(assets: PickupAssets3D): THREE.Group {
  // Здоровье: 1 Бульба (sculpted potato + green sprout + emerald heal ring)
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), assets.bulbaMat);
  body.scale.set(1.28, 0.88, 0.96);
  group.add(body);

  const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), assets.bulbaMat);
  lobe.position.set(0.28, -0.05, 0.12);
  group.add(lobe);

  // Green potato sprout leaf on top
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.25, 6), assets.sproutMat);
  stem.position.set(0.05, 0.42, 0);
  const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 4), assets.sproutMat);
  leaf.position.set(0.14, 0.52, 0);
  leaf.rotation.z = -0.7;
  group.add(stem, leaf);

  const ring = new THREE.Mesh(assets.glowRingGeo, assets.healRingMat);
  ring.position.y = -0.35;
  group.add(ring);
  return group;
}

export function buildGarlicPickupMesh(assets: PickupAssets3D): THREE.Group {
  // Чеснок: 6 segmented pearlescent cloves + green sprout shoot + white/silver ring
  const group = new THREE.Group();
  const cloveGeo = new THREE.SphereGeometry(0.21, 8, 8);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const clove = new THREE.Mesh(cloveGeo, assets.garlicMat);
    clove.scale.set(0.85, 1.25, 0.85);
    clove.position.set(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2);
    group.add(clove);
  }
  const stem = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 6), assets.sproutMat);
  stem.position.y = 0.36;
  group.add(stem);

  const ring = new THREE.Mesh(assets.glowRingGeo, assets.garlicRingMat);
  ring.position.y = -0.32;
  group.add(ring);
  return group;
}

export function buildHarpoonPowerPickupMesh(assets: PickupAssets3D): THREE.Group {
  // Улучшение силы гарпуна: glowing golden-crimson spearhead floating inside brass torus
  const group = new THREE.Group();
  const spear = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.78, 6), assets.harpoonPowerMat);
  spear.rotation.x = Math.PI / 5;
  group.add(spear);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 16), assets.coinMat);
  halo.rotation.x = Math.PI / 2;
  group.add(halo);

  const ring = new THREE.Mesh(assets.glowRingGeo, assets.powerRingMat);
  ring.position.y = -0.35;
  group.add(ring);
  return group;
}

export function buildBitcoinProjectileMesh(assets: PickupAssets3D): THREE.Group {
  // Spinning golden 3D Bitcoin coin with embossed ₿ bars
  const group = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.09, 16), assets.bitcoinMat);
  disc.rotation.x = Math.PI / 2;
  group.add(disc);

  // Embossed "B" vertical bars and cross shape on front/back
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.48, 0.13), assets.coinMat);
  const crossTop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.13), assets.coinMat);
  crossTop.position.set(0.06, 0.11, 0);
  const crossBot = crossTop.clone();
  crossBot.position.y = -0.11;
  group.add(bar, crossTop, crossBot);
  return group;
}
