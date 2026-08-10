import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);

export const CHARACTER_INFO = {
  name: 'Boombox Cat',
  version: '0.1.0',
  description: 'A sleepy, sharp-toothed cartoon cat DJ with a spotted bandana, olive shorts, blue sneakers, and a yellow boombox.',
  coordinateSystem: 'Y-up; character faces -Z',
  units: 'meters',
  scale: 'approximately 6.5 meters tall in the exported scene',
};

export const PALETTE = {
  fur: 0x17171b,
  furHighlight: 0x2b2b31,
  face: 0xf1e7d6,
  eyelid: 0xc7b69f,
  eyeOutline: 0x17151a,
  eyeSalmon: 0xe87c70,
  mouth: 0x17131a,
  tooth: 0xf0c329,
  tongue: 0xe67b78,
  bandana: 0xe4d9c8,
  bandanaSpot: 0x26242a,
  olive: 0x666b58,
  oliveDark: 0x3d4338,
  glove: 0xf4eee5,
  gloveShadow: 0xd6cabb,
  sneakerWhite: 0xf1eee4,
  sneakerBlue: 0x5785ae,
  sneakerBlueDark: 0x2e557a,
  sneakerSole: 0xd3d4ce,
  lace: 0x23252b,
  laceTag: 0xd56d3e,
  radioYellow: 0xf0b90f,
  radioYellowBright: 0xffd42a,
  radioYellowDark: 0xb67b08,
  radioBlack: 0x17181d,
  radioGray: 0x3c3c42,
  speakerGold: 0xc99628,
  metal: 0x767680,
};

function makeMaterial(name, color, options = {}) {
  const material = new THREE.MeshStandardMaterial({
    name,
    color,
    roughness: options.roughness ?? 0.68,
    metalness: options.metalness ?? 0,
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
    fur: makeMaterial('Cat_Fur_Black', PALETTE.fur, { roughness: 0.54, role: 'fur' }),
    furHighlight: makeMaterial('Cat_Fur_Highlight', PALETTE.furHighlight, { roughness: 0.62, role: 'fur-accent' }),
    face: makeMaterial('Face_Warm_Cream', PALETTE.face, { roughness: 0.56, role: 'face' }),
    eyelid: makeMaterial('Sleepy_Eyelid_Taupe', PALETTE.eyelid, { roughness: 0.64, role: 'eyelid' }),
    eyeOutline: makeMaterial('Eye_Outline_Black', PALETTE.eyeOutline, { roughness: 0.36, role: 'eye-outline' }),
    eyeSalmon: makeMaterial('Eye_Salmon_Lower', PALETTE.eyeSalmon, { roughness: 0.42, role: 'eye-color' }),
    mouth: makeMaterial('Mouth_Interior', PALETTE.mouth, { roughness: 0.78, role: 'mouth' }),
    tooth: makeMaterial('Tooth_Mustard', PALETTE.tooth, { roughness: 0.5, role: 'teeth' }),
    tongue: makeMaterial('Tongue_Salmon', PALETTE.tongue, { roughness: 0.46, role: 'tongue' }),
    bandana: makeMaterial('Bandana_Cream', PALETTE.bandana, { roughness: 0.86, side: THREE.DoubleSide, role: 'cloth' }),
    bandanaSpot: makeMaterial('Bandana_Spots', PALETTE.bandanaSpot, { roughness: 0.78, role: 'cloth-pattern' }),
    olive: makeMaterial('Shorts_Olive', PALETTE.olive, { roughness: 0.92, role: 'cloth' }),
    oliveDark: makeMaterial('Shorts_Olive_Shadow', PALETTE.oliveDark, { roughness: 0.96, role: 'cloth-accent' }),
    glove: makeMaterial('Glove_White', PALETTE.glove, { roughness: 0.66, role: 'glove' }),
    gloveShadow: makeMaterial('Glove_Shadow', PALETTE.gloveShadow, { roughness: 0.72, role: 'glove-accent' }),
    sneakerWhite: makeMaterial('Sneaker_White', PALETTE.sneakerWhite, { roughness: 0.76, role: 'shoe' }),
    sneakerBlue: makeMaterial('Sneaker_Blue', PALETTE.sneakerBlue, { roughness: 0.62, role: 'shoe-accent' }),
    sneakerBlueDark: makeMaterial('Sneaker_Blue_Dark', PALETTE.sneakerBlueDark, { roughness: 0.7, role: 'shoe-detail' }),
    sneakerSole: makeMaterial('Sneaker_Aged_Sole', PALETTE.sneakerSole, { roughness: 0.86, role: 'shoe-rubber' }),
    lace: makeMaterial('Sneaker_Laces', PALETTE.lace, { roughness: 0.76, role: 'shoe-laces' }),
    laceTag: makeMaterial('Sneaker_Lace_Tag', PALETTE.laceTag, { roughness: 0.55, role: 'shoe-detail' }),
    radioYellow: makeMaterial('Boombox_Yellow', PALETTE.radioYellow, { roughness: 0.42, role: 'prop-shell' }),
    radioYellowBright: makeMaterial('Boombox_Button_Yellow', PALETTE.radioYellowBright, { roughness: 0.33, role: 'prop-controls' }),
    radioYellowDark: makeMaterial('Boombox_Shadow_Yellow', PALETTE.radioYellowDark, { roughness: 0.5, role: 'prop-accent' }),
    radioBlack: makeMaterial('Boombox_Black', PALETTE.radioBlack, { roughness: 0.48, role: 'prop-panel' }),
    radioGray: makeMaterial('Boombox_Gray', PALETTE.radioGray, { roughness: 0.64, role: 'prop-detail' }),
    speakerGold: makeMaterial('Boombox_Speaker_Gold', PALETTE.speakerGold, { roughness: 0.5, role: 'prop-speaker' }),
    metal: makeMaterial('Boombox_Handle_Metal', PALETTE.metal, { roughness: 0.42, metalness: 0.65, role: 'prop-metal' }),
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
    ...options, position, scale,
  });
}

function ellipsoid(parent, name, material, position, scale, options = {}) {
  return sphere(parent, name, material, position, scale, options);
}

function capsuleBetween(parent, name, a, b, radius, material, options = {}) {
  const direction = b.clone().sub(a);
  const length = Math.max(0.025, direction.length() - radius * 2);
  const geometry = new THREE.CapsuleGeometry(radius, length, options.capSegments ?? 4, options.radialSegments ?? 10);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, direction.normalize());
  return addMesh(parent, geometry, material, name, {
    ...options,
    position: a.clone().add(b).multiplyScalar(0.5),
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
  return addMesh(parent, new THREE.TubeGeometry(curve, options.tubularSegments ?? 18, radius, options.radialSegments ?? 7, false), material, name, options);
}

function torus(parent, name, material, position, majorRadius, tubeRadius, scale = new V3(1, 1, 1), rotation = new THREE.Euler(), options = {}) {
  return addMesh(parent, new THREE.TorusGeometry(majorRadius, tubeRadius, options.radialSegments ?? 8, options.tubularSegments ?? 16), material, name, {
    ...options, position, scale, rotation,
  });
}

function circleDisc(parent, name, material, position, radius, rotation = new THREE.Euler(), options = {}) {
  return addMesh(parent, new THREE.CylinderGeometry(radius, radius, options.depth ?? 0.04, options.segments ?? 18), material, name, {
    ...options, position, rotation,
  });
}

function shapeExtrusion(points, depth = 0.06) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 3, steps: 1 });
}

function cone(parent, name, material, position, radius, height, rotation = new THREE.Euler(), options = {}) {
  return addMesh(parent, new THREE.ConeGeometry(radius, height, options.radialSegments ?? 14), material, name, { ...options, position, rotation });
}

function addFace(head, materials) {
  ellipsoid(head, 'Face_Cream_Patch', materials.face, new V3(0, -0.04, -0.93), new V3(0.94, 0.91, 0.20), { widthSegments: 24, heightSegments: 16 });

  [-1, 1].forEach((sign, index) => {
    const label = sign < 0 ? 'L' : 'R';
    const x = sign * 0.41;
    ellipsoid(head, `Eye_${label}_Base`, materials.eyelid, new V3(x, 0.29, -1.105), new V3(0.36, 0.30, 0.075), { widthSegments: 18, heightSegments: 12 });
    torus(head, `Eye_${label}_Outline`, materials.eyeOutline, new V3(x, 0.29, -1.17), 0.30, 0.04, new V3(1.17, 0.85, 1), new THREE.Euler(), { tubularSegments: 18 });
    ellipsoid(head, `Eye_${label}_Salmon_Lower`, materials.eyeSalmon, new V3(x, 0.16, -1.225), new V3(0.255, 0.16, 0.045), { widthSegments: 16, heightSegments: 10 });
    capsuleBetween(head, `Eye_${label}_Heavy_Lid`, new V3(x - 0.27, 0.32, -1.245), new V3(x + 0.27, 0.32, -1.245), 0.045, materials.eyeOutline, { capSegments: 3, radialSegments: 7 });
    capsuleBetween(head, `Eye_${label}_Lower_Line`, new V3(x - 0.20, 0.08, -1.24), new V3(x + 0.20, 0.08, -1.24), 0.018, materials.eyeOutline, { capSegments: 2, radialSegments: 6 });
    // A small sleepy crease at the outer corner.
    curveTube(head, `Eye_${label}_Corner_Crease`, [new V3(x + sign * 0.28, 0.11, -1.19), new V3(x + sign * 0.38, 0.02, -1.12)], 0.018, materials.eyeOutline, { tubularSegments: 10, radialSegments: 5 });
  });

  ellipsoid(head, 'Mouth_Open', materials.mouth, new V3(0, -0.37, -1.12), new V3(0.62, 0.38, 0.10), { widthSegments: 20, heightSegments: 12 });
  curveTube(head, 'Smile_Left', [new V3(-0.58, -0.28, -1.16), new V3(-0.50, -0.16, -1.18), new V3(-0.37, -0.11, -1.19)], 0.035, materials.eyeOutline, { tubularSegments: 12, radialSegments: 6 });
  curveTube(head, 'Smile_Right', [new V3(0.58, -0.28, -1.16), new V3(0.50, -0.16, -1.18), new V3(0.37, -0.11, -1.19)], 0.035, materials.eyeOutline, { tubularSegments: 12, radialSegments: 6 });
  ellipsoid(head, 'Tongue', materials.tongue, new V3(0, -0.54, -1.22), new V3(0.32, 0.15, 0.05), { widthSegments: 16, heightSegments: 10 });

  [-0.40, -0.14, 0.14, 0.40].forEach((x, index) => {
    cone(head, `Upper_Fang_${index + 1}`, materials.tooth, new V3(x, -0.26, -1.23), 0.085, 0.23, new THREE.Euler(Math.PI, 0, 0), { radialSegments: 4 });
  });
  [-0.23, 0.23].forEach((x, index) => {
    cone(head, `Lower_Fang_${index + 1}`, materials.tooth, new V3(x, -0.49, -1.23), 0.065, 0.17, new THREE.Euler(), { radialSegments: 4 });
  });
}

function addHead(root, materials) {
  const head = new THREE.Group();
  head.name = 'Head_Rig';
  head.position.set(0, 4.72, 0);
  root.add(head);

  ellipsoid(head, 'Cat_Head_Black_Shell', materials.fur, new V3(0, 0, 0), new V3(1.15, 1.14, 1.04), { widthSegments: 24, heightSegments: 16 });
  addFace(head, materials);

  [-1, 1].forEach((sign, index) => {
    const label = sign < 0 ? 'L' : 'R';
    const earRotation = new THREE.Euler(0, 0, sign * 0.22);
    cone(head, `Ear_${label}_Outer`, materials.fur, new V3(sign * 0.79, 0.93, 0.02), 0.48, 1.52, earRotation, { radialSegments: 18 });
    cone(head, `Ear_${label}_Inner`, materials.furHighlight, new V3(sign * 0.79, 0.92, -0.025), 0.28, 1.10, earRotation, { radialSegments: 14 });
  });
  [-0.18, 0, 0.18].forEach((x, index) => cone(head, `Head_Tuft_${index + 1}`, materials.fur, new V3(x, 1.10 + Math.abs(x) * 0.18, 0.02), 0.13, 0.40, new THREE.Euler(0, 0, x * 0.6), { radialSegments: 12 }));
  return head;
}

function addBandana(root, materials) {
  const bandana = new THREE.Group();
  bandana.name = 'Bandana_Rig';
  bandana.position.set(0, 4.05, -0.66);
  root.add(bandana);
  addMesh(bandana, shapeExtrusion([[-0.72, 0.32], [0.72, 0.32], [0, -0.68]], 0.10), materials.bandana, 'Bandana_Triangle', { position: new V3(0, 0, -0.08) });
  const spots = [
    [-0.50, 0.16, 0.07], [-0.22, 0.20, 0.055], [0.18, 0.16, 0.07], [0.49, 0.20, 0.05],
    [-0.34, -0.10, 0.055], [0.08, -0.06, 0.07], [0.36, -0.22, 0.05], [-0.08, -0.38, 0.06], [0.03, -0.58, 0.04],
  ];
  spots.forEach(([x, y, r], index) => ellipsoid(bandana, `Bandana_Spot_${index + 1}`, materials.bandanaSpot, new V3(x, y, -0.145), new V3(r * 1.25, r, 0.018), { widthSegments: 10, heightSegments: 7 }));
  capsuleBetween(bandana, 'Bandana_Left_Edge', new V3(-0.72, 0.32, -0.13), new V3(0, -0.68, -0.13), 0.018, materials.bandanaSpot, { capSegments: 2, radialSegments: 5 });
  capsuleBetween(bandana, 'Bandana_Right_Edge', new V3(0.72, 0.32, -0.13), new V3(0, -0.68, -0.13), 0.018, materials.bandanaSpot, { capSegments: 2, radialSegments: 5 });
  return bandana;
}

function addGlove(parent, name, position, materials, options = {}) {
  const glove = new THREE.Group();
  glove.name = name;
  glove.position.copy(position);
  glove.rotation.z = options.rotationZ ?? 0;
  parent.add(glove);
  ellipsoid(glove, `${name}_Palm`, materials.glove, new V3(0, 0, 0), new V3(0.36, 0.34, 0.32), { widthSegments: 16, heightSegments: 10 });
  const digits = options.grip ? [
    new V3(-0.25, 0.17, -0.02), new V3(-0.08, 0.25, -0.03), new V3(0.11, 0.24, -0.03), new V3(0.27, 0.13, -0.02),
  ] : [
    new V3(-0.25, 0.10, -0.02), new V3(-0.10, -0.18, -0.02), new V3(0.10, -0.22, -0.02), new V3(0.28, -0.05, -0.02),
  ];
  digits.forEach((digit, index) => ellipsoid(glove, `${name}_Finger_${index + 1}`, materials.glove, digit, new V3(0.15, 0.19, 0.17), { widthSegments: 14, heightSegments: 9 }));
  ellipsoid(glove, `${name}_Thumb`, materials.gloveShadow, new V3(options.grip ? -0.27 : 0.25, options.grip ? -0.03 : 0.17, -0.18), new V3(0.16, 0.22, 0.16), { widthSegments: 14, heightSegments: 9 });
  torus(glove, `${name}_Cuff`, materials.glove, new V3(0, 0.30, 0), 0.23, 0.075, new V3(1, 0.9, 1), new THREE.Euler(Math.PI / 2, 0, 0), { tubularSegments: 16 });
  return glove;
}

function addArm(root, side, materials) {
  const sign = side === 'L' ? -1 : 1;
  const shoulder = new THREE.Group();
  shoulder.name = `Arm_${side}_Rig`;
  shoulder.position.set(sign * 0.70, 3.48, 0.03);
  root.add(shoulder);
  const elbow = new V3(sign * 0.75, side === 'L' ? -0.12 : 0.12, 0);
  capsuleBetween(shoulder, `Arm_${side}_Upper`, new V3(), elbow, 0.23, materials.fur, { capSegments: 4, radialSegments: 10 });
  sphere(shoulder, `Arm_${side}_Shoulder`, materials.furHighlight, new V3(), new V3(0.26, 0.26, 0.23), { widthSegments: 14, heightSegments: 9 });
  const forearm = new THREE.Group();
  forearm.name = `Forearm_${side}_Rig`;
  forearm.position.copy(elbow);
  shoulder.add(forearm);
  const raised = side === 'L';
  const wrist = new V3(sign * 0.62, raised ? 0.28 : -0.52, raised ? -0.04 : -0.02);
  capsuleBetween(forearm, `Arm_${side}_Lower`, new V3(), wrist, 0.21, materials.fur, { capSegments: 4, radialSegments: 10 });
  const wristRig = new THREE.Group();
  wristRig.name = `Wrist_${side}_Rig`;
  wristRig.position.copy(wrist);
  forearm.add(wristRig);
  const glove = addGlove(wristRig, `Glove_${side}_Rig`, new V3(), materials, { grip: raised, rotationZ: raised ? 0.10 : -0.18 });
  glove.userData.socketType = 'hand';
  return { shoulder, forearm, wristRig, glove };
}

function addSneaker(parent, name, position, direction, materials) {
  const shoe = new THREE.Group();
  shoe.name = name;
  shoe.position.copy(position);
  shoe.quaternion.setFromUnitVectors(new V3(0, 0, -1), direction.clone().normalize());
  parent.add(shoe);
  addMesh(shoe, new RoundedBoxGeometry(1.00, 0.67, 1.62, 4, 0.15), materials.sneakerWhite, `${name}_Upper`, { position: new V3(0, 0.02, -0.17) });
  addMesh(shoe, new RoundedBoxGeometry(1.08, 0.20, 1.78, 4, 0.07), materials.sneakerSole, `${name}_Sole`, { position: new V3(0, -0.38, -0.18) });
  addMesh(shoe, new RoundedBoxGeometry(1.04, 0.09, 1.80, 3, 0.04), materials.sneakerBlueDark, `${name}_Sole_Blue_Band`, { position: new V3(0, -0.30, -0.18) });
  ellipsoid(shoe, `${name}_Blue_Toe_Trim`, materials.sneakerBlue, new V3(0, 0.06, -0.86), new V3(0.45, 0.25, 0.30), { widthSegments: 16, heightSegments: 10 });
  addMesh(shoe, new RoundedBoxGeometry(0.16, 0.42, 1.10, 3, 0.05), materials.sneakerBlue, `${name}_Side_Panel`, { position: new V3(0.49, 0.08, -0.18) });
  torus(shoe, `${name}_Collar`, materials.sneakerBlue, new V3(0, 0.34, 0.22), 0.28, 0.055, new V3(1, 0.7, 1), new THREE.Euler(), { tubularSegments: 16 });
  for (let i = 0; i < 4; i++) {
    const z = -0.67 + i * 0.24;
    capsuleBetween(shoe, `${name}_Lace_${i + 1}`, new V3(-0.22, 0.25, z), new V3(0.22, 0.25, z), 0.018, materials.lace, { capSegments: 2, radialSegments: 6 });
  }
  addMesh(shoe, new RoundedBoxGeometry(0.11, 0.25, 0.20, 2, 0.035), materials.laceTag, `${name}_Lace_Tag`, { position: new V3(-0.29, 0.04, -0.63) });
  addMesh(shoe, new RoundedBoxGeometry(0.72, 0.04, 0.21, 2, 0.03), materials.sneakerBlueDark, `${name}_Tread_A`, { position: new V3(0, -0.49, -0.72) });
  addMesh(shoe, new RoundedBoxGeometry(0.72, 0.04, 0.21, 2, 0.03), materials.sneakerBlueDark, `${name}_Tread_B`, { position: new V3(0, -0.49, -0.18) });
  return shoe;
}

function addLeg(root, side, materials) {
  const sign = side === 'L' ? -1 : 1;
  const hip = new THREE.Group();
  hip.name = `Leg_${side}_Rig`;
  hip.position.set(sign * 0.52, 2.10, 0);
  root.add(hip);
  const knee = new V3(sign * 0.48, side === 'L' ? -0.66 : -0.50, side === 'L' ? -0.02 : 0.04);
  capsuleBetween(hip, `Leg_${side}_Thigh`, new V3(), knee, 0.20, materials.fur, { capSegments: 4, radialSegments: 10 });
  const shin = new THREE.Group();
  shin.name = `Shin_${side}_Rig`;
  shin.position.copy(knee);
  hip.add(shin);
  const ankle = new V3(sign * (side === 'L' ? 0.34 : 0.62), side === 'L' ? -0.55 : -0.75, side === 'L' ? -0.18 : -0.12);
  capsuleBetween(shin, `Leg_${side}_Shin`, new V3(), ankle, 0.17, materials.fur, { capSegments: 4, radialSegments: 10 });
  const shoe = addSneaker(shin, `Sneaker_${side}`, ankle.clone().add(new V3(0, -0.08, -0.14)), side === 'L' ? new V3(-0.22, 0.02, -1) : new V3(0.38, 0.16, -1), materials);
  shoe.userData.socketType = 'foot';
  return { hip, shin, shoe };
}

function addBoombox(root, materials) {
  const radio = new THREE.Group();
  radio.name = 'Boombox_Prop_Rig';
  radio.position.set(-1.56, 4.50, 0.20);
  radio.rotation.y = 0.035;
  radio.scale.x = -1;
  radio.userData.propType = 'boombox';
  root.add(radio);

  // Handle sits behind the shell so the silhouette reads cleanly from the front.
  capsuleBetween(radio, 'Radio_Handle_Left', new V3(-0.68, 0.45, 0.24), new V3(-0.68, 1.08, 0.24), 0.075, materials.radioGray, { capSegments: 4, radialSegments: 8 });
  capsuleBetween(radio, 'Radio_Handle_Top', new V3(-0.68, 1.08, 0.24), new V3(0.68, 1.08, 0.24), 0.075, materials.radioGray, { capSegments: 4, radialSegments: 8 });
  capsuleBetween(radio, 'Radio_Handle_Right', new V3(0.68, 1.08, 0.24), new V3(0.68, 0.45, 0.24), 0.075, materials.radioGray, { capSegments: 4, radialSegments: 8 });

  addMesh(radio, new RoundedBoxGeometry(1.72, 1.12, 0.50, 5, 0.10), materials.radioYellow, 'Radio_Main_Shell', { position: new V3(0, 0, 0) });
  addMesh(radio, new RoundedBoxGeometry(1.58, 0.84, 0.055, 4, 0.045), materials.radioBlack, 'Radio_Front_Panel', { position: new V3(0, -0.05, -0.285) });
  addMesh(radio, new RoundedBoxGeometry(1.47, 0.10, 0.05, 3, 0.025), materials.radioYellowDark, 'Radio_Front_Top_Rail', { position: new V3(0, 0.40, -0.32) });
  addMesh(radio, new RoundedBoxGeometry(0.53, 0.27, 0.05, 3, 0.025), materials.radioGray, 'Radio_Cassette_Deck', { position: new V3(-0.43, -0.26, -0.32) });
  addMesh(radio, new RoundedBoxGeometry(0.42, 0.13, 0.025, 2, 0.015), materials.radioBlack, 'Radio_Cassette_Window', { position: new V3(-0.43, -0.26, -0.35) });
  addMesh(radio, new RoundedBoxGeometry(0.48, 0.05, 0.035, 2, 0.01), materials.radioYellowBright, 'Radio_Cassette_Button_Rail', { position: new V3(-0.43, -0.08, -0.34) });
  addMesh(radio, new RoundedBoxGeometry(0.42, 0.05, 0.035, 2, 0.01), materials.radioYellowBright, 'Radio_Cassette_Button_Rail_2', { position: new V3(-0.43, -0.43, -0.34) });

  // Speaker assembly: dark outer ring, yellow cone, dark dust cap.
  torus(radio, 'Radio_Speaker_Outer_Ring', materials.radioBlack, new V3(0.47, -0.03, -0.34), 0.29, 0.075, new V3(1, 1, 1), new THREE.Euler(), { tubularSegments: 20, radialSegments: 10 });
  circleDisc(radio, 'Radio_Speaker_Cone', materials.speakerGold, new V3(0.47, -0.03, -0.37), 0.235, new THREE.Euler(Math.PI / 2, 0, 0), { depth: 0.035, segments: 24 });
  torus(radio, 'Radio_Speaker_Inner_Ring', materials.radioYellowDark, new V3(0.47, -0.03, -0.40), 0.15, 0.025, new V3(1, 1, 1), new THREE.Euler(), { tubularSegments: 16, radialSegments: 7 });
  sphere(radio, 'Radio_Speaker_Dust_Cap', materials.radioBlack, new V3(0.47, -0.03, -0.43), new V3(0.095, 0.095, 0.045), { widthSegments: 14, heightSegments: 9 });

  for (let i = 0; i < 8; i++) addMesh(radio, new RoundedBoxGeometry(0.11, 0.07, 0.045, 2, 0.015), materials.radioYellowBright, `Radio_Top_Button_${i + 1}`, { position: new V3(-0.57 + i * 0.16, 0.50, -0.20) });
  [0.25, 0.49, 0.73].forEach((x, index) => sphere(radio, `Radio_Top_Knob_${index + 1}`, materials.radioBlack, new V3(x, 0.50, -0.20), new V3(0.07, 0.07, 0.07), { widthSegments: 12, heightSegments: 8 }));
  addMesh(radio, new RoundedBoxGeometry(0.32, 0.18, 0.045, 2, 0.015), materials.radioBlack, 'Radio_Top_Display', { position: new V3(0.45, 0.38, -0.33) });
  for (let i = 0; i < 5; i++) addMesh(radio, new RoundedBoxGeometry(0.07, 0.16, 0.04, 2, 0.01), materials.radioYellowBright, `Radio_Display_Bar_${i + 1}`, { position: new V3(0.28 + i * 0.09, 0.40, -0.36) });
  addMesh(radio, new RoundedBoxGeometry(0.14, 0.22, 0.06, 2, 0.02), materials.radioGray, 'Radio_Side_Grip', { position: new V3(0.88, 0.0, 0) });

  const sockets = {};
  const socket = (name, position) => {
    const node = new THREE.Group();
    node.name = name;
    node.position.copy(position);
    node.userData.socket = true;
    radio.add(node);
    sockets[name] = node;
    return node;
  };
  socket('Socket_Radio_Handle', new V3(0, 1.08, 0.24));
  socket('Socket_Radio_Speaker', new V3(0.47, -0.03, -0.45));
  socket('Socket_Radio_Front_FX', new V3(0, 0, -0.40));
  return { radio, sockets };
}

function addTorso(root, materials) {
  const torso = new THREE.Group();
  torso.name = 'Torso_Rig';
  root.add(torso);
  ellipsoid(torso, 'Cat_Torso_Black', materials.fur, new V3(0, 3.05, 0), new V3(0.80, 1.03, 0.60), { widthSegments: 20, heightSegments: 14 });
  ellipsoid(torso, 'Shorts_Main', materials.olive, new V3(0, 2.15, 0), new V3(0.98, 0.78, 0.76), { widthSegments: 20, heightSegments: 14 });
  ellipsoid(torso, 'Shorts_Waistband', materials.oliveDark, new V3(0, 2.50, -0.02), new V3(0.86, 0.16, 0.67), { widthSegments: 18, heightSegments: 10 });
  ellipsoid(torso, 'Shorts_Left_Cuff', materials.oliveDark, new V3(-0.54, 1.86, -0.01), new V3(0.43, 0.24, 0.50), { widthSegments: 16, heightSegments: 10 });
  ellipsoid(torso, 'Shorts_Right_Cuff', materials.oliveDark, new V3(0.54, 1.86, -0.01), new V3(0.43, 0.24, 0.50), { widthSegments: 16, heightSegments: 10 });
  circleDisc(torso, 'Shorts_Front_Button', materials.gloveShadow, new V3(0.66, 2.17, -0.73), 0.14, new THREE.Euler(Math.PI / 2, 0, 0), { depth: 0.06, segments: 18 });
  return torso;
}

export function createCharacter() {
  const materials = createMaterials();
  const root = new THREE.Group();
  root.name = 'BoomboxCat_Root';
  root.userData.assetInfo = CHARACTER_INFO;
  root.userData.authoring = 'Procedural Three.js geometry; original character interpretation from supplied reference image.';
  root.userData.facing = '-Z';

  addTorso(root, materials);
  const head = addHead(root, materials);
  addBandana(root, materials);
  const armL = addArm(root, 'L', materials);
  const armR = addArm(root, 'R', materials);
  const legL = addLeg(root, 'L', materials);
  const legR = addLeg(root, 'R', materials);
  const boombox = addBoombox(root, materials);

  const sockets = { ...boombox.sockets };
  const socket = (name, position, parent = root) => {
    const node = new THREE.Group();
    node.name = name;
    node.position.copy(position);
    node.userData.socket = true;
    parent.add(node);
    sockets[name] = node;
    return node;
  };
  socket('Socket_Headgear', new V3(0, 5.85, 0), head);
  socket('Socket_Hand_L_Grip', new V3(0, 0, -0.32), armL.wristRig);
  socket('Socket_Hand_R_Grip', new V3(0, 0, -0.32), armR.wristRig);
  socket('Socket_Backpack', new V3(0, 3.10, 0.58));
  socket('Socket_Center_FX', new V3(0, 3.30, -0.86));

  root.traverse((object) => {
    if (object.isMesh) {
      object.userData.exportedAsset = true;
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });

  return { root, materials, sockets, rig: { head, armL, armR, legL, legR, boombox: boombox.radio } };
}

export function createAnimations(character) {
  const rootName = character.root.name;
  const { head, armL, armR, legL, legR, boombox } = character.rig;
  const quaternionTrack = (nodeName, times, zAngles) => {
    const values = [];
    zAngles.forEach((angle) => values.push(...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, angle)).toArray()));
    return new THREE.QuaternionKeyframeTrack(`${nodeName}.quaternion`, times, values);
  };
  const vectorTrack = (nodeName, times, vectors) => new THREE.VectorKeyframeTrack(`${nodeName}.position`, times, vectors.flatMap((vector) => vector));
  const idle = new THREE.AnimationClip('Idle_Bob', 2.0, [
    vectorTrack(rootName, [0, 0.5, 1, 1.5, 2], [[0, 0, 0], [0, 0.04, 0], [0, 0, 0], [0, 0.04, 0], [0, 0, 0]]),
    quaternionTrack(head.name, [0, 1, 2], [0, 0.025, 0]),
    quaternionTrack(boombox.name, [0, 1, 2], [0.005, -0.005, 0.005]),
  ]);
  const walk = new THREE.AnimationClip('Walk_Cycle', 1.0, [
    vectorTrack(rootName, [0, 0.25, 0.5, 0.75, 1], [[0, 0, 0], [0, 0.045, 0], [0, 0, 0], [0, 0.045, 0], [0, 0, 0]]),
    quaternionTrack(armL.shoulder.name, [0, 0.25, 0.5, 0.75, 1], [0.14, 0, -0.14, 0, 0.14]),
    quaternionTrack(armR.shoulder.name, [0, 0.25, 0.5, 0.75, 1], [-0.10, 0, 0.10, 0, -0.10]),
    quaternionTrack(legL.hip.name, [0, 0.25, 0.5, 0.75, 1], [-0.17, 0, 0.17, 0, -0.17]),
    quaternionTrack(legR.hip.name, [0, 0.25, 0.5, 0.75, 1], [0.17, 0, -0.17, 0, 0.17]),
  ]);
  const radioBounce = new THREE.AnimationClip('Boombox_Bounce', 0.75, [
    vectorTrack(boombox.name, [0, 0.18, 0.36, 0.75], [[-1.56, 4.50, 0.20], [-1.56, 4.58, 0.20], [-1.56, 4.50, 0.20], [-1.56, 4.50, 0.20]]),
    quaternionTrack(boombox.name, [0, 0.18, 0.36, 0.75], [0, -0.025, 0.025, 0]),
  ]);
  return [idle, walk, radioBounce];
}
