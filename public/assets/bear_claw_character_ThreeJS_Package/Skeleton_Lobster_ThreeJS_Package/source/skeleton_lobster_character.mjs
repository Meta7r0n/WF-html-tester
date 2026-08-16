import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);

export const CHARACTER_INFO = {
  name: 'Skeleton Lobster',
  version: '0.1.0',
  description: 'A cartoon skeleton-lobster rogue with oversized pincers, crown pendant, cigarette, and chunky high-top sneakers.',
  coordinateSystem: 'Y-up; character faces -Z',
  units: 'meters',
  scale: 'approximately 6.5 meters tall in the exported scene',
};

export const PALETTE = {
  bone: 0xf0e6d4,
  boneShadow: 0xcbbda7,
  void: 0x101116,
  shell: 0xc94c2c,
  shellDark: 0x722a1e,
  shellHighlight: 0xf06b3d,
  shorts: 0x656b59,
  shortsDark: 0x3c4136,
  shoeBlack: 0x12151b,
  rubber: 0xeeeeea,
  rubberShadow: 0x9f9d94,
  gold: 0xd39b1e,
  goldBright: 0xf2c34e,
  crownRed: 0x9e2624,
  eyeWhite: 0xf7f6ef,
  eyeBlack: 0x08090c,
  eyeHighlight: 0xffffff,
  mouth: 0x3a211a,
  cigar: 0x9c6a3d,
  ember: 0xf2752c,
  smoke: 0x8a8990,
  crack: 0x9e9485,
};

function makeMaterial(name, color, options = {}) {
  const material = new THREE.MeshStandardMaterial({
    name,
    color,
    roughness: options.roughness ?? 0.66,
    metalness: options.metalness ?? 0.0,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 1,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
  });
  material.userData.role = options.role ?? 'surface';
  return material;
}

export function createMaterials() {
  return {
    bone: makeMaterial('Bone_Warm_Ivory', PALETTE.bone, { roughness: 0.58, role: 'bone' }),
    boneShadow: makeMaterial('Bone_Shadow', PALETTE.boneShadow, { roughness: 0.72, role: 'bone-accent' }),
    void: makeMaterial('Skeleton_Void_Black', PALETTE.void, { roughness: 0.48, role: 'body' }),
    shell: makeMaterial('Lobster_Shell_Red', PALETTE.shell, { roughness: 0.42, role: 'shell' }),
    shellDark: makeMaterial('Lobster_Shell_Inner', PALETTE.shellDark, { roughness: 0.5, role: 'shell-inner' }),
    shellHighlight: makeMaterial('Lobster_Shell_Highlight', PALETTE.shellHighlight, { roughness: 0.38, role: 'shell-accent' }),
    shorts: makeMaterial('Olive_Short_Pants', PALETTE.shorts, { roughness: 0.92, role: 'cloth' }),
    shortsDark: makeMaterial('Olive_Short_Shadow', PALETTE.shortsDark, { roughness: 0.96, role: 'cloth-accent' }),
    shoeBlack: makeMaterial('Sneaker_Black_Canvas', PALETTE.shoeBlack, { roughness: 0.78, role: 'shoe' }),
    rubber: makeMaterial('Sneaker_Aged_Rubber', PALETTE.rubber, { roughness: 0.72, role: 'shoe-rubber' }),
    rubberShadow: makeMaterial('Sneaker_Rubber_Shadow', PALETTE.rubberShadow, { roughness: 0.8, role: 'shoe-accent' }),
    gold: makeMaterial('Chain_Antique_Gold', PALETTE.gold, { roughness: 0.3, metalness: 0.72, role: 'jewelry' }),
    goldBright: makeMaterial('Crown_Polished_Gold', PALETTE.goldBright, { roughness: 0.22, metalness: 0.84, role: 'jewelry-accent' }),
    crownRed: makeMaterial('Crown_Red_Gem', PALETTE.crownRed, { roughness: 0.26, metalness: 0.1, role: 'gem' }),
    eyeWhite: makeMaterial('Eye_White', PALETTE.eyeWhite, { roughness: 0.36, role: 'eye' }),
    eyeBlack: makeMaterial('Eye_Black', PALETTE.eyeBlack, { roughness: 0.24, role: 'eye-pupil' }),
    eyeHighlight: makeMaterial('Eye_Highlight', PALETTE.eyeHighlight, { roughness: 0.16, role: 'eye-highlight' }),
    mouth: makeMaterial('Mouth_Interior', PALETTE.mouth, { roughness: 0.75, role: 'mouth' }),
    cigar: makeMaterial('Cigar_Wrap', PALETTE.cigar, { roughness: 0.8, role: 'prop' }),
    ember: makeMaterial('Cigar_Ember', PALETTE.ember, { roughness: 0.34, emissive: PALETTE.ember, emissiveIntensity: 0.35, role: 'prop-glow' }),
    smoke: makeMaterial('Smoke_Transparent', PALETTE.smoke, { roughness: 1, transparent: true, opacity: 0.34, role: 'fx' }),
    crack: makeMaterial('Skull_Crack', PALETTE.crack, { roughness: 0.84, role: 'face-detail' }),
  };
}

function addMesh(parent, geometry, material, name, options = {}) {
  geometry.computeVertexNormals();
  if (!material.map && geometry.getAttribute('uv')) geometry.deleteAttribute('uv');
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = options.receiveShadow ?? true;
  mesh.position.copy(options.position ?? new V3());
  if (options.scale) mesh.scale.copy(options.scale);
  if (options.rotation) mesh.rotation.copy(options.rotation);
  if (options.quaternion) mesh.quaternion.copy(options.quaternion);
  if (options.userData) Object.assign(mesh.userData, options.userData);
  parent.add(mesh);
  return mesh;
}

function sphere(parent, name, material, position, scale, options = {}) {
  return addMesh(parent, new THREE.SphereGeometry(1, options.widthSegments ?? 18, options.heightSegments ?? 12), material, name, {
    ...options,
    position,
    scale,
  });
}

function ellipsoid(parent, name, material, position, scale, options = {}) {
  return sphere(parent, name, material, position, scale, options);
}

function capsuleBetween(parent, name, a, b, radius, material, options = {}) {
  const start = a.clone();
  const end = b.clone();
  const direction = end.clone().sub(start);
  const distance = direction.length();
  const bodyLength = Math.max(0.025, distance - radius * 2);
  const geometry = new THREE.CapsuleGeometry(radius, bodyLength, options.capSegments ?? 4, options.radialSegments ?? 10);
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize());
  return addMesh(parent, geometry, material, name, {
    ...options,
    position: midpoint,
    quaternion,
  });
}

function cylinderBetween(parent, name, a, b, radius, material, options = {}) {
  const direction = b.clone().sub(a);
  const geometry = new THREE.CylinderGeometry(radius, options.bottomRadius ?? radius, direction.length(), options.radialSegments ?? 12, options.heightSegments ?? 1);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize());
  return addMesh(parent, geometry, material, name, {
    ...options,
    position: a.clone().add(b).multiplyScalar(0.5),
    quaternion,
  });
}

function curveTube(parent, name, points, radius, material, options = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => point.clone()), false, 'centripetal', 0.5);
  const geometry = new THREE.TubeGeometry(curve, options.tubularSegments ?? 18, radius, options.radialSegments ?? 6, false);
  return addMesh(parent, geometry, material, name, options);
}

function torus(parent, name, material, position, majorRadius, tubeRadius, scale = new V3(1, 1, 1), rotation = new THREE.Euler(), options = {}) {
  const geometry = new THREE.TorusGeometry(majorRadius, tubeRadius, options.radialSegments ?? 8, options.tubularSegments ?? 16);
  return addMesh(parent, geometry, material, name, { ...options, position, scale, rotation });
}

function circleDisc(parent, name, material, position, radius, rotation = new THREE.Euler(0, 0, 0), options = {}) {
  const geometry = new THREE.CylinderGeometry(radius, radius, options.depth ?? 0.04, options.segments ?? 16);
  return addMesh(parent, geometry, material, name, { ...options, position, rotation });
}

function shapeExtrusion(points, depth = 0.05) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 3, steps: 1 });
}

function addCrown(parent, materials) {
  const crown = new THREE.Group();
  crown.name = 'Crown_Pendant_Rig';
  crown.position.set(0, 3.83, -0.79);
  parent.add(crown);

  const crownGeometry = shapeExtrusion([
    [-0.42, -0.16], [-0.35, 0.28], [-0.10, 0.02], [0.02, 0.38], [0.20, 0.04], [0.43, 0.29], [0.36, -0.16],
  ], 0.12);
  addMesh(crown, crownGeometry, materials.goldBright, 'Crown_Gold_Silhouette', { rotation: new THREE.Euler(0, 0, 0) });

  [-0.24, 0, 0.24].forEach((x, index) => {
    sphere(crown, `Crown_Red_Jewel_${index + 1}`, materials.crownRed, new V3(x, 0.02, -0.075), new V3(0.07, 0.095, 0.035), { widthSegments: 12, heightSegments: 8 });
  });
  return crown;
}

function addStar(parent, name, material, position, rotation) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? 0.16 : 0.07;
    points.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  const geometry = shapeExtrusion(points, 0.025);
  return addMesh(parent, geometry, material, name, { position, rotation });
}

function addClaw(parent, name, materials, options = {}) {
  const claw = new THREE.Group();
  claw.name = name;
  claw.position.copy(options.position ?? new V3());
  claw.rotation.z = options.rotationZ ?? 0;
  claw.scale.setScalar(options.scale ?? 1);
  parent.add(claw);

  ellipsoid(claw, `${name}_Palm`, materials.shell, new V3(0, 0.25, 0), new V3(0.54, 0.60, 0.42), { widthSegments: 18, heightSegments: 12 });
  ellipsoid(claw, `${name}_Palm_Inner`, materials.shellDark, new V3(0, 0.34, -0.39), new V3(0.25, 0.28, 0.055), { widthSegments: 14, heightSegments: 8 });
  capsuleBetween(claw, `${name}_Palm_Emblem`, new V3(-0.13, 0.34, -0.45), new V3(0.13, 0.34, -0.45), 0.035, materials.void, { capSegments: 3, radialSegments: 8 });

  // Broad extruded lobes preserve the strong lobster-pincer silhouette better than
  // a chain of thin cylinders, while the shallow depth keeps them inexpensive.
  const upper = [
    [-0.18, 0.17], [-0.50, 0.38], [-0.73, 0.75], [-0.80, 1.10], [-0.70, 1.48], [-0.50, 1.68],
    [-0.30, 1.68], [-0.39, 1.40], [-0.45, 1.15], [-0.36, 0.82], [-0.10, 0.52],
  ];
  const lower = [
    [0.12, 0.18], [0.43, 0.34], [0.72, 0.62], [0.87, 0.95], [0.82, 1.28], [0.66, 1.52],
    [0.45, 1.59], [0.52, 1.30], [0.54, 1.03], [0.36, 0.76], [0.10, 0.51],
  ];
  addMesh(claw, shapeExtrusion(upper, 0.20), materials.shell, `${name}_Upper_Pincer_Plate`, { position: new V3(0, 0, -0.13) });
  addMesh(claw, shapeExtrusion(lower, 0.20), materials.shell, `${name}_Lower_Pincer_Plate`, { position: new V3(0, 0, -0.13) });
  sphere(claw, `${name}_Upper_Pincer_Tip`, materials.shellHighlight, new V3(-0.58, 1.58, -0.15), new V3(0.12, 0.15, 0.10), { widthSegments: 12, heightSegments: 8 });
  sphere(claw, `${name}_Lower_Pincer_Tip`, materials.shellHighlight, new V3(0.62, 1.45, -0.15), new V3(0.12, 0.15, 0.10), { widthSegments: 12, heightSegments: 8 });

  // A dark inner membrane gives the open pincer a readable silhouette in a game camera.
  ellipsoid(claw, `${name}_Inner_Membrane`, materials.shellDark, new V3(0, 0.62, 0.01), new V3(0.16, 0.42, 0.08), { widthSegments: 14, heightSegments: 8 });
  return claw;
}

function addSneaker(parent, name, position, direction, materials) {
  const shoe = new THREE.Group();
  shoe.name = name;
  shoe.position.copy(position);
  const normalizedDirection = direction.clone().normalize();
  shoe.quaternion.setFromUnitVectors(new V3(0, 0, -1), normalizedDirection);
  parent.add(shoe);

  addMesh(shoe, new RoundedBoxGeometry(0.98, 0.72, 1.62, 4, 0.16), materials.shoeBlack, `${name}_Canvas_Upper`, { position: new V3(0, 0.02, -0.18) });
  addMesh(shoe, new RoundedBoxGeometry(1.10, 0.22, 1.80, 4, 0.08), materials.rubber, `${name}_Rubber_Sole`, { position: new V3(0, -0.39, -0.18) });
  addMesh(shoe, new RoundedBoxGeometry(1.03, 0.09, 1.83, 3, 0.04), materials.rubberShadow, `${name}_Sole_Band`, { position: new V3(0, -0.30, -0.18) });
  ellipsoid(shoe, `${name}_Toe_Cap`, materials.rubber, new V3(0, 0.03, -0.91), new V3(0.42, 0.27, 0.36), { widthSegments: 16, heightSegments: 10 });

  // Collar and eyelets make the footwear read as a high-top without relying on image textures.
  torus(shoe, `${name}_Collar`, materials.rubber, new V3(0, 0.35, 0.22), 0.29, 0.055, new V3(1, 0.68, 1), new THREE.Euler(0, 0, 0), { tubularSegments: 16 });
  for (let i = 0; i < 4; i++) {
    const z = -0.68 + i * 0.25;
    sphere(shoe, `${name}_Eyelet_L_${i + 1}`, materials.rubber, new V3(-0.25, 0.23, z), new V3(0.045, 0.045, 0.045), { widthSegments: 8, heightSegments: 6 });
    sphere(shoe, `${name}_Eyelet_R_${i + 1}`, materials.rubber, new V3(0.25, 0.23, z), new V3(0.045, 0.045, 0.045), { widthSegments: 8, heightSegments: 6 });
    capsuleBetween(shoe, `${name}_Lace_${i + 1}`, new V3(-0.22, 0.27, z), new V3(0.22, 0.27, z), 0.018, materials.rubber, { capSegments: 3, radialSegments: 6 });
  }
  circleDisc(shoe, `${name}_Side_Patch`, materials.rubber, new V3(0.505, 0.10, -0.38), 0.18, new THREE.Euler(0, 0, Math.PI / 2), { depth: 0.035, segments: 16 });
  addStar(shoe, `${name}_Side_Star`, materials.shoeBlack, new V3(0.53, 0.10, -0.38), new THREE.Euler(0, Math.PI / 2, 0));

  // A small tread block is a useful contact cue for physics/debug views.
  addMesh(shoe, new RoundedBoxGeometry(0.74, 0.04, 0.22, 2, 0.03), materials.shoeBlack, `${name}_Tread_Block_A`, { position: new V3(0, -0.51, -0.74) });
  addMesh(shoe, new RoundedBoxGeometry(0.74, 0.04, 0.22, 2, 0.03), materials.shoeBlack, `${name}_Tread_Block_B`, { position: new V3(0, -0.51, -0.18) });
  return shoe;
}

function addArm(root, side, materials) {
  const sign = side === 'L' ? -1 : 1;
  const shoulder = new THREE.Group();
  shoulder.name = `Arm_${side}_Rig`;
  shoulder.position.set(sign * 0.70, 3.54, 0.02);
  root.add(shoulder);

  const elbow = new V3(sign * 0.72, side === 'L' ? -0.08 : 0.08, 0.0);
  capsuleBetween(shoulder, `Arm_${side}_Upper_Black`, new V3(0, 0, 0), elbow, 0.22, materials.void, { capSegments: 4, radialSegments: 10 });
  capsuleBetween(shoulder, `Arm_${side}_Upper_Bone`, new V3(0, 0, -0.02), elbow.clone().multiplyScalar(0.93), 0.105, materials.bone, { capSegments: 4, radialSegments: 8 });
  sphere(shoulder, `Arm_${side}_Shoulder_Bone`, materials.bone, new V3(0, 0, -0.02), new V3(0.18, 0.14, 0.14), { widthSegments: 12, heightSegments: 8 });
  sphere(shoulder, `Arm_${side}_Elbow_Bone`, materials.bone, elbow, new V3(0.17, 0.15, 0.15), { widthSegments: 12, heightSegments: 8 });

  const forearm = new THREE.Group();
  forearm.name = `Forearm_${side}_Rig`;
  forearm.position.copy(elbow);
  shoulder.add(forearm);
  const wrist = new V3(sign * 0.64, side === 'L' ? -0.62 : -0.05, -0.03);
  capsuleBetween(forearm, `Arm_${side}_Forearm_Black`, new V3(0, 0, 0), wrist, 0.20, materials.void, { capSegments: 4, radialSegments: 10 });
  capsuleBetween(forearm, `Arm_${side}_Forearm_Bone`, new V3(0, 0, -0.02), wrist.clone().multiplyScalar(0.9), 0.095, materials.bone, { capSegments: 4, radialSegments: 8 });
  sphere(forearm, `Arm_${side}_Wrist_Bone`, materials.bone, wrist, new V3(0.16, 0.14, 0.14), { widthSegments: 12, heightSegments: 8 });

  const wristRig = new THREE.Group();
  wristRig.name = `Wrist_${side}_Rig`;
  wristRig.position.copy(wrist);
  forearm.add(wristRig);
  const claw = addClaw(wristRig, `Claw_${side}_Rig`, materials, {
    scale: side === 'L' ? 0.92 : 1.08,
    rotationZ: side === 'L' ? -0.55 : 0.10,
  });
  claw.userData.socketType = 'hand-claw';
  return { shoulder, forearm, wristRig, claw };
}

function addLeg(root, side, materials) {
  const sign = side === 'L' ? -1 : 1;
  const hip = new THREE.Group();
  hip.name = `Leg_${side}_Rig`;
  hip.position.set(sign * 0.52, 2.08, 0.0);
  root.add(hip);

  const knee = new V3(sign * 0.48, side === 'L' ? -0.82 : -0.56, side === 'L' ? -0.03 : 0.06);
  capsuleBetween(hip, `Leg_${side}_Thigh_Black`, new V3(0, 0, 0), knee, 0.20, materials.void, { capSegments: 4, radialSegments: 10 });
  capsuleBetween(hip, `Leg_${side}_Thigh_Bone`, new V3(0, 0, -0.02), knee.clone().multiplyScalar(0.88), 0.105, materials.bone, { capSegments: 4, radialSegments: 8 });
  sphere(hip, `Leg_${side}_Hip_Bone`, materials.bone, new V3(0, 0, -0.01), new V3(0.18, 0.16, 0.15), { widthSegments: 12, heightSegments: 8 });
  sphere(hip, `Leg_${side}_Knee_Bone`, materials.bone, knee, new V3(0.17, 0.16, 0.15), { widthSegments: 12, heightSegments: 8 });

  const shin = new THREE.Group();
  shin.name = `Shin_${side}_Rig`;
  shin.position.copy(knee);
  hip.add(shin);
  const ankle = new V3(sign * 0.40, side === 'L' ? -0.57 : -0.61, side === 'L' ? -0.20 : -0.15);
  capsuleBetween(shin, `Leg_${side}_Shin_Black`, new V3(0, 0, 0), ankle, 0.17, materials.void, { capSegments: 4, radialSegments: 10 });
  capsuleBetween(shin, `Leg_${side}_Shin_Bone`, new V3(0, 0, -0.02), ankle.clone().multiplyScalar(0.9), 0.09, materials.bone, { capSegments: 4, radialSegments: 8 });
  sphere(shin, `Leg_${side}_Ankle_Bone`, materials.bone, ankle, new V3(0.15, 0.14, 0.14), { widthSegments: 12, heightSegments: 8 });

  const shoe = addSneaker(shin, `Sneaker_${side}`, ankle.clone().add(new V3(0, -0.08, -0.13)), side === 'L' ? new V3(-0.12, 0.02, -1) : new V3(0.18, 0.10, -1), materials);
  shoe.userData.socketType = 'foot';
  return { hip, shin, shoe };
}

function addHead(root, materials) {
  const head = new THREE.Group();
  head.name = 'Head_Rig';
  head.position.set(0, 4.62, 0.0);
  root.add(head);

  ellipsoid(head, 'Skull_Main', materials.bone, new V3(0, 0, 0), new V3(1.14, 1.14, 1.05), { widthSegments: 24, heightSegments: 16 });
  ellipsoid(head, 'Skull_Muzzle', materials.boneShadow, new V3(0, -0.28, -0.92), new V3(0.86, 0.46, 0.34), { widthSegments: 20, heightSegments: 12 });
  ellipsoid(head, 'Mouth_Smile_Interior', materials.mouth, new V3(-0.10, -0.27, -1.22), new V3(0.43, 0.10, 0.045), { widthSegments: 16, heightSegments: 8 });

  const eyeY = 0.30;
  [-1, 1].forEach((sign, index) => {
    const x = sign * 0.43;
    ellipsoid(head, `Eye_${index === 0 ? 'L' : 'R'}_White`, materials.eyeWhite, new V3(x, eyeY, -0.95), new V3(0.31, 0.47, 0.12), { widthSegments: 18, heightSegments: 12 });
    torus(head, `Eye_${index === 0 ? 'L' : 'R'}_Black_Outline`, materials.eyeBlack, new V3(x, eyeY, -1.055), 0.30, 0.045, new V3(1, 1.45, 1), new THREE.Euler(0, 0, 0), { tubularSegments: 18 });
    ellipsoid(head, `Eye_${index === 0 ? 'L' : 'R'}_Pupil`, materials.eyeBlack, new V3(x + sign * 0.01, eyeY - 0.01, -1.085), new V3(0.16, 0.30, 0.075), { widthSegments: 16, heightSegments: 10 });
    sphere(head, `Eye_${index === 0 ? 'L' : 'R'}_Highlight`, materials.eyeHighlight, new V3(x - 0.055, eyeY + 0.11, -1.16), new V3(0.065, 0.09, 0.025), { widthSegments: 12, heightSegments: 8 });
    for (let lash = 0; lash < 5; lash++) {
      const t = lash / 4;
      const lashX = x + sign * ((t - 0.5) * 0.40);
      const lashY = eyeY + 0.41 + Math.sin(t * Math.PI) * 0.055;
      capsuleBetween(head, `Eye_${index === 0 ? 'L' : 'R'}_Lash_${lash + 1}`, new V3(lashX, lashY, -1.09), new V3(lashX + sign * 0.018, lashY + 0.10, -1.09), 0.025, materials.eyeBlack, { capSegments: 2, radialSegments: 6 });
    }
  });

  // Rounded ears with a dark inner ring; their names are useful attachment points for alternate headgear.
  [-1, 1].forEach((sign, index) => {
    const label = index === 0 ? 'L' : 'R';
    torus(head, `Ear_${label}_Outer`, materials.bone, new V3(sign * 0.82, 0.92, 0.02), 0.30, 0.13, new V3(0.82, 1.15, 1), new THREE.Euler(0.04, 0.08 * sign, 0.02 * sign), { tubularSegments: 18 });
    torus(head, `Ear_${label}_Inner`, materials.boneShadow, new V3(sign * 0.82, 0.92, -0.01), 0.22, 0.055, new V3(0.82, 1.05, 1), new THREE.Euler(0.04, 0.08 * sign, 0.02 * sign), { tubularSegments: 16 });
  });
  [-0.18, 0, 0.18].forEach((x, index) => {
    ellipsoid(head, `Skull_Tuft_${index + 1}`, materials.bone, new V3(x, 1.09 + Math.abs(x) * 0.18, 0.02), new V3(0.14, 0.26, 0.14), { widthSegments: 14, heightSegments: 10 });
  });

  // Freckles and nostril marks are deliberately individual nodes so a game can recolor or remove them.
  const freckles = [
    [-0.48, -0.22, -1.25], [-0.30, -0.14, -1.28], [-0.11, -0.18, -1.30], [0.10, -0.17, -1.30], [0.30, -0.20, -1.27], [0.46, -0.15, -1.22],
    [-0.38, -0.36, -1.28], [-0.20, -0.39, -1.30], [0.00, -0.40, -1.31], [0.20, -0.37, -1.29], [0.39, -0.32, -1.26],
  ];
  freckles.forEach(([x, y, z], index) => sphere(head, `Muzzle_Freckle_${index + 1}`, materials.eyeBlack, new V3(x, y, z), new V3(0.026, 0.026, 0.018), { widthSegments: 8, heightSegments: 6 }));
  [-0.20, 0.20].forEach((x, index) => sphere(head, `Muzzle_Nostril_${index + 1}`, materials.eyeBlack, new V3(x, -0.16, -1.275), new V3(0.035, 0.028, 0.018), { widthSegments: 8, heightSegments: 6 }));

  curveTube(head, 'Skull_Crack_Left', [
    new V3(-0.72, -0.10, -0.86), new V3(-0.78, 0.02, -0.89), new V3(-0.72, 0.13, -0.91), new V3(-0.81, 0.25, -0.86), new V3(-0.77, 0.38, -0.80),
  ], 0.025, materials.crack, { tubularSegments: 18, radialSegments: 5 });

  // Cigarette and ember sit at the mouth as a named prop socket.
  const cigarSocket = new THREE.Group();
  cigarSocket.name = 'Socket_Cigar_Mouth';
  cigarSocket.position.set(-0.37, -0.30, -1.20);
  head.add(cigarSocket);
  cylinderBetween(cigarSocket, 'Cigar_Rolled_Body', new V3(0, 0, 0), new V3(-0.38, -0.10, -0.14), 0.065, materials.cigar, { radialSegments: 12, bottomRadius: 0.072 });
  sphere(cigarSocket, 'Cigar_Ember', materials.ember, new V3(-0.40, -0.105, -0.15), new V3(0.075, 0.075, 0.075), { widthSegments: 12, heightSegments: 8 });
  cylinderBetween(cigarSocket, 'Cigar_Ash_Tip', new V3(0.015, 0.004, 0.004), new V3(0.08, 0.02, 0.03), 0.071, materials.boneShadow, { radialSegments: 10 });

  curveTube(cigarSocket, 'Smoke_Wisp_A', [new V3(-0.43, -0.09, -0.15), new V3(-0.52, 0.10, -0.15), new V3(-0.43, 0.28, -0.15), new V3(-0.54, 0.44, -0.15)], 0.022, materials.smoke, { tubularSegments: 16, radialSegments: 5 });
  curveTube(cigarSocket, 'Smoke_Wisp_B', [new V3(-0.50, 0.07, -0.15), new V3(-0.70, 0.22, -0.15), new V3(-0.66, 0.42, -0.15)], 0.018, materials.smoke, { tubularSegments: 14, radialSegments: 5 });
  return head;
}

function addTorso(root, materials) {
  const torso = new THREE.Group();
  torso.name = 'Torso_Rig';
  root.add(torso);
  ellipsoid(torso, 'Torso_Black_Core', materials.void, new V3(0, 3.02, 0), new V3(0.78, 1.06, 0.60), { widthSegments: 20, heightSegments: 14 });
  capsuleBetween(torso, 'Spine_Visible_Sternum', new V3(0, 2.63, -0.57), new V3(0, 3.52, -0.58), 0.105, materials.bone, { capSegments: 4, radialSegments: 8 });
  [2.72, 2.96, 3.20, 3.44].forEach((y, index) => {
    curveTube(torso, `Rib_${index + 1}`, [new V3(-0.52, y, -0.47), new V3(0, y + 0.10, -0.64), new V3(0.52, y, -0.47)], 0.105, materials.bone, { tubularSegments: 14, radialSegments: 7 });
  });

  // Short pants and the two button-like fasteners.
  ellipsoid(torso, 'Shorts_Main', materials.shorts, new V3(0, 1.98, 0), new V3(0.99, 0.78, 0.77), { widthSegments: 20, heightSegments: 14 });
  ellipsoid(torso, 'Shorts_Waistband', materials.shortsDark, new V3(0, 2.41, -0.01), new V3(0.86, 0.18, 0.68), { widthSegments: 18, heightSegments: 10 });
  ellipsoid(torso, 'Shorts_Leg_Cuff', materials.shortsDark, new V3(-0.53, 1.70, -0.01), new V3(0.44, 0.26, 0.50), { widthSegments: 16, heightSegments: 10 });
  ellipsoid(torso, 'Shorts_Right_Cuff', materials.shortsDark, new V3(0.53, 1.70, -0.01), new V3(0.44, 0.26, 0.50), { widthSegments: 16, heightSegments: 10 });
  [new V3(-0.70, 2.02, -0.74), new V3(0.70, 2.20, -0.72)].forEach((position, index) => {
    circleDisc(torso, `Shorts_Button_${index + 1}`, materials.boneShadow, position, 0.14, new THREE.Euler(Math.PI / 2, 0, 0), { depth: 0.06, segments: 16 });
    capsuleBetween(torso, `Shorts_Button_Slot_${index + 1}`, position.clone().add(new V3(-0.06, 0, -0.01)), position.clone().add(new V3(0.06, 0, -0.01)), 0.018, materials.void, { capSegments: 2, radialSegments: 6 });
  });
  return torso;
}

function addChain(root, materials) {
  const chain = new THREE.Group();
  chain.name = 'Gold_Chain_Rig';
  root.add(chain);
  const count = 10;
  for (let i = 0; i < count; i++) {
    const angle = Math.PI * 0.15 + (i / (count - 1)) * Math.PI * 0.70;
    const x = Math.cos(angle) * 0.66;
    const z = -0.40 - Math.sin(angle) * 0.22;
    const link = torus(chain, `Chain_Link_${i + 1}`, materials.gold, new V3(x, 4.00 - Math.sin(angle) * 0.12, z), 0.17, 0.045, new V3(1, 1, 1), new THREE.Euler(Math.PI / 2, i % 2 ? 0.42 : -0.42, 0), { tubularSegments: 14, radialSegments: 7 });
    link.rotation.z += (i % 2 ? 0.2 : -0.2);
  }
  addCrown(root, materials);
  return chain;
}

export function createCharacter() {
  const materials = createMaterials();
  const root = new THREE.Group();
  root.name = 'SkeletonLobster_Root';
  root.userData.assetInfo = CHARACTER_INFO;
  root.userData.authoring = 'Procedural Three.js geometry; original character interpretation from supplied reference image.';
  root.userData.facing = '-Z';

  addTorso(root, materials);
  addHead(root, materials);
  addChain(root, materials);
  const armL = addArm(root, 'L', materials);
  const armR = addArm(root, 'R', materials);
  const legL = addLeg(root, 'L', materials);
  const legR = addLeg(root, 'R', materials);

  const sockets = {};
  const socket = (name, position, parent = root) => {
    const node = new THREE.Group();
    node.name = name;
    node.position.copy(position);
    node.userData.socket = true;
    parent.add(node);
    sockets[name] = node;
    return node;
  };
  socket('Socket_Headgear', new V3(0, 5.65, 0), root);
  socket('Socket_Backpack', new V3(0, 3.10, 0.55), root);
  socket('Socket_Weapon_L', new V3(-2.16, 2.80, 0), armL.wristRig);
  socket('Socket_Weapon_R', new V3(2.18, 3.65, 0), armR.wristRig);
  socket('Socket_FX_Center', new V3(0, 3.00, -0.85), root);

  root.traverse((object) => {
    if (object.isMesh) {
      object.userData.exportedAsset = true;
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return {
    root,
    materials,
    sockets,
    rig: { armL, armR, legL, legR },
  };
}

export function createAnimations(character) {
  const rootName = character.root.name;
  const { armL, armR, legL, legR } = character.rig;
  const quaternionTrack = (nodeName, times, zAngles) => {
    const values = [];
    zAngles.forEach((angle) => values.push(...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, angle)).toArray()));
    return new THREE.QuaternionKeyframeTrack(`${nodeName}.quaternion`, times, values);
  };
  const idle = new THREE.AnimationClip('Idle_Bob', 2.0, [
    new THREE.VectorKeyframeTrack(`${rootName}.position`, [0, 0.5, 1.0, 1.5, 2.0], [0, 0, 0, 0, 0.035, 0, 0, 0, 0, 0.035, 0, 0, 0, 0, 0]),
    quaternionTrack('Head_Rig', [0, 1, 2], [0, 0.025, 0]),
    quaternionTrack('Gold_Chain_Rig', [0, 1, 2], [0.015, -0.015, 0.015]),
  ]);

  const walk = new THREE.AnimationClip('Walk_Cycle', 1.0, [
    new THREE.VectorKeyframeTrack(`${rootName}.position`, [0, 0.25, 0.5, 0.75, 1], [0, 0, 0, 0, 0.04, 0, 0, 0, 0, 0.04, 0, 0, 0, 0, 0]),
    quaternionTrack(armL.shoulder.name, [0, 0.25, 0.5, 0.75, 1], [0.13, 0, -0.13, 0, 0.13]),
    quaternionTrack(armR.shoulder.name, [0, 0.25, 0.5, 0.75, 1], [-0.13, 0, 0.13, 0, -0.13]),
    quaternionTrack(legL.hip.name, [0, 0.25, 0.5, 0.75, 1], [-0.16, 0, 0.16, 0, -0.16]),
    quaternionTrack(legR.hip.name, [0, 0.25, 0.5, 0.75, 1], [0.16, 0, -0.16, 0, 0.16]),
  ]);

  const clawSnap = new THREE.AnimationClip('Claw_Snap_R', 0.8, [
    quaternionTrack('Claw_R_Rig', [0, 0.18, 0.36, 0.8], [0.10, -0.18, 0.18, 0.10]),
    new THREE.VectorKeyframeTrack('Claw_R_Rig.scale', [0, 0.18, 0.36, 0.8], [1.08, 1.08, 1.08, 1.02, 1.02, 1.02, 1.05, 1.05, 1.05, 1.08, 1.08, 1.08]),
  ]);

  return [idle, walk, clawSnap];
}
