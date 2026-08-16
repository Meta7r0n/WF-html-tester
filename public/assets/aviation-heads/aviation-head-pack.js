/*
 * Wilted Farms aviation_hat head pack.
 *
 * Data comes from manifest.js. Geometry is generated only for the selected
 * token and attaches to the game's existing shared rubber-hose body rig.
 * The pack has no hard dependency on Wilted Farms internals: buildHead()
 * receives the Three.js/primitive adapter it needs from CAST.
 */
(function (root) {
  'use strict';

  const items = Array.isArray(root.AVIATION_HEAD_MANIFEST)
    ? root.AVIATION_HEAD_MANIFEST.slice()
    : [];
  const byToken = new Map(items.map(item => [Number(item.tokenId), item]));
  const ordinalByToken = new Map(items.map((item, index) => [Number(item.tokenId), index + 1]));

  const COLOR = Object.freeze({
    cream: 0xF1E3C4,
    creamDim: 0xD8C7A6,
    ink: 0x191715,
    blue: 0x58A8C2,
    blueDark: 0x28647A,
    rust: 0xC4574B,
    rustDark: 0x743A32,
    mustard: 0xD8A629,
    olive: 0x73815A,
    green: 0x6F9A67,
    pink: 0xD77D88,
    white: 0xFFF9E9,
    metal: 0xA8B0AE
  });

  function tokenNumber(value) {
    if (value && typeof value === 'object') value = value.tokenId;
    const match = String(value == null ? '' : value).match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  function get(value) {
    const id = tokenNumber(value);
    return id == null ? null : (byToken.get(id) || null);
  }

  function hash(value) {
    let h = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function colorFor(value) {
    const colors = [COLOR.rust, COLOR.mustard, COLOR.olive, COLOR.blueDark, COLOR.pink, COLOR.green];
    return colors[hash(value) % colors.length];
  }

  function list() { return items.slice(); }

  function search(query) {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) return list();
    return items.filter(item => {
      if (String(item.tokenId).includes(needle) || item.name.toLowerCase().includes(needle)) return true;
      return Object.values(item.traits || {}).some(value => String(value).toLowerCase().includes(needle));
    });
  }

  function headSkin(value, baseSkin) {
    const item = get(value);
    const body = item && item.traits ? item.traits.body : 'regular';
    const skin = Object.assign({}, baseSkin || {});
    if (body === 'gold_skeleton') skin.face = COLOR.mustard;
    else if (body === 'scaley') skin.face = 0xB3C79A;
    else if (body === 'skeleton') skin.face = COLOR.creamDim;
    else skin.face = skin.face || COLOR.cream;
    return skin;
  }

  function batches(api, skin) {
    return {
      ink: new api.PRIM.Batch(api.MAT.toon(skin.ink || COLOR.ink), 0.012),
      light: new api.PRIM.Batch(api.MAT.toon(COLOR.white), 0.011),
      accent: new api.PRIM.Batch(api.MAT.toon(skin.accent || COLOR.rust), 0.011),
      warm: new api.PRIM.Batch(api.MAT.toon(COLOR.rust), 0.011),
      gold: new api.PRIM.Batch(api.MAT.toon(COLOR.mustard), 0.011),
      cool: new api.PRIM.Batch(api.MAT.toon(COLOR.blue), 0.011)
    };
  }

  function flush(group, groups) {
    Object.values(groups).forEach(batch => batch.build(group, { ray: false }));
  }

  function aviationHat(item, group, api) {
    const tilt = ((Number(item.tokenId) % 5) - 2) * 0.012;
    const hat = new api.THREE.Group();
    hat.rotation.z = tilt;
    group.add(hat);
    const blue = api.MAT.toon(COLOR.blue);
    const dark = api.MAT.toon(COLOR.blueDark);

    api.PRIM.sph(0.235, blue, {
      pos: [0, 0.235, 0.012], scale: [1.14, 0.59, 0.94],
      parent: hat, outline: 0.028, ray: false
    });
    api.PRIM.box(0.43, 0.052, 0.17, dark, {
      pos: [0, 0.16, -0.185], rot: [0.08, 0, 0],
      parent: hat, outline: 0.02, ray: false
    });
    [-1, 1].forEach(side => {
      api.PRIM.box(0.125, 0.30, 0.075, blue, {
        pos: [side * 0.245, 0.03, 0.065], rot: [0, 0, side * 0.08],
        parent: hat, outline: 0.022, ray: false
      });
      api.PRIM.sph(0.08, blue, {
        pos: [side * 0.275, -0.095, 0.05], scale: [0.68, 1.08, 0.74],
        parent: hat, outline: 0.019, ray: false
      });
      api.PRIM.box(0.105, 0.12, 0.09, blue, {
        pos: [side * 0.115, 0.405, 0.005], rot: [0.04, 0, side * 0.24],
        parent: hat, outline: 0.019, ray: false
      });
    });

    // Seven front-brim stitches encode the approved manifest ordinal. The
    // source trait tuple is already unique for every token, but several
    // editorial traits intentionally share a procedural treatment. This
    // small binary mark guarantees that all 123 generated heads remain
    // visually distinct even when those broader treatments overlap.
    const ordinal = ordinalByToken.get(Number(item.tokenId)) || 0;
    for (let bit = 0; bit < 7; bit += 1) {
      const active = (ordinal & (1 << bit)) !== 0;
      api.PRIM.sph(0.014, api.MAT.toon(active ? COLOR.white : COLOR.rustDark), {
        pos: [-0.15 + bit * 0.05, 0.175, -0.216], scale: [1, 0.72, 0.48],
        parent: hat, outline: 0.005, ray: false
      });
    }
    return hat;
  }

  function bodyTrait(item, group, skin, api) {
    const body = item.traits.body || 'regular';
    const ink = api.MAT.toon(skin.ink || COLOR.ink);
    const accent = api.MAT.toon(body === 'green_backpack' ? COLOR.green : COLOR.rust);

    if (body === 'fuzzy' || body === 'hairy') {
      const count = body === 'hairy' ? 7 : 4;
      for (let i = 0; i < count; i += 1) {
        const angle = Math.PI * (0.18 + (i / Math.max(1, count - 1)) * 0.64);
        const side = i % 2 ? 1 : -1;
        api.PRIM.cone(body === 'hairy' ? 0.07 : 0.055, body === 'hairy' ? 0.17 : 0.13, 5, ink, {
          pos: [Math.cos(angle) * 0.29 * side, Math.sin(angle) * 0.29 - 0.02, 0.02],
          rot: [0, 0, side * (angle - Math.PI / 2)], parent: group, outline: 0.016, ray: false
        });
      }
    }

    if (body === 'puffy') {
      [-1, 1].forEach(side => api.PRIM.sph(0.11, api.MAT.toon(skin.face || COLOR.cream), {
        pos: [side * 0.22, -0.055, -0.18], scale: [1, 0.8, 0.48],
        parent: group, outline: 0.019, ray: false
      }));
    }

    if (body === 'scaley') {
      [-1, 0, 1].forEach((step, index) => api.PRIM.sph(0.045, api.MAT.toon(index % 2 ? COLOR.olive : COLOR.green), {
        pos: [-0.245 + index * 0.04, 0.11 + step * 0.055, -0.18], scale: [1, 0.7, 0.4],
        parent: group, outline: 0.011, ray: false
      }));
    }

    if (body === 'studded') {
      [-1, -0.35, 0.35, 1].forEach(step => api.PRIM.cone(0.022, 0.055, 6, api.MAT.toon(COLOR.metal), {
        pos: [step * 0.22, 0.255 + (1 - Math.abs(step)) * 0.04, -0.245],
        rot: [-Math.PI / 2, 0, 0], parent: group, outline: 0.008, ray: false
      }));
    }

    if (body === 'green_backpack' || body === 'red_backpack') {
      api.PRIM.box(0.06, 0.2, 0.055, accent, {
        pos: [-0.255, 0.045, 0.02], rot: [0, 0, -0.1],
        parent: group, outline: 0.013, ray: false
      });
    }
  }

  function eyePair(item, group, skin, api) {
    const style = item.traits.eyes || 'black';
    const h = api.helpers;
    const b = batches(api, skin);
    const ink = b.ink;
    const light = b.light;
    const accent = b.accent;
    const warm = b.warm;
    const gold = b.gold;

    const ovalEye = (side, options) => {
      const o = options || {};
      const x = side * (o.x || 0.1);
      h.oval(o.white === false ? ink : light, x, o.y == null ? 0.06 : o.y,
        o.rx || 0.068, o.ry || 0.082, side * (o.rot || 0), o.depth || 0.058);
      if (o.pupil !== false) {
        const pupilBatch = o.pupilColor === 'warm' ? warm : (o.pupilColor === 'gold' ? gold : ink);
        h.oval(pupilBatch, x + side * (o.look || 0), (o.y == null ? 0.06 : o.y) - 0.006,
          o.prx || 0.028, o.pry || 0.043, side * (o.rot || 0), 0.063);
      }
      if (o.highlight) h.disc(light, x - side * 0.012, (o.y == null ? 0.06 : o.y) + 0.022, 0.009, 0.067);
    };
    const brow = (side, angry) => h.bar(ink, side * 0.105, 0.145, 0.14, 0.022, side * (angry ? -0.28 : 0.1));
    const xEye = (side, big) => {
      const x = side * 0.1;
      h.bar(ink, x, 0.06, big ? 0.14 : 0.105, 0.026, Math.PI / 4);
      h.bar(ink, x, 0.06, big ? 0.14 : 0.105, 0.026, -Math.PI / 4);
    };
    const lid = (side, amount) => h.bar(ink, side * 0.1, 0.09 - amount * 0.02, 0.145, 0.035 + amount * 0.012, side * 0.08);

    if (style === 'x' || style === 'big_x') {
      [-1, 1].forEach(side => xEye(side, style === 'big_x'));
    } else if (style === 'winky') {
      ovalEye(-1, { highlight: true });
      h.arc(ink, 0.1, 0.055, 0.06, 0.014, 2.1, Math.PI + 0.45);
    } else if (style === 'black') {
      [-1, 1].forEach(side => ovalEye(side, { white: false, pupil: false, rx: 0.053, ry: 0.077 }));
    } else if (style === 'black_highlight' || style === 'black_highlight_angry' || style === 'black_highlight_adorable') {
      const adorable = style.endsWith('adorable');
      [-1, 1].forEach(side => {
        ovalEye(side, { white: false, pupil: false, rx: adorable ? 0.07 : 0.057, ry: adorable ? 0.09 : 0.079 });
        h.disc(light, side * 0.084, 0.088, adorable ? 0.014 : 0.01, 0.067);
        if (style.endsWith('angry')) brow(side, true);
      });
    } else if (style === 'one_white' || style === 'black_and_white') {
      ovalEye(-1, { white: false, pupil: false, rx: 0.055, ry: 0.078 });
      ovalEye(1, { highlight: true });
    } else if (style === 'hollow') {
      [-1, 1].forEach(side => {
        h.oval(ink, side * 0.1, 0.06, 0.078, 0.09, side * 0.08, 0.056);
        h.oval(light, side * 0.1, 0.06, 0.045, 0.056, side * 0.08, 0.062);
      });
    } else if (style === 'heart') {
      [-1, 1].forEach(side => {
        h.disc(warm, side * 0.1 - 0.018, 0.078, 0.036, 0.06);
        h.disc(warm, side * 0.1 + 0.018, 0.078, 0.036, 0.06);
        h.bar(warm, side * 0.1, 0.045, 0.062, 0.062, Math.PI / 4, 0.06);
      });
    } else if (style === 'hypno') {
      [-1, 1].forEach(side => {
        h.disc(light, side * 0.1, 0.06, 0.077, 0.057);
        h.disc(warm, side * 0.1, 0.06, 0.058, 0.061);
        h.disc(light, side * 0.1, 0.06, 0.039, 0.064);
        h.disc(ink, side * 0.1, 0.06, 0.02, 0.067);
      });
    } else if (style === 'blinds' || style === 'glasses') {
      const lens = style === 'blinds' ? warm : ink;
      [-1, 1].forEach(side => h.oval(lens, side * 0.1, 0.065, 0.085, 0.068, 0, 0.06));
      h.bar(ink, 0, 0.065, 0.39, 0.024, 0, 0.064);
      if (style === 'blinds') for (let y = 0.03; y <= 0.1; y += 0.024) h.bar(ink, 0, y, 0.34, 0.009, 0, 0.067);
    } else if (style === 'jack_O_lantern') {
      [-1, 1].forEach(side => {
        h.bar(gold, side * 0.1, 0.06, 0.105, 0.08, side * 0.5, 0.06);
        brow(side, true);
      });
    } else if (style === 'anime' || style === 'cute' || style === 'charming' || style === 'left_eyelashes') {
      [-1, 1].forEach(side => {
        ovalEye(side, { rx: style === 'anime' ? 0.075 : 0.066, ry: 0.092, highlight: true, look: side * -0.006 });
        if (style === 'anime' || style === 'left_eyelashes') {
          const lashes = side < 0 || style === 'anime' ? 2 : 0;
          for (let i = 0; i < lashes; i += 1) h.bar(ink, side * 0.155, 0.105 + i * 0.02, 0.06, 0.012, side * (0.35 + i * 0.15));
        }
      });
    } else if (style === 'beady' || style === 'beady_angry') {
      [-1, 1].forEach(side => {
        h.disc(ink, side * 0.1, 0.06, 0.025, 0.06);
        if (style.endsWith('angry')) brow(side, true);
      });
    } else if (style === 'red' || style === 'yellow') {
      [-1, 1].forEach(side => ovalEye(side, { pupilColor: style === 'red' ? 'warm' : 'gold', highlight: true }));
    } else if (style === 'crazy' || style === 'wobbly' || style === 'scared') {
      ovalEye(-1, { rx: style === 'scared' ? 0.055 : 0.077, ry: style === 'scared' ? 0.1 : 0.07, look: -0.018, highlight: true });
      ovalEye(1, { rx: 0.056, ry: style === 'scared' ? 0.1 : 0.092, look: 0.018, highlight: true });
    } else if (style === 'clown') {
      [-1, 1].forEach(side => {
        ovalEye(side, { highlight: true });
        h.bar(warm, side * 0.1, 0.145, 0.09, 0.026, side * 0.35);
      });
    } else {
      // Tired, angry, side-eye, plotting, intense, tattoo and remaining
      // editorial expressions all share readable whites and vary the lids,
      // pupils and brow angle from their trait name.
      const angry = /angry|intense|plotting/.test(style);
      const tired = /tired|blazed|unbothered|unimpressed/.test(style);
      const side = /sideeye/.test(style);
      [-1, 1].forEach(sign => {
        ovalEye(sign, {
          ry: tired ? 0.06 : 0.081,
          look: side ? -sign * 0.025 : (angry ? -sign * 0.009 : 0),
          pupilColor: /blazed/.test(style) ? 'warm' : null,
          highlight: /blank|adorable/.test(style)
        });
        if (tired) lid(sign, /always_tired/.test(style) ? 1 : 0.55);
        if (angry) brow(sign, true);
      });
      if (/tattoo/.test(style)) {
        h.disc(warm, -0.17, -0.015, 0.012, 0.064);
        h.bar(warm, -0.17, -0.05, 0.018, 0.055, 0, 0.064);
      }
      if (style === 'groucho') {
        h.bar(ink, 0, -0.005, 0.24, 0.032, 0, 0.066);
        h.arc(ink, 0, -0.02, 0.1, 0.02, Math.PI, Math.PI);
      }
    }

    flush(group, b);
  }

  function cigarette(group, api) {
    const paper = api.MAT.toon(COLOR.creamDim);
    api.PRIM.cyl(0.012, 0.014, 0.1, 6, paper, {
      pos: [0.13, -0.09, -0.29], rot: [0, 0, 0.42], parent: group, outline: 0.006, ray: false
    });
    api.PRIM.sph(0.013, api.MAT.toon(COLOR.rust), {
      pos: [0.17, -0.11, -0.29], parent: group, outline: 0.006, ray: false
    });
  }

  function mouth(item, group, skin, api) {
    const raw = item.traits.mouth || 'smile';
    const smoking = /smoking/.test(raw);
    const style = raw.replace(/_?smoking/g, '').replace(/^grin$/, 'smile');
    const h = api.helpers;
    const b = batches(api, skin);
    const ink = b.ink;
    const light = b.light;
    const accent = b.accent;
    const warm = b.warm;
    const gold = b.gold;
    const muzzle = b.light;

    const grin = (teeth, tongue) => {
      h.oval(ink, 0, -0.095, 0.13, 0.09, 0, 0.07);
      if (teeth) {
        h.bar(light, 0, -0.052, 0.22, 0.043, 0, 0.076);
        for (let i = -2; i <= 2; i += 1) h.bar(ink, i * 0.043, -0.052, 0.008, 0.043, 0, 0.08);
      }
      if (tongue) h.oval(warm, 0.025, -0.145, 0.07, 0.04, -0.08, 0.076);
    };
    const nose = (x, y, rx, ry) => h.oval(ink, x || 0, y == null ? -0.025 : y, rx || 0.035, ry || 0.026, 0, 0.064);
    const whiskers = () => [-1, 1].forEach(side => {
      h.bar(ink, side * 0.17, -0.045, 0.16, 0.01, side * 0.25, 0.064);
      h.bar(ink, side * 0.175, -0.085, 0.16, 0.01, -side * 0.15, 0.064);
    });

    if (/rat|wolf|fox|cat|snout/.test(style)) {
      h.oval(muzzle, 0, -0.065, /snout/.test(style) ? 0.145 : 0.115, 0.065, 0, 0.057);
      nose(0, -0.025, /snout/.test(style) ? 0.045 : 0.034, 0.025);
      whiskers();
      if (/sharp_teeth/.test(style)) grin(true, false);
      else if (/smiling/.test(style)) h.arc(ink, 0, -0.08, 0.075, 0.012, 1.6, Math.PI + 0.25);
      else h.bar(ink, 0, -0.095, 0.12, 0.012, 0, 0.068);
    } else if (/ape/.test(style)) {
      h.oval(muzzle, 0, -0.075, 0.14, 0.09, 0, 0.058);
      nose(0, -0.025, 0.052, 0.03);
      h.arc(ink, 0, -0.09, 0.082, 0.012, Math.PI, Math.PI);
      if (/unshaven/.test(style)) for (let i = -2; i <= 2; i += 1) h.bar(ink, i * 0.04, -0.15, 0.028, 0.01, i * 0.15, 0.066);
    } else if (style === 'cow' || style === 'horse') {
      h.oval(muzzle, 0, -0.07, style === 'cow' ? 0.145 : 0.12, 0.085, 0, 0.058);
      h.disc(ink, -0.05, -0.065, 0.016, 0.065);
      h.disc(ink, 0.05, -0.065, 0.016, 0.065);
      h.arc(ink, 0, -0.105, 0.075, 0.012, 1.8, Math.PI + 0.25);
    } else if (/beaver|chipmunk|overbite|one_tooth/.test(style)) {
      h.oval(muzzle, 0, -0.065, 0.105, 0.065, 0, 0.058);
      nose();
      h.bar(light, 0, -0.12, /one_tooth/.test(style) ? 0.045 : 0.09, 0.065, 0, 0.074);
      if (!/one_tooth/.test(style)) h.bar(ink, 0, -0.12, 0.01, 0.065, 0, 0.078);
    } else if (/beak/.test(style)) {
      const beak = api.MAT.toon(COLOR.mustard);
      api.PRIM.cone(/chubby/.test(style) ? 0.09 : 0.07, /chubby/.test(style) ? 0.18 : 0.15, 5, beak, {
        pos: [0, -0.055, -0.32], rot: [-Math.PI / 2, 0, 0], parent: group, outline: 0.016, ray: false
      });
    } else if (style === 'duct_tape') {
      h.bar(b.cool, 0, -0.09, 0.25, 0.075, -0.08, 0.069);
      for (let i = -2; i <= 2; i += 1) h.bar(ink, i * 0.046, -0.09, 0.01, 0.075, -0.08, 0.074);
    } else if (/red_lips|green_lips/.test(style)) {
      const lips = /green/.test(style) ? b.cool : warm;
      h.oval(lips, 0, -0.08, 0.105, 0.04, 0, 0.067);
      h.bar(ink, 0, -0.08, 0.17, 0.01, 0, 0.072);
    } else if (/grill/.test(style)) {
      grin(true, false);
      h.bar(gold, 0, -0.052, 0.20, 0.025, 0, 0.083);
    } else if (/sharp_teeth|devilish_grin/.test(style)) {
      grin(true, false);
      [-2, -1, 1, 2].forEach(i => h.bar(light, i * 0.04, -0.105, 0.022, 0.055, i * 0.06, 0.079));
    } else if (/fangs_and_tongue/.test(style)) {
      grin(false, true);
      [-1, 1].forEach(side => h.bar(light, side * 0.055, -0.065, 0.026, 0.07, side * 0.1, 0.079));
    } else if (/tongue_out|silly/.test(style)) {
      grin(false, true);
    } else if (/open_mouth|excited|clown/.test(style)) {
      grin(/excited|clown/.test(style), true);
      if (/clown/.test(style)) h.disc(warm, 0, -0.005, 0.045, 0.068);
    } else if (/sad|worried|unsure|unacceptable/.test(style)) {
      h.arc(ink, 0, -0.125, /worried/.test(style) ? 0.075 : 0.09, 0.014, 1.8, 0.65);
      if (/unacceptable/.test(style)) h.bar(ink, 0, -0.04, 0.12, 0.02, 0, 0.067);
    } else if (/biting_lip/.test(style)) {
      h.oval(warm, 0, -0.09, 0.095, 0.04, 0, 0.067);
      h.bar(light, 0.03, -0.075, 0.09, 0.025, 0.08, 0.074);
    } else if (/handprint/.test(style)) {
      h.bar(warm, 0, -0.08, 0.16, 0.065, -0.15, 0.068);
      for (let i = -2; i <= 2; i += 1) h.bar(warm, i * 0.028, -0.02, 0.018, 0.075, i * 0.12, 0.068);
    } else if (/snowman/.test(style)) {
      nose(0, -0.025, 0.024, 0.02);
      for (let i = -2; i <= 2; i += 1) h.disc(ink, i * 0.035, -0.1 + Math.abs(i) * 0.009, 0.01, 0.067);
    } else {
      // smile, smirk, cute and the remaining compact human mouths.
      const smirk = /smirk/.test(style);
      h.arc(ink, smirk ? 0.02 : 0, -0.08, smirk ? 0.075 : 0.09, 0.013, smirk ? 1.45 : 1.75, Math.PI + (smirk ? 0.35 : 0.15));
      if (/big_nose|pointy_nose|brown_beard|jowels/.test(style)) nose(0, -0.02, /big_nose/.test(style) ? 0.055 : 0.035, 0.027);
      if (/brown_beard|jowels/.test(style)) h.oval(accent, 0, -0.115, 0.13, 0.075, 0, 0.055);
    }

    flush(group, b);
    if (smoking) cigarette(group, api);
  }

  function hatBadge(item, hat, api) {
    const trait = item.traits.accessory || 'alpha';
    const badge = new api.THREE.Group();
    badge.position.set(-0.19, 0.29, -0.19);
    badge.rotation.x = Math.PI / 2;
    hat.add(badge);
    const color = colorFor(trait);
    const material = api.MAT.toon(color);
    const ink = api.MAT.toon(COLOR.ink);
    const kind = hash(trait) % 5;

    if (trait === 'flower') {
      for (let i = 0; i < 5; i += 1) {
        const angle = i / 5 * Math.PI * 2;
        api.PRIM.sph(0.022, material, {
          pos: [Math.cos(angle) * 0.035, 0, Math.sin(angle) * 0.035], scale: [1, 0.45, 1],
          parent: badge, outline: 0.006, ray: false
        });
      }
      api.PRIM.sph(0.018, api.MAT.toon(COLOR.mustard), { parent: badge, outline: 0.006, ray: false });
    } else if (trait === 'crown') {
      api.PRIM.box(0.11, 0.025, 0.045, material, { parent: badge, outline: 0.007, ray: false });
      [-1, 0, 1].forEach(step => api.PRIM.cone(0.022, 0.065, 4, material, {
        pos: [step * 0.038, 0, -0.045], parent: badge, outline: 0.007, ray: false
      }));
    } else if (/all_seeing_eye|sad_face|x_smiley|scream/.test(trait)) {
      api.PRIM.cyl(0.065, 0.065, 0.018, 14, material, { parent: badge, outline: 0.009, ray: false });
      api.PRIM.cyl(0.018, 0.018, 0.022, 10, ink, { pos: [0, -0.014, 0], parent: badge, outline: 0.004, ray: false });
    } else if (/bandana|scarf/.test(trait)) {
      api.PRIM.box(0.11, 0.018, 0.045, material, { rot: [0, 0.1, 0.45], parent: badge, outline: 0.007, ray: false });
      api.PRIM.box(0.08, 0.018, 0.035, material, { pos: [0.04, 0, 0.045], rot: [0, -0.2, -0.45], parent: badge, outline: 0.007, ray: false });
    } else if (/devil|hannya|kitsune|tengu/.test(trait)) {
      [-1, 1].forEach(side => api.PRIM.cone(0.025, 0.075, 5, material, {
        pos: [side * 0.035, 0, -0.025], rot: [0, 0, side * 0.35], parent: badge, outline: 0.007, ray: false
      }));
    } else if (kind === 0) {
      api.PRIM.cyl(0.055, 0.055, 0.018, 12, material, { parent: badge, outline: 0.008, ray: false });
    } else if (kind === 1) {
      api.PRIM.box(0.085, 0.02, 0.085, material, { rot: [0, 0.2, Math.PI / 4], parent: badge, outline: 0.008, ray: false });
    } else if (kind === 2) {
      api.PRIM.cone(0.06, 0.085, 5, material, { parent: badge, outline: 0.008, ray: false });
    } else if (kind === 3) {
      [-1, 1].forEach(side => api.PRIM.sph(0.038, material, {
        pos: [side * 0.025, 0, -0.012], scale: [1, 0.45, 1], parent: badge, outline: 0.007, ray: false
      }));
      api.PRIM.cone(0.045, 0.075, 4, material, { pos: [0, 0, 0.035], parent: badge, outline: 0.007, ray: false });
    } else {
      api.PRIM.torus(0.045, 0.012, material, { parent: badge, outline: 0.007, ray: false });
    }
  }

  function buildHead(value, group, skin, api) {
    const item = get(value);
    if (!item || !group || !api || !api.PRIM || !api.MAT || !api.THREE || !api.helpers) return false;
    bodyTrait(item, group, skin, api);
    eyePair(item, group, skin, api);
    mouth(item, group, skin, api);
    const hat = aviationHat(item, group, api);
    hatBadge(item, hat, api);
    group.userData.aviationTokenId = item.tokenId;
    group.userData.aviationTraits = Object.assign({}, item.traits);
    return true;
  }

  root.AVIATION_HEAD_PACK = Object.freeze({
    schemaVersion: 1,
    count: items.length,
    list,
    search,
    get,
    headSkin,
    buildHead
  });
})(typeof window !== 'undefined' ? window : globalThis);
