# Skeleton Lobster — Three.js Character Asset

This package contains the procedural **Skeleton Lobster** character built from the supplied reference image.

## Included

- `skeleton_lobster.glb` — binary glTF 2.0 asset for Three.js, Godot, Unity, Blender, and other glTF-capable tools.
- `viewer/index.html` — local orbit viewer with animation controls.
- `source/skeleton_lobster_character.mjs` — editable procedural Three.js source.
- `metadata.json` — mesh/material/socket/animation information.
- `viewer/vendor/` — local Three.js, GLTFLoader, and OrbitControls modules so the viewer does not depend on a CDN.

## Three.js loading

`GLTFLoader` can load the model directly:

```js
const loader = new GLTFLoader();
loader.load('./skeleton_lobster.glb', (gltf) => {
  scene.add(gltf.scene);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const idle = gltf.animations.find((clip) => clip.name === 'Idle_Bob');
  mixer.clipAction(idle).play();
});
```

The model uses Y-up coordinates and faces toward negative Z. It contains named transform groups for the head, limbs, claws, shoes, chain, and attachment sockets. Materials are kept separate and use PBR color/roughness/metalness values so recoloring or replacing them in a game is straightforward.

## Animations

- `Idle_Bob`
- `Walk_Cycle`
- `Claw_Snap_R`

This is an intentionally stylized, original game-asset interpretation rather than a scan. The supplied image remains the visual reference for silhouette, costume, and expression.
