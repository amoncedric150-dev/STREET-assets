/* =====================================================================
   interiors/materials.js  —  matériaux PBR de l'intérieur
   Les textures (couleur + normale + rugosité) sont DESSINÉES par le code
   (canvas 256–512 px) : rien à télécharger, léger pour le mobile.
   Tu peux les remplacer par de vraies textures PBR (voir README : dossier
   Textures/interiors/ + INTERIORS.CONFIG.realTextures = true).
   NS.makeMaterials(THREE, styleName) -> { m: {nom: matériau}, all: [...] }
   ===================================================================== */
(function (root) {
  'use strict';
  var NS = root.INTERIORS = root.INTERIORS || {};
  var CFG = NS.CONFIG;

  // Palettes : même appartement, ambiances différentes (pour varier d'un immeuble à l'autre)
  NS.styles = NS.styles || {
    modern: { paintWarm: 0xd9d0c1, paintLight: 0xeceae4, paintBlue: 0x93a7b6, ceiling: 0xf6f4f0, parquet: 0xffffff,
              sofa: 0x70757b, armchair: 0x4a6279, linen: 0xe9e3d8, woodDark: 0x5a4333, woodLight: 0xd2ad80,
              cab: 0xf1f1ef, counter: 0x2f3236, tileFloor: 0xffffff },
    warm:   { paintWarm: 0xe4caa4, paintLight: 0xf1e3cc, paintBlue: 0xc7a395, ceiling: 0xf8f1e6, parquet: 0xe6c9a4,
              sofa: 0x8c6b4f, armchair: 0x5c7a58, linen: 0xf1e6d2, woodDark: 0x4b3425, woodLight: 0xe0bf92,
              cab: 0xe8e0d2, counter: 0x4a4038, tileFloor: 0xeadfce }
  };

  function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function cv(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // Dessine (couleur [+ hauteur]) puis déduit la carte de normales et de rugosité
  function pbr(THREE, w, h, paint, o) {
    var seed = o.seed || 1, c = cv(w, h), g = c.getContext('2d'), N = w * h, i, x, y;
    paint(g, w, h, rng(seed));
    var col = g.getImageData(0, 0, w, h).data, hh = new Float32Array(N), lum = new Float32Array(N);
    for (i = 0; i < N; i++) lum[i] = (0.299 * col[i * 4] + 0.587 * col[i * 4 + 1] + 0.114 * col[i * 4 + 2]) / 255;
    if (o.height) {
      var hc = cv(w, h), hg = hc.getContext('2d'); o.height(hg, w, h, rng(seed + 7));
      var hd = hg.getImageData(0, 0, w, h).data; for (i = 0; i < N; i++) hh[i] = hd[i * 4] / 255;
    } else for (i = 0; i < N; i++) hh[i] = lum[i];
    var nc = cv(w, h), ng = nc.getContext('2d'), nd = ng.createImageData(w, h), s = o.nstr == null ? 2.5 : o.nstr;
    var rc = cv(w, h), rg = rc.getContext('2d'), rd = rg.createImageData(w, h), r0 = o.rough == null ? 0.7 : o.rough, rv = o.rv == null ? 0.3 : o.rv;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var k = y * w + x, xl = y * w + (x + w - 1) % w, xr = y * w + (x + 1) % w, yu = ((y + h - 1) % h) * w + x, yd = ((y + 1) % h) * w + x;
      var dx = (hh[xr] - hh[xl]) * s, dy = (hh[yd] - hh[yu]) * s, l = Math.sqrt(dx * dx + dy * dy + 1);
      nd.data[k * 4] = (-dx / l * 0.5 + 0.5) * 255; nd.data[k * 4 + 1] = (dy / l * 0.5 + 0.5) * 255; nd.data[k * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; nd.data[k * 4 + 3] = 255;
      var rr = Math.max(0.04, Math.min(1, r0 + (0.5 - lum[k]) * rv)) * 255;
      rd.data[k * 4] = rd.data[k * 4 + 1] = rd.data[k * 4 + 2] = rr; rd.data[k * 4 + 3] = 255;
    }
    ng.putImageData(nd, 0, 0); rg.putImageData(rd, 0, 0);
    function T(canvas, srgb) {
      var t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
      if (srgb) t.encoding = THREE.sRGBEncoding; return t;
    }
    return { map: T(c, true), normalMap: T(nc, false), roughnessMap: T(rc, false), nstr: o.nscale == null ? 1 : o.nscale };
  }

  /* ---------- peintres de textures ---------- */
  function noiseFill(g, w, h, rnd, base, amp) {
    var im = g.createImageData(w, h), i, v;
    for (i = 0; i < w * h; i++) { v = base + (rnd() - 0.5) * amp; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
  }
  var paint = {
    plaster: function (g, w, h, rnd) {
      noiseFill(g, w, h, rnd, 236, 14);
      for (var i = 0; i < 14; i++) { var x = rnd() * w, y = rnd() * h, r = 30 + rnd() * 70, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,.05)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    },
    parquet: function (g, w, h, rnd) {          // 8 lames de 15 cm sur 1,20 m, longueur 60 cm, décalées
      var cols = 8, cw = w / cols, seg = h / 2, c, k, i;
      g.fillStyle = '#2a1a0e'; g.fillRect(0, 0, w, h);
      for (c = 0; c < cols; c++) {
        var off = [0, seg / 2, seg / 4, seg * 0.75][Math.floor(rnd() * 4)];
        for (k = -1; k < 3; k++) {
          var y0 = k * seg + off, hue = 28 + rnd() * 6, lt = 46 + rnd() * 12;
          g.fillStyle = 'hsl(' + hue + ',48%,' + lt + '%)'; g.fillRect(c * cw + 1, y0 + 1, cw - 2, seg - 2);
          for (i = 0; i < 16; i++) { g.fillStyle = 'rgba(60,32,12,' + (0.06 + rnd() * 0.12) + ')'; g.fillRect(c * cw + 2 + rnd() * (cw - 5), y0, 1 + rnd() * 1.5, seg); }
        }
      }
    },
    parquetH: function (g, w, h, rnd) {
      var cols = 8, cw = w / cols, seg = h / 2, c, k; g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      var r = rng(1); // même décalages que la couleur (même graine)
      for (c = 0; c < cols; c++) { var off = [0, seg / 2, seg / 4, seg * 0.75][Math.floor(r() * 4)]; for (k = -1; k < 3; k++) { r(); r(); for (var i = 0; i < 16; i++) { r(); r(); r(); } g.fillStyle = '#c8c8c8'; g.fillRect(c * cw + 2, k * seg + off + 2, cw - 4, seg - 4); } }
    },
    tileLarge: function (g, w, h, rnd) {          // 2 × 2 carreaux gris pierre
      var n = 2, s = w / n, i, j;
      g.fillStyle = '#9a9a98'; g.fillRect(0, 0, w, h);
      for (j = 0; j < n; j++) for (i = 0; i < n; i++) {
        var l = 52 + rnd() * 8; g.fillStyle = 'hsl(40,4%,' + l + '%)'; g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
        for (var k = 0; k < 260; k++) { g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '255,255,255' : '0,0,0') + ',' + rnd() * 0.07 + ')'; g.fillRect(i * s + 3 + rnd() * (s - 6), j * s + 3 + rnd() * (s - 6), 1 + rnd() * 5, 1 + rnd() * 2); }
      }
    },
    tileSmall: function (g, w, h, rnd) {          // 6 × 6 petits carreaux bleu-gris
      var n = 6, s = w / n, i, j;
      g.fillStyle = '#b8bec2'; g.fillRect(0, 0, w, h);
      for (j = 0; j < n; j++) for (i = 0; i < n; i++) { g.fillStyle = 'hsl(203,12%,' + (50 + rnd() * 7) + '%)'; g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3); }
    },
    subway: function (g, w, h, rnd) {              // carrelage métro 2 × 4, joints décalés
      var cw = w / 2, ch = h / 4, i, j;
      g.fillStyle = '#a9aeae'; g.fillRect(0, 0, w, h);
      for (j = 0; j < 4; j++) for (i = -1; i < 2; i++) {
        var ox = (j % 2) * cw / 2; g.fillStyle = 'hsl(190,8%,' + (90 + rnd() * 4) + '%)'; g.fillRect(i * cw + ox + 1.5, j * ch + 1.5, cw - 3, ch - 3);
      }
    },
    gridHeight: function (n, inset) {              // hauteur : carreaux = clair, joints = noir
      return function (g, w, h) { var s = w / n, i, j; g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; for (j = 0; j < n; j++) for (i = 0; i < n; i++) g.fillRect(i * s + inset, j * s + inset, s - 2 * inset, s - 2 * inset); };
    },
    subwayHeight: function (g, w, h) {
      var cw = w / 2, ch = h / 4, i, j; g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff';
      for (j = 0; j < 4; j++) for (i = -1; i < 2; i++) g.fillRect(i * cw + (j % 2) * cw / 2 + 1.5, j * ch + 1.5, cw - 3, ch - 3);
    },
    wood: function (g, w, h, rnd) {                // veines horizontales (périodiques)
      var y, x, im = g.createImageData(w, h), TAU = Math.PI * 2;
      for (y = 0; y < h; y++) {
        var L = 0.78 + 0.11 * Math.sin(TAU * 9 * y / h) + 0.06 * Math.sin(TAU * 23 * y / h + 1.3) + (rnd() - 0.5) * 0.04;
        for (x = 0; x < w; x++) {
          var l2 = L + 0.03 * Math.sin(TAU * 3 * x / w + y * 0.1), k = (y * w + x) * 4;
          im.data[k] = 200 * l2; im.data[k + 1] = 160 * l2; im.data[k + 2] = 118 * l2; im.data[k + 3] = 255;
        }
      }
      g.putImageData(im, 0, 0);
    },
    fabric: function (g, w, h, rnd) {              // tissage serré
      var im = g.createImageData(w, h), x, y;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) { var v = ((x >> 1) + (y >> 1)) % 2 ? 214 : 190; v += (rnd() - 0.5) * 20; var k = (y * w + x) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = v; im.data[k + 3] = 255; }
      g.putImageData(im, 0, 0);
    },
    fabricH: function (g, w, h) { var x, y, im = g.createImageData(w, h); for (y = 0; y < h; y++) for (x = 0; x < w; x++) { var v = ((x >> 1) + (y >> 1)) % 2 ? 255 : 90, k = (y * w + x) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = v; im.data[k + 3] = 255; } g.putImageData(im, 0, 0); },
    rug: function (a, b, c) {                      // tapis : bordure + losange (couleurs a/b/c)
      return function (g, w, h, rnd) {
        g.fillStyle = a; g.fillRect(0, 0, w, h);
        g.fillStyle = b; g.fillRect(w * 0.04, h * 0.04, w * 0.92, h * 0.92);
        g.fillStyle = a; g.fillRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84);
        g.fillStyle = c; g.beginPath(); g.moveTo(w / 2, h * 0.16); g.lineTo(w * 0.84, h / 2); g.lineTo(w / 2, h * 0.84); g.lineTo(w * 0.16, h / 2); g.closePath(); g.fill();
        g.fillStyle = a; g.beginPath(); g.moveTo(w / 2, h * 0.3); g.lineTo(w * 0.7, h / 2); g.lineTo(w / 2, h * 0.7); g.lineTo(w * 0.3, h / 2); g.closePath(); g.fill();
        for (var i = 0; i < 4000; i++) { g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '255,255,255' : '0,0,0') + ',.05)'; g.fillRect(rnd() * w, rnd() * h, 2, 1); }
      };
    },
    art: function (bg, c1, c2, c3) {               // tableau abstrait
      return function (g, w, h, rnd) {
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.fillStyle = c1; g.beginPath(); g.arc(w * 0.35, h * 0.45, h * 0.28, 0, 7); g.fill();
        g.fillStyle = c2; g.fillRect(w * 0.5, h * 0.2, w * 0.3, h * 0.55);
        g.fillStyle = c3; g.beginPath(); g.arc(w * 0.68, h * 0.7, h * 0.14, 0, 7); g.fill();
        g.strokeStyle = 'rgba(20,20,20,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w * 0.1, h * 0.85); g.bezierCurveTo(w * 0.3, h * 0.6, w * 0.6, h * 1.0, w * 0.9, h * 0.8); g.stroke();
      };
    }
  };

  var TEXC = {};   // textures partagées entre les styles
  function tex(THREE, key, w, h, p, o) { return TEXC[key] || (TEXC[key] = pbr(THREE, w, h, p, o)); }

  NS.makeMaterials = function (THREE, styleName) {
    var st = NS.styles[styleName] || NS.styles.modern, m = {}, all = [], mob = !!(root.matchMedia && root.matchMedia('(pointer:coarse)').matches);
    var S2 = mob ? 256 : 512;

    function M(name, tile, props, t) {
      if (t) { props.map = t.map; props.normalMap = t.normalMap; props.roughnessMap = t.roughnessMap; props.roughness = 1; props.normalScale = new THREE.Vector2(t.nstr, t.nstr); }
      var mat = new THREE.MeshStandardMaterial(props);
      mat.name = name; mat.envMapIntensity = CFG.envIntensity; mat.userData.tile = tile || 1;
      m[name] = mat; all.push(mat); return mat;
    }
    var plaster = tex(THREE, 'plaster', 256, 256, paint.plaster, { seed: 3, rough: 0.92, rv: 0.1, nstr: 1.2, nscale: 0.5 });
    var parquet = tex(THREE, 'parquet', S2, S2, paint.parquet, { seed: 1, height: paint.parquetH, rough: 0.5, rv: 0.5, nstr: 3, nscale: 0.9 });
    var tileL = tex(THREE, 'tileL', S2, S2, paint.tileLarge, { seed: 5, height: paint.gridHeight(2, 3), rough: 0.32, rv: 0.4, nstr: 4, nscale: 1 });
    var tileS = tex(THREE, 'tileS', S2, S2, paint.tileSmall, { seed: 6, height: paint.gridHeight(6, 2), rough: 0.28, rv: 0.2, nstr: 3, nscale: 1 });
    var subway = tex(THREE, 'subway', 256, 256, paint.subway, { seed: 8, height: paint.subwayHeight, rough: 0.14, rv: 0.2, nstr: 3, nscale: 1 });
    var wood = tex(THREE, 'wood', 256, 256, paint.wood, { seed: 9, rough: 0.55, rv: 0.6, nstr: 2.5, nscale: 0.7 });
    var fabric = tex(THREE, 'fabric', 128, 128, paint.fabric, { seed: 10, height: paint.fabricH, rough: 0.95, rv: 0.1, nstr: 3, nscale: 1 });
    var rugA = tex(THREE, 'rugA', 256, 256, paint.rug('#d8d0c0', '#3e5560', '#9b6a4e'), { seed: 11, rough: 0.97, rv: 0.05, nstr: 1.5, nscale: 0.6 });
    var rugB = tex(THREE, 'rugB', 256, 256, paint.rug('#c9c4bb', '#7b5a4a', '#5c6f7a'), { seed: 12, rough: 0.97, rv: 0.05, nstr: 1.5, nscale: 0.6 });
    var art1 = tex(THREE, 'art1', 256, 256, paint.art('#e8dccb', '#c0583f', '#2f5d73', '#e0b44c'), { seed: 13, rough: 0.7, rv: 0.1, nstr: 0.5, nscale: 0.2 });
    var art2 = tex(THREE, 'art2', 256, 256, paint.art('#d6dfe0', '#4a7c6f', '#d9a441', '#b5523b'), { seed: 14, rough: 0.7, rv: 0.1, nstr: 0.5, nscale: 0.2 });

    // architecture
    M('wall', 2, { color: 0xf1efe9 }, plaster);
    M('ceil', 2, { color: st.ceiling }, plaster);
    M('paintWarm', 2, { color: st.paintWarm }, plaster);
    M('paintLight', 2, { color: st.paintLight }, plaster);
    M('paintBlue', 2, { color: st.paintBlue }, plaster);
    M('trim', 1, { color: 0xf6f5f2, roughness: 0.4, metalness: 0 });
    M('parquet', 1.2, { color: st.parquet }, parquet);
    M('tileKitchen', 1.2, { color: st.tileFloor }, tileL);
    M('tileBath', 1.2, { color: st.tileFloor }, tileS);
    M('tileWall', 0.6, { color: 0xf3f6f6 }, subway);
    M('tileSplash', 0.6, { color: 0xc5d3cc }, subway);
    M('doorWood', 1, { color: 0xf2f0ec, roughness: 0.45, metalness: 0 });
    M('doorMain', 0.8, { color: 0x6a4a36 }, wood);
    M('frame', 1, { color: 0x2a2c2f, roughness: 0.5, metalness: 0.4 });
    M('glass', 1, { color: 0xcfe6f2, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
    M('glassFrost', 1, { color: 0xe9f1f3, roughness: 0.6, metalness: 0, transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide });
    // mobilier
    M('woodDark', 0.8, { color: st.woodDark }, wood);
    M('woodLight', 0.8, { color: st.woodLight }, wood);
    M('cabWhite', 1, { color: st.cab, roughness: 0.42, metalness: 0 });
    M('counterTop', 1, { color: st.counter, roughness: 0.3, metalness: 0.05 });
    M('fabricGrey', 0.3, { color: st.sofa }, fabric);
    M('fabricBlue', 0.3, { color: st.armchair }, fabric);
    M('linen', 0.3, { color: st.linen }, fabric);
    M('mattress', 0.3, { color: 0xf5f2ec }, fabric);
    M('pillowW', 0.3, { color: 0xfaf8f4 }, fabric);
    M('rugA', 1, { color: 0xffffff }, rugA);
    M('rugB', 1, { color: 0xffffff }, rugB);
    M('art1', 1, { color: 0xffffff }, art1);
    M('art2', 1, { color: 0xffffff }, art2);
    M('metal', 1, { color: 0xc4c8cc, roughness: 0.33, metalness: 0.9 });
    M('chrome', 1, { color: 0xeceef0, roughness: 0.12, metalness: 1 });
    M('black', 1, { color: 0x151617, roughness: 0.5, metalness: 0.1 });
    M('screen', 1, { color: 0x050607, roughness: 0.08, metalness: 0.3 });
    M('ceramic', 1, { color: 0xf7f7f5, roughness: 0.14, metalness: 0 });
    M('ceramicIn', 1, { color: 0xe4e7e7, roughness: 0.2, metalness: 0 });
    M('mirror', 1, { color: 0xdfe6ea, roughness: 0.03, metalness: 1 }).envMapIntensity = 1.0;
    M('leaf', 1, { color: 0x3f7a42, roughness: 0.8 });
    M('pot', 1, { color: 0xb9b2a6, roughness: 0.75 });
    M('soil', 1, { color: 0x2b1f17, roughness: 1 });
    M('bookA', 1, { color: 0x9c3d3d, roughness: 0.8 });
    M('bookB', 1, { color: 0x3d5f9c, roughness: 0.8 });
    M('bookC', 1, { color: 0xd1b04f, roughness: 0.8 });
    var lg = M('lampGlow', 1, { color: 0xffffff, emissive: 0xffe6bd, emissiveIntensity: 1.1, roughness: 0.6 }); lg.envMapIntensity = 0;
    return { m: m, all: all };
  };

  // Textures PBR réelles (optionnel) : Textures/interiors/<nom>_color.jpg, _normal.jpg, _rough.jpg
  NS.TEXTURE_FILES = NS.TEXTURE_FILES || { parquet: 'parquet', tileKitchen: 'tile_floor', tileBath: 'tile_bath', tileWall: 'tile_wall',
    woodDark: 'wood', woodLight: 'wood', paintWarm: 'plaster', paintLight: 'plaster', paintBlue: 'plaster', wall: 'plaster', ceil: 'plaster' };
  NS.loadRealTextures = function (THREE, mats) {
    var path = CFG.texturesPath || 'Textures/interiors/', tl = new THREE.TextureLoader(), cache = {};
    function get(file, srgb, cb) {
      if (cache[file] !== undefined) return cb(cache[file]);
      tl.load(path + file, function (t) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (srgb) t.encoding = THREE.sRGBEncoding; cache[file] = t; cb(t); }, undefined, function () { cache[file] = null; cb(null); });
    }
    Object.keys(NS.TEXTURE_FILES).forEach(function (name) {
      var mat = mats[name]; if (!mat) return; var base = NS.TEXTURE_FILES[name];
      get(base + '_color.jpg', true, function (t) { if (t) { mat.map = t; mat.needsUpdate = true; } });
      get(base + '_normal.jpg', false, function (t) { if (t) { mat.normalMap = t; mat.needsUpdate = true; } });
      get(base + '_rough.jpg', false, function (t) { if (t) { mat.roughnessMap = t; mat.roughness = 1; mat.needsUpdate = true; } });
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
