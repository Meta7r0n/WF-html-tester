# Boombox Cat — Three.js Character Asset

This package contains a procedural **Boombox Cat** character built from the supplied reference image.

## Included

- `boombox_cat.glb` — binary glTF 2.0 character and boombox prop.
- `viewer/index.html` — offline orbit viewer with animation controls.
- `source/boombox_cat_character.mjs` — editable procedural Three.js source.
- `metadata.json` — geometry, material, socket, and animation metadata.
- `viewer/vendor/` — local Three.js, GLTFLoader, and OrbitControls modules.

## Three.js loading

```js
const loader = new GLTFLoader();
loader.load('./boombox_cat.glb', (gltf) => {
  scene.add(gltf.scene);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(gltf.animations.find((clip) => clip.name === 'Idle_Bob')).play();
});
```

The model is Y-up, faces negative Z, and keeps the character and boombox as named, editable nodes. Materials are separated for recoloring and gameplay variants. The boombox includes a named speaker socket, handle socket, front FX socket, and prop rig.

## Animations

- `Idle_Bob`
- `Walk_Cycle`
- `Boombox_Bounce`

This is a stylized, original game-asset interpretation of the supplied reference, designed for browser-game reuse rather than a one-off render.
